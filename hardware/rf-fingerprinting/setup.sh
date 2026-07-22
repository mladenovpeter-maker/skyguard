#!/usr/bin/env bash
# SkyGuard RF Fingerprinting — Automated Setup
# Runs on the Linux server (192.168.100.224)
# Downloads public drone RF datasets, processes them, trains model, deploys to Pi
#
# Usage:
#   chmod +x setup.sh && ./setup.sh
#
# Requirements: python3, pip3, wget, ssh access to Pi

set -euo pipefail

PI_USER="admin"
PI_HOST="192.168.100.252"
PI_MODEL_PATH="/home/admin/skyguard/hardware/rf-fingerprinting/rf_model.joblib"
DATASET_DIR="$(cd "$(dirname "$0")" && pwd)/datasets"
MODEL_OUT="$(cd "$(dirname "$0")" && pwd)/rf_model.joblib"

echo "╔══════════════════════════════════════════════════════╗"
echo "║   SkyGuard RF Fingerprinting — Automated Pipeline   ║"
echo "╚══════════════════════════════════════════════════════╝"

# ── 1. Install Python deps ─────────────────────────────────────────────────────
echo ""
echo "▶ [1/5] Installing Python dependencies..."
pip3 install -q scikit-learn joblib numpy scipy requests 2>/dev/null || \
  pip install -q scikit-learn joblib numpy scipy requests 2>/dev/null
echo "    ✓ Dependencies OK"

# ── 2. Download datasets ───────────────────────────────────────────────────────
echo ""
echo "▶ [2/5] Downloading datasets..."
mkdir -p "$DATASET_DIR"
python3 "$(dirname "$0")/download_datasets.py" --out "$DATASET_DIR"

# ── 3. Process raw data into features ─────────────────────────────────────────
echo ""
echo "▶ [3/5] Processing datasets into features..."
python3 "$(dirname "$0")/process_datasets.py" \
  --data-dir "$DATASET_DIR" \
  --out "$DATASET_DIR/features.npz"

# ── 4. Train model ────────────────────────────────────────────────────────────
echo ""
echo "▶ [4/5] Training RandomForest classifier..."
python3 "$(dirname "$0")/train_from_datasets.py" \
  --features "$DATASET_DIR/features.npz" \
  --out "$MODEL_OUT"

# ── 5. Deploy to Pi ───────────────────────────────────────────────────────────
echo ""
echo "▶ [5/5] Deploying model to Pi ($PI_HOST)..."
ssh "$PI_USER@$PI_HOST" "mkdir -p /home/admin/skyguard/hardware/rf-fingerprinting"
scp "$MODEL_OUT" "$PI_USER@$PI_HOST:$PI_MODEL_PATH"
ssh "$PI_USER@$PI_HOST" "sudo systemctl restart skyguard-hackrf-bridge"
echo "    ✓ Model deployed. Bridge restarted."

echo ""
echo "✅ RF Fingerprinting pipeline complete!"
echo "   Model: $MODEL_OUT"
echo "   Bridge will now suppress WiFi false positives automatically."
