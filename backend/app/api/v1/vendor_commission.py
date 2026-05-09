# app/api/v1/vendor_commission.py
"""
Sales Commission API — mounted at /vendors/me/commission
Covers: payees, plans, rules, assignments, accruals, payout runs, reports
"""
from __future__ import annotations

import math
import logging
from datetime import date
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_, or_, func as sqlfunc, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_vendor_user, require_permission, get_db
from app.models.vendor_user import VendorUser
from app.models.hr import EmployeeProfile
from app.models.commission import (
    CommissionPayee, CommissionPlan, CommissionRule,
    CommissionAssignment, CommissionAccrual,
    CommissionPayoutRun, CommissionPayoutItem, CommissionApprovalLog,
)
from app.schemas.commission import (
    CommissionPayeeCreate, CommissionPayeeUpdate,
    CommissionPlanCreate, CommissionPlanUpdate,
    CommissionRuleCreate, CommissionRuleUpdate,
    CommissionAssignmentCreate, CommissionAssignmentUpdate,
    PayoutRunCreate, PayoutRunAction,
)
from app.services.commission.payout_service import PayoutService
from app.services.commission.accrual_writer import reverse_accruals

log = logging.getLogger(__name__)
router = APIRouter()


def _d(obj) -> dict:
    """Model → dict, coercing UUIDs/dates/decimals to JSON-safe types."""
    if obj is None:
        return {}
    data = {}
    for col in obj.__table__.columns:
        v = getattr(obj, col.name)
        if v is None:
            data[col.name] = None
        elif hasattr(v, "isoformat"):
            data[col.name] = v.isoformat()
        elif hasattr(v, "__float__"):
            try:
                data[col.name] = float(v)
            except Exception:
                data[col.name] = str(v)
        elif not isinstance(v, (str, int, bool, dict, list)):
            data[col.name] = str(v)
        else:
            data[col.name] = v
    return data


# ═══════════════════════════════════════════════════════════════════════
# PAYEES
# ═══════════════════════════════════════════════════════════════════════

@router.get("/payees/search")
async def search_payees(
    q: str = Query("", description="Search by name, phone, or external_user_id"),
    limit: int = Query(20, ge=1, le=100),
    vu: VendorUser = Depends(require_permission("commission.read")),
    db: AsyncSession = Depends(get_db),
):
    """Typeahead search for payees."""
    query = select(CommissionPayee).where(
        and_(
            CommissionPayee.vendor_id == vu.vendor_id,
            CommissionPayee.status == "active",
            or_(
                CommissionPayee.display_name.ilike(f"%{q}%"),
                CommissionPayee.phone.ilike(f"%{q}%"),
                CommissionPayee.email.ilike(f"%{q}%"),
                CommissionPayee.external_user_id.ilike(f"%{q}%"),
                CommissionPayee.code.ilike(f"%{q}%"),
            ) if q else True,
        )
    ).limit(limit)
    result = await db.execute(query)
    return [_d(p) for p in result.scalars().all()]


@router.get("/payees")
async def list_payees(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    link_type: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("commission.read")),
    db: AsyncSession = Depends(get_db),
):
    conditions = [CommissionPayee.vendor_id == vu.vendor_id]
    if status:
        conditions.append(CommissionPayee.status == status)
    if link_type:
        conditions.append(CommissionPayee.link_type == link_type)

    total = (await db.execute(
        select(sqlfunc.count()).select_from(CommissionPayee).where(and_(*conditions))
    )).scalar_one()
    items = (await db.execute(
        select(CommissionPayee).where(and_(*conditions))
        .order_by(CommissionPayee.display_name)
        .offset((page - 1) * size).limit(size)
    )).scalars().all()
    return {"items": [_d(p) for p in items], "total": total, "page": page, "size": size,
            "pages": math.ceil(total / size) if total else 0}


@router.post("/payees", status_code=201)
async def create_payee(
    data: CommissionPayeeCreate,
    vu: VendorUser = Depends(require_permission("commission.manage")),
    db: AsyncSession = Depends(get_db),
):
    payee = CommissionPayee(vendor_id=vu.vendor_id, **data.model_dump())
    db.add(payee)
    await db.commit()
    await db.refresh(payee)
    return _d(payee)


