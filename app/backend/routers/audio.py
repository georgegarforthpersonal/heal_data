"""
Audio Recordings Router - API endpoints for bird audio analysis

Endpoints:
  GET    /api/surveys/{survey_id}/audio              - List audio recordings for survey
  POST   /api/surveys/{survey_id}/audio              - Upload audio file(s)
  GET    /api/surveys/{survey_id}/audio/{id}         - Get audio recording details
  DELETE /api/surveys/{survey_id}/audio/{id}         - Delete audio recording
  POST   /api/surveys/{survey_id}/audio/{id}/process - Trigger processing (manual)
  GET    /api/surveys/{survey_id}/audio/{id}/detections - Get detections for recording
  GET    /api/audio/{id}/download                    - Get presigned download URL
"""

import logging
import re
import tempfile
from datetime import datetime
from pathlib import Path
from typing import List

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import require_admin
from database.connection import get_db, get_session_factory
from dependencies import get_current_organisation
from models import (
    AudioRecording,
    AudioRecordingRead,
    BirdDetection,
    BirdDetectionRead,
    DetectionClip,
    Organisation,
    ProcessingStatus,
    Species,
    SpeciesDetectionSummary,
    Survey,
    SurveyDetectionsSummaryResponse,
)
from services.r2_storage import (
    delete_audio_file,
    download_audio_file,
    generate_presigned_url,
    upload_audio_file,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Cannwood coordinates for location-based species filtering
CANNWOOD_LAT = 51.3452
CANNWOOD_LON = -2.2525


def extract_recording_info(filename: str) -> dict:
    """Extract device serial and timestamp from filename."""
    match = re.match(r"([A-Z0-9]+)_(\d{8})_(\d{6})\.wav", filename, re.IGNORECASE)
    if match:
        serial, date_str, time_str = match.groups()
        timestamp = datetime.strptime(f"{date_str}_{time_str}", "%Y%m%d_%H%M%S")
        return {"device_serial": serial, "recording_timestamp": timestamp}
    return {"device_serial": None, "recording_timestamp": None}


def _build_recording_response(recording: AudioRecording, detection_count: int) -> dict:
    """Build response dict for an audio recording."""
    return {
        "id": recording.id,
        "survey_id": recording.survey_id,
        "filename": recording.filename,
        "r2_key": recording.r2_key,
        "file_size_bytes": recording.file_size_bytes,
        "duration_seconds": recording.duration_seconds,
        "recording_timestamp": recording.recording_timestamp,
        "device_serial": recording.device_serial,
        "processing_status": recording.processing_status.value
        if hasattr(recording.processing_status, "value")
        else recording.processing_status,
        "processing_error": recording.processing_error,
        "uploaded_at": recording.uploaded_at,
        "detection_count": detection_count,
        "unmatched_species": recording.unmatched_species,
    }


@router.get("/{survey_id}/audio", response_model=List[AudioRecordingRead])
async def list_audio_recordings(
    survey_id: int,
    org: Organisation = Depends(get_current_organisation),
    db: Session = Depends(get_db),
):
    """List all audio recordings for a survey."""
    # Verify survey belongs to org
    survey = (
        db.query(Survey)
        .filter(Survey.id == survey_id, Survey.organisation_id == org.id)
        .first()
    )
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")

    recordings = (
        db.query(AudioRecording)
        .filter(AudioRecording.survey_id == survey_id)
        .order_by(AudioRecording.recording_timestamp.desc())
        .all()
    )

    result = []
    for rec in recordings:
        detection_count = (
            db.query(func.count(BirdDetection.id))
            .filter(BirdDetection.audio_recording_id == rec.id)
            .scalar()
        )
        result.append(_build_recording_response(rec, detection_count))
    return result


@router.post(
    "/{survey_id}/audio",
    response_model=List[AudioRecordingRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
async def upload_audio_files(
    survey_id: int,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    org: Organisation = Depends(get_current_organisation),
    db: Session = Depends(get_db),
):
    """
    Upload one or more audio files to a survey.
    Files are stored in R2 and processing is auto-triggered.
    """
    # Verify survey belongs to org
    survey = (
        db.query(Survey)
        .filter(Survey.id == survey_id, Survey.organisation_id == org.id)
        .first()
    )
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")

    uploaded = []
    for file in files:
        if not file.filename.lower().endswith(".wav"):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type: {file.filename}. Only WAV files accepted.",
            )

        # Check for duplicate
        existing = (
            db.query(AudioRecording)
            .filter(
                AudioRecording.survey_id == survey_id,
                AudioRecording.filename == file.filename,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=400, detail=f"File already exists: {file.filename}"
            )

        # Extract metadata from filename
        info = extract_recording_info(file.filename)

        # Upload to R2
        r2_key = upload_audio_file(file.file, file.filename, org.slug)

        # Get file size
        file.file.seek(0, 2)  # Seek to end
        file_size = file.file.tell()
        file.file.seek(0)  # Reset

        # Create database record
        recording = AudioRecording(
            survey_id=survey_id,
            filename=file.filename,
            r2_key=r2_key,
            file_size_bytes=file_size,
            device_serial=info["device_serial"],
            recording_timestamp=info["recording_timestamp"],
            processing_status=ProcessingStatus.pending,
        )
        db.add(recording)
        db.flush()  # Get the ID

        uploaded.append(recording)

        # Auto-trigger background processing
        background_tasks.add_task(process_recording_background, recording_id=recording.id)

    db.commit()

    # Build response
    return [_build_recording_response(rec, 0) for rec in uploaded]


@router.post(
    "/{survey_id}/audio/{recording_id}/process",
    dependencies=[Depends(require_admin)],
)
async def process_audio_recording(
    survey_id: int,
    recording_id: int,
    background_tasks: BackgroundTasks,
    org: Organisation = Depends(get_current_organisation),
    db: Session = Depends(get_db),
):
    """
    Manually trigger BirdNET processing for an audio recording.
    Processing runs in background; poll status via GET endpoint.
    """
    recording = (
        db.query(AudioRecording)
        .join(Survey)
        .filter(
            AudioRecording.id == recording_id,
            AudioRecording.survey_id == survey_id,
            Survey.organisation_id == org.id,
        )
        .first()
    )
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    if recording.processing_status == ProcessingStatus.processing:
        raise HTTPException(
            status_code=400, detail="Recording is already being processed"
        )

    # Mark as processing
    recording.processing_status = ProcessingStatus.processing
    recording.processing_started_at = datetime.utcnow()
    recording.processing_error = None
    db.commit()

    # Queue background processing
    background_tasks.add_task(process_recording_background, recording_id=recording_id)

    return {"status": "processing", "message": "Processing started"}


def process_recording_background(recording_id: int):
    """Background task to process audio with BirdNET."""
    from services.bird_audio import analyze_file, get_db_scientific_name, get_location_species

    SessionLocal = get_session_factory()
    db = SessionLocal()

    try:
        recording = (
            db.query(AudioRecording)
            .filter(AudioRecording.id == recording_id)
            .first()
        )
        if not recording:
            logger.error(f"Recording {recording_id} not found for processing")
            return

        # Update status to processing
        recording.processing_status = ProcessingStatus.processing
        recording.processing_started_at = datetime.utcnow()
        db.commit()

        # Download file to temp location
        with tempfile.TemporaryDirectory() as tmpdir:
            local_path = Path(tmpdir) / recording.filename
            download_audio_file(recording.r2_key, local_path)

            # Get location-filtered species list
            species_list = get_location_species(CANNWOOD_LAT, CANNWOOD_LON)

            # Run BirdNET analysis
            detections = analyze_file(local_path, species_list)

            # Store detections, tracking unmatched species
            unmatched = []
            matched_count = 0
            for det in detections:
                # Look up species in database
                scientific_name = get_db_scientific_name(det.species)
                species = db.query(Species).filter(
                    Species.scientific_name == scientific_name,
                    Species.type == "bird"
                ).first()

                if species:
                    bird_det = BirdDetection(
                        audio_recording_id=recording_id,
                        species_name=det.species,
                        species_id=species.id,
                        confidence=det.confidence,
                        start_time=det.start,
                        end_time=det.end,
                        detection_timestamp=det.timestamp,
                    )
                    db.add(bird_det)
                    matched_count += 1
                else:
                    # Track unmatched species (avoid duplicates)
                    if det.species not in unmatched:
                        unmatched.append(det.species)

            # Store unmatched species on the recording
            recording.unmatched_species = unmatched if unmatched else None

            # Update recording status
            recording.processing_status = ProcessingStatus.completed
            recording.processing_completed_at = datetime.utcnow()
            db.commit()

            logger.info(
                f"Processed recording {recording_id}: {matched_count} matched detections, "
                f"{len(unmatched)} unmatched species"
            )

    except Exception as e:
        logger.exception(f"Error processing recording {recording_id}")
        try:
            recording = (
                db.query(AudioRecording)
                .filter(AudioRecording.id == recording_id)
                .first()
            )
            if recording:
                recording.processing_status = ProcessingStatus.failed
                recording.processing_error = str(e)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


@router.get("/{survey_id}/audio/{recording_id}", response_model=AudioRecordingRead)
async def get_audio_recording(
    survey_id: int,
    recording_id: int,
    org: Organisation = Depends(get_current_organisation),
    db: Session = Depends(get_db),
):
    """Get details of a specific audio recording."""
    recording = (
        db.query(AudioRecording)
        .join(Survey)
        .filter(
            AudioRecording.id == recording_id,
            AudioRecording.survey_id == survey_id,
            Survey.organisation_id == org.id,
        )
        .first()
    )
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    detection_count = (
        db.query(func.count(BirdDetection.id))
        .filter(BirdDetection.audio_recording_id == recording_id)
        .scalar()
    )

    return _build_recording_response(recording, detection_count)


@router.get(
    "/{survey_id}/audio/{recording_id}/detections",
    response_model=List[BirdDetectionRead],
)
async def get_audio_detections(
    survey_id: int,
    recording_id: int,
    min_confidence: float = 0.0,
    org: Organisation = Depends(get_current_organisation),
    db: Session = Depends(get_db),
):
    """Get bird detections for an audio recording."""
    # Verify access
    recording = (
        db.query(AudioRecording)
        .join(Survey)
        .filter(
            AudioRecording.id == recording_id,
            AudioRecording.survey_id == survey_id,
            Survey.organisation_id == org.id,
        )
        .first()
    )
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    query = db.query(BirdDetection).filter(
        BirdDetection.audio_recording_id == recording_id
    )
    if min_confidence > 0:
        query = query.filter(BirdDetection.confidence >= min_confidence)

    detections = query.order_by(BirdDetection.detection_timestamp).all()

    return [
        {
            "id": d.id,
            "species_name": d.species_name,
            "confidence": d.confidence,
            "start_time": d.start_time,
            "end_time": d.end_time,
            "detection_timestamp": d.detection_timestamp,
            "species_id": d.species_id,
            "species_common_name": None,  # Could be populated if species_id is set
        }
        for d in detections
    ]


@router.get(
    "/{survey_id}/detections/summary",
    response_model=SurveyDetectionsSummaryResponse,
)
async def get_detections_summary(
    survey_id: int,
    org: Organisation = Depends(get_current_organisation),
    db: Session = Depends(get_db),
):
    """
    Get aggregated detection summary for a survey, grouped by species.
    Returns top 3 detections per species sorted by confidence.
    """
    # Verify survey belongs to org
    survey = (
        db.query(Survey)
        .filter(Survey.id == survey_id, Survey.organisation_id == org.id)
        .first()
    )
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")

    # Get all audio recording IDs for this survey
    recording_ids = (
        db.query(AudioRecording.id)
        .filter(AudioRecording.survey_id == survey_id)
        .all()
    )
    recording_ids = [r[0] for r in recording_ids]

    if not recording_ids:
        return SurveyDetectionsSummaryResponse(species_summaries=[])

    # Get all detections grouped by species with counts
    # Using raw SQL for the aggregation
    from sqlalchemy import desc

    # First, get unique species with their detection counts and max confidence
    species_counts = (
        db.query(
            BirdDetection.species_id,
            Species.name.label("species_name"),
            Species.scientific_name.label("species_scientific_name"),
            func.count(BirdDetection.id).label("detection_count"),
            func.max(BirdDetection.confidence).label("max_confidence"),
        )
        .join(Species, BirdDetection.species_id == Species.id)
        .filter(BirdDetection.audio_recording_id.in_(recording_ids))
        .group_by(
            BirdDetection.species_id,
            Species.name,
            Species.scientific_name,
        )
        .order_by(desc("max_confidence"))
        .all()
    )

    summaries = []
    for row in species_counts:
        # Get top 3 detections for this species
        top_detections = (
            db.query(BirdDetection)
            .filter(
                BirdDetection.audio_recording_id.in_(recording_ids),
                BirdDetection.species_id == row.species_id,
            )
            .order_by(desc(BirdDetection.confidence))
            .limit(3)
            .all()
        )

        clips = [
            DetectionClip(
                confidence=det.confidence,
                audio_recording_id=det.audio_recording_id,
                start_time=det.start_time,
                end_time=det.end_time,
            )
            for det in top_detections
        ]

        summaries.append(
            SpeciesDetectionSummary(
                species_id=row.species_id,
                species_name=row.species_name,
                species_scientific_name=row.species_scientific_name,
                detection_count=row.detection_count,
                top_detections=clips,
            )
        )

    return SurveyDetectionsSummaryResponse(species_summaries=summaries)


@router.delete(
    "/{survey_id}/audio/{recording_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
)
async def delete_audio_recording(
    survey_id: int,
    recording_id: int,
    org: Organisation = Depends(get_current_organisation),
    db: Session = Depends(get_db),
):
    """Delete an audio recording and its detections."""
    recording = (
        db.query(AudioRecording)
        .join(Survey)
        .filter(
            AudioRecording.id == recording_id,
            AudioRecording.survey_id == survey_id,
            Survey.organisation_id == org.id,
        )
        .first()
    )
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    # Delete from R2
    delete_audio_file(recording.r2_key)

    # Delete from database (cascades to detections)
    db.delete(recording)
    db.commit()
    return None


# Separate router for download endpoint (different path structure)
download_router = APIRouter()


@download_router.get("/{recording_id}/download")
async def get_download_url(
    recording_id: int,
    org: Organisation = Depends(get_current_organisation),
    db: Session = Depends(get_db),
):
    """Get a presigned URL to download an audio file."""
    recording = (
        db.query(AudioRecording)
        .join(Survey)
        .filter(AudioRecording.id == recording_id, Survey.organisation_id == org.id)
        .first()
    )
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    url = generate_presigned_url(recording.r2_key, expires_in=3600)
    return {"download_url": url, "expires_in": 3600}
