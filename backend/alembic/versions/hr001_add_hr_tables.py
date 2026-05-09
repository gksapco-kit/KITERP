"""Add HR tables: department, designation, employee_profile, attendance, leave, salary, payroll, offer

Revision ID: hr001_add_hr_tables
Revises: dd5ee6ff7gg8
Create Date: 2026-04-11

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "hr001_add_hr_tables"
down_revision = "dd5ee6ff7gg8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Departments ──────────────────────────────────────────────────
    op.create_table(
        "hr_department",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("code", sa.String(20)),
        sa.Column("description", sa.Text()),
        sa.Column("parent_id", UUID(as_uuid=True), sa.ForeignKey("hr_department.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_active", sa.Boolean(), default=True, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_hr_dept_vendor", "hr_department", ["vendor_id"])

    # ── Designations ─────────────────────────────────────────────────
    op.create_table(
        "hr_designation",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("level", sa.Integer(), default=1, server_default="1"),
        sa.Column("is_active", sa.Boolean(), default=True, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_hr_desig_vendor", "hr_designation", ["vendor_id"])

    # ── Employee Profiles ─────────────────────────────────────────────
    op.create_table(
        "hr_employee_profile",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vendor_user_id", UUID(as_uuid=True), sa.ForeignKey("vendor_user.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("employee_code", sa.String(30)),
        # Personal
        sa.Column("date_of_birth", sa.Date()),
        sa.Column("gender", sa.String(20)),
        sa.Column("blood_group", sa.String(5)),
        sa.Column("marital_status", sa.String(20)),
        sa.Column("nationality", sa.String(50), server_default="Indian"),
        # Contact
        sa.Column("personal_email", sa.String(255)),
        sa.Column("personal_phone", sa.String(20)),
        sa.Column("emergency_contact_name", sa.String(100)),
        sa.Column("emergency_contact_phone", sa.String(20)),
        sa.Column("emergency_contact_relation", sa.String(50)),
        # Addresses
        sa.Column("current_address", JSONB(), server_default="{}"),
        sa.Column("permanent_address", JSONB(), server_default="{}"),
        # Employment
        sa.Column("department_id", UUID(as_uuid=True), sa.ForeignKey("hr_department.id", ondelete="SET NULL"), nullable=True),
        sa.Column("designation_id", UUID(as_uuid=True), sa.ForeignKey("hr_designation.id", ondelete="SET NULL"), nullable=True),
        sa.Column("employment_type", sa.String(20), server_default="full_time"),
        sa.Column("date_of_joining", sa.Date()),
        sa.Column("date_of_exit", sa.Date()),
        sa.Column("probation_end_date", sa.Date()),
        sa.Column("notice_period_days", sa.Integer(), server_default="30"),
        sa.Column("status", sa.String(20), server_default="active"),
        # Bank / Compliance
        sa.Column("bank_name", sa.String(100)),
        sa.Column("account_number", sa.String(30)),
        sa.Column("ifsc_code", sa.String(15)),
        sa.Column("pan_number", sa.String(12)),
        sa.Column("uan_number", sa.String(20)),
        sa.Column("esi_number", sa.String(20)),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_hr_emp_vendor", "hr_employee_profile", ["vendor_id"])
    op.create_index("ix_hr_emp_status", "hr_employee_profile", ["vendor_id", "status"])

    # ── Employee Documents ────────────────────────────────────────────
    op.create_table(
        "hr_employee_document",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("hr_employee_profile.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_type", sa.String(30), nullable=False),
        sa.Column("document_name", sa.String(255), nullable=False),
        sa.Column("file_url", sa.String(500)),
        sa.Column("expiry_date", sa.Date()),
        sa.Column("notes", sa.Text()),
        sa.Column("verified_by", UUID(as_uuid=True), sa.ForeignKey("vendor_user.id"), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_hr_doc_employee", "hr_employee_document", ["employee_id"])

    # ── Attendance Records ────────────────────────────────────────────
    op.create_table(
        "hr_attendance_record",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("hr_employee_profile.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("clock_in", sa.DateTime(timezone=True)),
        sa.Column("clock_out", sa.DateTime(timezone=True)),
        sa.Column("clock_in_location", JSONB()),
        sa.Column("clock_out_location", JSONB()),
        sa.Column("status", sa.String(20), server_default="present"),
        sa.Column("work_hours", sa.Numeric(4, 2)),
        sa.Column("overtime_hours", sa.Numeric(4, 2), server_default="0"),
        sa.Column("notes", sa.Text()),
        sa.Column("marked_by", UUID(as_uuid=True), sa.ForeignKey("vendor_user.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("employee_id", "date", name="uq_attendance_employee_date"),
    )
    op.create_index("ix_hr_att_date", "hr_attendance_record", ["employee_id", "date"])

    # ── Leave Policies ────────────────────────────────────────────────
    op.create_table(
        "hr_leave_policy",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("code", sa.String(20), nullable=False),
        sa.Column("days_per_year", sa.Numeric(5, 1), server_default="12"),
        sa.Column("carry_forward", sa.Boolean(), server_default="false"),
        sa.Column("max_carry_forward_days", sa.Numeric(5, 1), server_default="0"),
        sa.Column("is_paid", sa.Boolean(), server_default="true"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_hr_leave_policy_vendor", "hr_leave_policy", ["vendor_id"])

    # ── Leave Balances ────────────────────────────────────────────────
    op.create_table(
        "hr_leave_balance",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("hr_employee_profile.id", ondelete="CASCADE"), nullable=False),
        sa.Column("leave_policy_id", UUID(as_uuid=True), sa.ForeignKey("hr_leave_policy.id", ondelete="CASCADE"), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("allocated", sa.Numeric(5, 1), server_default="0"),
        sa.Column("used", sa.Numeric(5, 1), server_default="0"),
        sa.Column("carried_forward", sa.Numeric(5, 1), server_default="0"),
        sa.UniqueConstraint("employee_id", "leave_policy_id", "year", name="uq_leave_balance_emp_policy_year"),
    )

    # ── Leave Requests ────────────────────────────────────────────────
    op.create_table(
        "hr_leave_request",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("hr_employee_profile.id", ondelete="CASCADE"), nullable=False),
        sa.Column("leave_policy_id", UUID(as_uuid=True), sa.ForeignKey("hr_leave_policy.id"), nullable=False),
        sa.Column("from_date", sa.Date(), nullable=False),
        sa.Column("to_date", sa.Date(), nullable=False),
        sa.Column("days", sa.Numeric(5, 1), nullable=False),
        sa.Column("reason", sa.Text()),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("approved_by", UUID(as_uuid=True), sa.ForeignKey("vendor_user.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
        sa.Column("rejection_reason", sa.Text()),
        sa.Column("is_half_day", sa.Boolean(), server_default="false"),
        sa.Column("half_day_type", sa.String(20)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_hr_leave_req_status", "hr_leave_request", ["employee_id", "status"])

    # ── Holidays ──────────────────────────────────────────────────────
    op.create_table(
        "hr_holiday",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("is_optional", sa.Boolean(), server_default="false"),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_hr_holiday_vendor_year", "hr_holiday", ["vendor_id", "year"])

    # ── Salary Structures ─────────────────────────────────────────────
    op.create_table(
        "hr_salary_structure",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("hr_employee_profile.id", ondelete="CASCADE"), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("earnings", JSONB(), server_default="{}"),
        sa.Column("deductions", JSONB(), server_default="{}"),
        sa.Column("ctc_annual", sa.Numeric(14, 2), server_default="0"),
        sa.Column("ctc_monthly", sa.Numeric(12, 2), server_default="0"),
        sa.Column("gross_monthly", sa.Numeric(12, 2), server_default="0"),
        sa.Column("net_monthly", sa.Numeric(12, 2), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_hr_salary_employee", "hr_salary_structure", ["employee_id", "is_active"])

    # ── Payroll Runs ──────────────────────────────────────────────────
    op.create_table(
        "hr_payroll_run",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), server_default="draft"),
        sa.Column("processed_by", UUID(as_uuid=True), sa.ForeignKey("vendor_user.id"), nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True)),
        sa.Column("total_gross", sa.Numeric(14, 2), server_default="0"),
        sa.Column("total_deductions", sa.Numeric(14, 2), server_default="0"),
        sa.Column("total_net", sa.Numeric(14, 2), server_default="0"),
        sa.Column("employee_count", sa.Integer(), server_default="0"),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("vendor_id", "month", "year", name="uq_payroll_vendor_month_year"),
    )
    op.create_index("ix_hr_payroll_vendor", "hr_payroll_run", ["vendor_id", "year", "month"])

    # ── Payroll Entries (payslips) ────────────────────────────────────
    op.create_table(
        "hr_payroll_entry",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("payroll_run_id", UUID(as_uuid=True), sa.ForeignKey("hr_payroll_run.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("hr_employee_profile.id", ondelete="CASCADE"), nullable=False),
        sa.Column("earnings", JSONB(), server_default="{}"),
        sa.Column("deductions", JSONB(), server_default="{}"),
        sa.Column("days_worked", sa.Numeric(5, 1), server_default="0"),
        sa.Column("days_absent", sa.Numeric(5, 1), server_default="0"),
        sa.Column("leave_days", sa.Numeric(5, 1), server_default="0"),
        sa.Column("overtime_hours", sa.Numeric(5, 2), server_default="0"),
        sa.Column("gross_amount", sa.Numeric(12, 2), server_default="0"),
        sa.Column("total_deductions", sa.Numeric(12, 2), server_default="0"),
        sa.Column("net_amount", sa.Numeric(12, 2), server_default="0"),
        sa.Column("status", sa.String(20), server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_hr_payslip_run", "hr_payroll_entry", ["payroll_run_id"])
    op.create_index("ix_hr_payslip_employee", "hr_payroll_entry", ["employee_id"])

    # ── Offer Letters ─────────────────────────────────────────────────
    op.create_table(
        "hr_offer_letter",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("vendor_id", UUID(as_uuid=True), sa.ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False),
        sa.Column("candidate_name", sa.String(100), nullable=False),
        sa.Column("candidate_email", sa.String(255)),
        sa.Column("candidate_phone", sa.String(20)),
        sa.Column("designation_id", UUID(as_uuid=True), sa.ForeignKey("hr_designation.id", ondelete="SET NULL"), nullable=True),
        sa.Column("department_id", UUID(as_uuid=True), sa.ForeignKey("hr_department.id", ondelete="SET NULL"), nullable=True),
        sa.Column("offered_ctc", sa.Numeric(14, 2)),
        sa.Column("offered_date", sa.Date()),
        sa.Column("joining_date", sa.Date()),
        sa.Column("expiry_date", sa.Date()),
        sa.Column("status", sa.String(20), server_default="draft"),
        sa.Column("template_content", sa.Text()),
        sa.Column("notes", sa.Text()),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
        sa.Column("responded_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_hr_offer_vendor", "hr_offer_letter", ["vendor_id"])


def downgrade() -> None:
    op.drop_table("hr_offer_letter")
    op.drop_table("hr_payroll_entry")
    op.drop_table("hr_payroll_run")
    op.drop_table("hr_salary_structure")
    op.drop_table("hr_holiday")
    op.drop_table("hr_leave_request")
    op.drop_table("hr_leave_balance")
    op.drop_table("hr_leave_policy")
    op.drop_table("hr_attendance_record")
    op.drop_table("hr_employee_document")
    op.drop_table("hr_employee_profile")
    op.drop_table("hr_designation")
    op.drop_table("hr_department")
