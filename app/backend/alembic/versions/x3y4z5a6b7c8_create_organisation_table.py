"""Create organisation table

Revision ID: x3y4z5a6b7c8
Revises: w1x2y3z4a5b7
Create Date: 2026-02-18

This migration creates the organisation table to support multi-tenancy.
Each organisation has its own surveys, surveyors, locations, and survey types.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'x3y4z5a6b7c8'
down_revision: Union[str, None] = 'w1x2y3z4a5b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create organisation table."""
    op.create_table(
        'organisation',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('admin_password_hash', sa.String(255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('TRUE')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.UniqueConstraint('slug', name='uq_organisation_slug'),
        sa.UniqueConstraint('domain', name='uq_organisation_domain')
    )

    # Create indexes for fast lookups
    op.create_index('ix_organisation_slug', 'organisation', ['slug'])
    op.create_index('ix_organisation_domain', 'organisation', ['domain'])


def downgrade() -> None:
    """Drop organisation table."""
    op.drop_index('ix_organisation_domain', table_name='organisation')
    op.drop_index('ix_organisation_slug', table_name='organisation')
    op.drop_table('organisation')
