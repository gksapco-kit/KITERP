"""
HR service tests: payroll math (money), leave-balance lifecycle, and the
reporting-manager cycle guard.

Runs on the in-memory SQLite harness from conftest.
"""

import uuid
from datetime import date

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.hr import (
    EmployeeProfile,
    LeaveBalance,
    LeavePolicy,
    LeaveRequest,
    SalaryStructure,
)
from app.models.vendor import Vendor
from app.services.hr_service import HRService


@pytest_asyncio.fixture
async def employee(db_session, test_vendor: Vendor) -> EmployeeProfile:
    emp = EmployeeProfile(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        full_name="Pay Roll",
        employee_code="EMP-001",
        status="active",
        is_active=True,
    )
    db_session.add(emp)
    await db_session.commit()
    await db_session.refresh(emp)
    return emp


# ── Payroll ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_process_payroll_computes_totals(db_session, test_vendor, employee):
    db_session.add(SalaryStructure(
        id=uuid.uuid4(),
        employee_id=employee.id,
        effective_from=date(2020, 1, 1),
        is_active=True,
        earnings={"basic": 10000, "hra": 2000},
        deductions={"pf": 1000},
    ))
    await db_session.commit()

    svc = HRService(db_session)
    # No attendance rows → full attendance assumed (ratio 1.0).
    run = await svc.process_payroll(test_vendor.id, month=6, year=2026, processed_by=uuid.uuid4())
    await db_session.commit()

    assert run.status == "processed"
    assert run.employee_count == 1
    assert float(run.total_gross) == 12000.0
    assert float(run.total_deductions) == 1000.0
    assert float(run.total_net) == 11000.0


@pytest.mark.asyncio
async def test_process_payroll_no_salary_structure_is_zero(db_session, test_vendor, employee):
    svc = HRService(db_session)
    run = await svc.process_payroll(test_vendor.id, month=6, year=2026, processed_by=uuid.uuid4())
    await db_session.commit()

    assert run.employee_count == 1
    assert float(run.total_gross) == 0.0
    assert float(run.total_net) == 0.0


# ── Leave balance lifecycle ──────────────────────────────────────

@pytest_asyncio.fixture
async def leave_policy(db_session, test_vendor: Vendor) -> LeavePolicy:
    policy = LeavePolicy(
        id=uuid.uuid4(),
        vendor_id=test_vendor.id,
        name="Annual Leave",
        code="AL",
        days_per_year=12,
        is_active=True,
    )
    db_session.add(policy)
    await db_session.commit()
    await db_session.refresh(policy)
    return policy


@pytest.mark.asyncio
async def test_leave_approve_deducts_then_cancel_restores(
    db_session, test_vendor, employee, leave_policy
):
    svc = HRService(db_session)

    req = await svc.submit_leave_request(employee.id, test_vendor.id, {
        "leave_policy_id": leave_policy.id,
        "from_date": date(2026, 6, 10),
        "to_date": date(2026, 6, 11),
        "days": 2,
    })
    await db_session.commit()
    assert req.status == "pending"

    # Balance auto-created with 12 allocated, 0 used.
    bal = (await db_session.execute(
        select(LeaveBalance).where(
            LeaveBalance.employee_id == employee.id,
            LeaveBalance.leave_policy_id == leave_policy.id,
        )
    )).scalar_one()
    assert float(bal.used) == 0.0

    await svc.approve_leave(req.id, test_vendor.id, approved_by=uuid.uuid4())
    await db_session.commit()
    await db_session.refresh(bal)
    assert float(bal.used) == 2.0

    await svc.cancel_leave(req.id, employee.id)
    await db_session.commit()
    await db_session.refresh(bal)
    assert float(bal.used) == 0.0


@pytest.mark.asyncio
async def test_leave_insufficient_balance_rejected(
    db_session, test_vendor, employee, leave_policy
):
    svc = HRService(db_session)
    with pytest.raises(Exception) as exc:
        await svc.submit_leave_request(employee.id, test_vendor.id, {
            "leave_policy_id": leave_policy.id,
            "from_date": date(2026, 6, 1),
            "to_date": date(2026, 6, 30),
            "days": 20,  # only 12 allocated
        })
    assert "Insufficient leave balance" in str(getattr(exc.value, "detail", exc.value))


@pytest.mark.asyncio
async def test_approve_non_pending_leave_rejected(
    db_session, test_vendor, employee, leave_policy
):
    svc = HRService(db_session)
    req = await svc.submit_leave_request(employee.id, test_vendor.id, {
        "leave_policy_id": leave_policy.id,
        "from_date": date(2026, 6, 10),
        "to_date": date(2026, 6, 10),
        "days": 1,
    })
    await db_session.commit()
    await svc.approve_leave(req.id, test_vendor.id, approved_by=uuid.uuid4())
    await db_session.commit()

    with pytest.raises(Exception) as exc:
        await svc.approve_leave(req.id, test_vendor.id, approved_by=uuid.uuid4())
    assert "approved" in str(getattr(exc.value, "detail", exc.value)).lower()


# ── Reporting-manager cycle guard ────────────────────────────────

@pytest.mark.asyncio
async def test_employee_cannot_be_own_manager(db_session, test_vendor, employee):
    svc = HRService(db_session)
    with pytest.raises(Exception) as exc:
        await svc.update_employee(employee.id, test_vendor.id, {"manager_id": employee.id})
    assert "own reporting manager" in str(getattr(exc.value, "detail", exc.value)).lower()
