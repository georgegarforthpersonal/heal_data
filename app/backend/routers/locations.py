"""
Locations Router - API endpoints for location management

Endpoints:
  GET    /api/locations                 - List all locations
  GET    /api/locations/with-boundaries - List all locations with boundary geometry
  POST   /api/locations                 - Create new location
  GET    /api/locations/{id}            - Get specific location
  PUT    /api/locations/{id}            - Update location
  DELETE /api/locations/{id}            - Delete location
"""

from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import text
from database.connection import get_db
from models import Location, LocationRead, LocationCreate, LocationUpdate, LocationWithBoundary, Organisation
from auth import require_admin
from dependencies import get_current_organisation

router = APIRouter()


@router.get("", response_model=List[LocationRead])
async def get_locations(
    org: Organisation = Depends(get_current_organisation),
    db: Session = Depends(get_db)
):
    """
    Get all locations for the current organisation.

    Returns:
        List of locations
    """
    locations = db.query(Location).filter(
        Location.organisation_id == org.id
    ).order_by(Location.name).all()

    return [{"id": loc.id, "name": loc.name} for loc in locations]


@router.get("/by-survey-type/{survey_type_id}", response_model=List[LocationRead])
async def get_locations_by_survey_type(
    survey_type_id: int,
    org: Organisation = Depends(get_current_organisation),
    db: Session = Depends(get_db)
):
    """
    Get locations available for a specific survey type.

    Args:
        survey_type_id: The survey type ID to filter by

    Returns:
        List of locations configured for this survey type
    """
    result = db.execute(text("""
        SELECT l.id, l.name
        FROM location l
        INNER JOIN survey_type_location stl ON stl.location_id = l.id
        WHERE stl.survey_type_id = :survey_type_id
          AND l.organisation_id = :org_id
        ORDER BY l.name
    """).bindparams(survey_type_id=survey_type_id, org_id=org.id)).fetchall()

    return [{"id": row[0], "name": row[1]} for row in result]


@router.get("/with-boundaries", response_model=List[LocationWithBoundary])
async def get_locations_with_boundaries(
    org: Organisation = Depends(get_current_organisation),
    db: Session = Depends(get_db)
):
    """
    Get all locations that have boundary geometry defined.

    Returns locations with their polygon boundaries for map display.
    Only returns locations where boundary_geometry is not null.

    Returns:
        List of locations with boundary geometry and styling
    """
    result = db.execute(text("""
        SELECT
            id,
            name,
            (ST_AsGeoJSON(boundary_geometry)::json->'coordinates'->0) as boundary_geometry,
            boundary_fill_color,
            boundary_stroke_color,
            boundary_fill_opacity
        FROM location
        WHERE boundary_geometry IS NOT NULL
          AND organisation_id = :org_id
        ORDER BY name
    """).bindparams(org_id=org.id)).fetchall()

    return [{
        "id": row[0],
        "name": row[1],
        "boundary_geometry": row[2] if row[2] else None,
        "boundary_fill_color": row[3],
        "boundary_stroke_color": row[4],
        "boundary_fill_opacity": row[5]
    } for row in result]


@router.get("/{location_id}", response_model=LocationRead)
async def get_location(
    location_id: int,
    org: Organisation = Depends(get_current_organisation),
    db: Session = Depends(get_db)
):
    """Get a specific location by ID"""
    location = db.query(Location).filter(
        Location.id == location_id,
        Location.organisation_id == org.id
    ).first()

    if not location:
        raise HTTPException(status_code=404, detail=f"Location {location_id} not found")

    return {"id": location.id, "name": location.name}


@router.post("", response_model=LocationRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
async def create_location(
    location: LocationCreate,
    org: Organisation = Depends(get_current_organisation),
    db: Session = Depends(get_db)
):
    """Create a new location"""
    db_location = Location(
        name=location.name,
        organisation_id=org.id
    )
    db.add(db_location)
    db.commit()
    db.refresh(db_location)

    return {"id": db_location.id, "name": db_location.name}


@router.put("/{location_id}", response_model=LocationRead, dependencies=[Depends(require_admin)])
async def update_location(
    location_id: int,
    location: LocationUpdate,
    org: Organisation = Depends(get_current_organisation),
    db: Session = Depends(get_db)
):
    """Update an existing location"""
    db_location = db.query(Location).filter(
        Location.id == location_id,
        Location.organisation_id == org.id
    ).first()

    if not db_location:
        raise HTTPException(status_code=404, detail=f"Location {location_id} not found")

    if location.name is not None:
        db_location.name = location.name

    db.commit()
    db.refresh(db_location)

    return {"id": db_location.id, "name": db_location.name}


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
async def delete_location(
    location_id: int,
    org: Organisation = Depends(get_current_organisation),
    db: Session = Depends(get_db)
):
    """Delete a location"""
    db_location = db.query(Location).filter(
        Location.id == location_id,
        Location.organisation_id == org.id
    ).first()

    if not db_location:
        raise HTTPException(status_code=404, detail=f"Location {location_id} not found")

    db.delete(db_location)
    db.commit()
    return None
