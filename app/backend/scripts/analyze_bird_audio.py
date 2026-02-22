"""
Analyze audio files for bird species using BirdNET.

Usage:
    ./dev-run analyze_bird_audio.py
    ./dev-run analyze_bird_audio.py --all-species
"""

import argparse
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from services.bird_audio import Detection, analyze_file, get_location_species

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

LATITUDE = 51.3452
LONGITUDE = 2.2525
AUDIO_DIR = Path(__file__).parent / "data" / "audio_recordings"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--all-species", action="store_true")
    parser.add_argument("--lat", type=float, default=LATITUDE)
    parser.add_argument("--lon", type=float, default=LONGITUDE)
    args = parser.parse_args()

    audio_files = sorted(AUDIO_DIR.glob("*.wav"))
    if not audio_files:
        logger.error(f"No .wav files found in {AUDIO_DIR}")
        sys.exit(1)

    species_list = None if args.all_species else get_location_species(args.lat, args.lon)

    all_detections: list[Detection] = []
    for file in audio_files:
        all_detections.extend(analyze_file(file, species_list, show_progress=True))

    logger.info(f"Found {len(all_detections)} detections:")
    for d in all_detections:
        logger.info(f"  {d}")


if __name__ == "__main__":
    main()
