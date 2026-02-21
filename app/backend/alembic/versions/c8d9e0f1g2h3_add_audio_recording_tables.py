"""Add audio recording tables for bird audio analysis

Revision ID: c8d9e0f1g2h3
Revises: b7c8d9e0f1g2
Create Date: 2026-02-21

Creates tables for storing audio recordings uploaded for BirdNET analysis
and the detection results.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c8d9e0f1g2h3'
down_revision: Union[str, None] = 'b7c8d9e0f1g2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create audio_recording and bird_detection tables."""
    # Audio Recording table
    op.create_table(
        'audio_recording',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('survey_id', sa.Integer(), sa.ForeignKey('survey.id', ondelete='CASCADE'), nullable=False),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('r2_key', sa.String(500), nullable=False, unique=True),
        sa.Column('file_size_bytes', sa.BigInteger(), nullable=True),
        sa.Column('duration_seconds', sa.Float(), nullable=True),
        sa.Column('recording_timestamp', sa.DateTime(), nullable=True),
        sa.Column('device_serial', sa.String(50), nullable=True),
        sa.Column('processing_status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('processing_started_at', sa.DateTime(), nullable=True),
        sa.Column('processing_completed_at', sa.DateTime(), nullable=True),
        sa.Column('processing_error', sa.Text(), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_index('ix_audio_recording_survey_id', 'audio_recording', ['survey_id'])
    op.create_index('ix_audio_recording_processing_status', 'audio_recording', ['processing_status'])

    # Bird Detection table
    op.create_table(
        'bird_detection',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('audio_recording_id', sa.Integer(),
                  sa.ForeignKey('audio_recording.id', ondelete='CASCADE'), nullable=False),
        sa.Column('species_name', sa.String(255), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('detection_timestamp', sa.DateTime(), nullable=False),
        sa.Column('species_id', sa.Integer(), sa.ForeignKey('species.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_index('ix_bird_detection_audio_recording_id', 'bird_detection', ['audio_recording_id'])
    op.create_index('ix_bird_detection_species_name', 'bird_detection', ['species_name'])
    op.create_index('ix_bird_detection_species_id', 'bird_detection', ['species_id'])


def downgrade() -> None:
    """Drop audio_recording and bird_detection tables."""
    op.drop_index('ix_bird_detection_species_id', table_name='bird_detection')
    op.drop_index('ix_bird_detection_species_name', table_name='bird_detection')
    op.drop_index('ix_bird_detection_audio_recording_id', table_name='bird_detection')
    op.drop_table('bird_detection')

    op.drop_index('ix_audio_recording_processing_status', table_name='audio_recording')
    op.drop_index('ix_audio_recording_survey_id', table_name='audio_recording')
    op.drop_table('audio_recording')
