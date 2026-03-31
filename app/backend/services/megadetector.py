"""MegaDetector V6 service for filtering false positive camera trap images."""

import logging
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image

logger = logging.getLogger(__name__)

# MegaDetector detection categories
CATEGORY_ANIMAL = "animal"
CATEGORY_PERSON = "person"
CATEGORY_VEHICLE = "vehicle"

# Confidence threshold for considering a detection valid.
# Deliberately low to avoid filtering real animals.
DETECTION_CONFIDENCE_THRESHOLD = 0.15


@dataclass
class BoundingBox:
    x: float  # normalised 0-1 (left)
    y: float  # normalised 0-1 (top)
    w: float  # normalised 0-1 (width)
    h: float  # normalised 0-1 (height)
    confidence: float
    category: str


@dataclass
class DetectionResult:
    has_animal: bool
    max_animal_confidence: float
    categories_found: list[str]
    boxes: list[BoundingBox]


class MegaDetectorService:
    """MegaDetector V6 for filtering blank/false positive camera trap images."""

    def __init__(self) -> None:
        self.model: Any = None
        self._loaded = False

    def load(self) -> bool:
        if self._loaded:
            return True

        try:
            from PytorchWildlife.models import detection as pw_detection

            logger.info("Loading MegaDetector V6 model...")
            self.model = pw_detection.MegaDetectorV6(version="MDV6-yolov9-c")
            logger.info("MegaDetector V6 loaded successfully")
            self._loaded = True
            return True
        except Exception as e:
            logger.error(f"Failed to load MegaDetector: {e}")
            return False

    def detect(self, image_path: Path) -> DetectionResult:
        """Run MegaDetector on a single image.

        Returns detection result with animal presence and confidence.
        """
        if not self._loaded and not self.load():
            raise RuntimeError("MegaDetector model not loaded")

        try:
            from PytorchWildlife import utils as pw_utils
            import torch
            import numpy as np

            # Load and prepare image
            img = Image.open(image_path).convert("RGB")
            img_array = np.array(img)

            # Run detection
            results = self.model.single_image_detection(img_array)
            img_w, img_h = img.size

            max_animal_conf = 0.0
            categories_found: list[str] = []
            boxes: list[BoundingBox] = []

            # Log full result structure for debugging
            logger.info(
                f"MegaDetector result: type={type(results).__name__}, "
                f"keys={list(results.keys()) if isinstance(results, dict) else 'N/A'}"
            )
            if isinstance(results, dict):
                for k, v in results.items():
                    logger.info(f"  result['{k}']: type={type(v).__name__}, value={repr(v)[:200]}")

            # Extract detections - handle multiple PytorchWildlife output formats
            det_data = None
            labels: list[str] = []

            if isinstance(results, dict):
                det_data = results.get("detections")
                labels = results.get("labels", [])
                # Some versions use "classes" instead of "labels"
                if not labels:
                    labels = results.get("classes", [])
            elif isinstance(results, (list, tuple)) and len(results) >= 2:
                det_data = results[0]
                labels = list(results[1]) if len(results) > 1 else []

            if det_data is not None:
                # Convert to numpy array for uniform handling
                if hasattr(det_data, 'cpu'):
                    det_data = det_data.cpu().numpy()
                det_array = np.atleast_2d(np.array(det_data, dtype=float))

                # Skip if empty (shape (1, 0) or similar)
                if det_array.size > 0 and det_array.shape[-1] >= 5:
                    for i in range(det_array.shape[0]):
                        x1, y1, x2, y2, conf = (
                            float(det_array[i, 0]),
                            float(det_array[i, 1]),
                            float(det_array[i, 2]),
                            float(det_array[i, 3]),
                            float(det_array[i, 4]),
                        )

                        cat_name = str(labels[i]).lower() if i < len(labels) else CATEGORY_ANIMAL

                        if conf >= DETECTION_CONFIDENCE_THRESHOLD:
                            if cat_name not in categories_found:
                                categories_found.append(cat_name)

                            boxes.append(BoundingBox(
                                x=x1 / img_w,
                                y=y1 / img_h,
                                w=(x2 - x1) / img_w,
                                h=(y2 - y1) / img_h,
                                confidence=conf,
                                category=cat_name,
                            ))

                        if cat_name == CATEGORY_ANIMAL and conf > max_animal_conf:
                            max_animal_conf = conf

            has_animal = max_animal_conf >= DETECTION_CONFIDENCE_THRESHOLD

            return DetectionResult(
                has_animal=has_animal,
                max_animal_confidence=max_animal_conf,
                categories_found=categories_found,
                boxes=boxes,
            )

        except Exception as e:
            logger.error(f"MegaDetector detection failed for {image_path}: {e}")
            # Safe default: assume there's an animal so we don't hide real images
            return DetectionResult(
                has_animal=True,
                max_animal_confidence=0.0,
                categories_found=[],
                boxes=[],
            )


_detector: MegaDetectorService | None = None


def get_detector() -> MegaDetectorService:
    global _detector
    if _detector is None:
        _detector = MegaDetectorService()
    return _detector
