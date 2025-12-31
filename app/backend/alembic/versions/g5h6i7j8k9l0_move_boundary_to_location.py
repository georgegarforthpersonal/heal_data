"""move_boundary_to_location

Move field boundary data from separate table to location table (1:1 relationship).

Revision ID: g5h6i7j8k9l0
Revises: f4g5h6i7j8k9
Create Date: 2025-12-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'g5h6i7j8k9l0'
down_revision: Union[str, Sequence[str], None] = 'f4g5h6i7j8k9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Move boundary data from field_boundary table to location table.

    This migration:
    1. Adds boundary columns to location table
    2. Migrates existing data from field_boundary (takes first boundary per location)
    3. Drops the field_boundary table
    """

    # Step 1: Add boundary columns to location table
    op.execute("""
        ALTER TABLE location
        ADD COLUMN boundary_geometry geometry(Polygon, 4326),
        ADD COLUMN boundary_fill_color VARCHAR(7) DEFAULT '#3388ff',
        ADD COLUMN boundary_stroke_color VARCHAR(7) DEFAULT '#3388ff',
        ADD COLUMN boundary_fill_opacity REAL DEFAULT 0.2;
    """)

    # Step 2: Migrate existing field_boundary data to location
    # Takes the first boundary for each location (by id) since we're moving to 1:1
    op.execute("""
        UPDATE location l
        SET
            boundary_geometry = fb.geometry,
            boundary_fill_color = fb.fill_color,
            boundary_stroke_color = fb.stroke_color,
            boundary_fill_opacity = fb.fill_opacity
        FROM (
            SELECT DISTINCT ON (location_id)
                location_id, geometry, fill_color, stroke_color, fill_opacity
            FROM field_boundary
            ORDER BY location_id, id
        ) fb
        WHERE l.id = fb.location_id;
    """)

    # Step 3: Drop the field_boundary table
    op.execute("DROP TABLE IF EXISTS field_boundary CASCADE;")


def downgrade() -> None:
    """
    Restore field_boundary table and move data back from location.
    """

    # Step 1: Recreate field_boundary table
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

    # Step 2: Create indexes
    op.execute("""
        CREATE INDEX idx_field_boundary_geometry ON field_boundary USING GIST(geometry);
        CREATE INDEX idx_field_boundary_location_id ON field_boundary(location_id);
    """)

    # Step 3: Migrate data back from location to field_boundary
    op.execute("""
        INSERT INTO field_boundary (location_id, name, geometry, fill_color, stroke_color, fill_opacity)
        SELECT
            id,
            name,  -- Use location name as boundary name
            boundary_geometry,
            boundary_fill_color,
            boundary_stroke_color,
            boundary_fill_opacity
        FROM location
        WHERE boundary_geometry IS NOT NULL;
    """)

    # Step 4: Remove boundary columns from location table
    op.execute("""
        ALTER TABLE location
        DROP COLUMN IF EXISTS boundary_geometry,
        DROP COLUMN IF EXISTS boundary_fill_color,
        DROP COLUMN IF EXISTS boundary_stroke_color,
        DROP COLUMN IF EXISTS boundary_fill_opacity;
    """)
