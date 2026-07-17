#!/usr/bin/env python3
"""
SkyGuard OS <-> Sparrow DroneID bridge.

Polls the Sparrow DroneID REST API (BLE + WiFi Remote ID) and forwards each
drone detection to the SkyGuard OS ingestion endpoint (POST /api/detections).
Also:
  - Sends a heartbeat to POST /api/heartbeat every 30 s so the dashboard
    shows "HARDWARE ONLINE" even when no drones are in range.
  - Fetches raw BLE/WiFi ambient scan data and posts to POST /api/ambient
    so the dashboard can display non-drone RF activity.

Configuration (environment variables — see .env.example):
  SPARROW_API_BASE         Sparrow REST base URL. Default: http://127.0.0.1:8020
  SPARROW_POLL_INTERVAL_S  How often to poll. Default: 2
  SKYGUARD_API_BASE        SkyGuard API base URL, e.g. http://localhost:3001
  SKYGUARD_DEVICE_KEY      Device API key from the SkyGuard Admin panel (sg_...).
  MIN_POST_INTERVAL_S      Min seconds between SkyGuard posts per drone. Default: 2
  HEARTBEAT_INTERVAL_S     How often to send heartbeat. Default: 30
  AMBIENT_INTERVAL_S       How often to post ambient scan batch. Default: 10

Run:
  source .env && python3 bridge.py

Always-on:
  sudo systemctl enable --now skyguard-sparrow-bridge.service
"""

import logging
import os
import sys
import time

import requests

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("skyguard-sparrow")

SPARROW_API_BASE = os.environ.get("SPARROW_API_BASE", "http://127.0.0.1:8020").rstrip("/")
POLL_INTERVAL_S = float(os.environ.get("SPARROW_POLL_INTERVAL_S", "2"))

API_BASE = os.environ.get("SKYGUARD_API_BASE", "").rstrip("/")
DEVICE_KEY = os.environ.get("SKYGUARD_DEVICE_KEY", "")
MIN_POST_INTERVAL_S = float(os.environ.get("MIN_POST_INTERVAL_S", "2"))
HEARTBEAT_INTERVAL_S = float(os.environ.get("HEARTBEAT_INTERVAL_S", "30"))
AMBIENT_INTERVAL_S = float(os.environ.get("AMBIENT_INTERVAL_S", "10"))

if not API_BASE or not DEVICE_KEY:
    log.error(
        "SKYGUARD_API_BASE and SKYGUARD_DEVICE_KEY must be set.\n"
        "Copy .env.example to .env, fill in the values, and `source .env`."
    )
    sys.exit(1)

DETECTIONS_URL = f"{API_BASE}/api/detections"
HEARTBEAT_URL  = f"{API_BASE}/api/heartbeat"
AMBIENT_URL    = f"{API_BASE}/api/ambient"

AUTH_HEADERS = {
    "Authorization": f"Bearer {DEVICE_KEY}",
    "Content-Type": "application/json",
}

# --- per-drone throttle ---
_last_sent: dict[str, float] = {}
_last_heartbeat: float = 0
_last_ambient: float = 0

# Sparrow ambient endpoints to try (in order). First 200-OK wins.
_SPARROW_BLE_CANDIDATES = [
    "/api/ble",
    "/api/ble/devices",
    "/api/scan/ble",
    "/api/bluetooth/devices",
]
_SPARROW_WIFI_CANDIDATES = [
    "/api/wifi",
    "/api/wifi/devices",
    "/api/scan/wifi",
]
_ble_endpoint: str | None = None
_wifi_endpoint: str | None = None
_ambient_discovery_done = False

SPARROW_SESSION = requests.Session()
SPARROW_SESSION.timeout = 4  # type: ignore[attr-defined]


def _clean(value, zero_is_null: bool = True):
    """Return None for missing / 0.0 sentinel values."""
    if value is None:
        return None
    if zero_is_null and value == 0.0:
        return None
    return value


# ---------------------------------------------------------------------------
# Drone detections
# ---------------------------------------------------------------------------

