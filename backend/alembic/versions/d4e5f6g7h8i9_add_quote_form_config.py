"""add quote_form_config to service

Revision ID: d4e5f6g7h8i9
Revises: c3q4r5s6t7u8
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "d4e5f6g7h8i9"
down_revision = "c3q4r5s6t7u8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("service", sa.Column("quote_form_config", JSONB, server_default="[]"))


def downgrade() -> None:
    op.drop_column("service", "quote_form_config")
