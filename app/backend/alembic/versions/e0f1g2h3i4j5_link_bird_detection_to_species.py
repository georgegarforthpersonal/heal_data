"""Link bird_detection to species with species_id NOT NULL

Revision ID: e0f1g2h3i4j5
Revises: d9e0f1g2h3i4
Create Date: 2026-02-22

Makes species_id NOT NULL on bird_detection and changes ondelete to CASCADE.
Adds unmatched_species JSON column to audio_recording.
Deletes any existing bird_detection rows with NULL species_id.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e0f1g2h3i4j5'
down_revision: Union[str, None] = 'd9e0f1g2h3i4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add unmatched_species column and make species_id NOT NULL."""
    # Add unmatched_species column to audio_recording
    op.add_column(
        'audio_recording',
        sa.Column('unmatched_species', sa.JSON(), nullable=True)
    )

    # Delete any existing bird_detection rows with NULL species_id
    # This must happen before we make the column NOT NULL
    op.execute("DELETE FROM bird_detection WHERE species_id IS NULL")

    # Drop the existing foreign key constraint
    op.drop_constraint(
        'bird_detection_species_id_fkey',
        'bird_detection',
        type_='foreignkey'
    )

    # Make species_id NOT NULL
    op.alter_column(
        'bird_detection',
        'species_id',
        existing_type=sa.Integer(),
        nullable=False
    )

    # Add new foreign key constraint with CASCADE on delete
    op.create_foreign_key(
        'bird_detection_species_id_fkey',
        'bird_detection',
        'species',
        ['species_id'],
        ['id'],
        ondelete='CASCADE'
    )


def downgrade() -> None:
    """Revert species_id to nullable with SET NULL and remove unmatched_species."""
    # Drop the CASCADE foreign key constraint
    op.drop_constraint(
        'bird_detection_species_id_fkey',
        'bird_detection',
        type_='foreignkey'
    )

    # Make species_id nullable again
    op.alter_column(
        'bird_detection',
        'species_id',
        existing_type=sa.Integer(),
        nullable=True
    )

    # Recreate original foreign key with SET NULL
    op.create_foreign_key(
        'bird_detection_species_id_fkey',
        'bird_detection',
        'species',
        ['species_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # Drop unmatched_species column from audio_recording
    op.drop_column('audio_recording', 'unmatched_species')
