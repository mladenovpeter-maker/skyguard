#!/usr/bin/env python3
"""
SkyGuard OS — nRF52840 BLE Sniffer Bridge

Запуска nrfutil ble-sniffer на nRF52840 донгъла, следи pcap файла в реално
време, извлича Open Drone ID (ASTM F3411) пакети от BLE рекламите и ги праща
към SkyGuard API като детекции.

Поддържа Coded PHY (BLE 5, Remote ID стандарт) и стандартен 1 Mbit PHY.

Environment variables:
  SKYGUARD_API_BASE        e.g. https://your-domain/api
  SKYGUARD_DEVICE_KEY      sg_... ключ от SkyGuard Admin
  BLE_PORT                 Serial порт на донгъла, default: /dev/ttyACM0
  NRFUTIL_PATH             Път до nrfutil binary, default: ~/nrfutil7
  CODED_PHY                true/false, default: true
  DEDUPE_S                 Мин. секунди между посты на един дрон, default: 5
  HEARTBEAT_INTERVAL_S     Секунди между heartbeat посты, default: 30
  LOG_LEVEL                DEBUG/INFO/WARNING, default: INFO

Run:
  source .env && python3 bridge.py

Always-on (systemd):
  sudo cp skyguard-nrf-sniffer.service /etc/systemd/system/
  sudo systemctl enable --now skyguard-nrf-sniffer.service
"""

import os
import sys
import struct
import time
import subprocess
import signal
import logging
from datetime import datetime, timezone
from pathlib import Path

import requests

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("skyguard-nrf-sniffer")

# ── Config ────────────────────────────────────────────────────────────────────

API_BASE    = os.environ.get("SKYGUARD_API_BASE", "").rstrip("/")
DEVICE_KEY  = os.environ.get("SKYGUARD_DEVICE_KEY", "")
NRFUTIL     = os.path.expanduser(os.environ.get("NRFUTIL_PATH", "~/nrfutil7"))
BLE_PORT    = os.environ.get("BLE_PORT", "/dev/ttyACM0")
CODED_PHY   = os.environ.get("CODED_PHY", "true").lower() != "false"
DEDUPE_S    = float(os.environ.get("DEDUPE_S", "5"))
HEARTBEAT_S = float(os.environ.get("HEARTBEAT_INTERVAL_S", "30"))
PCAP_PATH   = "/tmp/skyguard-sniffer.pcap"

if not API_BASE or not DEVICE_KEY:
    log.error("SKYGUARD_API_BASE and SKYGUARD_DEVICE_KEY must be set.")
    sys.exit(1)

DETECTIONS_URL = f"{API_BASE}/api/detections"
BLE_STATUS_URL = f"{API_BASE}/api/ble-status"
AUTH_HEADERS = {
    "Authorization": f"Bearer {DEVICE_KEY}",
    "Content-Type": "application/json",
}

# ── Open Drone ID parser ──────────────────────────────────────────────────────

# BLE Service Data AD type + ODID UUID (0xFFFA in little-endian)
ODID_AD_PREFIX = bytes([0x16, 0xFA, 0xFF])

MSG_BASIC_ID = 0x0
MSG_LOCATION = 0x1


def _parse_basic_id(data: bytes) -> dict:
    """Parse ODID Basic ID message (25 bytes, type 0x0)."""
    if len(data) < 22:
        return {}
    drone_id = data[2:22].rstrip(b"\x00").decode("ascii", errors="replace").strip()
    return {
        "droneId": drone_id or None,
        "uaType":  data[1] & 0xF,
    }


def _parse_location(data: bytes) -> dict:
    """Parse ODID Location/Vector message (25 bytes, type 0x1)."""
    if len(data) < 24:
        return {}
    speed_raw = struct.unpack_from("<H", data, 3)[0]
    lat_raw   = struct.unpack_from("<i", data, 7)[0]
    lon_raw   = struct.unpack_from("<i", data, 11)[0]
    alt_raw   = struct.unpack_from("<H", data, 17)[0]
    return {
        "lat":        lat_raw * 1e-7  if lat_raw              else None,
        "lng":        lon_raw * 1e-7  if lon_raw              else None,
        "altitudeM":  alt_raw * 0.5 - 1000 if alt_raw != 0xFFFF else None,
        "speedMs":    speed_raw * 0.01     if speed_raw != 0xFFFF else None,
        "headingDeg": data[2],
    }


