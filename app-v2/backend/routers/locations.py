"""
Locations Router - API endpoints for location management

Endpoints:
  GET    /api/locations            - List all locations
  POST   /api/locations            - Create new location
  GET    /api/locations/{id}       - Get specific location
  PUT    /api/locations/{id}       - Update location
  DELETE /api/locations/{id}       - Delete location
"""

from fastapi import APIRouter, HTTPException, status
from typing import List, Optional
from database.connection import get_db_cursor
from models import LocationRead, LocationCreate, LocationUpdate

router = APIRouter()


@router.get("", response_model=List[LocationRead])
async def get_locations(survey_type: Optional[str] = None):
    """
    Get all locations, optionally filtered by type.

    Args:
        survey_type: Filter by type (butterfly, bird, fungi). Optional.

    Returns:
        List of locations
    """
    try:
        with get_db_cursor() as cursor:
            if survey_type:
                cursor.execute("""
                    SELECT id, number, name, type
                    FROM location
                    WHERE type = %s
                    ORDER BY number
                """, (survey_type,))
            else:
                cursor.execute("""
                    SELECT id, number, name, type
                    FROM location
                    ORDER BY number
                """)

            rows = cursor.fetchall()

            return [{
                "id": row[0],
                "number": row[1],
                "name": row[2],
                "type": row[3],

            } for row in rows]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch locations: {str(e)}")


@router.get("/{location_id}", response_model=LocationRead)
async def get_location(location_id: int):
    """Get a specific location by ID"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                SELECT id, number, name, type
                FROM location
                WHERE id = %s
            """, (location_id,))

            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail=f"Location {location_id} not found")

            return {
                "id": row[0],
                "number": row[1],
                "name": row[2],
                "type": row[3],

            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch location: {str(e)}")


@router.post("", response_model=LocationRead, status_code=status.HTTP_201_CREATED)
async def create_location(location: LocationCreate):
    """Create a new location"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                INSERT INTO location (number, name, type)
                VALUES (%s, %s, %s)
                RETURNING id, number, name, type
            """, (location.number, location.name, location.type))

            row = cursor.fetchone()

            return {
                "id": row[0],
                "number": row[1],
                "name": row[2],
                "type": row[3],

            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create location: {str(e)}")


@router.put("/{location_id}", response_model=LocationRead)
async def update_location(location_id: int, location: LocationUpdate):
    """Update an existing location"""
    try:
        with get_db_cursor() as cursor:
            # Check if location exists
            cursor.execute("SELECT id FROM location WHERE id = %s", (location_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail=f"Location {location_id} not found")

            # Build dynamic UPDATE query
            update_fields = []
            update_values = []

            if location.number is not None:
                update_fields.append("number = %s")
                update_values.append(location.number)
            if location.name is not None:
                update_fields.append("name = %s")
                update_values.append(location.name)
            if location.type is not None:
                update_fields.append("type = %s")
                update_values.append(location.type)

            if update_fields:
                update_values.append(location_id)
                query = f"""
                    UPDATE location
                    SET {', '.join(update_fields)}
                    WHERE id = %s
                    RETURNING id, number, name, type
                """
                cursor.execute(query, update_values)
                row = cursor.fetchone()
            else:
                # No fields to update, just fetch current state
                cursor.execute("""
                    SELECT id, number, name, type
                    FROM location
                    WHERE id = %s
                """, (location_id,))
                row = cursor.fetchone()

            return {
                "id": row[0],
                "number": row[1],
                "name": row[2],
                "type": row[3],

            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update location: {str(e)}")


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(location_id: int):
    """Delete a location"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("DELETE FROM location WHERE id = %s RETURNING id", (location_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail=f"Location {location_id} not found")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete location: {str(e)}")
