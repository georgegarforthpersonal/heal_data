"""Add camera trap image and detection tables

Revision ID: i4j5k6l7m8n9
Revises: h3i4j5k6l7m8
Create Date: 2026-02-28

Creates tables for storing camera trap images and species detection results.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'i4j5k6l7m8n9'
down_revision: Union[str, None] = 'h3i4j5k6l7m8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create camera_trap_image and camera_trap_detection tables."""
    # Camera Trap Image table
    op.create_table(
        'camera_trap_image',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('survey_id', sa.Integer(), sa.ForeignKey('survey.id', ondelete='CASCADE'), nullable=False),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('r2_key', sa.String(500), nullable=False, unique=True),
        sa.Column('file_size_bytes', sa.BigInteger(), nullable=True),
        sa.Column('image_timestamp', sa.DateTime(), nullable=True),
        sa.Column('device_serial', sa.String(50), nullable=True),
        sa.Column('processing_status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('processing_started_at', sa.DateTime(), nullable=True),
        sa.Column('processing_completed_at', sa.DateTime(), nullable=True),
        sa.Column('processing_error', sa.Text(), nullable=True),
        sa.Column('flagged_for_review', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('review_reason', sa.String(255), nullable=True),
        sa.Column('unmatched_species', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_index('ix_camera_trap_image_survey_id', 'camera_trap_image', ['survey_id'])
    op.create_index('ix_camera_trap_image_processing_status', 'camera_trap_image', ['processing_status'])
    op.create_index('ix_camera_trap_image_device_serial', 'camera_trap_image', ['device_serial'])

    # Camera Trap Detection table
    op.create_table(
        'camera_trap_detection',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('camera_trap_image_id', sa.Integer(),
                  sa.ForeignKey('camera_trap_image.id', ondelete='CASCADE'), nullable=False),
        sa.Column('species_name', sa.String(255), nullable=False),
        sa.Column('scientific_name', sa.String(255), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('taxonomic_level', sa.String(50), nullable=True),
        sa.Column('species_id', sa.Integer(), sa.ForeignKey('species.id', ondelete='SET NULL'), nullable=True),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_index('ix_camera_trap_detection_image_id', 'camera_trap_detection', ['camera_trap_image_id'])
    op.create_index('ix_camera_trap_detection_species_id', 'camera_trap_detection', ['species_id'])
    op.create_index('ix_camera_trap_detection_scientific_name', 'camera_trap_detection', ['scientific_name'])


def downgrade() -> None:
    """Drop camera_trap_image and camera_trap_detection tables."""
    op.drop_index('ix_camera_trap_detection_scientific_name', table_name='camera_trap_detection')
    op.drop_index('ix_camera_trap_detection_species_id', table_name='camera_trap_detection')
    op.drop_index('ix_camera_trap_detection_image_id', table_name='camera_trap_detection')
    op.drop_table('camera_trap_detection')

    op.drop_index('ix_camera_trap_image_device_serial', table_name='camera_trap_image')
    op.drop_index('ix_camera_trap_image_processing_status', table_name='camera_trap_image')
    op.drop_index('ix_camera_trap_image_survey_id', table_name='camera_trap_image')
    op.drop_table('camera_trap_image')
