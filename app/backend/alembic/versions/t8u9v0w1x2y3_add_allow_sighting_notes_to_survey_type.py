"""Add allow_sighting_notes column to survey_type table

Revision ID: t8u9v0w1x2y3
Revises: s7t8u9v0w1x2
Create Date: 2026-01-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 't8u9v0w1x2y3'
down_revision: Union[str, None] = 's7t8u9v0w1x2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add allow_sighting_notes column to survey_type table
    # Default to true for backwards compatibility (existing survey types will have notes enabled)
    op.add_column('survey_type', sa.Column('allow_sighting_notes', sa.Boolean(), nullable=False, server_default='true'))


def downgrade() -> None:
    # Remove allow_sighting_notes column from survey_type table
    op.drop_column('survey_type', 'allow_sighting_notes')
