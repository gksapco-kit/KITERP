"""add allow_quote_request and quote_form_config to product

Revision ID: e5f6g7h8i9j0
Revises: d4e5f6g7h8i9
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "e5f6g7h8i9j0"
down_revision = "d4e5f6g7h8i9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("product", sa.Column("allow_quote_request", sa.Boolean(), server_default="false"))
    op.add_column("product", sa.Column("quote_form_config", JSONB, server_default="[]"))


def downgrade() -> None:
    op.drop_column("product", "quote_form_config")
    op.drop_column("product", "allow_quote_request")
