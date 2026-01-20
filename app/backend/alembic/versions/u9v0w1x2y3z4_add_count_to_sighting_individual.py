"""Add count column to sighting_individual table

Revision ID: u9v0w1x2y3z4
Revises: t8u9v0w1x2y3
Create Date: 2026-01-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'u9v0w1x2y3z4'
down_revision: Union[str, None] = 't8u9v0w1x2y3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add count column to sighting_individual table
    # Default to 1 for backwards compatibility (existing records represent 1 individual)
    op.add_column(
        'sighting_individual',
        sa.Column('count', sa.Integer(), nullable=False, server_default='1')
    )

    # Add check constraint to ensure count is at least 1
    op.execute("""
        ALTER TABLE sighting_individual
        ADD CONSTRAINT sighting_individual_count_positive CHECK (count >= 1)
    """)


def downgrade() -> None:
    # Remove check constraint
    op.execute("""
        ALTER TABLE sighting_individual
        DROP CONSTRAINT IF EXISTS sighting_individual_count_positive
    """)

    # Remove count column
    op.drop_column('sighting_individual', 'count')
