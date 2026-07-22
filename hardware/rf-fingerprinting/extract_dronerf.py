#!/usr/bin/env python3
"""
SkyGuard RF Fingerprinting — DroneRF Extractor
===============================================
Extracts the DroneRF dataset (Mendeley Data, Al-Sa'd et al. 2019).

Real structure on disk after scp:
  datasets/DroneRF/
    Phantom drone/        → RF Data_11000_L1.rar, RF Data_11000_L2.rar, RF Data_11000_H.rar
    AR drone/             → ...
    Bepop drone/          → ...
    Background RF activites/ → ...

Each .rar contains CSV files of RF amplitude samples.
Labels come from the folder name, NOT from rows inside the CSV.

Requirements: unrar or 7z on PATH
  sudo apt install unrar   OR   sudo apt install p7zip-full

Usage:
  python3 extract_dronerf.py --data-dir datasets/DroneRF --out datasets/extracted/
"""

import argparse, logging, re, subprocess, shutil
from pathlib import Path

logging.basicConfig(level="INFO", format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("dronerf-extractor")

# Folder name → label
LABEL_RULES = [
    (re.compile(r"background|bg_|noise|no.drone", re.I), "background"),
    (re.compile(r"phantom|bebop|bepop|ardrone|ar.drone|ar drone|mavic|drone|uav|dji|parrot", re.I), "drone"),
]

def classify_folder(name: str) -> str:
    for pattern, label in LABEL_RULES:
        if pattern.search(name):
            return label
    return "drone"  # unknown → conservative

def find_extractor() -> str:
    for cmd in ("unrar", "7z", "unar"):
        if shutil.which(cmd):
            return cmd
    return None

def extract_rar(rar_path: Path, out_dir: Path, extractor: str) -> list[Path]:
    """Extract a .rar file, return list of extracted CSV paths."""
    out_dir.mkdir(parents=True, exist_ok=True)
    if extractor == "unrar":
        cmd = ["unrar", "e", "-y", str(rar_path), str(out_dir) + "/"]
    elif extractor == "7z":
        cmd = ["7z", "e", str(rar_path), f"-o{out_dir}", "-y"]
    elif extractor == "unar":
        cmd = ["unar", "-o", str(out_dir), "-f", str(rar_path)]
    else:
        raise RuntimeError("No RAR extractor found. Run: sudo apt install unrar")

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        log.warning("  Extractor error: %s", result.stderr[:200])

    return list(out_dir.glob("*.csv"))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", required=True,
                    help="Path to DroneRF folder (contains 'Phantom drone/', 'AR drone/', etc.)")
    ap.add_argument("--out", required=True,
                    help="Output directory for extracted + labelled CSV files")
    args = ap.parse_args()

    data_dir = Path(args.data_dir)
    out_root = Path(args.out)
    out_root.mkdir(parents=True, exist_ok=True)

    extractor = find_extractor()
    if not extractor:
        log.error("No RAR extractor found. Install one:")
        log.error("  sudo apt install unrar   OR   sudo apt install p7zip-full")
        raise SystemExit(1)
    log.info("Using extractor: %s", extractor)

    totals = {"drone": 0, "background": 0}

    # Walk top-level folders (each = one drone type or background)
    drone_folders = [f for f in sorted(data_dir.iterdir()) if f.is_dir()]
    if not drone_folders:
        log.error("No subfolders found in %s", data_dir)
        raise SystemExit(1)

    for folder in drone_folders:
        label = classify_folder(folder.name)
        log.info("Folder: %-30s → label: %s", folder.name, label)

        rar_files = sorted(folder.glob("*.rar"))
        if not rar_files:
            log.warning("  No .rar files in %s", folder.name)
            continue

        for rar in rar_files:
            safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", folder.name)
            rar_out   = out_root / safe_name / rar.stem
            rar_out.mkdir(parents=True, exist_ok=True)

            # Skip if already extracted
            existing = list(rar_out.glob("*.csv"))
            if existing:
                log.info("  ✓ Already extracted: %s (%d CSV files)", rar.name, len(existing))
                csv_files = existing
            else:
                log.info("  ↓ Extracting: %s", rar.name)
                csv_files = extract_rar(rar, rar_out, extractor)

            for csv in csv_files:
                # Write label sidecar next to each CSV
                (rar_out / (csv.name + ".label")).write_text(label)
                log.info("    %-12s  %s", label, csv.name)
                totals[label] = totals.get(label, 0) + 1

    log.info("")
    log.info("Extraction complete:")
    for label, count in sorted(totals.items()):
        log.info("  %-12s  %d CSV files", label, count)
    log.info("Output: %s", out_root)

if __name__ == "__main__":
    main()
