"""
Analyze audio files for bird species using BirdNET.

Usage:
    ./dev-run analyze_bird_audio.py scripts/data/recording.wav
    ./dev-run analyze_bird_audio.py --all-species scripts/data/recording.wav
"""

import argparse
import logging
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import birdnet

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Heal Somerset location
LATITUDE = 51.3452
LONGITUDE = 2.2525
LOCATION_FILTER_THRESHOLD = 0.03
MIN_CONFIDENCE = 0.25


@dataclass
class Detection:
    start: float
    end: float
    species: str
    confidence: float
    timestamp: datetime

    def __str__(self) -> str:
        ts_fmt = self.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        return f"[{ts_fmt}] {self.species} ({self.confidence:.1%})"


def extract_recording_timestamp(file: Path) -> datetime:
    """Extract recording timestamp from filename pattern like 2MM24020_20260219_071202.wav"""
    match = re.search(r"(\d{8})_(\d{6})", file.name)
    if not match:
        raise ValueError(f"Could not extract timestamp from filename: {file.name}")
    date_str, time_str = match.groups()
    return datetime.strptime(f"{date_str}_{time_str}", "%Y%m%d_%H%M%S")


def get_location_species(lat: float, lon: float) -> list[str]:
    logger.info(f"Loading species for location ({lat}, {lon})...")
    geo_model = birdnet.load("geo", "2.4", "tf")
    predictions = geo_model.predict(lat, lon, min_confidence=LOCATION_FILTER_THRESHOLD)
    species = list(predictions.to_set())
    logger.info(f"Found {len(species)} species for this location")
    return species


def analyze(
    file: Path, recording_time: datetime, species_list: list[str] | None = None
) -> list[Detection]:
    logger.info(f"Analyzing: {file}")
    model = birdnet.load("acoustic", "2.4", "tf")

    predictions = model.predict(
        file,
        top_k=None,
        sigmoid_sensitivity=1.0,
        default_confidence_threshold=MIN_CONFIDENCE,
        custom_species_list=species_list,
        show_stats="progress",
    )

    results = predictions.to_structured_array()
    return [
        Detection(
            start=float(r["start_time"]),
            end=float(r["end_time"]),
            species=str(r["species_name"]),
            confidence=float(r["confidence"]),
            timestamp=recording_time + timedelta(seconds=float(r["start_time"])),
        )
        for r in results
    ]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", type=Path)
    parser.add_argument("--all-species", action="store_true")
    parser.add_argument("--lat", type=float, default=LATITUDE)
    parser.add_argument("--lon", type=float, default=LONGITUDE)
    args = parser.parse_args()

    if not args.file.exists():
        logger.error(f"File not found: {args.file}")
        sys.exit(1)

    try:
        recording_time = extract_recording_timestamp(args.file)
        logger.info(f"Recording timestamp: {recording_time}")
    except ValueError as e:
        logger.error(str(e))
        sys.exit(1)

    species_list = None if args.all_species else get_location_species(args.lat, args.lon)
    detections = analyze(args.file, recording_time, species_list)

    if not detections:
        logger.info("No detections found")
        return

    logger.info(f"Found {len(detections)} detections:")
    for d in detections:
        logger.info(f"  {d}")


if __name__ == "__main__":
    main()
