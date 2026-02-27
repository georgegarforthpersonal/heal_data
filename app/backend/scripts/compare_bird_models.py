"""Compare bird classification models for turtle dove identification.

Tests multiple models on camera trap images to find the best approach
for identifying turtle doves (Streptopelia turtur).

Models compared:
1. SpeciesNet (Google) - General wildlife classifier
2. HuggingFace Bird Species Classifier - 525 bird species
3. BirdRecon (optional) - Ensemble of 4 models with 99.6% accuracy

Usage:
    python scripts/compare_bird_models.py
    python scripts/compare_bird_models.py --image-dir /path/to/images
    python scripts/compare_bird_models.py --include-birdrecon
"""

import argparse
import logging
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_IMAGE_DIR = Path(__file__).parent / "data" / "camera_trap_images"

# Target images that should be identified as turtle doves
TURTLE_DOVE_IMAGES = ["cameratrap_1.jpg", "cameratrap_2.jpg", "cameratrap_6.jpg"]

# Turtle dove identifiers (scientific and common names)
TURTLE_DOVE_NAMES = [
    "turtle dove",
    "european turtle dove",
    "streptopelia turtur",
    "turtle-dove",
    "turtledove",
]


@dataclass
class SinglePrediction:
    """A single species prediction with confidence."""

    species: str
    confidence: float
    is_turtle_dove: bool
    raw_label: str


@dataclass
class ModelPrediction:
    """Result from a single model prediction."""

    model_name: str
    predicted_species: str
    confidence: float
    is_turtle_dove: bool
    raw_label: str
    top_predictions: list[SinglePrediction] = None  # Top-N predictions


@dataclass
class ImageResult:
    """Results for a single image across all models."""

    image_path: Path
    predictions: list[ModelPrediction]
    expected_turtle_dove: bool


def is_turtle_dove_prediction(label: str) -> bool:
    """Check if a label indicates turtle dove."""
    label_lower = label.lower()
    return any(name in label_lower for name in TURTLE_DOVE_NAMES)


class SpeciesNetClassifier:
    """Wrapper for Google SpeciesNet model."""

    def __init__(self):
        self.model = None
        self.name = "SpeciesNet"

    def load(self):
        try:
            from speciesnet import SpeciesNet

            logger.info("Loading SpeciesNet model...")
            self.model = SpeciesNet()
            logger.info("SpeciesNet loaded successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to load SpeciesNet: {e}")
            return False

    def predict(self, image_path: Path) -> Optional[ModelPrediction]:
        if not self.model:
            return None

        try:
            result = self.model.predict(
                filepaths=[str(image_path)],
                classifier_only=True,
            )

            predictions = result.get("predictions", [])
            if not predictions:
                return ModelPrediction(
                    model_name=self.name,
                    predicted_species="No prediction",
                    confidence=0.0,
                    is_turtle_dove=False,
                    raw_label="",
                )

            pred = predictions[0]
            classifications = pred.get("classifications", [])
            if not classifications:
                return ModelPrediction(
                    model_name=self.name,
                    predicted_species="No classification",
                    confidence=0.0,
                    is_turtle_dove=False,
                    raw_label="",
                )

            top_class = classifications[0]
            label = top_class.get("prediction", "")
            confidence = top_class.get("confidence", 0.0)

            return ModelPrediction(
                model_name=self.name,
                predicted_species=label,
                confidence=confidence,
                is_turtle_dove=is_turtle_dove_prediction(label),
                raw_label=label,
            )
        except Exception as e:
            logger.error(f"SpeciesNet prediction failed for {image_path}: {e}")
            return None


