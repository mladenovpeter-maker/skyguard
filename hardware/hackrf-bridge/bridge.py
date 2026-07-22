#!/usr/bin/env python3
"""
SkyGuard OS — HackRF Sweep Bridge

Runs hackrf_sweep, streams spectrum data to connected browsers via WebSocket,
and posts RF alerts to the SkyGuard API when signals are detected in known
drone frequency bands.

Architecture:
  hackrf_sweep subprocess → parser → asyncio queue
                                   ├─ WebSocket broadcast  (spectrum waterfall)
                                   └─ Band detector        → POST /api/rf-alerts

Configuration (.env):
  HACKRF_FREQ_START_MHZ   Start frequency in MHz. Default: 400
  HACKRF_FREQ_END_MHZ     End frequency in MHz. Default: 6000
  HACKRF_BIN_WIDTH_KHZ    Bin width in kHz. Default: 100
  HACKRF_LNA_GAIN         LNA gain 0-40 dB. Default: 16
  HACKRF_VGA_GAIN         VGA gain 0-62 dB. Default: 20
  WS_PORT                 WebSocket server port. Default: 8765
  SKYGUARD_API_BASE       e.g. http://192.168.100.224:3001
  SKYGUARD_DEVICE_KEY     Device API key (sg_...)
  ALERT_COOLDOWN_S        Min seconds between alerts per band. Default: 30
  FREQUENCIES_JSON        Path to frequencies.json. Default: ./frequencies.json

Install:
  pip3 install websockets requests
  sudo apt install -y hackrf

Run:
  source .env && python3 bridge.py

Systemd service: skyguard-hackrf-bridge.service
"""

import asyncio
import json
import logging
import os
import statistics
import subprocess
import sys
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# Pi system info helpers
# ---------------------------------------------------------------------------

_last_cpu_stat: tuple | None = None

def _read_cpu_stat() -> tuple:
    """Read /proc/stat first line → (user, nice, system, idle, ...)"""
    with open("/proc/stat") as f:
        parts = f.readline().split()[1:]
    return tuple(int(x) for x in parts)

def get_cpu_percent() -> float:
    global _last_cpu_stat
    cur = _read_cpu_stat()
    if _last_cpu_stat is None:
        _last_cpu_stat = cur
        return 0.0
    prev = _last_cpu_stat
    _last_cpu_stat = cur
    idle_delta  = cur[3] - prev[3]
    total_delta = sum(c - p for c, p in zip(cur, prev))
    if total_delta == 0:
        return 0.0
    return round(100.0 * (1 - idle_delta / total_delta), 1)

def get_cpu_temp() -> float | None:
    try:
        val = float(Path("/sys/class/thermal/thermal_zone0/temp").read_text())
        return round(val / 1000, 1)
    except Exception:
        return None

def get_mem_percent() -> float:
    info: dict[str, int] = {}
    with open("/proc/meminfo") as f:
        for line in f:
            k, v = line.split(":")
            info[k.strip()] = int(v.split()[0])
    total = info.get("MemTotal", 1)
    avail = info.get("MemAvailable", total)
    return round(100.0 * (1 - avail / total), 1)

def get_uptime_s() -> int:
    return int(float(Path("/proc/uptime").read_text().split()[0]))

def get_disk_percent() -> float:
    st = os.statvfs("/")
    total = st.f_blocks * st.f_frsize
    free  = st.f_bfree  * st.f_frsize
    return round(100.0 * (1 - free / total), 1) if total else 0.0

def collect_sysinfo() -> dict:
    return {
        "cpuPercent":  get_cpu_percent(),
        "cpuTempC":    get_cpu_temp(),
        "memPercent":  get_mem_percent(),
        "diskPercent": get_disk_percent(),
        "uptimeS":     get_uptime_s(),
        "ts":          datetime.now(timezone.utc).isoformat(),
    }

SYSINFO_INTERVAL_S = 30  # report every 30 seconds

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("skyguard-hackrf")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

