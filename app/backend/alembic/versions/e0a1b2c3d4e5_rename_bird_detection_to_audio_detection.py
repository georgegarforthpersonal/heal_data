"""rename_bird_detection_to_audio_detection

Revision ID: e0a1b2c3d4e5
Revises: d9f0a1b2c3d4
Create Date: 2026-04-01 12:00:00.000000

Renames bird_detection table to audio_detection for generality.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'e0a1b2c3d4e5'
down_revision: Union[str, None] = 'd9f0a1b2c3d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.rename_table('bird_detection', 'audio_detection')
    # Rename indexes
    op.execute('ALTER INDEX IF EXISTS ix_bird_detection_audio_recording_id RENAME TO ix_audio_detection_audio_recording_id')
    op.execute('ALTER INDEX IF EXISTS ix_bird_detection_sighting_id RENAME TO ix_audio_detection_sighting_id')
    # Rename foreign key constraint from sighting_id migration
    op.execute('ALTER TABLE audio_detection RENAME CONSTRAINT fk_bird_detection_sighting_id TO fk_audio_detection_sighting_id')


def downgrade() -> None:
    op.execute('ALTER TABLE audio_detection RENAME CONSTRAINT fk_audio_detection_sighting_id TO fk_bird_detection_sighting_id')
    op.execute('ALTER INDEX IF EXISTS ix_audio_detection_sighting_id RENAME TO ix_bird_detection_sighting_id')
    op.execute('ALTER INDEX IF EXISTS ix_audio_detection_audio_recording_id RENAME TO ix_bird_detection_audio_recording_id')
    op.rename_table('audio_detection', 'bird_detection')
