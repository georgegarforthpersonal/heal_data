"""
Migrate bird surveys from production database to staging database.

This script migrates survey and sighting data for bird surveys from the prod DB
(old schema with survey.type column) to the staging DB (new schema with survey_type_id).

Schema mapping:
- survey.type = 'bird' -> survey_type_id (Birders Weekly Survey)
- sighting.transect_id -> survey.location_id (matched by location.name)
- species matched by species.name (common name)
- surveyors matched by (first_name, last_name)

Usage:
    python migrate_bird_surveys.py                           # Dry-run (preview only)
    python migrate_bird_surveys.py --no-dry-run --yes        # Apply migration
    python migrate_bird_surveys.py --skip-backup             # Skip database backups

Environment variables required (use migrate-run script to set these):
    STAGING_DB_HOST, STAGING_DB_PORT, STAGING_DB_NAME, STAGING_DB_USER, STAGING_DB_PASSWORD
    PROD_DB_HOST, PROD_DB_PORT, PROD_DB_NAME, PROD_DB_USER, PROD_DB_PASSWORD
"""

import logging
import os
import subprocess
import sys
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

import psycopg2

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from script_utils import get_arg_parser


logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)


# Configuration
BIRD_SURVEY_TYPE_NAME = "Birders"

# Species name mappings (prod name -> staging name)
SPECIES_NAME_MAPPINGS = {
    "Feral Pigeon": "Rock Dove",
    "Mandarin duck": "Mandarin Duck",
    "Pied/White Wagtail": "Pied Wagtail",
    "Willow warbler": "Willow Warbler",
}

# Surveyor name mappings (prod (first, last) -> staging (first, last))
# Handles data quality issues like trailing spaces
SURVEYOR_NAME_MAPPINGS = {
    ("Lynne ", ""): ("Lynne", ""),
}


@dataclass
class MigrationStats:
    """Track migration statistics."""
    surveys_processed: int = 0
    surveys_migrated: int = 0
    surveys_skipped: int = 0
    sightings_processed: int = 0
    sightings_migrated: int = 0
    sightings_skipped: int = 0
    skip_reasons: dict = field(default_factory=dict)

    def add_skip_reason(self, reason: str):
        self.skip_reasons[reason] = self.skip_reasons.get(reason, 0) + 1


# =============================================================================
# Database Connection Utilities
# =============================================================================

def get_connection_params(prefix: str) -> dict:
    """
    Build connection parameters from prefixed environment variables.

    Args:
        prefix: 'STAGING_DB' or 'PROD_DB'

    Returns:
        Dict with connection parameters

    Raises:
        ValueError if required env vars are missing
    """
    required = ['HOST', 'PORT', 'NAME', 'USER', 'PASSWORD']
    params = {}
    missing = []

    for key in required:
        env_var = f"{prefix}_{key}"
        value = os.environ.get(env_var)
        if not value:
            missing.append(env_var)
        else:
            # Map to psycopg2 param names
            param_name = {
                'HOST': 'host',
                'PORT': 'port',
                'NAME': 'database',
                'USER': 'user',
                'PASSWORD': 'password'
            }[key]
            params[param_name] = value

    # Optional sslmode
    sslmode = os.environ.get(f"{prefix}_SSLMODE")
    if sslmode:
        params['sslmode'] = sslmode

    if missing:
        raise ValueError(f"Missing environment variables: {', '.join(missing)}")

    return params


def create_connection(prefix: str):
    """Create a database connection using prefixed env vars."""
    params = get_connection_params(prefix)
    return psycopg2.connect(**params)


@contextmanager
def get_cursor_for_db(conn):
    """
    Context manager for database cursor operations.
    Commits on success, rolls back on failure.
    """
    cursor = conn.cursor()
    try:
        yield cursor
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()


def build_connection_string(prefix: str) -> str:
    """Build a PostgreSQL connection string for pg_dump."""
    params = get_connection_params(prefix)
    sslmode = params.get('sslmode', 'prefer')
    return (
        f"postgresql://{params['user']}:{params['password']}"
        f"@{params['host']}:{params['port']}/{params['database']}"
        f"?sslmode={sslmode}"
    )


