#!/usr/bin/env python3
"""
SkyGuard RF Fingerprinting — DroneRF Extractor
===============================================
Extracts a manually downloaded DroneRF zip (from IEEE DataPort) and
organises the CSV files into a flat dataset directory with .label sidecars
ready for process_datasets.py.

IEEE DataPort: https://ieee-dataport.org/open-access/dronerf
  → Free account required → Download the full zip (~2 GB)
  → Upload to server:  scp DroneRF.zip tmm@192.168.100.224:~/skyguard/hardware/rf-fingerprinting/

Usage:
  python3 extract_dronerf.py --zip DroneRF.zip --out datasets/

DroneRF folder structure inside the zip (any nesting is supported):
  Background/           → label: background
  DJI Phantom*/         → label: drone
  Parrot Bebop*/        → label: drone
  AR.Drone*/            → label: drone
  Mavic*/               → label: drone
  (any other folder)    → label: drone  (conservative: flag as drone)
"""

import argparse, logging, re, shutil, zipfile
from pathlib import Path

logging.basicConfig(level="INFO", format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("dronerf-extractor")

# Folder-name → label rules (lower-case match, first hit wins)
FOLDER_RULES = [
    (re.compile(r"background|bg_|noise|no.drone", re.I), "background"),
    (re.compile(r"phantom|bebop|ardrone|ar.drone|mavic|drone|uav|dji|parrot", re.I), "drone"),
]

def classify_folder(name: str) -> str:
    for pattern, label in FOLDER_RULES:
        if pattern.search(name):
            return label
    return "drone"   # unknown folder → treat as drone (safe default)

def extract(zip_path: Path, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    counters: dict[str, int] = {}

    with zipfile.ZipFile(zip_path, "r") as zf:
        members = zf.namelist()
        csv_members = [m for m in members if m.lower().endswith(".csv")]
        log.info("Found %d CSV files inside the zip", len(csv_members))

        if not csv_members:
            log.error("No .csv files found in %s — is this the right zip?", zip_path.name)
            raise SystemExit(1)

        for member in csv_members:
            parts = Path(member).parts          # ('DroneRF', 'Background', 'BG_01.csv')
            filename = parts[-1]

            # Determine label from the parent folder(s)
            label = "drone"
            for part in parts[:-1]:             # walk all parent dirs
                candidate = classify_folder(part)
                if candidate == "background":   # background wins if any parent says so
                    label = "background"
                    break
                label = candidate               # last folder wins otherwise

            # Unique output filename: prepend folder hierarchy to avoid collisions
            safe_prefix = "__".join(
                re.sub(r"[^a-zA-Z0-9._-]", "_", p) for p in parts[:-1]
            ) if len(parts) > 1 else "root"
            dest_stem = f"{safe_prefix}__{filename}"
            dest      = out / dest_stem

            # Skip if already extracted and non-empty
            if dest.exists() and dest.stat().st_size > 0:
                log.debug("  already extracted: %s", dest_stem)
            else:
                data = zf.read(member)
                if len(data) < 10:
                    log.warning("  skip empty member: %s", member)
                    continue
                dest.write_bytes(data)

            # Write .label sidecar
            (out / (dest_stem + ".label")).write_text(label)
            counters[label] = counters.get(label, 0) + 1
            log.info("  %-12s  %s", label, dest_stem[:70])

    log.info("")
    log.info("Extraction complete:")
    for label, count in sorted(counters.items()):
        log.info("  %-12s  %d files", label, count)
    log.info("Output directory: %s", out)

def main():
    ap = argparse.ArgumentParser(description="Extract DroneRF zip for SkyGuard pipeline")
    ap.add_argument("--zip", required=True, help="Path to DroneRF.zip downloaded from IEEE DataPort")
    ap.add_argument("--out", required=True, help="Output directory for extracted CSVs")
    args = ap.parse_args()

    zip_path = Path(args.zip)
    if not zip_path.exists():
        log.error("Zip file not found: %s", zip_path)
        raise SystemExit(1)

    log.info("Extracting %s (%.1f MB) …", zip_path.name, zip_path.stat().st_size / 1024 / 1024)
    extract(zip_path, Path(args.out))

if __name__ == "__main__":
    main()
