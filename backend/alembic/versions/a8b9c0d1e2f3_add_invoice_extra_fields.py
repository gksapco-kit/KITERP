"""add extra_fields jsonb to invoice for quotation custom fields

Revision ID: a8b9c0d1e2f3
Revises: z7a8b9c0d1e2
Create Date: 2026-06-05

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "a8b9c0d1e2f3"
down_revision = "z7a8b9c0d1e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("invoice", sa.Column("extra_fields", JSONB, server_default="[]", nullable=True))


def downgrade() -> None:
    op.drop_column("invoice", "extra_fields")
