"""
Backup the database using pg_dump.

Creates a custom-format archive suitable for restoration with pg_restore.
Backups are stored in the backups/ directory with timestamps.

Usage:
    ./dev-run backup_db.py                  # Backup to default location
    ./dev-run backup_db.py --output my.bak  # Backup to specific file
"""

import argparse
import logging
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))


logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)


def get_backup_path(output: str | None) -> Path:
    """Get the backup file path."""
    if output:
        return Path(output)

    # Create backups directory if it doesn't exist
    backups_dir = Path(__file__).parent / "data" / "backups"
    backups_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return backups_dir / f"backup_{timestamp}.dump"


def get_connection_string() -> str:
    """Get the database connection string from environment."""
    conn_string = os.environ.get("DATABASE_URL")
    if not conn_string:
        raise ValueError(
            "DATABASE_URL environment variable not set. "
            "Make sure you're running this through dev-run, staging-run, or prod-run."
        )
    return conn_string


def run_pg_dump(connection_string: str, output_path: Path) -> None:
    """Run pg_dump to create the backup."""
    cmd = [
        "pg_dump",
        "-Fc",  # Custom format archive
        "-v",   # Verbose mode
        "-f", str(output_path),
        connection_string
    ]

    logger.info(f"Running pg_dump...")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        logger.error(f"pg_dump failed with exit code {result.returncode}")
        if result.stderr:
            logger.error(result.stderr)
        sys.exit(1)

    if result.stderr:
        # pg_dump writes verbose output to stderr
        for line in result.stderr.strip().split('\n'):
            if line:
                logger.info(line)


def main():
    parser = argparse.ArgumentParser(
        description="Backup the database using pg_dump",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        '--output', '-o',
        help='Output file path (default: backups/backup_TIMESTAMP.dump)'
    )
    args = parser.parse_args()

    logger.info("Starting database backup...")

    try:
        connection_string = get_connection_string()
    except ValueError as e:
        logger.error(str(e))
        sys.exit(1)

    output_path = get_backup_path(args.output)
    logger.info(f"Output file: {output_path}")

    run_pg_dump(connection_string, output_path)

    # Show file size
    size_bytes = output_path.stat().st_size
    if size_bytes < 1024:
        size_str = f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        size_str = f"{size_bytes / 1024:.1f} KB"
    else:
        size_str = f"{size_bytes / (1024 * 1024):.1f} MB"

    logger.info(f"Backup completed successfully: {output_path}")
    logger.info(f"Size: {size_str}")


if __name__ == "__main__":
    main()