@router.get("/payees/{payee_id}")
async def get_payee(
    payee_id: UUID,
    vu: VendorUser = Depends(require_permission("commission.read")),
    db: AsyncSession = Depends(get_db),
):
    p = await _fetch_payee(db, vu.vendor_id, payee_id)
    return _d(p)


@router.put("/payees/{payee_id}")
async def update_payee(
    payee_id: UUID,
    data: CommissionPayeeUpdate,
    vu: VendorUser = Depends(require_permission("commission.manage")),
    db: AsyncSession = Depends(get_db),
):
    p = await _fetch_payee(db, vu.vendor_id, payee_id)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    await db.commit()
    await db.refresh(p)
    return _d(p)


@router.delete("/payees/{payee_id}", status_code=204)
async def delete_payee(
    payee_id: UUID,
    vu: VendorUser = Depends(require_permission("commission.manage")),
    db: AsyncSession = Depends(get_db),
):
    p = await _fetch_payee(db, vu.vendor_id, payee_id)
    p.status = "inactive"
    await db.commit()


@router.get("/payees/{payee_id}/master-bank")
async def get_payee_master_bank(
    payee_id: UUID,
    vu: VendorUser = Depends(require_permission("commission.read")),
    db: AsyncSession = Depends(get_db),
):
    """
    Return bank details from the master record linked to this payee.
    link_type=vendor_user  -> hr_employee_profile
    link_type=supplier     -> supplier table
    link_type=customer     -> customer table
    link_type=external     -> {} (no master)
    """
    p = await _fetch_payee(db, vu.vendor_id, payee_id)

    bank: dict = {}

    if p.link_type == "vendor_user" and p.vendor_user_id:
        from app.models.hr import EmployeeProfile
        res = await db.execute(
            select(EmployeeProfile).where(EmployeeProfile.vendor_user_id == p.vendor_user_id)
        )
        emp = res.scalar_one_or_none()
        if emp:
            bank = {
                "bank_name": emp.bank_name,
                "account_number": emp.account_number,
                "account_holder_name": emp.account_holder_name,
                "account_type": emp.account_type,
                "ifsc_code": emp.ifsc_code,
                "pan_number": emp.pan_number,
            }

    elif p.link_type == "supplier" and p.supplier_id:
        from app.models.procurement import Supplier
        res = await db.execute(
            select(Supplier).where(Supplier.id == p.supplier_id)
        )
        sup = res.scalar_one_or_none()
        if sup:
            bank = {
                "bank_name": sup.bank_name,
                "account_number": sup.account_number,
                "account_holder_name": sup.account_holder_name,
                "ifsc_code": sup.ifsc_code,
            }

    elif p.link_type == "customer" and p.customer_id:
        from app.models.customer import Customer
        res = await db.execute(
            select(Customer).where(Customer.id == p.customer_id)
        )
        cust = res.scalar_one_or_none()
        if cust:
            bank = {
                "bank_name": cust.bank_name,
                "account_number": cust.account_number,
                "account_holder_name": cust.account_holder_name,
                "account_type": cust.account_type,
                "ifsc_code": cust.ifsc_code,
            }

    return {k: v for k, v in bank.items() if v}  # omit nulls


async def _fetch_payee(db, vendor_id, payee_id) -> CommissionPayee:
    result = await db.execute(
        select(CommissionPayee).where(
            CommissionPayee.id == payee_id, CommissionPayee.vendor_id == vendor_id
        )
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Payee not found")
    return p


# ═══════════════════════════════════════════════════════════════════════
# PLANS
# ═══════════════════════════════════════════════════════════════════════

@router.get("/plans")
async def list_plans(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("commission.read")),
    db: AsyncSession = Depends(get_db),
):
    conditions = [CommissionPlan.vendor_id == vu.vendor_id]
    if status:
        conditions.append(CommissionPlan.status == status)
    total = (await db.execute(
        select(sqlfunc.count()).select_from(CommissionPlan).where(and_(*conditions))
    )).scalar_one()
    plans = (await db.execute(
        select(CommissionPlan).where(and_(*conditions))
        .order_by(CommissionPlan.priority, CommissionPlan.name)
        .offset((page - 1) * size).limit(size)
    )).scalars().all()
    result = []
    for plan in plans:
        d = _d(plan)
        # Include rules inline
        rules_r = await db.execute(
            select(CommissionRule).where(CommissionRule.plan_id == plan.id)
            .order_by(CommissionRule.priority)
        )
        d["rules"] = [_d(r) for r in rules_r.scalars().all()]
        result.append(d)
    return {"items": result, "total": total, "page": page, "size": size,
            "pages": math.ceil(total / size) if total else 0}


