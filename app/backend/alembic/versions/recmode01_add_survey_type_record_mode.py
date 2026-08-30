"""Add record_mode to survey_type

Revision ID: recmode01
Revises: idem01
Create Date: 2026-08-16

Which entry surface a survey type's sightings use — 'list' (count-driven
tallies) or 'map' (tap the map where the sighting was). Fixed on phones,
the default on desktop. Existing rows default to 'list'; the per-org
assignment (Cannwood → map, Heal → list) is applied by
scripts/set_record_modes.py, which must be run per environment after this
migration.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'recmode01'
down_revision: Union[str, Sequence[str], None] = 'idem01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'survey_type',
        sa.Column('record_mode', sa.String(10), nullable=False, server_default='list'),
    )


def downgrade() -> None:
    op.drop_column('survey_type', 'record_mode')