def fetch_drones() -> list[dict]:
    """GET /api/drones — returns all active drones (BLE + WiFi unified)."""
    url = f"{SPARROW_API_BASE}/api/drones"
    try:
        resp = SPARROW_SESSION.get(url)
        resp.raise_for_status()
        data = resp.json()
        if data.get("errcode", 0) != 0:
            log.warning("Sparrow API error %s: %s", data.get("errcode"), data.get("errmsg"))
            return []
        return data.get("drones", [])
    except requests.RequestException as exc:
        log.warning("Sparrow API unreachable at %s: %s", url, exc)
        return []
    except ValueError as exc:
        log.warning("Non-JSON response from Sparrow: %s", exc)
        return []


def map_drone(drone: dict) -> dict | None:
    """Map a Sparrow /api/drones entry to SkyGuard's IngestDetectionBody."""
    lat = _clean(drone.get("drone_lat"))
    lng = _clean(drone.get("drone_lon"))
    if lat is None or lng is None:
        return None

    speed_ms = _clean(drone.get("speed"))
    speed_kmh = round(speed_ms * 3.6, 1) if speed_ms is not None else None

    return {
        "droneId":    drone.get("serial_number") or drone.get("mac_address") or "UNKNOWN",
        "model":      drone.get("ua_type_name") or None,
        "signalType": (drone.get("protocol") or "UNKNOWN").upper(),
        "lat":        lat,
        "lng":        lng,
        "altitudeM":  _clean(drone.get("drone_alt_geo") or drone.get("drone_height_agl")),
        "speedKmh":   speed_kmh,
        "headingDeg": _clean(drone.get("direction")),
        "rssiDbm":    _clean(drone.get("rssi"), zero_is_null=False),
        "pilotLat":   _clean(drone.get("operator_lat")),
        "pilotLng":   _clean(drone.get("operator_lon")),
    }


def post_detection(body: dict) -> None:
    try:
        resp = requests.post(DETECTIONS_URL, json=body, headers=AUTH_HEADERS, timeout=5)
        if resp.status_code == 201:
            log.info(
                "Forwarded %s [%s] @ (%.5f, %.5f)",
                body["droneId"], body["signalType"], body["lat"], body["lng"],
            )
        elif resp.status_code == 401:
            log.error("SkyGuard rejected device key (401). Check SKYGUARD_DEVICE_KEY.")
        else:
            log.warning("SkyGuard %s for %s: %s", resp.status_code, body["droneId"], resp.text[:200])
    except requests.RequestException as exc:
        log.warning("Failed to reach SkyGuard at %s: %s", DETECTIONS_URL, exc)


def process_drones(drones: list[dict]) -> None:
    now = time.monotonic()
    for drone in drones:
        drone_id = drone.get("serial_number") or drone.get("mac_address") or ""
        if not drone_id:
            continue
        if now - _last_sent.get(drone_id, 0) < MIN_POST_INTERVAL_S:
            continue
        body = map_drone(drone)
        if body is None:
            log.debug("Skipping %s: no GPS fix", drone_id)
            continue
        _last_sent[drone_id] = now
        post_detection(body)


# ---------------------------------------------------------------------------
# Heartbeat
# ---------------------------------------------------------------------------

def maybe_send_heartbeat() -> None:
    global _last_heartbeat
    now = time.monotonic()
    if now - _last_heartbeat < HEARTBEAT_INTERVAL_S:
        return
    try:
        resp = requests.post(HEARTBEAT_URL, json={}, headers=AUTH_HEADERS, timeout=5)
        if resp.status_code == 200:
            log.debug("Heartbeat OK")
            _last_heartbeat = now
        elif resp.status_code == 401:
            log.error("Heartbeat rejected (401). Check SKYGUARD_DEVICE_KEY.")
        else:
            log.warning("Heartbeat %s: %s", resp.status_code, resp.text[:100])
    except requests.RequestException as exc:
        log.warning("Heartbeat failed: %s", exc)


