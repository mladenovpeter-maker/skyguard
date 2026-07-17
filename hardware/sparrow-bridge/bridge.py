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
    """
    Map a Sparrow DroneID /api/drones entry to SkyGuard's IngestDetectionBody.

    Key fields (sparrow-droneid API v1.0.0):
      serial_number, ua_type_name, drone_lat, drone_lon, drone_alt_geo,
      drone_height_agl, speed (m/s), direction, rssi, protocol,
      operator_lat, operator_lon
    """
    lat = _clean(drone.get("drone_lat"))
    lng = _clean(drone.get("drone_lon"))
    if lat is None or lng is None:
        return None

    serial = drone.get("serial_number") or drone.get("mac_address") or "UNKNOWN"
    ua_type = drone.get("ua_type_name") or "Unknown UA"
    protocol = drone.get("protocol") or "RID"
    model = f"{ua_type} [{serial}]"

    speed_ms = drone.get("speed")
    speed_kmh = round(float(speed_ms) * 3.6, 1) if speed_ms else None

    pilot_lat = _clean(drone.get("operator_lat"))
    pilot_lng = _clean(drone.get("operator_lon"))

    return {
        "droneId": serial,
        "model": model,
        "signalType": protocol,
        "lat": float(lat),
        "lng": float(lng),
        "altitudeM": _clean(drone.get("drone_alt_geo") or drone.get("drone_height_agl")),
        "speedKmh": speed_kmh,
        "headingDeg": _clean(drone.get("direction")),
        "rssiDbm": drone.get("rssi"),
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


def process_drones(drones: list[dict]) -> None:
    now = time.monotonic()
    for drone in drones:
        drone_id = drone.get("serial_number") or drone.get("mac_address") or ""
        if not drone_id:
            continue

        last = _last_sent.get(drone_id, 0)
        if now - last < MIN_POST_INTERVAL_S:
            continue

        body = map_drone(drone)
        if body is None:
            log.debug("Skipping %s: no GPS fix", drone_id)
            continue

        _last_sent[drone_id] = now
        post_detection(body)


def main() -> None:
    log.info("SkyGuard <-> Sparrow DroneID bridge starting.")
    log.info("Sparrow API: %s/api/drones  |  SkyGuard: %s", SPARROW_API_BASE, DETECTIONS_URL)
    log.info("Polling every %.1f s.", POLL_INTERVAL_S)

    while True:
        drones = fetch_drones()
        if drones:
            log.debug("Sparrow reports %d active drone(s).", len(drones))
        process_drones(drones)
        time.sleep(POLL_INTERVAL_S)


if __name__ == "__main__":
    main()
