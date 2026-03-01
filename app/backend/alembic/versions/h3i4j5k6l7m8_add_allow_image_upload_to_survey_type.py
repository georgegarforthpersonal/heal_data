"""Add allow_image_upload column to survey_type table

Revision ID: h3i4j5k6l7m8
Revises: g2h3i4j5k6l7
Create Date: 2026-02-28

Adds allow_image_upload column to enable camera trap image uploads for survey types.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'h3i4j5k6l7m8'
down_revision: Union[str, None] = 'g2h3i4j5k6l7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add allow_image_upload column to survey_type table."""
    # Add allow_image_upload column with default false
    op.add_column('survey_type', sa.Column('allow_image_upload', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    """Remove allow_image_upload column from survey_type table."""
    op.drop_column('survey_type', 'allow_image_upload')