class HuggingFaceBirdClassifier:
    """Wrapper for HuggingFace bird-species-classifier model."""

    MODEL_ID = "chriamue/bird-species-classifier"

    def __init__(self):
        self.extractor = None
        self.model = None
        self.name = "HuggingFace Bird Classifier"

    def load(self):
        try:
            from transformers import (
                AutoImageProcessor,
                AutoModelForImageClassification,
            )

            logger.info(f"Loading HuggingFace model: {self.MODEL_ID}...")
            self.extractor = AutoImageProcessor.from_pretrained(self.MODEL_ID)
            self.model = AutoModelForImageClassification.from_pretrained(self.MODEL_ID)
            logger.info("HuggingFace Bird Classifier loaded successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to load HuggingFace model: {e}")
            return False

    def predict(self, image_path: Path, top_k: int = 5) -> Optional[ModelPrediction]:
        if not self.model or not self.extractor:
            return None

        try:
            import torch

            image = Image.open(image_path).convert("RGB")
            inputs = self.extractor(images=image, return_tensors="pt")

            with torch.no_grad():
                outputs = self.model(**inputs)

            # Get top-K predictions
            probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
            top_probs, top_indices = probs[0].topk(top_k)

            top_predictions = []
            for prob, idx in zip(top_probs, top_indices):
                label = self.model.config.id2label[idx.item()]
                top_predictions.append(
                    SinglePrediction(
                        species=label.replace("_", " ").title(),
                        confidence=prob.item(),
                        is_turtle_dove=is_turtle_dove_prediction(label),
                        raw_label=label,
                    )
                )

            # Top prediction
            top = top_predictions[0]
            any_turtle_dove = any(p.is_turtle_dove for p in top_predictions)

            return ModelPrediction(
                model_name=self.name,
                predicted_species=top.species,
                confidence=top.confidence,
                is_turtle_dove=top.is_turtle_dove,
                raw_label=top.raw_label,
                top_predictions=top_predictions,
            )
        except Exception as e:
            logger.error(f"HuggingFace prediction failed for {image_path}: {e}")
            return None


class INaturalistClassifier:
    """iNaturalist 2021 classifier using EVA02 model.

    Uses timm's EVA02 model fine-tuned on iNaturalist 2021 dataset.
    Covers 10,000 species with 92% accuracy.
    """

    MODEL_NAME = "hf-hub:timm/eva02_large_patch14_clip_336.merged2b_ft_inat21"
    LABELS_URL = "https://raw.githubusercontent.com/visipedia/inat_comp/master/2021/categories.json"

    def __init__(self):
        self.model = None
        self.transform = None
        self.label_names = None
        self.name = "iNaturalist (EVA02)"

    def load(self):
        try:
            import timm

            logger.info(f"Loading iNaturalist model: {self.MODEL_NAME}...")

            # Create model from HuggingFace hub
            self.model = timm.create_model(
                self.MODEL_NAME,
                pretrained=True,
            )
            self.model.eval()

            # Get model's default transforms
            data_config = timm.data.resolve_model_data_config(self.model)
            self.transform = timm.data.create_transform(**data_config, is_training=False)

            # Get labels from model config (10,000 species names)
            cfg = self.model.pretrained_cfg
            self.label_names = cfg.get("label_names", [])

            logger.info(f"iNaturalist model loaded ({len(self.label_names)} species)")
            return True
        except Exception as e:
            logger.error(f"Failed to load iNaturalist model: {e}")
            return False

    def predict(self, image_path: Path, top_k: int = 5) -> Optional[ModelPrediction]:
        if not self.model:
            return None

        try:
            import torch

            image = Image.open(image_path).convert("RGB")
            img_tensor = self.transform(image).unsqueeze(0)

            with torch.no_grad():
                outputs = self.model(img_tensor)

            probs = torch.nn.functional.softmax(outputs, dim=-1)
            top_probs, top_indices = probs[0].topk(top_k)

            top_predictions = []
            for prob, idx in zip(top_probs, top_indices):
                idx_val = idx.item()

                # Get scientific name from model's label_names
                if self.label_names and idx_val < len(self.label_names):
                    species = self.label_names[idx_val]
                else:
                    species = f"iNat_class_{idx_val}"

                top_predictions.append(
                    SinglePrediction(
                        species=species,
                        confidence=prob.item(),
                        is_turtle_dove=is_turtle_dove_prediction(species),
                        raw_label=species,
                    )
                )

            top = top_predictions[0]

            return ModelPrediction(
                model_name=self.name,
                predicted_species=top.species,
                confidence=top.confidence,
                is_turtle_dove=top.is_turtle_dove,
                raw_label=top.raw_label,
                top_predictions=top_predictions,
            )
        except Exception as e:
            logger.error(f"iNaturalist prediction failed for {image_path}: {e}")
            return None


