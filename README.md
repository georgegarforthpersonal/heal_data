# Heal Butterflies

Wildlife survey tracking application. FastAPI backend, React frontend, PostgreSQL database.

## Quick Start

```bash
make dev          # Start development environment
make down         # Stop all services
```

**Access:**
- Frontend: http://localhost:5173
- API: http://localhost:8000/api/docs

## Commands

```bash
# Environments
make dev              # Local PostgreSQL
make staging          # Neon staging DB
make prod             # Neon production DB

# Testing
make test-backend     # Run pytest
make test-frontend    # Run vitest
make typecheck        # Run mypy
make check            # Run all tests

# Scripts
./run dev <script.py>      # Run script in dev
./run staging <script.py>  # Run script in staging
./run prod <script.py>     # Run script in prod (requires confirmation)

# Database
make migrate          # Run migrations (dev)
make migrate-staging  # Run migrations (staging)
make migrate-prod     # Run migrations (prod)

# Other
make shell            # Open bash in dev container
make logs             # Tail all logs
make help             # Show all commands
```

## Environment Files

```
.env          # Development (local DB)
.env.staging  # Staging (Neon)
.env.prod     # Production (Neon)
```

## Project Structure

```
app/
├── backend/           # FastAPI REST API
│   ├── routers/       # API endpoints
│   ├── models.py      # SQLModel models
│   ├── scripts/       # Utility scripts
│   └── alembic/       # Migrations
└── frontend/          # React + TypeScript
    └── src/
        ├── pages/
        ├── components/
        └── services/
```

## Tech Stack

- **Backend:** FastAPI, SQLModel, PostgreSQL, Alembic
- **Frontend:** React, TypeScript, Vite
- **Infra:** Docker, Neon (serverless Postgres)
