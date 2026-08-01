"""Shared credit eligibility checks for CRM collections and dairy rentals."""
from __future__ import annotations

from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.crm import CrmCreditControl


def _dec(v) -> Decimal:
    if v is None:
        return Decimal("0")
    return Decimal(str(v))


async def find_credit_control(
    db: AsyncSession,
    vendor_id: UUID,
    *,
    credit_control_id: Optional[UUID] = None,
    customer_id: Optional[UUID] = None,
    contact_id: Optional[UUID] = None,
    party_name: Optional[str] = None,
    party_phone: Optional[str] = None,
) -> Optional[CrmCreditControl]:
    if credit_control_id:
        row = await db.get(CrmCreditControl, credit_control_id)
        if row and row.vendor_id == vendor_id:
            return row
        return None

    filters = [CrmCreditControl.vendor_id == vendor_id]
    if customer_id:
        filters.append(CrmCreditControl.customer_id == customer_id)
        return (
            await db.execute(select(CrmCreditControl).where(*filters).limit(1))
        ).scalar_one_or_none()

    if contact_id:
        filters.append(CrmCreditControl.contact_id == contact_id)
        return (
            await db.execute(select(CrmCreditControl).where(*filters).limit(1))
        ).scalar_one_or_none()

    name = (party_name or "").strip()
    phone = (party_phone or "").strip()
    if not name and not phone:
        return None

    matchers = []
    if name:
        matchers.append(CrmCreditControl.party_name.ilike(name))
    if phone:
        matchers.append(CrmCreditControl.party_phone == phone)
    return (
        await db.execute(
            select(CrmCreditControl)
            .where(CrmCreditControl.vendor_id == vendor_id, or_(*matchers))
            .limit(1)
        )
    ).scalar_one_or_none()


def evaluate_credit(
    row: Optional[CrmCreditControl],
    amount: Decimal,
    *,
    require_zero_outstanding: bool = False,
) -> dict[str, Any]:
    """Return a check payload. No row → allowed by default."""
    if not row:
        return {
            "allowed": True,
            "reason": "No credit control record — allowed by default",
            "credit_control_id": None,
            "credit_limit": None,
            "max_payment_amount": None,
            "current_outstanding": None,
            "available_credit": None,
            "payment_blocked": False,
        }

    amount = _dec(amount)
    limit = _dec(row.credit_limit)
    max_pay = _dec(row.max_payment_amount)
    outstanding = _dec(row.current_outstanding)
    available = (limit - outstanding) if limit > 0 else None
    base = {
        "credit_control_id": row.id,
        "credit_limit": limit,
        "max_payment_amount": max_pay,
        "current_outstanding": outstanding,
        "available_credit": available,
        "payment_blocked": bool(row.payment_blocked),
    }

    if row.payment_blocked or row.status == "blocked":
        return {
            **base,
            "allowed": False,
            "reason": row.block_reason or "Payments are blocked for this party",
            "payment_blocked": True,
        }

    if require_zero_outstanding and outstanding > 0:
        return {
            **base,
            "allowed": False,
            "reason": (
                f"Clear previous dues of {outstanding} before the next booking"
            ),
        }

    if max_pay > 0 and amount > max_pay:
        return {
            **base,
            "allowed": False,
            "reason": f"Amount exceeds max payment limit of {max_pay}",
        }

    if limit > 0 and (outstanding + amount) > limit:
        return {
            **base,
            "allowed": False,
            "reason": (
                f"Booking total {amount} would exceed credit limit of {limit} "
                f"(outstanding {outstanding}). Raise credit limit in CRM → Credit Control, "
                f"or lower rack deposit/rate."
            ),
        }

    return {
        **base,
        "allowed": True,
        "reason": "Within credit and payment limits",
    }


async def assert_credit_allows_booking(
    db: AsyncSession,
    vendor_id: UUID,
    *,
    amount: Decimal,
    customer_id: Optional[UUID] = None,
    party_name: Optional[str] = None,
    party_phone: Optional[str] = None,
) -> Optional[CrmCreditControl]:
    """Raise HTTPException-friendly dict if not allowed. Returns matched row (or None)."""
    from fastapi import HTTPException

    row = await find_credit_control(
        db,
        vendor_id,
        customer_id=customer_id,
        party_name=party_name,
        party_phone=party_phone,
    )
    result = evaluate_credit(row, amount, require_zero_outstanding=True)
    if not result["allowed"]:
        raise HTTPException(status_code=402, detail=result["reason"])
    return row


async def adjust_outstanding(
    db: AsyncSession,
    row: Optional[CrmCreditControl],
    delta: Decimal,
) -> None:
    if not row:
        return
    new_val = _dec(row.current_outstanding) + _dec(delta)
    if new_val < 0:
        new_val = Decimal("0")
    row.current_outstanding = new_val
    if _dec(row.credit_limit) > 0 and new_val > _dec(row.credit_limit):
        row.status = "watch"
