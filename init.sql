-- Initialize the database with tables for app
-- This matches the SQLModel schema in app/backend/models.py

CREATE TABLE IF NOT EXISTS surveyor (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS species (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    conservation_status VARCHAR(50),
    type VARCHAR(50) NOT NULL DEFAULT 'butterfly',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS location (
    id SERIAL PRIMARY KEY,
    number INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'butterfly',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS survey (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    sun_percentage INTEGER CHECK (sun_percentage >= 0 AND sun_percentage <= 100),
    temperature_celsius DECIMAL(5,2),
    conditions_met BOOLEAN,
    notes TEXT,
    type VARCHAR(50) NOT NULL DEFAULT 'butterfly',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS survey_surveyor (
    id SERIAL PRIMARY KEY,
    survey_id INTEGER NOT NULL REFERENCES survey(id) ON DELETE CASCADE,
    surveyor_id INTEGER NOT NULL REFERENCES surveyor(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(survey_id, surveyor_id)
);

CREATE TABLE IF NOT EXISTS sighting (
    id SERIAL PRIMARY KEY,
    survey_id INTEGER NOT NULL REFERENCES survey(id) ON DELETE CASCADE,
    species_id INTEGER NOT NULL REFERENCES species(id) ON DELETE CASCADE,
    location_id INTEGER NOT NULL REFERENCES location(id) ON DELETE CASCADE,
    count INTEGER NOT NULL DEFAULT 1 CHECK (count > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
