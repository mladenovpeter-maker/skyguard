#!/usr/bin/env python3
"""
SkyGuard RF Fingerprinting — Model Trainer
==========================================
Reads labeled rf_alerts from the API, trains a RandomForest classifier
to distinguish drone RF signals from WiFi/other interference.

Usage:
  python3 train.py

Env vars:
  SKYGUARD_API_BASE   e.g. http://192.168.100.224:3001
  SKYGUARD_AUTH_TOKEN Bearer token from a logged-in session (copy from browser DevTools)
  MODEL_OUT           Where to save the model. Default: ./rf_model.joblib
"""

import os, sys, json, logging
from pathlib import Path

import requests

logging.basicConfig(level="INFO", format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("rf-trainer")

API_BASE   = os.environ.get("SKYGUARD_API_BASE", "http://192.168.100.224:3001").rstrip("/")
AUTH_TOKEN = os.environ.get("SKYGUARD_AUTH_TOKEN", "")
MODEL_OUT  = os.environ.get("MODEL_OUT", str(Path(__file__).parent / "rf_model.joblib"))

# ── Band frequency bounds (matches frequencies.json) ──────────────────────────
BAND_BOUNDS = {
    "rc_433":   (430e6, 440e6),
    "rc_868":   (863e6, 870e6),
    "rc_915":   (902e6, 928e6),
    "dji_2400": (2400e6, 2483.5e6),
    "dji_5800": (5725e6, 5850e6),
    "dji_5150": (5150e6, 5250e6),
}

def fetch_training_data():
    headers = {"Authorization": f"Bearer {AUTH_TOKEN}"} if AUTH_TOKEN else {}
    r = requests.get(f"{API_BASE}/api/rf-alerts/training-data", headers=headers, timeout=10)
    r.raise_for_status()
    return r.json()

def extract_features(row: dict) -> list[float] | None:
    """Extract numerical features from an rf_alert row."""
    try:
        band_id  = row["bandId"]
        peak_dbm = float(row["peakDbm"])
        peak_hz  = float(row["peakHz"])
        above_db = float(row.get("aboveBaselineDb") or 0)
        ts       = row["timestamp"]

        # Normalize frequency within band (0.0 – 1.0)
        bounds = BAND_BOUNDS.get(band_id)
        if bounds:
            norm_hz = (peak_hz - bounds[0]) / (bounds[1] - bounds[0])
            norm_hz = max(0.0, min(1.0, norm_hz))
        else:
            norm_hz = 0.5

        # Band one-hot encoding
        band_ids = list(BAND_BOUNDS.keys())
        band_enc = [1.0 if band_id == b else 0.0 for b in band_ids]

        # Time features
        from datetime import datetime, timezone
        if isinstance(ts, str):
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        else:
            dt = datetime.now(timezone.utc)
        hour_sin = __import__("math").sin(2 * 3.14159 * dt.hour / 24)
        hour_cos = __import__("math").cos(2 * 3.14159 * dt.hour / 24)

        return [peak_dbm, above_db, norm_hz, hour_sin, hour_cos] + band_enc
    except Exception as exc:
        log.warning("Feature extraction failed: %s", exc)
        return None

def main():
    try:
        import sklearn
        import joblib
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import classification_report
    except ImportError:
        log.error("Install: pip3 install scikit-learn joblib")
        sys.exit(1)

    log.info("Fetching labeled training data from %s …", API_BASE)
    rows = fetch_training_data()
    log.info("Fetched %d labeled rows", len(rows))

    if len(rows) < 10:
        log.error("Not enough labeled data. Need at least 10 examples. Label alerts in the UI first.")
        sys.exit(1)

    X, y = [], []
    for row in rows:
        feats = extract_features(row)
        if feats is None:
            continue
        X.append(feats)
        y.append(row["label"])

    log.info("Training on %d examples  labels=%s", len(X), set(y))

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    clf = RandomForestClassifier(n_estimators=100, random_state=42, class_weight="balanced")
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    print("\n" + classification_report(y_test, y_pred))

    joblib.dump(clf, MODEL_OUT)
    log.info("Model saved → %s", MODEL_OUT)
    log.info("Copy to Pi: scp %s admin@192.168.100.252:/home/admin/skyguard/hardware/rf-fingerprinting/rf_model.joblib", MODEL_OUT)

if __name__ == "__main__":
    main()