@router.post("/plans", status_code=201)
async def create_plan(
    data: CommissionPlanCreate,
    vu: VendorUser = Depends(require_permission("commission.manage")),
    db: AsyncSession = Depends(get_db),
):
    plan = CommissionPlan(vendor_id=vu.vendor_id, **data.model_dump())
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return _d(plan)


@router.get("/plans/{plan_id}")
async def get_plan(
    plan_id: UUID,
    vu: VendorUser = Depends(require_permission("commission.read")),
    db: AsyncSession = Depends(get_db),
):
    plan = await _fetch_plan(db, vu.vendor_id, plan_id)
    d = _d(plan)
    rules_r = await db.execute(
        select(CommissionRule).where(CommissionRule.plan_id == plan.id).order_by(CommissionRule.priority)
    )
    d["rules"] = [_d(r) for r in rules_r.scalars().all()]
    return d


@router.put("/plans/{plan_id}")
async def update_plan(
    plan_id: UUID,
    data: CommissionPlanUpdate,
    vu: VendorUser = Depends(require_permission("commission.manage")),
    db: AsyncSession = Depends(get_db),
):
    plan = await _fetch_plan(db, vu.vendor_id, plan_id)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(plan, k, v)
    await db.commit()
    await db.refresh(plan)
    return _d(plan)


@router.delete("/plans/{plan_id}", status_code=204)
async def delete_plan(
    plan_id: UUID,
    vu: VendorUser = Depends(require_permission("commission.manage")),
    db: AsyncSession = Depends(get_db),
):
    plan = await _fetch_plan(db, vu.vendor_id, plan_id)
    plan.status = "inactive"
    await db.commit()


