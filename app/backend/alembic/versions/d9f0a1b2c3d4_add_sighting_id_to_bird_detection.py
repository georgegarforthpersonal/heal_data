"""add_sighting_id_to_bird_detection

Revision ID: d9f0a1b2c3d4
Revises: c8f9a0b1d2e3
Create Date: 2026-04-01 10:00:00.000000

Adds sighting_id column to bird_detection table to link detections to sightings.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd9f0a1b2c3d4'
down_revision: Union[str, None] = 'c8f9a0b1d2e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('bird_detection', sa.Column('sighting_id', sa.Integer(), nullable=True))
    op.create_index('ix_bird_detection_sighting_id', 'bird_detection', ['sighting_id'])
    op.create_foreign_key(
        'fk_bird_detection_sighting_id',
        'bird_detection',
        'sighting',
        ['sighting_id'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_bird_detection_sighting_id', 'bird_detection', type_='foreignkey')
    op.drop_index('ix_bird_detection_sighting_id', table_name='bird_detection')
    op.drop_column('bird_detection', 'sighting_id')
