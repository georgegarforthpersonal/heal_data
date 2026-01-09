"""
Delete all surveys that contain butterfly sightings.

This script finds all surveys that have at least one butterfly sighting,
then deletes all sightings from those surveys and the surveys themselves.

Usage:
    ./dev-run delete_butterfly_surveys.py                     # Dry-run (preview only)
    ./dev-run delete_butterfly_surveys.py --no-dry-run --yes  # Apply to database

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


def find_butterfly_surveys():
    """
    Find all surveys that contain at least one butterfly sighting.
    Returns list of dicts with survey info.
    """
    with get_db_cursor() as cursor:
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
            ORDER BY survey.date DESC
        """)

        results = cursor.fetchall()

        surveys = []
        for row in results:
            surveys.append({
                'id': row[0],
                'date': row[1],
                'sighting_count': row[2]
            })

        return surveys


def count_sightings_to_delete(survey_ids: list[int]) -> int:
    """Count total sightings that will be deleted for the given survey IDs."""
    if not survey_ids:
        return 0

    with get_db_cursor() as cursor:
        cursor.execute("""
            SELECT COUNT(*) FROM sighting
            WHERE survey_id = ANY(%s)
        """, (survey_ids,))
        return cursor.fetchone()[0]


def delete_sightings(survey_ids: list[int]) -> int:
    """Delete all sightings for the given survey IDs."""
    if not survey_ids:
        return 0

    with get_db_cursor() as cursor:
        cursor.execute("""
            DELETE FROM sighting
            WHERE survey_id = ANY(%s)
        """, (survey_ids,))
        return cursor.rowcount


def delete_surveys(survey_ids: list[int]) -> int:
    """Delete surveys by ID."""
    if not survey_ids:
        return 0

    with get_db_cursor() as cursor:
        cursor.execute("""
            DELETE FROM survey
            WHERE id = ANY(%s)
        """, (survey_ids,))
        return cursor.rowcount


def main(dry_run: bool = True, confirm: bool = False):
    """Main deletion execution."""
    try:
        logger.info("=" * 80)
        if dry_run:
            logger.info("DRY-RUN MODE - PREVIEW ONLY")
        else:
            logger.info("LIVE MODE - WILL DELETE RECORDS")
        logger.info("=" * 80)
        logger.info("")

        # Find butterfly surveys
        logger.info("Searching for surveys with butterfly sightings...")
        surveys = find_butterfly_surveys()

        if not surveys:
            logger.info("\nNo surveys with butterfly sightings found!")
            return 0

        survey_ids = [s['id'] for s in surveys]
        total_sightings = count_sightings_to_delete(survey_ids)

        # Report findings
        logger.info(f"\nFound {len(surveys)} surveys with butterfly sightings:")
        logger.info("-" * 80)

        for survey in surveys[:20]:
            logger.info(
                f"  Survey {survey['id']}: {survey['date']} "
                f"({survey['sighting_count']} butterfly sightings)"
            )

        if len(surveys) > 20:
            logger.info(f"  ... and {len(surveys) - 20} more surveys")

        logger.info("\n" + "=" * 80)
        logger.info("SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Surveys to delete: {len(surveys)}")
        logger.info(f"Total sightings to delete: {total_sightings}")
        logger.info("=" * 80)

        if not dry_run:
            # Confirm deletion
            if not confirm:
                logger.info("\nWARNING: About to delete records from the database!")
                response = input("\nType 'yes' to confirm deletion: ").strip().lower()

                if response != 'yes':
                    logger.info("\nDeletion cancelled by user")
                    return 0

            # Delete sightings first (foreign key constraint)
            logger.info("\nDeleting sightings...")
            deleted_sightings = delete_sightings(survey_ids)
            logger.info(f"Deleted {deleted_sightings} sightings")

            # Delete surveys
            logger.info("Deleting surveys...")
            deleted_surveys = delete_surveys(survey_ids)
            logger.info(f"Deleted {deleted_surveys} surveys")

            logger.info("\nDeletion complete!")
        else:
            logger.info("\nRun with --no-dry-run --yes to delete these records")

        return 0

    except Exception as e:
        logger.error(f"\nError: {e}", exc_info=True)
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
