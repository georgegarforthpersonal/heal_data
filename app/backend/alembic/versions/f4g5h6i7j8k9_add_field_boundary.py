"""add_field_boundary

Revision ID: f4g5h6i7j8k9
Revises: e3f4g5h6i7j8
Create Date: 2025-12-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4g5h6i7j8k9'
down_revision: Union[str, Sequence[str], None] = 'e3f4g5h6i7j8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add field_boundary table for location polygon boundaries."""

    # Create field_boundary table with PostGIS Polygon geometry
    op.execute("""
        CREATE TABLE field_boundary (
            id SERIAL PRIMARY KEY,
            location_id INTEGER NOT NULL REFERENCES location(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            geometry geometry(Polygon, 4326) NOT NULL,
            fill_color VARCHAR(7) DEFAULT '#3388ff',
            stroke_color VARCHAR(7) DEFAULT '#3388ff',
            fill_opacity REAL DEFAULT 0.2,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Create spatial index for efficient queries
    op.execute("""
        CREATE INDEX idx_field_boundary_geometry
        ON field_boundary USING GIST(geometry);
    """)

    # Create index on location_id for fast lookups
    op.execute("""
        CREATE INDEX idx_field_boundary_location_id
        ON field_boundary(location_id);
    """)


def downgrade() -> None:
    """Remove field_boundary table."""
    op.execute("DROP INDEX IF EXISTS idx_field_boundary_location_id;")
    op.execute("DROP INDEX IF EXISTS idx_field_boundary_geometry;")
    op.execute("DROP TABLE IF EXISTS field_boundary;")
