"""
SkyGuard RF Fingerprinting — Inference Module
=============================================
Loaded optionally by bridge.py if rf_model.joblib exists next to this file.
Returns "drone", "wifi", or None (model not loaded).

Features must match process_datasets.py exactly:
  [peak_dbm, mean_dbm, std_dbm, bw_norm, peak_norm, above_mean, spec_kurt, 0, 0]
"""

from __future__ import annotations
import logging
from pathlib import Path
import numpy as np

log = logging.getLogger("rf-classifier")

MODEL_PATH = Path(__file__).parent / "rf_model.joblib"

_model = None

def load_model() -> bool:
    global _model
    if not MODEL_PATH.exists():
        log.info("No RF fingerprinting model found at %s — running without it", MODEL_PATH)
        return False
    try:
        import joblib
        _model = joblib.load(MODEL_PATH)
        log.info("RF fingerprinting model loaded from %s", MODEL_PATH)
        return True
    except Exception as exc:
        log.warning("Could not load RF model: %s", exc)
        return False

def _features_from_band_bins(band_bins: list[dict]) -> np.ndarray:
    """
    band_bins: list of {"hz": float, "dbm": float} already filtered to this band.
    Extracts the same 9 features as process_datasets.py.
    """
    if not band_bins:
        return None
    dbm_vals = np.array([b["dbm"] for b in band_bins], dtype=np.float32)
    hz_vals  = np.array([b["hz"]  for b in band_bins], dtype=np.float32)

    peak_idx  = int(np.argmax(dbm_vals))
    peak_dbm  = float(dbm_vals[peak_idx])
    mean_dbm  = float(np.mean(dbm_vals))
    std_dbm   = float(np.std(dbm_vals))
    above_mean = peak_dbm - mean_dbm

    # -3 dB bandwidth (fraction of bins above peak − 3 dB)
    threshold = peak_dbm - 3.0
    bw_norm   = float((dbm_vals >= threshold).sum()) / len(dbm_vals)

    # Peak frequency normalised within the observed range
    hz_range  = float(hz_vals[-1] - hz_vals[0]) if len(hz_vals) > 1 else 1.0
    peak_norm = float(hz_vals[peak_idx] - hz_vals[0]) / max(hz_range, 1.0)

    # Spectral kurtosis
    try:
        from scipy.stats import kurtosis
        spec_kurt = float(kurtosis(dbm_vals))
    except Exception:
        mu = mean_dbm
        sd = std_dbm if std_dbm > 0 else 1e-6
        spec_kurt = float(np.mean(((dbm_vals - mu) / sd) ** 4)) - 3.0

    return np.array([[peak_dbm, mean_dbm, std_dbm, bw_norm,
                      peak_norm, above_mean, spec_kurt, 0.0, 0.0]],
                    dtype=np.float32)

def classify_band(band_bins: list[dict]) -> str | None:
    """
    band_bins: list of {"hz": float, "dbm": float} for one frequency band.
    Returns 'drone', 'wifi', or None if model not loaded.
    """
    if _model is None:
        return None
    feats = _features_from_band_bins(band_bins)
    if feats is None:
        return None
    try:
        label_int = int(_model.predict(feats)[0])
        return "drone" if label_int == 1 else "wifi"
    except Exception as exc:
        log.warning("Classify error: %s", exc)
        return None
