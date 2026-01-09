"""
Delete surveys without a survey type.

This script finds all surveys where survey_type_id is NULL,
then deletes their sightings and the surveys themselves.

Usage:
    ./staging-run delete_surveys_without_type.py                     # Dry-run (preview only)
    ./staging-run delete_surveys_without_type.py --no-dry-run --yes  # Apply to database

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


def find_surveys_without_type(cursor) -> list[dict]:
    """Find all surveys where survey_type_id is NULL."""
    cursor.execute("""
        SELECT
            survey.id,
            survey.date,
            (SELECT COUNT(*) FROM sighting WHERE survey_id = survey.id) as sighting_count
        FROM survey
        WHERE survey.survey_type_id IS NULL
        ORDER BY survey.date DESC NULLS LAST
    """)

    surveys = []
    for row in cursor.fetchall():
        surveys.append({
            'id': row[0],
            'date': row[1],
            'sighting_count': row[2]
        })

    return surveys


def count_sightings_to_delete(cursor, survey_ids: list[int]) -> int:
    """Count total sightings that will be deleted."""
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
    logger.info(f"Delete Surveys Without Type - {mode} MODE")
    logger.info("=" * 80)

    with get_db_cursor() as cursor:
        # Find surveys without type
        logger.info("\nSearching for surveys without survey_type_id...")
        surveys = find_surveys_without_type(cursor)

        if not surveys:
            logger.info("No surveys found without survey_type_id. Nothing to do.")
            return

        survey_ids = [s['id'] for s in surveys]
        total_sightings = count_sightings_to_delete(cursor, survey_ids)

        # Report findings
        logger.info(f"\nFound {len(surveys)} surveys without survey_type_id:")
        logger.info("-" * 80)

        for survey in surveys[:20]:
            date_str = str(survey['date']) if survey['date'] else 'No date'
            logger.info(f"  Survey {survey['id']}: {date_str} ({survey['sighting_count']} sightings)")

        if len(surveys) > 20:
            logger.info(f"  ... and {len(surveys) - 20} more")

        logger.info("\n" + "=" * 80)
        logger.info("SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Surveys to delete: {len(surveys)}")
        logger.info(f"Total sightings to delete: {total_sightings}")
        logger.info("=" * 80)

        if args.dry_run:
            logger.info("\nDRY RUN complete. Run with --no-dry-run --yes to apply changes.")
            return

        # Confirm
        if not args.yes:
            logger.info("\nWARNING: This will delete records from the database!")
            response = input("Type 'yes' to confirm: ").strip().lower()
            if response != 'yes':
                logger.info("Aborted.")
                return

        # Delete
        logger.info("\nDeleting...")
        deleted_sightings = delete_sightings(cursor, survey_ids)
        logger.info(f"  Deleted {deleted_sightings} sightings")

        deleted_links = delete_survey_surveyors(cursor, survey_ids)
        logger.info(f"  Deleted {deleted_links} survey-surveyor links")

        deleted_surveys = delete_surveys(cursor, survey_ids)
        logger.info(f"  Deleted {deleted_surveys} surveys")

        logger.info("\nDeletion complete!")


if __name__ == "__main__":
    main()
