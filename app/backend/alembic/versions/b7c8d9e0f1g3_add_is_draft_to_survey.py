"""Add is_draft field to survey table

Revision ID: b7c8d9e0f1g3
Revises: e0f1g2h3i4j5
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b7c8d9e0f1g3'
down_revision = 'e0f1g2h3i4j5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_draft column with default False
    op.add_column('survey', sa.Column('is_draft', sa.Boolean(), nullable=False, server_default='false'))

    # Add index for filtering drafts
    op.create_index('ix_survey_is_draft', 'survey', ['is_draft'])


def downgrade() -> None:
    op.drop_index('ix_survey_is_draft', table_name='survey')
    op.drop_column('survey', 'is_draft')