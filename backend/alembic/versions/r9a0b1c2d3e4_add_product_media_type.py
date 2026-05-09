"""add product image media_type column

Revision ID: r9a0b1c2d3e4
Revises: q8i9j0k1l2m3
Create Date: 2026-04-09 17:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "r9a0b1c2d3e4"
down_revision = "q8i9j0k1l2m3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("product_image", sa.Column("media_type", sa.String(20), server_default="image", nullable=True))


def downgrade() -> None:
    op.drop_column("product_image", "media_type")
