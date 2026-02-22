"""
Match bird species in the database against BirdNET's species list.

Usage:
    ./dev-run list_birdnet_species.py
"""

import logging
import sys
from pathlib import Path

import birdnet

sys.path.insert(0, str(Path(__file__).parent.parent))

from database.connection import get_db_cursor

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def main():
    logger.info("Loading BirdNET model...")
    model = birdnet.load("acoustic", "2.4", "tf")

    # Build lookup of scientific names from BirdNET
    # Format is "Scientific Name_Common Name"
    birdnet_scientific_names = {}
    for species in model.species_list:
        scientific, common = species.split("_", 1)
        birdnet_scientific_names[scientific.lower()] = species

    logger.info(f"BirdNET has {len(birdnet_scientific_names)} species")

    with get_db_cursor() as cursor:
        cursor.execute(
            "SELECT id, name, scientific_name FROM species WHERE type = 'bird' ORDER BY name"
        )
        db_birds = cursor.fetchall()

    logger.info(f"Database has {len(db_birds)} bird species")
    logger.info("-" * 60)

    matched = []
    unmatched = []

    for bird_id, name, scientific_name in db_birds:
        if not scientific_name:
            logger.warning(f"NO SCIENTIFIC NAME: {name} (id={bird_id})")
            unmatched.append((bird_id, name, scientific_name))
            continue

        key = scientific_name.lower()
        if key in birdnet_scientific_names:
            birdnet_name = birdnet_scientific_names[key]
            logger.info(f"MATCH: {name} ({scientific_name}) -> {birdnet_name}")
            matched.append((bird_id, name, scientific_name, birdnet_name))
        else:
            logger.warning(f"NO MATCH: {name} ({scientific_name})")
            unmatched.append((bird_id, name, scientific_name))

    logger.info("-" * 60)
    logger.info(f"Matched: {len(matched)}/{len(db_birds)}")
    logger.info(f"Unmatched: {len(unmatched)}/{len(db_birds)}")


if __name__ == "__main__":
    main()
