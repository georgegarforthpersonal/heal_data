"""Add life stage and behaviour counts to sighting

The British Dragonfly Society's Odonata recording form is a species x behaviour
matrix: for each species on a visit the recorder fills in six numeric columns —
Adults (total), Copulating pairs, Ovipositing females, Larvae, Exuviae and
Emerging adults. Sighting.count already carries the adult total, so this adds
the other five.

They are nullable on purpose: NULL means "not recorded" (every non-Odonata
survey type, and any dragonfly sighting where the surveyor skipped the box),
which is a different statement from 0, meaning "looked for and saw none".

BDS derives its proof-of-breeding tier from these counts rather than asking the
recorder for a status code, so nothing here mirrors the BTO breeding_status_code
table used for birds.

Revision ID: odonata01
Revises: stname01
Create Date: 2026-08-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'odonata01'
down_revision: Union[str, Sequence[str], None] = 'stname01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# BDS form column -> our column name.
STAGE_COLUMNS = (
    'copulating_pairs',
    'ovipositing_females',
    'larvae',
    'exuviae',
    'emerging_adults',
)


def upgrade() -> None:
    # IF NOT EXISTS: test databases are built from SQLModel metadata rather than
    # by running migrations, so the columns may already be present.
    for column in STAGE_COLUMNS:
        op.execute(f'ALTER TABLE sighting ADD COLUMN IF NOT EXISTS {column} INTEGER')
        # ADD CONSTRAINT has no IF NOT EXISTS, so drop first to stay re-runnable.
        op.execute(f'ALTER TABLE sighting DROP CONSTRAINT IF EXISTS sighting_{column}_non_negative')
        op.execute(
            f'ALTER TABLE sighting ADD CONSTRAINT sighting_{column}_non_negative '
            f'CHECK ({column} IS NULL OR {column} >= 0)'
        )


def downgrade() -> None:
    for column in STAGE_COLUMNS:
        op.execute(f'ALTER TABLE sighting DROP CONSTRAINT IF EXISTS sighting_{column}_non_negative')
        op.execute(f'ALTER TABLE sighting DROP COLUMN IF EXISTS {column}')