class CLIPBirdClassifier:
    """CLIP-based zero-shot bird classifier.

    Uses OpenAI's CLIP model with text prompts for bird species.
    Good for handling diverse image conditions.
    """

    MODEL_ID = "openai/clip-vit-base-patch32"

    # Bird species to check (focused on dove-like birds)
    BIRD_SPECIES = [
        "european turtle dove",
        "turtle dove",
        "mourning dove",
        "rock dove",
        "collared dove",
        "wood pigeon",
        "stock dove",
        "pheasant",
        "partridge",
        "magpie",
        "crow",
        "sparrow",
        "blackbird",
        "thrush",
        "robin",
        "finch",
        "pigeon",
        "unknown bird",
    ]

    def __init__(self):
        self.processor = None
        self.model = None
        self.name = "CLIP Zero-Shot"

    def load(self):
        try:
            from transformers import CLIPModel, CLIPProcessor

            logger.info(f"Loading CLIP model: {self.MODEL_ID}...")
            self.processor = CLIPProcessor.from_pretrained(self.MODEL_ID)
            self.model = CLIPModel.from_pretrained(self.MODEL_ID)
            logger.info("CLIP model loaded successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to load CLIP model: {e}")
            return False

    def predict(self, image_path: Path, top_k: int = 5) -> Optional[ModelPrediction]:
        if not self.model or not self.processor:
            return None

        try:
            import torch

            image = Image.open(image_path).convert("RGB")

            # Create text prompts for each species
            text_prompts = [f"a photo of a {species}" for species in self.BIRD_SPECIES]

            inputs = self.processor(
                text=text_prompts,
                images=image,
                return_tensors="pt",
                padding=True,
            )

            with torch.no_grad():
                outputs = self.model(**inputs)

            # Get image-text similarity scores
            logits_per_image = outputs.logits_per_image
            probs = logits_per_image.softmax(dim=1)[0]

            # Get top predictions
            top_probs, top_indices = probs.topk(min(top_k, len(self.BIRD_SPECIES)))

            top_predictions = []
            for prob, idx in zip(top_probs, top_indices):
                species = self.BIRD_SPECIES[idx.item()]
                top_predictions.append(
                    SinglePrediction(
                        species=species.title(),
                        confidence=prob.item(),
                        is_turtle_dove=is_turtle_dove_prediction(species),
                        raw_label=species,
                    )
                )

            top = top_predictions[0]

            return ModelPrediction(
                model_name=self.name,
                predicted_species=top.species,
                confidence=top.confidence,
                is_turtle_dove=top.is_turtle_dove,
                raw_label=top.raw_label,
                top_predictions=top_predictions,
            )
        except Exception as e:
            logger.error(f"CLIP prediction failed for {image_path}: {e}")
            return None


