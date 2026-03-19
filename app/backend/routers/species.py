"""
Species Router - API endpoints for species management

Endpoints:
  GET    /api/species                            - List all species
  GET    /api/species/by-survey-type/{id}        - Get species for survey type
  POST   /api/species                            - Create new species
  GET    /api/species/{id}                       - Get specific species
  PUT    /api/species/{id}                       - Update species
  DELETE /api/species/{id}                       - Delete species

Refactored to use SQLModel ORM instead of raw SQL.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from database.connection import get_db
from models import (
    Species,
    SpeciesRead,
    SpeciesCreate,
    SpeciesUpdate,
    SpeciesType,
    SurveyTypeSpeciesTypeLink,
)
from auth import require_admin

router = APIRouter()


@router.get("", response_model=List[SpeciesRead])
async def get_species(
    survey_type: Optional[str] = None,
    db: Session = Depends(get_db)
) -> List[Species]:
    """
    Get all species, optionally filtered by type.

    Args:
        survey_type: Filter by type (butterfly, bird, fungi). Optional.

    Returns:
        List of species
    """
    query = db.query(Species)

    if survey_type:
        query = query.filter(Species.type == survey_type)

    # Order by name, falling back to scientific_name
    species = query.order_by(
        func.coalesce(Species.name, Species.scientific_name)
    ).all()

    return species  # type: ignore[no-any-return]


@router.get("/by-survey-type/{survey_type_id}", response_model=List[SpeciesRead])
async def get_species_by_survey_type(
    survey_type_id: int,
    db: Session = Depends(get_db)
) -> List[Species]:
    """
    Get species available for a specific survey type.

    Filters species based on the species types configured for the survey type.

    Args:
        survey_type_id: The survey type ID to filter by

    Returns:
        List of species whose type matches one of the survey type's allowed species types
    """
    # Join species -> species_type -> survey_type_species_type
    species = db.query(Species).join(
        SpeciesType, SpeciesType.name == Species.type
    ).join(
        SurveyTypeSpeciesTypeLink,
        SurveyTypeSpeciesTypeLink.species_type_id == SpeciesType.id
    ).filter(
        SurveyTypeSpeciesTypeLink.survey_type_id == survey_type_id
    ).order_by(
        func.coalesce(Species.name, Species.scientific_name)
    ).all()

    return species  # type: ignore[no-any-return]


@router.get("/{species_id}", response_model=SpeciesRead)
async def get_species_by_id(
    species_id: int,
    db: Session = Depends(get_db)
) -> Species:
    """Get a specific species by ID"""
    species = db.query(Species).filter(Species.id == species_id).first()
    if not species:
        raise HTTPException(status_code=404, detail=f"Species {species_id} not found")
    return species  # type: ignore[no-any-return]


@router.post("", response_model=SpeciesRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
async def create_species(
    species: SpeciesCreate,
    db: Session = Depends(get_db)
) -> Species:
    """Create a new species"""
    db_species = Species(
        name=species.name,
        conservation_status=species.conservation_status,
        type=species.type,
        scientific_name=species.scientific_name,
        species_code=species.species_code,
    )
    db.add(db_species)
    db.commit()
    db.refresh(db_species)
    return db_species


@router.put("/{species_id}", response_model=SpeciesRead, dependencies=[Depends(require_admin)])
async def update_species(
    species_id: int,
    species: SpeciesUpdate,
    db: Session = Depends(get_db)
) -> Species:
    """Update an existing species"""
    db_species = db.query(Species).filter(Species.id == species_id).first()
    if not db_species:
        raise HTTPException(status_code=404, detail=f"Species {species_id} not found")

    # Update only the fields that were provided
    update_data = species.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_species, field, value)

    db.commit()
    db.refresh(db_species)
    return db_species  # type: ignore[no-any-return]


@router.delete("/{species_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
async def delete_species(
    species_id: int,
    db: Session = Depends(get_db)
) -> None:
    """Delete a species"""
    db_species = db.query(Species).filter(Species.id == species_id).first()
    if not db_species:
        raise HTTPException(status_code=404, detail=f"Species {species_id} not found")

    db.delete(db_species)
    db.commit()
    return None
