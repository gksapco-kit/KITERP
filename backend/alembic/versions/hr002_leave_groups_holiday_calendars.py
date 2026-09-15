"""HR: holiday calendars, department-scoped leave policies, employee calendar assignment

Revision ID: hr002_leave_groups_holiday_calendars
Revises: hrtrack001_employee_geo_tracking
Create Date: 2026-09-15

Adds:
  - hr_holiday_calendar — named calendar entities per vendor
  - hr_holiday.calendar_id — FK to calendar (NULL = applies to all)
  - hr_leave_policy.department_id — scope a policy to a department (NULL = all)
  - hr_employee_profile.holiday_calendar_id — employee's assigned calendar (NULL = use default)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "hr002_leave_groups_holiday_calendars"
down_revision = "hrtrack001_employee_geo_tracking"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Holiday Calendar ───────────────────────────────────────────────
    op.create_table(
        "hr_holiday_calendar",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "vendor_id",
            UUID(as_uuid=True),
            sa.ForeignKey("vendor.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("is_default", sa.Boolean(), server_default="false", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_hr_holiday_calendar_vendor", "hr_holiday_calendar", ["vendor_id"])

    # ── calendar_id on hr_holiday ──────────────────────────────────────
    op.add_column(
        "hr_holiday",
        sa.Column(
            "calendar_id",
            UUID(as_uuid=True),
            sa.ForeignKey("hr_holiday_calendar.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # ── department_id on hr_leave_policy ──────────────────────────────
    op.add_column(
        "hr_leave_policy",
        sa.Column(
            "department_id",
            UUID(as_uuid=True),
            sa.ForeignKey("hr_department.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # ── holiday_calendar_id on hr_employee_profile ────────────────────
    op.add_column(
        "hr_employee_profile",
        sa.Column(
            "holiday_calendar_id",
            UUID(as_uuid=True),
            sa.ForeignKey("hr_holiday_calendar.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("hr_employee_profile", "holiday_calendar_id")
    op.drop_column("hr_leave_policy", "department_id")
    op.drop_column("hr_holiday", "calendar_id")
    op.drop_index("ix_hr_holiday_calendar_vendor", table_name="hr_holiday_calendar")
    op.drop_table("hr_holiday_calendar")
