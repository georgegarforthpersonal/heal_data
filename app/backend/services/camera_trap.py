"""Camera trap image analysis using Google SpeciesNet."""

import json
import logging
import os
import re
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

ALWAYS_REVIEW_SPECIES = {
    "felis silvestris",
    "felis catus",
}


@dataclass
class BoundingBox:
    x_min: float
    y_min: float
    width: float
    height: float

    def to_dict(self) -> dict:
        return {"x_min": self.x_min, "y_min": self.y_min, "width": self.width, "height": self.height}


@dataclass
class Detection:
    category: str
    confidence: float
    bbox: BoundingBox


@dataclass
class Classification:
    scientific_name: str
    common_name: str
    confidence: float
    taxonomic_level: str
    taxonomy: dict = field(default_factory=dict)


@dataclass
class ImageResult:
    filepath: str
    timestamp: datetime | None
    detections: list[Detection]
    classification: Classification | None
    prediction_source: str
    flagged_for_review: bool
    review_reason: str | None
    raw_predictions: dict

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
                {"category": d.category, "confidence": d.confidence, "bbox": d.bbox.to_dict()}
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
    try:
        with Image.open(image_path) as img:
            exif_data = img._getexif()
            if not exif_data:
                return None
            for tag_id, value in exif_data.items():
                tag = TAGS.get(tag_id, tag_id)
                if tag in ("DateTimeOriginal", "DateTime"):
                    return datetime.strptime(value, "%Y:%m:%d %H:%M:%S")
    except Exception:
        pass
    return None


def _extract_timestamp_from_filename(image_path: Path) -> datetime | None:
    patterns = [
        (r"(\d{8})_(\d{6})", lambda g: datetime.strptime(f"{g[0]}_{g[1]}", "%Y%m%d_%H%M%S")),
        (r"(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})", lambda g: datetime(*map(int, g))),
    ]
    for pattern, parser in patterns:
        match = re.search(pattern, image_path.stem)
        if match:
            try:
                return parser(match.groups())
            except ValueError:
                continue
    return None


def _get_image_timestamp(image_path: Path) -> datetime | None:
    return _extract_timestamp_from_exif(image_path) or _extract_timestamp_from_filename(image_path)


def _find_images(directory: Path) -> list[Path]:
    images = []
    for ext in IMAGE_EXTENSIONS:
        images.extend(directory.glob(f"*{ext}"))
        images.extend(directory.glob(f"*{ext.upper()}"))
    return sorted(images)


def _parse_species_label(label: str) -> tuple[str, str, str]:
    if ";" not in label:
        return label, label, "none"
    parts = label.split(";")
    if len(parts) >= 3:
        return parts[1], parts[2], parts[0].lower()
    return label, label, "unknown"


def _should_flag_for_review(
    classification: Classification | None,
    confidence_threshold: float,
    review_threshold: float,
) -> tuple[bool, str | None]:
    if not classification:
        return False, None

    if classification.scientific_name.lower() in ALWAYS_REVIEW_SPECIES:
        return True, "Wildcat/domestic cat confusion risk"

    if classification.confidence < review_threshold:
        return True, f"Very low confidence ({classification.confidence:.1%})"

    if classification.confidence < confidence_threshold:
        return True, f"Low confidence ({classification.confidence:.1%})"

    if classification.taxonomic_level not in ("species", "none") and classification.confidence < 0.9:
        return True, f"Taxonomic rollup to {classification.taxonomic_level}"

    return False, None


def _run_speciesnet(
    image_paths: list[Path],
    country: str = DEFAULT_COUNTRY,
    output_dir: Path | None = None,
) -> dict:
    if not image_paths:
        return {"predictions": []}

    instances = [{"filepath": str(p.resolve()), "country": country} for p in image_paths]

    with tempfile.TemporaryDirectory() as tmpdir:
        input_json = Path(tmpdir) / "input.json"
        output_json = Path(tmpdir) / "output.json"
        input_json.write_text(json.dumps({"instances": instances}))

        cmd = [
            sys.executable, "-m", "speciesnet.scripts.run_model",
            "--instances_json", str(input_json),
            "--predictions_json", str(output_json),
        ]

        logger.info(f"Running SpeciesNet on {len(image_paths)} images...")
        env = {k: v for k, v in os.environ.items() if k != "PYTHONPATH"}
        try:
            subprocess.run(cmd, capture_output=True, text=True, check=True, cwd=tmpdir, env=env)
        except subprocess.CalledProcessError as e:
            logger.error(f"SpeciesNet failed: {e.stderr}")
            raise RuntimeError(f"SpeciesNet processing failed: {e.stderr}") from e

        predictions = json.loads(output_json.read_text())

        if output_dir:
            (output_dir / "speciesnet_raw.json").write_text(json.dumps(predictions, indent=2))
            logger.info(f"Saved raw SpeciesNet output to {output_dir / 'speciesnet_raw.json'}")

        return predictions


