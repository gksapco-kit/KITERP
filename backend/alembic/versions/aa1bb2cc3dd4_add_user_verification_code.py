"""add verification_code fields to user table

Revision ID: aa1bb2cc3dd4
Revises: c3d4e5f6g7h8
Create Date: 2026-04-14

"""
from alembic import op
import sqlalchemy as sa

revision = "aa1bb2cc3dd4"
down_revision = "c3d4e5f6g7h8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user", sa.Column("verification_code", sa.String(6), nullable=True))
    op.add_column("user", sa.Column("verification_code_expires_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("user", "verification_code_expires_at")
    op.drop_column("user", "verification_code")
