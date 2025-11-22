"""
Match NBN Atlas species against database species using fuzzy matching.

This script:
1. Fetches species from NBN Atlas API
2. Fetches species from the database
3. Performs fuzzy matching to find corresponding species
4. Reports matches, unmatches, and low-confidence matches

Usage:
    python match_species.py --species-type birds       # Match bird species
    python match_species.py -s butterflies             # Match butterfly species
"""

import logging
import sys
from dataclasses import dataclass
from typing import Optional
from pathlib import Path

from rapidfuzz import fuzz, process

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from clients.nbn_atlas import NBNAtlasClient
from database.connection import get_db_cursor
from script_utils import get_arg_parser


logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)


# Configuration
MIN_OCCURRENCE = 100
MATCH_THRESHOLD_HIGH = 90  # High confidence match
MATCH_THRESHOLD_LOW = 70   # Low confidence match

# Species type configuration
SPECIES_CONFIG = {
    "birds": {
        "db_type": "bird",
        "api_filter": "taxonGroup_s:bird",
        "display_name": "Birds"
    },
    "butterflies": {
        "db_type": "butterfly",
        "api_filter": "taxonGroup_s:\"insect - butterfly\"",
        "display_name": "Butterflies"
    }
}

# Hardcoded mappings for species with different common names between DB and API
# Format: {species_type: {DB common name: API common name}}
HARDCODED_MAPPINGS = {
    "birds": {
        "Feral Pigeon": "Rock Dove",  # Feral Pigeon is commonly called Rock Dove in the API
    },
    "butterflies": {
        # Add butterfly mappings here as needed
    }
}


@dataclass
class APISpecies:
    """Species from NBN Atlas API"""
    common_name: str
    scientific_name: str
    occurrence_count: int


@dataclass
class DBSpecies:
    """Species from database"""
    id: int
    name: str  # Common name from DB
    conservation_status: Optional[str]


@dataclass
class MatchCandidate:
    """A potential match candidate"""
    api_species: APISpecies
    score: float
    field: str


@dataclass
class MatchResult:
    """Result of matching a DB species with API species"""
    db_species: DBSpecies
    api_species: Optional[APISpecies]
    match_score: float
    match_type: str  # "high_confidence", "low_confidence", "no_match"
    matched_field: Optional[str]  # Which field was matched
    top_candidates: list[MatchCandidate] = None  # Top N alternative matches


def fetch_api_species(species_type: str) -> list[APISpecies]:
    """Fetch species from NBN Atlas API based on species type."""
    config = SPECIES_CONFIG[species_type]
    logger.info(f"Fetching {config['display_name']} from NBN Atlas API...")

    client = NBNAtlasClient()
    try:
        raw_records = client.search_all(
            query="*:*",
            filter_query=config['api_filter'],
            page_size=100
        )

        api_species = []
        for record in raw_records:
            if (
                record.get('rank') == 'species' and
                record.get('commonNameSingle') and
                record.get('occurrenceCount', 0) >= MIN_OCCURRENCE
            ):
                api_species.append(APISpecies(
                    common_name=record['commonNameSingle'],
                    scientific_name=record['scientificName'],
                    occurrence_count=record.get('occurrenceCount', 0)
                ))

        logger.info(f"Found {len(api_species)} {config['display_name'].lower()} from API")
        return api_species

    finally:
        client.close()


def fetch_db_species(species_type: str) -> list[DBSpecies]:
    """Fetch species from database based on species type."""
    config = SPECIES_CONFIG[species_type]
    logger.info(f"Fetching {config['display_name'].lower()} from database...")

    with get_db_cursor() as cursor:
        cursor.execute("""
            SELECT id, name, conservation_status
            FROM species
            WHERE type = %s
            ORDER BY name
        """, (config['db_type'],))
        rows = cursor.fetchall()

        db_species = [
            DBSpecies(
                id=row[0],
                name=row[1],
                conservation_status=row[2]
            )
            for row in rows
        ]

    logger.info(f"Found {len(db_species)} {config['display_name'].lower()} in database")
    return db_species


