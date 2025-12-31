"""Create species_type reference table

Revision ID: k9l0m1n2o3p4
Revises: j8k9l0m1n2o3
Create Date: 2024-12-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'k9l0m1n2o3p4'
down_revision: Union[str, Sequence[str], None] = 'j8k9l0m1n2o3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create species_type reference table
    op.create_table(
        'species_type',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(50), nullable=False, unique=True),
        sa.Column('display_name', sa.String(100), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False)
    )

    # Populate from existing distinct species.type values
    connection = op.get_bind()

    # Get distinct species types from the species table
    result = connection.execute(sa.text("""
        SELECT DISTINCT type FROM species WHERE type IS NOT NULL ORDER BY type
    """))
    existing_types = [row[0] for row in result]

    # Insert each type with a display name (capitalize first letter of each word)
    for species_type in existing_types:
        display_name = species_type.replace('-', ' ').replace('_', ' ').title()
        connection.execute(sa.text("""
            INSERT INTO species_type (name, display_name) VALUES (:name, :display_name)
        """), {"name": species_type, "display_name": display_name})

    # Ensure we have bird and mammal types (required for initial survey types)
    for required_type in [('bird', 'Bird'), ('mammal', 'Mammal')]:
        connection.execute(sa.text("""
            INSERT INTO species_type (name, display_name)
            SELECT :name, :display_name
            WHERE NOT EXISTS (SELECT 1 FROM species_type WHERE name = :name)
        """), {"name": required_type[0], "display_name": required_type[1]})


def downgrade() -> None:
    op.drop_table('species_type')
