"""
Camera trap image analysis using Google SpeciesNet.

Provides detection and species classification for camera trap images,
with UK geofencing and confidence-based review flagging.
"""

import json
import logging
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from PIL import Image
from PIL.ExifTags import TAGS

logger = logging.getLogger(__name__)

DEFAULT_COUNTRY = "GBR"
DEFAULT_CONFIDENCE_THRESHOLD = 0.7
DEFAULT_REVIEW_THRESHOLD = 0.4
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp"}

# Species that should always be flagged for manual review due to confusion risk
ALWAYS_REVIEW_SPECIES = {
    "felis silvestris",  # Scottish wildcat - easily confused with domestic cat
    "felis catus",  # Domestic cat - flag to check if it's actually a wildcat
}


@dataclass
class BoundingBox:
    """Normalized bounding box coordinates (0-1 range)."""

    x_min: float
    y_min: float
    width: float
    height: float

    def to_dict(self) -> dict:
        return {
            "x_min": self.x_min,
            "y_min": self.y_min,
            "width": self.width,
            "height": self.height,
        }


@dataclass
class Detection:
    """A single detection from MegaDetector."""

    category: str  # "animal", "human", or "vehicle"
    confidence: float
    bbox: BoundingBox


@dataclass
class Classification:
    """Species classification result."""

    scientific_name: str
    common_name: str
    confidence: float
    taxonomic_level: str  # "species", "genus", "family", "order", "class", "kingdom"
    taxonomy: dict = field(default_factory=dict)  # Full taxonomic hierarchy


@dataclass
class ImageResult:
    """Complete analysis result for a single image."""

    filepath: str
    timestamp: datetime | None
    detections: list[Detection]
    classification: Classification | None
    prediction_source: str  # Which model component produced the prediction
    flagged_for_review: bool
    review_reason: str | None
    raw_predictions: dict  # Original SpeciesNet output

    def __str__(self) -> str:
        ts = self.timestamp.strftime("%Y-%m-%d %H:%M:%S") if self.timestamp else "unknown"
        if self.classification:
            status = " [REVIEW]" if self.flagged_for_review else ""
            return (
                f"{Path(self.filepath).name} [{ts}] "
                f"{self.classification.common_name} ({self.classification.scientific_name}) "
                f"({self.classification.confidence:.1%}){status}"
            )
        return f"{Path(self.filepath).name} [{ts}] No species detected"

    def to_dict(self) -> dict:
        return {
            "filepath": self.filepath,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "detections": [
                {
                    "category": d.category,
                    "confidence": d.confidence,
                    "bbox": d.bbox.to_dict(),
                }
                for d in self.detections
            ],
            "classification": (
                {
                    "scientific_name": self.classification.scientific_name,
                    "common_name": self.classification.common_name,
                    "confidence": self.classification.confidence,
                    "taxonomic_level": self.classification.taxonomic_level,
                    "taxonomy": self.classification.taxonomy,
                }
                if self.classification
                else None
            ),
            "prediction_source": self.prediction_source,
            "flagged_for_review": self.flagged_for_review,
            "review_reason": self.review_reason,
        }


def _extract_timestamp_from_exif(image_path: Path) -> datetime | None:
    """Extract capture timestamp from image EXIF data."""
    try:
        with Image.open(image_path) as img:
            exif_data = img._getexif()
            if not exif_data:
                return None

            # Look for DateTimeOriginal or DateTime tags
            for tag_id, value in exif_data.items():
                tag = TAGS.get(tag_id, tag_id)
                if tag in ("DateTimeOriginal", "DateTime"):
                    return datetime.strptime(value, "%Y:%m:%d %H:%M:%S")
    except Exception as e:
        logger.debug(f"Could not extract EXIF timestamp from {image_path}: {e}")
    return None


