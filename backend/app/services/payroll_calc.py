"""Shared payroll amount computation from salary structure + attendance."""

from __future__ import annotations

from calendar import monthrange
from datetime import date
from decimal import Decimal
from typing import Any

from app.models.hr import PayrollEntry, SalaryStructure

PAID_ATTENDANCE_STATUSES = ("present", "late", "half_day", "on_leave", "week_off", "holiday")


def payroll_period_end(month: int, year: int) -> date:
    _, dim = monthrange(year, month)
    return date(year, month, dim)


def entry_snapshot_is_empty(entry: PayrollEntry) -> bool:
    if float(entry.gross_amount or 0) > 0 or float(entry.net_amount or 0) > 0:
        return False
    earn = entry.earnings or {}
    ded = entry.deductions or {}
    total_e = sum(float(v or 0) for v in earn.values())
    total_d = sum(float(v or 0) for v in ded.values())
    return total_e <= 0 and total_d <= 0


def attendance_totals(att_records: list[Any]) -> tuple[int, int, int, float]:
    days_present = sum(1 for a in att_records if a.status in PAID_ATTENDANCE_STATUSES)
    days_absent = sum(1 for a in att_records if a.status == "absent")
    leave_days = sum(1 for a in att_records if a.status == "on_leave")
    overtime = sum(float(getattr(a, "overtime_hours", 0) or 0) for a in att_records)
    return days_present, days_absent, leave_days, overtime


def compute_payroll_snapshot(
    salary: SalaryStructure,
    *,
    att_records: list[Any],
    days_in_month: int,
    assume_full_month_if_no_attendance: bool = True,
) -> tuple[dict[str, float], dict[str, float], int, int, int, float, Decimal, Decimal, Decimal]:
    """
    Build earnings/deduction snapshots and totals for one employee.
    Returns (earnings, deductions, days_present, days_absent, leave_days, overtime, gross, ded, net).
    """
    days_present, days_absent, leave_days, overtime = attendance_totals(att_records)

    if not att_records and assume_full_month_if_no_attendance:
        days_present = days_in_month
        days_absent = 0
        scheduled_days = days_in_month
    elif not att_records:
        scheduled_days = days_in_month
    else:
        scheduled_days = len(att_records) or days_in_month

    if scheduled_days <= 0:
        scheduled_days = days_in_month

    ratio = Decimal(str(days_present)) / Decimal(str(scheduled_days))
    earnings_snap = {k: round(float(v) * float(ratio), 2) for k, v in (salary.earnings or {}).items()}
    ded_snap = {k: round(float(v), 2) for k, v in (salary.deductions or {}).items()}

    gross = Decimal(str(sum(earnings_snap.values())))
    ded = Decimal(str(sum(ded_snap.values())))
    net = gross - ded
    return earnings_snap, ded_snap, days_present, days_absent, leave_days, overtime, gross, ded, net


def financials_dict(
    earnings: dict[str, float],
    deductions: dict[str, float],
    gross: Decimal,
    ded: Decimal,
    net: Decimal,
) -> dict[str, Any]:
    return {
        "earnings": earnings,
        "deductions": deductions,
        "gross_amount": float(gross),
        "total_deductions": float(ded),
        "net_amount": float(net),
    }