# =============================================================================
# Backup Functions
# =============================================================================

def backup_database(prefix: str, label: str) -> Path:
    """
    Backup database using pg_dump.

    Args:
        prefix: 'STAGING_DB' or 'PROD_DB'
        label: 'staging' or 'prod' for filename

    Returns:
        Path to backup file
    """
    backups_dir = Path(__file__).parent / "data" / "backups"
    backups_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = backups_dir / f"migrate_{label}_{timestamp}.dump"

    connection_string = build_connection_string(prefix)

    cmd = [
        "pg_dump",
        "-Fc",  # Custom format archive
        "-v",   # Verbose mode
        "-f", str(output_path),
        connection_string
    ]

    logger.info(f"Backing up {label} database to {output_path}...")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        logger.error(f"pg_dump failed for {label}: {result.stderr}")
        raise RuntimeError(f"Backup failed for {label} database")

    size_bytes = output_path.stat().st_size
    if size_bytes < 1024:
        size_str = f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        size_str = f"{size_bytes / 1024:.1f} KB"
    else:
        size_str = f"{size_bytes / (1024 * 1024):.1f} MB"

    logger.info(f"Backup complete: {output_path} ({size_str})")
    return output_path


# =============================================================================
# Staging Reference Data Loading
# =============================================================================

def load_staging_survey_type_id(cursor, name: str) -> int | None:
    """Get survey_type_id for the bird survey type."""
    cursor.execute("SELECT id FROM survey_type WHERE name = %s", (name,))
    row = cursor.fetchone()
    return row[0] if row else None


def load_staging_surveyors(cursor) -> dict[tuple[str, str], int]:
    """Load all surveyors from staging, keyed by (first_name, last_name)."""
    cursor.execute("""
        SELECT id, first_name, last_name
        FROM surveyor
        WHERE is_active = true
    """)
    return {(row[1], row[2]): row[0] for row in cursor.fetchall()}


def load_staging_species(cursor) -> dict[str, int]:
    """Load all bird species from staging, keyed by name."""
    cursor.execute("""
        SELECT id, name
        FROM species
        WHERE type = 'bird'
    """)
    return {row[1]: row[0] for row in cursor.fetchall()}


def load_staging_locations(cursor) -> dict[str, int]:
    """Load bird locations from staging, keyed by name."""
    cursor.execute("""
        SELECT id, name
        FROM location
        WHERE type = 'bird'
    """)
    return {row[1]: row[0] for row in cursor.fetchall()}


# =============================================================================
# Prod Data Extraction
# =============================================================================

def fetch_bird_surveys(cursor) -> list[dict]:
    """Fetch all bird surveys from prod."""
    cursor.execute("""
        SELECT
            id, date, start_time, end_time, sun_percentage,
            temperature_celsius, conditions_met, notes
        FROM survey
        WHERE type = 'bird'
        ORDER BY date
    """)

    columns = ['id', 'date', 'start_time', 'end_time', 'sun_percentage',
               'temperature_celsius', 'conditions_met', 'notes']
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def fetch_survey_surveyors(cursor, survey_ids: list[int]) -> dict[int, list[tuple]]:
    """Fetch surveyor info for given surveys."""
    if not survey_ids:
        return {}

    cursor.execute("""
        SELECT ss.survey_id, sv.first_name, sv.last_name
        FROM survey_surveyor ss
        JOIN surveyor sv ON sv.id = ss.surveyor_id
        WHERE ss.survey_id = ANY(%s)
    """, (survey_ids,))

    result = {}
    for row in cursor.fetchall():
        survey_id = row[0]
        if survey_id not in result:
            result[survey_id] = []
        result[survey_id].append((row[1], row[2]))

    return result


def fetch_sightings(cursor, survey_ids: list[int]) -> dict[int, list[dict]]:
    """Fetch all sightings for given surveys with species and transect info."""
    if not survey_ids:
        return {}

    cursor.execute("""
        SELECT
            s.survey_id, s.count,
            sp.name as species_name,
            t.name as transect_name
        FROM sighting s
        JOIN species sp ON sp.id = s.species_id
        JOIN transect t ON t.id = s.transect_id
        WHERE s.survey_id = ANY(%s)
    """, (survey_ids,))

    result = {}
    for row in cursor.fetchall():
        survey_id = row[0]
        if survey_id not in result:
            result[survey_id] = []
        result[survey_id].append({
            'count': row[1],
            'species_name': row[2],
            'transect_name': row[3]
        })

    return result


