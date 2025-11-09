"""
Surveyors Router - API endpoints for surveyor management

Endpoints:
  GET    /api/surveyors            - List all surveyors
  POST   /api/surveyors            - Create new surveyor
  GET    /api/surveyors/{id}       - Get specific surveyor
  PUT    /api/surveyors/{id}       - Update surveyor
  DELETE /api/surveyors/{id}       - Delete surveyor
"""

from fastapi import APIRouter, HTTPException, status
from typing import List
from database.connection import get_db_cursor
from models import SurveyorRead, SurveyorCreate, SurveyorUpdate

router = APIRouter()


@router.get("", response_model=List[SurveyorRead])
async def get_surveyors():
    """
    Get all surveyors.

    Returns:
        List of surveyors
    """
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                SELECT id, first_name, last_name
                FROM surveyor
                ORDER BY last_name, first_name
            """)

            rows = cursor.fetchall()

            return [{
                "id": row[0],
                "first_name": row[1],
                "last_name": row[2]
            } for row in rows]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch surveyors: {str(e)}")


@router.get("/{surveyor_id}", response_model=SurveyorRead)
async def get_surveyor(surveyor_id: int):
    """Get a specific surveyor by ID"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                SELECT id, first_name, last_name
                FROM surveyor
                WHERE id = %s
            """, (surveyor_id,))

            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail=f"Surveyor {surveyor_id} not found")

            return {
                "id": row[0],
                "first_name": row[1],
                "last_name": row[2]
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch surveyor: {str(e)}")


@router.post("", response_model=SurveyorRead, status_code=status.HTTP_201_CREATED)
async def create_surveyor(surveyor: SurveyorCreate):
    """Create a new surveyor"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                INSERT INTO surveyor (first_name, last_name)
                VALUES (%s, %s)
                RETURNING id, first_name, last_name
            """, (surveyor.first_name, surveyor.last_name))

            row = cursor.fetchone()

            return {
                "id": row[0],
                "first_name": row[1],
                "last_name": row[2]
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create surveyor: {str(e)}")


@router.put("/{surveyor_id}", response_model=SurveyorRead)
async def update_surveyor(surveyor_id: int, surveyor: SurveyorUpdate):
    """Update an existing surveyor"""
    try:
        with get_db_cursor() as cursor:
            # Check if surveyor exists
            cursor.execute("SELECT id FROM surveyor WHERE id = %s", (surveyor_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail=f"Surveyor {surveyor_id} not found")

            # Build dynamic UPDATE query
            update_fields = []
            update_values = []

            if surveyor.first_name is not None:
                update_fields.append("first_name = %s")
                update_values.append(surveyor.first_name)
            if surveyor.last_name is not None:
                update_fields.append("last_name = %s")
                update_values.append(surveyor.last_name)

            if update_fields:
                update_values.append(surveyor_id)
                query = f"""
                    UPDATE surveyor
                    SET {', '.join(update_fields)}
                    WHERE id = %s
                    RETURNING id, first_name, last_name
                """
                cursor.execute(query, update_values)
                row = cursor.fetchone()
            else:
                # No fields to update, just fetch current state
                cursor.execute("""
                    SELECT id, first_name, last_name
                    FROM surveyor
                    WHERE id = %s
                """, (surveyor_id,))
                row = cursor.fetchone()

            return {
                "id": row[0],
                "first_name": row[1],
                "last_name": row[2]
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update surveyor: {str(e)}")


@router.delete("/{surveyor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_surveyor(surveyor_id: int):
    """Delete a surveyor"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("DELETE FROM surveyor WHERE id = %s RETURNING id", (surveyor_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail=f"Surveyor {surveyor_id} not found")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete surveyor: {str(e)}")
