"""
Import Jenny's 2023 species data from appendix document.

Reads species observations from a Word document and creates sightings
against a single survey record.

Usage:
    ./dev-run import_jenny_2023.py              # Dry-run (preview only)
    ./dev-run import_jenny_2023.py --no-dry-run # Apply to database

Defaults to dry-run mode. Use --no-dry-run to write to database.
"""

import logging
import sys
from pathlib import Path
from dataclasses import dataclass
from typing import Optional

from docx import Document

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
SURVEY_DATE = "2023-12-31"
SURVEY_LOCATION = None

# Data File
DATA_FILE = Path(__file__).parent / "data" / "Heal Somerset Appendix 2023.docx"

# Section headers that indicate start of species lists
SECTION_HEADERS = {
    "Lepidoptera - Macro Moths",
    "Lepidoptera - Butterflies",
    "Coleoptera - Beetles",
    "Diptera - Flies",
    "Hemiptera - Bugs",
    "Hymenoptera",
    "Odonata",
    "Orthoptera",
    "Galls",
    "Arachnids",
    "Non Lepidoptera mines",
    "Trichoptera",
    "Psocoptera",
}

# Phrases that indicate end of species data (must be at start of line)
STOP_PHRASES = ["for interest", "here are some photos"]


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
    match_type: str  # "common_name", "scientific_name", "no_match"


# ============================================================================
# PARSING FUNCTIONS
# ============================================================================

def looks_like_scientific_name(text: str) -> bool:
    """
    Check if text looks like a scientific name (Genus species format).

    Scientific names typically:
    - Have at least 2 words
    - Genus is capitalized
    - Species epithet is lowercase
    """
    parts = text.split()
    if len(parts) < 2:
        return False
    # Genus is capitalized, species is lowercase
    return parts[0][0].isupper() and len(parts[1]) > 0 and parts[1][0].islower()


def is_section_header(text: str) -> Optional[str]:
    """Check if text is a section header and return normalized version."""
    text_stripped = text.strip()
    for header in SECTION_HEADERS:
        if text_stripped.startswith(header) or header in text_stripped:
            return header
    return None


def should_stop_parsing(text: str) -> bool:
    """Check if we've reached content that indicates end of species data."""
    text_lower = text.lower()
    return any(phrase in text_lower for phrase in STOP_PHRASES)


def extract_all_text_elements(doc) -> list[str]:
    """
    Extract all text elements from a Word document, including tables.

    Returns text in document order, handling both paragraphs and table cells.
    """
    elements = []

    # Iterate through the document body's XML to maintain order
    from docx.document import Document as DocxDocument
    from docx.oxml.ns import qn

    body = doc.element.body
    for child in body:
        if child.tag == qn('w:p'):  # Paragraph
            text = child.text
            if text:
                # Get full paragraph text including runs
                para_text = ''.join(node.text or '' for node in child.iter(qn('w:t')))
                if para_text.strip():
                    elements.append(para_text.strip())
        elif child.tag == qn('w:tbl'):  # Table
            # Process table rows
            for row in child.iter(qn('w:tr')):
                for cell in row.iter(qn('w:tc')):
                    cell_text = ''.join(node.text or '' for node in cell.iter(qn('w:t')))
                    if cell_text.strip():
                        elements.append(cell_text.strip())

    return elements


def parse_docx_file(file_path: Path) -> list[ParsedSpecies]:
    """
    Parse the docx file and extract species records.

    The document has sections followed by alternating entries:
    scientific name, then common name (may be in tables or paragraphs).
    """
    logger.info(f"Reading document: {file_path}")

    doc = Document(file_path)

    # Extract all text elements in order (paragraphs and table cells)
    all_text = extract_all_text_elements(doc)
    logger.info(f"Extracted {len(all_text)} text elements from document")

    species_list = []
    current_section = None
    pending_scientific_name = None

    for text in all_text:
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
            pending_scientific_name = None
            logger.debug(f"Entered section: {section}")
            continue

        # Skip content before first section
        if current_section is None:
            continue

        # Skip metadata lines (but allow longer common names with descriptions)
        if text.startswith("By"):
            continue

        # Handle species entry (alternating scientific/common names)
        if pending_scientific_name is None:
            # This should be a scientific name
            if looks_like_scientific_name(text):
                pending_scientific_name = text
        else:
            # This should be the common name - clean up any extra whitespace
            common_name = ' '.join(text.split())
            # Remove trailing observation notes like "– adult daytime observation"
            if ' – ' in common_name:
                common_name = common_name.split(' – ')[0].strip()

            species_list.append(ParsedSpecies(
                scientific_name=pending_scientific_name,
                common_name=common_name,
                section=current_section,
            ))
            pending_scientific_name = None

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

