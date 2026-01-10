"""allow_null_species_name_and_fix_duplicates

Revision ID: 3ab5504990d6
Revises: d1e2f3a4b5c6
Create Date: 2025-11-30 18:35:33.206687

This migration:
1. Removes the NOT NULL constraint from species.name to allow NULL values
2. Sets name to NULL where it currently equals scientific_name (duplicate data)

This fixes an issue where species without common names had their scientific_name
copied to the name field instead of leaving it NULL.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3ab5504990d6'
down_revision: Union[str, Sequence[str], None] = 'd1e2f3a4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove NOT NULL constraint and fix duplicate data."""
    # Step 1: Alter the name column to allow NULL values
    op.alter_column('species', 'name',
                    existing_type=sa.String(length=255),
                    nullable=True)

    # Step 2: Update rows where name equals scientific_name to set name to NULL
    # This fixes species that had their scientific name incorrectly copied to the name field
    op.execute("""
        UPDATE species
        SET name = NULL
        WHERE name = scientific_name
        AND name IS NOT NULL
    """)


def downgrade() -> None:
    """Restore NOT NULL constraint (requires filling NULL names first)."""
    # Before restoring NOT NULL, we need to fill any NULL names with scientific_name
    # This allows the downgrade to work, but the data won't be exactly as before
    op.execute("""
        UPDATE species
        SET name = scientific_name
        WHERE name IS NULL
        AND scientific_name IS NOT NULL
    """)

    # Restore the NOT NULL constraint
    op.alter_column('species', 'name',
                    existing_type=sa.String(length=255),
                    nullable=False)
