#!/usr/bin/env python3
"""
SkyGuard OS — DJI Wi-Fi DroneID Scanner (runs on the Raspberry Pi)

Puts the WiFi USB adapter in monitor mode and captures DJI DroneID
broadcast frames (802.11 vendor-specific IE, OUI 26:37:12 / 60:60:1F).

DJI Mini 2, Mini 3, Mavic 3, Air 2S etc. all use this protocol.

Detected drones are posted to the SkyGuard API as detections.

Requires:
  sudo apt install -y python3-scapy iw
  pip3 install requests

Environment variables:
  SKYGUARD_API_BASE     e.g. http://192.168.100.224:3001
  SKYGUARD_DEVICE_KEY   sg_... key from SkyGuard Admin
  WIFI_IFACE            WiFi interface to use, default: wlan1
  HOP_INTERVAL_S        Channel hop interval, default: 0.3
  DEDUPE_S              Seconds between duplicate posts, default: 5

Run (must be root for monitor mode):
  sudo -E python3 scanner.py

Always-on (systemd):
  sudo cp skyguard-dji-wifi-scanner.service /etc/systemd/system/
  sudo systemctl enable --now skyguard-dji-wifi-scanner.service
"""

import logging
import os
import signal
import struct
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone

import requests

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("skyguard-dji-wifi")

API_BASE     = os.environ.get("SKYGUARD_API_BASE", "").rstrip("/")
DEVICE_KEY   = os.environ.get("SKYGUARD_DEVICE_KEY", "")
WIFI_IFACE   = os.environ.get("WIFI_IFACE", "wlan1")
HOP_INTERVAL = float(os.environ.get("HOP_INTERVAL_S", "0.3"))
DEDUPE_S     = float(os.environ.get("DEDUPE_S", "5"))

if not API_BASE or not DEVICE_KEY:
    log.error("SKYGUARD_API_BASE and SKYGUARD_DEVICE_KEY must be set.")
    sys.exit(1)

DETECTIONS_URL = f"{API_BASE}/api/detections"
AUTH_HEADERS   = {
    "Authorization": f"Bearer {DEVICE_KEY}",
    "Content-Type":  "application/json",
}

# DJI DroneID Wi-Fi OUI values (vendor-specific IE, element ID 221)
DJI_OUIS = {
    bytes([0x26, 0x37, 0x12]),   # DJI DroneID v1/v2 (most common)
    bytes([0x60, 0x60, 0x1F]),   # DJI Aeroscope (some firmware)
    bytes([0x00, 0x26, 0x04]),   # older DJI
}

# 2.4 GHz channels to hop through (prioritise 1, 6, 11; then fill others)
CHANNELS_2G = [1, 6, 11, 2, 3, 4, 5, 7, 8, 9, 10, 12, 13]

MON_IFACE   = f"{WIFI_IFACE}mon"    # monitor interface name
_seen: dict[str, float] = {}        # serial → last post time
_stop = threading.Event()

# ---------------------------------------------------------------------------
# Monitor mode setup / teardown
# ---------------------------------------------------------------------------

def _run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, check=check)


def setup_monitor() -> bool:
    """Create a monitor-mode interface; return True on success."""
    global MON_IFACE
    log.info("Setting up monitor mode on %s → %s", WIFI_IFACE, MON_IFACE)

    # Remove stale monitor iface if present
    _run(["iw", "dev", MON_IFACE, "del"], check=False)

    try:
        # Try iw add (preferred, non-destructive)
        _run(["iw", "dev", WIFI_IFACE, "interface", "add", MON_IFACE, "type", "monitor"])
        _run(["ip", "link", "set", MON_IFACE, "up"])
        log.info("Monitor interface %s up (iw method)", MON_IFACE)
        return True
    except subprocess.CalledProcessError as e:
        log.warning("iw add failed (%s); trying direct monitor mode", e.stderr.strip())

    try:
        # Fallback: put original interface into monitor mode directly
        _run(["ip", "link", "set", WIFI_IFACE, "down"])
        _run(["iw", "dev", WIFI_IFACE, "set", "type", "monitor"])
        _run(["ip", "link", "set", WIFI_IFACE, "up"])
        MON_IFACE = WIFI_IFACE
        log.info("Direct monitor mode on %s", WIFI_IFACE)
        return True
    except subprocess.CalledProcessError as e:
        log.error("Could not enable monitor mode: %s", e.stderr.strip())
        return False


def teardown_monitor() -> None:
    """Remove monitor interface and restore managed mode."""
    log.info("Tearing down monitor interface %s", MON_IFACE)
    try:
        if MON_IFACE != WIFI_IFACE:
            _run(["iw", "dev", MON_IFACE, "del"], check=False)
        else:
            _run(["ip", "link", "set", WIFI_IFACE, "down"], check=False)
            _run(["iw", "dev", WIFI_IFACE, "set", "type", "managed"], check=False)
            _run(["ip", "link", "set", WIFI_IFACE, "up"], check=False)
    except Exception as exc:
        log.warning("Teardown error: %s", exc)


