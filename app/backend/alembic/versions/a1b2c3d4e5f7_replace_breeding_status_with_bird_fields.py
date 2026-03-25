"""replace_breeding_status_with_bird_fields

Revision ID: a1b2c3d4e5f7
Revises: z5a6b7c8d9e0
Create Date: 2026-03-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f7'
down_revision: Union[str, Sequence[str], None] = 'k6l7m8n9o0p1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Replace breeding_status_code with sex, posture, singing fields on sighting_individual."""

    # Create new enum types
    op.execute("CREATE TYPE bird_sex AS ENUM ('male', 'female');")
    op.execute("CREATE TYPE bird_posture AS ENUM ('flying', 'perched');")

    # Add new columns to sighting_individual
    op.execute("ALTER TABLE sighting_individual ADD COLUMN sex bird_sex;")
    op.execute("ALTER TABLE sighting_individual ADD COLUMN posture bird_posture;")
    op.execute("ALTER TABLE sighting_individual ADD COLUMN singing BOOLEAN;")

    # Drop the FK constraint on breeding_status_code (auto-named by PostgreSQL)
    op.execute("""
        ALTER TABLE sighting_individual
        DROP CONSTRAINT IF EXISTS sighting_individual_breeding_status_code_fkey;
    """)

    # Rename old column to preserve data for revertibility
    op.execute("""
        ALTER TABLE sighting_individual
        RENAME COLUMN breeding_status_code TO legacy_breeding_status_code;
    """)


def downgrade() -> None:
    """Restore breeding_status_code and remove bird observation fields."""

    # Rename legacy column back
    op.execute("""
        ALTER TABLE sighting_individual
        RENAME COLUMN legacy_breeding_status_code TO breeding_status_code;
    """)

    # Re-add FK constraint
    op.execute("""
        ALTER TABLE sighting_individual
        ADD CONSTRAINT sighting_individual_breeding_status_code_fkey
        FOREIGN KEY (breeding_status_code) REFERENCES breeding_status_code(code);
    """)

    # Drop new columns
    op.execute("ALTER TABLE sighting_individual DROP COLUMN IF EXISTS sex;")
    op.execute("ALTER TABLE sighting_individual DROP COLUMN IF EXISTS posture;")
    op.execute("ALTER TABLE sighting_individual DROP COLUMN IF EXISTS singing;")

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS bird_posture;")
    op.execute("DROP TYPE IF EXISTS bird_sex;")
