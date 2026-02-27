"""Analyze camera trap images for species using Google SpeciesNet."""

import argparse
import csv
import json
import logging
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from services.camera_trap import (
    DEFAULT_CONFIDENCE_THRESHOLD,
    DEFAULT_COUNTRY,
    DEFAULT_REVIEW_THRESHOLD,
    ImageResult,
    aggregate_sequences,
    analyze_directory,
    get_summary_statistics,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_IMAGE_DIR = Path(__file__).parent / "data" / "camera_trap_images"


def write_json_results(results: list[ImageResult], output_path: Path) -> None:
    data = {
        "generated_at": datetime.now().isoformat(),
        "total_images": len(results),
        "results": [r.to_dict() for r in results],
    }
    output_path.write_text(json.dumps(data, indent=2))
    logger.info(f"Wrote JSON results to {output_path}")


def write_csv_results(results: list[ImageResult], output_path: Path) -> None:
    fieldnames = [
        "filepath", "timestamp", "scientific_name", "common_name", "confidence",
        "taxonomic_level", "detection_count", "bbox_x_min", "bbox_y_min",
        "bbox_width", "bbox_height", "flagged_for_review", "review_reason", "prediction_source",
    ]

    with output_path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for result in results:
            bbox = result.detections[0].bbox if result.detections else None
            writer.writerow({
                "filepath": result.filepath,
                "timestamp": result.timestamp.isoformat() if result.timestamp else "",
                "scientific_name": result.classification.scientific_name if result.classification else "",
                "common_name": result.classification.common_name if result.classification else "",
                "confidence": f"{result.classification.confidence:.4f}" if result.classification else "",
                "taxonomic_level": result.classification.taxonomic_level if result.classification else "",
                "detection_count": len(result.detections),
                "bbox_x_min": f"{bbox.x_min:.4f}" if bbox else "",
                "bbox_y_min": f"{bbox.y_min:.4f}" if bbox else "",
                "bbox_width": f"{bbox.width:.4f}" if bbox else "",
                "bbox_height": f"{bbox.height:.4f}" if bbox else "",
                "flagged_for_review": result.flagged_for_review,
                "review_reason": result.review_reason or "",
                "prediction_source": result.prediction_source,
            })
    logger.info(f"Wrote CSV results to {output_path}")


def write_summary(results: list[ImageResult], output_path: Path) -> None:
    summary = get_summary_statistics(results)
    summary["generated_at"] = datetime.now().isoformat()
    sequences = aggregate_sequences(results)
    summary["sequence_count"] = len(sequences)
    summary["images_in_sequences"] = sum(len(s) for s in sequences.values())
    output_path.write_text(json.dumps(summary, indent=2))
    logger.info(f"Wrote summary to {output_path}")


def print_summary(results: list[ImageResult]) -> None:
    summary = get_summary_statistics(results)
    logger.info("")
    logger.info("=" * 60)
    logger.info("ANALYSIS SUMMARY")
    logger.info("=" * 60)
    logger.info(f"Total images processed: {summary['total_images']}")
    logger.info(f"Images with detections: {summary['images_with_detections']}")
    logger.info(f"Images with classifications: {summary['images_with_classifications']}")
    logger.info(f"Images flagged for review: {summary['images_flagged_for_review']}")
    logger.info(f"Average confidence: {summary['average_confidence']:.1%}")
    logger.info("")
    if summary["species_counts"]:
        logger.info("Species detected:")
        for species, count in summary["species_counts"].items():
            logger.info(f"  {species}: {count}")
        logger.info("")
    dist = summary["confidence_distribution"]
    logger.info("Confidence distribution:")
    logger.info(f"  High (90-100%): {dist['high_90_100']}")
    logger.info(f"  Medium (70-90%): {dist['medium_70_90']}")
    logger.info(f"  Low (40-70%): {dist['low_40_70']}")
    logger.info(f"  Very low (0-40%): {dist['very_low_0_40']}")
    logger.info("=" * 60)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, default=DEFAULT_IMAGE_DIR)
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--country", type=str, default=DEFAULT_COUNTRY)
    parser.add_argument("--confidence-threshold", type=float, default=DEFAULT_CONFIDENCE_THRESHOLD)
    parser.add_argument("--review-threshold", type=float, default=DEFAULT_REVIEW_THRESHOLD)
    parser.add_argument("--json-only", action="store_true")
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    if not args.input_dir.exists() or not args.input_dir.is_dir():
        logger.error(f"Invalid input directory: {args.input_dir}")
        sys.exit(1)

    output_dir = args.output_dir or (args.input_dir / "results")
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"Analyzing images in: {args.input_dir}")
    logger.info(f"Country geofencing: {args.country}")
    logger.info(f"Confidence threshold: {args.confidence_threshold}")
    logger.info(f"Review threshold: {args.review_threshold}")
    logger.info("")

    try:
        results = analyze_directory(
            args.input_dir,
            country=args.country,
            confidence_threshold=args.confidence_threshold,
            review_threshold=args.review_threshold,
            output_dir=output_dir,
        )
    except RuntimeError as e:
        logger.error(f"Analysis failed: {e}")
        sys.exit(1)

    if not results:
        logger.warning("No results to report")
        sys.exit(0)

    if args.verbose:
        logger.info(f"Found {len(results)} results:")
        for r in results:
            logger.info(f"  {r}")
        logger.info("")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    write_json_results(results, output_dir / f"results_{timestamp}.json")
    if not args.json_only:
        write_csv_results(results, output_dir / f"results_{timestamp}.csv")
    write_summary(results, output_dir / f"summary_{timestamp}.json")
    print_summary(results)

    flagged = [r for r in results if r.flagged_for_review]
    if flagged:
        logger.info("")
        logger.info(f"Images flagged for manual review ({len(flagged)}):")
        for r in flagged:
            logger.info(f"  {Path(r.filepath).name}: {r.review_reason}")


if __name__ == "__main__":
    main()
