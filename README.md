# Heal Butterflies 🦋

A Streamlit web application for tracking butterfly healing and rehabilitation data with PostgreSQL database backend.

## Features

- **User Management**: Add and manage users who record butterfly data
- **Butterfly Records**: Track butterfly species, status, location, and notes
- **Database Integration**: PostgreSQL backend with automated table creation
- **Interactive Forms**: Easy-to-use Streamlit forms for data entry
- **Record Viewing**: Browse all butterfly records with filtering

## Quick Start

### Prerequisites

- Python 3.8+
- Docker and Docker Compose
- pip

### Installation

1. **Clone or navigate to the project directory**
   ```bash
   cd heal_butterflies
   ```

2. **Create and activate a virtual environment**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install Python dependencies**
   ```bash
    pip install --only-binary=psycopg2-binary -r requirements.txt
   ```

4. **Start the PostgreSQL database**
   ```bash
   docker compose up -d
   ```
   This will start PostgreSQL on port 5432 and automatically create the required tables.

5. **Run the Streamlit application**
   ```bash
   streamlit run app/streamlit_app.py
   ```

6. **Open your browser**
   Navigate to `http://localhost:8501` to access the application.

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and modify if needed:

```bash
cp .env.example .env
```

Default database settings:
- Host: localhost
- Port: 5432
- Database: heal_butterflies
- User: postgres
- Password: password

### Database Management

**Stop the database:**
```bash
docker-compose down
```

**Reset the database (removes all data):**
```bash
docker-compose down -v
docker-compose up -d
```

**View database logs:**
```bash
docker-compose logs postgres
```

## Usage

### Adding Users
1. Navigate to "User Forms" → "Add User" tab
2. Enter name and email
3. Click "Add User"

### Recording Butterfly Data
1. Go to "User Forms" → "Add Butterfly Record" tab
2. Fill in species, status, location, and notes
3. Select the user who made the record
4. Click "Add Record"

### Viewing Records
1. Visit "User Forms" → "View Records" tab
2. Browse all butterfly records with expandable details

## Project Structure

```
heal_butterflies/
├── app/
│   ├── streamlit_app.py      # Main application entry point
│   ├── forms/
│   │   └── user_forms.py     # Form components and logic
│   ├── database/
│   │   ├── connection.py     # Database connection utilities
│   │   ├── models.py         # Data models and schemas
│   │   └── migrations/       # Future database migrations
│   └── utils/                # Utility functions
├── requirements.txt          # Python dependencies
├── docker-compose.yml        # PostgreSQL configuration
├── init.sql                 # Database initialization
└── .env.example             # Environment variables template
```

## Development

### Adding New Features
1. Create new form components in `app/forms/`
2. Add database models to `app/database/models.py`
3. Update the main app in `app/streamlit_app.py`

### Database Changes
- Add migration scripts to `app/database/migrations/`
- Update table schemas in `init.sql` for fresh installations

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