"""
Analyze audio files for bird species using BirdNET.

Usage:
    ./dev-run analyze_bird_audio.py scripts/data/recording.wav
    ./dev-run analyze_bird_audio.py --all-species scripts/data/recording.wav
"""

import argparse
import logging
import sys
from dataclasses import dataclass
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

    def __str__(self) -> str:
        start_fmt = f"{int(self.start // 60):02d}:{int(self.start % 60):02d}"
        end_fmt = f"{int(self.end // 60):02d}:{int(self.end % 60):02d}"
        return f"[{start_fmt} - {end_fmt}] {self.species} ({self.confidence:.1%})"


def get_location_species(lat: float, lon: float) -> list[str]:
    logger.info(f"Loading species for location ({lat}, {lon})...")
    geo_model = birdnet.load("geo", "2.4", "tf")
    predictions = geo_model.predict(lat, lon, min_confidence=LOCATION_FILTER_THRESHOLD)
    species = list(predictions.to_set())
    logger.info(f"Found {len(species)} species for this location")
    return species


def analyze(file: Path, species_list: list[str] | None = None) -> list[Detection]:
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

    species_list = None if args.all_species else get_location_species(args.lat, args.lon)
    detections = analyze(args.file, species_list)

    if not detections:
        logger.info("No detections found")
        return

    logger.info(f"Found {len(detections)} detections:")
    for d in detections:
        logger.info(f"  {d}")


if __name__ == "__main__":
    main()
