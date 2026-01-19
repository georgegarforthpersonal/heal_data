"""Add woodlouse species type

Revision ID: x2y3z4a5b6c7
Revises: w1x2y3z4a5b6
Create Date: 2026-01-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'x2y3z4a5b6c7'
down_revision: Union[str, None] = 'w1x2y3z4a5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add woodlouse species type
    connection = op.get_bind()
    connection.execute(sa.text("""
        INSERT INTO species_type (name, display_name)
        VALUES ('woodlouse', 'Woodlouse')
    """))


def downgrade() -> None:
    # Remove woodlouse species type
    connection = op.get_bind()
    connection.execute(sa.text("""
        DELETE FROM species_type WHERE name = 'woodlouse'
    """))
