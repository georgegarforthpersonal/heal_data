"""
Add a new location to the database.

This script adds a new location record with the specified name.

Usage:
    ./dev-run add_location.py --name "Field Name"                     # Dry-run (preview only)
    ./dev-run add_location.py --name "Field Name" --no-dry-run --yes  # Apply to database

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


def check_location_exists(cursor, name: str) -> bool:
    """Check if a location with this name already exists."""
    cursor.execute(
        "SELECT id FROM location WHERE name = %s",
        (name,)
    )
    return cursor.fetchone() is not None


def insert_location(cursor, name: str) -> int:
    """Insert a new location and return its ID."""
    cursor.execute(
        "INSERT INTO location (name) VALUES (%s) RETURNING id",
        (name,)
    )
    return cursor.fetchone()[0]


def main():
    parser = get_arg_parser(
        description="Add a new location to the database"
    )
    parser.add_argument(
        '--name', '-n',
        required=True,
        help='Name of the location to add'
    )
    parser.add_argument(
        '--yes', '-y',
        action='store_true',
        help='Skip confirmation prompt'
    )
    args = parser.parse_args()

    logger.info(f"{'DRY RUN - ' if args.dry_run else ''}Adding location: {args.name}")

    with get_db_cursor() as cursor:
        # Check if location already exists
        if check_location_exists(cursor, args.name):
            logger.error(f"Location '{args.name}' already exists!")
            sys.exit(1)

        if args.dry_run:
            logger.info(f"DRY RUN: Would add location '{args.name}'")
            return

        # Confirm before proceeding
        if not args.yes:
            response = input(f"\nAdd location '{args.name}'? [y/N]: ")
            if response.lower() != 'y':
                logger.info("Aborted.")
                return

        # Insert the location
        location_id = insert_location(cursor, args.name)
        logger.info(f"Added location '{args.name}' with id={location_id}")


if __name__ == "__main__":
    main()
