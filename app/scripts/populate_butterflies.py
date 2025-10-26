#!/usr/bin/env python3
"""
Populate database with butterfly survey data from CSV.
Consolidates setup_database.py + import_csv_data.py functionality.
"""

import csv
import re
import psycopg2
import os
from datetime import datetime, time, date
from decimal import Decimal
from typing import Dict, List, Tuple, Optional

# Database connection settings
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME', 'heal_butterflies'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'password')
}

# Safety check: NEVER allow this script to run against production
if os.getenv('ENV', '').lower() == 'production':
    print("❌ ERROR: This script cannot run against production database!")
    print("   populate_butterflies.py must ONLY be run against dev database")
    print("   Current ENV:", os.getenv('ENV'))
    exit(1)

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

def connect_db():
    """Connect to the PostgreSQL database."""
    return psycopg2.connect(**DB_CONFIG)

def setup_reference_data(cursor):
    """Set up surveyors, transects, and species."""
    print("Setting up reference data...")
    
    # Clear existing butterfly data only
    cursor.execute("DELETE FROM sighting WHERE species_id IN (SELECT id FROM species WHERE type = 'butterfly')")
    cursor.execute("DELETE FROM survey_surveyor WHERE survey_id IN (SELECT id FROM survey WHERE id NOT IN (SELECT DISTINCT survey_id FROM sighting WHERE species_id IN (SELECT id FROM species WHERE type = 'bird')))")
    cursor.execute("DELETE FROM survey WHERE id NOT IN (SELECT DISTINCT survey_id FROM sighting)")
    cursor.execute("DELETE FROM species WHERE type = 'butterfly'")
    
    # Only delete butterfly-specific transects (1-5) and surveyors if they have no bird data
    cursor.execute("DELETE FROM transect WHERE number BETWEEN 1 AND 5")
    
    # Clean up surveyors that only have butterfly surveys
    cursor.execute("""
        DELETE FROM surveyor 
        WHERE id NOT IN (
            SELECT DISTINCT ss.surveyor_id 
            FROM survey_surveyor ss 
            JOIN survey s ON ss.survey_id = s.id 
            JOIN sighting st ON s.id = st.survey_id 
            JOIN species sp ON st.species_id = sp.id 
            WHERE sp.type = 'bird'
        )
    """)
    
    # Insert surveyors
    surveyors = [
        ('Mark', ''),
        ('Nicola', ''),
        ('P', ''),
        ('R', '')
    ]
    for first_name, last_name in surveyors:
        cursor.execute(
            "INSERT INTO surveyor (first_name, last_name) VALUES (%s, %s)",
            (first_name, last_name)
        )
    
    # Insert transects
    transects = [
        (1, 'Brook'),
        (2, 'Field'),
        (3, 'Track'),
        (4, 'Marsh'),
        (5, 'Hedge')
    ]
    for number, name in transects:
        cursor.execute(
            "INSERT INTO transect (number, name, type) VALUES (%s, %s, 'butterfly')",
            (number, name)
        )
    
    # Insert butterfly species
    species_list = [
        'Brimstone',
        'Comma',
        'Common Blue',
        'Gatekeeper',
        'Green Veined White',
        'Holly Blue',
        'Large Skipper',
        'Large White',
        'Marbled White',
        'Meadow Brown',
        'Orange Tip',
        'Painted Lady',
        'Peacock',
        'Red Admiral',
        'Ringlet',
        'Small Copper',
        'Small Heath',
        'Small Skipper',
        'Small Tortoiseshell',
        'Small White',
        'Speckled Wood'
    ]
    for species_name in species_list:
        cursor.execute(
            "INSERT INTO species (name, type) VALUES (%s, %s)",
            (species_name, 'butterfly')
        )
    
    print(f"✅ Set up {len(surveyors)} surveyors, {len(transects)} transects, {len(species_list)} species")

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

    name_mappings = {
        'GREEN VEINED WHITE1': 'GREEN VEINED WHITE',
        'GREENVEINED WHITE': 'GREEN VEINED WHITE',
        'MEADOE BROWN': 'MEADOW BROWN',
        'MEAQDOW BROWN': 'MEADOW BROWN',
        'SPOTTED WOOD': 'SPECKLED WOOD',
        'WHITE (SMALL/GREEN VEINED)': 'GREEN VEINED WHITE',
        'WHITE': 'GREEN VEINED WHITE',
    }

    if normalized in name_mappings:
        normalized = name_mappings[normalized]

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