def set_channel(ch: int) -> None:
    subprocess.run(
        ["iw", "dev", MON_IFACE, "set", "channel", str(ch)],
        capture_output=True, check=False,
    )

# ---------------------------------------------------------------------------
# DJI DroneID parser
# ---------------------------------------------------------------------------

def _parse_dji_ie(payload: bytes) -> dict | None:
    """
    Parse DJI vendor-specific IE payload (after the 3-byte OUI).

    DJI DroneID v2 layout (bytes after OUI+type):
      0     : sub-type / version
      1..4  : serial number (4 bytes ASCII or binary)
      ...
    GPS fields (v2, offset relative to IE payload start = after OUI):
      [0]  version nibble
      [1]  serial[0..3] (4 bytes)
      [5]  serial cont.
      GPS lat  : int32 LE at offset 14, unit 1e-7 deg
      GPS lon  : int32 LE at offset 18, unit 1e-7 deg
      altitude : uint16 LE at offset 22, (value - 500) / 10 metres
      height   : uint16 LE at offset 24, value / 10 metres AGL
      home_lat : int32 LE at offset 26, unit 1e-7 deg
      home_lon : int32 LE at offset 30, unit 1e-7 deg
      speed_x  : int16 LE at offset 34, cm/s  → m/s
      speed_y  : int16 LE at offset 36, cm/s
      speed_z  : int16 LE at offset 38, cm/s
      heading  : uint16 LE at offset 40, degrees * 100
      serial   : bytes 1..10 decoded as ASCII
    """
    # Need at least 42 bytes (OUI already stripped by caller)
    if len(payload) < 42:
        return None

    try:
        # Serial: bytes 1–10 (after OUI, skip byte 0 which is subtype)
        serial_raw = payload[1:10]
        serial = serial_raw.rstrip(b"\x00").decode("ascii", errors="replace").strip()
        if not serial:
            serial = serial_raw.hex().upper()

        lat_raw  = struct.unpack_from("<i", payload, 14)[0]
        lon_raw  = struct.unpack_from("<i", payload, 18)[0]
        alt_raw  = struct.unpack_from("<H", payload, 22)[0]
        agl_raw  = struct.unpack_from("<H", payload, 24)[0]
        hlat_raw = struct.unpack_from("<i", payload, 26)[0]
        hlon_raw = struct.unpack_from("<i", payload, 30)[0]
        vx       = struct.unpack_from("<h", payload, 34)[0]
        vy       = struct.unpack_from("<h", payload, 36)[0]
        vz       = struct.unpack_from("<h", payload, 38)[0]
        hdg_raw  = struct.unpack_from("<H", payload, 40)[0]

        lat = lat_raw * 1e-7 if lat_raw != 0 else None
        lon = lon_raw * 1e-7 if lon_raw != 0 else None
        alt = (alt_raw - 500) / 10.0 if alt_raw not in (0, 0xFFFF) else None
        agl = agl_raw / 10.0          if agl_raw not in (0, 0xFFFF) else None
        home_lat = hlat_raw * 1e-7    if hlat_raw != 0 else None
        home_lon = hlon_raw * 1e-7    if hlon_raw != 0 else None
        speed_h  = ((vx ** 2 + vy ** 2) ** 0.5) / 100.0   # m/s
        speed_v  = vz / 100.0
        heading  = hdg_raw / 100.0 if hdg_raw != 0xFFFF else None

        return {
            "serial":   serial,
            "lat":      lat,
            "lng":      lon,
            "altM":     alt,
            "aglM":     agl,
            "homeLat":  home_lat,
            "homeLng":  home_lon,
            "speedMs":  round(speed_h, 2),
            "vSpeedMs": round(speed_v, 2),
            "headingDeg": heading,
        }
    except struct.error:
        return None


def _extract_dji_vendor_ie(packet_bytes: bytes) -> dict | None:
    """
    Walk 802.11 tagged parameters looking for DJI vendor-specific IEs.
    packet_bytes: raw frame bytes starting AFTER the 802.11 fixed header.
    """
    offset = 0
    while offset + 2 <= len(packet_bytes):
        tag_id  = packet_bytes[offset]
        tag_len = packet_bytes[offset + 1]
        if offset + 2 + tag_len > len(packet_bytes):
            break
        tag_data = packet_bytes[offset + 2: offset + 2 + tag_len]

        if tag_id == 221 and len(tag_data) >= 4:   # Vendor-Specific
            oui = tag_data[:3]
            if oui in DJI_OUIS:
                parsed = _parse_dji_ie(tag_data[3:])   # strip OUI before passing
                if parsed:
                    return parsed

        offset += 2 + tag_len
    return None

# ---------------------------------------------------------------------------
# Packet handler
# ---------------------------------------------------------------------------

