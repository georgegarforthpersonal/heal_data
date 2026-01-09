#!/usr/bin/env python3
"""
Delete and reimport butterfly survey data.

This script:
1. Deletes all surveys that have butterfly sightings OR are of type "Butterfly"
2. Reimports butterfly transect data from CSV files

Usage:
    ./staging-run reimport_butterflies.py                     # Dry-run (preview only)
    ./staging-run reimport_butterflies.py --no-dry-run --yes  # Apply to database

Defaults to dry-run mode. Use --no-dry-run to write to database.
Use --yes to skip the confirmation prompt.
"""

import csv
import re
import logging
import sys
import os
from datetime import datetime, time, date
from decimal import Decimal
from typing import Dict, List, Tuple, Optional
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.connection import get_db_cursor
from script_utils import get_arg_parser

logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)

# Safety check: NEVER allow this script to run against production
if os.getenv('ENV', '').lower() == 'production':
    logger.error("This script cannot run against production database!")
    logger.error("reimport_butterflies.py must ONLY be run against staging/dev database")
    logger.error(f"Current ENV: {os.getenv('ENV')}")
    sys.exit(1)

SURVEY_TYPE_NAME = "Butterfly"

# Number word to digit mapping
NUMBER_WORDS = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14,
    'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18,
    'nineteen': 19, 'twenty': 20, 'twentyone': 21, 'twentytwo': 22,
    'twentythree': 23, 'twentyfour': 24, 'twentyfive': 25,
    'twentysix': 26, 'twentyseven': 27, 'twentyeight': 28,
    'twentynine': 29, 'thirty': 30, 'thirtyone': 31, 'thirtytwo': 32,
    'thirtythree': 33, 'thirtyfour': 34, 'thirtyfive': 35,
    'forty': 40, 'fortyone': 41, 'fortytwo': 42, 'fortythree': 43,
    'fortyfour': 44, 'fortyfive': 45, 'fortysix': 46, 'fortyseven': 47,
    'seventyone': 71
}


# =============================================================================
# DELETION FUNCTIONS
# =============================================================================

def find_butterfly_surveys(cursor) -> list[dict]:
    """
    Find all surveys that:
    - Have at least one butterfly sighting, OR
    - Are of survey_type "Butterfly"
    Returns list of dicts with survey info.
    """
    # Get butterfly survey type ID
    cursor.execute("SELECT id FROM survey_type WHERE name = %s", (SURVEY_TYPE_NAME,))
    row = cursor.fetchone()
    survey_type_id = row[0] if row else None

    # Find surveys with butterfly sightings
    cursor.execute("""
        SELECT DISTINCT
            survey.id,
            survey.date,
            COUNT(s.id) as sighting_count
        FROM survey
        JOIN sighting s ON survey.id = s.survey_id
        JOIN species s2 ON s2.id = s.species_id
        WHERE s2.type = 'butterfly'
        GROUP BY survey.id, survey.date
    """)
    sighting_surveys = {row[0]: {'id': row[0], 'date': row[1], 'sighting_count': row[2], 'source': 'sightings'}
                        for row in cursor.fetchall()}

    # Find surveys of type "Butterfly"
    if survey_type_id:
        cursor.execute("""
            SELECT survey.id, survey.date,
                   (SELECT COUNT(*) FROM sighting WHERE survey_id = survey.id) as sighting_count
            FROM survey
            WHERE survey.survey_type_id = %s
        """, (survey_type_id,))
        for row in cursor.fetchall():
            if row[0] not in sighting_surveys:
                sighting_surveys[row[0]] = {'id': row[0], 'date': row[1], 'sighting_count': row[2], 'source': 'survey_type'}

    # Sort by date descending
    surveys = sorted(sighting_surveys.values(), key=lambda x: x['date'] or date.min, reverse=True)
    return surveys


def count_sightings_to_delete(cursor, survey_ids: list[int]) -> int:
    """Count total sightings that will be deleted for the given survey IDs."""
    if not survey_ids:
        return 0
    cursor.execute("SELECT COUNT(*) FROM sighting WHERE survey_id = ANY(%s)", (survey_ids,))
    return cursor.fetchone()[0]


def delete_sightings(cursor, survey_ids: list[int]) -> int:
    """Delete all sightings for the given survey IDs."""
    if not survey_ids:
        return 0
    cursor.execute("DELETE FROM sighting WHERE survey_id = ANY(%s)", (survey_ids,))
    return cursor.rowcount


