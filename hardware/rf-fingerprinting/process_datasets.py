#!/usr/bin/env python3
"""
SkyGuard RF Fingerprinting — Dataset Processor
===============================================
Processes the real DroneRF dataset (Al-Sa'd et al., 2019) from Mendeley Data.

Real DroneRF CSV format (RF_Data.csv):
  - Shape: (2051, N) — columns are samples, rows are features + labels
  - Rows 0–2046  : 2047 RF signal values per sample (power spectrum)
  - Row 2048     : Label 1 — detection    (0 = no drone, 1 = drone)
  - Row 2049     : Label 2 — identification (which drone model)
  - Row 2050     : Label 3 — mode (off/on/connected/hovering/flying/video)

We use Label 1 (row 2048) as the binary drone/background classifier.

Features extracted per sample (9 total, matching bridge.py real-time extraction):
  peak_dbm, mean_dbm, std_dbm, bandwidth_3db, peak_norm_hz,
  above_mean_db, spectral_kurtosis, hour_sin=0, hour_cos=0

Usage:
  python3 process_datasets.py --data-dir datasets/ --out datasets/features.npz

Expected files in data-dir:
  RF_Data.csv          (from DroneRF/RF_Data.csv inside the Mendeley zip)
  or any *.csv files matching the DroneRF transposed format (2051 rows)
"""

import argparse, logging
from pathlib import Path
import numpy as np

logging.basicConfig(level="INFO", format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("rf-processor")


def features_from_psd(psd: np.ndarray) -> np.ndarray:
    """Extract 9 features from a 1-D power spectrum."""
    # Convert to dBm if values look like linear power (all non-negative)
    if psd.min() >= 0 and psd.max() > 0:
        psd = 10 * np.log10(psd + 1e-12)

    n        = len(psd)
    peak_idx = int(np.argmax(psd))
    peak_dbm = float(psd[peak_idx])
    mean_dbm = float(np.mean(psd))
    std_dbm  = float(np.std(psd))
    above_mean = peak_dbm - mean_dbm

    # -3 dB bandwidth (normalised)
    threshold = peak_dbm - 3.0
    bw_norm   = float((psd >= threshold).sum()) / n
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


def process_dronerf_csv(path: Path) -> tuple[np.ndarray, np.ndarray]:
    """
    Load a DroneRF-format CSV (rows = features+labels, columns = samples).
    Returns (X, y) where X is (N, 9) and y is (N,) binary label.
    """
    log.info("  Loading %s …", path.name)
    raw = np.loadtxt(path, delimiter=",")
    log.info("    Shape: %s", raw.shape)

    if raw.ndim != 2:
        log.warning("    Unexpected shape, skipping")
        return np.empty((0, 9), np.float32), np.empty(0, np.int8)

    nrows, ncols = raw.shape

    # ── Determine orientation ──────────────────────────────────────────────────
    # DroneRF original: (2051, N) — 2051 rows, N columns (samples)
    # Some re-exports may be transposed: (N, 2051)
    if nrows == 2051:
        # Standard orientation: rows are feature/label dims, columns are samples
        rf_data = raw[0:2047, :]        # (2047, N) — RF values
        label_1 = raw[2048, :].astype(int)  # (N,) — 0/1
    elif ncols == 2051:
        # Transposed orientation
        rf_data = raw[:, 0:2047].T      # (2047, N)
        label_1 = raw[:, 2048].astype(int)  # (N,)
    else:
        # Fallback: treat entire matrix as PSD rows, no label info → all drone
        log.warning("    Unexpected shape %s — treating all rows as drone samples", raw.shape)
        if nrows > ncols:
            rf_data = raw.T
        else:
            rf_data = raw
        label_1 = np.ones(rf_data.shape[1], dtype=int)

    n_samples = rf_data.shape[1]
    log.info("    Samples: %d  (drone=%d  background=%d)",
             n_samples, (label_1 == 1).sum(), (label_1 == 0).sum())

    # Extract features for each sample (each column is one sample)
    X_rows = []
    for i in range(n_samples):
        X_rows.append(features_from_psd(rf_data[:, i]))

    X = np.vstack(X_rows).astype(np.float32)
    y = label_1.astype(np.int8)
    return X, y


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", required=True, help="Directory containing DroneRF CSV files")
    ap.add_argument("--out",      required=True, help="Output .npz file for features")
    args = ap.parse_args()

    data_dir = Path(args.data_dir)
    Xs, ys   = [], []

    # Find all CSV files (recursively — handles DroneRF/RF_Data.csv subfolder)
    csv_files = sorted(data_dir.rglob("*.csv"))
    if not csv_files:
        log.error("No CSV files found in %s", data_dir)
        import sys; sys.exit(1)

    log.info("Found %d CSV file(s) in %s", len(csv_files), data_dir)

    for csv_path in csv_files:
        # Skip features.npz or other sidecar files
        if csv_path.suffix.lower() != ".csv":
            continue
        try:
            X, y = process_dronerf_csv(csv_path)
            if len(X):
                Xs.append(X); ys.append(y)
        except Exception as exc:
            log.warning("  Failed to process %s: %s", csv_path.name, exc)

    if not Xs:
        log.error("No data processed. Check that data-dir contains DroneRF CSV files.")
        import sys; sys.exit(1)

    X_all = np.vstack(Xs)
    y_all = np.concatenate(ys)
    log.info("Total: %d samples | drone=%d  background=%d",
             len(y_all), (y_all == 1).sum(), (y_all == 0).sum())

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(out, X=X_all, y=y_all)
    log.info("Features saved → %s", out)


if __name__ == "__main__":
    main()
