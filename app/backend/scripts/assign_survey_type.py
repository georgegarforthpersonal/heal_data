"""
Assign survey type to existing surveys.

This script updates all existing surveys to be associated with a specific
survey type (defaults to "Birders Weekly Survey").

Usage:
    ./staging-run assign_survey_type.py                     # Dry-run (preview only)
    ./staging-run assign_survey_type.py --no-dry-run --yes  # Apply to database

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


SURVEY_TYPE_NAME = "Birders Weekly Survey"


def get_survey_type_id(cursor, name: str) -> int | None:
    """Get the survey type ID by name."""
    cursor.execute(
        "SELECT id FROM survey_type WHERE name = %s",
        (name,)
    )
    row = cursor.fetchone()
    return row[0] if row else None


def get_surveys_without_type(cursor) -> list[tuple]:
    """Get all surveys that don't have a survey_type_id set."""
    cursor.execute("""
        SELECT id, date, location_id
        FROM survey
        WHERE survey_type_id IS NULL
        ORDER BY date DESC
    """)
    return cursor.fetchall()


def update_surveys(cursor, survey_type_id: int, survey_ids: list[int]) -> int:
    """Update surveys to have the specified survey_type_id."""
    if not survey_ids:
        return 0

    cursor.execute("""
        UPDATE survey
        SET survey_type_id = %s
        WHERE id = ANY(%s)
    """, (survey_type_id, survey_ids))

    return cursor.rowcount


def main():
    parser = get_arg_parser(
        description="Assign survey type to existing surveys"
    )
    parser.add_argument(
        '--yes', '-y',
        action='store_true',
        help='Skip confirmation prompt'
    )
    args = parser.parse_args()

    logger.info(f"{'DRY RUN - ' if args.dry_run else ''}Assigning survey type: {SURVEY_TYPE_NAME}")

    with get_db_cursor() as cursor:
        # Get the survey type ID
        survey_type_id = get_survey_type_id(cursor, SURVEY_TYPE_NAME)
        if not survey_type_id:
            logger.error(f"Survey type '{SURVEY_TYPE_NAME}' not found!")
            sys.exit(1)

        logger.info(f"Found survey type: {SURVEY_TYPE_NAME} (id={survey_type_id})")

        # Get surveys without a type
        surveys = get_surveys_without_type(cursor)

        if not surveys:
            logger.info("No surveys found without a survey type. Nothing to do.")
            return

        logger.info(f"Found {len(surveys)} surveys without a survey type:")
        for survey_id, date, location_id in surveys[:10]:
            logger.info(f"  - Survey {survey_id}: date={date}, location_id={location_id}")
        if len(surveys) > 10:
            logger.info(f"  ... and {len(surveys) - 10} more")

        survey_ids = [s[0] for s in surveys]

        if args.dry_run:
            logger.info(f"DRY RUN: Would update {len(survey_ids)} surveys to survey_type_id={survey_type_id}")
            return

        # Confirm before proceeding
        if not args.yes:
            response = input(f"\nUpdate {len(survey_ids)} surveys to '{SURVEY_TYPE_NAME}'? [y/N]: ")
            if response.lower() != 'y':
                logger.info("Aborted.")
                return

        # Update the surveys
        updated = update_surveys(cursor, survey_type_id, survey_ids)
        logger.info(f"Updated {updated} surveys to survey_type_id={survey_type_id}")


if __name__ == "__main__":
    main()