def _parse_odid(payload: bytes) -> dict:
    """
    Parse ODID service data blob (after the 2-byte UUID).
    Handles individual messages and message packs (type 0xF).
    """
    result: dict = {}
    offset = 0
    while offset < len(payload):
        if offset + 1 > len(payload):
            break
        msg_type = (payload[offset] >> 4) & 0xF
        chunk = payload[offset: offset + 25]

        if msg_type == 0xF:          # message pack
            count = payload[offset + 1] if offset + 1 < len(payload) else 0
            inner = offset + 2
            for _ in range(count):
                if inner + 25 > len(payload):
                    break
                c = payload[inner: inner + 25]
                t = (c[0] >> 4) & 0xF
                if t == MSG_BASIC_ID:
                    result.update(_parse_basic_id(c))
                elif t == MSG_LOCATION:
                    result.update(_parse_location(c))
                inner += 25
            break

        if msg_type == MSG_BASIC_ID:
            result.update(_parse_basic_id(chunk))
        elif msg_type == MSG_LOCATION:
            result.update(_parse_location(chunk))

        offset += 25

    return result


# ── PCAP stream follower ──────────────────────────────────────────────────────

PCAP_GLOBAL_HEADER_LEN = 24
PCAP_RECORD_HEADER_LEN = 16


def _read_exactly(f, n: int) -> bytes | None:
    """Read exactly n bytes from file f, returning None on EOF."""
    buf = b""
    while len(buf) < n:
        chunk = f.read(n - len(buf))
        if not chunk:
            return None
        buf += chunk
    return buf


def _follow_pcap(path: str):
    """
    Generator: yields raw packet bytes from a growing pcap file.
    Blocks briefly when no new data is available (tail-like behaviour).
    """
    # Wait for file to appear
    waited = 0
    while not os.path.exists(path):
        time.sleep(0.2)
        waited += 1
        if waited > 50:   # 10 s
            log.error("Timed out waiting for pcap file at %s", path)
            return

    with open(path, "rb") as f:
        # Parse global header to determine endianness
        hdr = _read_exactly(f, PCAP_GLOBAL_HEADER_LEN)
        if hdr is None:
            log.error("Empty pcap file.")
            return
        magic = struct.unpack_from("<I", hdr, 0)[0]
        endian = ">" if magic == 0xD4C3B2A1 else "<"
        log.debug("PCAP opened, endian=%s", endian)

        empty_reads = 0
        while True:
            rec = f.read(PCAP_RECORD_HEADER_LEN)
            if not rec or len(rec) < PCAP_RECORD_HEADER_LEN:
                time.sleep(0.02)
                empty_reads += 1
                if empty_reads > 500:   # 10 s с no data
                    log.debug("No new packets for 10 s, still waiting...")
                    empty_reads = 0
                continue
            empty_reads = 0
            incl_len = struct.unpack_from(f"{endian}I", rec, 8)[0]
            if incl_len == 0 or incl_len > 65535:
                continue
            pkt = _read_exactly(f, incl_len)
            if pkt is None:
                time.sleep(0.02)
                continue
            yield pkt


# ── ODID extraction from raw BLE packet ──────────────────────────────────────

def _extract_odid(pkt: bytes) -> bytes | None:
    """
    Scan raw pcap packet bytes for the ODID Service Data AD entry.
    Pattern: 0x16 (Service Data type) + 0xFA 0xFF (UUID 0xFFFA, LE).
    Returns the ODID payload bytes (after the 3-byte prefix) or None.
    """
    pos = pkt.find(ODID_AD_PREFIX)
    if pos == -1:
        return None
    # AD entry: [length][type=0x16][uuid_lo=0xFA][uuid_hi=0xFF][data...]
    # pos points to the 0x16 byte; data starts at pos+3
    data_start = pos + 3
    # Try to read length from the byte before 0x16 (the AD length byte)
    ad_len = pkt[pos - 1] if pos > 0 else 0
    data_len = ad_len - 3 if ad_len > 3 else len(pkt) - data_start
    data_len = max(data_len, 25)   # at least one ODID message
    return pkt[data_start: data_start + data_len]


