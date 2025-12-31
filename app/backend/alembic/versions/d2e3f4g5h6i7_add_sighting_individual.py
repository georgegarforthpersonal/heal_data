"""add_sighting_individual

Revision ID: d2e3f4g5h6i7
Revises: c1d2e3f4g5h6
Create Date: 2025-12-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd2e3f4g5h6i7'
down_revision: Union[str, Sequence[str], None] = 'c1d2e3f4g5h6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add sighting_individual table for per-point locations with breeding status."""

    # Create sighting_individual table
    op.execute("""
        CREATE TABLE sighting_individual (
            id SERIAL PRIMARY KEY,
            sighting_id INTEGER NOT NULL REFERENCES sighting(id) ON DELETE CASCADE,
            coordinates geometry(Point, 4326) NOT NULL,
            breeding_status_code VARCHAR(2) REFERENCES breeding_status_code(code),
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Create spatial index for efficient location queries
    op.execute("""
        CREATE INDEX idx_sighting_individual_coordinates
        ON sighting_individual USING GIST(coordinates);
    """)

    # Create index on sighting_id for fast lookups
    op.execute("""
        CREATE INDEX idx_sighting_individual_sighting_id
        ON sighting_individual(sighting_id);
    """)


def downgrade() -> None:
    """Remove sighting_individual table."""
    op.execute("DROP INDEX IF EXISTS idx_sighting_individual_sighting_id;")
    op.execute("DROP INDEX IF EXISTS idx_sighting_individual_coordinates;")
    op.execute("DROP TABLE IF EXISTS sighting_individual;")
