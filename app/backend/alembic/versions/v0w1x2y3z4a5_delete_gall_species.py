"""Delete all species of type gall

Revision ID: v0w1x2y3z4a5
Revises: u9v0w1x2y3z4
Create Date: 2026-01-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'v0w1x2y3z4a5'
down_revision: Union[str, None] = 'u9v0w1x2y3z4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Delete all species of type 'gall'
    connection = op.get_bind()
    result = connection.execute(sa.text("""
        DELETE FROM species WHERE type = 'gall'
    """))
    print(f"Deleted {result.rowcount} species of type 'gall'")


def downgrade() -> None:
    # Cannot restore deleted species - data is lost
    raise NotImplementedError(
        "Cannot downgrade: deleted gall species data cannot be restored. "
        "Restore from backup if needed."
    )
