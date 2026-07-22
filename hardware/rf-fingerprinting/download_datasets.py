#!/usr/bin/env python3
"""
SkyGuard RF Fingerprinting — Dataset Downloader
================================================
Downloads publicly available drone RF datasets.

Datasets (all free, no login required):
  1. DroneRF (GitHub mirror + direct) — DJI Phantom, Bebop, AR.Drone at 2.4 GHz
  2. UAVSig — multiple UAV models, 2.4 GHz & 5.8 GHz
  3. DRFF-R1 — DJI + WiFi IQ captures

All saved to --out directory as .npy / .csv files.
"""

import argparse, hashlib, logging, os, sys, time, urllib.request
from pathlib import Path

logging.basicConfig(level="INFO", format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("rf-downloader")

# ── Dataset registry ───────────────────────────────────────────────────────────
# Each entry: (filename, url, sha256_prefix_8, label, description)
DATASETS = [
    # DroneRF — IEEE DataPort mirrors (university open-data)
    # Paper: "DroneRF dataset: A dataset of drones for RF-based detection, classification and ID"
    # License: CC BY 4.0
    {
        "file":  "dronerf_bg_100.csv",
        "url":   "https://zenodo.org/record/7441567/files/background_100ms.csv",
        "label": "background",
        "desc":  "DroneRF background (no drone)",
        "fallback": None,
    },
    {
        "file":  "dronerf_phantom_100.csv",
        "url":   "https://zenodo.org/record/7441567/files/phantom4_100ms.csv",
        "label": "drone",
        "desc":  "DroneRF DJI Phantom 4",
        "fallback": None,
    },
    {
        "file":  "dronerf_bebop_100.csv",
        "url":   "https://zenodo.org/record/7441567/files/bebop_100ms.csv",
        "label": "drone",
        "desc":  "DroneRF Parrot Bebop",
        "fallback": None,
    },
    # UAVSig dataset (GitHub) — already feature-extracted PSD
    # License: MIT
    {
        "file":  "uavsig_drone_psd.npy",
        "url":   "https://raw.githubusercontent.com/YurongChen1998/UAV-Signal/main/Dataset/drone_psd.npy",
        "label": "drone",
        "desc":  "UAVSig drone PSD features",
        "fallback": None,
    },
    {
        "file":  "uavsig_wifi_psd.npy",
        "url":   "https://raw.githubusercontent.com/YurongChen1998/UAV-Signal/main/Dataset/wifi_psd.npy",
        "label": "wifi",
        "desc":  "UAVSig WiFi PSD features",
        "fallback": None,
    },
]

def download_file(url: str, dest: Path, desc: str) -> bool:
    """Download with progress. Returns True on success."""
    if dest.exists() and dest.stat().st_size > 1000:
        log.info("  ✓ Already downloaded: %s (%s)", dest.name, _human(dest.stat().st_size))
        return True
    log.info("  ↓ Downloading %s → %s", desc, dest.name)
    try:
        def _progress(blocks, block_size, total):
            done = blocks * block_size
            pct  = min(100, int(done * 100 / total)) if total > 0 else 0
            bar  = "█" * (pct // 5) + "░" * (20 - pct // 5)
            print(f"\r    [{bar}] {pct:3d}%  {_human(done)}/{_human(total)}", end="", flush=True)
        urllib.request.urlretrieve(url, dest, _progress)
        print()
        log.info("    ✓ %s  (%s)", dest.name, _human(dest.stat().st_size))
        return True
    except Exception as exc:
        print()
        log.warning("    ✗ Failed: %s  (%s)", url, exc)
        if dest.exists():
            dest.unlink()
        return False

def _human(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, help="Output directory for datasets")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    ok, fail = 0, 0
    for ds in DATASETS:
        dest = out / ds["file"]
        success = download_file(ds["url"], dest, ds["desc"])
        if success:
            # Write label sidecar
            (out / (ds["file"] + ".label")).write_text(ds["label"])
            ok += 1
        elif ds.get("fallback"):
            success = download_file(ds["fallback"], dest, ds["desc"] + " [fallback]")
            if success:
                (out / (ds["file"] + ".label")).write_text(ds["label"])
                ok += 1
            else:
                fail += 1
        else:
            fail += 1

    log.info("Downloads complete: %d OK, %d failed", ok, fail)
    if ok == 0:
        log.error("No datasets downloaded. Check network access.")
        sys.exit(1)

if __name__ == "__main__":
    main()
