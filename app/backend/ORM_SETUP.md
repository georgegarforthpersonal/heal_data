# SQLAlchemy + Alembic Setup Guide

This document explains the SQLAlchemy ORM and Alembic migration setup for the backend API.

## Overview

The backend now supports **two approaches** for database access:

1. **SQLAlchemy ORM** (Recommended for new code) - Type-safe, maintainable
2. **Raw SQL with psycopg2** (Legacy) - For existing complex queries

## What Was Set Up

### 1. SQLModel Models (`models.py`)
- All database tables have SQLModel ORM models
- Models include relationships (e.g., `Survey.sightings`, `Survey.surveyors`)
- Junction table `SurveySurveyor` for many-to-many relationships

### 2. Alembic Migrations
- **Initialized**: Alembic configuration in `alembic/` directory
- **Baseline migration**: Current schema marked as baseline
- **Future migrations**: Use `alembic revision --autogenerate -m "description"`

### 3. Database Connection (`database/connection.py`)
- **Legacy**: `get_db_cursor()` - Returns psycopg2 cursor (for existing code)
- **New ORM**: `get_db()` - Returns SQLAlchemy Session (for new code)

### 4. Example Refactoring
- `routers/surveyors.py` - Fully refactored to use ORM
- Compare with `routers/surveys.py` (still using raw SQL)

## Using the ORM

### Basic CRUD Operations

**Import the models and dependencies:**
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.connection import get_db
from models import Surveyor, SurveyorRead, SurveyorCreate
```

**GET all (List):**
```python
@router.get("", response_model=List[SurveyorRead])
async def get_surveyors(db: Session = Depends(get_db)):
    return db.query(Surveyor).order_by(Surveyor.last_name).all()
```

**GET by ID:**
```python
@router.get("/{id}", response_model=SurveyorRead)
async def get_surveyor(id: int, db: Session = Depends(get_db)):
    surveyor = db.query(Surveyor).filter(Surveyor.id == id).first()
    if not surveyor:
        raise HTTPException(status_code=404, detail=f"Surveyor {id} not found")
    return surveyor
```

**POST (Create):**
```python
@router.post("", response_model=SurveyorRead, status_code=201)
async def create_surveyor(surveyor: SurveyorCreate, db: Session = Depends(get_db)):
    db_surveyor = Surveyor.model_validate(surveyor)
    db.add(db_surveyor)
    db.commit()
    db.refresh(db_surveyor)
    return db_surveyor
```

**PUT (Update):**
```python
@router.put("/{id}", response_model=SurveyorRead)
async def update_surveyor(id: int, surveyor: SurveyorUpdate, db: Session = Depends(get_db)):
    db_surveyor = db.query(Surveyor).filter(Surveyor.id == id).first()
    if not db_surveyor:
        raise HTTPException(status_code=404, detail=f"Surveyor {id} not found")

    # Update only provided fields
    update_data = surveyor.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_surveyor, field, value)

    db.commit()
    db.refresh(db_surveyor)
    return db_surveyor
```

**DELETE:**
```python
@router.delete("/{id}", status_code=204)
async def delete_surveyor(id: int, db: Session = Depends(get_db)):
    db_surveyor = db.query(Surveyor).filter(Surveyor.id == id).first()
    if not db_surveyor:
        raise HTTPException(status_code=404, detail=f"Surveyor {id} not found")

    db.delete(db_surveyor)
    db.commit()
    return None
```

### Working with Relationships

**Eager loading (avoid N+1 queries):**
```python
from sqlalchemy.orm import joinedload

# Load survey with all its sightings
survey = db.query(Survey).options(
    joinedload(Survey.sightings),
    joinedload(Survey.surveyors)
).filter(Survey.id == survey_id).first()

# Access relationships
for sighting in survey.sightings:
    print(sighting.species.name)
```

**Filtering with joins:**
```python
# Get surveys by a specific surveyor
surveys = db.query(Survey).join(
    Survey.surveyors
).filter(Surveyor.id == surveyor_id).all()
```

**Many-to-many through junction table:**
```python
# Add surveyor to survey
survey.surveyors.append(surveyor)
db.commit()

# Remove surveyor from survey
survey.surveyors.remove(surveyor)
db.commit()
```

## Database Migrations with Alembic

### Creating a New Migration

**1. Make changes to your models** (e.g., add a column to `models.py`)

**2. Generate migration:**
```bash
# Inside the container
docker exec -w /app heal_butterflies_api alembic revision --autogenerate -m "Add email to surveyor"
```

**3. Review the generated migration:**
```bash
# Check the file in alembic/versions/
cat app-v2/backend/alembic/versions/xxxx_add_email_to_surveyor.py
```

**4. Apply the migration:**
```bash
docker exec -w /app heal_butterflies_api alembic upgrade head
```

### Common Alembic Commands

```bash
# Check current version
docker exec -w /app heal_butterflies_api alembic current

