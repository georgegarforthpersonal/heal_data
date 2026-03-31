"""add_megadetector_fields_to_camera_trap_image

Revision ID: b7f8e9a1c2d3
Revises: 127e785ae2ca
Create Date: 2026-03-31 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7f8e9a1c2d3'
down_revision: Union[str, Sequence[str], None] = '127e785ae2ca'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add MegaDetector confidence and false positive flag to camera_trap_image."""
    op.add_column('camera_trap_image', sa.Column('megadetector_confidence', sa.Float(), nullable=True))
    op.add_column('camera_trap_image', sa.Column('is_false_positive', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    """Remove MegaDetector fields from camera_trap_image."""
    op.drop_column('camera_trap_image', 'is_false_positive')
    op.drop_column('camera_trap_image', 'megadetector_confidence')
