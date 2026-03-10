"""Add camera_trap_image_id to sighting_individual

Revision ID: j5k6l7m8n9o0
Revises: i4j5k6l7m8n9
Create Date: 2026-02-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'j5k6l7m8n9o0'
down_revision: Union[str, None] = 'i4j5k6l7m8n9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('sighting_individual', sa.Column('camera_trap_image_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_sighting_individual_camera_trap_image',
        'sighting_individual',
        'camera_trap_image',
        ['camera_trap_image_id'],
        ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    op.drop_constraint('fk_sighting_individual_camera_trap_image', 'sighting_individual', type_='foreignkey')
    op.drop_column('sighting_individual', 'camera_trap_image_id')
