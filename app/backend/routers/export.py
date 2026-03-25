"""
Export Router - SQLite database export for organisation data

Endpoints:
  GET /api/export/sqlite - Download organisation data as a SQLite database file
"""

import io
import sqlite3
import logging
import tempfile
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

from database.connection import get_db
from dependencies import get_current_organisation
from auth import require_admin
from models import Organisation

logger = logging.getLogger(__name__)

router = APIRouter()


def _create_sqlite_export(db: Session, org: Organisation) -> bytes:
    """Build an in-memory SQLite database containing all organisation data."""
    conn = sqlite3.connect(":memory:")
    cursor = conn.cursor()

    org_id = org.id

    # -- Reference tables (not org-scoped) --

    cursor.execute("""
        CREATE TABLE species_type (
            id INTEGER PRIMARY KEY,
            name TEXT,
            display_name TEXT
        )
    """)
    rows = db.execute(text("SELECT id, name, display_name FROM species_type")).fetchall()
    cursor.executemany("INSERT INTO species_type VALUES (?, ?, ?)", rows)

    cursor.execute("""
        CREATE TABLE species (
            id INTEGER PRIMARY KEY,
            name TEXT,
            scientific_name TEXT,
            species_code TEXT,
            conservation_status TEXT,
            nbn_atlas_guid TEXT,
            species_type_id INTEGER REFERENCES species_type(id)
        )
    """)
    rows = db.execute(text("SELECT id, name, scientific_name, species_code, conservation_status, nbn_atlas_guid, species_type_id FROM species")).fetchall()
    cursor.executemany("INSERT INTO species VALUES (?, ?, ?, ?, ?, ?, ?)", rows)

    cursor.execute("""
        CREATE TABLE breeding_status_code (
            code TEXT PRIMARY KEY,
            description TEXT,
            full_description TEXT,
            category TEXT
        )
    """)
    rows = db.execute(text("SELECT code, description, full_description, category FROM breeding_status_code")).fetchall()
    cursor.executemany("INSERT INTO breeding_status_code VALUES (?, ?, ?, ?)", rows)

    # -- Organisation-scoped tables --

    cursor.execute("""
        CREATE TABLE surveyor (
            id INTEGER PRIMARY KEY,
            first_name TEXT,
            last_name TEXT,
            is_active INTEGER
        )
    """)
    rows = db.execute(text(
        "SELECT id, first_name, last_name, is_active FROM surveyor WHERE organisation_id = :org_id"
    ), {"org_id": org_id}).fetchall()
    cursor.executemany("INSERT INTO surveyor VALUES (?, ?, ?, ?)", rows)

    cursor.execute("""
        CREATE TABLE location (
            id INTEGER PRIMARY KEY,
            name TEXT,
            boundary_geometry TEXT,
            boundary_fill_color TEXT,
            boundary_stroke_color TEXT,
            boundary_fill_opacity REAL
        )
    """)
    rows = db.execute(text(
        "SELECT id, name, ST_AsText(boundary_geometry), boundary_fill_color, boundary_stroke_color, boundary_fill_opacity "
        "FROM location WHERE organisation_id = :org_id"
    ), {"org_id": org_id}).fetchall()
    cursor.executemany("INSERT INTO location VALUES (?, ?, ?, ?, ?, ?)", rows)

    cursor.execute("""
        CREATE TABLE survey_type (
            id INTEGER PRIMARY KEY,
            name TEXT,
            description TEXT,
            location_at_sighting_level INTEGER,
            allow_geolocation INTEGER,
            allow_sighting_notes INTEGER,
            allow_audio_upload INTEGER,
            allow_image_upload INTEGER,
            color TEXT,
            is_active INTEGER
        )
    """)
    rows = db.execute(text(
        "SELECT id, name, description, location_at_sighting_level, allow_geolocation, "
        "allow_sighting_notes, allow_audio_upload, allow_image_upload, color, is_active "
        "FROM survey_type WHERE organisation_id = :org_id"
    ), {"org_id": org_id}).fetchall()
    cursor.executemany("INSERT INTO survey_type VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", rows)

    cursor.execute("""
        CREATE TABLE survey_type_location (
            id INTEGER PRIMARY KEY,
            survey_type_id INTEGER REFERENCES survey_type(id),
            location_id INTEGER REFERENCES location(id)
        )
    """)
    rows = db.execute(text(
        "SELECT stl.id, stl.survey_type_id, stl.location_id "
        "FROM survey_type_location stl "
        "JOIN survey_type st ON st.id = stl.survey_type_id "
        "WHERE st.organisation_id = :org_id"
    ), {"org_id": org_id}).fetchall()
    cursor.executemany("INSERT INTO survey_type_location VALUES (?, ?, ?)", rows)

    cursor.execute("""
        CREATE TABLE survey_type_species_type (
            id INTEGER PRIMARY KEY,
            survey_type_id INTEGER REFERENCES survey_type(id),
            species_type_id INTEGER REFERENCES species_type(id)
        )
    """)
    rows = db.execute(text(
        "SELECT stst.id, stst.survey_type_id, stst.species_type_id "
        "FROM survey_type_species_type stst "
        "JOIN survey_type st ON st.id = stst.survey_type_id "
        "WHERE st.organisation_id = :org_id"
    ), {"org_id": org_id}).fetchall()
    cursor.executemany("INSERT INTO survey_type_species_type VALUES (?, ?, ?)", rows)

    cursor.execute("""
        CREATE TABLE device (
            id INTEGER PRIMARY KEY,
            device_id TEXT,
            name TEXT,
            device_type TEXT,
            latitude REAL,
            longitude REAL,
            location_id INTEGER REFERENCES location(id),
            is_active INTEGER
        )
    """)
    rows = db.execute(text(
        "SELECT id, device_id, name, device_type, "
        "ST_Y(point_geometry), ST_X(point_geometry), "
        "location_id, is_active "
        "FROM device WHERE organisation_id = :org_id"
    ), {"org_id": org_id}).fetchall()
    cursor.executemany("INSERT INTO device VALUES (?, ?, ?, ?, ?, ?, ?, ?)", rows)

    cursor.execute("""
        CREATE TABLE survey (
            id INTEGER PRIMARY KEY,
            date TEXT,
            start_time TEXT,
            end_time TEXT,
            sun_percentage INTEGER,
            temperature_celsius REAL,
            conditions_met INTEGER,
            notes TEXT,
            location_id INTEGER REFERENCES location(id),
            survey_type_id INTEGER REFERENCES survey_type(id),
            created_at TEXT
        )
    """)
    rows = db.execute(text(
        "SELECT id, date, start_time, end_time, sun_percentage, temperature_celsius, "
        "conditions_met, notes, location_id, survey_type_id, created_at "
        "FROM survey WHERE organisation_id = :org_id"
    ), {"org_id": org_id}).fetchall()
    cursor.executemany("INSERT INTO survey VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", rows)

    cursor.execute("""
        CREATE TABLE survey_surveyor (
            id INTEGER PRIMARY KEY,
            survey_id INTEGER REFERENCES survey(id),
            surveyor_id INTEGER REFERENCES surveyor(id)
        )
    """)
    rows = db.execute(text(
        "SELECT ss.id, ss.survey_id, ss.surveyor_id "
        "FROM survey_surveyor ss "
        "JOIN survey s ON s.id = ss.survey_id "
        "WHERE s.organisation_id = :org_id"
    ), {"org_id": org_id}).fetchall()
    cursor.executemany("INSERT INTO survey_surveyor VALUES (?, ?, ?)", rows)

    cursor.execute("""
        CREATE TABLE sighting (
            id INTEGER PRIMARY KEY,
            survey_id INTEGER REFERENCES survey(id),
            species_id INTEGER REFERENCES species(id),
            count INTEGER,
            location_id INTEGER REFERENCES location(id),
            notes TEXT,
            created_at TEXT
        )
    """)
    rows = db.execute(text(
        "SELECT si.id, si.survey_id, si.species_id, si.count, si.location_id, si.notes, si.created_at "
        "FROM sighting si "
        "JOIN survey s ON s.id = si.survey_id "
        "WHERE s.organisation_id = :org_id"
    ), {"org_id": org_id}).fetchall()
    cursor.executemany("INSERT INTO sighting VALUES (?, ?, ?, ?, ?, ?, ?)", rows)

    cursor.execute("""
        CREATE TABLE sighting_individual (
            id INTEGER PRIMARY KEY,
            sighting_id INTEGER REFERENCES sighting(id),
            latitude REAL,
            longitude REAL,
            count INTEGER,
            sex TEXT,
            posture TEXT,
            singing INTEGER,
            notes TEXT,
            created_at TEXT
        )
    """)
    rows = db.execute(text(
        "SELECT si2.id, si2.sighting_id, "
        "ST_Y(si2.coordinates), ST_X(si2.coordinates), "
        "si2.count, si2.sex, si2.posture, si2.singing, si2.notes, si2.created_at "
        "FROM sighting_individual si2 "
        "JOIN sighting si ON si.id = si2.sighting_id "
        "JOIN survey s ON s.id = si.survey_id "
        "WHERE s.organisation_id = :org_id"
    ), {"org_id": org_id}).fetchall()
    cursor.executemany("INSERT INTO sighting_individual VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", rows)

    cursor.execute("""
        CREATE TABLE audio_recording (
            id INTEGER PRIMARY KEY,
            survey_id INTEGER REFERENCES survey(id),
            filename TEXT,
            recording_timestamp TEXT,
            device_serial TEXT,
            file_size_bytes INTEGER,
            duration_seconds REAL,
            processing_status TEXT,
            uploaded_at TEXT
        )
    """)
    rows = db.execute(text(
        "SELECT ar.id, ar.survey_id, ar.filename, ar.recording_timestamp, ar.device_serial, "
        "ar.file_size_bytes, ar.duration_seconds, ar.processing_status, ar.uploaded_at "
        "FROM audio_recording ar "
        "JOIN survey s ON s.id = ar.survey_id "
        "WHERE s.organisation_id = :org_id"
    ), {"org_id": org_id}).fetchall()
    cursor.executemany("INSERT INTO audio_recording VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", rows)

    cursor.execute("""
        CREATE TABLE bird_detection (
            id INTEGER PRIMARY KEY,
            audio_recording_id INTEGER REFERENCES audio_recording(id),
            species_id INTEGER REFERENCES species(id),
            species_name TEXT,
            confidence REAL,
            start_time TEXT,
            end_time TEXT,
            detection_timestamp TEXT
        )
    """)
    rows = db.execute(text(
        "SELECT bd.id, bd.audio_recording_id, bd.species_id, bd.species_name, "
        "bd.confidence, bd.start_time, bd.end_time, bd.detection_timestamp "
        "FROM bird_detection bd "
        "JOIN audio_recording ar ON ar.id = bd.audio_recording_id "
        "JOIN survey s ON s.id = ar.survey_id "
        "WHERE s.organisation_id = :org_id"
    ), {"org_id": org_id}).fetchall()
    cursor.executemany("INSERT INTO bird_detection VALUES (?, ?, ?, ?, ?, ?, ?, ?)", rows)

    cursor.execute("""
        CREATE TABLE camera_trap_image (
            id INTEGER PRIMARY KEY,
            survey_id INTEGER REFERENCES survey(id),
            filename TEXT,
            image_timestamp TEXT,
            device_serial TEXT,
            file_size_bytes INTEGER,
            processing_status TEXT,
            flagged_for_review INTEGER,
            review_reason TEXT,
            created_at TEXT
        )
    """)
    rows = db.execute(text(
        "SELECT cti.id, cti.survey_id, cti.filename, cti.image_timestamp, cti.device_serial, "
        "cti.file_size_bytes, cti.processing_status, cti.flagged_for_review, cti.review_reason, cti.created_at "
        "FROM camera_trap_image cti "
        "JOIN survey s ON s.id = cti.survey_id "
        "WHERE s.organisation_id = :org_id"
    ), {"org_id": org_id}).fetchall()
    cursor.executemany("INSERT INTO camera_trap_image VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", rows)

    cursor.execute("""
        CREATE TABLE camera_trap_detection (
            id INTEGER PRIMARY KEY,
            camera_trap_image_id INTEGER REFERENCES camera_trap_image(id),
            species_id INTEGER REFERENCES species(id),
            species_name TEXT,
            scientific_name TEXT,
            confidence REAL,
            taxonomic_level TEXT,
            is_primary INTEGER
        )
    """)
    rows = db.execute(text(
        "SELECT ctd.id, ctd.camera_trap_image_id, ctd.species_id, ctd.species_name, "
        "ctd.scientific_name, ctd.confidence, ctd.taxonomic_level, ctd.is_primary "
        "FROM camera_trap_detection ctd "
        "JOIN camera_trap_image cti ON cti.id = ctd.camera_trap_image_id "
        "JOIN survey s ON s.id = cti.survey_id "
        "WHERE s.organisation_id = :org_id"
    ), {"org_id": org_id}).fetchall()
    cursor.executemany("INSERT INTO camera_trap_detection VALUES (?, ?, ?, ?, ?, ?, ?, ?)", rows)

    conn.commit()

    # Serialize in-memory DB to bytes via backup to a temp file
    with tempfile.NamedTemporaryFile(suffix=".sqlite", delete=True) as tmp:
        disk_conn = sqlite3.connect(tmp.name)
        conn.backup(disk_conn)
        disk_conn.close()
        conn.close()
        tmp.seek(0)
        return tmp.read()


@router.get("/sqlite")
async def export_sqlite(
    db: Session = Depends(get_db),
    org: Organisation = Depends(get_current_organisation),
    _admin: None = Depends(require_admin),
):
    """Export all organisation data as a downloadable SQLite database file."""
    logger.info(f"SQLite export requested for organisation: {org.slug}")

    sqlite_bytes = _create_sqlite_export(db, org)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"{org.slug}_export_{timestamp}.sqlite"

    return StreamingResponse(
        io.BytesIO(sqlite_bytes),
        media_type="application/x-sqlite3",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