# Show migration history
docker exec -w /app heal_butterflies_api alembic history

# Upgrade to latest
docker exec -w /app heal_butterflies_api alembic upgrade head

# Rollback one migration
docker exec -w /app heal_butterflies_api alembic downgrade -1

# Rollback to specific revision
docker exec -w /app heal_butterflies_api alembic downgrade <revision_id>
```

## Benefits of ORM vs Raw SQL

### ORM Advantages ✅
- **Type safety**: Catch errors at development time
- **Less boilerplate**: No manual row parsing (`row[0], row[1]...`)
- **Relationship management**: Automatic joins via relationships
- **Migration tracking**: Schema changes are versioned
- **Refactoring friendly**: Rename columns easily
- **IDE support**: Autocomplete for model attributes

### When to Use Raw SQL ⚠️
- Complex queries with CTEs, window functions
- Performance-critical queries (already optimized SQL)
- Queries that don't map to ORM well (e.g., the species_breakdown JSON aggregation in surveys.py)

### Hybrid Approach (Recommended)
Use ORM for simple CRUD, keep complex queries as raw SQL:

```python
# Simple CRUD - use ORM
surveyors = db.query(Surveyor).all()

# Complex aggregation - use raw SQL
with get_db_cursor() as cursor:
    cursor.execute("""
        SELECT json_agg(json_build_object('type', sp.type, 'count', COUNT(*)))
        FROM sighting si
        JOIN species sp ON si.species_id = sp.id
        WHERE si.survey_id = %s
        GROUP BY sp.type
    """, (survey_id,))
    breakdown = cursor.fetchone()[0]
```

## Migration Plan

### Recommended Approach

1. ✅ **Done**: Set up SQLAlchemy + Alembic infrastructure
2. ✅ **Done**: Refactor `surveyors.py` as example
3. **Next**: Refactor simple routers (`species.py`, `transects.py`)
4. **Later**: Refactor `surveys.py` (keep complex queries as raw SQL)
5. **Deprecate**: Eventually remove `get_db_cursor()` (after all code migrated)

### Refactoring Checklist

When converting a router from raw SQL to ORM:

- [ ] Import `Session` and `Depends(get_db)`
- [ ] Replace `get_db_cursor()` with `db: Session = Depends(get_db)`
- [ ] Use `db.query(Model)` instead of `cursor.execute()`
- [ ] Remove manual row parsing (`row[0], row[1]...`)
- [ ] Use `.model_validate()` for creates
- [ ] Use `.model_dump(exclude_unset=True)` for updates
- [ ] Test all CRUD operations

## Testing

### Manual Testing
```bash
# Start dev environment
./start-env.sh dev

# Test endpoints
curl http://localhost:8000/api/surveyors
curl http://localhost:8000/api/surveyors/1
curl -X POST http://localhost:8000/api/surveyors \
  -H 'Content-Type: application/json' \
  -d '{"first_name":"John","last_name":"Doe"}'
```

### Interactive API Docs
Visit: http://localhost:8000/api/docs

## Troubleshooting

**"alembic command not found"**
```bash
docker exec heal_butterflies_api pip install alembic
```

**"Can't locate revision identified by 'head'"**
```bash
# Stamp database with current state
docker exec -w /app heal_butterflies_api alembic stamp head
```

**"No module named 'models'"**
```bash
# Restart the API container
docker restart heal_butterflies_api
```

**"Target database is not up to date"**
```bash
# Check what migrations need to run
docker exec -w /app heal_butterflies_api alembic current
docker exec -w /app heal_butterflies_api alembic upgrade head
```

## Resources

- [SQLModel Documentation](https://sqlmodel.tiangolo.com/)
- [Alembic Tutorial](https://alembic.sqlalchemy.org/en/latest/tutorial.html)
- [FastAPI + SQLAlchemy Guide](https://fastapi.tiangolo.com/tutorial/sql-databases/)
- [SQLAlchemy Query Guide](https://docs.sqlalchemy.org/en/20/orm/queryguide/)

## Summary

You now have a production-ready ORM setup with:
- ✅ SQLModel models with relationships
- ✅ Alembic for database migrations
- ✅ Both ORM and raw SQL support
- ✅ Working example (`surveyors.py`)
- ✅ Migration baseline established

**Next step**: Refactor another simple router (e.g., `species.py` or `transects.py`) following the `surveyors.py` example!
