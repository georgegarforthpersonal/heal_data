"""drop_sighting_coordinates

Revision ID: j8k9l0m1n2o3
Revises: i7j8k9l0m1n2
Create Date: 2025-12-31

This migration removes the deprecated 'coordinates' column from the sighting table.
Individual sighting locations are now stored in the sighting_individual table,
which supports multiple locations per sighting with breeding status codes.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'j8k9l0m1n2o3'
down_revision: Union[str, Sequence[str], None] = 'i7j8k9l0m1n2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove coordinates column from sighting table."""
    # Drop the spatial index first
    op.execute("DROP INDEX IF EXISTS idx_sighting_coordinates;")

    # Drop the coordinates column
    op.execute("ALTER TABLE sighting DROP COLUMN IF EXISTS coordinates;")


def downgrade() -> None:
    """Restore coordinates column to sighting table."""
    # Add coordinates column back as PostGIS geometry type (Point with SRID 4326 = WGS84)
    op.execute("""
        ALTER TABLE sighting
        ADD COLUMN coordinates geometry(Point, 4326);
    """)

    # Recreate spatial index
    op.execute("""
        CREATE INDEX idx_sighting_coordinates
        ON sighting USING GIST(coordinates);
    """)
