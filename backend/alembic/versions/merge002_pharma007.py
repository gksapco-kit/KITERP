"""Merge pharma007_org_regions and pharma007_pharma_managed branches.

Revision ID: merge002_pharma007
Revises: pharma007_org_regions, pharma007_pharma_managed
Create Date: 2026-07-29
"""
from alembic import op

revision = "merge002_pharma007"
down_revision = ("pharma007_org_regions", "pharma007_pharma_managed")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
