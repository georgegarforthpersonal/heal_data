"""Add icon field to survey_type table

Revision ID: n2o3p4q5r6s7
Revises: m1n2o3p4q5r6
Create Date: 2025-01-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'n2o3p4q5r6s7'
down_revision: Union[str, None] = 'm1n2o3p4q5r6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add icon column to survey_type table
    op.add_column('survey_type', sa.Column('icon', sa.String(50), nullable=True))

    # Set default icons for existing survey types
    op.execute("""
        UPDATE survey_type
        SET icon = 'binoculars'
        WHERE name = 'Birders Weekly Survey'
    """)
    op.execute("""
        UPDATE survey_type
        SET icon = 'clipboard-list'
        WHERE name = 'Jenny General Survey'
    """)


def downgrade() -> None:
    op.drop_column('survey_type', 'icon')
