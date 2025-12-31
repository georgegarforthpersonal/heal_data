"""Create survey_type tables and schema changes

Revision ID: l0m1n2o3p4q5
Revises: k9l0m1n2o3p4
Create Date: 2024-12-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'l0m1n2o3p4q5'
down_revision: Union[str, Sequence[str], None] = 'k9l0m1n2o3p4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create survey_type table
    op.create_table(
        'survey_type',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(100), nullable=False, unique=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('location_at_sighting_level', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')),
        sa.Column('allow_geolocation', sa.Boolean(), nullable=False, server_default=sa.text('TRUE')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('TRUE')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False)
    )

    # 2. Create survey_type_location junction table
    op.create_table(
        'survey_type_location',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('survey_type_id', sa.Integer(), sa.ForeignKey('survey_type.id', ondelete='CASCADE'), nullable=False),
        sa.Column('location_id', sa.Integer(), sa.ForeignKey('location.id', ondelete='CASCADE'), nullable=False),
        sa.UniqueConstraint('survey_type_id', 'location_id', name='uq_survey_type_location')
    )

    # 3. Create survey_type_species_type junction table
    op.create_table(
        'survey_type_species_type',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('survey_type_id', sa.Integer(), sa.ForeignKey('survey_type.id', ondelete='CASCADE'), nullable=False),
        sa.Column('species_type_id', sa.Integer(), sa.ForeignKey('species_type.id', ondelete='CASCADE'), nullable=False),
        sa.UniqueConstraint('survey_type_id', 'species_type_id', name='uq_survey_type_species_type')
    )

    # 4. Add survey_type_id to survey table (nullable for existing data)
    op.add_column('survey', sa.Column('survey_type_id', sa.Integer(), sa.ForeignKey('survey_type.id'), nullable=True))

    # 5. Make survey.location_id nullable (for sighting-level location surveys)
    op.alter_column('survey', 'location_id',
                    existing_type=sa.Integer(),
                    nullable=True)

    # 6. Add location_id to sighting table (for sighting-level locations)
    op.add_column('sighting', sa.Column('location_id', sa.Integer(), sa.ForeignKey('location.id', ondelete='SET NULL'), nullable=True))


def downgrade() -> None:
    # Remove location_id from sighting
    op.drop_column('sighting', 'location_id')

    # Make survey.location_id NOT NULL again (may fail if there are NULL values)
    op.alter_column('survey', 'location_id',
                    existing_type=sa.Integer(),
                    nullable=False)

    # Remove survey_type_id from survey
    op.drop_column('survey', 'survey_type_id')

    # Drop junction tables
    op.drop_table('survey_type_species_type')
    op.drop_table('survey_type_location')

    # Drop survey_type table
    op.drop_table('survey_type')
