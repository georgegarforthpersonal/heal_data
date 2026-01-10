"""add_is_active_to_surveyor

Revision ID: 127e785ae2ca
Revises: 3ab5504990d6
Create Date: 2025-12-07 10:59:42.805777

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '127e785ae2ca'
down_revision: Union[str, Sequence[str], None] = '3ab5504990d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add is_active column with default value of TRUE
    op.add_column('surveyor', sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove is_active column
    op.drop_column('surveyor', 'is_active')
