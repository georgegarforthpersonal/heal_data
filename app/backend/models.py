"""
SQLModel Database Models

Unified models using SQLModel (SQLAlchemy + Pydantic) for both:
- Database ORM operations
- FastAPI request/response validation

Replaces:
- app/database/models.py (dataclasses)
- schemas/models.py (Pydantic schemas)
"""

from datetime import date as date_type, time as time_type, datetime
from typing import Optional, List, TYPE_CHECKING
from decimal import Decimal
from sqlmodel import Field, SQLModel, Relationship
import sqlalchemy as sa

if TYPE_CHECKING:
    from typing import List


# ============================================================================
# Junction Tables
# ============================================================================

class SurveySurveyor(SQLModel, table=True):
    """Junction table linking surveys to surveyors (many-to-many)"""
    __tablename__ = "survey_surveyor"

    id: Optional[int] = Field(default=None, primary_key=True)
    survey_id: int = Field(foreign_key="survey.id", ondelete="CASCADE")
    surveyor_id: int = Field(foreign_key="surveyor.id", ondelete="CASCADE")
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        sa_column_kwargs={"server_default": sa.text("CURRENT_TIMESTAMP")}
    )


# ============================================================================
# Surveyor Models
# ============================================================================

class SurveyorBase(SQLModel):
    """Base surveyor fields - shared between Create and Read"""
    first_name: str = Field(max_length=255, description="Surveyor's first name")
    last_name: str = Field(max_length=255, description="Surveyor's last name")


class Surveyor(SurveyorBase, table=True):
    """Surveyor database model"""
    __tablename__ = "surveyor"

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        sa_column_kwargs={"server_default": sa.text("CURRENT_TIMESTAMP")}
    )

    # Relationships
    surveys: List["Survey"] = Relationship(back_populates="surveyors", link_model=SurveySurveyor)


class SurveyorCreate(SurveyorBase):
    """Model for creating a new surveyor"""
    pass


class SurveyorUpdate(SQLModel):
    """Model for updating a surveyor (all fields optional)"""
    first_name: Optional[str] = Field(None, max_length=255)
    last_name: Optional[str] = Field(None, max_length=255)


class SurveyorRead(SurveyorBase):
    """Model for reading a surveyor (includes ID)"""
    id: int


# ============================================================================
# Species Models
# ============================================================================

class SpeciesBase(SQLModel):
    """Base species fields"""
    name: str = Field(max_length=255, description="Species name")
    conservation_status: Optional[str] = Field(None, max_length=50, description="Conservation status")
    type: str = Field(default="butterfly", max_length=50, description="Type of species (butterfly, bird, fungi)")


class Species(SpeciesBase, table=True):
    """Species database model"""
    __tablename__ = "species"

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        sa_column_kwargs={"server_default": sa.text("CURRENT_TIMESTAMP")}
    )

    # Relationships
    sightings: List["Sighting"] = Relationship(back_populates="species")


class SpeciesCreate(SpeciesBase):
    """Model for creating a new species"""
    pass


class SpeciesUpdate(SQLModel):
    """Model for updating a species (all fields optional)"""
    name: Optional[str] = Field(None, max_length=255)
    conservation_status: Optional[str] = Field(None, max_length=50)
    type: Optional[str] = Field(None, max_length=50)


class SpeciesRead(SpeciesBase):
    """Model for reading a species (includes ID)"""
    id: int


# ============================================================================
# Location Models
# ============================================================================

class LocationBase(SQLModel):
    """Base location fields"""
    number: int = Field(ge=1, description="Location number")
    name: str = Field(max_length=255, description="Location name")
    type: str = Field(default="butterfly", max_length=50, description="Type (butterfly, bird, fungi)")


class Location(LocationBase, table=True):
    """Location database model"""
    __tablename__ = "location"

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        sa_column_kwargs={"server_default": sa.text("CURRENT_TIMESTAMP")}
    )

    # Relationships
    sightings: List["Sighting"] = Relationship(back_populates="location")


class LocationCreate(LocationBase):
    """Model for creating a new location"""
    pass


class LocationUpdate(SQLModel):
    """Model for updating a location (all fields optional)"""
    number: Optional[int] = Field(None, ge=1)
    name: Optional[str] = Field(None, max_length=255)
    type: Optional[str] = Field(None, max_length=50)