def delete_survey_surveyors(cursor, survey_ids: list[int]) -> int:
    """Delete survey_surveyor links for the given survey IDs."""
    if not survey_ids:
        return 0
    cursor.execute("DELETE FROM survey_surveyor WHERE survey_id = ANY(%s)", (survey_ids,))
    return cursor.rowcount


def delete_surveys(cursor, survey_ids: list[int]) -> int:
    """Delete surveys by ID."""
    if not survey_ids:
        return 0
    cursor.execute("DELETE FROM survey WHERE id = ANY(%s)", (survey_ids,))
    return cursor.rowcount


# =============================================================================
# IMPORT FUNCTIONS (from populate_butterflies.py)
# =============================================================================

def setup_reference_data(cursor, dry_run: bool = True):
    """Set up surveyors, locations, and species (insert-only, no deletion)."""
    logger.info("Checking reference data...")

    # Check surveyors
    surveyors = [
        ('Mark', ''),
        ('Nicola', ''),
        ('P', ''),
        ('R', ''),
        ('C', '')
    ]
    surveyors_to_add = []
    for first_name, last_name in surveyors:
        cursor.execute(
            "SELECT id FROM surveyor WHERE first_name = %s AND last_name = %s",
            (first_name, last_name)
        )
        if not cursor.fetchone():
            surveyors_to_add.append((first_name, last_name))

    # Check locations
    locations = [
        (1, 'Brook'),
        (2, 'Field'),
        (3, 'Track'),
        (4, 'Marsh'),
        (5, 'Hedge')
    ]
    locations_to_add = []
    for number, name in locations:
        cursor.execute(
            "SELECT id FROM location WHERE number = %s AND type = 'butterfly'",
            (number,)
        )
        if not cursor.fetchone():
            locations_to_add.append((number, name))

    # Check species
    species_list = [
        'Brimstone', 'Comma', 'Common Blue', 'Gatekeeper', 'Green-veined White',
        'Holly Blue', 'Large Skipper', 'Large White', 'Marbled White', 'Meadow Brown',
        'Orange Tip', 'Painted Lady', 'Peacock', 'Red Admiral', 'Ringlet',
        'Small Copper', 'Small Heath', 'Small Skipper', 'Small Tortoiseshell',
        'Small White', 'Speckled Wood'
    ]
    species_to_add = []
    for species_name in species_list:
        cursor.execute(
            "SELECT id FROM species WHERE name = %s AND type = 'butterfly'",
            (species_name,)
        )
        if not cursor.fetchone():
            species_to_add.append(species_name)

    # Log what needs to be added
    if surveyors_to_add:
        logger.info(f"  Surveyors to add: {[s[0] for s in surveyors_to_add]}")
    if locations_to_add:
        logger.info(f"  Locations to add: {[f'{n}-{name}' for n, name in locations_to_add]}")
    if species_to_add:
        logger.info(f"  Species to add: {species_to_add}")

    if dry_run:
        logger.info(f"DRY RUN: Would add {len(surveyors_to_add)} surveyors, {len(locations_to_add)} locations, {len(species_to_add)} species")
        return

    # Actually insert the data
    for first_name, last_name in surveyors_to_add:
        cursor.execute(
            "INSERT INTO surveyor (first_name, last_name) VALUES (%s, %s)",
            (first_name, last_name)
        )

    for number, name in locations_to_add:
        cursor.execute(
            "INSERT INTO location (number, name, type) VALUES (%s, %s, 'butterfly')",
            (number, name)
        )

    for species_name in species_to_add:
        cursor.execute(
            "INSERT INTO species (name, type) VALUES (%s, %s)",
            (species_name, 'butterfly')
        )

    logger.info(f"Added {len(surveyors_to_add)} surveyors, {len(locations_to_add)} locations, {len(species_to_add)} species")


def parse_time(time_str: str) -> Optional[time]:
    """Parse time string in various formats."""
    if not time_str:
        return None
    try:
        if '.' in time_str:
            parts = time_str.split('.')
            hour = int(parts[0])
            minute_decimal = int(parts[1])
            if len(parts[1]) == 1:
                minute = minute_decimal * 6
            else:
                minute = minute_decimal
            if hour < 10 and time_str.startswith('2.'):
                hour = 14
            elif hour < 10 and time_str.startswith('3.'):
                hour = 15
            return time(hour, minute)
        else:
            hour = int(time_str)
            return time(hour, 0)
    except (ValueError, TypeError):
        return None


