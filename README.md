# Heal Butterflies

Wildlife survey tracking application for butterflies, birds, and spiders. Built with FastAPI backend, React frontend, and PostgreSQL database.

## Project Structure

```
heal_butterflies/
├── app/
│   ├── backend/              # FastAPI REST API
│   │   ├── main.py          # API entry point
│   │   ├── models.py        # Database models (SQLModel)
│   │   ├── database/        # Database connection & pooling
│   │   ├── routers/         # API endpoints (surveys, species, locations, surveyors)
│   │   ├── clients/         # External API clients (NBN Atlas)
│   │   ├── scripts/         # Utility scripts (match_species.py)
│   │   ├── script_utils/    # Script utilities (arg parser)
│   │   └── alembic/         # Database migrations
│   │
│   └── frontend/            # React + TypeScript SPA
│       ├── src/
│       │   ├── pages/       # Page components
│       │   ├── components/  # Reusable UI components
│       │   └── services/    # API client
│       └── Dockerfile
│
├── docker-compose.yml       # Multi-environment Docker setup
├── dev-run                  # Script runner for dev environment
├── staging-run              # Script runner for staging environment
├── prod-run                 # Script runner for prod environment
├── start-env.sh             # Environment starter
└── match-species            # Species matching helper
```

## Starting Services

```bash
./start-env.sh <env>  # env: dev | staging | prod
```

**Environments:**
- `dev` - Local PostgreSQL container (safe for development)
- `staging` - Neon staging database
- `prod` - Neon production database (requires confirmation)

**Access:**
- Frontend: http://localhost:5173
- API: http://localhost:8000
- API Docs: http://localhost:8000/api/docs

**Stop services:**
```bash
docker compose --profile <env> down
```

## Running Scripts

```bash
./dev-run <script_name.py> [arguments]      # Development
./staging-run <script_name.py> [arguments]  # Staging
./prod-run <script_name.py> [arguments]     # Production (requires confirmation)
```

**Options:**
- Add `--build` flag to rebuild Docker image

**Example:**
```bash
./dev-run match_species.py
./match-species  # Quick helper: runs match_species.py against prod DB
```

## Database Migrations

```bash
cd app/backend
alembic revision --autogenerate -m "description"  # Create migration
alembic upgrade head                               # Apply migrations
alembic history                                    # View history
alembic downgrade -1                               # Rollback one migration
```

## Environment Configuration

- `.env.dev` - Local PostgreSQL
- `.env.staging` - Neon staging
- `.env.prod` - Neon production

Selected via Docker Compose profiles.

## Tech Stack

**Backend:**
- FastAPI - REST API framework
- SQLModel - ORM/validation (SQLAlchemy + Pydantic)
- PostgreSQL - Database
- Alembic - Database migrations
- Uvicorn - ASGI server

**Frontend:**
- React - UI framework
- TypeScript - Type safety
- Vite - Build tool

**Infrastructure:**
- Docker - Containerization
- Neon - Serverless PostgreSQL (staging/prod)

## Common Commands

```bash
# View logs
docker logs -f heal_butterflies_api
docker logs -f heal_butterflies_frontend

# Restart services
docker compose --profile <env> restart api
docker compose --profile <env> restart frontend

# Rebuild everything
docker compose --profile <env> down
docker compose build
docker compose --profile <env> up -d

# Health check
curl http://localhost:8000/api/health
```

## API Endpoints

Key endpoints:
- `GET /api/surveys` - List all surveys
- `GET /api/species` - List all species
- `GET /api/locations` - List all locations
- `GET /api/surveyors` - List all surveyors
- `GET /api/health` - Health check

Full API documentation: http://localhost:8000/api/docs
