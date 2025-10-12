# Heal Butterflies 🦋

Butterfly and bird survey tracking application using Neon PostgreSQL.

## Getting Started

**Start the app:**
```bash
docker compose up
```

**Access the app:**
Open http://localhost:8501

**Populate data:**
```bash
./run-script populate_butterflies.py  # Import butterfly data
./run-script populate_birds.py        # Import bird data
```

## Database

This application uses **Neon** (serverless PostgreSQL) for the database.

**Connection details are in `.env`:**
- Database: Neon PostgreSQL (eu-west-2)
- SSL: Required
- Connection pooling: Enabled

**To reset/clear all data:**
Connect to Neon console and run:
```sql
TRUNCATE sighting, survey_surveyor, survey, species, transect, surveyor CASCADE;
```

## App Management

**Stop the app:**
```bash
docker compose down
```

**Rebuild the app:**
```bash
docker compose up --build
```

## Running Scripts
```bash
./run-script script.py
```