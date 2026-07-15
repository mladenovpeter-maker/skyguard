# SkyGuard OS <-> DragonSync bridge

This folder is a standalone Python service. It is **not** part of the pnpm
workspace and does not run inside this Replit project — it is meant to be
copied onto the Linux server (the one on the roof-network, next to the
Raspberry Pi) that runs DragonSync.

## Where this fits in the architecture

```
[Roof: Raspberry Pi + HackRF One + antenna]
        |  decodes signals locally, sends only small JSON/ZMQ
        |  packets over WiFi (not raw IQ - that would be way too
        |  much bandwidth for WiFi)
        v
[Linux server, same network]
   - DragonSync (Community Edition) - normalizes everything into a
     consistent JSON schema, publishes to local MQTT topic
     `wardragon/drones`
   - mosquitto (or any MQTT broker) - DragonSync publishes here
   - THIS BRIDGE (bridge.py) - subscribes to `wardragon/drones`,
     maps fields, POSTs to SkyGuard OS
        v
[SkyGuard OS API server] -- POST /api/detections (Bearer device key)
        v
[SkyGuard OS dashboard] - radar map, history, alarms
```

The bridge only depends on DragonSync's already-normalized MQTT output. It
does not care which decoder produced the data (HackRF-based DJI DroneID
flowgraph, a BLE/WiFi Remote ID dongle, ADS-B, etc.) - so it works today and
keeps working if more sensors are added later.

## Setup

1. **Install DragonSync** on the Linux server per the upstream docs:
   https://github.com/alphafox02/DragonSync
   Point its `config.ini` `zmq_host` at the Raspberry Pi's IP (wherever the
   HackRF-based decoder publishes ZMQ), and enable the MQTT sink
   (`mqtt_enabled = true` pointing at your local mosquitto broker).

2. **Install mosquitto** (or use an existing broker) on the Linux server:
   ```bash
   sudo apt install mosquitto mosquitto-clients
   ```

3. **Register a device in SkyGuard's Admin panel** (Admin > Add Device),
   name it something like "Roof HackRF Bridge", and copy the one-time API
   key (`sg_...`).

4. **Copy this folder** to the Linux server, e.g. `/opt/skyguard-dragonsync-bridge`.

5. **Install dependencies**:
   ```bash
   cd /opt/skyguard-dragonsync-bridge
   pip install -r requirements.txt
   ```

6. **Configure**:
   ```bash
   cp .env.example .env
   nano .env   # fill in SKYGUARD_API_BASE and SKYGUARD_DEVICE_KEY
   ```

7. **Run it manually first** to confirm it connects:
   ```bash
   set -a; source .env; set +a
   python3 bridge.py
   ```
   You should see `Connected to MQTT broker ... subscribing to wardragon/drones`.
   When DragonSync detects something, you'll see
   `Forwarded detection for <id> (<lat>, <lng>)` in the logs, and it should
   appear on the SkyGuard radar map within seconds.

8. **Install as a systemd service** for always-on operation:
   ```bash
   sudo cp skyguard-dragonsync-bridge.service /etc/systemd/system/
   sudo mkdir -p /opt/skyguard-dragonsync-bridge
   # (copy bridge.py, requirements.txt, .env into that path if not already there)
   sudo systemctl daemon-reload
   sudo systemctl enable --now skyguard-dragonsync-bridge
   sudo systemctl status skyguard-dragonsync-bridge
   ```

## Known hardware caveats (read before wiring up)

- **HackRF One + DJI DroneID**: the officially-supported DragonSync pipeline
  for DJI DroneID decoding
  (https://github.com/alphafox02/antsdr_dji_droneid) targets the **ANTSDR
  E200**, which has firmware-level support baked in. HackRF One can decode
  the older unencrypted DJI protocols (O2/O3: Mini 2, Mavic 3, etc.) via the
  GNU Radio-based `gr-DroneID` flowgraph, but this path is more DIY/manual
  than the ANTSDR firmware route, and it will **not** decode the newer
  encrypted O4 protocol (DJI Mini 5 and later) without an ANTSDR + DragonScope.
- **WiFi/Bluetooth Remote ID broadcasts** (the standard most non-DJI drones
  and newer DJI models use to comply with FAA/EU Remote ID rules) are a
  *separate* detection path from HackRF - they need a monitor-mode WiFi
  adapter and a Sonoff/nRF52840-class BLE dongle (roughly $15-30 combined).
  These plug into the Raspberry Pi itself. Adding them significantly
  broadens coverage beyond "DJI drones only."
- None of the above changes anything about this bridge - it just means the
  richness of what shows up in `wardragon/drones` depends on which decoders
  you have running upstream. Start with what you have (HackRF for DJI), and
  the bridge will pick up whatever DragonSync produces.
