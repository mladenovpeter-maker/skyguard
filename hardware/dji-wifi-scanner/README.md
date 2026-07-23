# SkyGuard DJI Wi-Fi DroneID Scanner

Detects **DJI Mini 2, Mini 3, Mavic 3, Air 2S** and other DJI drones by capturing their proprietary Wi-Fi DroneID beacon frames.

## Why a separate scanner?

DJI drones do **not** use the open ASTM F3411 Bluetooth standard.  
They broadcast on **2.4 GHz Wi-Fi** using a vendor-specific Information Element (OUI `26:37:12` / `60:60:1F`) embedded in 802.11 beacon frames.  
Capturing this requires the Wi-Fi adapter to be in **monitor mode**.

## Requirements

```bash
sudo apt install -y python3-scapy iw
sudo pip3 install requests scapy
```

The Wi-Fi USB adapter must support monitor mode (most Realtek / Atheros adapters do).

## Setup on Raspberry Pi

```bash
# 1. Copy files
cp scanner.py /home/pi/skyguard/hardware/dji-wifi-scanner/
cp skyguard-dji-wifi-scanner.service /etc/systemd/system/

# 2. Add to .env (if not already present)
echo "WIFI_IFACE=wlan1" >> /home/pi/skyguard/.env

# 3. Enable service
sudo systemctl daemon-reload
sudo systemctl enable --now skyguard-dji-wifi-scanner.service

# 4. Check logs
sudo journalctl -u skyguard-dji-wifi-scanner -f
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `SKYGUARD_API_BASE` | required | e.g. `http://192.168.100.224:3001` |
| `SKYGUARD_DEVICE_KEY` | required | `sg_...` key from Admin panel |
| `WIFI_IFACE` | `wlan1` | Wi-Fi adapter (check with `ip link`) |
| `HOP_INTERVAL_S` | `0.3` | Seconds per channel |
| `DEDUPE_S` | `5` | Seconds between duplicate API posts |

## Finding your Wi-Fi interface name

```bash
ip link | grep -E "wlan|wlx"
```

The USB Wi-Fi dongle is usually `wlan1` (if `wlan0` is the built-in).  
Adapters named `wlxXXXXXX` are also common — set `WIFI_IFACE=wlxXXXXXX`.

## Detections in SkyGuard

Detections appear on the Radar map with source tag **WIFI_DJI**.  
Fields populated: serial number, GPS lat/lng, altitude, speed, heading, RSSI, home point.
