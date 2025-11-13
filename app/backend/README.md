# Wildlife Survey API - FastAPI Backend

REST API backend for the Wildlife Survey Management System V2.

## Architecture

```
React Frontend (port 5173)
    ↓ HTTP/REST
FastAPI Backend (port 8000)
    ↓ PostgreSQL
Database (port 5432)
```

## Tech Stack

- **FastAPI** - Modern Python web framework
- **SQLModel** - Unified ORM/validation (combines SQLAlchemy + Pydantic)
- **Uvicorn** - ASGI server
- **psycopg2** - PostgreSQL driver with connection pooling

## Project Structure

```
backend/
├── main.py                 # FastAPI application entry point
├── models.py               # SQLModel models (unified ORM + validation)
├── database/
│   ├── connection.py       # Database connection pooling
│   └── __init__.py
├── routers/
│   ├── surveys.py          # Survey endpoints
│   ├── species.py          # Species endpoints
│   ├── transects.py        # Transect endpoints
│   ├── surveyors.py        # Surveyor endpoints
│   └── __init__.py
├── requirements.txt        # Python dependencies
├── Dockerfile              # Docker configuration
└── README.md               # This file
```

## Key Features

### SQLModel Architecture

Uses SQLModel for unified data modeling:
- Single source of truth for database schema and API validation
- Eliminates duplication between SQLAlchemy models and Pydantic schemas
- Pattern: separate classes for Base, Create, Update, and Read operations

### Species Breakdown

Surveys include `species_breakdown` showing sighting counts grouped by species type (butterfly, bird, fungi):

```json
{
  "id": 460,
  "date": "2025-11-08",
  "sightings_count": 20,
  "species_breakdown": [
    {"type": "bird", "count": 15},
    {"type": "butterfly", "count": 5}
  ]
}
```

This enables the frontend to display species-specific icons even when surveys contain multiple species types.

**Note**: The `survey.type` field is deprecated. Always use `species_breakdown` to determine actual species in a survey.

## API Endpoints

### Surveys

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/surveys` | List all surveys with sighting counts |
| POST | `/api/surveys` | Create new survey |
| GET | `/api/surveys/{id}` | Get specific survey |
| PUT | `/api/surveys/{id}` | Update survey |
| DELETE | `/api/surveys/{id}` | Delete survey |
| GET | `/api/surveys/{id}/sightings` | Get sightings for survey |
| POST | `/api/surveys/{id}/sightings` | Add sighting to survey |
| PUT | `/api/surveys/{id}/sightings/{sighting_id}` | Update sighting |
| DELETE | `/api/surveys/{id}/sightings/{sighting_id}` | Delete sighting |

### Species

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/species` | List all species |
| POST | `/api/species` | Create new species |
| GET | `/api/species/{id}` | Get specific species |
| PUT | `/api/species/{id}` | Update species |
| DELETE | `/api/species/{id}` | Delete species |

### Transects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transects` | List all transects |
| POST | `/api/transects` | Create new transect |
| GET | `/api/transects/{id}` | Get specific transect |
| PUT | `/api/transects/{id}` | Update transect |
| DELETE | `/api/transects/{id}` | Delete transect |

### Surveyors

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/surveyors` | List all surveyors |
| POST | `/api/surveyors` | Create new surveyor |
| GET | `/api/surveyors/{id}` | Get specific surveyor |
| PUT | `/api/surveyors/{id}` | Update surveyor |
| DELETE | `/api/surveyors/{id}` | Delete surveyor |

### Health & Docs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/docs` | Swagger UI (Interactive API docs) |
| GET | `/api/redoc` | ReDoc (Alternative API docs) |

## Running Locally

See `ENVIRONMENT_GUIDE.md` in project root for full setup instructions.

### Quick Start

```bash
# From project root - start dev environment (local PostgreSQL)
./start-env.sh dev

# Or start staging environment (Neon staging DB)
./start-env.sh staging

# API will be available at http://localhost:8000
# Swagger docs at http://localhost:8000/api/docs
```

### Manual Docker Commands

```bash
# Development environment
docker compose --profile dev up -d

# Staging environment
docker compose --profile staging up -d

# Production environment
docker compose --profile prod up -d
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | Database hostname | localhost |
| `DB_PORT` | Database port | 5432 |
| `DB_NAME` | Database name | heal_butterflies |
| `DB_USER` | Database user | postgres |
| `DB_PASSWORD` | Database password | password |
| `DB_SSLMODE` | SSL mode (for Neon production) | - |

## Development

### Auto-Reload

The server automatically reloads when code changes (when using `--reload` flag or Docker volume mounts).

### API Documentation

Visit `http://localhost:8000/api/docs` for interactive Swagger UI documentation where you can:
- See all available endpoints
- View request/response schemas
- Test endpoints directly from browser

### Database Connection

Uses connection pooling (2-10 connections) for efficient database access. Connections are automatically validated before use.

## Testing

```bash
# Test health endpoint
curl http://localhost:8000/api/health

# Get all surveys
curl http://localhost:8000/api/surveys

# Get specific survey
curl http://localhost:8000/api/surveys/1

# Get sightings for survey
curl http://localhost:8000/api/surveys/1/sightings
```

## Code Evolution

This backend evolved from the Streamlit POC:

- **Database connection**: Adapted from `app/database/connection.py` with connection pooling
- **Models**: Migrated from dual dataclass/Pydantic models to unified SQLModel
- **Queries**: Reused and enhanced SQL queries from `app/pages/surveys.py`
- **New features**: Added species_breakdown aggregation for multi-species support

## Next Steps

1. ✅ Backend setup complete
2. ✅ React frontend connected to API
3. ✅ Multi-environment support (dev/staging/prod)
4. ⏭️ Add authentication (JWT tokens)
5. ⏭️ Add request rate limiting
6. ⏭️ Add comprehensive error handling
7. ⏭️ Add API tests

## Troubleshooting

### Cannot connect to database

- Ensure PostgreSQL is running (`docker-compose up db`)
- Check environment variables are set correctly
- Verify database credentials

### Port 8000 already in use

- Stop other services using port 8000
- Or change port: `uvicorn main:app --port 8001`

### CORS errors from React

- CORS is configured for `localhost:5173` and `localhost:5174`
- If using different port, update `origins` list in `main.py`