FREQ_START_MHZ   = int(os.environ.get("HACKRF_FREQ_START_MHZ", "400"))
FREQ_END_MHZ     = int(os.environ.get("HACKRF_FREQ_END_MHZ", "6000"))
BIN_WIDTH_KHZ    = int(os.environ.get("HACKRF_BIN_WIDTH_KHZ", "100"))
LNA_GAIN         = int(os.environ.get("HACKRF_LNA_GAIN", "16"))
VGA_GAIN         = int(os.environ.get("HACKRF_VGA_GAIN", "20"))
WS_PORT          = int(os.environ.get("WS_PORT", "8765"))

API_BASE     = os.environ.get("SKYGUARD_API_BASE", "").rstrip("/")
DEVICE_KEY   = os.environ.get("SKYGUARD_DEVICE_KEY", "")
ALERT_COOLDOWN_S = float(os.environ.get("ALERT_COOLDOWN_S", "30"))
CONFIRM_SWEEPS   = int(os.environ.get("CONFIRM_SWEEPS", "3"))  # require N consecutive above-threshold sweeps before alerting (filters WiFi bursts)
FREQ_JSON        = os.environ.get("FREQUENCIES_JSON", str(Path(__file__).parent / "frequencies.json"))
SIGNATURES_JSON  = os.environ.get("SIGNATURES_JSON",  str(Path(__file__).parent / "drone_signatures.json"))

# Optional RF fingerprinting model — loaded if present
try:
    sys.path.insert(0, str(Path(__file__).parent.parent / "rf-fingerprinting"))
    from classify import load_model, classify_band as rf_classify_band
    _rf_model_available = load_model()
except Exception:
    _rf_model_available = False
    def rf_classify_band(*_a, **_kw): return None  # type: ignore

if not API_BASE or not DEVICE_KEY:
    log.error("SKYGUARD_API_BASE and SKYGUARD_DEVICE_KEY must be set.")
    sys.exit(1)

AUTH_HEADERS = {
    "Authorization": f"Bearer {DEVICE_KEY}",
    "Content-Type": "application/json",
}

# ---------------------------------------------------------------------------
# Load frequency database
# ---------------------------------------------------------------------------

def load_bands() -> list[dict]:
    try:
        with open(FREQ_JSON) as f:
            data = json.load(f)
        bands = data.get("bands", [])
        thresholds = data.get("thresholds", {})
        log.info("Loaded %d frequency bands from %s", len(bands), FREQ_JSON)
        return bands, thresholds
    except Exception as exc:
        log.error("Failed to load frequencies.json: %s", exc)
        return [], {}


BANDS, THRESHOLDS = load_bands()
ALERT_DBM   = THRESHOLDS.get("alert_dbm", -60)
WARNING_DBM = THRESHOLDS.get("warning_dbm", -75)

# ---------------------------------------------------------------------------
# Load drone signature library
# ---------------------------------------------------------------------------

def load_signatures() -> dict:
    try:
        with open(SIGNATURES_JSON) as f:
            data = json.load(f)
        sig_map  = {s["id"]: s for s in data.get("signatures", [])}
        band_map = data.get("band_to_signatures", {})
        baseline_sweeps = int(data.get("BASELINE_SWEEPS", 30))
        baseline_margin = float(data.get("BASELINE_MARGIN_DB", 12))
        log.info("Loaded %d drone signatures from %s", len(sig_map), SIGNATURES_JSON)
        return sig_map, band_map, baseline_sweeps, baseline_margin
    except Exception as exc:
        log.warning("Could not load drone_signatures.json: %s", exc)
        return {}, {}, 30, 12

SIGNATURE_MAP, BAND_SIGNATURE_MAP, BASELINE_SWEEPS, BASELINE_MARGIN_DB = load_signatures()

def match_signatures(band_id: str) -> list[str]:
    """Return list of possible drone labels for a detected band."""
    sig_ids = BAND_SIGNATURE_MAP.get(band_id, [])
    return [SIGNATURE_MAP[s]["label"] for s in sig_ids if s in SIGNATURE_MAP]

