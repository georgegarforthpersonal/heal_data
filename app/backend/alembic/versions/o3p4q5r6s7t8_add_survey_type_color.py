"""Add color field to survey_type table

Revision ID: o3p4q5r6s7t8
Revises: n2o3p4q5r6s7
Create Date: 2026-01-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'o3p4q5r6s7t8'
down_revision: Union[str, None] = 'n2o3p4q5r6s7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add color column to survey_type table
    op.add_column('survey_type', sa.Column('color', sa.String(20), nullable=True))

    # Set default colors for existing survey types
    op.execute("""
        UPDATE survey_type
        SET color = 'blue'
        WHERE name = 'Birders Weekly Survey'
    """)
    op.execute("""
        UPDATE survey_type
        SET color = 'purple'
        WHERE name = 'Jenny General Survey'
    """)


def downgrade() -> None:
    op.drop_column('survey_type', 'color')
