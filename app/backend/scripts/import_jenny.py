"""
Import Jenny's species data from appendix documents.

Reads species observations from a Word document and creates sightings
against a single survey record.

Usage:
    ./dev-run import_jenny.py                      # Dry-run 2023 (default)
    ./dev-run import_jenny.py --year 2024          # Dry-run 2024
    ./dev-run import_jenny.py --year 2024 --no-dry-run  # Apply 2024 to database

Defaults to dry-run mode. Use --no-dry-run to write to database.
"""

import logging
import re
import sys
from pathlib import Path
from dataclasses import dataclass
from typing import Optional

from docx import Document
from rapidfuzz import fuzz, process

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.connection import get_db_cursor
from script_utils import get_arg_parser


logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)


# ============================================================================
# CONFIGURATION
# ============================================================================

# Survey Configuration
SURVEY_TYPE_NAME = "Jenny General Survey"

# Year-specific configuration
YEAR_CONFIG = {
    2023: {
        "data_file": Path(__file__).parent / "data" / "Heal Somerset Appendix 2023.docx",
        "survey_date": "2023-12-31",
        "survey_notes": "Jenny's 2023 species observations imported from appendix document",
    },
    2024: {
        "data_file": Path(__file__).parent / "data" / "Heal Somerset Appendix 2024.docx",
        "survey_date": "2024-12-31",
        "survey_notes": "Jenny's 2024 species observations imported from appendix document",
    },
}

SURVEY_LOCATION = None

# Section headers that indicate start of species lists
# Note: some use "-" (hyphen) and some use "–" (en-dash)
# Headers are matched case-insensitively
SECTION_HEADERS = [
    # Lepidoptera
    "Lepidoptera - Macro Moths",
    "Lepidoptera - Butterflies",
    # Other insects
    "Coleoptera - Beetles",
    "Coleoptera",
    "Diptera - Flies",
    "Diptera",
    "Trichoptera",      # Caddisflies
    "Psocoptera",       # Bark flies/lice
    "Hemiptera - Bugs",
    "Hemiptera",
    "Hymenoptera",      # Bees, Wasps and Ants
    "Odonata",          # Dragonflies and Damselflies
    "Orthoptera",       # Grasshoppers and Bush-crickets
    "Dermaptera",       # Earwigs (2024)
    "Mecoptera",        # Scorpion Flies (2024)
    # Non-insect invertebrates
    "Philosciidae",     # Woodlice (2024)
    "Arachnids",        # Spiders and Harvestmen
    # Other taxa
    "Non Lepidoptera mines",
    "Galls",
    "Fungi",            # (2024)
]

# Phrases that indicate end of species data
STOP_PHRASES = ["for interest", "here are some photos"]

# Regex pattern for Bradley-Fletcher numbers at start of moth lines (e.g., "54.009", "66.003")
BRADLEY_FLETCHER_PATTERN = re.compile(r'^\d{2}\.\d{3}\s+')


# ============================================================================
# DATA CLASSES
# ============================================================================

@dataclass
class ParsedSpecies:
    """A species parsed from the docx file."""
    scientific_name: str
    common_name: str
    section: str


@dataclass
class MatchResult:
    """Result of matching a parsed species against the database."""
    parsed_species: ParsedSpecies
    db_species_id: Optional[int]
    db_species_name: Optional[str]
    match_type: str  # "common_name", "scientific_name", "fuzzy", "no_match"
    fuzzy_score: Optional[int] = None  # Score for fuzzy matches (0-100)


# ============================================================================
# PARSING FUNCTIONS
# ============================================================================

def is_section_header(text: str) -> Optional[str]:
    """Check if text is a section header and return the matched header.

    Handles both title case (2023) and uppercase (2024) headers.
    """
    # Normalize dashes (en-dash to hyphen) and case
    text_normalized = text.replace('–', '-').strip().lower()

    for header in SECTION_HEADERS:
        header_normalized = header.replace('–', '-').lower()
        if text_normalized.startswith(header_normalized):
            return header
    return None


def should_stop_parsing(text: str) -> bool:
    """Check if we've reached content that indicates end of species data."""
    text_lower = text.lower()
    return any(phrase in text_lower for phrase in STOP_PHRASES)


