"""
Collapse the species_type reference table from 19 types into 12 groups
(July 2026).

Target groups: Butterflies, Moths, Bees, Dragonflies, Other invertebrates,
Mammals, Bats, Birds, Reptiles, Amphibians, Fungi, Plants.

What this does to the data:
  * Creates two new types: ``bee`` and ``plant`` (``plant`` starts empty).
  * Splits the old ``bee-wasp-ant`` type (really all Hymenoptera): species in
    a known British bee genus (clade Anthophila) become ``bee``; the rest
    (parasitic wasps, ants, sawflies) fold into ``insect``.
  * Folds ``beetle, bug, fly, grasshopper-cricket, gall, spider, mite,
    woodlouse`` into ``insect``, which is renamed "Other invertebrates" (it now
    honestly holds arachnids and crustaceans too, not only insects).
  * Rewrites survey_type <-> species_type links onto the surviving types and
    de-dupes them (the link table has a UNIQUE(survey_type_id, species_type_id)
    constraint). Link rule: a survey's ``bee-wasp-ant`` link becomes ``bee``
    (so a Bumblebee survey lists only bees); the folded types become ``insect``
    — catch-all surveys (Ad Hoc, Jenny) link to the folded types too, so they
    correctly end up with both ``bee`` and ``insect``.
  * Deletes the nine emptied types.
  * Sets tidy display names on all twelve survivors.

Sightings are untouched — they FK to ``species``, not ``species_type``, so
remapping ``species.species_type_id`` carries the recorded data automatically.
``species.scientific_name`` is retained, so a beetle-vs-fly split is always
recoverable from taxonomy if a future re-split is wanted.

The ``species_type`` table is global (not org-scoped), so this runs once per
database. Safe to re-run: once collapsed, the old types are gone and every step
becomes a no-op.

Usage:
    ./run staging refactor_species_types.py                     # dry-run
    ./run staging refactor_species_types.py --no-dry-run --yes  # apply
    ./run prod    refactor_species_types.py --no-dry-run        # (after merge)
"""

import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.orm import Session

from database.connection import get_engine
from script_utils import get_arg_parser

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

# British bee genera (clade Anthophila), across all six families. Genus is the
# first word of species.scientific_name. This is the split key for the old
# "bee-wasp-ant" pile; British bees are a well-bounded ~270-species fauna, so a
# genus match classifies them reliably.
BEE_GENERA = [
    # Andrenidae
    'Andrena', 'Panurgus',
    # Apidae
    'Anthophora', 'Apis', 'Bombus', 'Psithyrus', 'Ceratina', 'Epeolus', 'Eucera',
    'Melecta', 'Nomada', 'Xylocopa', 'Ammobates', 'Ammobatoides', 'Biastes', 'Pasites',
    # Colletidae
    'Colletes', 'Hylaeus',
    # Halictidae
    'Halictus', 'Lasioglossum', 'Sphecodes', 'Dufourea', 'Rophites', 'Nomioides', 'Systropha',
    # Megachilidae
    'Anthidium', 'Chelostoma', 'Coelioxys', 'Heriades', 'Hoplitis', 'Megachile', 'Osmia', 'Stelis',
    # Melittidae
    'Dasypoda', 'Macropis', 'Melitta',
]

# The catch-all bucket. Its slug stays 'insect' (so the frontend icon/fallback
# keying survives) but its display name becomes "Other invertebrates".
OTHER = 'insect'

# Old types that fold wholesale into OTHER.
FOLD_INTO_OTHER = ['beetle', 'bug', 'fly', 'grasshopper-cricket', 'gall', 'spider', 'mite', 'woodlouse']

# Every type removed by this refactor.
REMOVED_TYPES = ['bee-wasp-ant'] + FOLD_INTO_OTHER

# Link remap: old species_type name -> surviving name (see module docstring).
LINK_REMAP = {'bee-wasp-ant': 'bee', **{t: OTHER for t in FOLD_INTO_OTHER}}

# Final display names for the twelve survivors (slug -> display_name).
DISPLAY_NAMES = {
    'butterfly': 'Butterflies',
    'moth': 'Moths',
    'bee': 'Bees',
    'dragonfly-damselfly': 'Dragonflies',
    'insect': 'Other invertebrates',
    'mammal': 'Mammals',
    'bat': 'Bats',
    'bird': 'Birds',
    'reptile': 'Reptiles',
    'amphibian': 'Amphibians',
    'fungus': 'Fungi',
    'plant': 'Plants',
}


def type_ids(db: Session) -> dict[str, int]:
    """Current name -> id for every species_type row."""
    return {name: tid for tid, name in db.execute(text("SELECT id, name FROM species_type")).all()}