async def _fetch_plan(db, vendor_id, plan_id) -> CommissionPlan:
    result = await db.execute(
        select(CommissionPlan).where(
            CommissionPlan.id == plan_id, CommissionPlan.vendor_id == vendor_id
        )
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Plan not found")
    return p


# ═══════════════════════════════════════════════════════════════════════
# RULES (nested under plans)
# ═══════════════════════════════════════════════════════════════════════

@router.post("/plans/{plan_id}/rules", status_code=201)
async def create_rule(
    plan_id: UUID,
    data: CommissionRuleCreate,
    vu: VendorUser = Depends(require_permission("commission.manage")),
    db: AsyncSession = Depends(get_db),
):
    await _fetch_plan(db, vu.vendor_id, plan_id)
    rule = CommissionRule(plan_id=plan_id, vendor_id=vu.vendor_id, **data.model_dump())
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return _d(rule)


@router.put("/rules/{rule_id}")
async def update_rule(
    rule_id: UUID,
    data: CommissionRuleUpdate,
    vu: VendorUser = Depends(require_permission("commission.manage")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CommissionRule).where(CommissionRule.id == rule_id, CommissionRule.vendor_id == vu.vendor_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Rule not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(rule, k, v)
    await db.commit()
    await db.refresh(rule)
    return _d(rule)


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_rule(
    rule_id: UUID,
    vu: VendorUser = Depends(require_permission("commission.manage")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CommissionRule).where(CommissionRule.id == rule_id, CommissionRule.vendor_id == vu.vendor_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Rule not found")
    await db.delete(rule)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════════
# ASSIGNMENTS
# ═══════════════════════════════════════════════════════════════════════

@router.get("/assignments")
async def list_assignments(
    payee_id: Optional[UUID] = None,
    plan_id: Optional[UUID] = None,
    store_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
    link_type: Optional[str] = Query(None, description="Filter by payee link_type"),
    search: Optional[str] = Query(None, description="Payee name, email, phone, or employee code"),
    plan_code: Optional[str] = Query(None, description="Partial match on plan code"),
    plan_name: Optional[str] = Query(None, description="Partial match on plan name"),
    location: Optional[str] = Query(None, description="Partial match on assignment location"),
    group_name: Optional[str] = Query(None, description="Partial match on assignment group_name"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    vu: VendorUser = Depends(require_permission("commission.read")),
    db: AsyncSession = Depends(get_db),
):
    join_payee = CommissionPayee.id == CommissionAssignment.payee_id
    join_plan = CommissionPlan.id == CommissionAssignment.plan_id
    join_emp = and_(
        EmployeeProfile.vendor_user_id == CommissionPayee.vendor_user_id,
        EmployeeProfile.vendor_id == CommissionAssignment.vendor_id,
    )

    conditions = [CommissionAssignment.vendor_id == vu.vendor_id]
    if payee_id:
        conditions.append(CommissionAssignment.payee_id == payee_id)
    if plan_id:
        conditions.append(CommissionAssignment.plan_id == plan_id)
    if store_id:
        conditions.append(CommissionAssignment.store_id == store_id)
    if is_active is not None:
        conditions.append(CommissionAssignment.is_active == is_active)
    if link_type and link_type.strip():
        conditions.append(CommissionPayee.link_type == link_type.strip())
    if search and search.strip():
        term = f"%{search.strip()}%"
        conditions.append(
            or_(
                CommissionPayee.display_name.ilike(term),
                CommissionPayee.email.ilike(term),
                CommissionPayee.phone.ilike(term),
                EmployeeProfile.employee_code.ilike(term),
                EmployeeProfile.employee_code_custom.ilike(term),
            )
        )
    if plan_code and plan_code.strip():
        conditions.append(CommissionPlan.code.ilike(f"%{plan_code.strip()}%"))
    if plan_name and plan_name.strip():
        conditions.append(CommissionPlan.name.ilike(f"%{plan_name.strip()}%"))
    if location and location.strip():
        conditions.append(CommissionAssignment.location.ilike(f"%{location.strip()}%"))
    if group_name and group_name.strip():
        conditions.append(CommissionAssignment.group_name.ilike(f"%{group_name.strip()}%"))

    where_clause = and_(*conditions)

    total = (
        await db.execute(
            select(sqlfunc.count(CommissionAssignment.id))
            .select_from(CommissionAssignment)
            .join(CommissionPayee, join_payee)
            .join(CommissionPlan, join_plan)
            .outerjoin(EmployeeProfile, join_emp)
            .where(where_clause)
        )
    ).scalar_one()

    rows = (
        await db.execute(
            select(CommissionAssignment, CommissionPayee, CommissionPlan, EmployeeProfile)
            .join(CommissionPayee, join_payee)
            .join(CommissionPlan, join_plan)
            .outerjoin(EmployeeProfile, join_emp)
            .where(where_clause)
            .order_by(desc(CommissionAssignment.created_at))
            .offset((page - 1) * size)
            .limit(size)
        )
    ).all()

    items: List[Dict[str, Any]] = []
    for a, payee, plan, emp in rows:
        d = _d(a)
        d["payee_display_name"] = payee.display_name
        d["payee_link_type"] = payee.link_type
        d["payee_email"] = payee.email
        d["payee_phone"] = payee.phone
        d["plan_name"] = plan.name
        d["plan_code"] = plan.code
        if emp:
            d["employee_id"] = (emp.employee_code_custom or emp.employee_code or None)
        else:
            d["employee_id"] = None
        items.append(d)

    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total else 0,
    }


@router.post("/assignments", status_code=201)
async def create_assignment(
    data: CommissionAssignmentCreate,
    vu: VendorUser = Depends(require_permission("commission.manage")),
    db: AsyncSession = Depends(get_db),
):
    assignment = CommissionAssignment(vendor_id=vu.vendor_id, **data.model_dump())
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    return _d(assignment)


@router.put("/assignments/{assignment_id}")
async def update_assignment(
    assignment_id: UUID,
    data: CommissionAssignmentUpdate,
    vu: VendorUser = Depends(require_permission("commission.manage")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CommissionAssignment).where(
            CommissionAssignment.id == assignment_id, CommissionAssignment.vendor_id == vu.vendor_id
        )
    )
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(404, "Assignment not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(a, k, v)
    await db.commit()
    await db.refresh(a)
    return _d(a)


@router.delete("/assignments/{assignment_id}", status_code=204)
async def delete_assignment(
    assignment_id: UUID,
    vu: VendorUser = Depends(require_permission("commission.manage")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CommissionAssignment).where(
            CommissionAssignment.id == assignment_id, CommissionAssignment.vendor_id == vu.vendor_id
        )
    )
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(404, "Assignment not found")
    a.is_active = False
    await db.commit()


# ═══════════════════════════════════════════════════════════════════════
# ACCRUALS
# ═══════════════════════════════════════════════════════════════════════

@router.get("/accruals")
async def list_accruals(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    payee_id: Optional[UUID] = None,
    plan_id: Optional[UUID] = None,
    store_id: Optional[UUID] = None,
    channel: Optional[str] = None,
    source_type: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    calculation_type: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("commission.read")),
    db: AsyncSession = Depends(get_db),
):
    conditions = [CommissionAccrual.vendor_id == vu.vendor_id]
    if status:
        conditions.append(CommissionAccrual.status == status)
    if payee_id:
        conditions.append(CommissionAccrual.payee_id == payee_id)
    if plan_id:
        conditions.append(CommissionAccrual.plan_id == plan_id)
    if store_id:
        conditions.append(CommissionAccrual.store_id == store_id)
    if channel:
        conditions.append(CommissionAccrual.channel == channel)
    if source_type:
        conditions.append(CommissionAccrual.source_type == source_type)
    if calculation_type:
        conditions.append(CommissionAccrual.calculation_type == calculation_type)
    if date_from:
        conditions.append(CommissionAccrual.sale_date >= date_from)
    if date_to:
        conditions.append(CommissionAccrual.sale_date <= date_to)

    total = (await db.execute(
        select(sqlfunc.count()).select_from(CommissionAccrual).where(and_(*conditions))
    )).scalar_one()
    items = (await db.execute(
        select(CommissionAccrual).where(and_(*conditions))
        .order_by(desc(CommissionAccrual.sale_date), desc(CommissionAccrual.created_at))
        .offset((page - 1) * size).limit(size)
    )).scalars().all()
    return {"items": [_d(a) for a in items], "total": total, "page": page, "size": size,
            "pages": math.ceil(total / size) if total else 0}


@router.post("/accruals/{accrual_id}/approve")
async def approve_accrual(
    accrual_id: UUID,
    vu: VendorUser = Depends(require_permission("commission.manage")),
    db: AsyncSession = Depends(get_db),
):
    acc = await _fetch_accrual(db, vu.vendor_id, accrual_id)
    if acc.status not in ("accrued", "draft"):
        raise HTTPException(400, f"Cannot approve an accrual in status '{acc.status}'")
    from datetime import datetime, timezone
    acc.status = "approved"
    acc.approved_by_id = vu.user_id
    acc.approved_at = datetime.now(timezone.utc)
    db.add(CommissionApprovalLog(
        vendor_id=vu.vendor_id, entity_type="accrual", entity_id=accrual_id,
        action="approved", actor_id=vu.user_id,
    ))
    await db.commit()
    await db.refresh(acc)
    return _d(acc)


@router.post("/accruals/{accrual_id}/reverse")
async def reverse_accrual(
    accrual_id: UUID,
    vu: VendorUser = Depends(require_permission("commission.manage")),
    db: AsyncSession = Depends(get_db),
):
    acc = await _fetch_accrual(db, vu.vendor_id, accrual_id)
    if acc.status not in ("accrued", "approved"):
        raise HTTPException(400, f"Cannot reverse an accrual in status '{acc.status}'")
    reversals = await reverse_accruals(db, acc.source_type, acc.source_id, vu.vendor_id, vu.user_id)
    return {"reversed": len(reversals)}


@router.post("/accruals/bulk-approve")
async def bulk_approve_accruals(
    payee_id: Optional[UUID] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    vu: VendorUser = Depends(require_permission("commission.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Bulk-approve all accrued accruals matching filters."""
    from datetime import datetime, timezone
    conditions = [
        CommissionAccrual.vendor_id == vu.vendor_id,
        CommissionAccrual.status == "accrued",
    ]
    if payee_id:
        conditions.append(CommissionAccrual.payee_id == payee_id)
    if date_from:
        conditions.append(CommissionAccrual.sale_date >= date_from)
    if date_to:
        conditions.append(CommissionAccrual.sale_date <= date_to)
    result = await db.execute(select(CommissionAccrual).where(and_(*conditions)))
    accruals = result.scalars().all()
    now = datetime.now(timezone.utc)
    for acc in accruals:
        acc.status = "approved"
        acc.approved_by_id = vu.user_id
        acc.approved_at = now
    await db.commit()
    return {"approved": len(accruals)}


async def _fetch_accrual(db, vendor_id, accrual_id) -> CommissionAccrual:
    result = await db.execute(
        select(CommissionAccrual).where(
            CommissionAccrual.id == accrual_id, CommissionAccrual.vendor_id == vendor_id
        )
    )
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(404, "Accrual not found")
    return a


# ═══════════════════════════════════════════════════════════════════════
# PAYOUT RUNS
# ═══════════════════════════════════════════════════════════════════════

@router.get("/payout-runs")
async def list_payout_runs(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("commission.read")),
    db: AsyncSession = Depends(get_db),
):
    conditions = [CommissionPayoutRun.vendor_id == vu.vendor_id]
    if status:
        conditions.append(CommissionPayoutRun.status == status)
    total = (await db.execute(
        select(sqlfunc.count()).select_from(CommissionPayoutRun).where(and_(*conditions))
    )).scalar_one()
    runs = (await db.execute(
        select(CommissionPayoutRun).where(and_(*conditions))
        .order_by(desc(CommissionPayoutRun.created_at))
        .offset((page - 1) * size).limit(size)
    )).scalars().all()
    return {"items": [_d(r) for r in runs], "total": total, "page": page, "size": size,
            "pages": math.ceil(total / size) if total else 0}


@router.post("/payout-runs", status_code=201)
async def create_payout_run(
    data: PayoutRunCreate,
    vu: VendorUser = Depends(require_permission("commission.manage")),
    db: AsyncSession = Depends(get_db),
):
    svc = PayoutService(db)
    try:
        run = await svc.build_run(
            vendor_id=vu.vendor_id,
            period_start=data.period_start,
            period_end=data.period_end,
            payee_ids=data.payee_ids,
            payment_method=data.payment_method,
            notes=data.notes,
            created_by_id=vu.user_id,
        )
        return _d(run)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/payout-runs/{run_id}")
async def get_payout_run(
    run_id: UUID,
    vu: VendorUser = Depends(require_permission("commission.read")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CommissionPayoutRun).where(
            CommissionPayoutRun.id == run_id, CommissionPayoutRun.vendor_id == vu.vendor_id
        )
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(404, "Payout run not found")
    d = _d(run)
    items_result = await db.execute(
        select(CommissionPayoutItem).where(CommissionPayoutItem.run_id == run_id)
    )
    d["items"] = [_d(i) for i in items_result.scalars().all()]
    return d


@router.post("/payout-runs/{run_id}/approve")
async def approve_payout_run(
    run_id: UUID,
    data: PayoutRunAction = PayoutRunAction(),
    vu: VendorUser = Depends(require_permission("commission.manage")),
    db: AsyncSession = Depends(get_db),
):
    svc = PayoutService(db)
    try:
        run = await svc.approve_run(vu.vendor_id, run_id, vu.user_id, data.notes)
        return _d(run)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/payout-runs/{run_id}/pay")
async def pay_payout_run(
    run_id: UUID,
    data: PayoutRunAction = PayoutRunAction(),
    vu: VendorUser = Depends(require_permission("commission.manage")),
    db: AsyncSession = Depends(get_db),
):
    svc = PayoutService(db)
    try:
        run = await svc.pay_run(vu.vendor_id, run_id, vu.user_id, data.notes)
        return _d(run)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/payout-runs/{run_id}/cancel")
async def cancel_payout_run(
    run_id: UUID,
    data: PayoutRunAction = PayoutRunAction(),
    vu: VendorUser = Depends(require_permission("commission.manage")),
    db: AsyncSession = Depends(get_db),
):
    svc = PayoutService(db)
    try:
        run = await svc.cancel_run(vu.vendor_id, run_id, vu.user_id, data.notes)
        return _d(run)
    except ValueError as e:
        raise HTTPException(400, str(e))


# ═══════════════════════════════════════════════════════════════════════
# REPORTS
# ═══════════════════════════════════════════════════════════════════════

@router.get("/reports/summary")
async def report_summary(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    payee_id: Optional[UUID] = None,
    store_id: Optional[UUID] = None,
    channel: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("commission.read")),
    db: AsyncSession = Depends(get_db),
):
    """KPI card data."""
    base_cond = [CommissionAccrual.vendor_id == vu.vendor_id]
    if date_from:
        base_cond.append(CommissionAccrual.sale_date >= date_from)
    if date_to:
        base_cond.append(CommissionAccrual.sale_date <= date_to)
    if payee_id:
        base_cond.append(CommissionAccrual.payee_id == payee_id)
    if store_id:
        base_cond.append(CommissionAccrual.store_id == store_id)
    if channel:
        base_cond.append(CommissionAccrual.channel == channel)

    def _sum_cond(extra=None):
        c = list(base_cond)
        if extra is not None:
            c.extend(extra if isinstance(extra, list) else [extra])
        return c

    total_accrued = (await db.execute(
        select(sqlfunc.coalesce(sqlfunc.sum(CommissionAccrual.commission_amount), 0))
        .where(and_(*_sum_cond([CommissionAccrual.status != "reversed"])))
    )).scalar_one()

    total_paid = (await db.execute(
        select(sqlfunc.coalesce(sqlfunc.sum(CommissionAccrual.commission_amount), 0))
        .where(and_(*_sum_cond([CommissionAccrual.status == "paid"])))
    )).scalar_one()

    pending_approval = (await db.execute(
        select(sqlfunc.coalesce(sqlfunc.sum(CommissionAccrual.commission_amount), 0))
        .where(and_(*_sum_cond([CommissionAccrual.status == "accrued"])))
    )).scalar_one()

    sale_count = (await db.execute(
        select(sqlfunc.count(CommissionAccrual.id))
        .where(and_(*_sum_cond([CommissionAccrual.status != "reversed"])))
    )).scalar_one()

    avg_per_sale = float(total_accrued) / sale_count if sale_count else 0

    # Top payee
    top_row = (await db.execute(
        select(CommissionAccrual.payee_id, sqlfunc.sum(CommissionAccrual.commission_amount).label("total"))
        .where(and_(*_sum_cond([CommissionAccrual.status != "reversed"])))
        .group_by(CommissionAccrual.payee_id)
        .order_by(desc("total"))
        .limit(1)
    )).first()
    top_payee_id = str(top_row[0]) if top_row else None
    top_payee_amount = float(top_row[1]) if top_row else 0

    return {
        "total_accrued": float(total_accrued),
        "total_paid": float(total_paid),
        "pending_approval": float(pending_approval),
        "avg_per_sale": round(avg_per_sale, 2),
        "top_payee_id": top_payee_id,
        "top_payee_amount": top_payee_amount,
        "sale_count": sale_count,
    }


@router.get("/reports/by-payee")
async def report_by_payee(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    store_id: Optional[UUID] = None,
    channel: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    vu: VendorUser = Depends(require_permission("commission.read")),
    db: AsyncSession = Depends(get_db),
):
    conditions = [CommissionAccrual.vendor_id == vu.vendor_id, CommissionAccrual.status != "reversed"]
    if date_from:
        conditions.append(CommissionAccrual.sale_date >= date_from)
    if date_to:
        conditions.append(CommissionAccrual.sale_date <= date_to)
    if store_id:
        conditions.append(CommissionAccrual.store_id == store_id)
    if channel:
        conditions.append(CommissionAccrual.channel == channel)

    rows = (await db.execute(
        select(
            CommissionAccrual.payee_id,
            sqlfunc.sum(CommissionAccrual.commission_amount).label("total_commission"),
            sqlfunc.sum(CommissionAccrual.base_amount).label("total_base"),
            sqlfunc.count(CommissionAccrual.id).label("count"),
        )
        .where(and_(*conditions))
        .group_by(CommissionAccrual.payee_id)
        .order_by(desc("total_commission"))
        .limit(limit)
    )).all()

    # Enrich with payee names
    result = []
    for row in rows:
        payee = (await db.execute(
            select(CommissionPayee).where(CommissionPayee.id == row.payee_id)
        )).scalar_one_or_none()
        result.append({
            "payee_id": str(row.payee_id),
            "payee_name": payee.display_name if payee else str(row.payee_id),
            "total_commission": float(row.total_commission or 0),
            "total_base": float(row.total_base or 0),
            "count": row.count,
        })
    return result


@router.get("/reports/by-source")
async def report_by_source(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    vu: VendorUser = Depends(require_permission("commission.read")),
    db: AsyncSession = Depends(get_db),
):
    conditions = [CommissionAccrual.vendor_id == vu.vendor_id, CommissionAccrual.status != "reversed"]
    if date_from:
        conditions.append(CommissionAccrual.sale_date >= date_from)
    if date_to:
        conditions.append(CommissionAccrual.sale_date <= date_to)

    by_channel = (await db.execute(
        select(
            CommissionAccrual.channel,
            sqlfunc.sum(CommissionAccrual.commission_amount).label("total"),
            sqlfunc.count(CommissionAccrual.id).label("count"),
        )
        .where(and_(*conditions))
        .group_by(CommissionAccrual.channel)
    )).all()

    by_source_type = (await db.execute(
        select(
            CommissionAccrual.source_type,
            sqlfunc.sum(CommissionAccrual.commission_amount).label("total"),
            sqlfunc.count(CommissionAccrual.id).label("count"),
        )
        .where(and_(*conditions))
        .group_by(CommissionAccrual.source_type)
    )).all()

    return {
        "by_channel": [{"channel": r.channel, "total": float(r.total or 0), "count": r.count} for r in by_channel],
        "by_source_type": [{"source_type": r.source_type, "total": float(r.total or 0), "count": r.count} for r in by_source_type],
    }


@router.get("/reports/trend")
async def report_trend(
    bucket: str = Query("month", description="day | week | month"),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    payee_id: Optional[UUID] = None,
    store_id: Optional[UUID] = None,
    vu: VendorUser = Depends(require_permission("commission.read")),
    db: AsyncSession = Depends(get_db),
):
    valid_buckets = {"day", "week", "month", "quarter", "year"}
    if bucket not in valid_buckets:
        raise HTTPException(400, f"bucket must be one of {valid_buckets}")

    conditions = [CommissionAccrual.vendor_id == vu.vendor_id, CommissionAccrual.status != "reversed"]
    if date_from:
        conditions.append(CommissionAccrual.sale_date >= date_from)
    if date_to:
        conditions.append(CommissionAccrual.sale_date <= date_to)
    if payee_id:
        conditions.append(CommissionAccrual.payee_id == payee_id)
    if store_id:
        conditions.append(CommissionAccrual.store_id == store_id)

    from sqlalchemy import text
    period_expr = sqlfunc.date_trunc(bucket, CommissionAccrual.sale_date)

    rows = (await db.execute(
        select(
            period_expr.label("period"),
            sqlfunc.sum(CommissionAccrual.commission_amount).label("total"),
            sqlfunc.count(CommissionAccrual.id).label("count"),
        )
        .where(and_(*conditions))
        .group_by("period")
        .order_by("period")
    )).all()

    return [{"period": r.period.isoformat() if hasattr(r.period, "isoformat") else str(r.period),
             "total": float(r.total or 0), "count": r.count} for r in rows]


@router.get("/reports/by-product")
async def report_by_product(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    limit: int = Query(20, ge=1, le=100),
    vu: VendorUser = Depends(require_permission("commission.read")),
    db: AsyncSession = Depends(get_db),
):
    """Top products/services by commission earned."""
    conditions = [CommissionAccrual.vendor_id == vu.vendor_id, CommissionAccrual.status != "reversed"]
    if date_from:
        conditions.append(CommissionAccrual.sale_date >= date_from)
    if date_to:
        conditions.append(CommissionAccrual.sale_date <= date_to)

    rows = (await db.execute(
        select(
            CommissionRule.product_id,
            CommissionRule.service_id,
            sqlfunc.sum(CommissionAccrual.commission_amount).label("total"),
            sqlfunc.count(CommissionAccrual.id).label("count"),
        )
        .join(CommissionRule, CommissionAccrual.rule_id == CommissionRule.id)
        .where(and_(*conditions))
        .group_by(CommissionRule.product_id, CommissionRule.service_id)
        .order_by(desc("total"))
        .limit(limit)
    )).all()

    return [
        {
            "product_id": str(r.product_id) if r.product_id else None,
            "service_id": str(r.service_id) if r.service_id else None,
            "total": float(r.total or 0),
            "count": r.count,
        }
        for r in rows
    ]
