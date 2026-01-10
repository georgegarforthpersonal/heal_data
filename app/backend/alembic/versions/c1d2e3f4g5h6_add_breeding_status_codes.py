"""add_breeding_status_codes

Revision ID: c1d2e3f4g5h6
Revises: b31ef1eedb44
Create Date: 2025-12-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4g5h6'
down_revision: Union[str, Sequence[str], None] = 'b31ef1eedb44'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add breeding status codes reference table for BTO breeding evidence codes."""

    # Create enum type for breeding categories
    op.execute("""
        CREATE TYPE breeding_category AS ENUM (
            'non_breeding',
            'possible_breeder',
            'probable_breeder',
            'confirmed_breeder'
        );
    """)

    # Create breeding status code reference table
    op.execute("""
        CREATE TABLE breeding_status_code (
            code VARCHAR(2) PRIMARY KEY,
            description TEXT NOT NULL,
            category breeding_category NOT NULL
        );
    """)

    # Seed with BTO breeding status codes (full descriptions from BTO)
    op.execute("""
        INSERT INTO breeding_status_code (code, description, category) VALUES
            -- Non-Breeding
            ('F', 'Flying over', 'non_breeding'),
            ('M', 'Species observed but suspected to be still on Migration', 'non_breeding'),
            ('U', 'Species observed but suspected to be sUmmering non-breeder', 'non_breeding'),
            -- Possible Breeder
            ('H', 'Species observed in breeding season in suitable nesting Habitat', 'possible_breeder'),
            ('S', 'Singing male present (or breeding calls heard) in breeding season in suitable breeding habitat', 'possible_breeder'),
            -- Probable Breeder
            ('P', 'Pair observed in suitable nesting habitat in breeding season', 'probable_breeder'),
            ('T', 'Permanent Territory presumed through registration of territorial behaviour (song etc) on at least two different days a week or more apart at the same place or many individuals on one day', 'probable_breeder'),
            ('D', 'Courtship and Display (judged to be in or near potential breeding habitat; be cautious with wildfowl)', 'probable_breeder'),
            ('N', 'Visiting probable Nest site', 'probable_breeder'),
            ('A', 'Agitated behaviour or anxiety calls from adults, suggesting probable presence of nest or young nearby', 'probable_breeder'),
            ('I', 'Brood patch on adult examined in the hand, suggesting Incubation', 'probable_breeder'),
            ('B', 'Nest Building or excavating nest-hole', 'probable_breeder'),
            -- Confirmed Breeder
            ('DD', 'Distraction-Display or injury feigning', 'confirmed_breeder'),
            ('UN', 'Used Nest or eggshells found (occupied or laid within period of survey)', 'confirmed_breeder'),
            ('FL', 'Recently Fledged young (nidicolous species) or downy young (nidifugous species). Careful consideration should be given to the likely provenance of any fledged juvenile capable of significant geographical movement. Evidence of dependency on adults (e.g. feeding) is helpful. Be cautious, even if the record comes from suitable habitat.', 'confirmed_breeder'),
            ('ON', 'Adults entering or leaving nest-site in circumstances indicating Occupied Nest (including high nests or nest holes, the contents of which can not be seen) or adults seen incubating', 'confirmed_breeder'),
            ('FF', 'Adult carrying Faecal sac or Food for young', 'confirmed_breeder'),
            ('NE', 'Nest containing Eggs', 'confirmed_breeder'),
            ('NY', 'Nest with Young seen or heard', 'confirmed_breeder');
    """)


def downgrade() -> None:
    """Remove breeding status codes table and enum."""
    op.execute("DROP TABLE IF EXISTS breeding_status_code;")
    op.execute("DROP TYPE IF EXISTS breeding_category;")
