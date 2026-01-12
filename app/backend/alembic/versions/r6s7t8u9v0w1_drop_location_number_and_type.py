"""Drop unused number and type columns from location table

Revision ID: r6s7t8u9v0w1
Revises: q5r6s7t8u9v0
Create Date: 2026-01-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'r6s7t8u9v0w1'
down_revision: Union[str, None] = 'q5r6s7t8u9v0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the unused number and type columns from location table
    op.drop_column('location', 'number')
    op.drop_column('location', 'type')


def downgrade() -> None:
    # Re-add the columns with defaults
    op.add_column('location', sa.Column('type', sa.VARCHAR(length=50), nullable=True))
    op.add_column('location', sa.Column('number', sa.INTEGER(), nullable=True))

    # Set default values for existing rows
    op.execute("UPDATE location SET type = 'general', number = id")

    # Make columns non-nullable
    op.alter_column('location', 'type', nullable=False)
    op.alter_column('location', 'number', nullable=False)