def is_continuation_line(line: str) -> bool:
    """Check if line is a continuation/note line that should be skipped.

    Examples: "adult emerged 14/12", "adult emerged 15/09"
    """
    line_lower = line.lower().strip()
    # Skip lines that look like continuation notes
    if line_lower.startswith('adult emerged'):
        return True
    # Skip very short lines that are likely notes
    if len(line.split()) <= 2 and not any(c.isupper() for c in line[:1]):
        return True
    return False


def parse_species_line(line: str) -> Optional[tuple[str, str]]:
    """
    Parse a line containing scientific name and common name.

    Expected formats:
    - "Genus species Common Name possibly with notes"
    - "NN.NNN Genus species Common Name" (Bradley-Fletcher number for moths)

    Scientific name is always Genus species (two words).

    Returns (scientific_name, common_name) or None if not parseable.
    """
    # Skip continuation lines
    if is_continuation_line(line):
        return None

    # Strip Bradley-Fletcher numbers from the start (e.g., "54.009 ", "66.003 ")
    line = BRADLEY_FLETCHER_PATTERN.sub('', line)

    # Split on whitespace
    parts = line.split()
    if len(parts) < 3:
        return None

    # First word should be capitalized (Genus)
    # Second word should be lowercase (species epithet)
    if not parts[0] or not parts[0][0].isupper():
        return None
    if not parts[1] or not parts[1][0].islower():
        return None

    scientific_name = f"{parts[0]} {parts[1]}"
    common_name = ' '.join(parts[2:])

    # Clean up common name - remove observation notes after " – " or " - "
    for separator in [' – ', ' - ']:
        if separator in common_name:
            common_name = common_name.split(separator)[0].strip()
            break

    return scientific_name, common_name


def parse_docx_file(file_path: Path) -> list[ParsedSpecies]:
    """
    Parse the docx file and extract species records.

    Document structure:
    - Section headers (e.g., "Lepidoptera - Macro Moths")
    - Under each header: rows with "<scientific_name> <common_name>"
    - Blank rows between sections
    """
    logger.info(f"Reading document: {file_path}")

    doc = Document(file_path)

    species_list = []
    current_section = None

    # Read all paragraphs from the document
    for para in doc.paragraphs:
        text = para.text.strip()

        # Skip empty lines
        if not text:
            continue

        # Check if we should stop parsing
        if should_stop_parsing(text):
            logger.info(f"Stopping at: '{text[:50]}...'")
            break

        # Check if this is a section header
        section = is_section_header(text)
        if section:
            current_section = section
            logger.debug(f"Entered section: {section}")
            continue

        # Skip content before first section
        if current_section is None:
            continue

        # Try to parse as a species line
        result = parse_species_line(text)
        if result:
            scientific_name, common_name = result
            species_list.append(ParsedSpecies(
                scientific_name=scientific_name,
                common_name=common_name,
                section=current_section,
            ))

    logger.info(f"Parsed {len(species_list)} species from document")
    return species_list


def preview_parsed_data(species_list: list[ParsedSpecies], limit: int = 10):
    """Show a preview of parsed data grouped by section."""
    logger.info("\n" + "="*80)
    logger.info("PARSED DATA PREVIEW")
    logger.info("="*80)

    # Group by section
    by_section = {}
    for sp in species_list:
        if sp.section not in by_section:
            by_section[sp.section] = []
        by_section[sp.section].append(sp)

    for section, species in by_section.items():
        logger.info(f"\n{section} ({len(species)} species)")
        for sp in species[:3]:
            logger.info(f"  - {sp.common_name} ({sp.scientific_name})")
        if len(species) > 3:
            logger.info(f"  ... and {len(species) - 3} more")

    logger.info("\n" + "="*80)


# ============================================================================
# MATCHING FUNCTIONS
# ============================================================================

