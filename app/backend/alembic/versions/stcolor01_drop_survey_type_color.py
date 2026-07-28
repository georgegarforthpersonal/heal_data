"""drop the survey_type color column

The per-type accent colour is retired: group identity comes from the Canopy
badge artwork (SurveyType.icon slugs), the admin picker is gone, and the one
remaining fallback tile uses a fixed canopy-green tint.

Revision ID: stcolor01
Revises: stname01
Create Date: 2026-07-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'stcolor01'
down_revision: Union[str, Sequence[str], None] = 'stname01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('survey_type', 'color')


def downgrade() -> None:
    # Restores the column, not the discarded values.
    op.add_column('survey_type', sa.Column('color', sa.String(20), nullable=True))