# ---------------------------------------------------------------------------
# Ambient BLE / WiFi scan
# ---------------------------------------------------------------------------

def _discover_ambient_endpoints() -> None:
    """Try candidate endpoints once at startup; log result."""
    global _ble_endpoint, _wifi_endpoint, _ambient_discovery_done
    _ambient_discovery_done = True

    for path in _SPARROW_BLE_CANDIDATES:
        try:
            r = SPARROW_SESSION.get(f"{SPARROW_API_BASE}{path}")
            if r.status_code == 200:
                _ble_endpoint = path
                log.info("Sparrow BLE ambient endpoint: %s", path)
                break
        except Exception:
            pass
    if _ble_endpoint is None:
        log.info("No Sparrow BLE ambient endpoint found — BLE ambient scan disabled.")

    for path in _SPARROW_WIFI_CANDIDATES:
        try:
            r = SPARROW_SESSION.get(f"{SPARROW_API_BASE}{path}")
            if r.status_code == 200:
                _wifi_endpoint = path
                log.info("Sparrow WiFi ambient endpoint: %s", path)
                break
        except Exception:
            pass
    if _wifi_endpoint is None:
        log.info("No Sparrow WiFi ambient endpoint found — WiFi ambient scan disabled.")


def _fetch_raw(endpoint: str) -> list[dict]:
    try:
        r = SPARROW_SESSION.get(f"{SPARROW_API_BASE}{endpoint}")
        r.raise_for_status()
        data = r.json()
        # Handle both list and {"devices": [...]} shapes
        if isinstance(data, list):
            return data
        return data.get("devices", data.get("results", []))
    except Exception as exc:
        log.debug("Ambient fetch %s failed: %s", endpoint, exc)
        return []


def _to_ambient_item(device: dict, signal_type: str) -> dict | None:
    mac = device.get("mac") or device.get("mac_address") or device.get("bssid")
    if not mac:
        return None
    return {
        "mac":        mac.upper(),
        "name":       device.get("name") or device.get("ssid") or device.get("hostname") or None,
        "signalType": signal_type,
        "rssiDbm":    device.get("rssi") or device.get("signal") or None,
        "vendor":     device.get("vendor") or device.get("manufacturer") or None,
    }


def maybe_post_ambient() -> None:
    global _last_ambient
    now = time.monotonic()
    if now - _last_ambient < AMBIENT_INTERVAL_S:
        return

    if not _ambient_discovery_done:
        _discover_ambient_endpoints()

    items: list[dict] = []

    if _ble_endpoint:
        for d in _fetch_raw(_ble_endpoint):
            item = _to_ambient_item(d, "BLE")
            if item:
                items.append(item)

    if _wifi_endpoint:
        for d in _fetch_raw(_wifi_endpoint):
            item = _to_ambient_item(d, "WIFI")
            if item:
                items.append(item)

    if not items:
        _last_ambient = now
        return

    try:
        resp = requests.post(AMBIENT_URL, json=items, headers=AUTH_HEADERS, timeout=5)
        if resp.status_code == 200:
            log.debug("Ambient batch: %d devices", len(items))
            _last_ambient = now
        else:
            log.warning("Ambient POST %s: %s", resp.status_code, resp.text[:100])
    except requests.RequestException as exc:
        log.warning("Ambient POST failed: %s", exc)


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main() -> None:
    log.info("SkyGuard <-> Sparrow DroneID bridge starting.")
    log.info("Sparrow API: %s/api/drones  |  SkyGuard: %s", SPARROW_API_BASE, DETECTIONS_URL)
    log.info("Polling every %.1f s  |  Heartbeat every %.0f s", POLL_INTERVAL_S, HEARTBEAT_INTERVAL_S)

    while True:
        maybe_send_heartbeat()
        maybe_post_ambient()

        drones = fetch_drones()
        if drones:
            log.debug("Sparrow reports %d active drone(s).", len(drones))
        process_drones(drones)

        time.sleep(POLL_INTERVAL_S)


if __name__ == "__main__":
    main()