def match_species(parsed_list: list[ParsedSpecies], cursor) -> list[MatchResult]:
    """
    Match parsed species against database.

    Strategy:
    1. Try exact match on Species.name (common name) - case insensitive
    2. If no match, try exact match on Species.scientific_name - case insensitive
    3. If no match, report as unmatched
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

    return results


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
    logger.info(f"  - By common name: {common_matches}")
    logger.info(f"  - By scientific name: {scientific_matches}")

    # Show matched species (sample)
    if matched:
        logger.info("\n" + "-"*80)
        logger.info(f"MATCHED SPECIES ({len(matched)})")
        logger.info("-"*80)
        for r in matched[:20]:
            match_indicator = "(common name)" if r.match_type == "common_name" else "(scientific name)"
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
    dry_run: bool
) -> bool:
    """Create the survey and sightings in database."""

    if dry_run:
        logger.info("\n" + "="*80)
        logger.info("DRY-RUN MODE - SUMMARY")
        logger.info("="*80)
        logger.info("No changes made to database.")
        logger.info(f"Would create 1 survey dated {SURVEY_DATE}")
        logger.info(f"Would create {len(matched_results)} sightings (count=1 each)")
        logger.info("")
        logger.info("To apply changes, run with --no-dry-run flag.")
        logger.info("="*80 + "\n")
        return True

    # Final confirmation
    logger.info("\n" + "="*80)
    logger.info("FINAL CONFIRMATION REQUIRED")
    logger.info("="*80)
    logger.info("You are about to MODIFY THE DATABASE:")
    logger.info(f"  - Create 1 survey (type: {SURVEY_TYPE_NAME}, date: {SURVEY_DATE})")
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
            SURVEY_DATE,
            survey_type_id,
            SURVEY_LOCATION,
            "Jenny's 2023 species observations imported from appendix document"
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
        logger.info(f"Date: {SURVEY_DATE}")
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

def main(dry_run: bool = True):
    """Main script execution."""
    try:
        # Print mode banner
        if dry_run:
            logger.info("\n" + "="*80)
            logger.info("DRY-RUN MODE (Default)")
            logger.info("="*80)
            logger.info("No database changes will be made.")
            logger.info("This is a safe preview of what would happen.")
            logger.info("Use --no-dry-run to apply changes to the database.")
            logger.info("="*80 + "\n")
        else:
            logger.info("\n" + "="*80)
            logger.info("LIVE MODE - DATABASE WRITES ENABLED")
            logger.info("="*80)
            logger.info("This will make changes to the database!")
            logger.info("Confirmation will be required.")
            logger.info("="*80 + "\n")

        # Phase 1: Parse the docx file
        logger.info("="*80)
        logger.info("PHASE 1: PARSING DOCUMENT")
        logger.info("="*80)

        if not DATA_FILE.exists():
            logger.error(f"Data file not found: {DATA_FILE}")
            return 1

        parsed_species = parse_docx_file(DATA_FILE)

        if not parsed_species:
            logger.error("No species found in document")
            return 1

        # Preview parsed data
        preview_parsed_data(parsed_species)

        # Phase 2: Match against database
        logger.info("\n" + "="*80)
        logger.info("PHASE 2: MATCHING SPECIES")
        logger.info("="*80)

        with get_db_cursor() as cursor:
            results = match_species(parsed_species, cursor)
            matched, unmatched = display_results(results)

            # Phase 3: Confirm and import
            if matched:
                logger.info("\n" + "="*80)
                logger.info("PHASE 3: IMPORT")
                logger.info("="*80)

                success = create_survey_and_sightings(cursor, matched, dry_run)
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
    args = parser.parse_args()
    exit_code = main(dry_run=args.dry_run)
    sys.exit(exit_code)
