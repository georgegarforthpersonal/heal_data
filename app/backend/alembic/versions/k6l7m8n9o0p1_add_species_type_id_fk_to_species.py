"""Add species_type_id foreign key to species table, drop type varchar column

Revision ID: k6l7m8n9o0p1
Revises: j5k6l7m8n9o0
Create Date: 2026-03-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'k6l7m8n9o0p1'
down_revision: Union[str, None] = 'j5k6l7m8n9o0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Step 1: Add species_type_id column (nullable initially)
    op.add_column('species', sa.Column('species_type_id', sa.Integer(), nullable=True))

    # Step 2: Populate species_type_id from species.type matching species_type.name
    connection = op.get_bind()
    connection.execute(sa.text("""
        UPDATE species
        SET species_type_id = species_type.id
        FROM species_type
        WHERE species.type = species_type.name
    """))

    # Step 3: Check for any species with NULL species_type_id (unmatched types)
    result = connection.execute(sa.text("""
        SELECT COUNT(*) FROM species WHERE species_type_id IS NULL AND type IS NOT NULL
    """))
    unmatched = result.scalar()
    if unmatched > 0:
        # Insert missing species_type records for any unmatched types
        connection.execute(sa.text("""
            INSERT INTO species_type (name, display_name)
            SELECT DISTINCT s.type, INITCAP(REPLACE(REPLACE(s.type, '-', ' '), '_', ' '))
            FROM species s
            WHERE s.species_type_id IS NULL
              AND s.type IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM species_type st WHERE st.name = s.type)
        """))
        # Re-run the update for newly inserted types
        connection.execute(sa.text("""
            UPDATE species
            SET species_type_id = species_type.id
            FROM species_type
            WHERE species.type = species_type.name
              AND species.species_type_id IS NULL
        """))

    # Step 4: Make species_type_id NOT NULL
    op.alter_column('species', 'species_type_id', nullable=False)

    # Step 5: Add foreign key constraint
    op.create_foreign_key(
        'fk_species_species_type_id',
        'species', 'species_type',
        ['species_type_id'], ['id']
    )

    # Step 6: Add index for efficient lookups
    op.create_index('ix_species_species_type_id', 'species', ['species_type_id'])

    # Step 7: Drop the old type varchar column
    op.drop_column('species', 'type')


def downgrade() -> None:
    # Step 1: Re-add the type varchar column
    op.add_column('species', sa.Column('type', sa.String(50), nullable=True))

    # Step 2: Populate type from species_type.name
    connection = op.get_bind()
    connection.execute(sa.text("""
        UPDATE species
        SET type = species_type.name
        FROM species_type
        WHERE species.species_type_id = species_type.id
    """))

    # Step 3: Set default and NOT NULL
    op.alter_column('species', 'type', nullable=False, server_default='butterfly')

    # Step 4: Drop FK, index, and column
    op.drop_index('ix_species_species_type_id', 'species')
    op.drop_constraint('fk_species_species_type_id', 'species', type_='foreignkey')
    op.drop_column('species', 'species_type_id')
