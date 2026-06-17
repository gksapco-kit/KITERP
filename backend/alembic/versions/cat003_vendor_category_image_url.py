"""add vendor_category image_url

Revision ID: cat003_category_image
Revises: sch001_schema_field_mapping
Create Date: 2026-06-17

"""
from alembic import op
import sqlalchemy as sa

revision = "cat003_category_image"
down_revision = "sch001_schema_field_mapping"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("vendor_category", sa.Column("image_url", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("vendor_category", "image_url")
