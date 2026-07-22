#!/usr/bin/env bash
# SkyGuard RF Fingerprinting — Pipeline
# ======================================
# Runs on the Linux server (192.168.100.224)
#
# Prerequisites (one-time manual step):
#   scp -r ~/Downloads/DroneRF tmm@192.168.100.224:~/skyguard/hardware/rf-fingerprinting/datasets/
#
# Then run:
#   chmod +x setup.sh && ./setup.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PI_USER="admin"
PI_HOST="192.168.100.252"
PI_MODEL_PATH="/home/admin/skyguard/hardware/rf-fingerprinting/rf_model.joblib"
DRONERF_DIR="$SCRIPT_DIR/datasets/DroneRF"
EXTRACTED_DIR="$SCRIPT_DIR/datasets/extracted"
MODEL_OUT="$SCRIPT_DIR/rf_model.joblib"

echo "╔══════════════════════════════════════════════════════╗"
echo "║   SkyGuard RF Fingerprinting — Training Pipeline    ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── 0. Sanity check — DroneRF folder must exist ────────────────────────────────
if [[ ! -d "$DRONERF_DIR" ]]; then
    echo "❌  DroneRF folder not found at: $DRONERF_DIR"
    echo ""
    echo "   Transfer it from your Mac first:"
    echo "   scp -r ~/Downloads/DroneRF tmm@192.168.100.224:$SCRIPT_DIR/datasets/"
    echo ""
    exit 1
fi
echo "✓ Found DroneRF dataset at: $DRONERF_DIR"

# ── 1. Install Python + system deps ───────────────────────────────────────────
echo ""
echo "▶ [1/5] Installing dependencies..."
pip3 install -q scikit-learn joblib numpy scipy 2>/dev/null || true
# Install unrar for extracting .rar files
if ! command -v unrar &>/dev/null && ! command -v 7z &>/dev/null; then
    echo "    Installing unrar..."
    sudo apt-get install -y -q unrar 2>/dev/null || sudo apt-get install -y -q p7zip-full 2>/dev/null || true
fi
echo "    ✓ Dependencies OK"

# ── 2. Extract RAR archives ────────────────────────────────────────────────────
echo ""
echo "▶ [2/5] Extracting RAR archives..."
mkdir -p "$EXTRACTED_DIR"
python3 "$SCRIPT_DIR/extract_dronerf.py" \
    --data-dir "$DRONERF_DIR" \
    --out       "$EXTRACTED_DIR"

# ── 3. Process CSVs into feature matrix ───────────────────────────────────────
echo ""
echo "▶ [3/5] Processing RF samples into features..."
python3 "$SCRIPT_DIR/process_datasets.py" \
    --data-dir "$EXTRACTED_DIR" \
    --out       "$SCRIPT_DIR/datasets/features.npz"

# ── 4. Train model ────────────────────────────────────────────────────────────
echo ""
echo "▶ [4/5] Training classifier..."
python3 "$SCRIPT_DIR/train_from_datasets.py" \
    --features "$SCRIPT_DIR/datasets/features.npz" \
    --out       "$MODEL_OUT"

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