def parse_date(date_str: str) -> Optional[date]:
    """Parse date string in DD/MM/YYYY format."""
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, '%d/%m/%Y').date()
    except ValueError:
        return None


def normalize_species_name(species_name: str) -> str:
    """Normalize species names to handle variations and typos."""
    normalized = species_name.upper().strip()
    normalized = re.sub(r'\s*\(\d+\)\s*$', '', normalized)

    non_butterfly_patterns = [
        r'NB\s+VERY\s+BIG\s+FLOCK', r'GOLD\s+FINCHES', r'FINCHES',
        r'BIRD', r'^VERY\s+BIG', r'FLOCK'
    ]
    for pattern in non_butterfly_patterns:
        if re.search(pattern, normalized):
            return ""

    if re.match(r'^\(\d+\)$', normalized.strip()):
        return ""

    number_only_patterns = [r'^SEVEN\s+MEADOW\s+BROWN$', r'^SIX\s+MEADOW\s+BROWN$']
    for pattern in number_only_patterns:
        if re.match(pattern, normalized):
            return "Meadow Brown"

    exact_name_mappings = {
        'GREEN VEINED WHITE1': 'Green-veined White',
        'GREEN VEINED WHITE': 'Green-veined White',
        'GREENVEINED WHITE': 'Green-veined White',
        'GREEN-VEINED WHITE': 'Green-veined White',
        'WHITE (SMALL/GREEN VEINED)': 'Green-veined White',
        'WHITE': 'Green-veined White',
        'MEADOE BROWN': 'Meadow Brown',
        'MEAQDOW BROWN': 'Meadow Brown',
        'SPOTTED WOOD': 'Speckled Wood',
    }
    if normalized in exact_name_mappings:
        return exact_name_mappings[normalized]

    return normalized.title()


def parse_species_entry(entry: str) -> Tuple[str, int]:
    """Parse a single species entry to extract name and count."""
    entry = entry.rstrip(';:,.').strip()
    entry = ' '.join(entry.split())
    words = entry.split()
    if len(words) == 0:
        return "", 1

    def parse_hyphenated_number(word: str) -> Optional[int]:
        if '-' not in word:
            return None
        parts = word.lower().split('-')
        if len(parts) == 2:
            first, second = parts
            if first == "twenty" and second in ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]:
                return 20 + NUMBER_WORDS[second]
            elif first == "thirty" and second in ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]:
                return 30 + NUMBER_WORDS[second]
            elif first == "forty" and second in ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]:
                return 40 + NUMBER_WORDS[second]
        return None

    if len(words) >= 2:
        hyphen_count = parse_hyphenated_number(words[0])
        if hyphen_count:
            species_name = ' '.join(words[1:])
            return normalize_species_name(species_name), hyphen_count

    if len(words) >= 2:
        first_word = words[0].lower()
        if first_word in NUMBER_WORDS:
            count = NUMBER_WORDS[first_word]
            species_name = ' '.join(words[1:])
            return normalize_species_name(species_name), count
        if first_word.isdigit():
            count = int(first_word)
            species_name = ' '.join(words[1:])
            return normalize_species_name(species_name), count

    if len(words) >= 3:
        first_part = words[0].lower()
        second_part = words[1].lower()
        if first_part == "twenty" and second_part in ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]:
            count = 20 + NUMBER_WORDS[second_part]
            species_name = ' '.join(words[2:])
            return normalize_species_name(species_name), count
        elif first_part == "thirty" and second_part in ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]:
            count = 30 + NUMBER_WORDS[second_part]
            species_name = ' '.join(words[2:])
            return normalize_species_name(species_name), count
        elif first_part == "forty" and second_part in ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]:
            count = 40 + NUMBER_WORDS[second_part]
            species_name = ' '.join(words[2:])
            return normalize_species_name(species_name), count

    if len(words) >= 2:
        hyphen_count = parse_hyphenated_number(words[-1])
        if hyphen_count:
            species_name = ' '.join(words[:-1])
            return normalize_species_name(species_name), hyphen_count

    if len(words) >= 3:
        first_part = words[-2].lower()
        second_part = words[-1].lower()
        if first_part == "twenty" and second_part in ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]:
            count = 20 + NUMBER_WORDS[second_part]
            species_name = ' '.join(words[:-2])
            return normalize_species_name(species_name), count
        elif first_part == "thirty" and second_part in ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]:
            count = 30 + NUMBER_WORDS[second_part]
            species_name = ' '.join(words[:-2])
            return normalize_species_name(species_name), count
        elif first_part == "forty" and second_part in ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]:
            count = 40 + NUMBER_WORDS[second_part]
            species_name = ' '.join(words[:-2])
            return normalize_species_name(species_name), count

    if len(words) >= 2:
        last_word = words[-1].lower()
        if last_word in NUMBER_WORDS:
            count = NUMBER_WORDS[last_word]
            species_name = ' '.join(words[:-1])
            return normalize_species_name(species_name), count
        if last_word.isdigit():
            count = int(last_word)
            species_name = ' '.join(words[:-1])
            return normalize_species_name(species_name), count

    return normalize_species_name(entry), 1


