"""add variant price_type

Revision ID: w4f5g6h7i8j9
Revises: v3e4f5g6h7i8
Create Date: 2026-04-10

"""
from alembic import op
import sqlalchemy as sa

revision = "w4f5g6h7i8j9"
down_revision = "v3e4f5g6h7i8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "product_variant",
        sa.Column("price_type", sa.String(20), server_default="per_unit", nullable=True),
    )


def downgrade() -> None:
    op.drop_column("product_variant", "price_type")
