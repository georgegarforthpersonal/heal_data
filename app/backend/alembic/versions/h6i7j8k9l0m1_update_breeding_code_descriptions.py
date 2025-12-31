"""update_breeding_code_descriptions

Revision ID: h6i7j8k9l0m1
Revises: g5h6i7j8k9l0
Create Date: 2025-12-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'h6i7j8k9l0m1'
down_revision: Union[str, Sequence[str], None] = 'g5h6i7j8k9l0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Update breeding status codes with full BTO descriptions."""

    # First, alter the column type to TEXT to accommodate longer descriptions
    op.execute("ALTER TABLE breeding_status_code ALTER COLUMN description TYPE TEXT;")

    # Update each code with its full BTO description
    updates = [
        # Non-Breeding
        ("F", "Flying over"),
        ("M", "Species observed but suspected to be still on Migration"),
        ("U", "Species observed but suspected to be sUmmering non-breeder"),
        # Possible Breeder
        ("H", "Species observed in breeding season in suitable nesting Habitat"),
        ("S", "Singing male present (or breeding calls heard) in breeding season in suitable breeding habitat"),
        # Probable Breeder
        ("P", "Pair observed in suitable nesting habitat in breeding season"),
        ("T", "Permanent Territory presumed through registration of territorial behaviour (song etc) on at least two different days a week or more apart at the same place or many individuals on one day"),
        ("D", "Courtship and Display (judged to be in or near potential breeding habitat; be cautious with wildfowl)"),
        ("N", "Visiting probable Nest site"),
        ("A", "Agitated behaviour or anxiety calls from adults, suggesting probable presence of nest or young nearby"),
        ("I", "Brood patch on adult examined in the hand, suggesting Incubation"),
        ("B", "Nest Building or excavating nest-hole"),
        # Confirmed Breeder
        ("DD", "Distraction-Display or injury feigning"),
        ("UN", "Used Nest or eggshells found (occupied or laid within period of survey)"),
        ("FL", "Recently Fledged young (nidicolous species) or downy young (nidifugous species). Careful consideration should be given to the likely provenance of any fledged juvenile capable of significant geographical movement. Evidence of dependency on adults (e.g. feeding) is helpful. Be cautious, even if the record comes from suitable habitat."),
        ("ON", "Adults entering or leaving nest-site in circumstances indicating Occupied Nest (including high nests or nest holes, the contents of which can not be seen) or adults seen incubating"),
        ("FF", "Adult carrying Faecal sac or Food for young"),
        ("NE", "Nest containing Eggs"),
        ("NY", "Nest with Young seen or heard"),
    ]

    for code, description in updates:
        # Escape single quotes in description
        escaped_desc = description.replace("'", "''")
        op.execute(f"UPDATE breeding_status_code SET description = '{escaped_desc}' WHERE code = '{code}';")


def downgrade() -> None:
    """Revert to short descriptions."""

    short_descriptions = [
        ("F", "Flying over"),
        ("M", "Migration"),
        ("U", "Summering non-breeder"),
        ("H", "Habitat"),
        ("S", "Singing male"),
        ("P", "Pair"),
        ("T", "Territory"),
        ("D", "Display"),
        ("N", "Nest site"),
        ("A", "Agitated"),
        ("I", "Incubation"),
        ("B", "Building"),
        ("DD", "Distraction display"),
        ("UN", "Used nest"),
        ("FL", "Fledged young"),
        ("ON", "Occupied nest"),
        ("FF", "Food/Fecal sac"),
        ("NE", "Nest/Eggs"),
        ("NY", "Nest/Young"),
    ]

    for code, description in short_descriptions:
        op.execute(f"UPDATE breeding_status_code SET description = '{description}' WHERE code = '{code}';")

    # Revert column type
    op.execute("ALTER TABLE breeding_status_code ALTER COLUMN description TYPE VARCHAR(100);")