def _parse_prediction(pred: dict, image_path: Path) -> ImageResult:
    filepath = pred.get("filepath", str(image_path))
    timestamp = _get_image_timestamp(image_path)

    detections = []
    for det in pred.get("detections", []):
        bbox_data = det.get("bbox", [0, 0, 0, 0])
        detections.append(Detection(
            category=det.get("label", "unknown"),
            confidence=det.get("conf", 0.0),
            bbox=BoundingBox(bbox_data[0], bbox_data[1], bbox_data[2], bbox_data[3]),
        ))

    classification = None
    prediction_label = pred.get("prediction", "")
    if prediction_label and prediction_label not in ("blank", "animal", "human", "vehicle"):
        scientific_name, common_name, taxonomic_level = _parse_species_label(prediction_label)
        classification = Classification(
            scientific_name=scientific_name,
            common_name=common_name,
            confidence=pred.get("prediction_score", 0.0),
            taxonomic_level=taxonomic_level,
        )

    return ImageResult(
        filepath=filepath,
        timestamp=timestamp,
        detections=detections,
        classification=classification,
        prediction_source=pred.get("prediction_source", "unknown"),
        flagged_for_review=False,
        review_reason=None,
        raw_predictions=pred,
    )


def analyze_directory(
    directory: Path,
    country: str = DEFAULT_COUNTRY,
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
    review_threshold: float = DEFAULT_REVIEW_THRESHOLD,
    output_dir: Path | None = None,
) -> list[ImageResult]:
    images = _find_images(directory)
    if not images:
        logger.warning(f"No images found in {directory}")
        return []

    logger.info(f"Found {len(images)} images in {directory}")
    predictions = _run_speciesnet(images, country=country, output_dir=output_dir)
    path_lookup = {str(p.resolve()): p for p in images}

    results = []
    for pred in predictions.get("predictions", []):
        filepath = pred.get("filepath", "")
        image_path = path_lookup.get(filepath, Path(filepath))
        result = _parse_prediction(pred, image_path)
        result.flagged_for_review, result.review_reason = _should_flag_for_review(
            result.classification, confidence_threshold, review_threshold
        )
        results.append(result)

    return results


def aggregate_sequences(results: list[ImageResult], time_window_seconds: int = 60) -> dict[str, list[ImageResult]]:
    if not results:
        return {}

    timestamped = [(r, r.timestamp) for r in results if r.timestamp]
    no_timestamp = [r for r in results if not r.timestamp]
    timestamped.sort(key=lambda x: x[1])

    sequences: dict[str, list[ImageResult]] = {}
    current_sequence: list[ImageResult] = []
    sequence_num = 0

    for result, timestamp in timestamped:
        if not current_sequence:
            current_sequence = [result]
        elif (timestamp - current_sequence[-1].timestamp).total_seconds() <= time_window_seconds:
            current_sequence.append(result)
        else:
            sequences[f"seq_{sequence_num:04d}"] = current_sequence
            sequence_num += 1
            current_sequence = [result]

    if current_sequence:
        sequences[f"seq_{sequence_num:04d}"] = current_sequence

    for i, result in enumerate(no_timestamp):
        sequences[f"no_timestamp_{i:04d}"] = [result]

    return sequences


def get_summary_statistics(results: list[ImageResult]) -> dict:
    species_counts: dict[str, int] = {}
    for result in results:
        if result.classification:
            name = result.classification.scientific_name
            species_counts[name] = species_counts.get(name, 0) + 1

    confidences = [r.classification.confidence for r in results if r.classification]
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

    return {
        "total_images": len(results),
        "images_with_detections": sum(1 for r in results if r.detections),
        "images_with_classifications": sum(1 for r in results if r.classification),
        "images_flagged_for_review": sum(1 for r in results if r.flagged_for_review),
        "species_counts": dict(sorted(species_counts.items(), key=lambda x: -x[1])),
        "average_confidence": avg_confidence,
        "confidence_distribution": {
            "high_90_100": sum(1 for c in confidences if c >= 0.9),
            "medium_70_90": sum(1 for c in confidences if 0.7 <= c < 0.9),
            "low_40_70": sum(1 for c in confidences if 0.4 <= c < 0.7),
            "very_low_0_40": sum(1 for c in confidences if c < 0.4),
        },
    }
