"""add vendor_category is_visible for storefront

Revision ID: cat004_storefront_visible
Revises: mat001_material_code
Create Date: 2026-06-26

"""
from alembic import op
import sqlalchemy as sa

revision = "cat004_storefront_visible"
down_revision = "mat001_material_code"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "vendor_category",
        sa.Column("is_visible", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )


def downgrade() -> None:
    op.drop_column("vendor_category", "is_visible")
