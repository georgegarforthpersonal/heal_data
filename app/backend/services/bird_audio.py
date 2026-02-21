import re
from dataclasses import dataclass
from datetime import datetime, time, timedelta
from pathlib import Path

import birdnet

LOCATION_FILTER_THRESHOLD = 0.03
MIN_CONFIDENCE = 0.25


@dataclass
class Detection:
    filename: str
    start: time
    end: time
    species: str
    confidence: float
    timestamp: datetime

    def __str__(self) -> str:
        ts = self.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        return f"{self.filename} [{ts}] ({self.start} - {self.end}) {self.species} ({self.confidence:.1%})"


def _seconds_to_time(seconds: float) -> time:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    return time(hour=hours, minute=minutes, second=secs)


def _extract_recording_timestamp(file: Path) -> datetime:
    match = re.search(r"(\d{8})_(\d{6})", file.name)
    if not match:
        raise ValueError(f"Could not extract timestamp from filename: {file.name}")
    date_str, time_str = match.groups()
    return datetime.strptime(f"{date_str}_{time_str}", "%Y%m%d_%H%M%S")


def get_location_species(lat: float, lon: float) -> list[str]:
    geo_model = birdnet.load("geo", "2.4", "tf")
    predictions = geo_model.predict(lat, lon, min_confidence=LOCATION_FILTER_THRESHOLD)
    return list(predictions.to_set())


def analyze_file(file: Path, species_list: list[str] | None = None) -> list[Detection]:
    recording_time = _extract_recording_timestamp(file)
    model = birdnet.load("acoustic", "2.4", "tf")

    predictions = model.predict(
        file,
        top_k=None,
        sigmoid_sensitivity=1.0,
        default_confidence_threshold=MIN_CONFIDENCE,
        custom_species_list=species_list,
        show_stats="progress",
    )

    return [
        Detection(
            filename=file.name,
            start=_seconds_to_time(float(r["start_time"])),
            end=_seconds_to_time(float(r["end_time"])),
            species=str(r["species_name"]),
            confidence=float(r["confidence"]),
            timestamp=recording_time + timedelta(seconds=float(r["start_time"])),
        )
        for r in predictions.to_structured_array()
    ]