def _handle_frame(raw_bytes: bytes, rssi: int | None = None) -> None:
    """Process one raw 802.11 frame."""
    if len(raw_bytes) < 24:
        return

    frame_ctrl = raw_bytes[0] | (raw_bytes[1] << 8)
    subtype = (frame_ctrl >> 4) & 0xF
    ftype   = (frame_ctrl >> 2) & 0x3

    # Only management frames (type 0): beacon (subtype 8) or probe-response (5)
    if ftype != 0 or subtype not in (5, 8):
        return

    # Fixed-length management header: 24 bytes
    # After header: variable tagged parameters (for beacon: +12 fixed fields)
    beacon_fixed_offset = 24
    if subtype == 8:
        beacon_fixed_offset += 12   # timestamp(8) + interval(2) + cap(2)

    info = _extract_dji_vendor_ie(raw_bytes[beacon_fixed_offset:])
    if not info:
        return

    serial = info["serial"]
    log.info(
        "✈ DJI DroneID: %s  lat=%.6f  lon=%.6f  alt=%.1fm  spd=%.1fm/s  RSSI=%s",
        serial,
        info.get("lat") or 0,
        info.get("lng") or 0,
        info.get("altM") or 0,
        info.get("speedMs") or 0,
        rssi if rssi is not None else "?",
    )
    _maybe_post(serial, info, rssi)


def _maybe_post(serial: str, info: dict, rssi: int | None) -> None:
    now = time.monotonic()
    if now - _seen.get(serial, 0) < DEDUPE_S:
        return
    _seen[serial] = now

    payload = {
        "droneId":    serial,
        "source":     "WIFI_DJI",
        "lat":        info.get("lat"),
        "lng":        info.get("lng"),
        "altitudeM":  info.get("altM"),
        "speedMs":    info.get("speedMs"),
        "headingDeg": info.get("headingDeg"),
        "rssiDbm":    rssi,
        "rawJson": {
            "homeLat":  info.get("homeLat"),
            "homeLng":  info.get("homeLng"),
            "aglM":     info.get("aglM"),
            "vSpeedMs": info.get("vSpeedMs"),
        },
    }
    try:
        resp = requests.post(DETECTIONS_URL, json=payload, headers=AUTH_HEADERS, timeout=5)
        if resp.status_code in (200, 201):
            log.info("✅ Posted detection: %s", serial)
        else:
            log.warning("API %s: %s", resp.status_code, resp.text[:120])
    except requests.RequestException as exc:
        log.warning("POST failed: %s", exc)

# ---------------------------------------------------------------------------
# Channel hopper (background thread)
# ---------------------------------------------------------------------------

def _channel_hopper() -> None:
    idx = 0
    while not _stop.is_set():
        set_channel(CHANNELS_2G[idx % len(CHANNELS_2G)])
        idx += 1
        time.sleep(HOP_INTERVAL)

# ---------------------------------------------------------------------------
# Scapy sniff loop
# ---------------------------------------------------------------------------

def _run_sniffer() -> None:
    try:
        from scapy.all import sniff, RadioTap, Dot11
    except ImportError:
        log.error("scapy not found — install with: sudo pip3 install scapy")
        sys.exit(1)

    log.info("Sniffing on %s …", MON_IFACE)

    def _pkt_cb(pkt) -> None:
        try:
            rssi = None
            if pkt.haslayer(RadioTap):
                try:
                    rssi = pkt[RadioTap].dBm_AntSignal
                except Exception:
                    pass
            raw = bytes(pkt)
            # Skip RadioTap header to get to 802.11 frame
            if pkt.haslayer(RadioTap):
                rt_len = pkt[RadioTap].len
                raw = raw[rt_len:]
            _handle_frame(raw, rssi)
        except Exception as exc:
            log.debug("Packet error: %s", exc)

    sniff(
        iface=MON_IFACE,
        prn=_pkt_cb,
        store=False,
        stop_filter=lambda _: _stop.is_set(),
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def _on_signal(sig, _frame) -> None:
    log.info("Signal %s received — stopping.", sig)
    _stop.set()


def main() -> None:
    signal.signal(signal.SIGTERM, _on_signal)
    signal.signal(signal.SIGINT,  _on_signal)

    if os.geteuid() != 0:
        log.error("Must run as root (sudo) for monitor mode.")
        sys.exit(1)

    if not setup_monitor():
        sys.exit(1)

    try:
        log.info("SkyGuard DJI Wi-Fi Scanner ready.")
        log.info("API: %s | Iface: %s | Hop: %.1fs", DETECTIONS_URL, MON_IFACE, HOP_INTERVAL)

        hopper = threading.Thread(target=_channel_hopper, daemon=True)
        hopper.start()

        _run_sniffer()
    finally:
        teardown_monitor()
        log.info("Scanner stopped.")


if __name__ == "__main__":
    main()
