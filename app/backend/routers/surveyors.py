"""
Surveyors Router - API endpoints for surveyor management

Endpoints:
  GET    /api/surveyors            - List all surveyors
  POST   /api/surveyors            - Create new surveyor
  GET    /api/surveyors/{id}       - Get specific surveyor
  PUT    /api/surveyors/{id}       - Update surveyor
  DELETE /api/surveyors/{id}       - Delete surveyor

Refactored to use SQLModel ORM instead of raw SQL.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from sqlalchemy.orm import Session
from database.connection import get_db
from models import Surveyor, SurveyorRead, SurveyorCreate, SurveyorUpdate

router = APIRouter()


@router.get("", response_model=List[SurveyorRead])
async def get_surveyors(include_inactive: bool = False, db: Session = Depends(get_db)):
    """
    Get all surveyors.

    Args:
        include_inactive: If True, include inactive surveyors. Default: False (only active)

    Returns:
        List of surveyors ordered by last name, first name
    """
    query = db.query(Surveyor)

    if not include_inactive:
        query = query.filter(Surveyor.is_active == True)

    surveyors = query.order_by(Surveyor.last_name, Surveyor.first_name).all()
    return surveyors


@router.get("/{surveyor_id}", response_model=SurveyorRead)
async def get_surveyor(surveyor_id: int, db: Session = Depends(get_db)):
    """Get a specific surveyor by ID"""
    surveyor = db.query(Surveyor).filter(Surveyor.id == surveyor_id).first()
    if not surveyor:
        raise HTTPException(status_code=404, detail=f"Surveyor {surveyor_id} not found")
    return surveyor


@router.post("", response_model=SurveyorRead, status_code=status.HTTP_201_CREATED)
async def create_surveyor(surveyor: SurveyorCreate, db: Session = Depends(get_db)):
    """Create a new surveyor"""
    db_surveyor = Surveyor.model_validate(surveyor)
    db.add(db_surveyor)
    db.commit()
    db.refresh(db_surveyor)
    return db_surveyor


@router.put("/{surveyor_id}", response_model=SurveyorRead)
async def update_surveyor(surveyor_id: int, surveyor: SurveyorUpdate, db: Session = Depends(get_db)):
    """Update an existing surveyor"""
    db_surveyor = db.query(Surveyor).filter(Surveyor.id == surveyor_id).first()
    if not db_surveyor:
        raise HTTPException(status_code=404, detail=f"Surveyor {surveyor_id} not found")

    # Update only the fields that were provided
    update_data = surveyor.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_surveyor, field, value)

    db.commit()
    db.refresh(db_surveyor)
    return db_surveyor


@router.delete("/{surveyor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_surveyor(surveyor_id: int, db: Session = Depends(get_db)):
    """Delete a surveyor (hard delete - use deactivate instead for soft delete)"""
    db_surveyor = db.query(Surveyor).filter(Surveyor.id == surveyor_id).first()
    if not db_surveyor:
        raise HTTPException(status_code=404, detail=f"Surveyor {surveyor_id} not found")

    db.delete(db_surveyor)
    db.commit()
    return None


@router.post("/{surveyor_id}/deactivate", response_model=SurveyorRead)
async def deactivate_surveyor(surveyor_id: int, db: Session = Depends(get_db)):
    """
    Deactivate a surveyor (soft delete).

    The surveyor will no longer appear in active surveyor lists,
    but their historical survey data is preserved.
    """
    db_surveyor = db.query(Surveyor).filter(Surveyor.id == surveyor_id).first()
    if not db_surveyor:
        raise HTTPException(status_code=404, detail=f"Surveyor {surveyor_id} not found")

    if not db_surveyor.is_active:
        raise HTTPException(status_code=400, detail=f"Surveyor {surveyor_id} is already inactive")

    db_surveyor.is_active = False
    db.commit()
    db.refresh(db_surveyor)
    return db_surveyor


@router.post("/{surveyor_id}/reactivate", response_model=SurveyorRead)
async def reactivate_surveyor(surveyor_id: int, db: Session = Depends(get_db)):
    """
    Reactivate a previously deactivated surveyor.

    The surveyor will appear in active surveyor lists again.
    """
    db_surveyor = db.query(Surveyor).filter(Surveyor.id == surveyor_id).first()
    if not db_surveyor:
        raise HTTPException(status_code=404, detail=f"Surveyor {surveyor_id} not found")

    if db_surveyor.is_active:
        raise HTTPException(status_code=400, detail=f"Surveyor {surveyor_id} is already active")

    db_surveyor.is_active = True
    db.commit()
    db.refresh(db_surveyor)
    return db_surveyor
