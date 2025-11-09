# Environment Management Guide

This project supports multiple environments: **dev**, **staging**, and **prod**.

## Quick Start

```bash
# Start development environment (local database)
./start-env.sh dev

# Start staging environment (Neon staging database)
./start-env.sh staging

# Start production environment (Neon production database)
./start-env.sh prod
```

## Environment Overview

| Environment | Frontend | API | Database | Use Case |
|-------------|----------|-----|----------|----------|
| **dev** | localhost:5173 | localhost:8000 | Local PostgreSQL | Daily development, safe testing |
| **staging** | localhost:5173 | localhost:8000 | Neon Staging | Test with realistic data |
| **prod** | localhost:5173 | localhost:8000 | Neon Production | ⚠️ Real data - be careful! |

## Manual Commands

If you prefer not to use the script:

### Development
```bash
docker compose --profile dev up -d
docker compose --profile dev down
```

### Staging
```bash
docker compose --profile staging up -d
docker compose --profile staging down
```

### Production
```bash
docker compose --profile prod up -d
docker compose --profile prod down
```

## Useful Commands

```bash
# View API logs
docker logs -f heal_butterflies_api

# View frontend logs
docker logs -f heal_butterflies_frontend

# Check API health
curl http://localhost:8000/api/health

# Access API docs
open http://localhost:8000/api/docs

# Stop all services
docker compose --profile dev down
docker compose --profile staging down
docker compose --profile prod down
```

## Database Connections

### Development (.env.dev)
- **Host:** db (Docker container)
- **Database:** heal_butterflies
- **User:** postgres
- **Safe for:** Testing, development, breaking things

### Staging (.env.staging)
- **Host:** ep-snowy-base-ab6xgtd9-pooler.eu-west-2.aws.neon.tech
- **Database:** neondb
- **User:** neondb_owner
- **Safe for:** Testing with realistic data

### Production (.env.prod)
- **Host:** ep-bold-lab-ab6agv1j-pooler.eu-west-2.aws.neon.tech
- **Database:** neondb
- **User:** neondb_owner
- **⚠️ Caution:** Real production data

## Switching Environments

To switch from one environment to another:

```bash
# Stop current environment
docker compose --profile dev down     # or staging/prod

# Start new environment
./start-env.sh staging                # or dev/prod
```

## Testing the API

After starting any environment:

```bash
# Test endpoints
curl http://localhost:8000/api/surveyors
curl http://localhost:8000/api/species
curl http://localhost:8000/api/surveys

# Run full test suite
./test-api.sh
```

## Troubleshooting

### API not connecting to database
```bash
# Check API logs
docker logs heal_butterflies_api

# Restart API
docker compose --profile dev restart api
```

### Frontend not loading
```bash
# Check frontend logs
docker logs heal_butterflies_frontend

# Rebuild frontend
docker compose build frontend
docker compose --profile dev up -d
```

### Wrong database connected
```bash
# Verify environment
docker exec heal_butterflies_api env | grep DB_HOST

# Should show:
# dev:     DB_HOST=db
# staging: DB_HOST=ep-snowy-base...
# prod:    DB_HOST=ep-bold-lab...
```

## Legacy Streamlit App

The old Streamlit app can still be run using:

```bash
# Streamlit with dev database
docker compose --profile streamlit-dev up -d

# Streamlit with prod database
docker compose --profile streamlit-prod up -d
```

Access at: http://localhost:8501
