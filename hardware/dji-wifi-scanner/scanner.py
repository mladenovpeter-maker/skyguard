#!/usr/bin/env python3
"""
SkyGuard OS — Wi-Fi Passive Intelligence Scanner v2

Monitor mode scanner with three detection layers:

  Layer 1 — DJI DroneID frames (beacon / probe-response with vendor IE)
             → POST /api/detections  (full GPS telemetry when available)

  Layer 2 — DJI MAC OUI frames (any management frame from known DJI hardware)
             → POST /api/rf-alerts   (drone or RC controller in range, no GPS)

  Layer 3 — Probe requests from unknown devices
             → POST /api/ambient     (potential drone operator fingerprinting)

CPU fix: BPF filter "type mgt" cuts Python-side packet processing by ~90%
         because only management frames reach Python, not data/control.
Channel hop interval raised to 1.5s (operators don't vanish in 0.3s).

Environment variables:
  SKYGUARD_API_BASE     e.g. http://192.168.100.224:3001
  SKYGUARD_DEVICE_KEY   sg_... key from SkyGuard Admin
  WIFI_IFACE            default: wlan1
  HOP_INTERVAL_S        default: 1.5
  DEDUPE_S              seconds between duplicate posts, default: 10
  UNKNOWN_DEDUPE_S      seconds between duplicate unknown-probe posts, default: 30
"""

import logging
import os
import signal
import struct
import subprocess
import sys
import threading
import time

import requests

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("skyguard-wifi")

API_BASE         = os.environ.get("SKYGUARD_API_BASE", "").rstrip("/")
DEVICE_KEY       = os.environ.get("SKYGUARD_DEVICE_KEY", "")
WIFI_IFACE       = os.environ.get("WIFI_IFACE", "wlan1")
HOP_INTERVAL     = float(os.environ.get("HOP_INTERVAL_S", "1.5"))
DEDUPE_S         = float(os.environ.get("DEDUPE_S", "10"))
UNKNOWN_DEDUPE_S = float(os.environ.get("UNKNOWN_DEDUPE_S", "30"))

if not API_BASE or not DEVICE_KEY:
    log.error("SKYGUARD_API_BASE and SKYGUARD_DEVICE_KEY must be set.")
    sys.exit(1)

DETECTIONS_URL = f"{API_BASE}/api/detections"
AMBIENT_URL    = f"{API_BASE}/api/ambient"
RF_ALERTS_URL  = f"{API_BASE}/api/rf-alerts"

AUTH_HEADERS = {
    "Authorization": f"Bearer {DEVICE_KEY}",
    "Content-Type":  "application/json",
}

# ---------------------------------------------------------------------------
# DJI identification tables
# ---------------------------------------------------------------------------

# OUIs found in 802.11 vendor-specific Information Elements (IE 221)
# These identify DJI DroneID broadcast frames
DJI_IE_OUIS = {
    bytes([0x26, 0x37, 0x12]),   # DJI DroneID v1/v2 — most common
    bytes([0x60, 0x60, 0x1F]),   # DJI AeroScope / some firmware
    bytes([0x00, 0x26, 0x04]),   # older DJI models
}

# OUIs assigned to DJI hardware MAC addresses (NIC/source MAC)
# These cover RC controllers, drones in Wi-Fi mode, and companion devices
DJI_MAC_OUIS = {
    bytes([0x60, 0x60, 0x1F]),   # DJI Technology Co., Ltd
    bytes([0x18, 0x49, 0x25]),   # DJI
    bytes([0x48, 0x1C, 0xB9]),   # DJI RC controller
    bytes([0x34, 0xD2, 0x62]),   # DJI
    bytes([0x0C, 0xAE, 0x7D]),   # DJI
    bytes([0x90, 0x3A, 0xE6]),   # DJI
    bytes([0x00, 0x0A, 0x14]),   # DJI (older)
}

# Channels to hop — prioritise 1/6/11 (standard non-overlapping), then the rest
CHANNELS_2G = [1, 6, 11, 2, 3, 4, 5, 7, 8, 9, 10, 12, 13]

MON_IFACE = f"{WIFI_IFACE}mon"
_stop     = threading.Event()

