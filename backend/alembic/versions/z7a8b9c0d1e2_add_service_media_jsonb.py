"""add service media jsonb

Revision ID: z7a8b9c0d1e2
Revises: y6j7k8l9m0n1
Create Date: 2026-04-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "z7a8b9c0d1e2"
down_revision = "y6j7k8l9m0n1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("service", sa.Column("media", JSONB, server_default="[]", nullable=True))


def downgrade() -> None:
    op.drop_column("service", "media")
