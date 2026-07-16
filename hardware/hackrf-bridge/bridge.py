#!/usr/bin/env python3
"""
SkyGuard OS <-> HackRF / gr-DroneID bridge.

Subscribes to the ZMQ PUB socket that gr-DroneID publishes decoded DJI
DroneID frames on, and forwards each detection to SkyGuard OS via
POST /api/detections.

gr-DroneID: https://github.com/bkerler/gr-DroneID
  Decodes DJI OcuSync 1/2 DroneID bursts from a HackRF One (or any other
  SDR supported by gr-osmosdr). Gives you GPS position, altitude, speed,
  heading, and serial number for DJI Mavic 2, Mini 2, Air 2, Phantom 4, etc.
  Does NOT decode encrypted O4 signals (Mini 4 Pro, Air 3, Mavic 3 Pro).

Setup on the SDR host:
  1. Install GNU Radio 3.10+ and gr-DroneID:
       sudo apt install gnuradio gnuradio-dev cmake libboost-all-dev libzmq3-dev
       git clone https://github.com/bkerler/gr-DroneID && cd gr-DroneID
       mkdir build && cd build && cmake .. && make -j4 && sudo make install
       sudo ldconfig

  2. Start the gr-DroneID flowgraph (use hackrf_droneid.py or the GRC file):
       python3 hackrf_droneid.py --freq 2.4e9 --zmq-port 4224
     The script publishes decoded JSON frames on tcp://127.0.0.1:4224.

  3. Run this bridge (after sourcing .env):
       source .env && python3 bridge.py

Configuration (environment variables — see .env.example):
  ZMQ_ENDPOINT         ZMQ PUB address gr-DroneID binds to.
                       Default: tcp://127.0.0.1:4224
  SKYGUARD_API_BASE    SkyGuard API base URL.
  SKYGUARD_DEVICE_KEY  Device API key (sg_...).
  MIN_POST_INTERVAL_S  Throttle per drone serial. Default: 2

Always-on:
  sudo systemctl enable --now skyguard-hackrf-bridge.service
"""

import json
import logging
import os
import sys
import time

import requests
import zmq

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("skyguard-hackrf")

ZMQ_ENDPOINT = os.environ.get("ZMQ_ENDPOINT", "tcp://127.0.0.1:4224")

API_BASE = os.environ.get("SKYGUARD_API_BASE", "").rstrip("/")
DEVICE_KEY = os.environ.get("SKYGUARD_DEVICE_KEY", "")
MIN_POST_INTERVAL_S = float(os.environ.get("MIN_POST_INTERVAL_S", "2"))

if not API_BASE or not DEVICE_KEY:
    log.error(
        "SKYGUARD_API_BASE and SKYGUARD_DEVICE_KEY must be set.\n"
        "Copy .env.example to .env, fill in the values, and `source .env`."
    )
    sys.exit(1)

DETECTIONS_URL = f"{API_BASE}/api/detections"

_last_sent: dict[str, float] = {}


def _clean(value):
    if value in (None, 0, 0.0, ""):
        return None
    return value


def map_frame(frame: dict) -> dict | None:
    """
    Map a gr-DroneID decoded frame to SkyGuard's IngestDetectionBody.

    gr-DroneID JSON fields (may vary by version/commit):
      serial_number, lat, lon, alt, speed, direction, height,
      home_lat, home_lon, rssi, timestamp
    """
    lat = _clean(frame.get("lat"))
    lng = _clean(frame.get("lon"))
    if lat is None or lng is None:
        return None

    serial = frame.get("serial_number") or frame.get("serial") or "UNKNOWN"
    speed_ms = frame.get("speed")
    speed_kmh = round(float(speed_ms) * 3.6, 1) if speed_ms else None

    # gr-DroneID reports home coords (take-off point) rather than pilot coords.
    home_lat = _clean(frame.get("home_lat"))
    home_lng = _clean(frame.get("home_lon"))

    return {
        "droneId": serial,
        "model": f"DJI (HackRF OcuSync) [{serial}]",
        "signalType": "OcuSync_HackRF",
        "lat": float(lat),
        "lng": float(lng),
        "altitudeM": _clean(frame.get("alt")),
        "speedKmh": speed_kmh,
        "headingDeg": _clean(frame.get("direction")),
        "rssiDbm": frame.get("rssi"),
        # Home/take-off point as proxy for pilot location
        "pilotLat": home_lat,
        "pilotLng": home_lng,
    }


def post_detection(body: dict) -> None:
    try:
        resp = requests.post(
            DETECTIONS_URL,
            json=body,
            headers={"Authorization": f"Bearer {DEVICE_KEY}"},
            timeout=5,
        )
        if resp.status_code == 201:
            log.info(
                "Forwarded %s @ (%.5f, %.5f) alt %.0fm spd %.1f km/h",
                body["droneId"], body["lat"], body["lng"],
                body.get("altitudeM") or 0, body.get("speedKmh") or 0,
            )
        elif resp.status_code == 401:
            log.error("SkyGuard rejected device key (401). Check SKYGUARD_DEVICE_KEY.")
        else:
            log.warning("SkyGuard %s for %s: %s", resp.status_code, body["droneId"], resp.text[:200])
    except requests.RequestException as exc:
        log.warning("Failed to reach SkyGuard at %s: %s", DETECTIONS_URL, exc)


def main() -> None:
    log.info("SkyGuard <-> HackRF/gr-DroneID bridge starting.")
    log.info("Subscribing to ZMQ PUB at %s", ZMQ_ENDPOINT)
    log.info("Forwarding detections to %s", DETECTIONS_URL)

    ctx = zmq.Context()

    while True:
        sock = ctx.socket(zmq.SUB)
        sock.setsockopt_string(zmq.SUBSCRIBE, "")  # subscribe to all topics
        sock.setsockopt(zmq.RCVTIMEO, 5000)         # 5 s receive timeout

        try:
            sock.connect(ZMQ_ENDPOINT)
            log.info("Connected to gr-DroneID ZMQ socket.")

            while True:
                try:
                    raw = sock.recv()
                except zmq.Again:
                    # No frame in 5 s — gr-DroneID running but no drones in range.
                    log.debug("No frame received in 5 s (no drones in range, or flowgraph paused).")
                    continue

                # gr-DroneID sends either a raw JSON string or a multipart message.
                # Handle both.
                try:
                    text = raw.decode("utf-8")
                    frame = json.loads(text)
                except (UnicodeDecodeError, json.JSONDecodeError):
                    log.debug("Non-JSON ZMQ frame, skipping.")
                    continue

                serial = frame.get("serial_number") or frame.get("serial") or "UNKNOWN"
                now = time.monotonic()
                if now - _last_sent.get(serial, 0) < MIN_POST_INTERVAL_S:
                    continue

                body = map_frame(frame)
                if body is None:
                    log.debug("Skipping %s: no GPS fix.", serial)
                    continue

                _last_sent[serial] = now
                post_detection(body)

        except zmq.ZMQError as exc:
            log.warning("ZMQ error (%s), reconnecting in 5 s...", exc)
        finally:
            sock.close()
            time.sleep(5)


if __name__ == "__main__":
    main()
