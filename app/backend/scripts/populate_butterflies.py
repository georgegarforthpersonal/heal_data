#!/usr/bin/env python3
"""
Populate database with butterfly survey data from CSV.

Imports butterfly transect survey data from CSV files into the database.
Creates reference data (surveyors, locations, species) if not already present.

Usage:
    ./staging-run populate_butterflies.py                     # Dry-run (preview only)
    ./staging-run populate_butterflies.py --no-dry-run --yes  # Apply to database

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
    logger.error("populate_butterflies.py must ONLY be run against staging/dev database")
    logger.error(f"Current ENV: {os.getenv('ENV')}")
    sys.exit(1)

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

SURVEY_TYPE_NAME = "Butterfly"


def setup_reference_data(cursor, dry_run: bool = True):
    """Set up surveyors, locations, and species (insert-only, no deletion)."""
    logger.info("Checking reference data...")

    # Check surveyors
    surveyors = [
        ('Mark', ''),
        ('Nicola', ''),
        ('P', ''),
        ('R', ''),
        ('C', '')  # Added based on CSV data (C & M surveyor)
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
        'Brimstone', 'Comma', 'Common Blue', 'Gatekeeper', 'Green Veined White',
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
    # Strip any whitespace
    normalized = species_name.upper().strip()

    # Remove transect section numbers in parentheses (e.g., "LARGE SKIPPER (3)" -> "LARGE SKIPPER")
    import re
    normalized = re.sub(r'\s*\(\d+\)\s*$', '', normalized)

    # Filter out non-butterfly entries
    non_butterfly_patterns = [
        r'NB\s+VERY\s+BIG\s+FLOCK',
        r'GOLD\s+FINCHES',
        r'FINCHES',
        r'BIRD',
        r'^VERY\s+BIG',
        r'FLOCK'
    ]

    for pattern in non_butterfly_patterns:
        if re.search(pattern, normalized):
            return ""  # Return empty string for non-butterfly entries

    # Handle standalone numbers in parentheses - these are parsing artifacts
    if re.match(r'^\(\d+\)$', normalized.strip()):
        return ""

    # Handle entries that are just numbers or contain "Seven" or "Six" as species names
    number_only_patterns = [
        r'^SEVEN\s+MEADOW\s+BROWN$',
        r'^SIX\s+MEADOW\s+BROWN$'
    ]
    for pattern in number_only_patterns:
        if re.match(pattern, normalized):
            return "Meadow Brown"

    # Map to exact DB names (case-sensitive) - return early to preserve casing
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
    # Clean up multiple spaces and normalize whitespace
    entry = ' '.join(entry.split())
    words = entry.split()
    if len(words) == 0:
        return "", 1

    def parse_hyphenated_number(word: str) -> Optional[int]:
        """Parse hyphenated numbers like TWENTY-THREE, FORTY-FIVE"""
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

    # Check for hyphenated number at beginning (2024 format: "TWENTY-THREE Gatekeeper")
    if len(words) >= 2:
        hyphen_count = parse_hyphenated_number(words[0])
        if hyphen_count:
            species_name = ' '.join(words[1:])
            return normalize_species_name(species_name), hyphen_count

    # Check for number at the beginning (2024 format: "ONE Peacock")
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

    # Check for compound numbers at beginning (2024 format: "TWENTY ONE Species")
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

    # Check for hyphenated number at end (2025 format: "Gatekeeper TWENTY-THREE")
    if len(words) >= 2:
        hyphen_count = parse_hyphenated_number(words[-1])
        if hyphen_count:
            species_name = ' '.join(words[:-1])
            return normalize_species_name(species_name), hyphen_count

    # Check for compound numbers at end (2025 format: "Species TWENTY ONE")
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

    # Check if last word is a number word or digit (2025 format: "PEACOCK ONE")
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

    # First, split by major delimiters (semicolons, colons, periods)
    segments = re.split(r'[;:]|(?<=\))\.|\.(?=\s*[A-Z])|\.(?=\s*$)', clean_str)

    accumulated_species = []
    current_transect = 1

    for segment in segments:
        segment = segment.strip()
        if not segment:
            continue

        # Process each segment to handle multiple transect markers
        remaining_segment = segment

        while remaining_segment:
            # Look for the next transect marker
            transect_match = re.search(r'\((\d+)\)', remaining_segment)

            if transect_match:
                transect_num = int(transect_match.group(1))

                # Everything before this transect marker belongs to accumulated species
                before_marker = remaining_segment[:transect_match.start()].strip()
                if before_marker:
                    species_in_segment = [s.strip() for s in before_marker.split(',') if s.strip()]
                    accumulated_species.extend(species_in_segment)

                # Process accumulated species for the current transect
                for species_entry in accumulated_species:
                    if species_entry:
                        entry_upper = species_entry.upper().strip()
                        species_name, count = parse_species_entry(entry_upper)
                        if species_name:
                            sightings.append((species_name, count, transect_num))

                accumulated_species = []
                current_transect = transect_num

                # Continue processing the rest of the segment after this transect marker
                remaining_segment = remaining_segment[transect_match.end():].strip()

                # If there's a comma right after the transect marker, remove it
                if remaining_segment.startswith(','):
                    remaining_segment = remaining_segment[1:].strip()
            else:
                # No more transect markers in this segment
                if remaining_segment:
                    species_in_segment = [s.strip() for s in remaining_segment.split(',') if s.strip()]
                    accumulated_species.extend(species_in_segment)
                break

    # Process any remaining accumulated species
    for species_entry in accumulated_species:
        if species_entry:
            entry_upper = species_entry.upper().strip()
            species_name, count = parse_species_entry(entry_upper)
            if species_name:
                sightings.append((species_name, count, current_transect))

    return sightings

def import_csv_data(cursor, csv_file_path: str, year: str = "", dry_run: bool = True) -> tuple[int, int]:
    """
    Import butterfly survey data from CSV.

    Returns:
        Tuple of (surveys_count, sightings_count) that would be/were added
    """
    # Get survey type ID
    cursor.execute("SELECT id FROM survey_type WHERE name = %s", (SURVEY_TYPE_NAME,))
    survey_type_row = cursor.fetchone()
    if not survey_type_row:
        logger.error(f"Survey type '{SURVEY_TYPE_NAME}' not found in database!")
        logger.error("Please create the survey type first.")
        return (0, 0)
    survey_type_id = survey_type_row[0]
    logger.info(f"Using survey type: {SURVEY_TYPE_NAME} (id={survey_type_id})")

    # Get surveyor and species mappings
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
    if location_ids:
        logger.info(f"Found {len(location_ids)} butterfly locations: {list(location_ids.keys())}")
    else:
        logger.warning("No butterfly-type locations found in database! Sightings will be created without location_id.")

    # Read and parse CSV
    logger.info("Validating species in CSV...")
    missing_species = set()
    with open(csv_file_path, 'r', encoding='utf-8-sig') as file:
        # Skip metadata lines until we find the header row
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
    surveys_to_add = []
    total_sightings = 0

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

        # Parse other fields
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

        # Check if survey already exists
        cursor.execute(
            "SELECT id FROM survey WHERE date = %s AND survey_type_id = %s",
            (survey_date, survey_type_id)
        )
        if cursor.fetchone():
            logger.info(f"  Survey for {survey_date} already exists, skipping...")
            continue

        # Parse surveyors
        surveyor_str = (row.get('Surveyor N and/or R', '') or
                       row.get('Surveyor N and/or M', '')).strip()
        surveyor_codes = []
        if '&' in surveyor_str:
            surveyor_codes = [s.strip() for s in surveyor_str.split('&')]
        elif surveyor_str:
            surveyor_codes = [surveyor_str]

        # Parse sightings
        butterflies_str = row.get('Butterflies seen (with transect section number adjacent). State number of butterflies in writing to save confusion with transect section number.', '')
        sightings = parse_butterflies_string(butterflies_str)

        surveys_to_add.append({
            'date': survey_date,
            'start_time': start_time,
            'end_time': end_time,
            'sun_percentage': sun_percentage,
            'temperature': temperature,
            'conditions_met': conditions_met,
            'surveyor_codes': surveyor_codes,
            'sightings': sightings
        })
        total_sightings += len([s for s in sightings if s[0]])  # Count non-empty species

    # Log what would be added
    logger.info(f"Found {len(surveys_to_add)} new surveys with {total_sightings} sightings to add")
    for survey in surveys_to_add[:5]:
        logger.info(f"  - {survey['date']}: {len([s for s in survey['sightings'] if s[0]])} sightings")
    if len(surveys_to_add) > 5:
        logger.info(f"  ... and {len(surveys_to_add) - 5} more")

    if dry_run:
        logger.info(f"DRY RUN: Would add {len(surveys_to_add)} surveys with {total_sightings} sightings")
        return (len(surveys_to_add), total_sightings)

    # Actually insert the data
    for survey in surveys_to_add:
        cursor.execute("""
            INSERT INTO survey (date, start_time, end_time, sun_percentage,
                              temperature_celsius, conditions_met, notes, survey_type_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (survey['date'], survey['start_time'], survey['end_time'],
              survey['sun_percentage'], survey['temperature'],
              survey['conditions_met'], None, survey_type_id))

        survey_id = cursor.fetchone()[0]

        # Link surveyors
        for code in survey['surveyor_codes']:
            surveyor_id = surveyor_ids.get(code)
            if surveyor_id:
                cursor.execute("""
                    INSERT INTO survey_surveyor (survey_id, surveyor_id)
                    VALUES (%s, %s)
                """, (survey_id, surveyor_id))

        # Insert sightings
        for species_name, count, location_num in survey['sightings']:
            if not species_name:
                continue
            species_id = species_ids.get(species_name)
            location_id = location_ids.get(location_num)
            if not species_id:
                logger.warning(f"  Species not found: {species_name}")
                continue
            if not location_id:
                logger.warning(f"  Location not found for transect section {location_num} - inserting sighting without location")
            cursor.execute("""
                INSERT INTO sighting (survey_id, species_id, location_id, count)
                VALUES (%s, %s, %s, %s)
            """, (survey_id, species_id, location_id, count))

        logger.info(f"  Imported survey for {survey['date']}")

    return (len(surveys_to_add), total_sightings)