# Deduplication caches  { key → last_post_monotonic }
_seen_droneid : dict[str, float] = {}
_seen_dji_mac : dict[str, float] = {}
_seen_probes  : dict[str, float] = {}

# ---------------------------------------------------------------------------
# Monitor mode setup / teardown
# ---------------------------------------------------------------------------

def _run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, check=check)


def setup_monitor() -> bool:
    global MON_IFACE
    log.info("Setting up monitor mode: %s → %s", WIFI_IFACE, MON_IFACE)
    _run(["iw", "dev", MON_IFACE, "del"], check=False)

    try:
        _run(["iw", "dev", WIFI_IFACE, "interface", "add", MON_IFACE, "type", "monitor"])
        _run(["ip", "link", "set", MON_IFACE, "up"])
        log.info("Monitor interface %s ready (virtual iw method)", MON_IFACE)
        return True
    except subprocess.CalledProcessError as e:
        log.warning("iw add failed (%s) — trying direct mode", e.stderr.strip())

    try:
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
    log.info("Restoring %s to managed mode", MON_IFACE)
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
# DJI DroneID IE parser (Layer 1)
# ---------------------------------------------------------------------------

def _parse_dji_ie(payload: bytes) -> dict | None:
    """Parse DJI vendor-specific IE payload (OUI already stripped)."""
    if len(payload) < 42:
        return None
    try:
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

        return {
            "serial":     serial,
            "lat":        lat_raw * 1e-7  if lat_raw  != 0          else None,
            "lng":        lon_raw * 1e-7  if lon_raw  != 0          else None,
            "altM":       (alt_raw - 500) / 10.0 if alt_raw not in (0, 0xFFFF) else None,
            "aglM":       agl_raw / 10.0          if agl_raw not in (0, 0xFFFF) else None,
            "homeLat":    hlat_raw * 1e-7 if hlat_raw != 0          else None,
            "homeLng":    hlon_raw * 1e-7 if hlon_raw != 0          else None,
            "speedMs":    round(((vx**2 + vy**2) ** 0.5) / 100.0, 2),
            "vSpeedMs":   round(vz / 100.0, 2),
            "headingDeg": hdg_raw / 100.0 if hdg_raw != 0xFFFF      else None,
        }
    except struct.error:
        return None


def _find_dji_ie(tagged_params: bytes) -> dict | None:
    """Walk 802.11 tagged parameters, return parsed DJI IE or None."""
    offset = 0
    while offset + 2 <= len(tagged_params):
        tag_id  = tagged_params[offset]
        tag_len = tagged_params[offset + 1]
        if offset + 2 + tag_len > len(tagged_params):
            break
        tag_data = tagged_params[offset + 2: offset + 2 + tag_len]

        if tag_id == 221 and len(tag_data) >= 4 and tag_data[:3] in DJI_IE_OUIS:
            parsed = _parse_dji_ie(tag_data[3:])
            if parsed:
                return parsed

        offset += 2 + tag_len
    return None

# ---------------------------------------------------------------------------
# MAC helpers
# ---------------------------------------------------------------------------

def _mac_bytes(raw: bytes, offset: int) -> bytes:
    """Extract 6 MAC bytes at offset."""
    return raw[offset: offset + 6]


def _mac_str(raw: bytes, offset: int) -> str:
    return ":".join(f"{b:02x}" for b in raw[offset: offset + 6])


def _is_dji_mac(mac6: bytes) -> bool:
    return mac6[:3] in DJI_MAC_OUIS


def _is_multicast(mac6: bytes) -> bool:
    """Broadcast/multicast MACs are not real devices."""
    return bool(mac6[0] & 0x01)


def _is_locally_administered(mac6: bytes) -> bool:
    """Randomised MACs — less useful for tracking."""
    return bool(mac6[0] & 0x02)

# ---------------------------------------------------------------------------
# Frame handler
# ---------------------------------------------------------------------------

# 802.11 management subtypes we care about
#   0 = Association Request  (device → AP: operator connecting to drone hotspot)
#   4 = Probe Request        (device actively searching for networks)
#   5 = Probe Response       (AP/drone answering a probe)
#   8 = Beacon               (AP/drone advertising itself)

