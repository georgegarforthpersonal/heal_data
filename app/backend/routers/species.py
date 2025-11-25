"""
Species Router - API endpoints for species management

Endpoints:
  GET    /api/species              - List all species
  POST   /api/species              - Create new species
  GET    /api/species/{id}         - Get specific species
  PUT    /api/species/{id}         - Update species
  DELETE /api/species/{id}         - Delete species
"""

from fastapi import APIRouter, HTTPException, status
from typing import List, Optional
from database.connection import get_db_cursor
from models import SpeciesRead, SpeciesCreate, SpeciesUpdate

router = APIRouter()


@router.get("", response_model=List[SpeciesRead])
async def get_species(survey_type: Optional[str] = None):
    """
    Get all species, optionally filtered by type.

    Args:
        survey_type: Filter by type (butterfly, bird, fungi). Optional.

    Returns:
        List of species
    """
    try:
        with get_db_cursor() as cursor:
            if survey_type:
                cursor.execute("""
                    SELECT id, name, conservation_status, type
                    FROM species
                    WHERE type = %s
                    ORDER BY name
                """, (survey_type,))
            else:
                cursor.execute("""
                    SELECT id, name, conservation_status, type
                    FROM species
                    ORDER BY name
                """)

            rows = cursor.fetchall()

            return [{
                "id": row[0],
                "name": row[1],
                "conservation_status": row[2],
                "type": row[3],

            } for row in rows]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch species: {str(e)}")


@router.get("/{species_id}", response_model=SpeciesRead)
async def get_species_by_id(species_id: int):
    """Get a specific species by ID"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                SELECT id, name, conservation_status, type
                FROM species
                WHERE id = %s
            """, (species_id,))

            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail=f"Species {species_id} not found")

            return {
                "id": row[0],
                "name": row[1],
                "conservation_status": row[2],
                "type": row[3],

            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch species: {str(e)}")


@router.post("", response_model=SpeciesRead, status_code=status.HTTP_201_CREATED)
async def create_species(species: SpeciesCreate):
    """Create a new species"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                INSERT INTO species (name, conservation_status, type)
                VALUES (%s, %s, %s)
                RETURNING id, name, conservation_status, type
            """, (species.name, species.conservation_status, species.type))

            row = cursor.fetchone()

            return {
                "id": row[0],
                "name": row[1],
                "conservation_status": row[2],
                "type": row[3],

            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create species: {str(e)}")


@router.put("/{species_id}", response_model=SpeciesRead)
async def update_species(species_id: int, species: SpeciesUpdate):
    """Update an existing species"""
    try:
        with get_db_cursor() as cursor:
            # Check if species exists
            cursor.execute("SELECT id FROM species WHERE id = %s", (species_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail=f"Species {species_id} not found")

            # Build dynamic UPDATE query
            update_fields = []
            update_values = []

            if species.name is not None:
                update_fields.append("name = %s")
                update_values.append(species.name)
            if species.conservation_status is not None:
                update_fields.append("conservation_status = %s")
                update_values.append(species.conservation_status)
            if species.type is not None:
                update_fields.append("type = %s")
                update_values.append(species.type)

            if update_fields:
                update_values.append(species_id)
                query = f"""
                    UPDATE species
                    SET {', '.join(update_fields)}
                    WHERE id = %s
                    RETURNING id, name, conservation_status, type
                """
                cursor.execute(query, update_values)
                row = cursor.fetchone()
            else:
                # No fields to update, just fetch current state
                cursor.execute("""
                    SELECT id, name, conservation_status, type
                    FROM species
                    WHERE id = %s
                """, (species_id,))
                row = cursor.fetchone()

            return {
                "id": row[0],
                "name": row[1],
                "conservation_status": row[2],
                "type": row[3],

            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update species: {str(e)}")


@router.delete("/{species_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_species(species_id: int):
    """Delete a species"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("DELETE FROM species WHERE id = %s RETURNING id", (species_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail=f"Species {species_id} not found")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete species: {str(e)}")
