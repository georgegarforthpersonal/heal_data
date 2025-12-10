"""add_coordinates_to_sighting

Revision ID: b31ef1eedb44
Revises: 127e785ae2ca
Create Date: 2025-12-10 18:20:05.931797

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b31ef1eedb44'
down_revision: Union[str, Sequence[str], None] = '127e785ae2ca'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add coordinates column as PostGIS geometry type (Point with SRID 4326 = WGS84)
    op.execute("""
        ALTER TABLE sighting
        ADD COLUMN coordinates geometry(Point, 4326);
    """)

    # Create spatial index for efficient location queries
    op.execute("""
        CREATE INDEX idx_sighting_coordinates
        ON sighting USING GIST(coordinates);
    """)


def downgrade() -> None:
    """Downgrade schema."""
    # Drop the spatial index
    op.execute("DROP INDEX IF EXISTS idx_sighting_coordinates;")

    # Drop the coordinates column
    op.execute("ALTER TABLE sighting DROP COLUMN IF EXISTS coordinates;")
