"""
Populate species_code column for bird species using BTO 2-letter codes.

This script matches bird species in the database against the BTO species code list
(parsed from BTO_Species_Codes.xlsx) and populates the species_code column.

Usage:
    ./run staging populate_species_codes.py              # Dry-run (preview only)
    ./run staging populate_species_codes.py --no-dry-run # Apply to database
"""

import sys
from dataclasses import dataclass
from pathlib import Path
from difflib import SequenceMatcher

import openpyxl

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.connection import get_db_cursor
from script_utils import get_arg_parser

XLSX_PATH = Path(__file__).parent / "data" / "BTO_Species_Codes.xlsx"


@dataclass
class FuzzyCandidate:
    """A potential fuzzy match candidate."""
    db_name: str
    db_id: int
    score: float


@dataclass
class PendingFuzzyMatch:
    """A BTO species that needs fuzzy matching review."""
    bto_name: str
    code: str
    top_candidates: list[FuzzyCandidate]


def parse_bto_species_codes(xlsx_path: Path) -> dict[str, str]:
    """
    Parse the BTO species codes Excel file and return a dict of {common_name: 2-letter code}.

    Only includes entries that have both a 2-letter code and a 5-letter code
    (skips subspecies which lack 5-letter codes).
    """
    species_codes = {}

    wb = openpyxl.load_workbook(xlsx_path, read_only=True)
    ws = wb.active

    for row in ws.iter_rows(min_row=2, values_only=True):
        common_name, _, two_letter_code, five_letter_code = row

        # Skip subspecies (no 5-letter code) and entries without 2-letter codes
        if not common_name or not two_letter_code or not five_letter_code:
            continue

        species_codes[common_name.strip()] = two_letter_code.strip()

    wb.close()
    return species_codes


def normalize_name(name: str) -> str:
    """Normalize a species name for matching."""
    if not name:
        return ""
    # Convert to lowercase and strip whitespace
    normalized = name.lower().strip()
    # Remove common prefixes that might differ
    prefixes_to_remove = ["common ", "eurasian ", "european ", "northern ", "western "]
    for prefix in prefixes_to_remove:
        if normalized.startswith(prefix):
            normalized = normalized[len(prefix):]
    return normalized


def get_fuzzy_candidates(
    name: str,
    db_birds_by_name: dict,
    threshold: float = 0.6,
    top_n: int = 3
) -> list[FuzzyCandidate]:
    """
    Find the top N fuzzy match candidates for a name.

    Returns list of FuzzyCandidate sorted by score descending.
    Only includes candidates above the threshold.
    """
    normalized_name = normalize_name(name)
    candidates = []

    for db_name, (db_id, _) in db_birds_by_name.items():
        normalized_candidate = normalize_name(db_name)
        ratio = SequenceMatcher(None, normalized_name, normalized_candidate).ratio()
        if ratio >= threshold:
            candidates.append(FuzzyCandidate(
                db_name=db_name,
                db_id=db_id,
                score=ratio
            ))

    # Sort by score descending and return top N
    candidates.sort(key=lambda x: x.score, reverse=True)
    return candidates[:top_n]


def review_fuzzy_matches(
    pending_fuzzy: list[PendingFuzzyMatch],
    updated_species: set[int],
    assigned_codes: set[str]
) -> list[tuple[int, str, str, str]]:
    """
    Interactively review fuzzy matches.

    Returns list of (db_id, code, bto_name, db_name) tuples for approved matches.
    """
    if not pending_fuzzy:
        return []

    print("\n" + "=" * 60)
    print(f"REVIEW FUZZY MATCHES ({len(pending_fuzzy)}) - BTO -> DB")
    print("=" * 60)
    print("For each BTO species, select the correct DB match:")
    print("  - Enter a number [1-3] to select a candidate")
    print("  - Enter [s] to skip this species")
    print("=" * 60 + "\n")

    approved = []

    for i, pending in enumerate(pending_fuzzy, 1):
        # Skip if code was assigned during this review session (another variant matched)
        if pending.code in assigned_codes:
            print(f"\n[{i}/{len(pending_fuzzy)}] bto_name: {pending.bto_name} | code: {pending.code}")
            print("     (Skipped - code already assigned)")
            continue

        print(f"\n[{i}/{len(pending_fuzzy)}] bto_name: {pending.bto_name} | code: {pending.code}")
        print("     DB candidates:")

        valid_candidates = []
        for j, candidate in enumerate(pending.top_candidates, 1):
            # Skip candidates that have already been assigned a code
            if candidate.db_id in updated_species:
                print(f"       [{j}] db_name: {candidate.db_name} (score: {candidate.score:.2f}) - ALREADY ASSIGNED")
            else:
                valid_candidates.append((j, candidate))
                print(f"       [{j}] db_name: {candidate.db_name} (score: {candidate.score:.2f})")

        if not valid_candidates:
            print("     (No valid DB candidates - all already assigned)")
            continue

        while True:
            response = input(f"\n  Choice [1-{len(pending.top_candidates)}/s]: ").strip().lower()

            if response == 's':
                print(f"  Skipped: {pending.bto_name}")
                break
            elif response.isdigit():
                idx = int(response)
                if 1 <= idx <= len(pending.top_candidates):
                    selected = pending.top_candidates[idx - 1]
                    if selected.db_id in updated_species:
                        print(f"  ✗ db_name: {selected.db_name} already has a code assigned. Choose another.")
                    else:
                        approved.append((selected.db_id, pending.code, pending.bto_name, selected.db_name))
                        updated_species.add(selected.db_id)
                        assigned_codes.add(pending.code)
                        print(f"  ✓ bto_name: {pending.bto_name} -> db_name: {selected.db_name} -> code: {pending.code}")
                        break
                else:
                    print(f"  Invalid number. Please enter 1-{len(pending.top_candidates)} or 's'")
            else:
                print("  Please enter a valid number or 's' to skip")

    print(f"\n{'=' * 60}")
    print(f"Approved {len(approved)} fuzzy matches")
    print("=" * 60)

    return approved


