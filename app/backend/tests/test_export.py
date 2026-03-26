"""Tests for the SQLite export module."""

from sqlmodel import SQLModel

from routers.export import EXPORT_TABLES

# Tables that intentionally should NOT be in the export
INTERNAL_TABLES = {"organisation"}


class TestExportCompleteness:
    """Ensure the export table list stays in sync with the database schema."""

    def test_all_tables_accounted_for(self):
        """Fail if a SQLModel table exists that is neither exported nor explicitly internal."""
        all_tables = set(SQLModel.metadata.tables.keys())
        exported = {t["table"] for t in EXPORT_TABLES}
        accounted = exported | INTERNAL_TABLES
        unaccounted = all_tables - accounted

        assert not unaccounted, (
            f"Tables {unaccounted} exist in SQLModel metadata but are not in "
            f"EXPORT_TABLES or INTERNAL_TABLES in routers/export.py. "
            f"Add them to one or the other."
        )
