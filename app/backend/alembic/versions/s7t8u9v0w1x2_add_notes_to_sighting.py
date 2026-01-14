"""Add notes column to sighting table

Revision ID: s7t8u9v0w1x2
Revises: r6s7t8u9v0w1
Create Date: 2026-01-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 's7t8u9v0w1x2'
down_revision: Union[str, None] = 'r6s7t8u9v0w1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add notes column to sighting table (nullable text field)
    op.add_column('sighting', sa.Column('notes', sa.Text(), nullable=True))


def downgrade() -> None:
    # Remove notes column from sighting table
    op.drop_column('sighting', 'notes')