def _extract_timestamp_from_filename(image_path: Path) -> datetime | None:
    """Extract timestamp from filename patterns like IMG_20240101_120000.jpg."""
    import re

    patterns = [
        r"(\d{8})_(\d{6})",  # YYYYMMDD_HHMMSS
        r"(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})",  # YYYY-MM-DD_HH-MM-SS
        r"(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})",  # YYYYMMDDHHMMSS
    ]

    filename = image_path.stem
    for pattern in patterns:
        match = re.search(pattern, filename)
        if match:
            try:
                groups = match.groups()
                if len(groups) == 2:  # YYYYMMDD_HHMMSS
                    return datetime.strptime(f"{groups[0]}_{groups[1]}", "%Y%m%d_%H%M%S")
                elif len(groups) == 6:  # All separate components
                    return datetime(
                        int(groups[0]),
                        int(groups[1]),
                        int(groups[2]),
                        int(groups[3]),
                        int(groups[4]),
                        int(groups[5]),
                    )
            except ValueError:
                continue
    return None


def get_image_timestamp(image_path: Path) -> datetime | None:
    """Get timestamp from EXIF or filename."""
    timestamp = _extract_timestamp_from_exif(image_path)
    if not timestamp:
        timestamp = _extract_timestamp_from_filename(image_path)
    return timestamp


def find_images(directory: Path) -> list[Path]:
    """Find all supported image files in a directory."""
    images = []
    for ext in IMAGE_EXTENSIONS:
        images.extend(directory.glob(f"*{ext}"))
        images.extend(directory.glob(f"*{ext.upper()}"))
    return sorted(images)


def _parse_species_label(label: str) -> tuple[str, str, str]:
    """
    Parse SpeciesNet label into (scientific_name, common_name, taxonomic_level).

    Labels can be:
    - "species;genus species;common name" (species level)
    - "genus;genus;genus name" (genus level rollup)
    - "family;family_name;family common" (family level rollup)
    - "blank" / "animal" / "human" / "vehicle" (non-species)
    """
    if ";" not in label:
        # Non-species labels like "blank", "animal", "human", "vehicle"
        return label, label, "none"

    parts = label.split(";")
    if len(parts) >= 3:
        taxonomic_level = parts[0].lower()
        scientific_name = parts[1]
        common_name = parts[2]
        return scientific_name, common_name, taxonomic_level

    return label, label, "unknown"


def _should_flag_for_review(
    classification: Classification | None,
    confidence_threshold: float,
    review_threshold: float,
) -> tuple[bool, str | None]:
    """Determine if result should be flagged for manual review."""
    if not classification:
        return False, None

    scientific_lower = classification.scientific_name.lower()

    # Always review wildcats/domestic cats
    if scientific_lower in ALWAYS_REVIEW_SPECIES:
        return True, "Wildcat/domestic cat confusion risk - requires expert verification"

    # Below review threshold
    if classification.confidence < review_threshold:
        return True, f"Very low confidence ({classification.confidence:.1%})"

    # Between review and confidence threshold
    if classification.confidence < confidence_threshold:
        return True, f"Low confidence ({classification.confidence:.1%})"

    # Higher taxonomic level with moderate confidence
    if classification.taxonomic_level not in ("species", "none") and classification.confidence < 0.9:
        return (
            True,
            f"Taxonomic rollup to {classification.taxonomic_level} level",
        )

    return False, None


