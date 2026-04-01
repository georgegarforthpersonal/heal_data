"""
Export Router - SQLite database export for organisation data

Endpoints:
  GET /api/export/sqlite - Download organisation data as a SQLite database file

Schema is introspected from PostgreSQL at export time, so column changes
from migrations are picked up automatically. Only the table list, org-scoping
rules, and geometry transforms need manual maintenance.
"""

import io
import os
import sqlite3
import logging
import tempfile
from datetime import datetime, date, time
from decimal import Decimal
from typing import Any, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

from database.connection import get_db
from dependencies import get_current_organisation
from auth import require_admin
from models import Organisation

logger = logging.getLogger(__name__)
router = APIRouter()

# ---------------------------------------------------------------------------
# Export configuration
#
# To add a new table: append an entry to EXPORT_TABLES.
# To add a new geometry column: add a transform to GEOMETRY_TRANSFORMS.
# Column additions/removals/renames are handled automatically.
# ---------------------------------------------------------------------------

# Columns to exclude from every table in the export
EXCLUDE_COLUMNS = {"organisation_id", "r2_key"}

# PostGIS geometry columns → replacement SQLite columns.
# Each maps a PG column name to a list of (output_name, sqlite_type, sql_expr).
GEOMETRY_TRANSFORMS: dict[str, list[tuple[str, str, str]]] = {
    "point_geometry": [
        ("latitude", "REAL", "ST_Y({col})"),
        ("longitude", "REAL", "ST_X({col})"),
    ],
    "coordinates": [
        ("latitude", "REAL", "ST_Y({col})"),
        ("longitude", "REAL", "ST_X({col})"),
    ],
    "boundary_geometry": [
        ("boundary_geometry", "TEXT", "ST_AsText({col})"),
    ],
}

# Tables to export, in FK-dependency order.
#   org_filter absent/None  → reference table, export all rows
#   org_filter="direct"     → table has organisation_id column
#   org_filter=("parent_table", "fk_col") → filter via parent's org scope
EXPORT_TABLES: list[dict[str, Any]] = [
    # Reference tables
    {"table": "species_type"},
    {"table": "species"},
    {"table": "breeding_status_code"},
    # Directly org-scoped
    {"table": "surveyor", "org_filter": "direct"},
    {"table": "location", "org_filter": "direct"},
    {"table": "survey_type", "org_filter": "direct"},
    {"table": "device", "org_filter": "direct"},
    {"table": "survey", "org_filter": "direct"},
    # Indirectly org-scoped via FK chain
    {"table": "survey_surveyor", "org_filter": ("survey", "survey_id")},
    {"table": "survey_type_location", "org_filter": ("survey_type", "survey_type_id")},
    {"table": "survey_type_species_type", "org_filter": ("survey_type", "survey_type_id")},
    {"table": "sighting", "org_filter": ("survey", "survey_id")},
    {"table": "sighting_individual", "org_filter": ("sighting", "sighting_id")},
    {"table": "sighting_image", "org_filter": ("sighting", "sighting_id")},
    {"table": "audio_recording", "org_filter": ("survey", "survey_id")},
    {"table": "audio_detection", "org_filter": ("audio_recording", "audio_recording_id")},
    {"table": "camera_trap_image", "org_filter": ("survey", "survey_id")},
    {"table": "camera_trap_detection", "org_filter": ("camera_trap_image", "camera_trap_image_id")},
]

