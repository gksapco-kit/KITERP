"""
CRM collections: payment follow-ups and credit control.
"""
from __future__ import annotations

from decimal import Decimal
from math import ceil
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_permission
from app.database import get_db
from app.models.crm import CrmCreditControl, CrmPaymentFollowup
from app.models.vendor_user import VendorUser
from app.schemas.crm.schemas import (
    CreditControlCheckRequest,
    CreditControlCheckResponse,
    CreditControlCreate,
    CreditControlResponse,
    CreditControlUpdate,
    PaginatedResponse,
    PaymentFollowupCreate,
    PaymentFollowupResponse,
    PaymentFollowupUpdate,
)
from app.services.crm.numbering import next_crm_number

router = APIRouter()


def _paginated(items, total, page, size):
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": ceil(total / size) if total else 0,
    }


def _dec(v) -> Decimal:
    if v is None:
        return Decimal("0")
    return Decimal(str(v))


def _credit_payload(row: CrmCreditControl) -> dict:
    limit = _dec(row.credit_limit)
    outstanding = _dec(row.current_outstanding)
    available = limit - outstanding if limit > 0 else None
    data = CreditControlResponse.model_validate(row).model_dump()
    data["available_credit"] = available
    data["over_limit"] = bool(limit > 0 and outstanding > limit)
    return data


# ── Payment follow-ups ───────────────────────────────────────────────────────

