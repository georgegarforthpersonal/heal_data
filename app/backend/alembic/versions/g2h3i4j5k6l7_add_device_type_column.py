"""Add device_type column to device table

Revision ID: g2h3i4j5k6l7
Revises: f1g2h3i4j5k6
Create Date: 2026-02-28

Adds device_type column to distinguish between audio recorders and camera traps.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'g2h3i4j5k6l7'
down_revision: Union[str, None] = 'f1g2h3i4j5k6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add device_type column to device table."""
    # Add device_type column with default 'audio_recorder' for existing devices
    op.add_column('device', sa.Column('device_type', sa.String(20), nullable=False, server_default='audio_recorder'))


def downgrade() -> None:
    """Remove device_type column from device table."""
    op.drop_column('device', 'device_type')