def match_species(parsed_list: list[ParsedSpecies], cursor) -> tuple[list[MatchResult], list[tuple]]:
    """
    Match parsed species against database.

    Strategy:
    1. Try exact match on Species.name (common name) - case insensitive
    2. If no match, try exact match on Species.scientific_name - case insensitive
    3. If no match, report as unmatched

    Returns:
        Tuple of (results list, db_species list for fuzzy matching)
    """
    # Load all species from database
    cursor.execute("""
        SELECT id, name, scientific_name, type
        FROM species
    """)
    db_species = cursor.fetchall()

    logger.info(f"Loaded {len(db_species)} species from database")

    # Build lookup dictionaries (case-insensitive)
    by_common_name = {}
    by_scientific_name = {}
    for row in db_species:
        sp_id, name, scientific_name, sp_type = row
        if name:
            by_common_name[name.lower()] = (sp_id, name)
        if scientific_name:
            by_scientific_name[scientific_name.lower()] = (sp_id, name or scientific_name)

    results = []
    for parsed in parsed_list:
        # Try common name match first
        common_key = parsed.common_name.lower() if parsed.common_name else ""
        if common_key in by_common_name:
            sp_id, sp_name = by_common_name[common_key]
            results.append(MatchResult(
                parsed_species=parsed,
                db_species_id=sp_id,
                db_species_name=sp_name,
                match_type="common_name"
            ))
            continue

        # Try scientific name match
        sci_key = parsed.scientific_name.lower() if parsed.scientific_name else ""
        if sci_key in by_scientific_name:
            sp_id, sp_name = by_scientific_name[sci_key]
            results.append(MatchResult(
                parsed_species=parsed,
                db_species_id=sp_id,
                db_species_name=sp_name,
                match_type="scientific_name"
            ))
            continue

        # No match found
        results.append(MatchResult(
            parsed_species=parsed,
            db_species_id=None,
            db_species_name=None,
            match_type="no_match"
        ))

    return results, db_species


