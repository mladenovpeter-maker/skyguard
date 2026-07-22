#!/usr/bin/env python3
"""
SkyGuard RF Fingerprinting — Dataset Processor
===============================================
Converts downloaded raw files (CSV PSD / .npy) into a unified
feature matrix (X) + label vector (y) saved as features.npz.

Features extracted per sample:
  - peak_dbm          strongest signal bin
  - mean_dbm          mean power across band
  - std_dbm           spectral flatness indicator
  - bandwidth_3db     width at -3 dB from peak (normalized 0–1)
  - peak_norm_hz      peak frequency normalized within band (0–1)
  - above_mean_db     peak above band mean
  - spectral_kurtosis shape of the distribution
  - hour_sin/cos      placeholder zeros (no timestamp in datasets)

These match what bridge.py can extract in real-time from hackrf_sweep.
"""

import argparse, logging
from pathlib import Path
import numpy as np

logging.basicConfig(level="INFO", format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("rf-processor")

LABEL_MAP = {"drone": 1, "wifi": 0, "background": 0, "other": 0}

def features_from_psd(psd: np.ndarray) -> np.ndarray:
    """Extract 8 features from a 1-D power spectrum (linear or dBm)."""
    # Ensure dBm (if linear power, convert)
    if psd.max() > 0 and psd.min() >= 0:
        psd = 10 * np.log10(psd + 1e-12)

    n = len(psd)
    peak_idx  = int(np.argmax(psd))
    peak_dbm  = float(psd[peak_idx])
    mean_dbm  = float(np.mean(psd))
    std_dbm   = float(np.std(psd))
    above_mean = peak_dbm - mean_dbm

    # -3 dB bandwidth (count bins above peak - 3)
    threshold = peak_dbm - 3.0
    above     = (psd >= threshold).sum()
    bw_norm   = float(above) / n

    peak_norm = float(peak_idx) / n

    # Spectral kurtosis
    try:
        from scipy.stats import kurtosis
        spec_kurt = float(kurtosis(psd))
    except Exception:
        spec_kurt = 0.0

    return np.array([peak_dbm, mean_dbm, std_dbm, bw_norm,
                     peak_norm, above_mean, spec_kurt, 0.0, 0.0],
                    dtype=np.float32)

def process_npy(path: Path, label: int) -> tuple[np.ndarray, np.ndarray]:
    """Load .npy array (samples × bins or flat). Return (X, y)."""
    arr = np.load(path, allow_pickle=True)
    if arr.ndim == 1:
        arr = arr.reshape(1, -1)
    X = np.vstack([features_from_psd(row) for row in arr])
    y = np.full(len(X), label, dtype=np.int8)
    log.info("  %s → %d samples  label=%d", path.name, len(X), label)
    return X, y

def process_csv(path: Path, label: int) -> tuple[np.ndarray, np.ndarray]:
    """Load PSD CSV (each row = one sweep). Return (X, y)."""
    import csv
    rows = []
    with open(path, newline="") as f:
        reader = csv.reader(f)
        for row in reader:
            try:
                vals = [float(v) for v in row if v.strip()]
                if len(vals) >= 8:
                    # DroneRF format: date, time, hz_low, hz_high, bin_width, n_samples, dBm...
                    psd = np.array(vals[6:], dtype=np.float32)
                    rows.append(features_from_psd(psd))
            except ValueError:
                continue
    if not rows:
        log.warning("  %s — no valid rows", path.name)
        return np.empty((0, 9), np.float32), np.empty(0, np.int8)
    X = np.vstack(rows)
    y = np.full(len(X), label, dtype=np.int8)
    log.info("  %s → %d samples  label=%d", path.name, len(X), label)
    return X, y

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", required=True)
    ap.add_argument("--out",      required=True)
    args = ap.parse_args()

    data_dir = Path(args.data_dir)
    Xs, ys   = [], []

    for label_file in sorted(data_dir.glob("*.label")):
        raw_file = data_dir / label_file.stem
        if not raw_file.exists():
            continue
        label_str = label_file.read_text().strip()
        label_int = LABEL_MAP.get(label_str, 0)

        try:
            if raw_file.suffix == ".npy":
                X, y = process_npy(raw_file, label_int)
            elif raw_file.suffix in (".csv", ".txt"):
                X, y = process_csv(raw_file, label_int)
            else:
                log.warning("Skipping unknown format: %s", raw_file.name)
                continue
            if len(X):
                Xs.append(X); ys.append(y)
        except Exception as exc:
            log.warning("Failed to process %s: %s", raw_file.name, exc)

    if not Xs:
        log.error("No data processed. Aborting.")
        import sys; sys.exit(1)

    X_all = np.vstack(Xs)
    y_all = np.concatenate(ys)
    log.info("Total: %d samples  drone=%d  wifi/bg=%d",
             len(y_all), (y_all == 1).sum(), (y_all == 0).sum())

    np.savez_compressed(args.out, X=X_all, y=y_all)
    log.info("Features saved → %s", args.out)

if __name__ == "__main__":
    main()
