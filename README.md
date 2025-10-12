# Heal Butterflies 🦋

Butterfly and bird survey tracking application using Neon PostgreSQL.

## 🚀 Deployment (Streamlit Community Cloud)

### Quick Deploy:
1. **Push to GitHub** (make sure `.streamlit/secrets.toml` is NOT committed)
2. Go to https://share.streamlit.io
3. Click "New app" and select your repository
4. Main file: `app/streamlit_app.py`
5. Add secrets in Streamlit Cloud (copy from `.streamlit/secrets.toml`)
6. Click "Deploy"!

### Setting Secrets in Streamlit Cloud:
In the Streamlit Cloud dashboard, go to **App Settings > Secrets** and paste:
```toml
[database]
DB_HOST = "ep-bold-lab-ab6agv1j-pooler.eu-west-2.aws.neon.tech"
DB_PORT = "5432"
DB_NAME = "neondb"
DB_USER = "neondb_owner"
DB_PASSWORD = "npg_7KYAbqUne5OX"
DB_SSLMODE = "require"
```

### Populate Data After Deployment:
Run the populate scripts locally once (they connect to Neon):
```bash
python3 app/scripts/populate_butterflies.py
python3 app/scripts/populate_birds.py
```

---

## 💻 Local Development

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

**Stop the app:**
```bash
docker compose down
```

---

## 🗄️ Database

This application uses **Neon** (serverless PostgreSQL) for the database.

**Connection details:**
- Database: Neon PostgreSQL (eu-west-2)
- SSL: Required
- Connection pooling: Enabled

**To reset/clear all data:**
```bash
psql 'postgresql://neondb_owner:npg_7KYAbqUne5OX@ep-bold-lab-ab6agv1j-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require' \
  -c "TRUNCATE sighting, survey_surveyor, survey, species, transect, surveyor CASCADE;"
```

---

## 📁 Project Structure
```
app/
├── streamlit_app.py          # Main app entry point
├── pages/                    # Survey management UI
├── dashboards/               # Data visualization
├── database/                 # Database connection & models
└── scripts/                  # Data import scripts
    ├── populate_butterflies.py
    ├── populate_birds.py
    └── data/                 # CSV/Excel source files
```