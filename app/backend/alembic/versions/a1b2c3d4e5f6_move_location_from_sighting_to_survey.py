"""move_location_from_sighting_to_survey

Revision ID: a1b2c3d4e5f6
Revises: 772dd28ce3c1
Create Date: 2025-11-13 19:45:00.000000

This migration moves the location_id field from the sighting table to the survey table.
For surveys with sightings at multiple locations, it creates separate surveys for each location.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column
from sqlalchemy import Integer, String, Date, Time, Numeric, Boolean, Text, DateTime


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '772dd28ce3c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Move location from sighting to survey, splitting multi-location surveys.

    Process:
    1. Add location_id to survey table (nullable)
    2. For each survey:
       - Get distinct locations from sightings (ordered by location.number)
       - If 1 location: set survey.location_id
       - If multiple locations:
         - Keep first location in original survey
         - Create new surveys for additional locations with copied metadata
         - Reassign sightings to appropriate surveys
    3. Make location_id NOT NULL
    4. Remove location_id from sighting table
    """

    # Step 1: Add location_id column to survey table (nullable for now)
    op.add_column('survey', sa.Column('location_id', sa.Integer(), nullable=True))
    op.create_foreign_key('survey_location_id_fkey', 'survey', 'location', ['location_id'], ['id'])

    # Step 2: Data migration using raw SQL for complex logic
    connection = op.get_bind()

    # Get all surveys with their locations, ordered by date and location number
    surveys_query = """
    SELECT DISTINCT
        s.id as survey_id,
        s.date,
        s.start_time,
        s.end_time,
        s.sun_percentage,
        s.temperature_celsius,
        s.conditions_met,
        s.notes,
        s.type,
        s.created_at
    FROM survey s
    ORDER BY s.date, s.id
    """

    surveys = connection.execute(sa.text(surveys_query)).fetchall()

    for survey in surveys:
        survey_id = survey[0]

        # Get distinct locations for this survey, ordered by location number
        locations_query = """
        SELECT DISTINCT l.id, l.number
        FROM sighting sg
        JOIN location l ON sg.location_id = l.id
        WHERE sg.survey_id = :survey_id
        ORDER BY l.number
        """

        locations = connection.execute(
            sa.text(locations_query),
            {"survey_id": survey_id}
        ).fetchall()

        if not locations:
            # No sightings, skip this survey
            continue

        if len(locations) == 1:
            # Single location - just update the survey
            connection.execute(
                sa.text("UPDATE survey SET location_id = :location_id WHERE id = :survey_id"),
                {"location_id": locations[0][0], "survey_id": survey_id}
            )
        else:
            # Multiple locations - split the survey
            # First location stays with original survey
            first_location_id = locations[0][0]
            connection.execute(
                sa.text("UPDATE survey SET location_id = :location_id WHERE id = :survey_id"),
                {"location_id": first_location_id, "survey_id": survey_id}
            )

            # Get surveyor associations for this survey
            surveyors_query = """
            SELECT surveyor_id
            FROM survey_surveyor
            WHERE survey_id = :survey_id
            """
            surveyors = connection.execute(
                sa.text(surveyors_query),
                {"survey_id": survey_id}
            ).fetchall()

            # Create new surveys for additional locations
            for location_id, location_number in locations[1:]:
                # Create new survey with same metadata
                insert_survey = """
                INSERT INTO survey (
                    date, start_time, end_time, sun_percentage,
                    temperature_celsius, conditions_met, notes, type,
                    location_id, created_at
                )
                VALUES (
                    :date, :start_time, :end_time, :sun_percentage,
                    :temperature_celsius, :conditions_met, :notes, :type,
                    :location_id, :created_at
                )
                RETURNING id
                """

                result = connection.execute(
                    sa.text(insert_survey),
                    {
                        "date": survey[1],
                        "start_time": survey[2],
                        "end_time": survey[3],
                        "sun_percentage": survey[4],
                        "temperature_celsius": survey[5],
                        "conditions_met": survey[6],
                        "notes": survey[7],
                        "type": survey[8],
                        "location_id": location_id,
                        "created_at": survey[9]
                    }
                )

                new_survey_id = result.fetchone()[0]

                # Copy surveyor associations
                for surveyor in surveyors:
                    connection.execute(
                        sa.text("""
                            INSERT INTO survey_surveyor (survey_id, surveyor_id, created_at)
                            VALUES (:survey_id, :surveyor_id, CURRENT_TIMESTAMP)
                        """),
                        {"survey_id": new_survey_id, "surveyor_id": surveyor[0]}
                    )

                # Move sightings for this location to new survey
                connection.execute(
                    sa.text("""
                        UPDATE sighting
                        SET survey_id = :new_survey_id
                        WHERE survey_id = :old_survey_id
                        AND location_id = :location_id
                    """),
                    {
                        "new_survey_id": new_survey_id,
                        "old_survey_id": survey_id,
                        "location_id": location_id
                    }
                )

    # Step 3: Make location_id NOT NULL
    op.alter_column('survey', 'location_id', nullable=False)

    # Step 4: Remove location_id from sighting table
    op.drop_constraint('sighting_location_id_fkey', 'sighting', type_='foreignkey')
    op.drop_column('sighting', 'location_id')


def downgrade() -> None:
    """
    Reverse the migration: move location back to sighting.

    WARNING: This will lose the split survey structure. Surveys that were split
    will be merged back together, and the extra survey records will be lost.
    """

    # Step 1: Add location_id back to sighting table (nullable)
    op.add_column('sighting', sa.Column('location_id', sa.Integer(), nullable=True))
    op.create_foreign_key('sighting_location_id_fkey', 'sighting', 'location', ['location_id'], ['id'], ondelete='CASCADE')

    # Step 2: Copy location_id from survey to sighting
    connection = op.get_bind()
    connection.execute(sa.text("""
        UPDATE sighting sg
        SET location_id = s.location_id
        FROM survey s
        WHERE sg.survey_id = s.id
    """))

    # Step 3: Make location_id NOT NULL on sighting
    op.alter_column('sighting', 'location_id', nullable=False)

    # Step 4: Remove location_id from survey table
    op.drop_constraint('survey_location_id_fkey', 'survey', type_='foreignkey')
    op.drop_column('survey', 'location_id')

    # NOTE: We cannot automatically merge split surveys back together.
    # This would require identifying which surveys were created by the split
    # and merging them, which is complex and potentially error-prone.
    # Manual intervention may be required if you need to truly reverse this migration.
