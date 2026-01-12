"""Make surveyor last_name optional and add unique name constraint

Revision ID: q5r6s7t8u9v0
Revises: p4q5r6s7t8u9
Create Date: 2026-01-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'q5r6s7t8u9v0'
down_revision: Union[str, None] = 'p4q5r6s7t8u9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Make last_name nullable
    op.alter_column('surveyor', 'last_name',
                    existing_type=sa.VARCHAR(length=255),
                    nullable=True)

    # Add unique index to prevent duplicate names (case-insensitive)
    # COALESCE treats NULL and empty string as equivalent
    op.execute("""
        CREATE UNIQUE INDEX ix_surveyor_name_unique
        ON surveyor (LOWER(first_name), LOWER(COALESCE(last_name, '')))
    """)


def downgrade() -> None:
    # Remove unique index
    op.drop_index('ix_surveyor_name_unique', table_name='surveyor')

    # Set any NULL last_names to empty string before making non-nullable
    op.execute("UPDATE surveyor SET last_name = '' WHERE last_name IS NULL")

    # Make last_name non-nullable again
    op.alter_column('surveyor', 'last_name',
                    existing_type=sa.VARCHAR(length=255),
                    nullable=False)
