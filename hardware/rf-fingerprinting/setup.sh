#!/usr/bin/env bash
# SkyGuard RF Fingerprinting — Pipeline
# ======================================
# Runs on the Linux server (192.168.100.224)
#
# STEP 0 (manual, one-time):
#   1. Register free at https://ieee-dataport.org/open-access/dronerf
#   2. Download the full DroneRF zip (~2 GB)
#   3. Upload it here:
#        scp DroneRF.zip tmm@192.168.100.224:~/skyguard/hardware/rf-fingerprinting/
#   4. Then run:  ./setup.sh
#
# Usage:
#   chmod +x setup.sh && ./setup.sh [--zip path/to/DroneRF.zip]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PI_USER="admin"
PI_HOST="192.168.100.252"
PI_MODEL_PATH="/home/admin/skyguard/hardware/rf-fingerprinting/rf_model.joblib"
DATASET_DIR="$SCRIPT_DIR/datasets"
MODEL_OUT="$SCRIPT_DIR/rf_model.joblib"
ZIP_PATH="$SCRIPT_DIR/DroneRF.zip"

# Allow --zip override
if [[ "${1:-}" == "--zip" && -n "${2:-}" ]]; then
    ZIP_PATH="$2"
fi

echo "╔══════════════════════════════════════════════════════╗"
echo "║   SkyGuard RF Fingerprinting — Training Pipeline    ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── 0. Sanity check — zip must exist ──────────────────────────────────────────
if [[ ! -f "$ZIP_PATH" ]]; then
    echo "❌  DroneRF zip not found at: $ZIP_PATH"
    echo ""
    echo "   To get the dataset:"
    echo "   1. Register (free) at https://ieee-dataport.org/open-access/dronerf"
    echo "   2. Download the DroneRF zip (~2 GB)"
    echo "   3. Upload it:  scp DroneRF.zip tmm@192.168.100.224:$SCRIPT_DIR/"
    echo "   4. Re-run:     ./setup.sh"
    echo ""
    exit 1
fi
echo "✓ Found zip: $ZIP_PATH  ($(du -sh "$ZIP_PATH" | cut -f1))"

# ── 1. Install Python deps ─────────────────────────────────────────────────────
echo ""
echo "▶ [1/5] Installing Python dependencies..."
pip3 install -q scikit-learn joblib numpy scipy 2>/dev/null || \
    pip  install -q scikit-learn joblib numpy scipy 2>/dev/null
echo "    ✓ Dependencies OK"

# ── 2. Extract DroneRF zip ────────────────────────────────────────────────────
echo ""
echo "▶ [2/5] Extracting DroneRF dataset..."
mkdir -p "$DATASET_DIR"
python3 "$SCRIPT_DIR/extract_dronerf.py" --zip "$ZIP_PATH" --out "$DATASET_DIR"

# ── 3. Process raw CSVs into feature matrix ────────────────────────────────────
echo ""
echo "▶ [3/5] Processing CSV files into features..."
python3 "$SCRIPT_DIR/process_datasets.py" \
    --data-dir "$DATASET_DIR" \
    --out       "$DATASET_DIR/features.npz"

# ── 4. Train model ────────────────────────────────────────────────────────────
echo ""
echo "▶ [4/5] Training classifier (RandomForest vs GradientBoosting)..."
python3 "$SCRIPT_DIR/train_from_datasets.py" \
    --features "$DATASET_DIR/features.npz" \
    --out       "$MODEL_OUT"

# ── 5. Deploy to Pi ───────────────────────────────────────────────────────────
echo ""
echo "▶ [5/5] Deploying model to Pi ($PI_HOST)..."
ssh "$PI_USER@$PI_HOST" "mkdir -p /home/admin/skyguard/hardware/rf-fingerprinting"
scp "$MODEL_OUT" "$PI_USER@$PI_HOST:$PI_MODEL_PATH"
ssh "$PI_USER@$PI_HOST" "sudo systemctl restart skyguard-hackrf-bridge"
echo "    ✓ Model deployed. Bridge restarted with RF fingerprinting enabled."

echo ""
echo "✅ RF Fingerprinting pipeline complete!"
echo "   Model : $MODEL_OUT"
echo "   Drone detections will now suppress WiFi false positives automatically."
