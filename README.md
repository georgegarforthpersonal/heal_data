# Heal Butterflies 🦋

Butterfly and bird survey tracking application using Neon PostgreSQL with FastAPI backend and React frontend.

## 🚀 Quick Start

### First Time Setup

1. **Start development environment:**
```bash
./start-env.sh dev
```

2. **Access the application:**
- Frontend: http://localhost:5173
- API: http://localhost:8000
- API Docs: http://localhost:8000/api/docs

### Daily Development

**Run development environment (local database):**
```bash
./start-env.sh dev
```

**Run staging environment (Neon staging database):**
```bash
./start-env.sh staging
```

**Run production environment (Neon production database):**
```bash
./start-env.sh prod
```

**Stop environment:**
```bash
docker compose --profile dev down
```

---

## 💻 Development Environments

| Environment | Frontend | API | Database | Use Case |
|-------------|----------|-----|----------|----------|
| **dev** | localhost:5173 | localhost:8000 | Local PostgreSQL | Daily development, safe testing |
| **staging** | localhost:5173 | localhost:8000 | Neon Staging | Test with realistic data |
| **prod** | localhost:5173 | localhost:8000 | Neon Production | ⚠️ Real data - be careful! |

### Environment Details

- **Dev** (`.env.dev`): Local PostgreSQL container
- **Staging** (`.env.staging`): Neon cloud database (staging)
- **Prod** (`.env.prod`): Neon cloud database (production)

---

## 🗄️ Database

This application uses **Neon** (serverless PostgreSQL) for staging and production environments.

**Connection details:**
- Database: Neon PostgreSQL (eu-west-2)
- SSL: Required
- Connection pooling: Enabled

**Database migrations:**
```bash
# From app-v2/backend directory
alembic revision --autogenerate -m "description"
alembic upgrade head
```

---

## 📁 Project Structure
```
app-v2/
├── frontend/                 # React + TypeScript frontend
│   ├── src/
│   │   ├── pages/           # Page components
│   │   ├── components/      # Reusable components
│   │   └── services/        # API client
│   └── Dockerfile
├── backend/                  # FastAPI backend
│   ├── main.py              # API entry point
│   ├── models.py            # SQLModel database models
│   ├── database/            # Database connection
│   ├── routers/             # API endpoints
│   └── alembic/             # Database migrations
└── README.md                # Detailed documentation
```

---

## 🧪 Testing

**Test the API:**
```bash
./test-api.sh
```

**Manual API testing:**
```bash
curl http://localhost:8000/api/health
curl http://localhost:8000/api/surveyors
curl http://localhost:8000/api/species
curl http://localhost:8000/api/surveys
```

---

## 📚 Documentation

- See `ENVIRONMENT_GUIDE.md` for detailed environment setup
- See `app-v2/DEVELOPMENT.md` for development guidelines
- See `app-v2/README.md` for application details

---

## 🛠️ Troubleshooting

**View logs:**
```bash
docker logs -f heal_butterflies_api
docker logs -f heal_butterflies_frontend
```

**Restart services:**
```bash
docker compose --profile dev restart api
docker compose --profile dev restart frontend
```

**Rebuild from scratch:**
```bash
docker compose --profile dev down
docker compose build
docker compose --profile dev up -d
```
