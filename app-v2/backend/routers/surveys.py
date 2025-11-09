"""
Surveys Router - RESTful API endpoints for survey management

Endpoints:
  GET    /api/surveys              - List all surveys
  POST   /api/surveys              - Create new survey
  GET    /api/surveys/{id}         - Get specific survey
  PUT    /api/surveys/{id}         - Update survey
  DELETE /api/surveys/{id}         - Delete survey
  GET    /api/surveys/{id}/sightings   - Get sightings for survey
  POST   /api/surveys/{id}/sightings   - Add sighting to survey
  PUT    /api/surveys/{id}/sightings/{sighting_id}    - Update sighting
  DELETE /api/surveys/{id}/sightings/{sighting_id}    - Delete sighting
"""

from fastapi import APIRouter, HTTPException, status
from typing import List
from database.connection import get_db_cursor
from models import (
    SurveyRead, SurveyCreate, SurveyUpdate, SurveyWithSightingsCount,
    SightingRead, SightingCreate, SightingUpdate, SightingWithDetails
)

router = APIRouter()


# ============================================================================
# Survey CRUD Operations
# ============================================================================

@router.get("", response_model=List[SurveyWithSightingsCount])
async def get_surveys():
    """
    Get all surveys with sighting counts.

    Returns:
        List of all surveys with sighting counts and species breakdown
    """
    try:
        with get_db_cursor() as cursor:
            # Query adapted from Streamlit POC (surveys.py:get_all_surveys)
            # Added species_breakdown to get counts by species type (butterfly, bird, fungi)
            # Removed survey_type filter - now returns all surveys
            cursor.execute("""
                SELECT
                    s.id,
                    s.date,
                    s.start_time,
                    s.end_time,
                    s.sun_percentage,
                    s.temperature_celsius,
                    s.conditions_met,
                    s.notes,
                    s.type,
                    STRING_AGG(CAST(ss.surveyor_id AS TEXT), ',' ORDER BY ss.surveyor_id) as surveyor_ids,
                    COUNT(DISTINCT si.id) as sightings_count,
                    COALESCE(
                        (
                            SELECT json_agg(json_build_object('type', breakdown.species_type, 'count', breakdown.type_count))
                            FROM (
                                SELECT sp2.type as species_type, COUNT(*) as type_count
                                FROM sighting si2
                                JOIN species sp2 ON si2.species_id = sp2.id
                                WHERE si2.survey_id = s.id
                                GROUP BY sp2.type
                            ) AS breakdown
                        ),
                        '[]'::json
                    ) as species_breakdown
                FROM survey s
                LEFT JOIN survey_surveyor ss ON s.id = ss.survey_id
                LEFT JOIN sighting si ON s.id = si.survey_id
                GROUP BY s.id, s.date, s.start_time, s.end_time, s.sun_percentage,
                         s.temperature_celsius, s.conditions_met, s.notes, s.type
                ORDER BY s.date DESC
            """)

            rows = cursor.fetchall()

            surveys = []
            for row in rows:
                # Parse surveyor_ids from comma-separated string
                surveyor_ids_str = row[9]
                surveyor_ids = [int(id) for id in surveyor_ids_str.split(',')] if surveyor_ids_str else []

                # Parse species_breakdown - psycopg2 returns it as a list already
                species_breakdown = row[11] if row[11] else []

                surveys.append({
                    "id": row[0],
                    "date": row[1],
                    "start_time": row[2],
                    "end_time": row[3],
                    "sun_percentage": row[4],
                    "temperature_celsius": row[5],
                    "conditions_met": row[6],
                    "notes": row[7],
                    "survey_type": row[8],
                    "surveyor_ids": surveyor_ids,
                    "sightings_count": row[10],
                    "species_breakdown": species_breakdown
                })

            return surveys

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch surveys: {str(e)}")