def run_speciesnet(
    image_paths: list[Path],
    country: str = DEFAULT_COUNTRY,
    output_dir: Path | None = None,
) -> dict:
    """
    Run SpeciesNet ensemble on a list of images.

    Returns the raw predictions JSON from SpeciesNet.
    """
    if not image_paths:
        return {"predictions": []}

    # Create input JSON for SpeciesNet
    instances = [{"filepath": str(p.resolve()), "country": country} for p in image_paths]

    with tempfile.TemporaryDirectory() as tmpdir:
        input_json = Path(tmpdir) / "input.json"
        output_json = Path(tmpdir) / "output.json"

        input_json.write_text(json.dumps({"instances": instances}))

        cmd = [
            sys.executable,
            "-m",
            "speciesnet.scripts.run_model",
            "--instances_json",
            str(input_json),
            "--predictions_json",
            str(output_json),
        ]

        logger.info(f"Running SpeciesNet on {len(image_paths)} images...")
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True,
            )
            if result.stderr:
                logger.debug(f"SpeciesNet stderr: {result.stderr}")
        except subprocess.CalledProcessError as e:
            logger.error(f"SpeciesNet failed: {e.stderr}")
            raise RuntimeError(f"SpeciesNet processing failed: {e.stderr}") from e

        predictions = json.loads(output_json.read_text())

        # Optionally save raw output
        if output_dir:
            raw_output = output_dir / "speciesnet_raw.json"
            raw_output.write_text(json.dumps(predictions, indent=2))
            logger.info(f"Saved raw SpeciesNet output to {raw_output}")

        return predictions


def _parse_prediction(pred: dict, image_path: Path) -> ImageResult:
    """Parse a single SpeciesNet prediction into an ImageResult."""
    filepath = pred.get("filepath", str(image_path))
    timestamp = get_image_timestamp(image_path)

    # Parse detections
    detections = []
    for det in pred.get("detections", []):
        bbox_data = det.get("bbox", [0, 0, 0, 0])
        detections.append(
            Detection(
                category=det.get("label", "unknown"),
                confidence=det.get("conf", 0.0),
                bbox=BoundingBox(
                    x_min=bbox_data[0],
                    y_min=bbox_data[1],
                    width=bbox_data[2],
                    height=bbox_data[3],
                ),
            )
        )

    # Parse classification
    classification = None
    prediction_label = pred.get("prediction", "")
    prediction_score = pred.get("prediction_score", 0.0)

    if prediction_label and prediction_label not in ("blank", "animal", "human", "vehicle"):
        scientific_name, common_name, taxonomic_level = _parse_species_label(prediction_label)
        classification = Classification(
            scientific_name=scientific_name,
            common_name=common_name,
            confidence=prediction_score,
            taxonomic_level=taxonomic_level,
            taxonomy={},  # Could be enriched from external taxonomy DB
        )

    prediction_source = pred.get("prediction_source", "unknown")

    return ImageResult(
        filepath=filepath,
        timestamp=timestamp,
        detections=detections,
        classification=classification,
        prediction_source=prediction_source,
        flagged_for_review=False,  # Will be set by caller
        review_reason=None,
        raw_predictions=pred,
    )


def analyze_images(
    image_paths: list[Path],
    country: str = DEFAULT_COUNTRY,
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
    review_threshold: float = DEFAULT_REVIEW_THRESHOLD,
    output_dir: Path | None = None,
) -> list[ImageResult]:
    """
    Analyze a list of camera trap images.

    Args:
        image_paths: List of image file paths to analyze
        country: ISO 3166-1 alpha-3 country code for geofencing
        confidence_threshold: Minimum confidence to auto-accept classification
        review_threshold: Below this confidence, flag for manual review
        output_dir: Optional directory to save intermediate outputs

    Returns:
        List of ImageResult objects with detections and classifications
    """
    if not image_paths:
        return []

    predictions = run_speciesnet(image_paths, country=country, output_dir=output_dir)

    # Build filepath lookup for matching predictions to paths
    path_lookup = {str(p.resolve()): p for p in image_paths}

    results = []
    for pred in predictions.get("predictions", []):
        filepath = pred.get("filepath", "")
        image_path = path_lookup.get(filepath, Path(filepath))

        result = _parse_prediction(pred, image_path)

        # Determine if review is needed
        flagged, reason = _should_flag_for_review(
            result.classification,
            confidence_threshold,
            review_threshold,
        )
        result.flagged_for_review = flagged
        result.review_reason = reason

        results.append(result)

    return results