# =============================================================================
# Staging Data Deletion
# =============================================================================

def delete_staging_data(cursor) -> tuple[int, int, int, int]:
    """
    Delete all survey and sighting data from staging.
    Returns counts of deleted records.
    """
    # Delete in order to respect foreign key constraints
    cursor.execute("DELETE FROM sighting_individual")
    del_individuals = cursor.rowcount

    cursor.execute("DELETE FROM sighting")
    del_sightings = cursor.rowcount

    cursor.execute("DELETE FROM survey_surveyor")
    del_links = cursor.rowcount

    cursor.execute("DELETE FROM survey")
    del_surveys = cursor.rowcount

    return del_surveys, del_links, del_sightings, del_individuals


# =============================================================================
# Migration Logic
# =============================================================================

def run_migration(dry_run: bool, skip_backup: bool, yes: bool) -> int:
    """
    Main migration orchestration.

    Returns:
        Exit code (0 for success, 1 for error)
    """
    mode = "DRY RUN" if dry_run else "LIVE"
    logger.info("=" * 80)
    logger.info(f"Bird Survey Migration - {mode} MODE")
    logger.info("=" * 80)

    # 1. Validate environment variables
    try:
        get_connection_params('STAGING_DB')
        get_connection_params('PROD_DB')
    except ValueError as e:
        logger.error(str(e))
        logger.error("\nMake sure to run this script using ./migrate-run")
        return 1

    # 2. Create connections
    logger.info("\nConnecting to databases...")
    try:
        staging_conn = create_connection('STAGING_DB')
        logger.info("  Connected to staging database")
    except Exception as e:
        logger.error(f"Failed to connect to staging database: {e}")
        return 1

    try:
        prod_conn = create_connection('PROD_DB')
        logger.info("  Connected to production database")
    except Exception as e:
        logger.error(f"Failed to connect to production database: {e}")
        staging_conn.close()
        return 1

    try:
        # 3. Backup databases
        if not skip_backup:
            logger.info("\nBacking up databases...")
            try:
                backup_database('STAGING_DB', 'staging')
                backup_database('PROD_DB', 'prod')
            except RuntimeError as e:
                logger.error(f"Backup failed: {e}")
                return 1
        else:
            logger.info("\nSkipping backups (--skip-backup flag)")

        # 4. Load staging reference data
        logger.info("\nLoading staging reference data...")
        with get_cursor_for_db(staging_conn) as staging_cur:
            survey_type_id = load_staging_survey_type_id(staging_cur, BIRD_SURVEY_TYPE_NAME)
            if not survey_type_id:
                logger.error(f"Survey type '{BIRD_SURVEY_TYPE_NAME}' not found in staging")
                return 1
            logger.info(f"  Survey type '{BIRD_SURVEY_TYPE_NAME}' -> ID {survey_type_id}")

            staging_surveyors = load_staging_surveyors(staging_cur)
            logger.info(f"  Loaded {len(staging_surveyors)} surveyors")

            staging_species = load_staging_species(staging_cur)
            logger.info(f"  Loaded {len(staging_species)} bird species")

            staging_locations = load_staging_locations(staging_cur)
            logger.info(f"  Loaded {len(staging_locations)} bird locations: {list(staging_locations.keys())}")

        # 5. Fetch prod data
        logger.info("\nFetching production data...")
        with get_cursor_for_db(prod_conn) as prod_cur:
            prod_surveys = fetch_bird_surveys(prod_cur)
            logger.info(f"  Found {len(prod_surveys)} bird surveys")

            if not prod_surveys:
                logger.info("No bird surveys to migrate.")
                return 0

            survey_ids = [s['id'] for s in prod_surveys]
            prod_surveyors = fetch_survey_surveyors(prod_cur, survey_ids)
            prod_sightings = fetch_sightings(prod_cur, survey_ids)

            total_sightings = sum(len(s) for s in prod_sightings.values())
            logger.info(f"  Found {total_sightings} sightings across all surveys")

        # 6. Map and validate
        logger.info("\nMapping data to staging schema...")
        stats = MigrationStats()
        mapped_data = []  # List of (survey_dict, surveyor_ids, sightings)

        for survey in prod_surveys:
            stats.surveys_processed += 1
            survey_id = survey['id']

            # Get surveyors for this survey
            surveyors = prod_surveyors.get(survey_id, [])

            # Get sightings for this survey
            sightings = prod_sightings.get(survey_id, [])

            # Determine location from sightings
            if not sightings:
                stats.surveys_skipped += 1
                stats.add_skip_reason("no_sightings")
                continue

            # Get location from first sighting's transect
            transect_name = sightings[0]['transect_name']
            if transect_name not in staging_locations:
                stats.surveys_skipped += 1
                stats.add_skip_reason(f"location_not_found:{transect_name}")
                continue
            location_id = staging_locations[transect_name]

            # Check all surveyors exist
            surveyor_ids = []
            missing_surveyors = []
            for first_name, last_name in surveyors:
                # Normalize names (trim whitespace)
                first_name = first_name.strip() if first_name else ""
                last_name = last_name.strip() if last_name else ""
                key = (first_name, last_name)

                # Try exact match first
                if key in staging_surveyors:
                    surveyor_ids.append(staging_surveyors[key])
                # If last name is empty, try matching by first name only
                elif not last_name:
                    found = False
                    for (fn, ln), sid in staging_surveyors.items():
                        if fn == first_name:
                            surveyor_ids.append(sid)
                            found = True
                            break
                    if not found:
                        missing_surveyors.append(f"{first_name} {last_name}".strip())
                else:
                    missing_surveyors.append(f"{first_name} {last_name}".strip())

            if missing_surveyors:
                stats.surveys_skipped += 1
                stats.add_skip_reason(f"surveyor_not_found:{','.join(missing_surveyors)}")
                continue

            # Map sightings
            mapped_sightings = []
            for sighting in sightings:
                stats.sightings_processed += 1
                species_name = sighting['species_name']

                # Apply species name mapping if needed
                mapped_species_name = SPECIES_NAME_MAPPINGS.get(species_name, species_name)

                if mapped_species_name not in staging_species:
                    stats.sightings_skipped += 1
                    stats.add_skip_reason(f"species_not_found:{species_name}")
                    continue

                mapped_sightings.append({
                    'species_id': staging_species[mapped_species_name],
                    'count': sighting['count']
                })
                stats.sightings_migrated += 1

            # Build mapped survey
            mapped_survey = {
                'date': survey['date'],
                'start_time': survey['start_time'],
                'end_time': survey['end_time'],
                'sun_percentage': survey['sun_percentage'],
                'temperature_celsius': survey['temperature_celsius'],
                'conditions_met': survey['conditions_met'],
                'notes': survey['notes'],
                'survey_type_id': survey_type_id,
                'location_id': location_id
            }

            mapped_data.append((mapped_survey, surveyor_ids, mapped_sightings))
            stats.surveys_migrated += 1

        # 7. Preview - get current staging counts
        with get_cursor_for_db(staging_conn) as staging_cur:
            staging_cur.execute("SELECT COUNT(*) FROM survey")
            staging_survey_count = staging_cur.fetchone()[0]
            staging_cur.execute("SELECT COUNT(*) FROM sighting")
            staging_sighting_count = staging_cur.fetchone()[0]
            staging_cur.execute("SELECT COUNT(*) FROM survey_surveyor")
            staging_link_count = staging_cur.fetchone()[0]
            staging_cur.execute("SELECT COUNT(*) FROM sighting_individual")
            staging_individual_count = staging_cur.fetchone()[0]

        logger.info("\n" + "=" * 80)
        logger.info("MIGRATION PREVIEW")
        logger.info("=" * 80)
        logger.info("\nWill DELETE from staging:")
        logger.info(f"  - {staging_survey_count} surveys")
        logger.info(f"  - {staging_link_count} survey-surveyor links")
        logger.info(f"  - {staging_sighting_count} sightings")
        logger.info(f"  - {staging_individual_count} sighting individuals")
        logger.info("\nWill INSERT from prod:")
        logger.info(f"  - {stats.surveys_migrated} surveys ({stats.surveys_skipped} skipped)")
        logger.info(f"  - {stats.sightings_migrated} sightings ({stats.sightings_skipped} skipped)")

        if stats.skip_reasons:
            logger.info("\nSkip reasons:")
            for reason, count in sorted(stats.skip_reasons.items()):
                logger.info(f"  - {reason}: {count}")

        if dry_run:
            logger.info("\n" + "=" * 80)
            logger.info("DRY RUN complete. Run with --no-dry-run to apply changes.")
            logger.info("=" * 80)
            return 0

        # 8. Confirm
        if not yes:
            logger.info("\n" + "=" * 80)
            logger.warning("WARNING: This will DELETE all existing survey/sighting data in staging!")
            logger.info("=" * 80)
            response = input("Type 'yes' to confirm: ").strip().lower()
            if response != 'yes':
                logger.info("Aborted.")
                return 0

        # 9. Apply migration
        logger.info("\nApplying migration...")
        with get_cursor_for_db(staging_conn) as staging_cur:
            # Delete existing data
            logger.info("Deleting existing staging data...")
            del_surveys, del_links, del_sightings, del_individuals = delete_staging_data(staging_cur)
            logger.info(f"  Deleted {del_surveys} surveys, {del_links} survey-surveyor links")
            logger.info(f"  Deleted {del_sightings} sightings, {del_individuals} sighting individuals")

            # Insert new data
            logger.info("\nInserting migrated data...")
            inserted_surveys = 0
            inserted_sightings = 0
            inserted_links = 0

            for mapped_survey, surveyor_ids, mapped_sightings in mapped_data:
                # Insert survey
                staging_cur.execute("""
                    INSERT INTO survey (
                        date, start_time, end_time, sun_percentage,
                        temperature_celsius, conditions_met, notes,
                        survey_type_id, location_id
                    ) VALUES (
                        %(date)s, %(start_time)s, %(end_time)s, %(sun_percentage)s,
                        %(temperature_celsius)s, %(conditions_met)s, %(notes)s,
                        %(survey_type_id)s, %(location_id)s
                    ) RETURNING id
                """, mapped_survey)
                new_survey_id = staging_cur.fetchone()[0]
                inserted_surveys += 1

                # Insert survey_surveyor links
                for surveyor_id in surveyor_ids:
                    staging_cur.execute("""
                        INSERT INTO survey_surveyor (survey_id, surveyor_id)
                        VALUES (%s, %s)
                    """, (new_survey_id, surveyor_id))
                    inserted_links += 1

                # Insert sightings
                for sighting in mapped_sightings:
                    staging_cur.execute("""
                        INSERT INTO sighting (survey_id, species_id, count)
                        VALUES (%s, %s, %s)
                    """, (new_survey_id, sighting['species_id'], sighting['count']))
                    inserted_sightings += 1

            logger.info(f"  Inserted {inserted_surveys} surveys")
            logger.info(f"  Inserted {inserted_links} survey-surveyor links")
            logger.info(f"  Inserted {inserted_sightings} sightings")

        logger.info("\n" + "=" * 80)
        logger.info("Migration complete!")
        logger.info("=" * 80)
        return 0

    finally:
        staging_conn.close()
        prod_conn.close()


def main():
    parser = get_arg_parser(description=__doc__)
    parser.add_argument(
        '--yes', '-y',
        action='store_true',
        help='Skip confirmation prompt'
    )
    parser.add_argument(
        '--skip-backup',
        action='store_true',
        help='Skip database backups (not recommended)'
    )
    args = parser.parse_args()

    try:
        exit_code = run_migration(
            dry_run=args.dry_run,
            skip_backup=args.skip_backup,
            yes=args.yes
        )
        sys.exit(exit_code)
    except KeyboardInterrupt:
        logger.info("\nAborted by user.")
        sys.exit(1)
    except Exception as e:
        logger.exception(f"Migration failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