# ---------------------------------------------------------------------------
# Shared state
# ---------------------------------------------------------------------------

connected_clients: set = set()
# Latest full spectrum snapshot: list of {"hz": float, "dbm": float}
latest_spectrum: list[dict] = []
# Cooldown tracker per band: band_id -> last_alert_monotonic
_last_alert: dict[str, float] = {}
# Rolling peak history per band for baseline calculation
_band_peaks: dict[str, deque] = {b["id"]: deque(maxlen=BASELINE_SWEEPS) for b in BANDS}
# Computed baseline dBm per band (None = not yet established)
_baseline: dict[str, float] = {}
# Consecutive above-threshold sweep counter per band (WiFi bursts reset to 0; drones accumulate)
_band_consecutive_hits: dict[str, int] = {}
# Suppressed bands (user-defined "own" devices) — refreshed periodically
_suppressed_bands: set[str] = set()
_last_suppressed_refresh: float = 0
SUPPRESSED_REFRESH_S = 60  # refresh every 60 seconds


def refresh_suppressed_bands() -> None:
    """Fetch user-defined own RF sources from API and update suppressed set."""
    global _suppressed_bands, _last_suppressed_refresh
    try:
        resp = requests.get(
            f"{API_BASE}/api/known-rf-sources",
            headers=AUTH_HEADERS,
            timeout=4,
        )
        if resp.status_code == 200:
            sources = resp.json()
            _suppressed_bands = {s["bandId"] for s in sources if s.get("suppress")}
            log.info("Suppressed bands: %s", _suppressed_bands or "none")
    except Exception as exc:
        log.debug("Could not fetch known-rf-sources: %s", exc)
    _last_suppressed_refresh = time.monotonic()

# ---------------------------------------------------------------------------
# hackrf_sweep parser
# ---------------------------------------------------------------------------

def parse_sweep_line(line: str) -> list[dict] | None:
    """
    hackrf_sweep CSV format:
    date, time, hz_low, hz_high, hz_bin_width, num_samples, db[0], db[1], ...
    """
    parts = line.strip().split(",")
    if len(parts) < 7:
        return None
    try:
        hz_low   = float(parts[2])
        hz_high  = float(parts[3])
        hz_step  = float(parts[4])
        samples  = parts[6:]
        bins = []
        for i, s in enumerate(samples):
            hz = hz_low + i * hz_step
            if hz > hz_high:
                break
            dbm = float(s)
            bins.append({"hz": hz, "dbm": dbm})
        return bins
    except (ValueError, IndexError):
        return None


# ---------------------------------------------------------------------------
# Band detection & alerting
# ---------------------------------------------------------------------------

