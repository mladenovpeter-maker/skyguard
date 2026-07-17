#!/usr/bin/env python3
"""
SkyGuard OS — DroneID BLE Scanner (runs on the Raspberry Pi)

Uses the nRF52840 USB dongle (via BlueZ hci1) to passively scan for
ASTM F3411 / Open Drone ID Bluetooth advertisements.

Detected drones are posted to the SkyGuard API as detections.

Requires:
  pip3 install bleak requests

Hardware:
  nRF52840 USB Dongle flashed with Zephyr hci_usb firmware → appears as hci1

Environment variables (.env):
  SKYGUARD_API_BASE     e.g. http://192.168.100.224:3001
  SKYGUARD_DEVICE_KEY   sg_... key from SkyGuard Admin
  BLE_ADAPTER           HCI adapter name, default: hci1
  SCAN_TIMEOUT_S        Scan window in seconds, default: 5
  CYCLE_INTERVAL_S      Pause between cycles, default: 2

Run:
  source .env && python3 scanner.py

Always-on (systemd):
  sudo cp skyguard-droneID-scanner.service /etc/systemd/system/
  sudo systemctl enable --now skyguard-droneID-scanner.service
"""

import asyncio
import logging
import os
import struct
import sys
import time
from datetime import datetime, timezone

import requests
from bleak import BleakScanner
from bleak.backends.scanner import AdvertisementData
from bleak.backends.device import BLEDevice

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("skyguard-droneID")

API_BASE         = os.environ.get("SKYGUARD_API_BASE", "").rstrip("/")
DEVICE_KEY       = os.environ.get("SKYGUARD_DEVICE_KEY", "")
BLE_ADAPTER      = os.environ.get("BLE_ADAPTER", "hci1")
SCAN_TIMEOUT_S   = float(os.environ.get("SCAN_TIMEOUT_S", "5"))
CYCLE_INTERVAL_S = float(os.environ.get("CYCLE_INTERVAL_S", "2"))

if not API_BASE or not DEVICE_KEY:
    log.error("SKYGUARD_API_BASE and SKYGUARD_DEVICE_KEY must be set.")
    sys.exit(1)

DETECTIONS_URL = f"{API_BASE}/api/detections"
AUTH_HEADERS = {
    "Authorization": f"Bearer {DEVICE_KEY}",
    "Content-Type": "application/json",
}

# ASTM F3411 / Open Drone ID BLE Service UUID
ODID_UUID = "0000fffa-0000-1000-8000-00805f9b34fb"

# Message type nibble (upper 4 bits of byte 0)
MSG_BASIC_ID  = 0x0
MSG_LOCATION  = 0x1
MSG_AUTH      = 0x2
MSG_SELF_ID   = 0x3
MSG_SYSTEM    = 0x4
MSG_OPERATOR  = 0x5

# ------------------------------------------------------------------ #
# Open Drone ID packet parser
# ------------------------------------------------------------------ #

def _parse_basic_id(data: bytes) -> dict:
    """Parse Basic ID message (message type 0x0)."""
    if len(data) < 22:
        return {}
    id_type = (data[1] >> 4) & 0xF
    ua_type = data[1] & 0xF
    drone_id = data[2:22].rstrip(b"\x00").decode("ascii", errors="replace").strip()
    return {
        "droneId": drone_id if drone_id else None,
        "idType": id_type,   # 0=None,1=Serial,2=CAA,3=UTM,4=Specific
        "uaType": ua_type,   # 0=None,1=Aeroplane,2=Heli,3=Gyro,...
    }


def _parse_location(data: bytes) -> dict:
    """Parse Location/Vector message (message type 0x1)."""
    if len(data) < 24:
        return {}
    status = (data[1] >> 4) & 0xF
    direction = data[2]
    speed_raw = struct.unpack_from("<H", data, 3)[0]
    speed_ms = speed_raw * 0.01 if speed_raw != 0xFFFF else None
    vert_speed_raw = struct.unpack_from("<h", data, 5)[0]
    vert_speed_ms = vert_speed_raw * 0.5 if vert_speed_raw != -32768 else None
    lat_raw = struct.unpack_from("<i", data, 7)[0]
    lon_raw = struct.unpack_from("<i", data, 11)[0]
    lat = lat_raw * 1e-7 if lat_raw != 0 else None
    lon = lon_raw * 1e-7 if lon_raw != 0 else None
    alt_pres_raw = struct.unpack_from("<H", data, 15)[0]
    alt_geo_raw  = struct.unpack_from("<H", data, 17)[0]
    alt_m = (alt_geo_raw * 0.5 - 1000) if alt_geo_raw != 0xFFFF else None
    return {
        "lat": lat,
        "lng": lon,
        "altitudeM": alt_m,
        "speedMs": speed_ms,
        "vertSpeedMs": vert_speed_ms,
        "headingDeg": direction,
        "status": status,
    }


