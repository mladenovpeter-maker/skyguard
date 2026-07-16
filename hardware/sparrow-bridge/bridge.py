#!/usr/bin/env python3
"""
SkyGuard OS <-> Sparrow DroneID bridge.

Polls the Sparrow DroneID REST API (BLE + WiFi Remote ID) and forwards each
drone detection to the SkyGuard OS ingestion endpoint (POST /api/detections).

Sparrow DroneID: https://github.com/ghostop14/sparrow-wifi
  - Run on any Linux host with a monitor-mode WiFi adapter and/or BLE dongle.
  - Its REST API listens on http://127.0.0.1:8020 by default.

Configuration (environment variables — see .env.example):
  SPARROW_API_BASE      Sparrow REST base URL. Default: http://127.0.0.1:8020
  SPARROW_POLL_INTERVAL_S  How often to poll. Default: 2
  SKYGUARD_API_BASE     SkyGuard API base URL, e.g. https://your-app.example.com
  SKYGUARD_DEVICE_KEY   Device API key from the SkyGuard Admin panel (sg_...).
  MIN_POST_INTERVAL_S   Minimum seconds between SkyGuard posts for the same
                        drone MAC. Prevents flooding. Default: 2

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

if not API_BASE or not DEVICE_KEY:
    log.error(
        "SKYGUARD_API_BASE and SKYGUARD_DEVICE_KEY must be set.\n"
        "Copy .env.example to .env, fill in the values, and `source .env`."
    )
    sys.exit(1)

DETECTIONS_URL = f"{API_BASE}/api/detections"

# --- per-drone throttle ---
_last_sent: dict[str, float] = {}

SPARROW_SESSION = requests.Session()
SPARROW_SESSION.timeout = 4  # type: ignore[attr-defined]


def _clean(value, zero_is_null: bool = True):
    """Return None for missing / 0.0 sentinel values so we don't post fake coords."""
    if value is None:
        return None
    if zero_is_null and value == 0.0:
        return None
    return value


def _fetch_devices(path: str) -> list[dict]:
    """GET one Sparrow endpoint and return the device list (empty on error)."""
    url = f"{SPARROW_API_BASE}{path}"
    try:
        resp = SPARROW_SESSION.get(url)
        resp.raise_for_status()
        data = resp.json()
        # Sparrow wraps results: {"devices": [...]} or just a list
        if isinstance(data, list):
            return data
        return data.get("devices", [])
    except requests.RequestException as exc:
        log.warning("Sparrow API unreachable at %s: %s", url, exc)
        return []
    except ValueError as exc:
        log.warning("Non-JSON response from Sparrow at %s: %s", url, exc)
        return []


def map_device(device: dict, signal_type: str) -> dict | None:
    """
    Map a Sparrow device record to SkyGuard's IngestDetectionBody.

    Sparrow Remote ID fields (both BLE and WiFi share the same schema):
      macaddr, name/ssid, lat, lon, altitude, speed, heading, rssi,
      pilotlat, pilotlon, vendor, type, lastseen
    """
    lat = _clean(device.get("lat"))
    lng = _clean(device.get("lon"))
    if lat is None or lng is None:
        # No Remote ID position data yet.
        return None

    mac = device.get("macaddr", "").upper()
    if not mac:
        return None

    # Sparrow sometimes also exposes a human-readable name (SSID or BT name).
    name = device.get("name") or device.get("ssid") or None
    model = f"{name} ({mac})" if name else mac

    speed_ms = device.get("speed")
    speed_kmh = round(float(speed_ms) * 3.6, 1) if speed_ms else None

    pilot_lat = _clean(device.get("pilotlat"))
    pilot_lng = _clean(device.get("pilotlon"))

    return {
        "droneId": mac,
        "model": model,
        "signalType": signal_type,
        "lat": lat,
        "lng": lng,
        "altitudeM": _clean(device.get("altitude")),
        "speedKmh": speed_kmh,
        "headingDeg": _clean(device.get("heading")),
        "rssiDbm": device.get("rssi"),
        "pilotLat": pilot_lat,
        "pilotLng": pilot_lng,
    }


def post_detection(body: dict) -> None:
    try:
        resp = requests.post(
            DETECTIONS_URL,
            json=body,
            headers={"Authorization": f"Bearer {DEVICE_KEY}"},
            timeout=5,
        )
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


def process_devices(devices: list[dict], signal_type: str) -> None:
    now = time.monotonic()
    for dev in devices:
        mac = (dev.get("macaddr") or "").upper()
        if not mac:
            continue

        last = _last_sent.get(mac, 0)
        if now - last < MIN_POST_INTERVAL_S:
            continue

        body = map_device(dev, signal_type)
        if body is None:
            log.debug("Skipping %s (%s): no Remote ID position", mac, signal_type)
            continue

        _last_sent[mac] = now
        post_detection(body)


def main() -> None:
    log.info("SkyGuard <-> Sparrow DroneID bridge starting.")
    log.info("Sparrow API: %s  |  SkyGuard: %s", SPARROW_API_BASE, DETECTIONS_URL)
    log.info("Polling every %.1f s (BLE + WiFi endpoints).", POLL_INTERVAL_S)

    while True:
        ble_devices = _fetch_devices("/sparrow/api/v1/bluetooth/devices")
        wifi_devices = _fetch_devices("/sparrow/api/v1/wifi/devices")

        process_devices(ble_devices, "BT_RID")
        process_devices(wifi_devices, "WIFI_RID")

        time.sleep(POLL_INTERVAL_S)


if __name__ == "__main__":
    main()
