"""Phase 1 gaps — delivery assignment, booking OTP, store holidays

Revision ID: p001_phase1_gaps
Revises: d002_merge_all_heads
Create Date: 2026-06-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "p001_phase1_gaps"
down_revision = "d002_merge_all_heads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("order", sa.Column("delivery_staff_id", UUID(as_uuid=True), nullable=True))
    op.add_column("order", sa.Column("delivery_staff_name", sa.String(255), nullable=True))
    op.add_column("order", sa.Column("delivery_assigned_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("order", sa.Column("delivery_status", sa.String(30), nullable=True))

    op.add_column("booking", sa.Column("completion_otp", sa.String(10), nullable=True))
    op.add_column("booking", sa.Column("completion_otp_expires_at", sa.DateTime(timezone=True), nullable=True))

    op.add_column("vendor", sa.Column("store_holidays", JSONB, server_default="[]", nullable=False))


def downgrade() -> None:
    op.drop_column("vendor", "store_holidays")
    op.drop_column("booking", "completion_otp_expires_at")
    op.drop_column("booking", "completion_otp")
    op.drop_column("order", "delivery_status")
    op.drop_column("order", "delivery_assigned_at")
    op.drop_column("order", "delivery_staff_name")
    op.drop_column("order", "delivery_staff_id")