def _parse_odid_packet(service_data: bytes) -> dict:
    """Parse a full Open Drone ID service data blob (may be a message pack)."""
    result: dict = {}
    offset = 0

    # A message pack starts with type 0xF; individual message has type 0x0–0x5
    while offset < len(service_data):
        if offset + 1 > len(service_data):
            break
        msg_type = (service_data[offset] >> 4) & 0xF
        # Each ODID message is 25 bytes
        chunk = service_data[offset: offset + 25]

        if msg_type == MSG_BASIC_ID:
            result.update(_parse_basic_id(chunk))
        elif msg_type == MSG_LOCATION:
            result.update(_parse_location(chunk))

        # Message pack: first byte = 0xF, next byte = count, each message 25 bytes
        if msg_type == 0xF:
            count = service_data[offset + 1] if offset + 1 < len(service_data) else 0
            inner_offset = offset + 2
            for _ in range(count):
                if inner_offset + 25 > len(service_data):
                    break
                inner_chunk = service_data[inner_offset: inner_offset + 25]
                inner_type = (inner_chunk[0] >> 4) & 0xF
                if inner_type == MSG_BASIC_ID:
                    result.update(_parse_basic_id(inner_chunk))
                elif inner_type == MSG_LOCATION:
                    result.update(_parse_location(inner_chunk))
                inner_offset += 25
            break

        offset += 25

    return result


# ------------------------------------------------------------------ #
# Active drones cache (avoid duplicate POSTs within 10s window)
# ------------------------------------------------------------------ #

_seen: dict[str, float] = {}   # mac → last_post_time
DEDUPE_S = 10.0


def _should_post(mac: str) -> bool:
    now = time.monotonic()
    last = _seen.get(mac, 0)
    if now - last > DEDUPE_S:
        _seen[mac] = now
        return True
    return False


# ------------------------------------------------------------------ #
# BLE scan callback
# ------------------------------------------------------------------ #

detected: dict[str, dict] = {}   # mac → parsed data


def _on_device(device: BLEDevice, adv: AdvertisementData) -> None:
    """Called for every BLE advertisement received."""
    # Only care about Open Drone ID service data
    raw = None
    for uuid, data in (adv.service_data or {}).items():
        if uuid.lower() == ODID_UUID:
            raw = data
            break

    if raw is None:
        return

    parsed = _parse_odid_packet(raw)
    mac = device.address.upper()
    rssi = adv.rssi

    entry = {
        "mac": mac,
        "rssi": rssi,
        "droneId": parsed.get("droneId") or f"DRONE-{mac.replace(':','')[-6:]}",
        "lat": parsed.get("lat"),
        "lng": parsed.get("lng"),
        "altitudeM": parsed.get("altitudeM"),
        "speedMs": parsed.get("speedMs"),
        "headingDeg": parsed.get("headingDeg"),
        "uaType": parsed.get("uaType"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    detected[mac] = entry
    log.info(
        "🚁 DroneID: %s  lat=%.6f  lng=%.6f  alt=%.1fm  RSSI=%d",
        entry["droneId"],
        parsed.get("lat") or 0,
        parsed.get("lng") or 0,
        parsed.get("altitudeM") or 0,
        rssi,
    )


# ------------------------------------------------------------------ #
# API posting
# ------------------------------------------------------------------ #

def _post_detection(entry: dict) -> None:
    """POST a detected drone to /api/detections."""
    payload = {
        "droneId": entry["droneId"],
        "source": "BLE_DRONERID",
        "lat": entry["lat"],
        "lng": entry["lng"],
        "altitudeM": entry.get("altitudeM"),
        "speedMs": entry.get("speedMs"),
        "headingDeg": entry.get("headingDeg"),
        "rssiDbm": entry.get("rssi"),
        "rawJson": entry,
    }
    try:
        resp = requests.post(DETECTIONS_URL, json=payload, headers=AUTH_HEADERS, timeout=5)
        if resp.status_code not in (200, 201):
            log.warning("API %s: %s", resp.status_code, resp.text[:120])
    except requests.RequestException as exc:
        log.warning("POST failed: %s", exc)


# ------------------------------------------------------------------ #
# Main loop
# ------------------------------------------------------------------ #

async def scan_cycle() -> None:
    """Run one BLE scan window."""
    global detected
    detected = {}

    scanner = BleakScanner(
        detection_callback=_on_device,
        scanning_mode="active",
        adapter=BLE_ADAPTER,
    )

    async with scanner:
        await asyncio.sleep(SCAN_TIMEOUT_S)

    for mac, entry in detected.items():
        if entry.get("lat") and entry.get("lng") and _should_post(mac):
            _post_detection(entry)

    if detected:
        log.info("Cycle complete — %d DroneID device(s) seen", len(detected))


async def main() -> None:
    log.info("SkyGuard DroneID Scanner starting.")
    log.info("Adapter: %s | Scan window: %.0fs | Cycle: %.0fs", BLE_ADAPTER, SCAN_TIMEOUT_S, CYCLE_INTERVAL_S)
    log.info("API: %s", DETECTIONS_URL)

    while True:
        try:
            await scan_cycle()
        except Exception as exc:
            log.error("Scan cycle failed: %s", exc)
        await asyncio.sleep(CYCLE_INTERVAL_S)


if __name__ == "__main__":
    asyncio.run(main())