def fuzzy_match_unmatched(
    unmatched: list[MatchResult],
    db_species: list[tuple],
) -> list[MatchResult]:
    """
    Attempt fuzzy matching for unmatched species with individual approval.

    Args:
        unmatched: List of MatchResult with no_match
        db_species: List of (id, name, scientific_name, type) tuples from DB

    Returns:
        List of MatchResult with user-approved fuzzy matches
    """
    if not unmatched:
        return []

    # Build lookup for full species info: id -> (common_name, scientific_name)
    species_lookup = {row[0]: (row[1], row[2]) for row in db_species}

    # Build lists for fuzzy matching
    db_common_names = [(row[1], row[0]) for row in db_species if row[1]]  # (name, id)
    db_scientific_names = [(row[2], row[0]) for row in db_species if row[2]]  # (sci_name, id)

    approved_matches = []
    skipped = []

    for i, result in enumerate(unmatched, 1):
        parsed = result.parsed_species
        logger.info(f"\n[{i}/{len(unmatched)}] {parsed.common_name} ({parsed.scientific_name})")
        logger.info(f"  Section: {parsed.section}")

        # Find best matches by common name
        common_matches = process.extract(
            parsed.common_name,
            [x[0] for x in db_common_names],
            scorer=fuzz.ratio,
            limit=3
        )

        # Find best matches by scientific name (full name)
        scientific_matches = process.extract(
            parsed.scientific_name,
            [x[0] for x in db_scientific_names],
            scorer=fuzz.ratio,
            limit=3
        )

        # Also try matching just the species epithet (second word) for taxonomic synonyms
        # e.g., "Pyrophaena rosarum" should match "Platycheirus rosarum"
        parsed_parts = parsed.scientific_name.split()
        if len(parsed_parts) >= 2:
            species_epithet = parsed_parts[1].lower()
            epithet_matches = [
                (sci_name, 85, idx)  # Give epithet matches a score of 85
                for idx, (sci_name, db_id) in enumerate(db_scientific_names)
                if sci_name and len(sci_name.split()) >= 2 and sci_name.split()[1].lower() == species_epithet
            ][:3]
            # Add epithet matches that aren't already in scientific_matches
            existing_names = {m[0] for m in scientific_matches}
            for match in epithet_matches:
                if match[0] not in existing_names:
                    scientific_matches.append(match)

        # Build candidate lists for each match type: (db_id, common_name, scientific_name, score)
        common_candidates = []
        for match_name, score, _ in common_matches:
            for db_name, db_id in db_common_names:
                if db_name == match_name:
                    common_name, scientific_name = species_lookup[db_id]
                    common_candidates.append((db_id, common_name, scientific_name, score))
                    break

        scientific_candidates = []
        for match_name, score, _ in scientific_matches:
            for sci_name, db_id in db_scientific_names:
                if sci_name == match_name:
                    common_name, scientific_name = species_lookup[db_id]
                    scientific_candidates.append((db_id, common_name, scientific_name, score))
                    break

        if not common_candidates and not scientific_candidates:
            logger.info("  No fuzzy matches found")
            skipped.append(result)
            continue

        # Display options - common name matches first, then scientific
        logger.info("  By common name:")
        option_num = 1
        all_options = []
        for db_id, common_name, scientific_name, score in common_candidates:
            logger.info(f"    {option_num}. {common_name} ({scientific_name}) [score: {score:.0f}]")
            all_options.append((db_id, common_name, scientific_name, score, "common name"))
            option_num += 1

        logger.info("  By scientific name:")
        for db_id, common_name, scientific_name, score in scientific_candidates:
            logger.info(f"    {option_num}. {common_name} ({scientific_name}) [score: {score:.0f}]")
            all_options.append((db_id, common_name, scientific_name, score, "scientific name"))
            option_num += 1

        max_option = len(all_options)

        # Get user input
        quit_all = False
        while True:
            response = input(f"  Enter 1-{max_option} to accept, 's' to skip, 'q' to skip all, '?' to search: ").strip()

            if response.lower() == 'q':
                # Skip all remaining
                logger.info("  Skipping all remaining fuzzy matches")
                skipped.append(result)
                skipped.extend(unmatched[i:])  # Add remaining as-is
                quit_all = True
                break

            if response.lower() == 's':
                logger.info("  Skipped")
                skipped.append(result)
                break

            if response == '?':
                # Manual search mode
                search_term = input("  Enter search term: ").strip()
                if not search_term:
                    continue

                logger.info(f"  Searching for: '{search_term}'")

                # Search common names
                search_common_matches = process.extract(
                    search_term,
                    [x[0] for x in db_common_names],
                    scorer=fuzz.ratio,
                    limit=3
                )
                # Search scientific names
                search_scientific_matches = process.extract(
                    search_term,
                    [x[0] for x in db_scientific_names],
                    scorer=fuzz.ratio,
                    limit=3
                )

                # Build new candidate lists
                search_common_candidates = []
                for match_name, score, _ in search_common_matches:
                    for db_name, db_id in db_common_names:
                        if db_name == match_name:
                            common_name, scientific_name = species_lookup[db_id]
                            search_common_candidates.append((db_id, common_name, scientific_name, score))
                            break

                search_scientific_candidates = []
                for match_name, score, _ in search_scientific_matches:
                    for sci_name, db_id in db_scientific_names:
                        if sci_name == match_name:
                            common_name, scientific_name = species_lookup[db_id]
                            search_scientific_candidates.append((db_id, common_name, scientific_name, score))
                            break

                if not search_common_candidates and not search_scientific_candidates:
                    logger.info("  No matches found for search term")
                    continue

                # Display search results
                logger.info("  Search results by common name:")
                search_option_num = 1
                search_options = []
                for db_id, common_name, scientific_name, score in search_common_candidates:
                    logger.info(f"    {search_option_num}. {common_name} ({scientific_name}) [score: {score:.0f}]")
                    search_options.append((db_id, common_name, scientific_name, score, "common name"))
                    search_option_num += 1

                logger.info("  Search results by scientific name:")
                for db_id, common_name, scientific_name, score in search_scientific_candidates:
                    logger.info(f"    {search_option_num}. {common_name} ({scientific_name}) [score: {score:.0f}]")
                    search_options.append((db_id, common_name, scientific_name, score, "scientific name"))
                    search_option_num += 1

                # Update options for next iteration
                all_options = search_options
                max_option = len(all_options)
                continue

            if response.isdigit():
                idx = int(response) - 1
                if 0 <= idx < max_option:
                    db_id, common_name, scientific_name, score, match_type = all_options[idx]
                    display_name = common_name or scientific_name
                    logger.info(f"  Accepted: {common_name} ({scientific_name})")
                    approved_matches.append(MatchResult(
                        parsed_species=parsed,
                        db_species_id=db_id,
                        db_species_name=display_name,
                        match_type="fuzzy",
                        fuzzy_score=score
                    ))
                    break
                else:
                    logger.info(f"  Invalid option. Enter 1-{max_option}, 's' to skip, or 'q' to quit")
            else:
                logger.info(f"  Invalid input. Enter 1-{max_option}, 's' to skip, 'q' to quit, or '?' to search")

        if quit_all:
            break

    logger.info(f"\nFuzzy matching complete: {len(approved_matches)} approved, {len(skipped)} skipped")
    return approved_matches