def fuzzy_match_species(
    db_species: DBSpecies,
    api_species_list: list[APISpecies],
    species_type: str,
    top_n: int = 3
) -> MatchResult:
    """
    Find the best match for a DB species in the API species list.

    Matches against both common names and scientific names.
    Returns the best match with score and type, plus top N candidates.
    """
    # Check for hardcoded mapping first
    search_name = db_species.name
    used_hardcoded_mapping = False
    if db_species.name in HARDCODED_MAPPINGS.get(species_type, {}):
        search_name = HARDCODED_MAPPINGS[species_type][db_species.name]
        used_hardcoded_mapping = True
        logger.info(f"Using hardcoded mapping: '{db_species.name}' -> '{search_name}'")

    # Build search lists
    api_common_names = [s.common_name for s in api_species_list]
    api_scientific_names = [s.scientific_name for s in api_species_list]

    # Get top matches on common name
    common_matches = process.extract(
        search_name,
        api_common_names,
        scorer=fuzz.ratio,
        limit=top_n
    )

    # Try matching on scientific name (if DB name looks scientific)
    # Scientific names typically have two words and may include parentheses
    words = search_name.split()
    is_scientific = len(words) >= 2 and words[0][0].isupper()

    scientific_matches = []
    if is_scientific:
        scientific_matches = process.extract(
            search_name,
            api_scientific_names,
            scorer=fuzz.ratio,
            limit=top_n
        )

    # Collect all candidates
    all_candidates = []

    for match in common_matches:
        all_candidates.append(MatchCandidate(
            api_species=api_species_list[match[2]],
            score=match[1],
            field="common_name"
        ))

    for match in scientific_matches:
        all_candidates.append(MatchCandidate(
            api_species=api_species_list[match[2]],
            score=match[1],
            field="scientific_name"
        ))

    # Sort by score and get top N unique candidates
    all_candidates.sort(key=lambda x: x.score, reverse=True)

    # Remove duplicates (keep highest score for each species)
    seen_species = set()
    unique_candidates = []
    for candidate in all_candidates:
        species_key = candidate.api_species.scientific_name
        if species_key not in seen_species:
            seen_species.add(species_key)
            unique_candidates.append(candidate)
            if len(unique_candidates) >= top_n:
                break

    # Best match is the top candidate
    best_candidate = unique_candidates[0] if unique_candidates else None
    best_match = best_candidate.api_species if best_candidate else None
    best_score = best_candidate.score if best_candidate else 0
    matched_field = best_candidate.field if best_candidate else None

    # Add hardcoded mapping indicator to matched_field
    if used_hardcoded_mapping and matched_field:
        matched_field = f"{matched_field} (hardcoded mapping)"

    # Determine match type
    if best_score >= MATCH_THRESHOLD_HIGH:
        match_type = "high_confidence"
    elif best_score >= MATCH_THRESHOLD_LOW:
        match_type = "low_confidence"
    else:
        match_type = "no_match"

    return MatchResult(
        db_species=db_species,
        api_species=best_match if best_score >= MATCH_THRESHOLD_LOW else None,
        match_score=best_score,
        match_type=match_type,
        matched_field=matched_field,
        top_candidates=unique_candidates
    )


def match_all_species(
    db_species: list[DBSpecies],
    api_species: list[APISpecies],
    species_type: str
) -> list[MatchResult]:
    """Match all DB species against API species."""
    logger.info("Matching DB species against API species...")

    results = []
    for db_sp in db_species:
        result = fuzzy_match_species(db_sp, api_species, species_type)
        results.append(result)

    return results


