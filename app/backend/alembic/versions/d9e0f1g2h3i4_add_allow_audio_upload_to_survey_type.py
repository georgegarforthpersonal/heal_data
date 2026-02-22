"""Add allow_audio_upload column to survey_type table

Revision ID: d9e0f1g2h3i4
Revises: c8d9e0f1g2h3
Create Date: 2026-02-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd9e0f1g2h3i4'
down_revision: Union[str, None] = 'c8d9e0f1g2h3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add allow_audio_upload column to survey_type table
    # Default to false for most survey types
    op.add_column('survey_type', sa.Column('allow_audio_upload', sa.Boolean(), nullable=False, server_default='false'))

    # Enable audio upload for survey types named 'Audio' (case-insensitive)
    op.execute("""
        UPDATE survey_type
        SET allow_audio_upload = true
        WHERE LOWER(name) = 'audio'
    """)


def downgrade() -> None:
    # Remove allow_audio_upload column from survey_type table
    op.drop_column('survey_type', 'allow_audio_upload')
