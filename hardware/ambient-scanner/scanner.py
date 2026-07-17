#!/usr/bin/env python3
"""
SkyGuard OS — Ambient RF Scanner (runs on the Raspberry Pi)

Scans for nearby WiFi access points and posts them to the SkyGuard API
so the dashboard can display non-drone RF activity on the map.

NOTE: BLE scanning has been moved to the dedicated DroneID scanner
(hardware/droneID-scanner/scanner.py) which uses the nRF52840 USB dongle.

Requires:
  - wireless-tools (iwlist) or iw for WiFi scanning
  - requests  →  pip3 install requests

Install on Pi:
  sudo apt install -y wireless-tools python3-requests

Configure (environment variables, or copy .env.example → .env):
  SKYGUARD_API_BASE     SkyGuard API base URL, e.g. http://192.168.100.224:3001
  SKYGUARD_DEVICE_KEY   Device API key from SkyGuard Admin panel (sg_...)
  SCAN_INTERVAL_S       Seconds between full scan cycles. Default: 30
  WIFI_IFACE            WiFi interface to scan. Default: wlan0

Run:
  source .env && python3 scanner.py

Always-on (systemd):
  sudo cp skyguard-ambient-scanner.service /etc/systemd/system/
  sudo systemctl enable --now skyguard-ambient-scanner.service
"""

import logging
import os
import re
import subprocess
import sys
import time

import requests

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("skyguard-ambient")

API_BASE        = os.environ.get("SKYGUARD_API_BASE", "").rstrip("/")
DEVICE_KEY      = os.environ.get("SKYGUARD_DEVICE_KEY", "")
SCAN_INTERVAL_S = float(os.environ.get("SCAN_INTERVAL_S", "30"))
WIFI_IFACE      = os.environ.get("WIFI_IFACE", "wlan0")

if not API_BASE or not DEVICE_KEY:
    log.error("SKYGUARD_API_BASE and SKYGUARD_DEVICE_KEY must be set.")
    sys.exit(1)

AMBIENT_URL = f"{API_BASE}/api/ambient"
AUTH_HEADERS = {
    "Authorization": f"Bearer {DEVICE_KEY}",
    "Content-Type": "application/json",
}


# ---------------------------------------------------------------------------
# WiFi AP scan via iwlist
# ---------------------------------------------------------------------------

def scan_wifi() -> list[dict]:
    """Scan for nearby WiFi APs; return list of devices."""
    items: list[dict] = []
    try:
        result = subprocess.run(
            ["sudo", "iwlist", WIFI_IFACE, "scan"],
            capture_output=True, text=True, timeout=15,
        )
        current: dict = {}
        for line in result.stdout.splitlines():
            line = line.strip()
            if line.startswith("Cell "):
                if current.get("mac"):
                    items.append(current)
                current = {}
                m = re.search(r"Address:\s*([0-9A-Fa-f:]{17})", line)
                if m:
                    current = {
                        "mac": m.group(1).upper(),
                        "signalType": "WIFI",
                        "name": None,
                        "rssiDbm": None,
                        "vendor": None,
                    }
            elif "ESSID:" in line and current:
                m = re.search(r'ESSID:"(.*?)"', line)
                if m:
                    current["name"] = m.group(1) or None
            elif "Signal level=" in line and current:
                m = re.search(r"Signal level=(-?\d+)", line)
                if m:
                    current["rssiDbm"] = int(m.group(1))
        if current.get("mac"):
            items.append(current)
    except Exception as exc:
        log.warning("WiFi scan error: %s", exc)
    return items


# ---------------------------------------------------------------------------
# Post to SkyGuard
# ---------------------------------------------------------------------------

def post_ambient(items: list[dict]) -> None:
    if not items:
        return
    try:
        resp = requests.post(AMBIENT_URL, json=items, headers=AUTH_HEADERS, timeout=6)
        if resp.status_code == 200:
            log.info("Posted %d device(s)  [BLE: %d  WiFi: %d]",
                     len(items),
                     sum(1 for d in items if d["signalType"] == "BLE"),
                     sum(1 for d in items if d["signalType"] == "WIFI"))
        elif resp.status_code == 401:
            log.error("Invalid device key (401). Check SKYGUARD_DEVICE_KEY.")
        else:
            log.warning("API %s: %s", resp.status_code, resp.text[:120])
    except requests.RequestException as exc:
        log.warning("POST failed: %s", exc)


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main() -> None:
    log.info("SkyGuard Ambient Scanner starting (WiFi only).")
    log.info("API: %s  |  Cycle: %.0fs  |  Iface: %s", AMBIENT_URL, SCAN_INTERVAL_S, WIFI_IFACE)
    log.info("BLE scanning → see hardware/droneID-scanner/ (nRF52840 dongle)")

    while True:
        cycle_start = time.monotonic()

        wifi = scan_wifi()
        log.debug("WiFi found %d AP(s)", len(wifi))
        post_ambient(wifi)

        elapsed = time.monotonic() - cycle_start
        sleep_s = max(0, SCAN_INTERVAL_S - elapsed)
        time.sleep(sleep_s)


if __name__ == "__main__":
    main()