def display_results(results: list[MatchResult]) -> tuple[list[MatchResult], list[MatchResult]]:
    """Display matching results to user."""
    matched = [r for r in results if r.db_species_id]
    unmatched = [r for r in results if not r.db_species_id]

    logger.info("\n" + "="*80)
    logger.info("SPECIES MATCHING RESULTS")
    logger.info("="*80)
    logger.info(f"Total species in file: {len(results)}")
    logger.info(f"Matched to database: {len(matched)}")
    logger.info(f"Unmatched: {len(unmatched)}")

    # Count match types
    common_matches = sum(1 for r in matched if r.match_type == "common_name")
    scientific_matches = sum(1 for r in matched if r.match_type == "scientific_name")
    fuzzy_matches = sum(1 for r in matched if r.match_type == "fuzzy")
    logger.info(f"  - By common name: {common_matches}")
    logger.info(f"  - By scientific name: {scientific_matches}")
    if fuzzy_matches:
        logger.info(f"  - By fuzzy match: {fuzzy_matches}")

    # Show matched species (sample)
    if matched:
        logger.info("\n" + "-"*80)
        logger.info(f"MATCHED SPECIES ({len(matched)})")
        logger.info("-"*80)
        for r in matched[:20]:
            if r.match_type == "common_name":
                match_indicator = "(common name)"
            elif r.match_type == "scientific_name":
                match_indicator = "(scientific name)"
            else:
                match_indicator = f"(fuzzy, score={r.fuzzy_score})"
            logger.info(f"  + {r.parsed_species.common_name} -> {r.db_species_name} {match_indicator}")
        if len(matched) > 20:
            logger.info(f"  ... and {len(matched) - 20} more")

    # Show unmatched species (all - important!)
    if unmatched:
        logger.info("\n" + "-"*80)
        logger.info(f"UNMATCHED SPECIES ({len(unmatched)}) - WILL NOT BE IMPORTED")
        logger.info("-"*80)
        for r in unmatched:
            logger.info(f"  ! {r.parsed_species.common_name} ({r.parsed_species.scientific_name})")
            logger.info(f"    Section: {r.parsed_species.section}")

    logger.info("\n" + "="*80)
    return matched, unmatched


# ============================================================================
# DATABASE OPERATIONS
# ============================================================================

def create_survey_and_sightings(
    cursor,
    matched_results: list[MatchResult],
    dry_run: bool,
    year_config: dict,
) -> bool:
    """Create the survey and sightings in database."""
    survey_date = year_config["survey_date"]
    survey_notes = year_config["survey_notes"]

    if dry_run:
        # Count match types for summary
        exact_matches = sum(1 for r in matched_results if r.match_type in ("common_name", "scientific_name"))
        fuzzy_matches = sum(1 for r in matched_results if r.match_type == "fuzzy")

        logger.info("\n" + "="*80)
        logger.info("DRY-RUN MODE - SUMMARY")
        logger.info("="*80)
        logger.info("No changes made to database.")
        logger.info("")
        logger.info(f"{len(matched_results)} species would be imported:")
        logger.info(f"  - {exact_matches} exact matches")
        if fuzzy_matches:
            logger.info(f"  - {fuzzy_matches} fuzzy matches (user-approved)")
        logger.info("")
        logger.info(f"This would create:")
        logger.info(f"  - 1 survey (type: {SURVEY_TYPE_NAME}, date: {survey_date})")
        logger.info(f"  - {len(matched_results)} sightings (count=1 each)")
        logger.info("")
        logger.info("To apply changes, run with --no-dry-run flag.")
        logger.info("="*80 + "\n")
        return True

    # Final confirmation
    logger.info("\n" + "="*80)
    logger.info("FINAL CONFIRMATION REQUIRED")
    logger.info("="*80)
    logger.info("You are about to MODIFY THE DATABASE:")
    logger.info(f"  - Create 1 survey (type: {SURVEY_TYPE_NAME}, date: {survey_date})")
    logger.info(f"  - Create {len(matched_results)} sightings (count=1 each)")
    logger.info("")
    logger.info("This operation will commit changes to the database.")
    logger.info("="*80)

    response = input("\nType 'yes' to confirm and proceed: ").strip().lower()
    if response != 'yes':
        logger.info("\nImport cancelled by user")
        return False

    try:
        # Get survey type ID
        cursor.execute(
            "SELECT id FROM survey_type WHERE name = %s",
            (SURVEY_TYPE_NAME,)
        )
        row = cursor.fetchone()
        if not row:
            logger.error(f"Survey type '{SURVEY_TYPE_NAME}' not found!")
            return False
        survey_type_id = row[0]

        # Create the survey
        cursor.execute("""
            INSERT INTO survey (date, survey_type_id, location_id, notes)
            VALUES (%s, %s, %s, %s)
            RETURNING id
        """, (
            survey_date,
            survey_type_id,
            SURVEY_LOCATION,
            survey_notes,
        ))
        survey_id = cursor.fetchone()[0]
        logger.info(f"Created survey with ID {survey_id}")

        # Create sightings
        sightings_created = 0
        for result in matched_results:
            cursor.execute("""
                INSERT INTO sighting (survey_id, species_id, count, location_id)
                VALUES (%s, %s, %s, %s)
            """, (
                survey_id,
                result.db_species_id,
                1,  # Presence record = count of 1
                None  # No specific location
            ))
            sightings_created += 1

        logger.info(f"Created {sightings_created} sightings")

        logger.info("\n" + "="*80)
        logger.info("IMPORT SUCCESSFUL")
        logger.info("="*80)
        logger.info(f"Survey ID: {survey_id}")
        logger.info(f"Date: {survey_date}")
        logger.info(f"Survey Type: {SURVEY_TYPE_NAME}")
        logger.info(f"Sightings: {sightings_created}")
        logger.info("="*80 + "\n")

        return True

    except Exception as e:
        logger.error(f"Import failed: {e}")
        raise


