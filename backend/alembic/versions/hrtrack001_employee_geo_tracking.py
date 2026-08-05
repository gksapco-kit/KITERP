"""Add employee geo-tracking: location ping table + tracking fields on profile

Revision ID: hrtrack001_employee_geo_tracking
Revises: e1f2a3b4c5d6
Create Date: 2026-08-05

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "hrtrack001_employee_geo_tracking"
down_revision = "e1f2a3b4c5d6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Tracking columns on employee profile ──────────────────────────
    op.add_column("hr_employee_profile", sa.Column("tracking_enabled", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("hr_employee_profile", sa.Column("last_lat", sa.Numeric(10, 8), nullable=True))
    op.add_column("hr_employee_profile", sa.Column("last_lng", sa.Numeric(11, 8), nullable=True))
    op.add_column("hr_employee_profile", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))

    # ── Location ping table ───────────────────────────────────────────
    op.create_table(
        "hr_employee_location_ping",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "employee_id",
            UUID(as_uuid=True),
            sa.ForeignKey("hr_employee_profile.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "vendor_id",
            UUID(as_uuid=True),
            sa.ForeignKey("vendor.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("lat", sa.Numeric(10, 8), nullable=False),
        sa.Column("lng", sa.Numeric(11, 8), nullable=False),
        sa.Column("accuracy", sa.Numeric(8, 2), nullable=True),
        sa.Column("speed", sa.Numeric(6, 2), nullable=True),
        sa.Column("heading", sa.Numeric(5, 2), nullable=True),
        sa.Column("battery", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(10), server_default="app"),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_hr_loc_ping_emp_time", "hr_employee_location_ping", ["employee_id", "recorded_at"])
    op.create_index("ix_hr_loc_ping_vendor_time", "hr_employee_location_ping", ["vendor_id", "recorded_at"])


def downgrade() -> None:
    op.drop_index("ix_hr_loc_ping_vendor_time")
    op.drop_index("ix_hr_loc_ping_emp_time")
    op.drop_table("hr_employee_location_ping")
    op.drop_column("hr_employee_profile", "last_seen_at")
    op.drop_column("hr_employee_profile", "last_lng")
    op.drop_column("hr_employee_profile", "last_lat")
    op.drop_column("hr_employee_profile", "tracking_enabled")
