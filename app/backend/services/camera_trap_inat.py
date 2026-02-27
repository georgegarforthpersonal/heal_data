"""Camera trap image analysis using iNaturalist EVA02 model.

This module provides species classification for camera trap images using
the EVA02 model fine-tuned on iNaturalist 2021 dataset (10,000 species).
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

from PIL import Image
from PIL.ExifTags import TAGS
import re

logger = logging.getLogger(__name__)

DEFAULT_CONFIDENCE_THRESHOLD = 0.7
DEFAULT_REVIEW_THRESHOLD = 0.4
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp"}

ALWAYS_REVIEW_SPECIES = {
    "felis silvestris",
    "felis catus",
}


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
    classification: Classification | None
    prediction_source: str
    flagged_for_review: bool
    review_reason: str | None
    top_predictions: list[dict]

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
            "top_predictions": self.top_predictions,
        }


class INaturalistClassifier:
    """iNaturalist species classifier using EVA02 model."""

    MODEL_NAME = "hf-hub:timm/eva02_large_patch14_clip_336.merged2b_ft_inat21"

    def __init__(self):
        self.model = None
        self.transform = None
        self.label_names = None
        self.label_descriptions = None  # Maps scientific name -> "Common Name, Category"
        self._loaded = False

    def load(self) -> bool:
        """Load the model. Returns True if successful."""
        if self._loaded:
            return True

        try:
            import timm
            import torch

            logger.info(f"Loading iNaturalist model: {self.MODEL_NAME}...")

            self.model = timm.create_model(
                self.MODEL_NAME,
                pretrained=True,
            )
            self.model.eval()

            # Get model's default transforms
            data_config = timm.data.resolve_model_data_config(self.model)
            self.transform = timm.data.create_transform(**data_config, is_training=False)

            # Get labels from model config
            cfg = self.model.pretrained_cfg
            self.label_names = cfg.get("label_names", [])
            self.label_descriptions = cfg.get("label_descriptions", {})  # scientific -> "Common Name, Category"

            logger.info(f"iNaturalist model loaded ({len(self.label_names)} species)")
            self._loaded = True
            return True
        except Exception as e:
            logger.error(f"Failed to load iNaturalist model: {e}")
            return False

    def predict(self, image_path: Path, top_k: int = 5) -> tuple[list[dict], dict]:
        """
        Predict species for an image.

        Returns:
            tuple: (list of top predictions, raw output dict)
        """
        if not self._loaded:
            if not self.load():
                return [], {}

        import torch

        try:
            image = Image.open(image_path).convert("RGB")
            img_tensor = self.transform(image).unsqueeze(0)

            with torch.no_grad():
                outputs = self.model(img_tensor)

            probs = torch.nn.functional.softmax(outputs, dim=-1)
            top_probs, top_indices = probs[0].topk(top_k)

            predictions = []
            for prob, idx in zip(top_probs, top_indices):
                idx_val = idx.item()
                if idx_val < len(self.label_names):
                    scientific_name = self.label_names[idx_val]
                else:
                    scientific_name = f"iNat_class_{idx_val}"

                # Get common name from descriptions dict
                # Format is "Common Name, Category" (e.g., "European Turtle Dove, Bird")
                description = self.label_descriptions.get(scientific_name, "")
                common_name = description.split(",")[0].strip() if description else scientific_name

                predictions.append({
                    "scientific_name": scientific_name,
                    "common_name": common_name,
                    "confidence": prob.item(),
                    "class_index": idx_val,
                })

            raw_output = {
                "top_predictions": predictions,
                "model": self.MODEL_NAME,
            }

            return predictions, raw_output

        except Exception as e:
            logger.error(f"Prediction failed for {image_path}: {e}")
            return [], {"error": str(e)}


# Global classifier instance
_classifier: Optional[INaturalistClassifier] = None


def get_classifier() -> INaturalistClassifier:
    """Get or create the global classifier instance."""
    global _classifier
    if _classifier is None:
        _classifier = INaturalistClassifier()
    return _classifier


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

    return False, None


def analyze_image(
    image_path: Path,
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
    review_threshold: float = DEFAULT_REVIEW_THRESHOLD,
) -> ImageResult:
    """Analyze a single image."""
    classifier = get_classifier()
    timestamp = _get_image_timestamp(image_path)

    predictions, raw_output = classifier.predict(image_path)

    classification = None
    if predictions:
        top = predictions[0]
        classification = Classification(
            scientific_name=top["scientific_name"],
            common_name=top["common_name"],
            confidence=top["confidence"],
            taxonomic_level="species",
        )

    flagged, reason = _should_flag_for_review(classification, confidence_threshold, review_threshold)

    return ImageResult(
        filepath=str(image_path),
        timestamp=timestamp,
        classification=classification,
        prediction_source="iNaturalist-EVA02",
        flagged_for_review=flagged,
        review_reason=reason,
        top_predictions=predictions,
    )


def analyze_directory(
    directory: Path,
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
    review_threshold: float = DEFAULT_REVIEW_THRESHOLD,
    output_dir: Path | None = None,
) -> list[ImageResult]:
    """Analyze all images in a directory."""
    images = _find_images(directory)
    if not images:
        logger.warning(f"No images found in {directory}")
        return []

    logger.info(f"Found {len(images)} images in {directory}")

    # Ensure model is loaded
    classifier = get_classifier()
    if not classifier.load():
        raise RuntimeError("Failed to load iNaturalist model")

    results = []
    for i, image_path in enumerate(images):
        logger.info(f"Processing {i + 1}/{len(images)}: {image_path.name}")
        result = analyze_image(image_path, confidence_threshold, review_threshold)
        results.append(result)

    return results


def aggregate_sequences(results: list[ImageResult], time_window_seconds: int = 60) -> dict[str, list[ImageResult]]:
    """Group results into sequences based on timestamp proximity."""
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
    """Calculate summary statistics for results."""
    species_counts: dict[str, int] = {}
    for result in results:
        if result.classification:
            name = result.classification.scientific_name
            species_counts[name] = species_counts.get(name, 0) + 1

    confidences = [r.classification.confidence for r in results if r.classification]
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

    return {
        "total_images": len(results),
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