def analyze_directory(
    directory: Path,
    country: str = DEFAULT_COUNTRY,
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
    review_threshold: float = DEFAULT_REVIEW_THRESHOLD,
    output_dir: Path | None = None,
) -> list[ImageResult]:
    """
    Analyze all images in a directory.

    Args:
        directory: Directory containing camera trap images
        country: ISO 3166-1 alpha-3 country code for geofencing
        confidence_threshold: Minimum confidence to auto-accept classification
        review_threshold: Below this confidence, flag for manual review
        output_dir: Optional directory to save outputs

    Returns:
        List of ImageResult objects
    """
    images = find_images(directory)
    if not images:
        logger.warning(f"No images found in {directory}")
        return []

    logger.info(f"Found {len(images)} images in {directory}")
    return analyze_images(
        images,
        country=country,
        confidence_threshold=confidence_threshold,
        review_threshold=review_threshold,
        output_dir=output_dir,
    )


def aggregate_sequences(
    results: list[ImageResult],
    time_window_seconds: int = 60,
) -> dict[str, list[ImageResult]]:
    """
    Group results into trigger sequences based on timestamps.

    Images within the time window of each other are considered part of
    the same trigger event (e.g., burst mode captures).

    Args:
        results: List of ImageResult objects
        time_window_seconds: Maximum gap between images in same sequence

    Returns:
        Dict mapping sequence ID to list of ImageResults
    """
    if not results:
        return {}

    # Sort by timestamp
    timestamped = [(r, r.timestamp) for r in results if r.timestamp]
    no_timestamp = [r for r in results if not r.timestamp]

    timestamped.sort(key=lambda x: x[1])

    sequences: dict[str, list[ImageResult]] = {}
    current_sequence: list[ImageResult] = []
    sequence_num = 0

    for result, timestamp in timestamped:
        if not current_sequence:
            current_sequence = [result]
        else:
            last_timestamp = current_sequence[-1].timestamp
            if last_timestamp and (timestamp - last_timestamp).total_seconds() <= time_window_seconds:
                current_sequence.append(result)
            else:
                # Start new sequence
                sequences[f"seq_{sequence_num:04d}"] = current_sequence
                sequence_num += 1
                current_sequence = [result]

    # Don't forget last sequence
    if current_sequence:
        sequences[f"seq_{sequence_num:04d}"] = current_sequence

    # Add images without timestamps as individual "sequences"
    for i, result in enumerate(no_timestamp):
        sequences[f"no_timestamp_{i:04d}"] = [result]

    return sequences


def get_summary_statistics(results: list[ImageResult]) -> dict:
    """
    Generate summary statistics from analysis results.

    Returns dict with species counts, confidence distribution, review counts, etc.
    """
    total = len(results)
    with_detection = sum(1 for r in results if r.detections)
    with_classification = sum(1 for r in results if r.classification)
    flagged = sum(1 for r in results if r.flagged_for_review)

    # Species counts
    species_counts: dict[str, int] = {}
    for result in results:
        if result.classification:
            name = result.classification.scientific_name
            species_counts[name] = species_counts.get(name, 0) + 1

    # Confidence distribution
    confidences = [r.classification.confidence for r in results if r.classification]
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

    return {
        "total_images": total,
        "images_with_detections": with_detection,
        "images_with_classifications": with_classification,
        "images_flagged_for_review": flagged,
        "species_counts": dict(sorted(species_counts.items(), key=lambda x: -x[1])),
        "average_confidence": avg_confidence,
        "confidence_distribution": {
            "high_90_100": sum(1 for c in confidences if c >= 0.9),
            "medium_70_90": sum(1 for c in confidences if 0.7 <= c < 0.9),
            "low_40_70": sum(1 for c in confidences if 0.4 <= c < 0.7),
            "very_low_0_40": sum(1 for c in confidences if c < 0.4),
        },
    }
