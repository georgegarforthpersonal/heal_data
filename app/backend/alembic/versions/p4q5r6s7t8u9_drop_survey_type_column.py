"""Drop type column from survey table

Revision ID: p4q5r6s7t8u9
Revises: o3p4q5r6s7t8
Create Date: 2026-01-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'p4q5r6s7t8u9'
down_revision: Union[str, None] = 'o3p4q5r6s7t8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('survey', 'type')


def downgrade() -> None:
    op.add_column('survey', sa.Column('type', sa.String(50), nullable=True, server_default='butterfly'))
