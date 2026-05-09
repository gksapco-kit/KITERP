"""add variant media jsonb column

Revision ID: s0b1c2d3e4f5
Revises: r9a0b1c2d3e4
Create Date: 2026-04-09 18:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "s0b1c2d3e4f5"
down_revision = "r9a0b1c2d3e4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "product_variant",
        sa.Column("media", postgresql.JSONB(), server_default="[]", nullable=True),
    )


def downgrade() -> None:
    op.drop_column("product_variant", "media")
