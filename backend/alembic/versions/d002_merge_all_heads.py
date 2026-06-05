"""Merge Alembic heads for dev databases

Revision ID: d002_merge_all_heads
Revises: c001_tier_c_plus, pm001_add_project_tables, web007
Create Date: 2026-06-05
"""
from alembic import op

revision = "d002_merge_all_heads"
down_revision = ("c001_tier_c_plus", "pm001_add_project_tables", "web007")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
