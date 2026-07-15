#!/usr/bin/env python3
"""
SkyGuard OS <-> DragonSync bridge.

Runs on the same Linux server as DragonSync (Community Edition). Subscribes
to DragonSync's MQTT drone topic and forwards each drone update to the
SkyGuard OS ingestion endpoint (POST /api/detections) using a device API key
issued from the SkyGuard Admin panel.

This bridge is decoder-agnostic: it does not care whether DragonSync's drone
data came from the HackRF-based DJI DroneID flowgraph, a BLE/WiFi Remote ID
dongle, or any other source DragonSync supports. It only depends on the
`wardragon/drones` MQTT payload schema documented at:
https://github.com/alphafox02/DragonSync/blob/main/docs/mqtt-schema.md

Configuration is via environment variables (see .env.example):
  MQTT_HOST          Hostname/IP of the MQTT broker DragonSync publishes to
                      (usually 127.0.0.1 if mosquitto runs on the same box).
  MQTT_PORT           Default 1883.
  MQTT_TOPIC          Default "wardragon/drones".
  MQTT_USERNAME       Optional, if the broker requires auth.
  MQTT_PASSWORD       Optional.
  SKYGUARD_API_BASE   Base URL of the SkyGuard OS API server,
                      e.g. https://your-app.example.com
  SKYGUARD_DEVICE_KEY The device API key from the Admin panel (sg_...).
  MIN_POST_INTERVAL_S Minimum seconds between forwarded updates for the same
                      drone id, to avoid flooding the API. Default 2.

Install:
  pip install -r requirements.txt

Run:
  python3 bridge.py

For always-on operation, install the provided systemd unit
(skyguard-dragonsync-bridge.service).
"""
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone

import requests
import paho.mqtt.client as mqtt

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("skyguard-bridge")

MQTT_HOST = os.environ.get("MQTT_HOST", "127.0.0.1")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))
MQTT_TOPIC = os.environ.get("MQTT_TOPIC", "wardragon/drones")
MQTT_USERNAME = os.environ.get("MQTT_USERNAME")
MQTT_PASSWORD = os.environ.get("MQTT_PASSWORD")

API_BASE = os.environ.get("SKYGUARD_API_BASE", "").rstrip("/")
DEVICE_KEY = os.environ.get("SKYGUARD_DEVICE_KEY", "")
MIN_POST_INTERVAL_S = float(os.environ.get("MIN_POST_INTERVAL_S", "2"))

if not API_BASE or not DEVICE_KEY:
    log.error(
        "SKYGUARD_API_BASE and SKYGUARD_DEVICE_KEY must be set. "
        "Copy .env.example to .env, fill in the values, and `source .env` before running."
    )
    sys.exit(1)

DETECTIONS_URL = f"{API_BASE}/api/detections"

# Per-drone throttling so a noisy DragonSync feed doesn't flood the API.
_last_sent = {}


def _clean(value):
    """Drop DragonSync's 0.0 'no fix' sentinels so we don't send fake positions."""
    if value in (0.0, 0, None):
        return None
    return value


def map_drone_payload(msg: dict) -> dict | None:
    """Map a DragonSync `wardragon/drones` message to SkyGuard's IngestDetectionBody."""
    lat = _clean(msg.get("lat"))
    lng = _clean(msg.get("lon"))
    if lat is None or lng is None:
        # No GPS fix yet on this detection (common for early OcuSync/O4 hits) - skip.
        return None

    drone_id = msg.get("id") or "unknown-drone"
    model = msg.get("description") or msg.get("rid_model") or None
    signal_type = msg.get("transport") or msg.get("id_type") or None

    speed_ms = msg.get("speed")
    speed_kmh = round(speed_ms * 3.6, 1) if isinstance(speed_ms, (int, float)) else None

    pilot_lat = _clean(msg.get("pilot_lat"))
    pilot_lng = _clean(msg.get("pilot_lon"))

    observed_at = msg.get("observed_at")
    timestamp = None
    if isinstance(observed_at, (int, float)) and observed_at > 0:
        timestamp = datetime.fromtimestamp(observed_at, tz=timezone.utc).isoformat()

    body = {
        "droneId": drone_id,
        "model": model,
        "signalType": signal_type,
        "lat": lat,
        "lng": lng,
        "altitudeM": _clean(msg.get("alt")),
        "speedKmh": speed_kmh,
        "headingDeg": _clean(msg.get("direction")),
        "rssiDbm": msg.get("rssi"),
        "pilotLat": pilot_lat,
        "pilotLng": pilot_lng,
    }
    if timestamp:
        body["timestamp"] = timestamp

    return body


def post_detection(body: dict) -> None:
    try:
        resp = requests.post(
            DETECTIONS_URL,
            json=body,
            headers={"Authorization": f"Bearer {DEVICE_KEY}"},
            timeout=5,
        )
        if resp.status_code == 201:
            log.info("Forwarded detection for %s (%.5f, %.5f)", body["droneId"], body["lat"], body["lng"])
        elif resp.status_code == 401:
            log.error("SkyGuard rejected the device key (401). Check SKYGUARD_DEVICE_KEY / revocation status.")
        else:
            log.warning("SkyGuard returned %s for %s: %s", resp.status_code, body["droneId"], resp.text[:300])
    except requests.RequestException as exc:
        log.warning("Failed to reach SkyGuard API at %s: %s", DETECTIONS_URL, exc)


def on_connect(client, userdata, flags, reason_code, properties=None):
    if reason_code == 0:
        log.info("Connected to MQTT broker %s:%s, subscribing to %s", MQTT_HOST, MQTT_PORT, MQTT_TOPIC)
        client.subscribe(MQTT_TOPIC)
    else:
        log.error("MQTT connection failed: %s", reason_code)


def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        log.warning("Ignoring non-JSON MQTT message on %s: %s", msg.topic, exc)
        return

    drone_id = payload.get("id", "unknown-drone")
    now = time.monotonic()
    last = _last_sent.get(drone_id, 0)
    if now - last < MIN_POST_INTERVAL_S:
        return

    body = map_drone_payload(payload)
    if body is None:
        log.debug("Skipping %s: no GPS fix yet", drone_id)
        return

    _last_sent[drone_id] = now
    post_detection(body)


def main():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="skyguard-dragonsync-bridge")
    if MQTT_USERNAME:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    client.on_connect = on_connect
    client.on_message = on_message

    log.info("Starting SkyGuard <-> DragonSync bridge, forwarding to %s", DETECTIONS_URL)
    while True:
        try:
            client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
            client.loop_forever()
        except (ConnectionRefusedError, OSError) as exc:
            log.warning("MQTT broker unreachable (%s), retrying in 5s...", exc)
            time.sleep(5)


if __name__ == "__main__":
    main()
