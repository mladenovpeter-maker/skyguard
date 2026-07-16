# SkyGuard ↔ HackRF / gr-DroneID Bridge

Connects to the ZMQ output of [gr-DroneID](https://github.com/bkerler/gr-DroneID)
and forwards decoded DJI OcuSync DroneID detections to SkyGuard OS.

## What this covers

| DJI Protocol | Detectable? | Typical drones |
|---|---|---|
| **OcuSync 1 / 2 (O2)** | ✅ Yes | Mavic 2, Phantom 4, Mini 2, Air 2 |
| **OcuSync 3 (O3)** | ✅ Yes (partial) | Mavic 3, Mini 3 Pro, Air 2S |
| **O4 (encrypted)** | ❌ No | Mini 4 Pro, Air 3, Mavic 3 Pro — needs ANTSDR |

HackRF One covers a large portion of the DJI fleet still in active use.

## Prerequisites

1. **HackRF One** connected via USB.
2. **GNU Radio 3.10+** installed.
3. **gr-DroneID** built and installed from source.
4. Python 3.9+ with `pyzmq` and `requests`.

## Installation

### gr-DroneID (one-time, on the SDR host)

```bash
sudo apt install gnuradio gnuradio-dev cmake libboost-all-dev libzmq3-dev
git clone https://github.com/bkerler/gr-DroneID
cd gr-DroneID && mkdir build && cd build
cmake .. && make -j$(nproc) && sudo make install
sudo ldconfig
```

### Bridge

```bash
cd hardware/hackrf-bridge
pip3 install -r requirements.txt
cp .env.example .env
nano .env   # set SKYGUARD_API_BASE and SKYGUARD_DEVICE_KEY
```

## Running

**Step 1** — Start gr-DroneID (tune to 2.4 GHz, DJI primary band):
```bash
# From inside the gr-DroneID repo:
python3 hackrf_droneid.py --freq 2.4e9 --samp-rate 10e6 --zmq-port 4224
```
> Also try 5.8 GHz (`--freq 5.8e9`) — DJI alternates bands.

**Step 2** — Start the bridge (separate terminal):
```bash
source .env && python3 bridge.py
```

## Remote setup (Pi on roof → indoor server)

If the HackRF is on a Raspberry Pi (antenna on roof) and SkyGuard runs indoors:

```
[HackRF One] → [Pi, gr-DroneID] —ZMQ tcp://0.0.0.0:4224→ [Indoor Linux]
                                                                │
                                                       [hackrf-bridge]
                                                                │ POST
                                                        [SkyGuard OS]
```

On the Pi, bind gr-DroneID to `0.0.0.0`:
```bash
python3 hackrf_droneid.py --freq 2.4e9 --zmq-bind tcp://0.0.0.0:4224
```

In `.env` on the indoor server:
```
ZMQ_ENDPOINT=tcp://192.168.1.42:4224   # Pi's LAN IP
```

## Always-on (systemd)

```bash
sudo cp skyguard-hackrf-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now skyguard-hackrf-bridge
sudo journalctl -fu skyguard-hackrf-bridge
```

## Architecture

```
[HackRF One @ 2.4 / 5.8 GHz]
         │  IQ samples
    [gr-DroneID GNU Radio flowgraph]  ←  burst sync → decode → GPS extract
         │  ZMQ PUB tcp://127.0.0.1:4224  (JSON frames)
    [hackrf-bridge/bridge.py]  ←  subscribe, throttle per serial
         │  POST /api/detections  Authorization: Bearer sg_...
    [SkyGuard OS API]
         │
    [Live map + alerts]
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `ZMQ error`, reconnecting loop | gr-DroneID not running or wrong port |
| `No frame received in 5 s` | Normal — no OcuSync drones in range right now |
| SkyGuard returns 401 | Invalid / revoked device key |
| Frames arrive but no lat/lon | Drone GPS hasn't locked yet (first few bursts) |
| Nothing at all | Try the other DJI band: `--freq 5.8e9` |