# ── State & API posting ───────────────────────────────────────────────────────

_seen:            dict[str, float] = {}
_total_packets:   int = 0
_total_drones:    int = 0
_last_heartbeat:  float = 0.0


def _should_post(drone_id: str) -> bool:
    now = time.monotonic()
    if now - _seen.get(drone_id, 0) > DEDUPE_S:
        _seen[drone_id] = now
        return True
    return False


def _post_detection(payload: dict) -> None:
    try:
        resp = requests.post(DETECTIONS_URL, json=payload,
                             headers=AUTH_HEADERS, timeout=5)
        if resp.status_code not in (200, 201):
            log.warning("API %s: %s", resp.status_code, resp.text[:120])
    except requests.RequestException as exc:
        log.warning("POST failed: %s", exc)


def _maybe_heartbeat() -> None:
    global _last_heartbeat
    now = time.monotonic()
    if now - _last_heartbeat < HEARTBEAT_S:
        return
    _last_heartbeat = now
    try:
        requests.post(BLE_STATUS_URL, json={
            "totalScans":     _total_packets,
            "dronesDetected": _total_drones,
            "adapter":        BLE_PORT,
            "ts":             datetime.now(timezone.utc).isoformat(),
        }, headers=AUTH_HEADERS, timeout=5)
        log.debug("Heartbeat sent (packets=%d, drones=%d)",
                  _total_packets, _total_drones)
    except Exception:
        pass


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    global _total_packets, _total_drones

    # Remove stale pcap from a previous run
    Path(PCAP_PATH).unlink(missing_ok=True)

    cmd = [
        NRFUTIL, "ble-sniffer", "sniff",
        "--port", BLE_PORT,
        "--only-advertising",
        "--output-pcap-file", PCAP_PATH,
    ]
    if CODED_PHY:
        cmd.append("--coded")

    log.info("Starting nRF52840 sniffer  port=%s  coded=%s", BLE_PORT, CODED_PHY)
    log.info("API → %s", DETECTIONS_URL)

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    def _shutdown(sig, _frame):
        log.info("Shutdown signal received.")
        proc.terminate()
        Path(PCAP_PATH).unlink(missing_ok=True)
        sys.exit(0)

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    log.info("Listening for Remote ID packets…")

    try:
        for pkt in _follow_pcap(PCAP_PATH):
            _total_packets += 1
            _maybe_heartbeat()

            odid_raw = _extract_odid(pkt)
            if odid_raw is None:
                continue

            parsed = _parse_odid(odid_raw)
            if not parsed:
                continue

            lat = parsed.get("lat")
            lng = parsed.get("lng")
            if lat is None or lng is None:
                log.debug("ODID packet without GPS fix — skipping.")
                continue

            drone_id = parsed.get("droneId") or f"ODID-{_total_drones + 1:04d}"

            if not _should_post(drone_id):
                continue

            speed_ms = parsed.get("speedMs")
            detection = {
                "droneId":    drone_id,
                "signalType": "BLE_REMOTEID",
                "lat":        lat,
                "lng":        lng,
                "altitudeM":  parsed.get("altitudeM"),
                "speedKmh":   round(speed_ms * 3.6, 1) if speed_ms is not None else None,
                "headingDeg": parsed.get("headingDeg"),
            }

            log.info(
                "🚁 Remote ID  id=%s  lat=%.6f  lng=%.6f  alt=%s m",
                drone_id, lat, lng, parsed.get("altitudeM"),
            )
            _post_detection(detection)
            _total_drones += 1

    finally:
        proc.terminate()
        Path(PCAP_PATH).unlink(missing_ok=True)


if __name__ == "__main__":
    main()
