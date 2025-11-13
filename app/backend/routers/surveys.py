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

Refactored to use SQLModel ORM instead of raw SQL.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import func, select
from database.connection import get_db
from models import (
    Survey, SurveyRead, SurveyCreate, SurveyUpdate, SurveyWithSightingsCount,
    Sighting, SightingRead, SightingCreate, SightingUpdate, SightingWithDetails,
    Species, Location, Surveyor, SurveySurveyor, SpeciesTypeCount
)

router = APIRouter()

# ============================================================================
# Survey CRUD Operations
# ============================================================================

@router.get("", response_model=List[SurveyWithSightingsCount])
async def get_surveys(db: Session = Depends(get_db)):
    """
    Get all surveys with sighting counts.

    Returns:
        List of all surveys with sighting counts and species breakdown
    """
    try:
        # Get all surveys with basic info
        surveys_query = db.query(Survey).order_by(Survey.date.desc()).all()

        result = []
        for survey in surveys_query:
            # Get surveyor IDs for this survey
            surveyor_ids = db.query(SurveySurveyor.surveyor_id)\
                .filter(SurveySurveyor.survey_id == survey.id)\
                .order_by(SurveySurveyor.surveyor_id)\
                .all()
            surveyor_ids_list = [sid[0] for sid in surveyor_ids]

            # Get sightings count
            sightings_count = db.query(func.count(Sighting.id))\
                .filter(Sighting.survey_id == survey.id)\
                .scalar()

            # Get species breakdown (count by species type)
            species_breakdown_query = db.query(
                Species.type.label('type'),
                func.count(Sighting.id).label('count')
            ).join(Sighting, Species.id == Sighting.species_id)\
             .filter(Sighting.survey_id == survey.id)\
             .group_by(Species.type)\
             .all()

            species_breakdown = [
                {"type": row.type, "count": row.count}
                for row in species_breakdown_query
            ]

            result.append({
                "id": survey.id,
                "date": survey.date,
                "start_time": survey.start_time,
                "end_time": survey.end_time,
                "sun_percentage": survey.sun_percentage,
                "temperature_celsius": survey.temperature_celsius,
                "conditions_met": survey.conditions_met,
                "notes": survey.notes,
                "type": survey.type,
                "location_id": survey.location_id,
                "surveyor_ids": surveyor_ids_list,
                "sightings_count": sightings_count or 0,
                "species_breakdown": species_breakdown
            })

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch surveys: {str(e)}")


@router.get("/{survey_id}", response_model=SurveyRead)
async def get_survey(survey_id: int, db: Session = Depends(get_db)):
    """
    Get a specific survey by ID.

    Args:
        survey_id: Survey ID

    Returns:
        Survey details

    Raises:
        404: Survey not found
    """
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail=f"Survey {survey_id} not found")

    # Get surveyor IDs
    surveyor_ids = db.query(SurveySurveyor.surveyor_id)\
        .filter(SurveySurveyor.survey_id == survey_id)\
        .order_by(SurveySurveyor.surveyor_id)\
        .all()
    surveyor_ids_list = [sid[0] for sid in surveyor_ids]

    return {
        "id": survey.id,
        "date": survey.date,
        "start_time": survey.start_time,
        "end_time": survey.end_time,
        "sun_percentage": survey.sun_percentage,
        "temperature_celsius": survey.temperature_celsius,
        "conditions_met": survey.conditions_met,
        "notes": survey.notes,
        "type": survey.type,
        "location_id": survey.location_id,
        "surveyor_ids": surveyor_ids_list
    }