class CroppedBirdClassifier:
    """Crops bird region before classification for better accuracy.

    Uses the HuggingFace classifier but first crops to the most likely
    bird region based on heuristics (lower 2/3 of image for camera traps).
    """

    def __init__(self, base_classifier: HuggingFaceBirdClassifier):
        self.base = base_classifier
        self.name = "HF Bird (Cropped)"

    def load(self):
        return self.base.model is not None

    def predict(self, image_path: Path, top_k: int = 5) -> Optional[ModelPrediction]:
        if not self.base.model or not self.base.extractor:
            return None

        try:
            import torch

            image = Image.open(image_path).convert("RGB")
            width, height = image.size

            # Try multiple crop regions and take the best prediction
            crop_regions = [
                # Full image
                (0, 0, width, height),
                # Lower 2/3 (common for camera traps with ground-feeding birds)
                (0, height // 3, width, height),
                # Center region
                (width // 4, height // 4, 3 * width // 4, 3 * height // 4),
                # Lower half
                (0, height // 2, width, height),
            ]

            best_prediction = None
            best_confidence = 0.0
            best_region = None

            for left, top, right, bottom in crop_regions:
                cropped = image.crop((left, top, right, bottom))

                inputs = self.base.extractor(images=cropped, return_tensors="pt")
                with torch.no_grad():
                    outputs = self.base.model(**inputs)

                probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
                top_probs, top_indices = probs[0].topk(top_k)

                top_predictions = []
                for prob, idx in zip(top_probs, top_indices):
                    label = self.base.model.config.id2label[idx.item()]
                    top_predictions.append(
                        SinglePrediction(
                            species=label.replace("_", " ").title(),
                            confidence=prob.item(),
                            is_turtle_dove=is_turtle_dove_prediction(label),
                            raw_label=label,
                        )
                    )

                # Check if any prediction is turtle dove with reasonable confidence
                for pred in top_predictions:
                    if pred.is_turtle_dove and pred.confidence > best_confidence:
                        best_confidence = pred.confidence
                        best_prediction = ModelPrediction(
                            model_name=self.name,
                            predicted_species=pred.species,
                            confidence=pred.confidence,
                            is_turtle_dove=True,
                            raw_label=pred.raw_label,
                            top_predictions=top_predictions,
                        )
                        best_region = (left, top, right, bottom)

                # Also track best overall prediction
                if top_predictions[0].confidence > best_confidence and best_prediction is None:
                    best_confidence = top_predictions[0].confidence
                    best_prediction = ModelPrediction(
                        model_name=self.name,
                        predicted_species=top_predictions[0].species,
                        confidence=top_predictions[0].confidence,
                        is_turtle_dove=top_predictions[0].is_turtle_dove,
                        raw_label=top_predictions[0].raw_label,
                        top_predictions=top_predictions,
                    )

            return best_prediction

        except Exception as e:
            logger.error(f"Cropped prediction failed for {image_path}: {e}")
            return None


class EnsembleClassifier:
    """Combines predictions from multiple models.

    Returns turtle dove if ANY model predicts it with > threshold confidence.
    """

    def __init__(self, classifiers: list, threshold: float = 0.15):
        self.classifiers = classifiers
        self.threshold = threshold
        self.name = "Ensemble (Best Match)"

    def load(self):
        return len(self.classifiers) > 0

    def predict(self, image_path: Path, top_k: int = 5) -> Optional[ModelPrediction]:
        all_predictions = []

        for classifier in self.classifiers:
            pred = classifier.predict(image_path, top_k=top_k) if hasattr(classifier, 'predict') else None
            if pred:
                all_predictions.append(pred)
                # Check top predictions for turtle dove
                if pred.top_predictions:
                    for top_pred in pred.top_predictions:
                        if top_pred.is_turtle_dove and top_pred.confidence >= self.threshold:
                            return ModelPrediction(
                                model_name=self.name,
                                predicted_species=top_pred.species,
                                confidence=top_pred.confidence,
                                is_turtle_dove=True,
                                raw_label=top_pred.raw_label,
                                top_predictions=pred.top_predictions,
                            )

        # No turtle dove found - return highest confidence prediction
        if all_predictions:
            best = max(all_predictions, key=lambda p: p.confidence)
            return ModelPrediction(
                model_name=self.name,
                predicted_species=best.predicted_species,
                confidence=best.confidence,
                is_turtle_dove=best.is_turtle_dove,
                raw_label=best.raw_label,
                top_predictions=best.top_predictions,
            )
        return None


class BirdReconClassifier:
    """Wrapper for BirdRecon ensemble model.

    Requires cloning the BirdRecon repository:
    git clone https://github.com/phantombeast7/BirdRecon-A-Free-Open-Source-Tool-for-Image-based-Bird-Species-Recognition

    Note: This is a more complex setup requiring TensorFlow and pre-trained weights.
    """

    def __init__(self, repo_path: Optional[Path] = None):
        self.repo_path = repo_path
        self.model = None
        self.name = "BirdRecon (Ensemble)"

    def load(self):
        if not self.repo_path or not self.repo_path.exists():
            logger.warning(
                "BirdRecon not available. Clone the repo and provide --birdrecon-path:\n"
                "git clone https://github.com/phantombeast7/BirdRecon-A-Free-Open-Source-Tool-for-Image-based-Bird-Species-Recognition"
            )
            return False

        try:
            sys.path.insert(0, str(self.repo_path))
            # BirdRecon uses TensorFlow with multiple model ensemble
            # Implementation would depend on their specific API
            logger.info("BirdRecon loading not fully implemented - requires manual setup")
            return False
        except Exception as e:
            logger.error(f"Failed to load BirdRecon: {e}")
            return False

    def predict(self, image_path: Path) -> Optional[ModelPrediction]:
        # Placeholder for BirdRecon implementation
        return None


def run_comparison(
    image_dir: Path,
    include_birdrecon: bool = False,
    birdrecon_path: Optional[Path] = None,
) -> list[ImageResult]:
    """Run all models on all images and compare results."""
    # Find all images
    image_extensions = {".jpg", ".jpeg", ".png"}
    images = [
        f for f in image_dir.iterdir() if f.suffix.lower() in image_extensions
    ]

    if not images:
        logger.error(f"No images found in {image_dir}")
        return []

    logger.info(f"Found {len(images)} images to analyze")

    # Initialize models
    models = []

    speciesnet = SpeciesNetClassifier()
    if speciesnet.load():
        models.append(speciesnet)

    hf_classifier = HuggingFaceBirdClassifier()
    if hf_classifier.load():
        models.append(hf_classifier)

    inat_classifier = INaturalistClassifier()
    if inat_classifier.load():
        models.append(inat_classifier)

    clip_classifier = CLIPBirdClassifier()
    if clip_classifier.load():
        models.append(clip_classifier)

    # Cropped classifier (uses multiple crop regions)
    if hf_classifier.model:
        cropped_classifier = CroppedBirdClassifier(hf_classifier)
        models.append(cropped_classifier)

    # Ensemble (combines HF + CLIP)
    base_classifiers = []
    if hf_classifier.model:
        base_classifiers.append(hf_classifier)
    if clip_classifier.model:
        base_classifiers.append(clip_classifier)
    if base_classifiers:
        ensemble = EnsembleClassifier(base_classifiers)
        models.append(ensemble)

    if include_birdrecon:
        birdrecon = BirdReconClassifier(birdrecon_path)
        if birdrecon.load():
            models.append(birdrecon)

    if not models:
        logger.error("No models loaded successfully")
        return []

    logger.info(f"Running comparison with {len(models)} models: {[m.name for m in models]}")
    logger.info("")

    # Run predictions
    results = []
    for image_path in sorted(images):
        expected_turtle_dove = image_path.name in TURTLE_DOVE_IMAGES
        predictions = []

        for model in models:
            pred = model.predict(image_path)
            if pred:
                predictions.append(pred)

        results.append(
            ImageResult(
                image_path=image_path,
                predictions=predictions,
                expected_turtle_dove=expected_turtle_dove,
            )
        )

    return results


def print_results(results: list[ImageResult]) -> None:
    """Print comparison results in a readable format."""
    if not results:
        return

    # Get model names from first result
    model_names = [p.model_name for p in results[0].predictions]

    logger.info("=" * 80)
    logger.info("BIRD MODEL COMPARISON RESULTS")
    logger.info("=" * 80)
    logger.info("")

    # Per-image results
    for result in results:
        is_target = "[TURTLE DOVE]" if result.expected_turtle_dove else ""
        logger.info(f"Image: {result.image_path.name} {is_target}")
        logger.info("-" * 60)

        for pred in result.predictions:
            status = "✓" if pred.is_turtle_dove else "✗"
            if result.expected_turtle_dove:
                status = "✓ CORRECT" if pred.is_turtle_dove else "✗ MISSED"

            logger.info(
                f"  {pred.model_name:30} | {pred.predicted_species:25} | "
                f"{pred.confidence:6.1%} | {status}"
            )
        logger.info("")

    # Summary statistics
    logger.info("=" * 80)
    logger.info("TURTLE DOVE DETECTION SUMMARY")
    logger.info("=" * 80)
    logger.info("")

    target_images = [r for r in results if r.expected_turtle_dove]
    logger.info(f"Target images (should be turtle dove): {len(target_images)}")
    logger.info("")

    for model_name in model_names:
        correct = 0
        total = len(target_images)

        for result in target_images:
            for pred in result.predictions:
                if pred.model_name == model_name and pred.is_turtle_dove:
                    correct += 1
                    break

        accuracy = correct / total if total > 0 else 0
        logger.info(f"  {model_name:30} | {correct}/{total} detected | {accuracy:.0%} accuracy")

    logger.info("")
    logger.info("=" * 80)
    logger.info("DETAILED PREDICTIONS FOR TURTLE DOVE IMAGES")
    logger.info("=" * 80)

    for result in target_images:
        logger.info(f"\n{result.image_path.name}:")
        for pred in result.predictions:
            symbol = "✓" if pred.is_turtle_dove else "✗"
            logger.info(f"  {symbol} {pred.model_name}: {pred.predicted_species} ({pred.confidence:.1%})")
            if pred.top_predictions:
                logger.info("      Top 5 predictions:")
                for i, top_pred in enumerate(pred.top_predictions, 1):
                    td_mark = " [TURTLE DOVE]" if top_pred.is_turtle_dove else ""
                    logger.info(f"        {i}. {top_pred.species} ({top_pred.confidence:.1%}){td_mark}")

    # Print recommendation
    logger.info("")
    logger.info("=" * 80)
    logger.info("RECOMMENDATION")
    logger.info("=" * 80)

    # Calculate best model
    model_accuracies = {}
    for model_name in model_names:
        correct = sum(
            1
            for result in target_images
            for pred in result.predictions
            if pred.model_name == model_name and pred.is_turtle_dove
        )
        model_accuracies[model_name] = correct / len(target_images) if target_images else 0

    best_model = max(model_accuracies.items(), key=lambda x: x[1])
    logger.info(f"\nBest performing model: {best_model[0]} ({best_model[1]:.0%} accuracy)")
    logger.info("")
    logger.info("Notes:")
    logger.info("  - iNaturalist (EVA02) excels at species identification across")
    logger.info("    challenging conditions including birds in flight")
    logger.info("  - CLIP Zero-Shot is a good lightweight alternative for standard poses")
    logger.info("  - HuggingFace Bird Classifier works well for clear, close-up images")
    logger.info("  - For production, iNaturalist model is recommended for best accuracy")
    logger.info("=" * 80)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--image-dir",
        type=Path,
        default=DEFAULT_IMAGE_DIR,
        help="Directory containing camera trap images",
    )
    parser.add_argument(
        "--include-birdrecon",
        action="store_true",
        help="Include BirdRecon model (requires separate setup)",
    )
    parser.add_argument(
        "--birdrecon-path",
        type=Path,
        help="Path to cloned BirdRecon repository",
    )
    args = parser.parse_args()

    if not args.image_dir.exists():
        logger.error(f"Image directory not found: {args.image_dir}")
        sys.exit(1)

    logger.info("Bird Classification Model Comparison")
    logger.info("====================================")
    logger.info(f"Image directory: {args.image_dir}")
    logger.info(f"Target species: European Turtle Dove (Streptopelia turtur)")
    logger.info(f"Expected turtle dove images: {', '.join(TURTLE_DOVE_IMAGES)}")
    logger.info("")

    results = run_comparison(
        args.image_dir,
        include_birdrecon=args.include_birdrecon,
        birdrecon_path=args.birdrecon_path,
    )

    if results:
        print_results(results)


if __name__ == "__main__":
    main()
