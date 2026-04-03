"""Fix surveyor unique index to scope by organisation

Revision ID: f1a2b3c4d5e6
Revises: e0a1b2c3d4e5
Create Date: 2026-04-03

The previous unique index on surveyor (first_name, last_name) was global,
preventing the same person from being a surveyor at multiple organisations.
This migration scopes the uniqueness to (organisation_id, first_name, last_name).
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'e0a1b2c3d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the old global unique index
    op.drop_index('ix_surveyor_name_unique', table_name='surveyor')

    # Recreate with organisation_id included
    op.execute("""
        CREATE UNIQUE INDEX ix_surveyor_name_unique
        ON surveyor (organisation_id, LOWER(first_name), LOWER(COALESCE(last_name, '')))
    """)


def downgrade() -> None:
    # Drop the org-scoped index
    op.drop_index('ix_surveyor_name_unique', table_name='surveyor')

    # Restore the old global index
    op.execute("""
        CREATE UNIQUE INDEX ix_surveyor_name_unique
        ON surveyor (LOWER(first_name), LOWER(COALESCE(last_name, '')))
    """)