# ============================================================================
# MAIN
# ============================================================================

def main(dry_run: bool = True, year: int = 2023):
    """Main script execution."""
    try:
        # Validate year
        if year not in YEAR_CONFIG:
            logger.error(f"Unsupported year: {year}. Supported years: {list(YEAR_CONFIG.keys())}")
            return 1

        year_config = YEAR_CONFIG[year]
        data_file = year_config["data_file"]

        # Print mode banner
        logger.info("\n" + "="*80)
        logger.info(f"IMPORTING JENNY'S {year} DATA")
        logger.info("="*80)

        if dry_run:
            logger.info("DRY-RUN MODE (Default)")
            logger.info("No database changes will be made.")
            logger.info("This is a safe preview of what would happen.")
            logger.info("Use --no-dry-run to apply changes to the database.")
        else:
            logger.info("LIVE MODE - DATABASE WRITES ENABLED")
            logger.info("This will make changes to the database!")
            logger.info("Confirmation will be required.")
        logger.info("="*80 + "\n")

        # Phase 1: Parse the docx file
        logger.info("="*80)
        logger.info("PHASE 1: PARSING DOCUMENT")
        logger.info("="*80)

        if not data_file.exists():
            logger.error(f"Data file not found: {data_file}")
            return 1

        parsed_species = parse_docx_file(data_file)

        if not parsed_species:
            logger.error("No species found in document")
            return 1

        # Preview parsed data
        preview_parsed_data(parsed_species)

        # Phase 2: Match against database
        logger.info("\n" + "="*80)
        logger.info("PHASE 2: MATCHING SPECIES (EXACT)")
        logger.info("="*80)

        with get_db_cursor() as cursor:
            results, db_species = match_species(parsed_species, cursor)
            matched, unmatched = display_results(results)

            # Phase 3: Fuzzy match unmatched species
            if unmatched:
                logger.info("\n" + "="*80)
                logger.info("PHASE 3: FUZZY MATCHING")
                logger.info("="*80)

                fuzzy_matches = fuzzy_match_unmatched(unmatched, db_species)

                if fuzzy_matches:
                    logger.info(f"\nAdded {len(fuzzy_matches)} fuzzy matches to import list")
                    matched.extend(fuzzy_matches)

                still_unmatched_count = len(unmatched) - len(fuzzy_matches)
                if still_unmatched_count > 0:
                    logger.info(f"{still_unmatched_count} species remain unmatched and will not be imported")

            # Phase 4: Confirm and import
            if matched:
                logger.info("\n" + "="*80)
                logger.info("PHASE 4: IMPORT")
                logger.info("="*80)

                success = create_survey_and_sightings(cursor, matched, dry_run, year_config)
                return 0 if success else 1
            else:
                logger.error("No species matched - nothing to import")
                return 1

    except KeyboardInterrupt:
        logger.info("\n\nInterrupted by user")
        return 1
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    parser = get_arg_parser(description=__doc__)
    parser.add_argument(
        '--year',
        type=int,
        default=2023,
        choices=list(YEAR_CONFIG.keys()),
        help='Year of data to import (default: 2023)'
    )
    args = parser.parse_args()
    exit_code = main(dry_run=args.dry_run, year=args.year)
    sys.exit(exit_code)
