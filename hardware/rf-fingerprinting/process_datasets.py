#!/usr/bin/env python3
"""
SkyGuard RF Fingerprinting — Dataset Processor
===============================================
Converts extracted DroneRF CSV files into a unified feature matrix.

Expected input (output of extract_dronerf.py):
  datasets/extracted/
    Phantom_drone/RF_Data_11000_L1/
      some_file.csv          ← rows of RF amplitude values
      some_file.csv.label    ← "drone" or "background"
    Background_RF_activites/...
      ...

Each CSV row = one RF sweep/snapshot = one sample.
Features extracted per sample (9 total, matching bridge.py real-time):
  peak_dbm, mean_dbm, std_dbm, bandwidth_3db, peak_norm_hz,
  above_mean_db, spectral_kurtosis, hour_sin=0, hour_cos=0

Usage:
  python3 process_datasets.py --data-dir datasets/extracted --out datasets/features.npz
"""

import argparse, csv, logging
from pathlib import Path
import numpy as np

logging.basicConfig(level="INFO", format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("rf-processor")

LABEL_MAP = {"drone": 1, "background": 0, "wifi": 0, "other": 0}


def features_from_psd(psd: np.ndarray) -> np.ndarray:
    """Extract 9 features from a 1-D power spectrum."""
    if len(psd) < 4:
        return None

    # Convert to dBm if values look like linear power (all non-negative)
    if psd.min() >= 0 and psd.max() > 1.0:
        psd = 10 * np.log10(psd + 1e-12)

    n         = len(psd)
    peak_idx  = int(np.argmax(psd))
    peak_dbm  = float(psd[peak_idx])
    mean_dbm  = float(np.mean(psd))
    std_dbm   = float(np.std(psd))
    above_mean = peak_dbm - mean_dbm

    threshold = peak_dbm - 3.0
    bw_norm   = float((psd >= threshold).sum()) / n
    peak_norm = float(peak_idx) / n

    try:
        from scipy.stats import kurtosis
        spec_kurt = float(kurtosis(psd))
    except Exception:
        spec_kurt = 0.0

    return np.array([peak_dbm, mean_dbm, std_dbm, bw_norm,
                     peak_norm, above_mean, spec_kurt, 0.0, 0.0],
                    dtype=np.float32)


def process_csv(csv_path: Path, label: int) -> tuple[np.ndarray, np.ndarray]:
    """Load a DroneRF CSV (rows = RF snapshots). Return (X, y)."""
    rows = []
    with open(csv_path, newline="") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                vals = [float(v) for v in line.split(",") if v.strip()]
                if len(vals) < 4:
                    continue
                feat = features_from_psd(np.array(vals, dtype=np.float32))
                if feat is not None:
                    rows.append(feat)
            except ValueError:
                continue

    if not rows:
        log.warning("  %s — no valid rows", csv_path.name)
        return np.empty((0, 9), np.float32), np.empty(0, np.int8)

    X = np.vstack(rows).astype(np.float32)
    y = np.full(len(X), label, dtype=np.int8)
    log.info("  %-12s  %s  → %d samples",
             "drone" if label else "background", csv_path.name, len(X))
    return X, y


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", required=True,
                    help="Directory with extracted CSVs and .label sidecars")
    ap.add_argument("--out", required=True,
                    help="Output .npz path for feature matrix")
    args = ap.parse_args()

    data_dir = Path(args.data_dir)
    Xs, ys   = [], []

    # Find all .label sidecars recursively
    label_files = sorted(data_dir.rglob("*.label"))
    if not label_files:
        log.error("No .label files found in %s — run extract_dronerf.py first", data_dir)
        import sys; sys.exit(1)

    log.info("Found %d labelled CSV files", len(label_files))

    for lf in label_files:
        csv_path  = lf.with_suffix("")          # remove .label → original filename
        label_str = lf.read_text().strip()
        label_int = LABEL_MAP.get(label_str, 0)

        if not csv_path.exists():
            log.warning("  CSV missing for label: %s", lf)
            continue

        try:
            X, y = process_csv(csv_path, label_int)
            if len(X):
                Xs.append(X); ys.append(y)
        except Exception as exc:
            log.warning("  Failed: %s — %s", csv_path.name, exc)

    if not Xs:
        log.error("No data processed.")
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
