"""partner_service.py — Phase-6 order partner functions.

Manages the named parties on a sales order:
  buyer    → who placed the order  (always present; seeded from customer)
  ship_to  → delivery contact / address
  bill_to  → invoice recipient
  payer    → payment party
  contact  → additional contact
  other    → catch-all

All mutating operations (upsert, delete) require the order to belong to the
vendor.  The caller is responsible for committing the transaction.
"""
from __future__ import annotations

import logging
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.models.order import Order, OrderPartner

log = logging.getLogger(__name__)

VALID_ROLES = {"buyer", "ship_to", "bill_to", "payer", "contact", "other"}


async def _get_order(db: AsyncSession, vendor_id: UUID, order_id: UUID) -> Order:
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.vendor_id == vendor_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Order not found")
    return order


async def list_partners(
    db: AsyncSession, vendor_id: UUID, order_id: UUID
) -> list[OrderPartner]:
    await _get_order(db, vendor_id, order_id)
    result = await db.execute(
        select(OrderPartner).where(
            OrderPartner.order_id == order_id,
            OrderPartner.vendor_id == vendor_id,
        ).order_by(OrderPartner.role)
    )
    return result.scalars().all()


async def upsert_partner(
    db: AsyncSession,
    vendor_id: UUID,
    order_id: UUID,
    role: str,
    *,
    customer_id: UUID | None = None,
    contact_name: str | None = None,
    contact_email: str | None = None,
    contact_phone: str | None = None,
    company_name: str | None = None,
    gstin: str | None = None,
    address: dict | None = None,
    notes: str | None = None,
) -> OrderPartner:
    """Create or update the partner for a given role on this order."""
    if role not in VALID_ROLES:
        raise HTTPException(400, f"Invalid role '{role}'. Valid: {sorted(VALID_ROLES)}")

    await _get_order(db, vendor_id, order_id)

    # If customer_id given, fill snapshot fields from customer record
    if customer_id:
        cust_result = await db.execute(
            select(Customer).where(Customer.id == customer_id)
        )
        customer = cust_result.scalar_one_or_none()
        if customer:
            contact_name = contact_name or customer.full_name
            contact_email = contact_email or customer.email
            contact_phone = contact_phone or customer.phone
            company_name = company_name or customer.company_name
            gstin = gstin or customer.gstin
            address = address or customer.billing_address

    # Upsert
    existing_result = await db.execute(
        select(OrderPartner).where(
            OrderPartner.order_id == order_id,
            OrderPartner.role == role,
        )
    )
    partner = existing_result.scalar_one_or_none()

    if partner is None:
        partner = OrderPartner(
            order_id=order_id,
            vendor_id=vendor_id,
            role=role,
        )
        db.add(partner)

    partner.customer_id = customer_id
    partner.contact_name = contact_name
    partner.contact_email = contact_email
    partner.contact_phone = contact_phone
    partner.company_name = company_name
    partner.gstin = gstin
    partner.address = address
    partner.notes = notes

    return partner


async def delete_partner(
    db: AsyncSession,
    vendor_id: UUID,
    order_id: UUID,
    role: str,
) -> None:
    """Remove a partner row for a given role. buyer role cannot be deleted."""
    if role == "buyer":
        raise HTTPException(400, "The 'buyer' partner cannot be removed from an order")

    result = await db.execute(
        select(OrderPartner).where(
            OrderPartner.order_id == order_id,
            OrderPartner.vendor_id == vendor_id,
            OrderPartner.role == role,
        )
    )
    partner = result.scalar_one_or_none()
    if partner:
        await db.delete(partner)


async def seed_buyer(
    db: AsyncSession,
    order: Order,
) -> OrderPartner | None:
    """Auto-create the 'buyer' partner row from the order's customer record.

    Idempotent — does nothing if a buyer partner already exists.
    Called inside order_service.checkout() after the order is flushed.
    """
    if not order.customer_id:
        return None

    existing_result = await db.execute(
        select(OrderPartner).where(
            OrderPartner.order_id == order.id,
            OrderPartner.role == "buyer",
        )
    )
    if existing_result.scalar_one_or_none():
        return None  # already seeded

    cust_result = await db.execute(
        select(Customer).where(Customer.id == order.customer_id)
    )
    customer = cust_result.scalar_one_or_none()

    partner = OrderPartner(
        order_id=order.id,
        vendor_id=order.vendor_id,
        role="buyer",
        customer_id=order.customer_id,
        contact_name=customer.full_name if customer else None,
        contact_email=customer.email if customer else None,
        contact_phone=customer.phone if customer else None,
        company_name=customer.company_name if customer else None,
        gstin=customer.gstin if customer else None,
        address=customer.billing_address if customer else None,
    )
    db.add(partner)
    return partner


def partner_to_dict(p: OrderPartner) -> dict:
    return {
        "id": str(p.id),
        "role": p.role,
        "customer_id": str(p.customer_id) if p.customer_id else None,
        "contact_name": p.contact_name,
        "contact_email": p.contact_email,
        "contact_phone": p.contact_phone,
        "company_name": p.company_name,
        "gstin": p.gstin,
        "address": p.address,
        "notes": p.notes,
        "created_at": str(p.created_at) if p.created_at else None,
        "updated_at": str(p.updated_at) if p.updated_at else None,
    }
