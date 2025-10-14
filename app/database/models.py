from dataclasses import dataclass
from datetime import date, time, datetime
from typing import Optional, List
from decimal import Decimal

@dataclass
class TimestampedModel:
    """Base class for models with timestamp tracking"""
    created_at: Optional[datetime] = None

@dataclass
class Surveyor(TimestampedModel):
    id: Optional[int] = None
    first_name: str = ""
    last_name: str = ""

@dataclass
class Species(TimestampedModel):
    id: Optional[int] = None
    name: str = ""
    conservation_status: Optional[str] = None
    type: str = "butterfly"

@dataclass
class Transect(TimestampedModel):
    id: Optional[int] = None
    number: int = 0
    name: str = ""
    type: str = "butterfly"

@dataclass
class Survey(TimestampedModel):
    id: Optional[int] = None
    date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    sun_percentage: Optional[int] = None
    temperature_celsius: Optional[Decimal] = None
    conditions_met: bool = False
    surveyor_ids: Optional[List[int]] = None
    notes: Optional[str] = None
    type: str = "butterfly"

@dataclass
class Sighting(TimestampedModel):
    id: Optional[int] = None
    survey_id: Optional[int] = None
    species_id: Optional[int] = None
    transect_id: Optional[int] = None
    count: int = 1

class DatabaseTables:
    CREATE_SURVEYOR_TABLE = """
    CREATE TABLE IF NOT EXISTS surveyor (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """
    
    CREATE_SPECIES_TABLE = """
    CREATE TABLE IF NOT EXISTS species (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        conservation_status VARCHAR(50),
        type VARCHAR(50) NOT NULL DEFAULT 'butterfly',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, type)
    );
    """
    
    CREATE_TRANSECT_TABLE = """
    CREATE TABLE IF NOT EXISTS transect (
        id SERIAL PRIMARY KEY,
        number INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'butterfly',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """
    
    CREATE_SURVEY_TABLE = """
    CREATE TABLE IF NOT EXISTS survey (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        start_time TIME,
        end_time TIME,
        sun_percentage INTEGER CHECK (sun_percentage >= 0 AND sun_percentage <= 100),
        temperature_celsius DECIMAL(5,2),
        conditions_met BOOLEAN NOT NULL DEFAULT FALSE,
        notes TEXT,
        type VARCHAR(50) NOT NULL DEFAULT 'butterfly',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """
    
    CREATE_SURVEY_SURVEYOR_TABLE = """
    CREATE TABLE IF NOT EXISTS survey_surveyor (
        id SERIAL PRIMARY KEY,
        survey_id INTEGER REFERENCES survey(id) ON DELETE CASCADE,
        surveyor_id INTEGER REFERENCES surveyor(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(survey_id, surveyor_id)
    );
    """
    
    CREATE_SIGHTING_TABLE = """
    CREATE TABLE IF NOT EXISTS sighting (
        id SERIAL PRIMARY KEY,
        survey_id INTEGER REFERENCES survey(id) ON DELETE CASCADE,
        species_id INTEGER REFERENCES species(id) ON DELETE CASCADE,
        transect_id INTEGER REFERENCES transect(id) ON DELETE CASCADE,
        count INTEGER NOT NULL DEFAULT 1 CHECK (count > 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """