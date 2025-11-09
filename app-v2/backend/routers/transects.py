"""
Transects Router - API endpoints for transect management

Endpoints:
  GET    /api/transects            - List all transects
  POST   /api/transects            - Create new transect
  GET    /api/transects/{id}       - Get specific transect
  PUT    /api/transects/{id}       - Update transect
  DELETE /api/transects/{id}       - Delete transect
"""

from fastapi import APIRouter, HTTPException, status
from typing import List, Optional
from database.connection import get_db_cursor
from models import TransectRead, TransectCreate, TransectUpdate

router = APIRouter()


@router.get("", response_model=List[TransectRead])
async def get_transects(survey_type: Optional[str] = None):
    """
    Get all transects, optionally filtered by type.

    Args:
        survey_type: Filter by type (butterfly, bird, fungi). Optional.

    Returns:
        List of transects
    """
    try:
        with get_db_cursor() as cursor:
            if survey_type:
                cursor.execute("""
                    SELECT id, number, name, type
                    FROM transect
                    WHERE type = %s
                    ORDER BY number
                """, (survey_type,))
            else:
                cursor.execute("""
                    SELECT id, number, name, type
                    FROM transect
                    ORDER BY number
                """)

            rows = cursor.fetchall()

            return [{
                "id": row[0],
                "number": row[1],
                "name": row[2],
                "transect_type": row[3],
                
            } for row in rows]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch transects: {str(e)}")


@router.get("/{transect_id}", response_model=TransectRead)
async def get_transect(transect_id: int):
    """Get a specific transect by ID"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                SELECT id, number, name, type
                FROM transect
                WHERE id = %s
            """, (transect_id,))

            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail=f"Transect {transect_id} not found")

            return {
                "id": row[0],
                "number": row[1],
                "name": row[2],
                "transect_type": row[3],
                
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch transect: {str(e)}")


@router.post("", response_model=TransectRead, status_code=status.HTTP_201_CREATED)
async def create_transect(transect: TransectCreate):
    """Create a new transect"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                INSERT INTO transect (number, name, type)
                VALUES (%s, %s, %s)
                RETURNING id, number, name, type
            """, (transect.number, transect.name, transect.transect_type))

            row = cursor.fetchone()

            return {
                "id": row[0],
                "number": row[1],
                "name": row[2],
                "transect_type": row[3],
                
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create transect: {str(e)}")


@router.put("/{transect_id}", response_model=TransectRead)
async def update_transect(transect_id: int, transect: TransectUpdate):
    """Update an existing transect"""
    try:
        with get_db_cursor() as cursor:
            # Check if transect exists
            cursor.execute("SELECT id FROM transect WHERE id = %s", (transect_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail=f"Transect {transect_id} not found")

            # Build dynamic UPDATE query
            update_fields = []
            update_values = []

            if transect.number is not None:
                update_fields.append("number = %s")
                update_values.append(transect.number)
            if transect.name is not None:
                update_fields.append("name = %s")
                update_values.append(transect.name)
            if transect.transect_type is not None:
                update_fields.append("type = %s")
                update_values.append(transect.transect_type)

            if update_fields:
                update_values.append(transect_id)
                query = f"""
                    UPDATE transect
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
                    FROM transect
                    WHERE id = %s
                """, (transect_id,))
                row = cursor.fetchone()

            return {
                "id": row[0],
                "number": row[1],
                "name": row[2],
                "transect_type": row[3],
                
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update transect: {str(e)}")


@router.delete("/{transect_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transect(transect_id: int):
    """Delete a transect"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("DELETE FROM transect WHERE id = %s RETURNING id", (transect_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail=f"Transect {transect_id} not found")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete transect: {str(e)}")
