"""Seed Heal organisation and backfill existing data

Revision ID: z5a6b7c8d9e0
Revises: y4z5a6b7c8d9
Create Date: 2026-02-18

This migration:
1. Creates the 'Heal' organisation with the current admin password
2. Backfills all existing data with organisation_id = 1
"""
from typing import Sequence, Union
import os

from alembic import op
import sqlalchemy as sa
import bcrypt


# revision identifiers, used by Alembic.
revision: str = 'z5a6b7c8d9e0'
down_revision: Union[str, None] = 'y4z5a6b7c8d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Seed Heal organisation and backfill data."""
    # Get the current admin password from environment
    admin_password = os.getenv('ADMIN_PASSWORD', '')
    if not admin_password:
        raise ValueError(
            "ADMIN_PASSWORD environment variable must be set to run this migration. "
            "This password will be hashed and stored for the Heal organisation."
        )

    # Hash the password with bcrypt
    password_hash = bcrypt.hashpw(
        admin_password.encode('utf-8'),
        bcrypt.gensalt()
    ).decode('utf-8')

    # Insert Heal organisation
    op.execute(
        sa.text("""
            INSERT INTO organisation (name, slug, domain, admin_password_hash, is_active)
            VALUES ('Heal', 'heal', 'healdata.up.railway.app', :password_hash, true)
        """).bindparams(password_hash=password_hash)
    )

    # Backfill all existing data with organisation_id = 1 (Heal)
    tables = ['survey', 'surveyor', 'location', 'survey_type']
    for table in tables:
        op.execute(f"UPDATE {table} SET organisation_id = 1 WHERE organisation_id IS NULL")


def downgrade() -> None:
    """Remove Heal organisation and clear backfilled data."""
    # Clear organisation_id from all tables (set back to NULL)
    tables = ['survey', 'surveyor', 'location', 'survey_type']
    for table in tables:
        op.execute(f"UPDATE {table} SET organisation_id = NULL WHERE organisation_id = 1")

    # Delete Heal organisation
    op.execute("DELETE FROM organisation WHERE slug = 'heal'")