def parse_butterflies_string(butterflies_str: str) -> List[Tuple[str, int, int]]:
    """Parse butterflies string to extract species, counts, and transect numbers."""
    if not butterflies_str:
        return []

    sightings = []
    clean_str = butterflies_str.strip().rstrip('.').strip()
    segments = re.split(r'[;:]|(?<=\))\.|\.(?=\s*[A-Z])|\.(?=\s*$)', clean_str)

    accumulated_species = []
    current_transect = 1

    for segment in segments:
        segment = segment.strip()
        if not segment:
            continue

        remaining_segment = segment

        while remaining_segment:
            transect_match = re.search(r'\((\d+)\)', remaining_segment)

            if transect_match:
                transect_num = int(transect_match.group(1))
                before_marker = remaining_segment[:transect_match.start()].strip()
                if before_marker:
                    species_in_segment = [s.strip() for s in before_marker.split(',') if s.strip()]
                    accumulated_species.extend(species_in_segment)

                for species_entry in accumulated_species:
                    if species_entry:
                        entry_upper = species_entry.upper().strip()
                        species_name, count = parse_species_entry(entry_upper)
                        if species_name:
                            sightings.append((species_name, count, transect_num))

                accumulated_species = []
                current_transect = transect_num
                remaining_segment = remaining_segment[transect_match.end():].strip()

                if remaining_segment.startswith(','):
                    remaining_segment = remaining_segment[1:].strip()
            else:
                if remaining_segment:
                    species_in_segment = [s.strip() for s in remaining_segment.split(',') if s.strip()]
                    accumulated_species.extend(species_in_segment)
                break

    for species_entry in accumulated_species:
        if species_entry:
            entry_upper = species_entry.upper().strip()
            species_name, count = parse_species_entry(entry_upper)
            if species_name:
                sightings.append((species_name, count, current_transect))

    return sightings