@router.post("", response_model=SurveyRead, status_code=status.HTTP_201_CREATED)
async def create_survey(survey: SurveyCreate, db: Session = Depends(get_db)):
    """
    Create a new survey.

    Args:
        survey: Survey data

    Returns:
        Created survey with ID
    """
    try:
        # Create survey (without surveyor_ids which isn't a field on the model)
        db_survey = Survey(
            date=survey.date,
            start_time=survey.start_time,
            end_time=survey.end_time,
            sun_percentage=survey.sun_percentage,
            temperature_celsius=survey.temperature_celsius,
            conditions_met=survey.conditions_met,
            notes=survey.notes,
            type=survey.type,
            location_id=survey.location_id
        )
        db.add(db_survey)
        db.flush()  # Get the ID without committing

        # Insert surveyor associations
        for surveyor_id in survey.surveyor_ids:
            db_association = SurveySurveyor(
                survey_id=db_survey.id,
                surveyor_id=surveyor_id
            )
            db.add(db_association)

        db.commit()
        db.refresh(db_survey)

        return {
            "id": db_survey.id,
            "date": db_survey.date,
            "start_time": db_survey.start_time,
            "end_time": db_survey.end_time,
            "sun_percentage": db_survey.sun_percentage,
            "temperature_celsius": db_survey.temperature_celsius,
            "conditions_met": db_survey.conditions_met,
            "notes": db_survey.notes,
            "survey_type": db_survey.type,
            "location_id": db_survey.location_id,
            "surveyor_ids": survey.surveyor_ids
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create survey: {str(e)}")


@router.put("/{survey_id}", response_model=SurveyRead)
async def update_survey(survey_id: int, survey: SurveyUpdate, db: Session = Depends(get_db)):
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
    db_survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not db_survey:
        raise HTTPException(status_code=404, detail=f"Survey {survey_id} not found")

    # Update only the fields that were provided
    update_data = survey.model_dump(exclude_unset=True, exclude={'surveyor_ids'})

    # Handle the survey_type field mapping
    if 'type' in update_data:
        update_data['type'] = update_data.pop('type')
    if 'survey_type' in update_data:
        update_data['type'] = update_data.pop('survey_type')

    for field, value in update_data.items():
        setattr(db_survey, field, value)

    # Update surveyor associations if provided
    if survey.surveyor_ids is not None:
        # Delete existing associations
        db.query(SurveySurveyor)\
            .filter(SurveySurveyor.survey_id == survey_id)\
            .delete()

        # Insert new associations
        for surveyor_id in survey.surveyor_ids:
            db_association = SurveySurveyor(
                survey_id=survey_id,
                surveyor_id=surveyor_id
            )
            db.add(db_association)

    db.commit()
    db.refresh(db_survey)

    # Get current surveyor IDs
    surveyor_ids = db.query(SurveySurveyor.surveyor_id)\
        .filter(SurveySurveyor.survey_id == survey_id)\
        .order_by(SurveySurveyor.surveyor_id)\
        .all()
    surveyor_ids_list = [sid[0] for sid in surveyor_ids]

    return {
        "id": db_survey.id,
        "date": db_survey.date,
        "start_time": db_survey.start_time,
        "end_time": db_survey.end_time,
        "sun_percentage": db_survey.sun_percentage,
        "temperature_celsius": db_survey.temperature_celsius,
        "conditions_met": db_survey.conditions_met,
        "notes": db_survey.notes,
        "survey_type": db_survey.type,
        "surveyor_ids": surveyor_ids_list
    }


@router.delete("/{survey_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_survey(survey_id: int, db: Session = Depends(get_db)):
    """
    Delete a survey (CASCADE deletes sightings and surveyor associations).

    Args:
        survey_id: Survey ID

    Raises:
        404: Survey not found
    """
    db_survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not db_survey:
        raise HTTPException(status_code=404, detail=f"Survey {survey_id} not found")

    db.delete(db_survey)
    db.commit()
    return None


# ============================================================================
# Sightings Operations (Nested under surveys)
# ============================================================================

@router.get("/{survey_id}/sightings", response_model=List[SightingWithDetails])
async def get_survey_sightings(survey_id: int, db: Session = Depends(get_db)):
    """
    Get all sightings for a survey.

    Args:
        survey_id: Survey ID

    Returns:
        List of sightings with species and location details

    Raises:
        404: Survey not found
    """
    # Check if survey exists
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail=f"Survey {survey_id} not found")

    # Get sightings with species names (location comes from survey)
    sightings = db.query(
        Sighting.id,
        Sighting.survey_id,
        Sighting.species_id,
        Sighting.count,
        Species.name.label('species_name')
    ).join(Species, Sighting.species_id == Species.id)\
     .filter(Sighting.survey_id == survey_id)\
     .order_by(Species.name)\
     .all()

    return [{
        "id": row.id,
        "survey_id": row.survey_id,
        "species_id": row.species_id,
        "count": row.count,
        "species_name": row.species_name
    } for row in sightings]


@router.post("/{survey_id}/sightings", response_model=SightingWithDetails, status_code=status.HTTP_201_CREATED)
async def create_sighting(survey_id: int, sighting: SightingCreate, db: Session = Depends(get_db)):
    """
    Add a sighting to a survey.

    Args:
        survey_id: Survey ID
        sighting: Sighting data

    Returns:
        Created sighting

    Raises:
        404: Survey, species, or location not found
    """
    # Check if survey exists
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail=f"Survey {survey_id} not found")

    # Create sighting
    db_sighting = Sighting(
        survey_id=survey_id,
        species_id=sighting.species_id,
        count=sighting.count
    )
    db.add(db_sighting)
    db.commit()
    db.refresh(db_sighting)

    # Get species name
    species = db.query(Species).filter(Species.id == sighting.species_id).first()

    return {
        "id": db_sighting.id,
        "survey_id": db_sighting.survey_id,
        "species_id": db_sighting.species_id,
        "count": db_sighting.count,
        "species_name": species.name if species else None
    }


@router.put("/{survey_id}/sightings/{sighting_id}", response_model=SightingWithDetails)
async def update_sighting(survey_id: int, sighting_id: int, sighting: SightingUpdate, db: Session = Depends(get_db)):
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
    # Check if sighting exists and belongs to this survey
    db_sighting = db.query(Sighting)\
        .filter(Sighting.id == sighting_id, Sighting.survey_id == survey_id)\
        .first()

    if not db_sighting:
        raise HTTPException(
            status_code=404,
            detail=f"Sighting {sighting_id} not found for survey {survey_id}"
        )

    # Update only the fields that were provided
    update_data = sighting.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_sighting, field, value)

    db.commit()
    db.refresh(db_sighting)

    # Get species name
    species = db.query(Species).filter(Species.id == db_sighting.species_id).first()

    return {
        "id": db_sighting.id,
        "survey_id": db_sighting.survey_id,
        "species_id": db_sighting.species_id,
        "count": db_sighting.count,
        "species_name": species.name if species else None
    }


@router.delete("/{survey_id}/sightings/{sighting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sighting(survey_id: int, sighting_id: int, db: Session = Depends(get_db)):
    """
    Delete a sighting.

    Args:
        survey_id: Survey ID
        sighting_id: Sighting ID

    Raises:
        404: Survey or sighting not found
    """
    db_sighting = db.query(Sighting)\
        .filter(Sighting.id == sighting_id, Sighting.survey_id == survey_id)\
        .first()

    if not db_sighting:
        raise HTTPException(
            status_code=404,
            detail=f"Sighting {sighting_id} not found for survey {survey_id}"
        )

    db.delete(db_sighting)
    db.commit()
    return None
