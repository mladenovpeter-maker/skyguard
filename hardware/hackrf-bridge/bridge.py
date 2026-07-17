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
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

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
FREQ_JSON    = os.environ.get("FREQUENCIES_JSON", str(Path(__file__).parent / "frequencies.json"))

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
# Shared state
# ---------------------------------------------------------------------------

connected_clients: set = set()
# Latest full spectrum snapshot: list of {"hz": float, "dbm": float}
latest_spectrum: list[dict] = []
# Cooldown tracker per band: band_id -> last_alert_monotonic
_last_alert: dict[str, float] = {}

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

def check_bands(bins: list[dict]) -> None:
    """Check if any bin falls in a drone band above threshold; post alert."""
    now = time.monotonic()

    for band in BANDS:
        if band["threat"] in ("info",):
            continue  # skip informational bands (general WiFi etc.)

        band_bins = [b for b in bins if band["hz_low"] <= b["hz"] <= band["hz_high"]]
        if not band_bins:
            continue

        peak = max(band_bins, key=lambda b: b["dbm"])
        band_threshold = band.get("alert_dbm", ALERT_DBM)
        if peak["dbm"] < band_threshold:
            continue  # below threshold — ignore

        # Cooldown check
        if now - _last_alert.get(band["id"], 0) < ALERT_COOLDOWN_S:
            continue

        _last_alert[band["id"]] = now

        payload = {
            "bandId":    band["id"],
            "bandLabel": band["label"],
            "peakDbm":   round(peak["dbm"], 1),
            "peakHz":    peak["hz"],
            "threat":    band["threat"],
        }
        try:
            resp = requests.post(
                f"{API_BASE}/api/rf-alerts",
                json=payload,
                headers=AUTH_HEADERS,
                timeout=4,
            )
            if resp.status_code == 201:
                log.info("RF ALERT  %s  %.1f dBm @ %.1f MHz",
                         band["label"], peak["dbm"], peak["hz"] / 1e6)
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
    )

    ws_server.close()


if __name__ == "__main__":
    asyncio.run(main())
