"""
Move non-bird sightings out of Bird surveys into new Ad hoc surveys.

For every survey of the organisation's "Bird" survey type that contains
sightings whose species is not in the "Birds" species type, a new "Ad hoc"
survey is created (copying the source survey's date, times, location and
surveyor links) and the offending sightings are repointed at it. Sighting
individuals, notes, photos etc. follow the sighting automatically.

The "Ad hoc" survey type must already exist for the organisation — the
script fails loudly if it doesn't. Safe to re-run: surveys whose non-bird
sightings were already broken out are detected via the notes marker on the
created Ad hoc survey and skipped.

Usage:
    ./run staging extract_nonbird_sightings.py --org cannwood                     # dry-run (preview)
    ./run staging extract_nonbird_sightings.py --org cannwood --no-dry-run --yes  # apply
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
from script_utils import get_arg_parser

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

# Matches both the legacy lowercase-singular ("bird") and the refactored
# plural ("Birds") species type naming.
BIRD_SPECIES_TYPE_NAMES = ("bird", "birds")


def find_one_org(db: Session, pattern: str) -> Organisation:
    orgs = db.query(Organisation).filter(Organisation.name.ilike(f"%{pattern}%")).all()
    if len(orgs) != 1:
        logger.error(f"Expected exactly one organisation matching {pattern!r}, found {len(orgs)}: {[o.name for o in orgs]}")
        sys.exit(1)
    return orgs[0]


def require_one_type(db: Session, org_id: int, name_pattern: str, label: str) -> SurveyType:
    matches = db.query(SurveyType).filter(
        SurveyType.organisation_id == org_id,
        SurveyType.name.ilike(name_pattern),
    ).all()
    if len(matches) != 1:
        logger.error(
            f"Expected exactly one {label!r} survey type (pattern {name_pattern!r}), "
            f"found {len(matches)}: {[t.name for t in matches]}"
        )
        sys.exit(1)
    return matches[0]


def marker(source_survey_id: int) -> str:
    return f"Moved from Bird survey {source_survey_id} (non-bird sightings)"


def nonbird_sightings(db: Session, survey_id: int) -> list[Sighting]:
    return db.query(Sighting).join(Species).join(SpeciesType).filter(
        Sighting.survey_id == survey_id,
        sa.func.lower(SpeciesType.name).notin_(BIRD_SPECIES_TYPE_NAMES),
    ).all()


def break_out_survey(db: Session, org: Organisation, ad_hoc: SurveyType, source: Survey) -> bool:
    """Move source's non-bird sightings to a new Ad hoc survey. Returns True if it moved anything."""
    already = db.query(Survey).filter(
        Survey.organisation_id == org.id,
        Survey.survey_type_id == ad_hoc.id,
        Survey.notes == marker(source.id),
    ).first()
    if already:
        logger.info(f"Survey {source.id} ({source.date}): already broken out into Ad hoc survey {already.id} — skipping")
        return False

    sightings = nonbird_sightings(db, source.id)
    if not sightings:
        return False

    # Only carry the survey-level location over if the Ad hoc type uses one.
    location_id = None if ad_hoc.location_at_sighting_level else source.location_id
    new_survey = Survey(
        organisation_id=org.id,
        survey_type_id=ad_hoc.id,
        date=source.date,
        start_time=source.start_time,
        end_time=source.end_time,
        location_id=location_id,
        notes=marker(source.id),
    )
    db.add(new_survey)
    db.flush()  # assigns new_survey.id

    surveyor_links = db.query(SurveySurveyor).filter(SurveySurveyor.survey_id == source.id).all()
    for link in surveyor_links:
        db.add(SurveySurveyor(survey_id=new_survey.id, surveyor_id=link.surveyor_id))

    logger.info(
        f"Survey {source.id} ({source.date}): moving {len(sightings)} sighting(s) to new "
        f"Ad hoc survey {new_survey.id} ({len(surveyor_links)} surveyor link(s) copied)"
    )
    for sighting in sightings:
        species = db.get(Species, sighting.species_id)
        species_type = db.get(SpeciesType, species.species_type_id)
        logger.info(
            f"  - sighting {sighting.id}: {species.name} [{species_type.name}], count={sighting.count}"
        )
        # If the Ad hoc type locates per sighting and this sighting has no
        # location of its own, inherit the source survey's location.
        if ad_hoc.location_at_sighting_level and sighting.location_id is None:
            sighting.location_id = source.location_id
        sighting.survey_id = new_survey.id
    return True


def main() -> None:
    parser = get_arg_parser(description=__doc__)
    parser.add_argument('--org', required=True, help='Organisation name (substring match, must be unique)')
    parser.add_argument('--bird-type', default='bird', help="Bird survey type name pattern (default: 'bird')")
    parser.add_argument('--yes', '-y', action='store_true', help='Skip confirmation prompt')
    args = parser.parse_args()

    logger.info(f"{'DRY RUN — no changes will be committed' if args.dry_run else 'LIVE RUN'}\n")

    with Session(get_engine()) as db:
        org = find_one_org(db, args.org)
        logger.info(f"Organisation: {org.name} (id={org.id})")

        bird_type = require_one_type(db, org.id, args.bird_type, "Bird")
        ad_hoc = require_one_type(db, org.id, "ad%hoc", "Ad hoc")
        logger.info(f"Bird type: {bird_type.name} (id={bird_type.id}); Ad hoc type: {ad_hoc.name} (id={ad_hoc.id})\n")

        bird_surveys = db.query(Survey).filter(
            Survey.organisation_id == org.id,
            Survey.survey_type_id == bird_type.id,
        ).order_by(Survey.date, Survey.id).all()
        logger.info(f"Checking {len(bird_surveys)} Bird survey(s) for non-bird sightings...\n")

        moved = sum(break_out_survey(db, org, ad_hoc, survey) for survey in bird_surveys)
        logger.info(f"\n{moved} survey(s) had non-bird sightings broken out.")

        if args.dry_run:
            db.rollback()
            logger.info("DRY RUN complete — rolled back. Re-run with --no-dry-run to apply.")
            return

        if moved and not args.yes:
            response = input("\nApply all changes? [y/N]: ")
            if response.lower() != 'y':
                db.rollback()
                logger.info("Aborted.")
                return

        db.commit()
        logger.info("Done.")


if __name__ == "__main__":
    main()
