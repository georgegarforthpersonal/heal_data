-- Initialize the database with tables

CREATE TABLE IF NOT EXISTS surveyor (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS species (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS transect (
    id SERIAL PRIMARY KEY,
    number INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS survey (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    sun_percentage INTEGER CHECK (sun_percentage >= 0 AND sun_percentage <= 100),
    temperature_celsius DECIMAL(5,2),
    conditions_met BOOLEAN NOT NULL DEFAULT FALSE,
    surveyor_id INTEGER REFERENCES surveyor(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sighting (
    id SERIAL PRIMARY KEY,
    survey_id INTEGER REFERENCES survey(id) ON DELETE CASCADE,
    species_id INTEGER REFERENCES species(id) ON DELETE CASCADE,
    transect_id INTEGER REFERENCES transect(id) ON DELETE CASCADE,
    count INTEGER NOT NULL DEFAULT 1 CHECK (count > 0)
);

-- Insert sample data
INSERT INTO surveyor (first_name, last_name) VALUES 
    ('John', 'Doe'),
    ('Jane', 'Smith')
ON CONFLICT DO NOTHING;

INSERT INTO species (name) VALUES 
    ('Monarch Butterfly'),
    ('Painted Lady'),
    ('Red Admiral'),
    ('Cabbage White')
ON CONFLICT (name) DO NOTHING;

INSERT INTO transect (number, name) VALUES 
    (1, 'Meadow Path'),
    (2, 'Forest Edge'),
    (3, 'Garden Border')
ON CONFLICT DO NOTHING;