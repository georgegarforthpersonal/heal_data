Condi# Heal Butterflies 🦋

A simple butterfly survey tracking application with Streamlit interface and PostgreSQL database backend.

## Features

- **Database Integration**: PostgreSQL backend with automated table creation
- **Simple Interface**: Minimal Streamlit application ready for customization
- **Survey Data Models**: Pre-built data models for surveys, species, transects, and sightings

## Quick Start

### Prerequisites

- Docker and Docker Compose

### Installation

1. **Clone or navigate to the project directory**
   ```bash
   cd heal_butterflies
   ```

2. **Start both the database and Streamlit application**
   ```bash
   docker compose up -d
   ```
   This will:
   - Start PostgreSQL on port 5432 with automatic table creation
   - Build and start the Streamlit app on port 8501

3. **Open your browser**
   Navigate to `http://localhost:8501` to access the application.

## Database Management

**Stop all services:**
```bash
docker compose down
```

**Reset the database (removes all data):**
```bash
docker compose down -v
docker compose up -d
```

**View logs:**
```bash
docker compose logs postgres    # Database logs
docker compose logs streamlit   # App logs
docker compose logs             # All logs
```

## Configuration

Default database settings:
- Host: localhost
- Port: 5432
- Database: heal_butterflies
- User: postgres
- Password: password

You can customize these by setting environment variables:
- `DB_HOST`
- `DB_PORT` 
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

## Project Structure

```
heal_butterflies/
├── app/
│   ├── streamlit_app.py      # Main application entry point
│   └── database/
│       ├── connection.py     # Database connection utilities
│       ├── models.py         # Data models and schemas
│       └── migrations/       # Future database migrations
├── requirements.txt          # Python dependencies
├── docker-compose.yml        # PostgreSQL configuration
└── init.sql                 # Database initialization
```

## Development

The application includes pre-built data models for:
- **Surveyors**: People conducting butterfly surveys
- **Species**: Butterfly species being tracked
- **Transects**: Survey areas/routes
- **Surveys**: Individual survey sessions
- **Sightings**: Butterfly observations during surveys

Build upon the simple Streamlit app in `app/streamlit_app.py` to add your custom functionality.

## Troubleshooting

**Database connection issues:**
- Ensure Docker is running: `docker ps`
- Check if PostgreSQL container is up: `docker-compose ps`
- Verify port 5432 is not in use by another service

**Streamlit app won't start:**
- Check Python dependencies: `pip install -r requirements.txt`
- Verify you're in the correct directory when running streamlit

**Permission errors:**
- On macOS/Linux, you may need to adjust Docker permissions
- Try: `sudo docker-compose up -d`

## License

This project is for butterfly rehabilitation and healing purposes.