#!/usr/bin/env python3
"""
SkyGuard OS — Ambient RF Scanner (runs on the Raspberry Pi)

Continuously scans for nearby BLE and WiFi devices and posts them to the
SkyGuard API so the dashboard can display non-drone RF activity on the map.

Requires:
  - bluez (hcitool / bluetoothctl) for BLE scanning
  - wireless-tools (iwlist) or iw for WiFi scanning
  - requests  →  pip3 install requests

Install on Pi:
  sudo apt install -y bluez wireless-tools python3-requests

Configure (environment variables, or copy .env.example → .env):
  SKYGUARD_API_BASE     SkyGuard API base URL, e.g. http://192.168.100.224:3001
  SKYGUARD_DEVICE_KEY   Device API key from SkyGuard Admin panel (sg_...)
  BLE_SCAN_DURATION_S   Seconds per BLE scan window. Default: 6
  SCAN_INTERVAL_S       Seconds between full scan cycles. Default: 15
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
BLE_DURATION_S  = float(os.environ.get("BLE_SCAN_DURATION_S", "6"))
SCAN_INTERVAL_S = float(os.environ.get("SCAN_INTERVAL_S", "15"))
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
# BLE scan via hcitool lescan
# ---------------------------------------------------------------------------

def _has_bt() -> bool:
    try:
        out = subprocess.run(["hcitool", "dev"], capture_output=True, text=True, timeout=3).stdout
        return "hci" in out
    except Exception:
        return False


def scan_ble() -> list[dict]:
    """Run a passive BLE scan for BLE_DURATION_S seconds; return list of devices."""
    items: dict[str, dict] = {}
    try:
        proc = subprocess.Popen(
            ["sudo", "hcitool", "lescan", "--duplicates"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
        )
        assert proc.stdout
        deadline = time.monotonic() + BLE_DURATION_S
        while time.monotonic() < deadline:
            line = proc.stdout.readline()
            if not line:
                break
            parts = line.strip().split(None, 1)
            if len(parts) == 2:
                mac, name = parts
                if re.fullmatch(r"([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}", mac):
                    mac = mac.upper()
                    display = name.strip() if name.strip() not in ("(unknown)", "") else None
                    if mac not in items:
                        items[mac] = {
                            "mac": mac,
                            "name": display,
                            "signalType": "BLE",
                            "rssiDbm": None,
                            "vendor": None,
                        }
        proc.terminate()
        proc.wait(timeout=2)
    except Exception as exc:
        log.warning("BLE scan error: %s", exc)
    return list(items.values())


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
    log.info("SkyGuard Ambient Scanner starting.")
    log.info("API: %s  |  BLE scan: %.0fs  |  Cycle: %.0fs", AMBIENT_URL, BLE_DURATION_S, SCAN_INTERVAL_S)

    bt_ok = _has_bt()
    if bt_ok:
        log.info("Bluetooth adapter found ✓")
    else:
        log.warning("No Bluetooth adapter — BLE scan disabled.")

    while True:
        cycle_start = time.monotonic()
        items: list[dict] = []

        if bt_ok:
            ble = scan_ble()
            log.debug("BLE found %d device(s)", len(ble))
            items.extend(ble)

        wifi = scan_wifi()
        log.debug("WiFi found %d AP(s)", len(wifi))
        items.extend(wifi)

        post_ambient(items)

        elapsed = time.monotonic() - cycle_start
        sleep_s = max(0, SCAN_INTERVAL_S - elapsed)
        time.sleep(sleep_s)


if __name__ == "__main__":
    main()