class LocationRead(LocationBase):
    """Model for reading a location (includes ID)"""
    id: int


# ============================================================================
# Survey Models
# ============================================================================

class SurveyBase(SQLModel):
    """Base survey fields"""
    date: date_type = Field(description="Survey date")
    start_time: Optional[time_type] = Field(None, description="Survey start time")
    end_time: Optional[time_type] = Field(None, description="Survey end time")
    sun_percentage: Optional[int] = Field(None, ge=0, le=100, description="Percentage of sun (0-100)")
    temperature_celsius: Optional[Decimal] = Field(None, description="Temperature in Celsius")
    conditions_met: Optional[bool] = Field(None, description="Whether survey conditions were met")
    notes: Optional[str] = Field(None, description="Additional notes")
    type: str = Field(default="butterfly", max_length=50, description="Type of survey")


class Survey(SurveyBase, table=True):
    """Survey database model"""
    __tablename__ = "survey"

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        sa_column_kwargs={"server_default": sa.text("CURRENT_TIMESTAMP")}
    )

    # Relationships
    surveyors: List["Surveyor"] = Relationship(back_populates="surveys", link_model=SurveySurveyor)
    sightings: List["Sighting"] = Relationship(back_populates="survey", cascade_delete=True)


class SurveyCreate(SurveyBase):
    """Model for creating a new survey"""
    surveyor_ids: List[int] = Field(description="List of surveyor IDs")


class SurveyUpdate(SQLModel):
    """Model for updating a survey (all fields optional)"""
    date: Optional[date_type] = None
    start_time: Optional[time_type] = None
    end_time: Optional[time_type] = None
    sun_percentage: Optional[int] = Field(None, ge=0, le=100)
    temperature_celsius: Optional[Decimal] = None
    conditions_met: Optional[bool] = None
    notes: Optional[str] = None
    type: Optional[str] = Field(None, max_length=50)
    surveyor_ids: Optional[List[int]] = None


class SurveyRead(SurveyBase):
    """Model for reading a survey (includes ID and surveyors)"""
    id: int
    surveyor_ids: List[int] = Field(default_factory=list, description="List of surveyor IDs")


class SpeciesTypeCount(SQLModel):
    """Count of sightings by species type"""
    type: str = Field(description="Species type (butterfly, bird, fungi)")
    count: int = Field(description="Number of sightings of this type")


class SurveyWithSightingsCount(SurveyRead):
    """Survey with count of sightings"""
    sightings_count: int = Field(default=0, description="Total number of sightings")
    species_breakdown: List[SpeciesTypeCount] = Field(default_factory=list, description="Breakdown by species type")


# ============================================================================
# Sighting Models
# ============================================================================

class SightingBase(SQLModel):
    """Base sighting fields"""
    species_id: int = Field(gt=0, foreign_key="species.id", description="Species ID")
    location_id: int = Field(gt=0, foreign_key="location.id", description="Location ID")
    count: int = Field(gt=0, description="Number of individuals sighted")


class Sighting(SightingBase, table=True):
    """Sighting database model"""
    __tablename__ = "sighting"

    id: Optional[int] = Field(default=None, primary_key=True)
    survey_id: int = Field(foreign_key="survey.id")
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        sa_column_kwargs={"server_default": sa.text("CURRENT_TIMESTAMP")}
    )

    # Relationships
    survey: "Survey" = Relationship(back_populates="sightings")
    species: "Species" = Relationship(back_populates="sightings")
    location: "Location" = Relationship(back_populates="sightings")


class SightingCreate(SightingBase):
    """Model for creating a new sighting"""
    pass


class SightingUpdate(SQLModel):
    """Model for updating a sighting (all fields optional)"""
    species_id: Optional[int] = Field(None, gt=0)
    location_id: Optional[int] = Field(None, gt=0)
    count: Optional[int] = Field(None, gt=0)


class SightingRead(SightingBase):
    """Model for reading a sighting (includes ID)"""
    id: int
    survey_id: int


class SightingWithDetails(SightingRead):
    """Sighting with species and location details"""
    species_name: Optional[str] = None
    location_name: Optional[str] = None