@router.get("/{survey_id}", response_model=SurveyRead)
async def get_survey(survey_id: int):
    """
    Get a specific survey by ID.

    Args:
        survey_id: Survey ID

    Returns:
        Survey details

    Raises:
        404: Survey not found
    """
    try:
        with get_db_cursor() as cursor:
            # Get survey
            cursor.execute("""
                SELECT id, date, start_time, end_time, sun_percentage, temperature_celsius,
                       conditions_met, notes, type
                FROM survey
                WHERE id = %s
            """, (survey_id,))

            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail=f"Survey {survey_id} not found")

            # Get surveyor IDs
            cursor.execute("""
                SELECT surveyor_id
                FROM survey_surveyor
                WHERE survey_id = %s
                ORDER BY surveyor_id
            """, (survey_id,))

            surveyor_rows = cursor.fetchall()
            surveyor_ids = [r[0] for r in surveyor_rows]

            return {
                "id": row[0],
                "date": row[1],
                "start_time": row[2],
                "end_time": row[3],
                "sun_percentage": row[4],
                "temperature_celsius": row[5],
                "conditions_met": row[6],
                "notes": row[7],
                "survey_type": row[8],
                "": row[9],
                "surveyor_ids": surveyor_ids
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch survey: {str(e)}")


@router.post("", response_model=SurveyRead, status_code=status.HTTP_201_CREATED)
async def create_survey(survey: SurveyCreate):
    """
    Create a new survey.

    Args:
        survey: Survey data

    Returns:
        Created survey with ID
    """
    try:
        with get_db_cursor() as cursor:
            # Insert survey
            cursor.execute("""
                INSERT INTO survey (date, start_time, end_time, sun_percentage, temperature_celsius,
                                  conditions_met, notes, type)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, date, start_time, end_time, sun_percentage, temperature_celsius,
                          conditions_met, notes, type
            """, (
                survey.date,
                survey.start_time,
                survey.end_time,
                survey.sun_percentage,
                survey.temperature_celsius,
                survey.conditions_met,
                survey.notes,
                survey.survey_type
            ))

            row = cursor.fetchone()
            survey_id = row[0]

            # Insert surveyor associations
            for surveyor_id in survey.surveyor_ids:
                cursor.execute("""
                    INSERT INTO survey_surveyor (survey_id, surveyor_id)
                    VALUES (%s, %s)
                """, (survey_id, surveyor_id))

            return {
                "id": row[0],
                "date": row[1],
                "start_time": row[2],
                "end_time": row[3],
                "sun_percentage": row[4],
                "temperature_celsius": row[5],
                "conditions_met": row[6],
                "notes": row[7],
                "survey_type": row[8],
                "": row[9],
                "surveyor_ids": survey.surveyor_ids
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create survey: {str(e)}")


@router.put("/{survey_id}", response_model=SurveyRead)
async def update_survey(survey_id: int, survey: SurveyUpdate):
    """
    Update an existing survey.

    Args:
        survey_id: Survey ID
        survey: Updated survey data

    Returns:
        Updated survey

    Raises:
        404: Survey not found
    """
    try:
        with get_db_cursor() as cursor:
            # Check if survey exists
            cursor.execute("SELECT id FROM survey WHERE id = %s", (survey_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail=f"Survey {survey_id} not found")

            # Build dynamic UPDATE query
            update_fields = []
            update_values = []

            if survey.date is not None:
                update_fields.append("date = %s")
                update_values.append(survey.date)
            if survey.start_time is not None:
                update_fields.append("start_time = %s")
                update_values.append(survey.start_time)
            if survey.end_time is not None:
                update_fields.append("end_time = %s")
                update_values.append(survey.end_time)
            if survey.sun_percentage is not None:
                update_fields.append("sun_percentage = %s")
                update_values.append(survey.sun_percentage)
            if survey.temperature_celsius is not None:
                update_fields.append("temperature_celsius = %s")
                update_values.append(survey.temperature_celsius)
            if survey.conditions_met is not None:
                update_fields.append("conditions_met = %s")
                update_values.append(survey.conditions_met)
            if survey.notes is not None:
                update_fields.append("notes = %s")
                update_values.append(survey.notes)
            if survey.survey_type is not None:
                update_fields.append("type = %s")
                update_values.append(survey.survey_type)

            if update_fields:
                update_values.append(survey_id)
                query = f"""
                    UPDATE survey
                    SET {', '.join(update_fields)}
                    WHERE id = %s
                    RETURNING id, date, start_time, end_time, sun_percentage, temperature_celsius,
                              conditions_met, notes, type
                """
                cursor.execute(query, update_values)
                row = cursor.fetchone()
            else:
                # No fields to update, just fetch current state
                cursor.execute("""
                    SELECT id, date, start_time, end_time, sun_percentage, temperature_celsius,
                           conditions_met, notes, type
                    FROM survey
                    WHERE id = %s
                """, (survey_id,))
                row = cursor.fetchone()

            # Update surveyor associations if provided
            if survey.surveyor_ids is not None:
                # Delete existing associations
                cursor.execute("DELETE FROM survey_surveyor WHERE survey_id = %s", (survey_id,))

                # Insert new associations
                for surveyor_id in survey.surveyor_ids:
                    cursor.execute("""
                        INSERT INTO survey_surveyor (survey_id, surveyor_id)
                        VALUES (%s, %s)
                    """, (survey_id, surveyor_id))

            # Get current surveyor IDs
            cursor.execute("""
                SELECT surveyor_id
                FROM survey_surveyor
                WHERE survey_id = %s
                ORDER BY surveyor_id
            """, (survey_id,))
            surveyor_rows = cursor.fetchall()
            surveyor_ids = [r[0] for r in surveyor_rows]

            return {
                "id": row[0],
                "date": row[1],
                "start_time": row[2],
                "end_time": row[3],
                "sun_percentage": row[4],
                "temperature_celsius": row[5],
                "conditions_met": row[6],
                "notes": row[7],
                "survey_type": row[8],
                "": row[9],
                "surveyor_ids": surveyor_ids
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update survey: {str(e)}")


@router.delete("/{survey_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_survey(survey_id: int):
    """
    Delete a survey (CASCADE deletes sightings and surveyor associations).

    Args:
        survey_id: Survey ID

    Raises:
        404: Survey not found
    """
    try:
        with get_db_cursor() as cursor:
            cursor.execute("DELETE FROM survey WHERE id = %s RETURNING id", (survey_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail=f"Survey {survey_id} not found")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete survey: {str(e)}")


# ============================================================================
# Sightings Operations (Nested under surveys)
# ============================================================================

@router.get("/{survey_id}/sightings", response_model=List[SightingWithDetails])
async def get_survey_sightings(survey_id: int):
    """
    Get all sightings for a survey.

    Args:
        survey_id: Survey ID

    Returns:
        List of sightings with species and transect details

    Raises:
        404: Survey not found
    """
    try:
        with get_db_cursor() as cursor:
            # Check if survey exists
            cursor.execute("SELECT id FROM survey WHERE id = %s", (survey_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail=f"Survey {survey_id} not found")

            # Get sightings with species and transect names
            cursor.execute("""
                SELECT
                    si.id,
                    si.survey_id,
                    si.species_id,
                    si.transect_id,
                    si.count,
                    si.id,
                    sp.name as species_name,
                    t.name as transect_name
                FROM sighting si
                JOIN species sp ON si.species_id = sp.id
                JOIN transect t ON si.transect_id = t.id
                WHERE si.survey_id = %s
                ORDER BY sp.name, t.name
            """, (survey_id,))

            rows = cursor.fetchall()

            return [{
                "id": row[0],
                "survey_id": row[1],
                "species_id": row[2],
                "transect_id": row[3],
                "count": row[4],
                "": row[5],
                "species_name": row[6],
                "transect_name": row[7]
            } for row in rows]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch sightings: {str(e)}")


@router.post("/{survey_id}/sightings", response_model=SightingWithDetails, status_code=status.HTTP_201_CREATED)
async def create_sighting(survey_id: int, sighting: SightingCreate):
    """
    Add a sighting to a survey.

    Args:
        survey_id: Survey ID
        sighting: Sighting data

    Returns:
        Created sighting

    Raises:
        404: Survey, species, or transect not found
    """
    try:
        with get_db_cursor() as cursor:
            # Check if survey exists
            cursor.execute("SELECT id FROM survey WHERE id = %s", (survey_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail=f"Survey {survey_id} not found")

            # Insert sighting
            cursor.execute("""
                INSERT INTO sighting (survey_id, species_id, transect_id, count)
                VALUES (%s, %s, %s, %s)
                RETURNING id, survey_id, species_id, transect_id, count
            """, (survey_id, sighting.species_id, sighting.transect_id, sighting.count))

            row = cursor.fetchone()

            # Get species and transect names
            cursor.execute("SELECT name FROM species WHERE id = %s", (sighting.species_id,))
            species_row = cursor.fetchone()

            cursor.execute("SELECT name FROM transect WHERE id = %s", (sighting.transect_id,))
            transect_row = cursor.fetchone()

            return {
                "id": row[0],
                "survey_id": row[1],
                "species_id": row[2],
                "transect_id": row[3],
                "count": row[4],
                "": row[5],
                "species_name": species_row[0] if species_row else None,
                "transect_name": transect_row[0] if transect_row else None
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create sighting: {str(e)}")


@router.put("/{survey_id}/sightings/{sighting_id}", response_model=SightingWithDetails)
async def update_sighting(survey_id: int, sighting_id: int, sighting: SightingUpdate):
    """
    Update a sighting.

    Args:
        survey_id: Survey ID
        sighting_id: Sighting ID
        sighting: Updated sighting data

    Returns:
        Updated sighting

    Raises:
        404: Survey or sighting not found
    """
    try:
        with get_db_cursor() as cursor:
            # Check if sighting exists and belongs to this survey
            cursor.execute("""
                SELECT id FROM sighting
                WHERE id = %s AND survey_id = %s
            """, (sighting_id, survey_id))

            if not cursor.fetchone():
                raise HTTPException(
                    status_code=404,
                    detail=f"Sighting {sighting_id} not found for survey {survey_id}"
                )

            # Build dynamic UPDATE query
            update_fields = []
            update_values = []

            if sighting.species_id is not None:
                update_fields.append("species_id = %s")
                update_values.append(sighting.species_id)
            if sighting.transect_id is not None:
                update_fields.append("transect_id = %s")
                update_values.append(sighting.transect_id)
            if sighting.count is not None:
                update_fields.append("count = %s")
                update_values.append(sighting.count)

            if update_fields:
                update_values.append(sighting_id)
                query = f"""
                    UPDATE sighting
                    SET {', '.join(update_fields)}
                    WHERE id = %s
                    RETURNING id, survey_id, species_id, transect_id, count
                """
                cursor.execute(query, update_values)
                row = cursor.fetchone()
            else:
                # No fields to update, just fetch current state
                cursor.execute("""
                    SELECT id, survey_id, species_id, transect_id, count
                    FROM sighting
                    WHERE id = %s
                """, (sighting_id,))
                row = cursor.fetchone()

            # Get species and transect names
            cursor.execute("SELECT name FROM species WHERE id = %s", (row[2],))
            species_row = cursor.fetchone()

            cursor.execute("SELECT name FROM transect WHERE id = %s", (row[3],))
            transect_row = cursor.fetchone()

            return {
                "id": row[0],
                "survey_id": row[1],
                "species_id": row[2],
                "transect_id": row[3],
                "count": row[4],
                "": row[5],
                "species_name": species_row[0] if species_row else None,
                "transect_name": transect_row[0] if transect_row else None
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update sighting: {str(e)}")


@router.delete("/{survey_id}/sightings/{sighting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sighting(survey_id: int, sighting_id: int):
    """
    Delete a sighting.

    Args:
        survey_id: Survey ID
        sighting_id: Sighting ID

    Raises:
        404: Survey or sighting not found
    """
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                DELETE FROM sighting
                WHERE id = %s AND survey_id = %s
                RETURNING id
            """, (sighting_id, survey_id))

            if not cursor.fetchone():
                raise HTTPException(
                    status_code=404,
                    detail=f"Sighting {sighting_id} not found for survey {survey_id}"
                )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete sighting: {str(e)}")
