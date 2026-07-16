# SkyGuard ↔ Sparrow DroneID Bridge

Polls the [Sparrow DroneID](https://github.com/ghostop14/sparrow-wifi) REST API
(BLE + WiFi Remote ID) and forwards detections to SkyGuard OS in real time.

## What Sparrow detects

| Protocol | Hardware needed | Coverage |
|---|---|---|
| **Bluetooth 4 Legacy Advertising** (most EU/FAA RID drones) | Any BLE adapter (built-in or USB dongle) | DJI Mini 2/3, Autel, most "compliant" drones |
| **Bluetooth 5 Long Range** | BLE 5.0 adapter (e.g. nRF52840 dongle, ~€15) | Newer DJI / EU-mandate drones |
| **WiFi Beacon (802.11)** | Monitor-mode WiFi adapter | DJI, Parrot, Skydio, others |

## Prerequisites

- Sparrow DroneID installed and running (`sparrow.py` or as a service).
  Its REST API listens on `http://127.0.0.1:8020` by default.
- Python 3.9+ on the same host (or network-accessible host).

## Setup

```bash
# 1. Clone / copy this bridge to your Linux host
cd hardware/sparrow-bridge

# 2. Install Python dependency (just `requests`)
pip3 install -r requirements.txt

# 3. Configure
cp .env.example .env
nano .env   # set SKYGUARD_API_BASE and SKYGUARD_DEVICE_KEY

# 4. Run
source .env && python3 bridge.py
```

## Always-on (systemd)

```bash
# Adjust paths inside the .service file if needed, then:
sudo cp skyguard-sparrow-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now skyguard-sparrow-bridge
sudo journalctl -fu skyguard-sparrow-bridge
```

## Architecture

```
[BLE dongle / WiFi NIC in monitor mode]
         │
    [Sparrow DroneID]  ←  decodes BT + WiFi Remote ID frames
         │  REST API :8020
    [sparrow-bridge/bridge.py]  ←  polls every 2 s, throttles per MAC
         │  POST /api/detections  Authorization: Bearer sg_...
    [SkyGuard OS API]
         │
    [Live map + alerts]
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Sparrow API unreachable` | Sparrow not running, or wrong `SPARROW_API_BASE` |
| SkyGuard returns 401 | Invalid / revoked device key |
| Devices appear in Sparrow but not SkyGuard | Drone has no GPS fix yet (no lat/lon in Remote ID payload) |
| Nothing in Sparrow at all | WiFi adapter not in monitor mode, or BLE adapter missing |
