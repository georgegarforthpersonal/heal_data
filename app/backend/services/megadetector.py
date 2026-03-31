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
class DetectionResult:
    has_animal: bool
    max_animal_confidence: float
    categories_found: list[str]


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
            self.model = pw_detection.MegaDetectorV6()
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

            max_animal_conf = 0.0
            categories_found: list[str] = []

            if results and "detections" in results:
                for det in results["detections"]:
                    conf = det.get("conf", 0.0)
                    category = det.get("category", "")

                    # Map category IDs to names
                    # MegaDetector categories: 1=animal, 2=person, 3=vehicle
                    cat_name = {
                        "1": CATEGORY_ANIMAL,
                        "2": CATEGORY_PERSON,
                        "3": CATEGORY_VEHICLE,
                    }.get(str(category), str(category))

                    if conf >= DETECTION_CONFIDENCE_THRESHOLD:
                        if cat_name not in categories_found:
                            categories_found.append(cat_name)

                    if cat_name == CATEGORY_ANIMAL and conf > max_animal_conf:
                        max_animal_conf = conf

            has_animal = max_animal_conf >= DETECTION_CONFIDENCE_THRESHOLD

            return DetectionResult(
                has_animal=has_animal,
                max_animal_confidence=max_animal_conf,
                categories_found=categories_found,
            )

        except Exception as e:
            logger.error(f"MegaDetector detection failed for {image_path}: {e}")
            # Safe default: assume there's an animal so we don't hide real images
            return DetectionResult(
                has_animal=True,
                max_animal_confidence=0.0,
                categories_found=[],
            )


_detector: MegaDetectorService | None = None


def get_detector() -> MegaDetectorService:
    global _detector
    if _detector is None:
        _detector = MegaDetectorService()
    return _detector
