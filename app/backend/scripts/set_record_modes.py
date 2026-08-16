"""
Assign per-org survey type record modes (Aug 2026).

`SurveyType.record_mode` picks the sighting entry surface — 'map' (tap the
map where the sighting was) or 'list' (count-driven tallies). George's
assignment: everything Cannwood records on the map, everything Heal as a
list. Orgs not named here are left untouched (new types default to 'list').

Safe to re-run: already-correct modes are skipped.

Usage:
    ./run staging set_record_modes.py                     # dry-run (preview)
    ./run staging set_record_modes.py --no-dry-run --yes  # apply
"""

import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session

from database.connection import get_engine
from models import Organisation, RecordMode, SurveyType
from script_utils import get_arg_parser

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

ORG_SLUG_TO_MODE: dict[str, RecordMode] = {
    "cannwood": RecordMode.map,
    "heal": RecordMode.list,
}


def main() -> None:
    parser = get_arg_parser(description=__doc__)
    parser.add_argument('--yes', '-y', action='store_true', help='Skip confirmation prompt')
    args = parser.parse_args()

    logger.info(f"{'DRY RUN — no changes will be committed' if args.dry_run else 'LIVE RUN'}\n")

    with Session(get_engine()) as db:
        changed = 0
        for org in db.query(Organisation).order_by(Organisation.id).all():
            mode = ORG_SLUG_TO_MODE.get(org.slug)
            if mode is None:
                logger.info(f"{org.slug}: no assignment — leaving as-is")
                continue
            types = db.query(SurveyType).filter(SurveyType.organisation_id == org.id).order_by(SurveyType.id).all()
            for t in types:
                if t.record_mode == mode:
                    logger.info(f"{org.slug}: {t.name!r} (id={t.id}) — already {mode.value!r}")
                    continue
                logger.info(f"{org.slug}: {t.name!r} (id={t.id}) — {t.record_mode.value!r} -> {mode.value!r}")
                t.record_mode = mode
                changed += 1

        logger.info(f"\n{changed} survey type(s) to update.")

        if args.dry_run:
            db.rollback()
            logger.info("DRY RUN complete — rolled back. Re-run with --no-dry-run to apply.")
            return

        if not args.yes:
            confirm = input("Apply these changes? [y/N] ")
            if confirm.strip().lower() != 'y':
                db.rollback()
                logger.info("Aborted — rolled back.")
                return

        db.commit()
        logger.info("Committed.")


if __name__ == '__main__':
    main()
