"""Add mite species type

Revision ID: u9v0w1x2y3z4
Revises: t8u9v0w1x2y3
Create Date: 2026-01-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'u9v0w1x2y3z4'
down_revision: Union[str, None] = 't8u9v0w1x2y3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add mite species type
    connection = op.get_bind()
    connection.execute(sa.text("""
        INSERT INTO species_type (name, display_name)
        VALUES ('mite', 'Mite')
    """))


def downgrade() -> None:
    # Remove mite species type
    connection = op.get_bind()
    connection.execute(sa.text("""
        DELETE FROM species_type WHERE name = 'mite'
    """))
