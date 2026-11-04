"""Sales-side helpers: follow-up roll-up, lead conversion, KYC status."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.realestate.core import ReCustomer, ReFollowup, ReKycDocument, ReLead

from .common import Ctx, next_number

_ID_DOCS = {"pan", "aadhaar", "passport", "voter_id", "driving_license"}


async def refresh_lead_followup(db: AsyncSession, lead_id: UUID) -> None:
    """Keep ``lead.next_followup_at`` equal to the earliest pending follow-up."""
    await db.flush()
    nxt = (
        await db.execute(
            select(func.min(ReFollowup.due_at)).where(ReFollowup.lead_id == lead_id, ReFollowup.status == "pending")
        )
    ).scalar_one_or_none()
    lead = await db.get(ReLead, lead_id)
    if lead is not None:
        lead.next_followup_at = nxt


async def customer_from_lead(ctx: Ctx, lead: ReLead) -> ReCustomer:
    """Create (once) the customer master for a lead and link them."""
    if lead.customer_id:
        existing = await ctx.db.get(ReCustomer, lead.customer_id)
        if existing:
            return existing
    cust = None
    if lead.phone:
        cust = (
            await ctx.db.execute(
                select(ReCustomer).where(ReCustomer.vendor_id == ctx.vendor_id, ReCustomer.phone == lead.phone)
            )
        ).scalars().first()
    if cust is None:
        cust = ReCustomer(
            id=uuid.uuid4(),
            vendor_id=ctx.vendor_id,
            customer_code=await next_number(ctx.db, ctx.vendor_id, "customer"),
            full_name=lead.full_name,
            phone=lead.phone,
            email=lead.email,
            kyc_status="pending",
        )
        ctx.db.add(cust)
        await ctx.db.flush()
    lead.customer_id = cust.id
    lead.converted_at = datetime.now(timezone.utc)
    return cust


async def recompute_kyc(db: AsyncSession, customer_id: UUID) -> Optional[str]:
    """Customer KYC is *verified* when an identity document is verified and PAN (or Form 60) is verified."""
    await db.flush()
    docs = (await db.execute(select(ReKycDocument).where(ReKycDocument.customer_id == customer_id))).scalars().all()
    customer = await db.get(ReCustomer, customer_id)
    if customer is None:
        return None
    verified = {d.doc_type for d in docs if d.status == "verified"}
    has_pan = "pan" in verified or "form_60" in verified
    has_other_id = bool(verified & (_ID_DOCS - {"pan"}))
    if not docs:
        status = "pending"
    elif has_pan and has_other_id:
        status = "verified"
    elif any(d.status == "rejected" for d in docs) and not verified:
        status = "rejected"
    else:
        status = "submitted"
    customer.kyc_status = status
    return status