def import_csv_data(cursor, csv_file_path: str, year: str, survey_type_id: int,
                    surveyor_ids: dict, species_ids: dict, location_ids: dict) -> tuple[int, int]:
    """Import butterfly survey data from CSV."""
    # Read and parse CSV
    logger.info("Validating species in CSV...")
    missing_species = set()
    with open(csv_file_path, 'r', encoding='utf-8-sig') as file:
        for line in file:
            if line.startswith('Week beginning'):
                header = line.strip().split(',')
                reader = csv.DictReader(file, fieldnames=header)
                break
        else:
            logger.error(f"Could not find header row in {csv_file_path}")
            return (0, 0)
        rows = list(reader)

    # Validate species
    for row in rows:
        butterflies_str = row.get('Butterflies seen (with transect section number adjacent). State number of butterflies in writing to save confusion with transect section number.', '')
        sightings = parse_butterflies_string(butterflies_str)
        for species_name, _, _ in sightings:
            if species_name and species_name not in species_ids:
                missing_species.add(species_name)

    if missing_species:
        logger.error("Missing species in database:")
        for species in sorted(missing_species):
            logger.error(f"  - {species}")
        return (0, 0)

    # Process surveys
    logger.info(f"Processing surveys from {year} CSV...")
    surveys_added = 0
    sightings_added = 0

    for row in rows:
        date_str = row.get('Date of survey', '').strip()
        if not date_str:
            continue

        survey_date = parse_date(date_str)
        if not survey_date:
            continue

        start_time = parse_time(row.get('Start', ''))
        end_time = parse_time(row.get('Finish', ''))

        if not all([survey_date, start_time, end_time]):
            continue

        sun_str = row.get('Sun', '').strip()
        sun_percentage = None
        if sun_str:
            try:
                sun_percentage = int(sun_str.replace('%', '').strip())
            except ValueError:
                pass

        temp_str = (row.get('Temp©', '') or row.get('Temp', '')).strip()
        temperature = None
        if temp_str:
            try:
                if '/' in temp_str:
                    temp_str = temp_str.split('/')[0]
                temperature = Decimal(temp_str)
            except (ValueError, TypeError, Exception):
                pass

        conditions_str = row.get('Conditons met? (See details at foot of sheet)', '').strip().lower()
        conditions_met = conditions_str == 'yes'

        surveyor_str = (row.get('Surveyor N and/or R', '') or
                       row.get('Surveyor N and/or M', '')).strip()
        surveyor_codes = []
        if '&' in surveyor_str:
            surveyor_codes = [s.strip() for s in surveyor_str.split('&')]
        elif surveyor_str:
            surveyor_codes = [surveyor_str]

        butterflies_str = row.get('Butterflies seen (with transect section number adjacent). State number of butterflies in writing to save confusion with transect section number.', '')
        sightings = parse_butterflies_string(butterflies_str)

        # Insert survey
        cursor.execute("""
            INSERT INTO survey (date, start_time, end_time, sun_percentage,
                              temperature_celsius, conditions_met, notes, survey_type_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (survey_date, start_time, end_time, sun_percentage, temperature,
              conditions_met, None, survey_type_id))

        survey_id = cursor.fetchone()[0]
        surveys_added += 1

        # Link surveyors
        for code in surveyor_codes:
            surveyor_id = surveyor_ids.get(code)
            if surveyor_id:
                cursor.execute("""
                    INSERT INTO survey_surveyor (survey_id, surveyor_id)
                    VALUES (%s, %s)
                """, (survey_id, surveyor_id))

        # Insert sightings
        for species_name, count, location_num in sightings:
            if not species_name:
                continue
            species_id = species_ids.get(species_name)
            location_id = location_ids.get(location_num)
            if not species_id:
                logger.warning(f"  Species not found: {species_name}")
                continue
            if not location_id:
                logger.warning(f"  Location not found for transect section {location_num}")
            cursor.execute("""
                INSERT INTO sighting (survey_id, species_id, location_id, count)
                VALUES (%s, %s, %s, %s)
            """, (survey_id, species_id, location_id, count))
            sightings_added += 1

        logger.info(f"  Imported survey for {survey_date}")

    return (surveys_added, sightings_added)


# =============================================================================
# MAIN
# =============================================================================

def main():
    parser = get_arg_parser(description=__doc__)
    parser.add_argument(
        '--yes', '-y',
        action='store_true',
        help='Skip confirmation prompt'
    )
    args = parser.parse_args()

    mode = "DRY RUN" if args.dry_run else "LIVE"
    logger.info("=" * 80)
    logger.info(f"Butterfly Survey Reimport - {mode} MODE")
    logger.info("=" * 80)

    # Find CSV files
    script_dir = Path(__file__).parent
    data_dir = script_dir / "data"

    if not data_dir.exists():
        logger.error(f"Data directory not found: {data_dir}")
        sys.exit(1)

    csv_files = [
        ("2024", data_dir / "Heal Butterfly transect 2024.csv"),
        ("2025", data_dir / "Heal Butterfly transect 2025.csv")
    ]

    existing_files = [(year, path) for year, path in csv_files if path.exists()]
    if not existing_files:
        logger.error("No CSV files found!")
        sys.exit(1)

    logger.info(f"Found {len(existing_files)} CSV file(s): {[y for y, _ in existing_files]}")

    with get_db_cursor() as cursor:
        # =================================================================
        # STEP 1: Find existing butterfly surveys to delete
        # =================================================================
        logger.info("\n" + "=" * 80)
        logger.info("STEP 1: Finding existing butterfly surveys...")
        logger.info("=" * 80)

        surveys = find_butterfly_surveys(cursor)

        if surveys:
            survey_ids = [s['id'] for s in surveys]
            total_sightings = count_sightings_to_delete(cursor, survey_ids)

            logger.info(f"\nFound {len(surveys)} butterfly surveys to delete:")
            for survey in surveys[:10]:
                logger.info(f"  Survey {survey['id']}: {survey['date']} ({survey['sighting_count']} sightings)")
            if len(surveys) > 10:
                logger.info(f"  ... and {len(surveys) - 10} more")

            logger.info(f"\nTotal surveys to delete: {len(surveys)}")
            logger.info(f"Total sightings to delete: {total_sightings}")
        else:
            survey_ids = []
            total_sightings = 0
            logger.info("No existing butterfly surveys found.")

        # =================================================================
        # STEP 2: Preview import
        # =================================================================
        logger.info("\n" + "=" * 80)
        logger.info("STEP 2: Analyzing CSV files for import...")
        logger.info("=" * 80)

        setup_reference_data(cursor, dry_run=True)

        # Get survey type
        cursor.execute("SELECT id FROM survey_type WHERE name = %s", (SURVEY_TYPE_NAME,))
        survey_type_row = cursor.fetchone()
        if not survey_type_row:
            logger.error(f"Survey type '{SURVEY_TYPE_NAME}' not found!")
            sys.exit(1)
        survey_type_id = survey_type_row[0]

        # Count surveys in CSVs
        total_csv_surveys = 0
        for year, csv_path in existing_files:
            with open(csv_path, 'r', encoding='utf-8-sig') as file:
                for line in file:
                    if line.startswith('Week beginning'):
                        reader = csv.DictReader(file, fieldnames=line.strip().split(','))
                        for row in reader:
                            date_str = row.get('Date of survey', '').strip()
                            if date_str and parse_date(date_str):
                                total_csv_surveys += 1
                        break

        logger.info(f"CSV files contain {total_csv_surveys} surveys to import")

        # =================================================================
        # SUMMARY
        # =================================================================
        logger.info("\n" + "=" * 80)
        logger.info("SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Will DELETE: {len(surveys)} surveys, {total_sightings} sightings")
        logger.info(f"Will IMPORT: {total_csv_surveys} surveys from CSV")
        logger.info("=" * 80)

        if args.dry_run:
            logger.info("\nDRY RUN complete. Run with --no-dry-run --yes to apply changes.")
            return

        # =================================================================
        # CONFIRM AND EXECUTE
        # =================================================================
        if not args.yes:
            logger.info("\nWARNING: This will delete and reimport all butterfly survey data!")
            response = input("Type 'yes' to confirm: ").strip().lower()
            if response != 'yes':
                logger.info("Aborted.")
                return

        # Delete existing data
        if survey_ids:
            logger.info("\nDeleting existing butterfly data...")
            delete_sightings(cursor, survey_ids)
            delete_survey_surveyors(cursor, survey_ids)
            deleted = delete_surveys(cursor, survey_ids)
            logger.info(f"Deleted {deleted} surveys")

        # Setup reference data
        logger.info("\nSetting up reference data...")
        setup_reference_data(cursor, dry_run=False)

        # Build lookup dicts
        cursor.execute("SELECT id, first_name FROM surveyor")
        surveyor_ids = {}
        for surveyor_id, first_name in cursor.fetchall():
            if first_name == 'Mark':
                surveyor_ids['Mark'] = surveyor_id
                surveyor_ids['M'] = surveyor_id
            elif first_name == 'Nicola':
                surveyor_ids['N'] = surveyor_id
            elif first_name == 'R':
                surveyor_ids['R'] = surveyor_id
            elif first_name == 'C':
                surveyor_ids['C'] = surveyor_id
            elif first_name == 'P':
                surveyor_ids['P'] = surveyor_id
            else:
                surveyor_ids[first_name] = surveyor_id

        cursor.execute("SELECT id, name FROM species WHERE type = 'butterfly'")
        species_ids = {name: id for id, name in cursor.fetchall()}

        cursor.execute("SELECT id, number FROM location WHERE type = 'butterfly'")
        location_ids = {num: id for id, num in cursor.fetchall()}
        logger.info(f"Found {len(location_ids)} butterfly locations: {list(location_ids.keys())}")

        # Import from CSVs
        logger.info("\nImporting from CSV files...")
        total_surveys = 0
        total_sightings = 0
        for year, csv_path in existing_files:
            logger.info(f"\nProcessing {year} data from: {csv_path.name}")
            surveys, sightings = import_csv_data(
                cursor, str(csv_path), year, survey_type_id,
                surveyor_ids, species_ids, location_ids
            )
            total_surveys += surveys
            total_sightings += sightings

        logger.info("\n" + "=" * 80)
        logger.info("REIMPORT COMPLETE")
        logger.info("=" * 80)
        logger.info(f"Imported {total_surveys} surveys with {total_sightings} sightings")


if __name__ == "__main__":
    main()
