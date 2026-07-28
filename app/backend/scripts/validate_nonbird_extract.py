"""Read-only validation for extract_nonbird_sightings.py (staging).

Checks, for the Cannwood organisation:
1. No non-bird sightings remain on Bird-type surveys.
2. Every marker-created Ad hoc survey contains only non-bird sightings,
   matches its source survey's date, and has surveyor links.
"""

import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import sqlalchemy as sa
from sqlalchemy.orm import Session

from database.connection import get_engine
from models import (
    Organisation,
    Sighting,
    Species,
    SpeciesType,
    Survey,
    SurveySurveyor,
    SurveyType,
)

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

BIRD_NAMES = ("bird", "birds")


def main() -> None:
    failures = 0
    with Session(get_engine()) as db:
        org = db.query(Organisation).filter(Organisation.name.ilike("%cannwood%")).one()
        bird_type = db.query(SurveyType).filter(
            SurveyType.organisation_id == org.id, SurveyType.name.ilike("bird")
        ).one()
        ad_hoc = db.query(SurveyType).filter(
            SurveyType.organisation_id == org.id, SurveyType.name.ilike("ad%hoc")
        ).one()

        # 1. Bird surveys must hold only bird sightings now.
        leftovers = db.query(Sighting).join(Species).join(SpeciesType).join(
            Survey, Sighting.survey_id == Survey.id
        ).filter(
            Survey.survey_type_id == bird_type.id,
            sa.func.lower(SpeciesType.name).notin_(BIRD_NAMES),
        ).all()
        if leftovers:
            failures += 1
            logger.info(f"FAIL: {len(leftovers)} non-bird sighting(s) still on Bird surveys: {[s.id for s in leftovers]}")
        else:
            logger.info("PASS: no non-bird sightings remain on Bird surveys")

        # 2. Inspect each marker-created Ad hoc survey.
        created = db.query(Survey).filter(
            Survey.organisation_id == org.id,
            Survey.survey_type_id == ad_hoc.id,
            Survey.notes.like("Moved from Bird survey %"),
        ).order_by(Survey.id).all()
        logger.info(f"\n{len(created)} marker-created Ad hoc survey(s):")
        total_sightings = 0
        for survey in created:
            source_id = int(survey.notes.split("Moved from Bird survey ")[1].split(" ")[0])
            source = db.get(Survey, source_id)
            sightings = db.query(Sighting).filter(Sighting.survey_id == survey.id).all()
            total_sightings += len(sightings)
            surveyor_count = db.query(SurveySurveyor).filter(SurveySurveyor.survey_id == survey.id).count()
            source_surveyors = db.query(SurveySurveyor).filter(SurveySurveyor.survey_id == source_id).count()
            bird_here = db.query(Sighting).join(Species).join(SpeciesType).filter(
                Sighting.survey_id == survey.id,
                sa.func.lower(SpeciesType.name).in_(BIRD_NAMES),
            ).count()
            problems = []
            if source is None:
                problems.append("source survey missing")
            elif source.date != survey.date:
                problems.append(f"date mismatch (source {source.date})")
            if not sightings:
                problems.append("no sightings")
            if bird_here:
                problems.append(f"{bird_here} BIRD sighting(s) present")
            if surveyor_count != source_surveyors:
                problems.append(f"surveyor links {surveyor_count} != source {source_surveyors}")
            status = "FAIL: " + "; ".join(problems) if problems else "PASS"
            if problems:
                failures += 1
            logger.info(
                f"  Ad hoc survey {survey.id} (from {source_id}, {survey.date}): "
                f"{len(sightings)} sighting(s), {surveyor_count} surveyor link(s) — {status}"
            )
        logger.info(f"\nTotal sightings on created Ad hoc surveys: {total_sightings}")
        logger.info("ALL CHECKS PASSED" if failures == 0 else f"{failures} CHECK(S) FAILED")
        sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
