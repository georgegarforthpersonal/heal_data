"""
Clean up duplicate insect records.

This script removes species records with type='insect' that also exist
in other specific insect groups (beetles, flies, bees-wasps-ants, bugs,
dragonflies-damselflies, grasshoppers-crickets).

Usage:
    ./dev-run cleanup_duplicate_insects.py                     # Dry-run (preview only)
    ./dev-run cleanup_duplicate_insects.py --no-dry-run --yes  # Apply to database

Defaults to dry-run mode. Use --no-dry-run to write to database.
Use --yes to skip the confirmation prompt.
"""

import logging
import sys
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


# Specific insect group types to check against
SPECIFIC_INSECT_TYPES = [
    'beetle',
    'fly',
    'bee-wasp-ant',
    'bug',
    'dragonfly-damselfly',
    'grasshopper-cricket'
]


def find_duplicate_insects():
    """
    Find all 'insect' type records that have duplicates in specific insect groups.
    Returns list of tuples: (insect_id, insect_name, duplicate_type, duplicate_id)
    """
    with get_db_cursor() as cursor:
        # Find insects that have duplicates in other specific groups
        # Match by scientific_name (most reliable identifier)
        cursor.execute("""
            SELECT
                i.id as insect_id,
                i.name as insect_name,
                i.scientific_name,
                s.id as duplicate_id,
                s.type as duplicate_type,
                s.name as duplicate_name
            FROM species i
            INNER JOIN species s ON i.scientific_name = s.scientific_name
            WHERE i.type = 'insect'
                AND s.type IN %s
                AND i.id != s.id
            ORDER BY i.scientific_name, s.type
        """, (tuple(SPECIFIC_INSECT_TYPES),))

        results = cursor.fetchall()

        duplicates = []
        for row in results:
            duplicates.append({
                'insect_id': row[0],
                'insect_name': row[1],
                'scientific_name': row[2],
                'duplicate_id': row[3],
                'duplicate_type': row[4],
                'duplicate_name': row[5]
            })

        return duplicates


def migrate_sightings(insect_id: int, target_species_id: int, dry_run: bool):
    """
    Migrate sightings from insect to target species.
    """
    if dry_run:
        return 0

    with get_db_cursor() as cursor:
        cursor.execute("""
            UPDATE sighting
            SET species_id = %s
            WHERE species_id = %s
        """, (target_species_id, insect_id))

        return cursor.rowcount


def delete_duplicate_insects(insect_groups: dict, dry_run: bool):
    """
    Delete insect records by ID, migrating any sightings first.
    """
    if dry_run:
        logger.info("\nDRY-RUN MODE: No records will be deleted")
        return 0

    if not insect_groups:
        return 0

    total_sightings_migrated = 0

    # First, migrate any sightings from insect records to their specific counterparts
    for insect_id, info in insect_groups.items():
        # Use the first duplicate as the target (they're all the same species)
        target_id = info['duplicates'][0]['id']

        sightings_migrated = migrate_sightings(insect_id, target_id, dry_run)
        if sightings_migrated > 0:
            total_sightings_migrated += sightings_migrated
            logger.info(f"  Migrated {sightings_migrated} sightings from insect {insect_id} to {info['duplicates'][0]['type']} {target_id}")

    if total_sightings_migrated > 0:
        logger.info(f"✓ Total sightings migrated: {total_sightings_migrated}")

    # Now delete the duplicate insect records
    insect_ids = list(insect_groups.keys())
    with get_db_cursor() as cursor:
        cursor.execute("""
            DELETE FROM species
            WHERE id IN %s
        """, (tuple(insect_ids),))

        deleted_count = cursor.rowcount
        logger.info(f"✓ Deleted {deleted_count} duplicate insect records")
        return deleted_count


def main(dry_run: bool = True, confirm: bool = False):
    """
    Main cleanup execution.
    """
    try:
        logger.info("="*80)
        if dry_run:
            logger.info("DRY-RUN MODE - PREVIEW ONLY")
        else:
            logger.info("⚠️  LIVE MODE - WILL DELETE RECORDS")
        logger.info("="*80)
        logger.info("")

        # Find duplicates
        logger.info("Searching for duplicate insect records...")
        duplicates = find_duplicate_insects()

        if not duplicates:
            logger.info("\n✓ No duplicate insect records found!")
            logger.info("All insect records are unique.")
            return 0

        # Group duplicates by insect record
        insect_groups = {}
        for dup in duplicates:
            insect_id = dup['insect_id']
            if insect_id not in insect_groups:
                insect_groups[insect_id] = {
                    'name': dup['insect_name'],
                    'scientific_name': dup['scientific_name'],
                    'duplicates': []
                }
            insect_groups[insect_id]['duplicates'].append({
                'type': dup['duplicate_type'],
                'name': dup['duplicate_name'],
                'id': dup['duplicate_id']
            })

        # Report findings
        logger.info(f"\nFound {len(insect_groups)} insect records with duplicates:")
        logger.info("-"*80)

        for insect_id, info in insect_groups.items():
            logger.info(f"\nInsect ID {insect_id}: {info['name']}")
            logger.info(f"  Scientific: {info['scientific_name']}")
            logger.info(f"  Also exists as:")
            for dup in info['duplicates']:
                logger.info(f"    - {dup['type']}: {dup['name']} (ID: {dup['id']})")

        logger.info("\n" + "="*80)
        logger.info("SUMMARY")
        logger.info("="*80)
        logger.info(f"Total 'insect' records to delete: {len(insect_groups)}")
        logger.info(f"These will remain in their specific groups (beetles, flies, etc.)")
        logger.info("="*80)

        if not dry_run:
            # Confirm deletion
            if not confirm:
                logger.info("\n⚠️  WARNING: About to delete records from the database!")
                response = input("\nType 'yes' to confirm deletion: ").strip().lower()

                if response != 'yes':
                    logger.info("\n✗ Deletion cancelled by user")
                    return 0

            # Delete duplicates (migrating sightings first)
            logger.info("\nMigrating sightings and deleting duplicate insect records...")
            delete_duplicate_insects(insect_groups, dry_run)
            logger.info("\n✓ Cleanup complete!")
        else:
            logger.info("\nRun with --no-dry-run --yes to delete these records")

        return 0

    except Exception as e:
        logger.error(f"\n✗ Error: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    parser = get_arg_parser(description=__doc__)
    parser.add_argument(
        '--yes',
        action='store_true',
        help='Skip confirmation prompt (for non-interactive use)'
    )
    args = parser.parse_args()

    exit_code = main(dry_run=args.dry_run, confirm=args.yes)
    sys.exit(exit_code)