def import_csv_data(csv_file_path: str, year: str = ""):
    """Import butterfly survey data from CSV."""
    conn = connect_db()
    cursor = conn.cursor()
    
    try:
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
            else:
                surveyor_ids[first_name] = surveyor_id
        
        cursor.execute("SELECT id, name FROM species WHERE type = 'butterfly'")
        species_ids = {name: id for id, name in cursor.fetchall()}
        
        cursor.execute("SELECT id, number FROM transect WHERE type = 'butterfly'")
        transect_ids = {num: id for id, num in cursor.fetchall()}
        
        # Validate species in CSV
        print("Validating species in CSV...")
        missing_species = set()
        with open(csv_file_path, 'r', encoding='utf-8-sig') as file:
            reader = csv.DictReader(file)
            rows = list(reader)
            
            for row in rows:
                butterflies_str = row.get('Butterflies seen (with transect section number adjacent). State number of butterflies in writing to save confusion with transect section number.', '')
                sightings = parse_butterflies_string(butterflies_str)
                for species_name, _, _ in sightings:
                    # Skip empty species names (filtered out non-butterfly entries)
                    if species_name and species_name not in species_ids:
                        missing_species.add(species_name)
            
            if missing_species:
                print(f"ERROR: Missing species in database:")
                for species in sorted(missing_species):
                    print(f"  - {species}")
                return
        
        # Process surveys
        print(f"Processing surveys from {year} CSV...")
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
            if sun_str and '%' in sun_str:
                try:
                    sun_percentage = int(sun_str.replace('%', ''))
                except ValueError:
                    pass
            
            temp_str = row.get('Temp', '').strip()
            temperature = None
            if temp_str:
                try:
                    # Handle cases like "17/18" by taking the first number
                    if '/' in temp_str:
                        temp_str = temp_str.split('/')[0]
                    temperature = Decimal(temp_str)
                except (ValueError, TypeError, Exception):
                    pass
            
            conditions_str = row.get('Conditons met? (See details at foot of sheet)', '').strip().lower()
            conditions_met = conditions_str == 'yes'
            
            # Insert survey
            cursor.execute("""
                INSERT INTO survey (date, start_time, end_time, sun_percentage, 
                                  temperature_celsius, conditions_met, notes, type)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'butterfly') RETURNING id
            """, (survey_date, start_time, end_time, sun_percentage, 
                  temperature, conditions_met, None))
            
            survey_id = cursor.fetchone()[0]
            
            # Link surveyor - handle both 2024 and 2025 column names
            surveyor_str = (row.get('Surveyor N and/or R', '') or
                           row.get('Surveyor N and/or M', '')).strip()
            surveyor_id = surveyor_ids.get(surveyor_str)
            if surveyor_id:
                cursor.execute("""
                    INSERT INTO survey_surveyor (survey_id, surveyor_id)
                    VALUES (%s, %s)
                """, (survey_id, surveyor_id))
            
            # Insert sightings
            butterflies_str = row.get('Butterflies seen (with transect section number adjacent). State number of butterflies in writing to save confusion with transect section number.', '')
            sightings = parse_butterflies_string(butterflies_str)
            
            successful_sightings = 0
            for species_name, count, transect_num in sightings:
                # Skip empty species names (filtered out non-butterfly entries)
                if not species_name:
                    continue

                species_id = species_ids.get(species_name)
                transect_id = transect_ids.get(transect_num)

                if species_id and transect_id:
                    cursor.execute("""
                        INSERT INTO sighting (survey_id, species_id, transect_id, count)
                        VALUES (%s, %s, %s, %s)
                    """, (survey_id, species_id, transect_id, count))
                    successful_sightings += 1
            
            print(f"✅ Imported survey for {survey_date} with {successful_sightings} sightings")
        
        conn.commit()
        
        # Print summary
        cursor.execute("SELECT COUNT(*) FROM survey")
        survey_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM sighting")
        sighting_count = cursor.fetchone()[0]
        
        print(f"\n🦋 Butterfly data import completed!")
        print(f"   - {survey_count} surveys")
        print(f"   - {sighting_count} sightings")
        
    except Exception as e:
        print(f"❌ Import failed: {e}")
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    try:
        # Debug: show what __file__ contains
        print(f"__file__ = {__file__}")
        print(f"os.getcwd() = {os.getcwd()}")

        # When run via Docker, the script is in /app/scripts/ and we need to find the data folder
        script_dir = os.path.dirname(os.path.abspath(__file__))
        data_dir = os.path.join(script_dir, "data")

        # Debug: print the paths we're looking for
        print(f"Script directory: {script_dir}")
        print(f"Data directory: {data_dir}")

        if not os.path.exists(data_dir):
            print(f"❌ Data directory not found: {data_dir}")
            exit(1)

        # Look for both CSV files
        csv_files = [
            ("2024", os.path.join(data_dir, "Heal Butterfly transect 2024.csv")),
            ("2025", os.path.join(data_dir, "Heal Butterfly transect 2025.csv"))
        ]

        print(f"Files in data directory: {os.listdir(data_dir)}")

        # Setup reference data once at the start
        conn = connect_db()
        cursor = conn.cursor()
        setup_reference_data(cursor)
        conn.commit()
        cursor.close()
        conn.close()

        # Process each CSV file that exists
        for year, csv_file in csv_files:
            if os.path.exists(csv_file):
                print(f"\n🦋 Processing {year} data from: {csv_file}")
                import_csv_data(csv_file, year)
            else:
                print(f"⚠️  Skipping {year} - file not found: {csv_file}")

    except Exception as e:
        print(f"❌ Error in main: {e}")
        import traceback
        traceback.print_exc()
        exit(1)