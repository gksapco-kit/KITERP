"""add product addons jsonb column

Revision ID: p2a3d4d5o6n7
Revises: dom002_widen_verif_code, po001_production_orders
Create Date: 2026-06-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "p2a3d4d5o6n7"
down_revision = ("dom002_widen_verif_code", "po001_production_orders")
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("product", sa.Column("addons", JSONB, server_default="[]", nullable=False))


def downgrade() -> None:
    op.drop_column("product", "addons")
