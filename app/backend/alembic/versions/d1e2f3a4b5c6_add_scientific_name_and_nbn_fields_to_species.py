"""add_scientific_name_and_nbn_fields_to_species

Revision ID: d1e2f3a4b5c6
Revises: a1b2c3d4e5f6
Create Date: 2025-11-22 00:00:00.000000

This migration adds columns to the species table to store NBN Atlas data:
- scientific_name: The scientific/Latin name from NBN Atlas
- nbn_atlas_guid: The NBN Atlas GUID for future syncing and reference

These columns are initially nullable and will be populated by the data migration script.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add NBN Atlas related fields to species table."""
    # Add scientific_name column
    op.add_column('species', sa.Column('scientific_name', sa.String(length=255), nullable=True))

    # Add nbn_atlas_guid column (NBN Atlas identifier for future syncing)
    op.add_column('species', sa.Column('nbn_atlas_guid', sa.String(length=255), nullable=True))

    # Create index on scientific_name for faster lookups
    op.create_index(op.f('ix_species_scientific_name'), 'species', ['scientific_name'], unique=False)

    # Create index on nbn_atlas_guid for faster lookups
    op.create_index(op.f('ix_species_nbn_atlas_guid'), 'species', ['nbn_atlas_guid'], unique=False)


def downgrade() -> None:
    """Remove NBN Atlas related fields from species table."""
    # Drop indexes
    op.drop_index(op.f('ix_species_nbn_atlas_guid'), table_name='species')
    op.drop_index(op.f('ix_species_scientific_name'), table_name='species')

    # Drop columns
    op.drop_column('species', 'nbn_atlas_guid')
    op.drop_column('species', 'scientific_name')
