"""Add fungus species type

Revision ID: w1x2y3z4a5b6
Revises: v0w1x2y3z4a5
Create Date: 2026-01-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'w1x2y3z4a5b6'
down_revision: Union[str, None] = 'v0w1x2y3z4a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add fungus species type
    connection = op.get_bind()
    connection.execute(sa.text("""
        INSERT INTO species_type (name, display_name)
        VALUES ('fungus', 'Fungus')
    """))


def downgrade() -> None:
    # Remove fungus species type
    connection = op.get_bind()
    connection.execute(sa.text("""
        DELETE FROM species_type WHERE name = 'fungus'
    """))