def ensure_type(db: Session, name: str, display_name: str, ids: dict[str, int]) -> int:
    """Create a species_type if missing; return its id."""
    if name in ids:
        return ids[name]
    new_id = db.execute(
        text("INSERT INTO species_type (name, display_name) VALUES (:n, :d) RETURNING id"),
        {'n': name, 'd': display_name},
    ).scalar_one()
    ids[name] = new_id
    logger.info(f"  + created species_type {name!r} (id={new_id})")
    return new_id


def main() -> None:
    parser = get_arg_parser(description=__doc__)
    parser.add_argument('--yes', '-y', action='store_true', help='Skip confirmation prompt')
    args = parser.parse_args()

    logger.info(f"{'DRY RUN — no changes will be committed' if args.dry_run else 'LIVE RUN'}\n")

    with Session(get_engine()) as db:
        ids = type_ids(db)

        # 1. Ensure the two new types exist.
        logger.info("Ensuring target types exist:")
        bee_id = ensure_type(db, 'bee', 'Bees', ids)
        ensure_type(db, 'plant', 'Plants', ids)
        other_id = ids.get(OTHER)
        if other_id is None:
            logger.error(f"No {OTHER!r} species_type to fold into — aborting.")
            sys.exit(1)

        # 2. Reclassify species off the removed types.
        if 'bee-wasp-ant' in ids:
            bwa = ids['bee-wasp-ant']
            moved_bees = db.execute(
                text(
                    "UPDATE species SET species_type_id = :bee "
                    "WHERE species_type_id = :bwa "
                    "AND split_part(scientific_name, ' ', 1) = ANY(:genera)"
                ),
                {'bee': bee_id, 'bwa': bwa, 'genera': BEE_GENERA},
            ).rowcount
            moved_rest = db.execute(
                text("UPDATE species SET species_type_id = :other WHERE species_type_id = :bwa"),
                {'other': other_id, 'bwa': bwa},
            ).rowcount
            logger.info(f"\nbee-wasp-ant split: {moved_bees} -> bee, {moved_rest} -> {OTHER}")

        for name in FOLD_INTO_OTHER:
            if name in ids:
                n = db.execute(
                    text("UPDATE species SET species_type_id = :other WHERE species_type_id = :src"),
                    {'other': other_id, 'src': ids[name]},
                ).rowcount
                if n:
                    logger.info(f"folded {n} species: {name} -> {OTHER}")

        # 3. Rewrite survey_type links onto surviving types, then de-dup. Insert
        #    the remapped links first (skipping any that already exist), then the
        #    row deletions in step 5 cascade-remove the old links.
        for src_name, dst_name in LINK_REMAP.items():
            if src_name not in ids:
                continue
            db.execute(
                text(
                    "INSERT INTO survey_type_species_type (survey_type_id, species_type_id) "
                    "SELECT DISTINCT l.survey_type_id, :dst FROM survey_type_species_type l "
                    "WHERE l.species_type_id = :src "
                    "AND NOT EXISTS ("
                    "  SELECT 1 FROM survey_type_species_type e "
                    "  WHERE e.survey_type_id = l.survey_type_id AND e.species_type_id = :dst)"
                ),
                {'src': ids[src_name], 'dst': ids[dst_name]},
            )

        # 4/5. Delete the emptied types. FK survey_type_species_type.species_type_id
        #      is ON DELETE CASCADE, so any leftover old links go with the row.
        removed = [n for n in REMOVED_TYPES if n in ids]
        if removed:
            db.execute(
                text("DELETE FROM species_type WHERE name = ANY(:names)"),
                {'names': removed},
            )
            logger.info(f"\nremoved types: {', '.join(removed)}")

        # 6. Tidy display names on the survivors.
        for slug, display in DISPLAY_NAMES.items():
            db.execute(
                text("UPDATE species_type SET display_name = :d WHERE name = :n"),
                {'d': display, 'n': slug},
            )

        # Report the resulting shape.
        logger.info("\nResulting species types:")
        rows = db.execute(
            text(
                "SELECT st.name, st.display_name, count(s.id) AS n "
                "FROM species_type st LEFT JOIN species s ON s.species_type_id = st.id "
                "GROUP BY st.id, st.name, st.display_name ORDER BY st.display_name"
            )
        ).all()
        for name, display, n in rows:
            logger.info(f"  {display:<22} ({name:<20}) {n:>6} species")
        logger.info(f"  {len(rows)} types total")

        if args.dry_run:
            db.rollback()
            logger.info("\nDRY RUN complete — rolled back. Re-run with --no-dry-run to apply.")
            return

        if not args.yes:
            response = input("\nApply all changes? [y/N]: ")
            if response.lower() != 'y':
                db.rollback()
                logger.info("Aborted.")
                return

        db.commit()
        logger.info("Done.")


if __name__ == "__main__":
    main()
