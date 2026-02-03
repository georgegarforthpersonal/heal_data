"""Add species_code column to species table

Revision ID: w1x2y3z4a5b7
Revises: v0w1x2y3z4a5
Create Date: 2026-02-03

This migration adds a species_code column to the species table.
This column stores short codes (e.g., BTO 2-letter codes for birds)
that can be displayed on maps instead of markers.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'w1x2y3z4a5b7'
down_revision: Union[str, None] = 'x2y3z4a5b6c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add species_code column to species table."""
    op.add_column('species', sa.Column('species_code', sa.String(length=10), nullable=True))


def downgrade() -> None:
    """Remove species_code column from species table."""
    op.drop_column('species', 'species_code')
