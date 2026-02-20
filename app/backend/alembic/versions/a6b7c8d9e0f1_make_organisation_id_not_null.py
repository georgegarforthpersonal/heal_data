"""Make organisation_id columns NOT NULL

Revision ID: a6b7c8d9e0f1
Revises: z5a6b7c8d9e0
Create Date: 2026-02-18

This migration makes organisation_id columns NOT NULL after data has been backfilled.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a6b7c8d9e0f1'
down_revision: Union[str, None] = 'z5a6b7c8d9e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Make organisation_id columns NOT NULL."""
    tables = ['survey', 'surveyor', 'location', 'survey_type']

    for table in tables:
        op.alter_column(
            table,
            'organisation_id',
            existing_type=sa.Integer(),
            nullable=False
        )


def downgrade() -> None:
    """Make organisation_id columns nullable again."""
    tables = ['survey', 'surveyor', 'location', 'survey_type']

    for table in tables:
        op.alter_column(
            table,
            'organisation_id',
            existing_type=sa.Integer(),
            nullable=True
        )
