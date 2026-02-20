"""Drop organisation domain column

No longer needed - org identification now uses session tokens
and X-Org-Slug header instead of domain matching.

Revision ID: b7c8d9e0f1g2
Revises: z5a6b7c8d9e0
Create Date: 2024-02-20
"""
from alembic import op
import sqlalchemy as sa


revision = 'b7c8d9e0f1g2'
down_revision = 'z5a6b7c8d9e0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column('organisation', 'domain')


def downgrade() -> None:
    op.add_column('organisation', sa.Column('domain', sa.String(255), nullable=True))
