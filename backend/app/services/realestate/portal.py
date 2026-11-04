"""Customer portal: revocable expiring links and the read model a customer sees (only their own data)."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.realestate import core as C
from app.models.realestate import postsales as S
from app.models.realestate import receivables as R
from app.models.realestate.base import now_utc

from .common import Ctx, D, audit, get_owned, money_q
from .postsales import _aware, _f, sla_state, warranty_active

PORTAL_TOKEN_TYPE = "re_portal"
DEFAULT_DAYS, MAX_DAYS = 30, 180


async def create_link(ctx: Ctx, customer: C.ReCustomer, days: int = DEFAULT_DAYS) -> dict:
    if not customer.is_active:
        raise HTTPException(status_code=409, detail="The customer is inactive")
    if not 1 <= days <= MAX_DAYS:
        raise HTTPException(status_code=422, detail=f"days must be between 1 and {MAX_DAYS}")
    await revoke_links(ctx, customer, audit_it=False)  # one live link per customer
    jti = uuid.uuid4().hex
    expires = now_utc() + timedelta(days=days)
    ctx.db.add(S.RePortalLink(id=uuid.uuid4(), vendor_id=ctx.vendor_id, customer_id=customer.id, jti=jti, expires_at=expires,
                              revoked=False, created_by_name=ctx.actor_name, use_count=0))
    customer.portal_enabled = True
    token = jwt.encode({"type": PORTAL_TOKEN_TYPE, "vendor_id": str(ctx.vendor_id), "customer_id": str(customer.id), "jti": jti,
                        "exp": expires}, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    await audit(ctx, "customer", customer.id, "portal_link", ref=customer.customer_code, changes={"days": days})
    return {"token": token, "path": f"/portal/real-estate?token={token}", "expires_at": expires.isoformat()}


async def revoke_links(ctx: Ctx, customer: C.ReCustomer, audit_it: bool = True) -> int:
    rows = (await ctx.db.execute(select(S.RePortalLink).where(
        S.RePortalLink.customer_id == customer.id, S.RePortalLink.vendor_id == ctx.vendor_id,
        S.RePortalLink.revoked.is_(False)))).scalars().all()
    for r in rows:
        r.revoked = True
    customer.portal_enabled = False
    if audit_it:
        await audit(ctx, "customer", customer.id, "portal_revoke", ref=customer.customer_code)
    return len(rows)


async def authenticate(db: AsyncSession, token: Optional[str]) -> Ctx:
    """Resolve a portal token to a Ctx scoped to one customer. Raises 401 for anything wrong with the link."""
    bad = HTTPException(status_code=401, detail="This link is invalid or has expired. Ask your relationship manager for a new one.")
    if not token:
        raise bad
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != PORTAL_TOKEN_TYPE:
            raise bad
        vendor_id, customer_id, jti = UUID(payload["vendor_id"]), UUID(payload["customer_id"]), str(payload["jti"])
    except (JWTError, KeyError, ValueError):
        raise bad
    link = (await db.execute(select(S.RePortalLink).where(
        S.RePortalLink.jti == jti, S.RePortalLink.vendor_id == vendor_id, S.RePortalLink.customer_id == customer_id))).scalar_one_or_none()
    if link is None or link.revoked or _aware(link.expires_at) < datetime.now(timezone.utc):
        raise bad
    cust = await db.get(C.ReCustomer, customer_id)
    if cust is None or cust.vendor_id != vendor_id or not cust.is_active or not cust.portal_enabled:
        raise bad
    link.last_used_at = now_utc()
    link.use_count = int(link.use_count or 0) + 1
    ctx = Ctx(db=db, vendor_id=vendor_id, user_id=None, actor_name=cust.full_name, permissions=frozenset(), role="customer")
    ctx.customer = cust  # type: ignore[attr-defined]
    return ctx


async def _by_id(db: AsyncSession, model: Any, ids: set, vendor_id: UUID) -> dict:
    ids = {i for i in ids if i is not None}
    if not ids:
        return {}
    rows = (await db.execute(select(model).where(model.id.in_(ids), model.vendor_id == vendor_id))).scalars().all()
    return {r.id: r for r in rows}


async def _rows(db: AsyncSession, model: Any, booking_ids: list, *conds: Any, order: Any = None) -> list:
    if not booking_ids:
        return []
    stmt = select(model).where(model.booking_id.in_(booking_ids), *conds)
    return list((await db.execute(stmt.order_by(order) if order is not None else stmt)).scalars().all())


def _group(rows: list) -> dict:
    out: dict = {}
    for r in rows:
        out.setdefault(r.booking_id, []).append(r)
    return out


async def portal_overview(ctx: Ctx, cust: C.ReCustomer) -> dict:
    bookings = (await ctx.db.execute(select(C.ReBooking).where(
        C.ReBooking.vendor_id == ctx.vendor_id, C.ReBooking.customer_id == cust.id,
        C.ReBooking.status.notin_(("draft", "pending_approval", "cancelled"))).order_by(C.ReBooking.booking_date.desc()))).scalars().all()
    out = []
    ids = [b.id for b in bookings]
    # One query per kind for ALL of the customer's bookings (not per booking), grouped in memory.
    projects = await _by_id(ctx.db, C.ReProject, {b.project_id for b in bookings}, ctx.vendor_id)
    units = await _by_id(ctx.db, C.ReUnit, {b.unit_id for b in bookings}, ctx.vendor_id)
    towers = await _by_id(ctx.db, C.ReTower, {u.tower_id for u in units.values() if u.tower_id}, ctx.vendor_id)
    schedules = _group(await _rows(ctx.db, R.ReScheduleItem, ids, order=R.ReScheduleItem.seq))
    demands_by = _group(await _rows(ctx.db, R.ReDemand, ids, R.ReDemand.status != "cancelled", order=R.ReDemand.demand_date))
    receipts_by = _group(await _rows(ctx.db, R.ReReceipt, ids, R.ReReceipt.status.in_(("received", "cleared")), order=R.ReReceipt.receipt_date))
    handovers = _group(await _rows(ctx.db, S.ReHandover, ids, S.ReHandover.status != "cancelled"))
    snags_by = _group(await _rows(ctx.db, S.ReSnag, ids, order=S.ReSnag.reported_on))
    warranties_by = _group(await _rows(ctx.db, S.ReWarranty, ids, S.ReWarranty.status != "void"))
    for b in bookings:
        unit = units.get(b.unit_id)
        tower = towers.get(unit.tower_id) if unit is not None and unit.tower_id else None
        schedule = schedules.get(b.id, [])
        demands = demands_by.get(b.id, [])
        receipts = receipts_by.get(b.id, [])
        ho = (handovers.get(b.id) or [None])[0]
        snags = snags_by.get(b.id, [])
        warranties = warranties_by.get(b.id, [])
        outstanding = money_q(sum((max(D(i.total_due) - D(i.paid_amount), Decimal(0)) for i in schedule if i.status != "cancelled"), Decimal(0)))
        today = date.today()
        unpaid = [d for d in demands if d.status in ("issued", "partial")]
        nxt = min((d for d in unpaid if d.due_date), key=lambda d: d.due_date, default=None)
        out.append({
            "id": str(b.id), "booking_no": b.booking_no, "status": b.status, "booking_date": b.booking_date.isoformat() if b.booking_date else None,
            "project": projects[b.project_id].name if b.project_id in projects else "", "city": projects[b.project_id].city if b.project_id in projects else None,
            "unit": f"{tower.name + ' · ' if tower is not None else ''}{unit.unit_number if unit is not None else ''}",
            "agreement_value": _f(b.agreement_value), "total_consideration": _f(b.total_consideration), "paid_amount": _f(b.paid_amount),
            "outstanding": _f(outstanding),
            "next_due": ({"demand_no": nxt.demand_no, "stage": nxt.stage_name, "due_date": nxt.due_date.isoformat(),
                          "amount": _f(D(nxt.total_amount) - D(nxt.paid_amount)), "overdue": nxt.due_date < today} if nxt else None),
            "schedule": [{"seq": i.seq, "name": i.name, "percent": _f(i.percent), "due_date": i.due_date.isoformat() if i.due_date else None,
                          "total_due": _f(i.total_due), "paid": _f(i.paid_amount), "status": i.status} for i in schedule],
            "demands": [{"id": str(d.id), "demand_no": d.demand_no, "stage": d.stage_name, "due_date": d.due_date.isoformat() if d.due_date else None,
                         "total": _f(d.total_amount), "paid": _f(d.paid_amount), "status": d.status} for d in demands],
            "receipts": [{"receipt_no": r.receipt_no, "date": r.receipt_date.isoformat(), "amount": _f(r.amount), "tds": _f(r.tds_amount),
                          "mode": r.mode, "status": r.status} for r in receipts],
            "handover": ({"handover_no": ho.handover_no, "status": ho.status, "scheduled_on": ho.scheduled_on.isoformat() if ho.scheduled_on else None,
                          "offered_on": ho.offered_on.isoformat() if ho.offered_on else None,
                          "handed_over_on": ho.handed_over_on.isoformat() if ho.handed_over_on else None} if ho else None),
            "snags": [{"id": str(s.id), "category": s.category, "location": s.location, "description": s.description, "severity": s.severity,
                       "status": s.status, "due_date": s.due_date.isoformat() if s.due_date else None} for s in snags],
            "warranties": [{"id": str(w.id), "coverage": w.coverage, "starts_on": w.starts_on.isoformat(), "ends_on": w.ends_on.isoformat(),
                            "statutory": w.statutory, "active": warranty_active(w)} for w in warranties],
        })
    tickets = (await ctx.db.execute(select(S.ReTicket).where(S.ReTicket.customer_id == cust.id, S.ReTicket.vendor_id == ctx.vendor_id)
                                    .order_by(S.ReTicket.created_at.desc()).limit(50))).scalars().all()
    t_out = []
    comments_by: dict = {}
    if tickets:
        for c in (await ctx.db.execute(select(S.ReTicketComment).where(
                S.ReTicketComment.ticket_id.in_([t.id for t in tickets]), S.ReTicketComment.is_internal.is_(False))
                .order_by(S.ReTicketComment.created_at))).scalars().all():
            comments_by.setdefault(c.ticket_id, []).append(c)
    for t in tickets:
        comments = comments_by.get(t.id, [])
        t_out.append({
            "id": str(t.id), "ticket_no": t.ticket_no, "subject": t.subject, "category": t.category, "status": t.status, "priority": t.priority,
            "booking_id": str(t.booking_id) if t.booking_id else None, "created_at": t.created_at.isoformat() if t.created_at else None,
            "due_at": t.due_at.isoformat() if t.due_at else None, "sla": sla_state(t), "resolution": t.resolution,
            "comments": [{"author": c.author_name, "by": c.author_type, "body": c.body, "at": c.created_at.isoformat() if c.created_at else None}
                         for c in comments],
        })
    return {"customer": {"name": cust.full_name, "code": cust.customer_code, "phone": cust.phone, "email": cust.email},
            "bookings": out, "tickets": t_out, "categories": list(S.TICKET_CATEGORIES)}


async def customer_booking(ctx: Ctx, cust: C.ReCustomer, booking_id: Optional[UUID]) -> Optional[C.ReBooking]:
    if booking_id is None:
        return None
    b = await get_owned(ctx.db, C.ReBooking, ctx.vendor_id, booking_id, "booking")
    if b.customer_id != cust.id:
        raise HTTPException(status_code=404, detail="booking not found")  # never reveal other customers' bookings
    return b