def update_baseline(band_id: str, peak_dbm: float) -> float | None:
    """Record peak for band; return current baseline or None if not ready."""
    _band_peaks[band_id].append(peak_dbm)
    peaks = list(_band_peaks[band_id])
    if len(peaks) < max(5, BASELINE_SWEEPS // 3):
        return None  # not enough data yet
    baseline = statistics.median(peaks)
    _baseline[band_id] = baseline
    return baseline


def check_bands(bins: list[dict]) -> None:
    """Check if any bin falls in a drone band above threshold; post alert."""
    now = time.monotonic()

    # Refresh suppressed bands periodically
    if now - _last_suppressed_refresh > SUPPRESSED_REFRESH_S:
        refresh_suppressed_bands()

    for band in BANDS:
        if band["threat"] in ("info",):
            continue  # skip informational bands (general WiFi etc.)
        if band["id"] in _suppressed_bands:
            continue  # user marked as own device — skip

        band_bins = [b for b in bins if band["hz_low"] <= b["hz"] <= band["hz_high"]]
        if not band_bins:
            continue

        peak = max(band_bins, key=lambda b: b["dbm"])

        # Update rolling baseline
        baseline = update_baseline(band["id"], peak["dbm"])

        # Determine effective alert threshold
        band_static_threshold = band.get("alert_dbm", ALERT_DBM)
        if baseline is not None:
            # Alert when signal is significantly above ambient baseline
            dynamic_threshold = baseline + BASELINE_MARGIN_DB
            effective_threshold = max(band_static_threshold, dynamic_threshold)
        else:
            effective_threshold = band_static_threshold

        if peak["dbm"] < effective_threshold:
            _band_consecutive_hits[band["id"]] = 0  # reset streak
            continue  # below threshold — ignore

        # Require N consecutive above-threshold sweeps (filters single WiFi bursts)
        _band_consecutive_hits[band["id"]] = _band_consecutive_hits.get(band["id"], 0) + 1
        if _band_consecutive_hits[band["id"]] < CONFIRM_SWEEPS:
            continue  # not sustained enough yet

        # Cooldown check
        if now - _last_alert.get(band["id"], 0) < ALERT_COOLDOWN_S:
            continue

        _last_alert[band["id"]] = now

        above_baseline = round(peak["dbm"] - baseline, 1) if baseline is not None else None
        possible_drones = match_signatures(band["id"])

        # Optional RF fingerprinting — suppress if model classifies as wifi
        rf_label = rf_classify_band(band_bins)
        if rf_label == "wifi":
            log.info("RF FINGERPRINT suppressed %s → classified as wifi", band["label"])
            continue

        payload = {
            "bandId":          band["id"],
            "bandLabel":       band["label"],
            "peakDbm":         round(peak["dbm"], 1),
            "peakHz":          peak["hz"],
            "threat":          band["threat"],
            "possibleDrones":  json.dumps(possible_drones),
            "aboveBaselineDb": above_baseline,
        }
        try:
            resp = requests.post(
                f"{API_BASE}/api/rf-alerts",
                json=payload,
                headers=AUTH_HEADERS,
                timeout=4,
            )
            if resp.status_code == 201:
                drones_str = ", ".join(possible_drones[:2]) or "unknown"
                log.info("RF ALERT  %s  %.1f dBm @ %.1f MHz  (+%.1f dB baseline)  [%s]",
                         band["label"], peak["dbm"], peak["hz"] / 1e6,
                         above_baseline or 0, drones_str)
            else:
                log.warning("Alert POST %s: %s", resp.status_code, resp.text[:80])
        except requests.RequestException as exc:
            log.warning("Alert POST failed: %s", exc)


# ---------------------------------------------------------------------------
# WebSocket server
# ---------------------------------------------------------------------------

async def ws_handler(websocket) -> None:
    # websockets 16.x: path is a property, not a parameter
    remote = getattr(websocket, "remote_address", "unknown")
    connected_clients.add(websocket)
    log.info("WS client connected from %s  (total: %d)", remote, len(connected_clients))
    try:
        # Send the latest snapshot immediately on connect
        if latest_spectrum:
            await websocket.send(json.dumps({
                "type": "spectrum",
                "data": latest_spectrum,
                "ts":   datetime.now(timezone.utc).isoformat(),
            }))
        # Keep connection alive — recv() raises ConnectionClosed on disconnect
        async for _ in websocket:
            pass
    except Exception as exc:
        log.debug("WS client error: %s", exc)
    finally:
        connected_clients.discard(websocket)
        log.info("WS client disconnected (total: %d)", len(connected_clients))


async def broadcast(message: str) -> None:
    if not connected_clients:
        return
    dead = set()
    for ws in list(connected_clients):
        try:
            await ws.send(message)
        except Exception:
            dead.add(ws)
    connected_clients.difference_update(dead)


# ---------------------------------------------------------------------------
# hackrf_sweep subprocess reader
# ---------------------------------------------------------------------------

async def run_sweep(queue: asyncio.Queue) -> None:
    cmd = [
        "hackrf_sweep",
        "-f", f"{FREQ_START_MHZ}:{FREQ_END_MHZ}",
        "-B",  # binary output? no — use default CSV
        "-w", str(BIN_WIDTH_KHZ * 1000),
        "-l", str(LNA_GAIN),
        "-g", str(VGA_GAIN),
        "-1",  # one-shot per sweep? no — continuous
    ]
    # Remove -1 (not a valid flag); hackrf_sweep runs continuously by default
    cmd = [
        "hackrf_sweep",
        "-f", f"{FREQ_START_MHZ}:{FREQ_END_MHZ}",
        "-w", str(BIN_WIDTH_KHZ * 1000),
        "-l", str(LNA_GAIN),
        "-g", str(VGA_GAIN),
    ]

    log.info("Starting hackrf_sweep %d–%d MHz  bin=%.0f kHz",
             FREQ_START_MHZ, FREQ_END_MHZ, BIN_WIDTH_KHZ)
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        assert proc.stdout
        async for raw_line in proc.stdout:
            line = raw_line.decode(errors="ignore")
            bins = parse_sweep_line(line)
            if bins:
                await queue.put(bins)
    except FileNotFoundError:
        log.error("hackrf_sweep not found. Install: sudo apt install hackrf")
        sys.exit(1)
    except Exception as exc:
        log.error("hackrf_sweep error: %s", exc)


# ---------------------------------------------------------------------------
# Accumulator — collects bins into a full sweep, then broadcasts
# ---------------------------------------------------------------------------

async def process_queue(queue: asyncio.Queue) -> None:
    global latest_spectrum
    sweep_bins: dict[float, float] = {}  # hz -> dbm
    last_broadcast = time.monotonic()

    while True:
        bins = await queue.get()
        for b in bins:
            sweep_bins[b["hz"]] = b["dbm"]

        # Broadcast every ~0.5 s to avoid flooding
        now = time.monotonic()
        if now - last_broadcast >= 0.5:
            sorted_bins = [{"hz": hz, "dbm": dbm}
                           for hz, dbm in sorted(sweep_bins.items())]
            latest_spectrum = sorted_bins

            msg = json.dumps({
                "type": "spectrum",
                "data": sorted_bins,
                "ts": datetime.now(timezone.utc).isoformat(),
            })
            await broadcast(msg)
            check_bands(sorted_bins)
            last_broadcast = now
            sweep_bins = {}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def report_sysinfo_loop() -> None:
    """Periodically collect Pi system stats and POST to API."""
    while True:
        await asyncio.sleep(SYSINFO_INTERVAL_S)
        try:
            info = collect_sysinfo()
            resp = requests.post(
                f"{API_BASE}/api/pi-status",
                json=info,
                headers=AUTH_HEADERS,
                timeout=4,
            )
            if resp.status_code == 204:
                log.debug("Sysinfo posted: CPU %.1f%%  %.1f°C  RAM %.1f%%",
                          info["cpuPercent"], info.get("cpuTempC") or 0, info["memPercent"])
            else:
                log.warning("Sysinfo POST %s", resp.status_code)
        except Exception as exc:
            log.debug("Sysinfo POST failed: %s", exc)


async def main() -> None:
    try:
        import websockets
    except ImportError:
        log.error("websockets not installed. Run: pip3 install websockets")
        sys.exit(1)

    queue: asyncio.Queue = asyncio.Queue(maxsize=1000)

    log.info("SkyGuard HackRF Bridge starting.")
    log.info("WebSocket server on ws://0.0.0.0:%d", WS_PORT)
    log.info("Posting RF alerts to %s/api/rf-alerts", API_BASE)
    log.info("Alert threshold: %.0f dBm  |  Warning: %.0f dBm", ALERT_DBM, WARNING_DBM)

    ws_server = await websockets.serve(ws_handler, "0.0.0.0", WS_PORT)

    await asyncio.gather(
        run_sweep(queue),
        process_queue(queue),
        report_sysinfo_loop(),
    )

    ws_server.close()


if __name__ == "__main__":
    asyncio.run(main())
