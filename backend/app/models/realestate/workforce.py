"""Real Estate — Phase 7 models: HR & workforce (22) — site assignments, labour, attendance and wage sheets."""
from __future__ import annotations

from sqlalchemy import Boolean, Column, Date, Integer, Numeric, UniqueConstraint

from .base import UUID, Base, REMixin, choice, fk, money, txt

ASSIGNMENT_STATUSES = ["active", "ended"]
TRADES = ["mason", "carpenter", "electrician", "plumber", "painter", "welder", "bar_bender", "helper", "operator", "supervisor", "other"]
SKILL_LEVELS = ["skilled", "semi_skilled", "unskilled"]
LABOUR_STATUSES = ["active", "left"]
ATTENDANCE_STATUSES = ["present", "half_day", "absent", "leave"]
WAGE_SHEET_STATUSES = ["draft", "approved", "paid", "cancelled"]
MAX_OT_HOURS = 12
OT_MULTIPLE = 2  # overtime is paid at twice the ordinary rate (Minimum Wages Act / Contract Labour rules)
STANDARD_HOURS = 8


class ReSiteAssignment(REMixin, Base):
    """An employee (from the HR module, or a named person) posted to a project site."""

    __tablename__ = "re_site_assignment"

    employee_id = Column(UUID(as_uuid=True), nullable=True, index=True)  # hr_employee_profile.id (checked in the hook)
    employee_name = txt(200)  # filled from HR when employee_id is given; the hook requires one or the other
    employee_code = txt(30)
    designation = txt(120)
    project_id = fk("re_project", nullable=False, ondelete="CASCADE")
    site_role = txt(120)
    from_date = Column(Date, nullable=False)
    to_date = Column(Date)
    status = choice(ASSIGNMENT_STATUSES, "active", 15)
    notes = txt(500)


class ReLabour(REMixin, Base):
    __tablename__ = "re_labour"
    __table_args__ = (UniqueConstraint("vendor_id", "labour_code", name="uq_re_labour_code"),)

    labour_code = txt(30, nullable=False)
    name = txt(200, nullable=False)
    trade = choice(TRADES, "helper", 20)
    skill_level = choice(SKILL_LEVELS, "unskilled", 15)
    project_id = fk("re_project")
    contractor_id = fk("re_contractor")
    phone = txt(30)
    aadhaar_last4 = txt(4)
    daily_wage = money(nullable=False)
    joined_on = Column(Date)
    left_on = Column(Date)
    status = choice(LABOUR_STATUSES, "active", 15)


class ReLabourAttendance(REMixin, Base):
    __tablename__ = "re_labour_attendance"
    __table_args__ = (UniqueConstraint("labour_id", "work_date", name="uq_re_labour_attendance_day"),)

    labour_id = fk("re_labour", nullable=False, ondelete="CASCADE")
    project_id = fk("re_project")
    work_date = Column(Date, nullable=False)
    status = choice(ATTENDANCE_STATUSES, "present", 15)
    overtime_hours = Column(Numeric(5, 2), default=0)
    locked = Column(Boolean, nullable=False, default=False)  # set once the day is part of a wage sheet
    wage_sheet_id = fk("re_wage_sheet", ondelete="SET NULL")


class ReWageSheet(REMixin, Base):
    __tablename__ = "re_wage_sheet"
    __table_args__ = (UniqueConstraint("vendor_id", "sheet_no", name="uq_re_wage_sheet_no"),)

    sheet_no = txt(30, nullable=False)
    project_id = fk("re_project", nullable=False, ondelete="CASCADE")
    contractor_id = fk("re_contractor")
    period_from = Column(Date, nullable=False)
    period_to = Column(Date, nullable=False)
    status = choice(WAGE_SHEET_STATUSES, "draft", 15)
    workers = Column(Integer, default=0)
    total_gross = money(default=0)
    total_deductions = money(default=0)
    total_net = money(default=0)
    approved_on = Column(Date)
    paid_on = Column(Date)
    payment_mode = txt(15)
    payment_reference = txt(120)


class ReWageLine(REMixin, Base):
    __tablename__ = "re_wage_line"
    __table_args__ = (UniqueConstraint("sheet_id", "labour_id", name="uq_re_wage_line_worker"),)

    sheet_id = fk("re_wage_sheet", nullable=False, ondelete="CASCADE")
    labour_id = fk("re_labour", nullable=False, ondelete="CASCADE")
    days_worked = Column(Numeric(6, 2), default=0)
    overtime_hours = Column(Numeric(7, 2), default=0)
    daily_wage = money(default=0)
    basic_amount = money(default=0)
    overtime_amount = money(default=0)
    gross_amount = money(default=0)
    advance_recovery = money(default=0)
    other_deduction = money(default=0)
    net_amount = money(default=0)