def _handle_frame(raw_bytes: bytes, rssi: int | None) -> None:
    if len(raw_bytes) < 24:
        return

    frame_ctrl = raw_bytes[0] | (raw_bytes[1] << 8)
    ftype   = (frame_ctrl >> 2) & 0x3
    subtype = (frame_ctrl >> 4) & 0xF

    # Only management frames (ftype == 0)
    if ftype != 0:
        return

    # 802.11 management header address fields:
    #   [4:10]  = addr1 (destination / BSSID in beacon)
    #   [10:16] = addr2 = source / transmitter
    #   [16:22] = addr3 = BSSID (in probe-req) or destination
    src_mac6 = _mac_bytes(raw_bytes, 10)
    src_str  = _mac_str(raw_bytes, 10)

    # ----- LAYER 1: DJI DroneID in beacon or probe-response -----
    if subtype in (5, 8):
        tagged_offset = 24 + (12 if subtype == 8 else 0)
        dji = _find_dji_ie(raw_bytes[tagged_offset:])
        if dji:
            _handle_droneid(dji, src_str, rssi)
            return   # Full DroneID hit — no need to process further layers

    # ----- LAYER 2: DJI MAC in any management frame -----
    if not _is_multicast(src_mac6) and _is_dji_mac(src_mac6):
        _handle_dji_mac(src_str, subtype, rssi)
        return

    # ----- LAYER 3: Probe requests from unknown / interesting devices -----
    if subtype == 4 and not _is_multicast(src_mac6):
        # Extract SSID from probe request (tag 0)
        ssid = _extract_ssid(raw_bytes[24:])
        _handle_probe(src_str, ssid, rssi, src_mac6)

# ---------------------------------------------------------------------------
# Layer handlers
# ---------------------------------------------------------------------------

def _handle_droneid(info: dict, mac: str, rssi: int | None) -> None:
    serial = info["serial"]
    now = time.monotonic()
    if now - _seen_droneid.get(serial, 0) < DEDUPE_S:
        return
    _seen_droneid[serial] = now

    log.info(
        "✈  DroneID | %s | lat=%.5f lon=%.5f alt=%.0fm spd=%.1fm/s RSSI=%s",
        serial,
        info.get("lat") or 0, info.get("lng") or 0,
        info.get("altM") or 0, info.get("speedMs") or 0,
        rssi if rssi is not None else "?",
    )
    _post(DETECTIONS_URL, {
        "droneId":    serial,
        "source":     "WIFI_DJI",
        "lat":        info.get("lat"),
        "lng":        info.get("lng"),
        "altitudeM":  info.get("altM"),
        "speedMs":    info.get("speedMs"),
        "headingDeg": info.get("headingDeg"),
        "rssiDbm":    rssi,
        "rawJson": {
            "mac":      mac,
            "homeLat":  info.get("homeLat"),
            "homeLng":  info.get("homeLng"),
            "aglM":     info.get("aglM"),
            "vSpeedMs": info.get("vSpeedMs"),
        },
    })


def _handle_dji_mac(mac: str, subtype: int, rssi: int | None) -> None:
    now = time.monotonic()
    if now - _seen_dji_mac.get(mac, 0) < DEDUPE_S:
        return
    _seen_dji_mac[mac] = now

    subtype_names = {0: "assoc-req", 4: "probe-req", 5: "probe-resp", 8: "beacon"}
    frame_name = subtype_names.get(subtype, f"subtype-{subtype}")

    log.info("🔵 DJI MAC  | %s | frame=%s | RSSI=%s", mac, frame_name, rssi if rssi is not None else "?")
    _post(RF_ALERTS_URL, {
        "freqMhz":   2437,           # centre of 2.4GHz — exact channel unknown
        "powerDbm":  rssi,
        "label":     "DJI_DEVICE",
        "note":      f"DJI hardware MAC detected via 802.11 {frame_name}",
        "rawJson":   {"mac": mac, "frameSubtype": frame_name},
    })