# PostgreSQL data_type → SQLite type affinity
_PG_TYPE_MAP: dict[str, str] = {
    "integer": "INTEGER", "bigint": "INTEGER", "smallint": "INTEGER",
    "boolean": "INTEGER",
    "real": "REAL", "double precision": "REAL", "numeric": "REAL",
    "text": "TEXT", "character varying": "TEXT", "character": "TEXT",
    "json": "TEXT", "jsonb": "TEXT",
    "date": "TEXT", "time without time zone": "TEXT", "time with time zone": "TEXT",
    "timestamp without time zone": "TEXT", "timestamp with time zone": "TEXT",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _convert_row(row: tuple[object, ...]) -> tuple[object, ...]:
    """Convert a database row so all values are SQLite-compatible."""
    return tuple(
        str(v) if isinstance(v, (date, time, datetime)) else
        float(v) if isinstance(v, Decimal) else
        v
        for v in row
    )


def _build_where(org_filter: Any, table_lookup: dict[str, dict[str, Any]]) -> str:
    """Recursively build a WHERE clause for org-scoping."""
    if org_filter is None:
        return ""
    if org_filter == "direct":
        return "WHERE organisation_id = :org_id"
    parent_table, fk_col = org_filter
    parent_where = _build_where(
        table_lookup[parent_table].get("org_filter"), table_lookup
    )
    return f"WHERE {fk_col} IN (SELECT id FROM {parent_table} {parent_where})"


def _get_table_columns(
    db: Session, table_name: str,
) -> list[Any]:
    """Get (column_name, data_type, udt_name) for a table, ordered by position."""
    result: list[Any] = db.execute(text(
        "SELECT column_name, data_type, udt_name "
        "FROM information_schema.columns "
        "WHERE table_name = :t AND table_schema = 'public' "
        "ORDER BY ordinal_position"
    ), {"t": table_name}).fetchall()
    return result


def _get_primary_keys(db: Session, table_name: str) -> set[str]:
    """Get the set of primary key column names for a table."""
    rows = db.execute(text(
        "SELECT kcu.column_name "
        "FROM information_schema.table_constraints tc "
        "JOIN information_schema.key_column_usage kcu "
        "  ON tc.constraint_name = kcu.constraint_name "
        "  AND tc.table_schema = kcu.table_schema "
        "WHERE tc.table_name = :t AND tc.table_schema = 'public' "
        "  AND tc.constraint_type = 'PRIMARY KEY'"
    ), {"t": table_name}).fetchall()
    return {r[0] for r in rows}


def _export_table(
    db: Session,
    cursor: sqlite3.Cursor,
    table_name: str,
    where: str,
    org_id: Optional[int],
) -> None:
    """Introspect a PG table's schema and copy its data into SQLite."""
    pg_columns = _get_table_columns(db, table_name)
    if not pg_columns:
        return

    pk_cols = _get_primary_keys(db, table_name)

    sqlite_cols: list[str] = []    # "name TYPE [PRIMARY KEY]"
    select_exprs: list[str] = []   # SQL expressions for SELECT

    for col_name, data_type, udt_name in pg_columns:
        if col_name in EXCLUDE_COLUMNS:
            continue

        # Geometry columns: apply configured transform or skip
        if data_type == "USER-DEFINED" and udt_name == "geometry":
            if col_name in GEOMETRY_TRANSFORMS:
                for out_name, out_type, expr in GEOMETRY_TRANSFORMS[col_name]:
                    sqlite_cols.append(f"{out_name} {out_type}")
                    select_exprs.append(expr.format(col=col_name))
            continue

        # Regular columns
        sqlite_type = _PG_TYPE_MAP.get(data_type, "TEXT")
        pk = " PRIMARY KEY" if col_name in pk_cols else ""
        sqlite_cols.append(f"{col_name} {sqlite_type}{pk}")
        select_exprs.append(col_name)

    if not sqlite_cols:
        return

    # CREATE TABLE
    cursor.execute(f"CREATE TABLE {table_name} ({', '.join(sqlite_cols)})")

    # SELECT from PG + INSERT into SQLite
    select_sql = f"SELECT {', '.join(select_exprs)} FROM {table_name} {where}"
    params: dict[str, Any] = {"org_id": org_id} if ":org_id" in select_sql else {}
    rows = db.execute(text(select_sql), params).fetchall()

    if rows:
        placeholders = ", ".join("?" * len(select_exprs))
        cursor.executemany(
            f"INSERT INTO {table_name} VALUES ({placeholders})",
            [_convert_row(r) for r in rows],
        )


# ---------------------------------------------------------------------------
# Main export
# ---------------------------------------------------------------------------

def _create_sqlite_export(db: Session, org: Organisation) -> bytes:
    """Build an in-memory SQLite database containing all organisation data."""
    conn = sqlite3.connect(":memory:")
    cursor = conn.cursor()

    table_lookup = {t["table"]: t for t in EXPORT_TABLES}

    for table_config in EXPORT_TABLES:
        table_name = table_config["table"]
        org_filter = table_config.get("org_filter")
        where = _build_where(org_filter, table_lookup)
        _export_table(db, cursor, table_name, where, org.id)

    conn.commit()

    tmp_path = tempfile.mktemp(suffix=".sqlite")
    try:
        disk_conn = sqlite3.connect(tmp_path)
        conn.backup(disk_conn)
        disk_conn.close()
        conn.close()
        with open(tmp_path, "rb") as f:
            return f.read()
    finally:
        os.unlink(tmp_path)


@router.get("/sqlite")
async def export_sqlite(
    db: Session = Depends(get_db),
    org: Organisation = Depends(get_current_organisation),
    _admin: None = Depends(require_admin),
) -> StreamingResponse:
    """Export all organisation data as a downloadable SQLite database file."""
    logger.info(f"SQLite export requested for organisation: {org.slug}")

    sqlite_bytes = _create_sqlite_export(db, org)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"{org.slug}_export_{timestamp}.sqlite"

    return StreamingResponse(
        io.BytesIO(sqlite_bytes),
        media_type="application/x-sqlite3",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
