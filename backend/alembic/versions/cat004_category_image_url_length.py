"""widen vendor_category.image_url for long CDN / storage URLs

Revision ID: cat004_category_image_url_len
Revises: fin019_asset_units_of_production
Create Date: 2026-07-02

"""
from alembic import op
import sqlalchemy as sa

revision = "cat004_category_image_url_len"
down_revision = "fin019_asset_units_of_production"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "vendor_category",
        "image_url",
        existing_type=sa.String(500),
        type_=sa.String(2000),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "vendor_category",
        "image_url",
        existing_type=sa.String(2000),
        type_=sa.String(500),
        existing_nullable=True,
    )