def report_results(results: list[MatchResult]):
    """Print formatted report of matching results."""
    # Categorize results
    high_confidence = [r for r in results if r.match_type == "high_confidence"]
    low_confidence = [r for r in results if r.match_type == "low_confidence"]
    no_match = [r for r in results if r.match_type == "no_match"]

    # Print summary
    logger.info("\n" + "="*80)
    logger.info("MATCHING RESULTS SUMMARY")
    logger.info("="*80)
    logger.info(f"Total DB species: {len(results)}")
    logger.info(f"High confidence matches: {len(high_confidence)} ({len(high_confidence)/len(results)*100:.1f}%)")
    logger.info(f"Low confidence matches: {len(low_confidence)} ({len(low_confidence)/len(results)*100:.1f}%)")
    logger.info(f"No match found: {len(no_match)} ({len(no_match)/len(results)*100:.1f}%)")

    # Print high confidence matches
    if high_confidence:
        logger.info("\n" + "-"*80)
        logger.info(f"HIGH CONFIDENCE MATCHES ({len(high_confidence)})")
        logger.info("-"*80)
        for r in high_confidence[:10]:  # Show first 10
            logger.info(f"✓ {r.db_species.name}")
            logger.info(f"  → {r.api_species.common_name} ({r.api_species.scientific_name})")
            logger.info(f"  Score: {r.match_score:.1f} | Matched on: {r.matched_field}")
        if len(high_confidence) > 10:
            logger.info(f"  ... and {len(high_confidence) - 10} more")

    # Print low confidence matches
    if low_confidence:
        logger.info("\n" + "-"*80)
        logger.info(f"LOW CONFIDENCE MATCHES ({len(low_confidence)}) - REVIEW NEEDED")
        logger.info("-"*80)
        for r in low_confidence:
            logger.info(f"⚠ {r.db_species.name}")
            logger.info(f"  → {r.api_species.common_name} ({r.api_species.scientific_name})")
            logger.info(f"  Score: {r.match_score:.1f} | Matched on: {r.matched_field}")
            if r.top_candidates and len(r.top_candidates) > 1:
                logger.info(f"  Other candidates:")
                for i, candidate in enumerate(r.top_candidates[1:3], 2):
                    logger.info(f"    {i}. {candidate.api_species.common_name} ({candidate.api_species.scientific_name})")
                    logger.info(f"       Score: {candidate.score:.1f} | Field: {candidate.field}")

    # Print no matches (these are problems!)
    if no_match:
        logger.info("\n" + "-"*80)
        logger.info(f"NO MATCHES FOUND ({len(no_match)}) - ACTION REQUIRED")
        logger.info("-"*80)
        for r in no_match:
            logger.info(f"✗ {r.db_species.name} (ID: {r.db_species.id})")
            logger.info(f"  Best score was: {r.match_score:.1f} (below threshold)")
            if r.top_candidates:
                logger.info(f"  Top candidates:")
                for i, candidate in enumerate(r.top_candidates[:3], 1):
                    logger.info(f"    {i}. {candidate.api_species.common_name} ({candidate.api_species.scientific_name})")
                    logger.info(f"       Score: {candidate.score:.1f} | Field: {candidate.field}")

    logger.info("\n" + "="*80)


def main(species_type: str):
    """
    Main script execution.

    Args:
        species_type: Type of species to match (e.g., 'birds' or 'butterflies')
    """
    try:
        config = SPECIES_CONFIG[species_type]
        logger.info(f"\n{'='*80}")
        logger.info(f"MATCHING {config['display_name'].upper()}")
        logger.info(f"{'='*80}\n")

        # Step 1: Fetch API species
        api_species = fetch_api_species(species_type)
        if not api_species:
            logger.error(f"No {config['display_name'].lower()} fetched from API. Exiting.")
            return

        # Step 2: Fetch DB species
        db_species = fetch_db_species(species_type)
        if not db_species:
            logger.warning(f"No {config['display_name'].lower()} found in database. Nothing to match.")
            return

        # Step 3: Match species
        results = match_all_species(db_species, api_species, species_type)

        # Step 4: Report results
        report_results(results)

    except Exception as e:
        logger.error(f"Error during matching: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    # Parse command-line arguments
    parser = get_arg_parser(description=__doc__)
    parser.add_argument(
        "--species-type",
        "-s",
        required=True,
        choices=list(SPECIES_CONFIG.keys()),
        help="Type of species to match, e.g. 'birds' or 'butterflies'"
    )
    args = parser.parse_args()

    main(args.species_type)
