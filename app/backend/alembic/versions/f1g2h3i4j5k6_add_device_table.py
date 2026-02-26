"""Add device table for audio recorder management

Revision ID: f1g2h3i4j5k6
Revises: e0f1g2h3i4j5
Create Date: 2026-02-26

This migration creates the device table for managing audio recording devices.
Devices store:
- device_id: Serial number from audio filenames (e.g., "2MM24020")
- point_geometry: GPS position of the device
- location_id: Optional association with a broader location area
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1g2h3i4j5k6'
down_revision: Union[str, None] = 'e0f1g2h3i4j5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create device table."""
    op.execute("""
        CREATE TABLE device (
            id SERIAL PRIMARY KEY,
            device_id VARCHAR(50) NOT NULL,
            name VARCHAR(255),
            point_geometry geometry(Point, 4326),
            location_id INTEGER REFERENCES location(id) ON DELETE SET NULL,
            organisation_id INTEGER NOT NULL REFERENCES organisation(id) ON DELETE CASCADE,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            CONSTRAINT uq_device_org_device_id UNIQUE (organisation_id, device_id)
        );
    """)

    # Create indexes for common queries
    op.execute("CREATE INDEX ix_device_organisation_id ON device(organisation_id);")
    op.execute("CREATE INDEX ix_device_device_id ON device(device_id);")
    op.execute("CREATE INDEX ix_device_location_id ON device(location_id);")
    op.execute("CREATE INDEX ix_device_geometry ON device USING GIST(point_geometry);")


def downgrade() -> None:
    """Drop device table."""
    op.execute("DROP INDEX IF EXISTS ix_device_geometry;")
    op.execute("DROP INDEX IF EXISTS ix_device_location_id;")
    op.execute("DROP INDEX IF EXISTS ix_device_device_id;")
    op.execute("DROP INDEX IF EXISTS ix_device_organisation_id;")
    op.execute("DROP TABLE IF EXISTS device;")
