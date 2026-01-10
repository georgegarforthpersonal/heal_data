"""add_full_description_column

Revision ID: i7j8k9l0m1n2
Revises: h6i7j8k9l0m1
Create Date: 2025-12-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'i7j8k9l0m1n2'
down_revision: Union[str, Sequence[str], None] = 'h6i7j8k9l0m1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add full_description column and restore short descriptions."""

    # Add full_description column
    op.execute("ALTER TABLE breeding_status_code ADD COLUMN full_description TEXT;")

    # Copy current (full) descriptions to full_description
    op.execute("UPDATE breeding_status_code SET full_description = description;")

    # Restore short descriptions
    short_descriptions = [
        ("F", "Flying over"),
        ("M", "Migration"),
        ("U", "Summering non-breeder"),
        ("H", "Habitat"),
        ("S", "Singing male"),
        ("P", "Pair"),
        ("T", "Territory"),
        ("D", "Display"),
        ("N", "Nest site"),
        ("A", "Agitated"),
        ("I", "Incubation"),
        ("B", "Building"),
        ("DD", "Distraction display"),
        ("UN", "Used nest"),
        ("FL", "Fledged young"),
        ("ON", "Occupied nest"),
        ("FF", "Food for young"),
        ("NE", "Nest with eggs"),
        ("NY", "Nest with young"),
    ]

    for code, description in short_descriptions:
        op.execute(f"UPDATE breeding_status_code SET description = '{description}' WHERE code = '{code}';")

    # Revert description column to VARCHAR
    op.execute("ALTER TABLE breeding_status_code ALTER COLUMN description TYPE VARCHAR(100);")


def downgrade() -> None:
    """Remove full_description column and restore full descriptions to description."""

    # Copy full_description back to description
    op.execute("ALTER TABLE breeding_status_code ALTER COLUMN description TYPE TEXT;")
    op.execute("UPDATE breeding_status_code SET description = full_description;")

    # Drop the full_description column
    op.execute("ALTER TABLE breeding_status_code DROP COLUMN full_description;")
