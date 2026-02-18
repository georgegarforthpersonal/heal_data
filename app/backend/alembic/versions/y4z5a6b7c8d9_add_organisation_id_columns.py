"""Add organisation_id columns to tenant tables

Revision ID: y4z5a6b7c8d9
Revises: x3y4z5a6b7c8
Create Date: 2026-02-18

This migration adds organisation_id foreign key columns to:
- survey
- surveyor
- location
- survey_type

Initially nullable to allow backfilling existing data.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'y4z5a6b7c8d9'
down_revision: Union[str, None] = 'x3y4z5a6b7c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add organisation_id columns (nullable) to tenant tables."""
    tables = ['survey', 'surveyor', 'location', 'survey_type']

    for table in tables:
        # Add nullable column
        op.add_column(
            table,
            sa.Column('organisation_id', sa.Integer(), nullable=True)
        )

        # Add foreign key constraint
        op.create_foreign_key(
            f'fk_{table}_organisation',
            table,
            'organisation',
            ['organisation_id'],
            ['id']
        )

        # Add index for fast filtering
        op.create_index(
            f'ix_{table}_organisation_id',
            table,
            ['organisation_id']
        )


def downgrade() -> None:
    """Remove organisation_id columns from tenant tables."""
    tables = ['survey', 'surveyor', 'location', 'survey_type']

    for table in tables:
        # Drop index
        op.drop_index(f'ix_{table}_organisation_id', table_name=table)

        # Drop foreign key
        op.drop_constraint(f'fk_{table}_organisation', table, type_='foreignkey')

        # Drop column
        op.drop_column(table, 'organisation_id')
