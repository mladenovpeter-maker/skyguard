#!/usr/bin/env python3
"""
SkyGuard RF Fingerprinting — DroneRF Extractor
===============================================
Extracts the DroneRF zip (Mendeley Data, Al-Sa'd et al. 2019) into the
datasets/ directory, ready for process_datasets.py.

The zip contains a single RF_Data.csv with labels embedded in the last 3 rows:
  - Row 2048: Label 1 — detection (0 = background, 1 = drone)
  - Row 2049: Label 2 — identification (which drone)
  - Row 2050: Label 3 — mode (off/on/hovering/flying/etc.)

No label sidecar files needed — process_datasets.py reads labels from the CSV.

Dataset: https://data.mendeley.com/datasets/f4c2b4n755/1
DOI:     10.17632/f4c2b4n755.1
License: CC BY 4.0

Usage:
  python3 extract_dronerf.py --zip DroneRF.zip --out datasets/
"""

import argparse, logging, zipfile
from pathlib import Path

logging.basicConfig(level="INFO", format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("dronerf-extractor")


def extract(zip_path: Path, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(zip_path, "r") as zf:
        members  = zf.namelist()
        csv_members = [m for m in members if m.lower().endswith(".csv")]
        log.info("Found %d CSV file(s) inside %s", len(csv_members), zip_path.name)

        if not csv_members:
            log.error("No .csv files in the zip. Is this the right DroneRF archive?")
            raise SystemExit(1)

        for member in csv_members:
            # Flatten path — keep only the filename, drop any folder hierarchy
            filename = Path(member).name
            dest     = out / filename

            if dest.exists() and dest.stat().st_size > 1000:
                log.info("  ✓ Already extracted: %s (%.1f MB)",
                         filename, dest.stat().st_size / 1024 / 1024)
                continue

            log.info("  ↓ Extracting %s …", member)
            data = zf.read(member)
            if len(data) < 100:
                log.warning("  skip tiny member: %s (%d bytes)", member, len(data))
                continue

            dest.write_bytes(data)
            log.info("    ✓ %s  (%.1f MB)", filename, len(data) / 1024 / 1024)

    csv_files = list(out.glob("*.csv"))
    log.info("")
    log.info("Extraction complete — %d CSV file(s) in %s", len(csv_files), out)
    for f in csv_files:
        log.info("  %s  (%.1f MB)", f.name, f.stat().st_size / 1024 / 1024)


def main():
    ap = argparse.ArgumentParser(
        description="Extract DroneRF zip for the SkyGuard RF fingerprinting pipeline")
    ap.add_argument("--zip", required=True,
                    help="Path to DroneRF zip downloaded from Mendeley Data")
    ap.add_argument("--out", required=True,
                    help="Output directory for extracted CSV files")
    args = ap.parse_args()

    zip_path = Path(args.zip)
    if not zip_path.exists():
        log.error("Zip file not found: %s", zip_path)
        raise SystemExit(1)

    log.info("Extracting %s (%.1f MB) …",
             zip_path.name, zip_path.stat().st_size / 1024 / 1024)
    extract(zip_path, Path(args.out))


if __name__ == "__main__":
    main()
