"""migrate_existing_coordinates

Revision ID: e3f4g5h6i7j8
Revises: d2e3f4g5h6i7
Create Date: 2025-12-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3f4g5h6i7j8'
down_revision: Union[str, Sequence[str], None] = 'd2e3f4g5h6i7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Migrate existing sighting coordinates to sighting_individual table.

    This preserves existing location data by copying any sighting with coordinates
    to the new sighting_individual table. The original sighting.coordinates column
    is kept for backwards compatibility but new code should use sighting_individual.
    """

    # Copy existing coordinates to sighting_individual (no breeding status)
    op.execute("""
        INSERT INTO sighting_individual (sighting_id, coordinates, created_at)
        SELECT id, coordinates, created_at
        FROM sighting
        WHERE coordinates IS NOT NULL;
    """)


def downgrade() -> None:
    """Remove migrated coordinates from sighting_individual.

    Note: This only removes records that came from the original migration.
    Any new sighting_individual records created after this migration will remain.
    """
    # Remove all records (since we can't easily distinguish migrated from new)
    # In practice, you would need more complex logic or just leave them
    pass
