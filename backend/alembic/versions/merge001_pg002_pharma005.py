"""Merge pg002_product_group_hierarchy and pharma005_batch_number_models into a single head.

Revision ID: merge001_pg002_pharma005
Revises: pg002_product_group_hierarchy, pharma005_batch_number_models
Create Date: 2026-07-28
"""
from alembic import op

revision = "merge001_pg002_pharma005"
down_revision = ("pg002_product_group_hierarchy", "pharma005_batch_number_models")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