def _handle_probe(mac: str, ssid: str | None, rssi: int | None, mac6: bytes) -> None:
    now = time.monotonic()
    if now - _seen_probes.get(mac, 0) < UNKNOWN_DEDUPE_S:
        return
    _seen_probes[mac] = now

    randomised = _is_locally_administered(mac6)
    label = "PROBE_RANDOM" if randomised else "PROBE_DEVICE"

    # Only log non-randomised MACs (randomised are too noisy — every phone does it)
    if not randomised:
        log.info(
            "📡 Probe    | %s | ssid=%r | RSSI=%s",
            mac, ssid or "(wildcard)", rssi if rssi is not None else "?"
        )

    _post(AMBIENT_URL, {
        "mac":     mac,
        "type":    label,
        "rssiDbm": rssi,
        "rawJson": {
            "ssid":       ssid,
            "randomised": randomised,
        },
    })

# ---------------------------------------------------------------------------
# SSID extractor
# ---------------------------------------------------------------------------

def _extract_ssid(tagged_params: bytes) -> str | None:
    """Return SSID string from tag 0, or None for wildcard probes."""
    if len(tagged_params) < 2:
        return None
    tag_id  = tagged_params[0]
    tag_len = tagged_params[1]
    if tag_id == 0 and tag_len > 0 and 2 + tag_len <= len(tagged_params):
        try:
            return tagged_params[2: 2 + tag_len].decode("utf-8", errors="replace")
        except Exception:
            return None
    return None

# ---------------------------------------------------------------------------
# HTTP poster (fire-and-forget in background thread)
# ---------------------------------------------------------------------------

def _post(url: str, payload: dict) -> None:
    def _send():
        try:
            resp = requests.post(url, json=payload, headers=AUTH_HEADERS, timeout=5)
            if resp.status_code not in (200, 201):
                log.warning("API %s → %s: %s", url.split("/")[-1], resp.status_code, resp.text[:120])
        except requests.RequestException as exc:
            log.warning("POST %s failed: %s", url.split("/")[-1], exc)
    threading.Thread(target=_send, daemon=True).start()

# ---------------------------------------------------------------------------
# Channel hopper
# ---------------------------------------------------------------------------

def _channel_hopper() -> None:
    idx = 0
    while not _stop.is_set():
        set_channel(CHANNELS_2G[idx % len(CHANNELS_2G)])
        idx += 1
        _stop.wait(HOP_INTERVAL)   # interruptible sleep

# ---------------------------------------------------------------------------
# Scapy sniffer  — BPF filter "type mgt" is the key CPU fix
# ---------------------------------------------------------------------------

def _run_sniffer() -> None:
    try:
        from scapy.all import sniff, RadioTap
    except ImportError:
        log.error("scapy not installed — sudo pip3 install scapy")
        sys.exit(1)

    log.info("Sniffing on %s (BPF: type mgt) …", MON_IFACE)

    def _pkt_cb(pkt) -> None:
        try:
            rssi = None
            if pkt.haslayer(RadioTap):
                try:
                    rssi = pkt[RadioTap].dBm_AntSignal
                except Exception:
                    pass
                raw = bytes(pkt)[pkt[RadioTap].len:]
            else:
                raw = bytes(pkt)
            _handle_frame(raw, rssi)
        except Exception as exc:
            log.debug("Packet error: %s", exc)

    sniff(
        iface=MON_IFACE,
        filter="type mgt",           # ← kernel BPF: only management frames
        prn=_pkt_cb,
        store=False,                 # never buffer packets in RAM
        stop_filter=lambda _: _stop.is_set(),
    )

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def _on_signal(sig, _frame) -> None:
    log.info("Signal %s — shutting down.", sig)
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
        log.info("SkyGuard Wi-Fi Intelligence Scanner v2 ready.")
        log.info("API: %s | Iface: %s | HopInterval: %.1fs", API_BASE, MON_IFACE, HOP_INTERVAL)
        log.info("Layers: DroneID beacon/probe → DJI MAC (any frame) → Operator probe-req")

        threading.Thread(target=_channel_hopper, daemon=True).start()
        _run_sniffer()
    finally:
        teardown_monitor()
        log.info("Scanner stopped cleanly.")


if __name__ == "__main__":
    main()