@router.get("/payment-followups", response_model=PaginatedResponse)
async def list_payment_followups(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    q: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = None,
    channel: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    filters = [CrmPaymentFollowup.vendor_id == vu.vendor_id]
    if status_filter:
        filters.append(CrmPaymentFollowup.status == status_filter)
    if priority:
        filters.append(CrmPaymentFollowup.priority == priority)
    if channel:
        filters.append(CrmPaymentFollowup.channel == channel)
    if q and q.strip():
        term = f"%{q.strip()}%"
        filters.append(
            or_(
                CrmPaymentFollowup.party_name.ilike(term),
                CrmPaymentFollowup.number.ilike(term),
                CrmPaymentFollowup.invoice_ref.ilike(term),
                CrmPaymentFollowup.party_phone.ilike(term),
                CrmPaymentFollowup.party_email.ilike(term),
            )
        )

    total = (
        await db.execute(select(func.count()).select_from(CrmPaymentFollowup).where(*filters))
    ).scalar() or 0
    rows = (
        await db.execute(
            select(CrmPaymentFollowup)
            .where(*filters)
            .order_by(
                CrmPaymentFollowup.next_followup_at.asc().nulls_last(),
                CrmPaymentFollowup.created_at.desc(),
            )
            .offset((page - 1) * size)
            .limit(size)
        )
    ).scalars().all()
    items = [PaymentFollowupResponse.model_validate(r).model_dump() for r in rows]
    return _paginated(items, total, page, size)


@router.post(
    "/payment-followups",
    response_model=PaymentFollowupResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_payment_followup(
    data: PaymentFollowupCreate,
    vu: VendorUser = Depends(require_permission("crm.contacts.manage")),
    db: AsyncSession = Depends(get_db),
):
    try:
        number = await next_crm_number(
            db, vu.vendor_id, CrmPaymentFollowup, "PF", entity_type="payment_followup"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    row = CrmPaymentFollowup(
        vendor_id=vu.vendor_id,
        number=number,
        owner_id=data.owner_id or vu.user_id,
        **data.model_dump(exclude={"owner_id"}),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return PaymentFollowupResponse.model_validate(row).model_dump()


@router.get("/payment-followups/{followup_id}", response_model=PaymentFollowupResponse)
async def get_payment_followup(
    followup_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(CrmPaymentFollowup, followup_id)
    if not row or row.vendor_id != vu.vendor_id:
        raise HTTPException(status_code=404, detail="Payment follow-up not found")
    return PaymentFollowupResponse.model_validate(row).model_dump()


@router.put("/payment-followups/{followup_id}", response_model=PaymentFollowupResponse)
async def update_payment_followup(
    followup_id: UUID,
    data: PaymentFollowupUpdate,
    vu: VendorUser = Depends(require_permission("crm.contacts.manage")),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(CrmPaymentFollowup, followup_id)
    if not row or row.vendor_id != vu.vendor_id:
        raise HTTPException(status_code=404, detail="Payment follow-up not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(row, key, val)
    await db.commit()
    await db.refresh(row)
    return PaymentFollowupResponse.model_validate(row).model_dump()


@router.delete("/payment-followups/{followup_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment_followup(
    followup_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.contacts.manage")),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(CrmPaymentFollowup, followup_id)
    if not row or row.vendor_id != vu.vendor_id:
        raise HTTPException(status_code=404, detail="Payment follow-up not found")
    await db.delete(row)
    await db.commit()


# ── Credit control ───────────────────────────────────────────────────────────

@router.get("/credit-control", response_model=PaginatedResponse)
async def list_credit_controls(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    q: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    payment_blocked: Optional[bool] = None,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    filters = [CrmCreditControl.vendor_id == vu.vendor_id]
    if status_filter:
        filters.append(CrmCreditControl.status == status_filter)
    if payment_blocked is not None:
        filters.append(CrmCreditControl.payment_blocked == payment_blocked)
    if q and q.strip():
        term = f"%{q.strip()}%"
        filters.append(
            or_(
                CrmCreditControl.party_name.ilike(term),
                CrmCreditControl.party_phone.ilike(term),
                CrmCreditControl.party_email.ilike(term),
            )
        )

    total = (
        await db.execute(select(func.count()).select_from(CrmCreditControl).where(*filters))
    ).scalar() or 0
    rows = (
        await db.execute(
            select(CrmCreditControl)
            .where(*filters)
            .order_by(CrmCreditControl.party_name.asc())
            .offset((page - 1) * size)
            .limit(size)
        )
    ).scalars().all()
    return _paginated([_credit_payload(r) for r in rows], total, page, size)


@router.post(
    "/credit-control",
    response_model=CreditControlResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_credit_control(
    data: CreditControlCreate,
    vu: VendorUser = Depends(require_permission("crm.contacts.manage")),
    db: AsyncSession = Depends(get_db),
):
    payload = data.model_dump()
    if payload.get("payment_blocked") and payload.get("status") == "active":
        payload["status"] = "blocked"
    if payload.get("status") == "blocked":
        payload["payment_blocked"] = True
    row = CrmCreditControl(vendor_id=vu.vendor_id, **payload)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _credit_payload(row)


@router.post("/credit-control/check", response_model=CreditControlCheckResponse)
async def check_credit_control(
    data: CreditControlCheckRequest,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    """Enforce max payment amount, credit limit, and payment block for a party."""
    from app.services.crm.credit_gate import evaluate_credit, find_credit_control

    if (
        not data.credit_control_id
        and not data.customer_id
        and not data.contact_id
        and not (data.party_name and data.party_name.strip())
    ):
        raise HTTPException(
            status_code=400,
            detail="Provide credit_control_id, customer_id, contact_id, or party_name",
        )

    row = await find_credit_control(
        db,
        vu.vendor_id,
        credit_control_id=data.credit_control_id,
        customer_id=data.customer_id,
        contact_id=data.contact_id,
        party_name=data.party_name,
    )
    if data.credit_control_id and not row:
        raise HTTPException(status_code=404, detail="Credit control not found")

    return evaluate_credit(
        row,
        data.amount,
        require_zero_outstanding=bool(data.require_zero_outstanding),
    )


@router.get("/credit-control/{control_id}", response_model=CreditControlResponse)
async def get_credit_control(
    control_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(CrmCreditControl, control_id)
    if not row or row.vendor_id != vu.vendor_id:
        raise HTTPException(status_code=404, detail="Credit control not found")
    return _credit_payload(row)


@router.put("/credit-control/{control_id}", response_model=CreditControlResponse)
async def update_credit_control(
    control_id: UUID,
    data: CreditControlUpdate,
    vu: VendorUser = Depends(require_permission("crm.contacts.manage")),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(CrmCreditControl, control_id)
    if not row or row.vendor_id != vu.vendor_id:
        raise HTTPException(status_code=404, detail="Credit control not found")
    updates = data.model_dump(exclude_unset=True)
    for key, val in updates.items():
        setattr(row, key, val)
    if "payment_blocked" in updates and updates["payment_blocked"] and row.status == "active":
        row.status = "blocked"
    if "status" in updates and updates["status"] == "blocked":
        row.payment_blocked = True
    if "status" in updates and updates["status"] == "active" and "payment_blocked" not in updates:
        row.payment_blocked = False
    await db.commit()
    await db.refresh(row)
    return _credit_payload(row)


@router.delete("/credit-control/{control_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_credit_control(
    control_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.contacts.manage")),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(CrmCreditControl, control_id)
    if not row or row.vendor_id != vu.vendor_id:
        raise HTTPException(status_code=404, detail="Credit control not found")
    await db.delete(row)
    await db.commit()