def populate_species_codes(dry_run: bool = True):
    """Populate species_code for bird species in the database."""

    # Parse Excel file to get species codes
    print(f"Parsing: {XLSX_PATH}")
    bto_codes = parse_bto_species_codes(XLSX_PATH)
    print(f"Parsed {len(bto_codes)} species with 2-letter codes from BTO spreadsheet")

    with get_db_cursor() as cursor:
        # Get all bird species from database
        cursor.execute("SELECT species.id, species.name, species.scientific_name FROM species JOIN species_type ON species.species_type_id = species_type.id WHERE species_type.name = 'bird'")
        birds = cursor.fetchall()

        # Build lookup dict: name -> (id, scientific_name)
        db_birds_by_name = {bird[1]: (bird[0], bird[2]) for bird in birds if bird[1]}

        print(f"Found {len(birds)} bird species in database")
        print("-" * 50)

        # Phase 1: Find exact matches and collect fuzzy candidates
        print("\nPhase 1: Finding exact matches (BTO -> DB)...")
        exact_matches = []  # List of (db_id, code, bto_name, db_name)
        pending_fuzzy = []  # List of PendingFuzzyMatch for later review
        unmatched_bto = []
        updated_species = set()  # Track which DB species we've matched
        assigned_codes = set()  # Track which codes have been assigned

        for bto_name, code in bto_codes.items():
            # Skip if this code has already been assigned
            if code in assigned_codes:
                continue

            # Try exact match first
            if bto_name in db_birds_by_name:
                bird_id, _ = db_birds_by_name[bto_name]
                if bird_id not in updated_species:
                    exact_matches.append((bird_id, code, bto_name, bto_name))
                    updated_species.add(bird_id)
                    assigned_codes.add(code)
                    print(f"  ✓ bto_name: {bto_name} -> db_name: {bto_name} -> code: {code} (exact)")
            else:
                # Get fuzzy candidates for later review
                candidates = get_fuzzy_candidates(bto_name, db_birds_by_name)
                if candidates:
                    pending_fuzzy.append(PendingFuzzyMatch(
                        bto_name=bto_name,
                        code=code,
                        top_candidates=candidates
                    ))
                else:
                    unmatched_bto.append(bto_name)

        # Filter out pending fuzzy matches where the code was already assigned via exact match
        pending_fuzzy = [p for p in pending_fuzzy if p.code not in assigned_codes]

        print("-" * 50)
        print(f"Exact matches: {len(exact_matches)}")
        print(f"Pending fuzzy review: {len(pending_fuzzy)}")
        print(f"No candidates found: {len(unmatched_bto)}")

        # Phase 2: Interactive fuzzy match review
        fuzzy_approved = []
        if pending_fuzzy:
            fuzzy_approved = review_fuzzy_matches(pending_fuzzy, updated_species, assigned_codes)

        # Summary
        print("\n" + "=" * 50)
        print("SUMMARY")
        print("=" * 50)
        print(f"Exact matches: {len(exact_matches)}")
        print(f"Fuzzy matches approved: {len(fuzzy_approved)}")
        print(f"Total to update: {len(exact_matches) + len(fuzzy_approved)}")

        if unmatched_bto:
            print(f"\nBTO species with no DB candidates ({len(unmatched_bto)}):")
            for name in sorted(unmatched_bto):
                print(f"  - {name}")

        # Phase 3: Apply updates
        if dry_run:
            print("\n[DRY RUN - no changes made]")
        else:
            print("\nApplying updates...")
            # Apply exact matches
            for db_id, code, bto_name, db_name in exact_matches:
                cursor.execute(
                    "UPDATE species SET species_code = %s WHERE id = %s",
                    (code, db_id)
                )

            # Apply approved fuzzy matches
            for db_id, code, bto_name, db_name in fuzzy_approved:
                cursor.execute(
                    "UPDATE species SET species_code = %s WHERE id = %s",
                    (code, db_id)
                )

            print(f"\n[Updated {len(exact_matches) + len(fuzzy_approved)} species in database]")


if __name__ == "__main__":
    parser = get_arg_parser(
        description="Populate species_code column for bird species using BTO 2-letter codes"
    )
    args = parser.parse_args()

    populate_species_codes(dry_run=args.dry_run)