def main():
    parser = get_arg_parser(description=__doc__)
    parser.add_argument(
        '--yes', '-y',
        action='store_true',
        help='Skip confirmation prompt'
    )
    args = parser.parse_args()

    mode = "DRY RUN" if args.dry_run else "LIVE"
    logger.info(f"{'='*50}")
    logger.info(f"Butterfly Survey Import - {mode} MODE")
    logger.info(f"{'='*50}")

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

    # First pass: analyze what would be done (always runs in dry-run mode)
    with get_db_cursor() as cursor:
        setup_reference_data(cursor, dry_run=True)

        total_surveys = 0
        total_sightings = 0

        for year, csv_path in existing_files:
            logger.info(f"\nProcessing {year} data from: {csv_path.name}")
            surveys, sightings = import_csv_data(
                cursor,
                str(csv_path),
                year,
                dry_run=True
            )
            total_surveys += surveys
            total_sightings += sightings

    # Summary
    logger.info(f"\n{'='*50}")
    if args.dry_run:
        logger.info(f"DRY RUN COMPLETE")
        logger.info(f"Would add {total_surveys} surveys with {total_sightings} sightings")
        logger.info(f"\nTo apply changes, run:")
        logger.info(f"  ./staging-run populate_butterflies.py --no-dry-run --yes")
        return

    # Not dry-run: confirm and apply
    if total_surveys == 0:
        logger.info("No new surveys to add.")
        return

    if not args.yes:
        response = input(f"\nApply {total_surveys} surveys with {total_sightings} sightings? [y/N]: ")
        if response.lower() != 'y':
            logger.info("Aborted.")
            return

    # Second pass: actually insert the data
    with get_db_cursor() as cursor:
        setup_reference_data(cursor, dry_run=False)
        for year, csv_path in existing_files:
            import_csv_data(cursor, str(csv_path), year, dry_run=False)

    logger.info(f"\n{'='*50}")
    logger.info(f"IMPORT COMPLETE")
    logger.info(f"Added {total_surveys} surveys with {total_sightings} sightings")


if __name__ == "__main__":
    main()