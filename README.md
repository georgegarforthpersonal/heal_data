# Heal Butterflies 🦋

Butterfly and bird survey tracking application.

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

## Database Management

**Remove all data:**
```bash
docker compose down -v
docker compose up
```

**Stop the app:**
```bash
docker compose down
```

## Running Scripts
```bash
./run-script script.py
```