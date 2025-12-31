"""Seed initial survey types

Revision ID: m1n2o3p4q5r6
Revises: l0m1n2o3p4q5
Create Date: 2024-12-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'm1n2o3p4q5r6'
down_revision: Union[str, Sequence[str], None] = 'l0m1n2o3p4q5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()

    # Helper function to get or create location
    def ensure_location(name: str, number: int) -> int:
        """Get location ID, creating if it doesn't exist"""
        result = connection.execute(sa.text(
            "SELECT id FROM location WHERE name = :name"
        ), {"name": name})
        row = result.fetchone()
        if row:
            return row[0]
        # Create the location
        result = connection.execute(sa.text("""
            INSERT INTO location (name, number, type)
            VALUES (:name, :number, 'general')
            RETURNING id
        """), {"name": name, "number": number})
        return result.fetchone()[0]

    # Helper to extract number from location name (e.g., "N1" -> 1, "Northern" -> 1)
    def extract_number(name: str) -> int:
        import re
        match = re.search(r'\d+', name)
        if match:
            return int(match.group())
        # For names like "Northern", "Eastern", "Southern", "Village"
        name_to_number = {"Northern": 100, "Eastern": 101, "Southern": 102, "Village": 103}
        return name_to_number.get(name, 1)

    # =========================================================================
    # 1. Create "Birders Weekly Survey"
    # =========================================================================
    connection.execute(sa.text("""
        INSERT INTO survey_type (name, description, location_at_sighting_level, allow_geolocation)
        VALUES ('Birders Weekly Survey', 'Weekly bird and mammal survey covering main areas', FALSE, TRUE)
    """))
    birders_id = connection.execute(sa.text(
        "SELECT id FROM survey_type WHERE name = 'Birders Weekly Survey'"
    )).scalar()

    # Add locations: Northern, Eastern, Southern
    birders_locations = ["Northern", "Eastern", "Southern"]
    for loc_name in birders_locations:
        loc_id = ensure_location(loc_name, extract_number(loc_name))
        connection.execute(sa.text("""
            INSERT INTO survey_type_location (survey_type_id, location_id)
            VALUES (:survey_type_id, :location_id)
        """), {"survey_type_id": birders_id, "location_id": loc_id})

    # Add species types: Bird, Mammal
    connection.execute(sa.text("""
        INSERT INTO survey_type_species_type (survey_type_id, species_type_id)
        SELECT :survey_type_id, id FROM species_type WHERE name IN ('bird', 'mammal')
    """), {"survey_type_id": birders_id})

    # =========================================================================
    # 2. Create "Jenny General Survey"
    # =========================================================================
    connection.execute(sa.text("""
        INSERT INTO survey_type (name, description, location_at_sighting_level, allow_geolocation)
        VALUES ('Jenny General Survey', 'General field survey with per-sighting locations', TRUE, TRUE)
    """))
    jenny_id = connection.execute(sa.text(
        "SELECT id FROM survey_type WHERE name = 'Jenny General Survey'"
    )).scalar()

    # Add locations: N1-N11, E1-E5, S1-S14, V1-V3
    jenny_locations = (
        [f"N{i}" for i in range(1, 12)] +  # N1-N11
        [f"E{i}" for i in range(1, 6)] +   # E1-E5
        [f"S{i}" for i in range(1, 15)] +  # S1-S14
        [f"V{i}" for i in range(1, 4)]     # V1-V3
    )
    for loc_name in jenny_locations:
        loc_id = ensure_location(loc_name, extract_number(loc_name))
        connection.execute(sa.text("""
            INSERT INTO survey_type_location (survey_type_id, location_id)
            VALUES (:survey_type_id, :location_id)
        """), {"survey_type_id": jenny_id, "location_id": loc_id})

    # Add species types: Bird, Mammal
    connection.execute(sa.text("""
        INSERT INTO survey_type_species_type (survey_type_id, species_type_id)
        SELECT :survey_type_id, id FROM species_type WHERE name IN ('bird', 'mammal')
    """), {"survey_type_id": jenny_id})


def downgrade() -> None:
    connection = op.get_bind()

    # Delete survey types (cascade will delete junction table entries)
    connection.execute(sa.text("""
        DELETE FROM survey_type WHERE name IN ('Birders Weekly Survey', 'Jenny General Survey')
    """))

    # Note: We don't delete locations created by this migration as they may be used elsewhere
