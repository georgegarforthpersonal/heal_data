"""create_sighting_image_junction_table

Revision ID: c8f9a0b1d2e3
Revises: b7f8e9a1c2d3
Create Date: 2026-03-31 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8f9a0b1d2e3'
down_revision: Union[str, Sequence[str], None] = 'b7f8e9a1c2d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create sighting_image junction table and migrate existing data."""
    # Create junction table
    op.create_table(
        'sighting_image',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('sighting_id', sa.Integer(), nullable=False),
        sa.Column('camera_trap_image_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['sighting_id'], ['sighting.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['camera_trap_image_id'], ['camera_trap_image.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('sighting_id', 'camera_trap_image_id', name='uq_sighting_image'),
    )
    op.create_index('ix_sighting_image_sighting_id', 'sighting_image', ['sighting_id'])
    op.create_index('ix_sighting_image_camera_trap_image_id', 'sighting_image', ['camera_trap_image_id'])

    # Migrate existing data from sighting_individual.camera_trap_image_id
    op.execute("""
        INSERT INTO sighting_image (sighting_id, camera_trap_image_id)
        SELECT sighting_id, camera_trap_image_id
        FROM sighting_individual
        WHERE camera_trap_image_id IS NOT NULL
        ON CONFLICT DO NOTHING
    """)


def downgrade() -> None:
    """Drop sighting_image junction table."""
    op.drop_index('ix_sighting_image_camera_trap_image_id', table_name='sighting_image')
    op.drop_index('ix_sighting_image_sighting_id', table_name='sighting_image')
    op.drop_table('sighting_image')
