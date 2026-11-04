"""Handover & possession (module 17) and customer care (module 18)."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.realestate import core as C
from app.models.realestate import land as L
from app.models.realestate import postsales as S
from app.models.realestate import receivables as R

from .common import Ctx, D, audit, get_owned, money_q, notify

EPS = Decimal("0.005")
OPEN_SNAG = ("open", "in_progress", "rectified")
STRUCTURAL_WARRANTY_MONTHS = 60  # RERA s.14(3)


def _f(v: Any) -> float:
    return float(D(v))


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def add_months(d: date, months: int) -> date:
    m = d.month - 1 + months
    y, m = d.year + m // 12, m % 12 + 1
    from calendar import monthrange

    return date(y, m, min(d.day, monthrange(y, m)[1]))


# ═══ handover ═══════════════════════════════════════════════════════════════════════════════

async def handover_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    b = await get_owned(ctx.db, C.ReBooking, ctx.vendor_id, data["booking_id"], "booking")
    if b.status != "registered":
        raise HTTPException(
            status_code=409,
            detail=f"A handover can be scheduled once the agreement is registered (this booking is {b.status.replace('_', ' ')})")
    live = (await ctx.db.execute(select(func.count()).select_from(S.ReHandover).where(
        S.ReHandover.booking_id == b.id, S.ReHandover.status != "cancelled"))).scalar_one()
    if live:
        raise HTTPException(status_code=409, detail="This booking already has a handover in progress")
    data.update(project_id=b.project_id, unit_id=b.unit_id, customer_id=b.customer_id, status="scheduled")
    if not data.get("checklist"):
        data["checklist"] = [{"item": i, "done": False, "remarks": ""} for i in S.DEFAULT_CHECKLIST]
    _check_checklist(data["checklist"])


def _check_checklist(items: Any) -> None:
    if not isinstance(items, list) or any(not isinstance(i, dict) or not str(i.get("item", "")).strip() for i in items):
        raise HTTPException(status_code=422, detail="checklist must be a list of {item, done, remarks} entries")


async def handover_before_update(ctx: Ctx, obj: S.ReHandover, data: dict[str, Any]) -> None:
    if "booking_id" in data and data["booking_id"] != obj.booking_id:
        raise HTTPException(status_code=409, detail="The booking of a handover cannot be changed")
    if "checklist" in data:
        _check_checklist(data["checklist"])
    if int(data.get("keys_count", obj.keys_count) or 0) < 0:
        raise HTTPException(status_code=422, detail="keys_count cannot be negative")


async def schedule_outstanding(db: AsyncSession, booking_id: UUID) -> Decimal:
    items = (await db.execute(select(R.ReScheduleItem).where(
        R.ReScheduleItem.booking_id == booking_id, R.ReScheduleItem.status != "cancelled"))).scalars().all()
    return money_q(sum((max(D(i.total_due) - D(i.paid_amount), Decimal(0)) for i in items), Decimal(0)))


async def occupancy_certificate(db: AsyncSession, vendor_id: UUID, project_id: Optional[UUID]) -> Optional[L.ReStatutoryApproval]:
    from .land import approval_state

    rows = (await db.execute(select(L.ReStatutoryApproval).where(
        L.ReStatutoryApproval.vendor_id == vendor_id, L.ReStatutoryApproval.project_id == project_id,
        L.ReStatutoryApproval.approval_type.in_(("occupancy_certificate", "completion_certificate"))))).scalars().all()
    for a in rows:
        if approval_state(a) in ("approved", "renewal_due"):
            return a
    return None


async def open_snag_counts(db: AsyncSession, handover_id: UUID) -> dict[str, int]:
    rows = (await db.execute(select(S.ReSnag.severity, func.count()).where(
        S.ReSnag.handover_id == handover_id, S.ReSnag.status.in_(OPEN_SNAG)).group_by(S.ReSnag.severity))).all()
    out = {"minor": 0, "major": 0, "critical": 0}
    out.update({k: int(v) for k, v in rows})
    return out


async def readiness(ctx: Ctx, h: S.ReHandover) -> dict:
    b = await ctx.db.get(C.ReBooking, h.booking_id)
    oc = await occupancy_certificate(ctx.db, ctx.vendor_id, h.project_id)
    snags = await open_snag_counts(ctx.db, h.id)
    dues = await schedule_outstanding(ctx.db, h.booking_id)
    done = sum(1 for i in (h.checklist or []) if i.get("done"))
    total = len(h.checklist or [])
    checks = [
        {"key": "registered", "label": "Agreement registered", "ok": b is not None and b.status in ("registered", "handed_over"),
         "detail": b.status.replace("_", " ") if b else ""},
        {"key": "oc", "label": "Occupancy certificate on file", "ok": oc is not None or h.oc_waived,
         "detail": (f"{oc.reference_no or 'approved'}" if oc else "waived" if h.oc_waived else "none valid")},
        {"key": "snags", "label": "No open critical snags", "ok": snags["critical"] == 0,
         "detail": f"{snags['critical']} critical · {snags['major']} major · {snags['minor']} minor open"},
        {"key": "dues", "label": "All instalments paid", "ok": dues <= EPS or h.dues_waived,
         "detail": "waived" if h.dues_waived and dues > EPS else f"₹{dues:,.2f} outstanding"},
        {"key": "checklist", "label": "Handover checklist complete", "ok": total > 0 and done == total, "detail": f"{done}/{total} done"},
    ]
    return {"handover_no": h.handover_no, "status": h.status, "checks": checks,
            "can_offer": all(c["ok"] for c in checks if c["key"] in ("registered", "oc", "snags")),
            "can_complete": all(c["ok"] for c in checks), "outstanding": _f(dues), "open_snags": snags}


async def handover_start_inspection(ctx: Ctx, h: S.ReHandover, on: Optional[date]) -> S.ReHandover:
    if h.status != "scheduled":
        raise HTTPException(status_code=409, detail=f"Handover is {h.status}")
    h.status = "inspection"
    h.inspection_on = on or date.today()
    await audit(ctx, "handover", h.id, "inspection", ref=h.handover_no)
    return h


async def handover_offer(ctx: Ctx, h: S.ReHandover, *, waive_oc: bool, reason: Optional[str]) -> dict:
    from .payments import _demand_items, trigger_stage

    if h.status != "inspection":
        raise HTTPException(status_code=409, detail=f"Handover is {h.status}; start the inspection first")
    b = await get_owned(ctx.db, C.ReBooking, ctx.vendor_id, h.booking_id, "booking")
    if b.status != "registered":
        raise HTTPException(status_code=409, detail=f"Booking is {b.status}; possession is offered only on a registered agreement")
    if await occupancy_certificate(ctx.db, ctx.vendor_id, h.project_id) is None:
        if not waive_oc:
            raise HTTPException(
                status_code=409,
                detail="No valid occupancy / completion certificate on file for this project. Record it under Legal → Approvals, or waive with a reason.")
        if not (reason or "").strip():
            raise HTTPException(status_code=422, detail="Give a reason to waive the occupancy certificate")
        if not (ctx.has("realestate.approve") or ctx.has("realestate.admin")):
            raise HTTPException(status_code=403, detail="Waiving the occupancy certificate needs the approve permission")
        h.oc_waived = True
        h.waiver_reason = f"OC: {reason}".strip()[:500]
    snags = await open_snag_counts(ctx.db, h.id)
    if snags["critical"]:
        raise HTTPException(status_code=409, detail=f"{snags['critical']} critical snag(s) are still open; rectify them before offering possession")
    hit = await trigger_stage(ctx, b, ("on_possession",))
    res = await _demand_items(ctx, b, hit)
    h.status = "ready"
    h.offered_on = date.today()
    await audit(ctx, "handover", h.id, "offer", ref=h.handover_no, changes={"demands": len(res["created"]), "oc_waived": h.oc_waived})
    return {"demands_created": len(res["created"]), "skipped": res["skipped"]}


async def create_warranties(ctx: Ctx, b: C.ReBooking, start: date, general_months: int = 12) -> list[S.ReWarranty]:
    existing = (await ctx.db.execute(select(func.count()).select_from(S.ReWarranty).where(S.ReWarranty.booking_id == b.id))).scalar_one()
    if existing:
        return []
    specs = [("structural", STRUCTURAL_WARRANTY_MONTHS, True, "Structural defects: rectify within 30 days of notice (RERA s.14(3))")]
    if general_months > 0:
        specs.append(("general", general_months, False, "Fittings, finishes and workmanship"))
    out = []
    for cov, months, statutory, terms in specs:
        w = S.ReWarranty(
            id=uuid.uuid4(), vendor_id=ctx.vendor_id, booking_id=b.id, project_id=b.project_id, unit_id=b.unit_id,
            customer_id=b.customer_id, coverage=cov, starts_on=start, ends_on=add_months(start, months), months=months,
            statutory=statutory, status="active", terms=terms)
        ctx.db.add(w)
        out.append(w)
    await ctx.db.flush()
    return out


async def handover_complete(ctx: Ctx, h: S.ReHandover, *, received_by_name: str, keys_count: Optional[int], electricity: Optional[str],
                            water: Optional[str], waive_dues: bool, reason: Optional[str], general_warranty_months: int = 12) -> dict:
    from .payments import on_booking_stage

    if h.status != "ready":
        raise HTTPException(status_code=409, detail=f"Handover is {h.status}; offer possession first")
    if not (received_by_name or "").strip():
        raise HTTPException(status_code=422, detail="Record who received possession")
    b = await get_owned(ctx.db, C.ReBooking, ctx.vendor_id, h.booking_id, "booking")
    if b.status != "registered":
        raise HTTPException(status_code=409, detail=f"Booking is {b.status}")
    dues = await schedule_outstanding(ctx.db, b.id)
    if dues > EPS:
        if not waive_dues:
            raise HTTPException(status_code=409, detail=f"₹{dues:,.2f} is still outstanding on the payment schedule; collect it before handing over possession")
        if not (reason or "").strip():
            raise HTTPException(status_code=422, detail="Give a reason to waive the outstanding dues")
        if not (ctx.has("realestate.approve") or ctx.has("realestate.admin")):
            raise HTTPException(status_code=403, detail="Handing over with dues outstanding needs the approve permission")
        h.dues_waived = True
        h.waiver_reason = f"{h.waiver_reason + ' | ' if h.waiver_reason else ''}Dues: {reason}"[:500]
    snags = await open_snag_counts(ctx.db, h.id)
    if snags["critical"]:
        raise HTTPException(status_code=409, detail="A critical snag was reported after the offer; resolve it first")
    today = date.today()
    h.status, h.handed_over_on = "handed_over", today
    h.received_by_name, h.handed_over_by_name = received_by_name.strip(), ctx.actor_name
    h.customer_acknowledged = True
    if keys_count is not None:
        h.keys_count = keys_count
    h.electricity_meter_reading = electricity or h.electricity_meter_reading
    h.water_meter_reading = water or h.water_meter_reading
    b.status = "handed_over"
    unit = await ctx.db.get(C.ReUnit, b.unit_id)
    if unit is not None:
        unit.status = "handed_over"
    await ctx.db.flush()
    await on_booking_stage(ctx, b, "handed_over")
    warranties = await create_warranties(ctx, b, today, general_warranty_months)
    await audit(ctx, "handover", h.id, "complete", ref=h.handover_no, changes={"dues_waived": h.dues_waived})
    return {"warranties": [{"coverage": w.coverage, "ends_on": w.ends_on.isoformat()} for w in warranties]}


async def handover_cancel(ctx: Ctx, h: S.ReHandover, reason: str) -> S.ReHandover:
    if h.status == "handed_over":
        raise HTTPException(status_code=409, detail="Possession has already been handed over")
    if h.status == "cancelled":
        raise HTTPException(status_code=409, detail="Already cancelled")
    h.status = "cancelled"
    h.remarks = f"{h.remarks or ''}\nCancelled: {reason}".strip()[:4000]
    await audit(ctx, "handover", h.id, "cancel", ref=h.handover_no)
    return h


# ═══ snags ══════════════════════════════════════════════════════════════════════════════════

SNAG_DAYS = {"critical": 7, "major": 15, "minor": 30}


async def snag_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    if data.get("handover_id"):
        h = await get_owned(ctx.db, S.ReHandover, ctx.vendor_id, data["handover_id"], "handover")
        if h.status == "cancelled":
            raise HTTPException(status_code=409, detail="The handover is cancelled")
        booking_id = h.booking_id
        data["handover_id"] = h.id
    elif data.get("booking_id"):
        booking_id = data["booking_id"]
    else:
        raise HTTPException(status_code=422, detail="Choose the handover (or booking) this snag belongs to")
    b = await get_owned(ctx.db, C.ReBooking, ctx.vendor_id, booking_id, "booking")
    data.update(booking_id=b.id, project_id=b.project_id, unit_id=b.unit_id, customer_id=b.customer_id, status="open")
    data.setdefault("reported_on", date.today())
    if not data.get("due_date"):
        data["due_date"] = data["reported_on"] + timedelta(days=SNAG_DAYS.get(data.get("severity", "minor"), 30))
    data.setdefault("reported_via", "staff")


async def snag_before_update(ctx: Ctx, obj: S.ReSnag, data: dict[str, Any]) -> None:
    for k in ("handover_id", "booking_id"):
        if k in data and data[k] != getattr(obj, k):
            raise HTTPException(status_code=409, detail="A snag cannot move to another unit")


def _snag(s: S.ReSnag, allowed: tuple[str, ...], label: str) -> None:
    if s.status not in allowed:
        raise HTTPException(status_code=409, detail=f"Snag is {s.status}; cannot {label}")


async def snag_assign(ctx: Ctx, s: S.ReSnag, assigned_to: str, contractor_id: Optional[UUID], due_date: Optional[date]) -> S.ReSnag:
    _snag(s, ("open", "in_progress"), "assign")
    if not (assigned_to or "").strip() and not contractor_id:
        raise HTTPException(status_code=422, detail="Name who will rectify the snag")
    s.assigned_to = (assigned_to or "").strip() or s.assigned_to
    if contractor_id:
        from app.models.realestate.contractors import ReContractor

        await get_owned(ctx.db, ReContractor, ctx.vendor_id, contractor_id, "contractor")
        s.contractor_id = contractor_id
    if due_date:
        s.due_date = due_date
    s.status = "in_progress"
    await audit(ctx, "snag", s.id, "assign", changes={"to": s.assigned_to})
    return s


async def snag_rectify(ctx: Ctx, s: S.ReSnag, resolution: str) -> S.ReSnag:
    _snag(s, ("open", "in_progress"), "rectify")
    if not (resolution or "").strip():
        raise HTTPException(status_code=422, detail="Describe the rectification")
    s.status, s.resolution, s.rectified_on = "rectified", resolution.strip(), date.today()
    await audit(ctx, "snag", s.id, "rectify")
    return s


async def snag_verify(ctx: Ctx, s: S.ReSnag) -> S.ReSnag:
    _snag(s, ("rectified",), "verify")
    s.status, s.verified_on = "verified", date.today()
    await audit(ctx, "snag", s.id, "verify")
    return s


async def snag_reopen(ctx: Ctx, s: S.ReSnag, reason: str) -> S.ReSnag:
    _snag(s, ("rectified", "verified", "waived"), "reopen")
    if not (reason or "").strip():
        raise HTTPException(status_code=422, detail="Give a reason for reopening")
    s.status, s.rectified_on, s.verified_on = "open", None, None
    s.resolution = f"{s.resolution or ''}\nReopened: {reason.strip()}".strip()[:4000]
    await audit(ctx, "snag", s.id, "reopen", changes={"reason": reason})
    return s


async def snag_waive(ctx: Ctx, s: S.ReSnag, reason: str) -> S.ReSnag:
    _snag(s, ("open", "in_progress"), "waive")
    if not (reason or "").strip():
        raise HTTPException(status_code=422, detail="Record why the customer accepts it as is")
    s.status, s.resolution = "waived", f"Accepted as is: {reason.strip()}"
    await audit(ctx, "snag", s.id, "waive")
    return s


# ═══ warranty ═══════════════════════════════════════════════════════════════════════════════

async def warranty_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    b = await get_owned(ctx.db, C.ReBooking, ctx.vendor_id, data["booking_id"], "booking")
    data.update(project_id=b.project_id, unit_id=b.unit_id, customer_id=b.customer_id)
    if data.get("ends_on") is None:
        data["ends_on"] = add_months(data["starts_on"], int(data.get("months") or 12))
    if data["ends_on"] <= data["starts_on"]:
        raise HTTPException(status_code=422, detail="ends_on must be after starts_on")
    data["status"] = "active"


async def warranty_before_update(ctx: Ctx, obj: S.ReWarranty, data: dict[str, Any]) -> None:
    if obj.statutory and ("coverage" in data or "months" in data or "ends_on" in data or "starts_on" in data):
        raise HTTPException(status_code=409, detail="A statutory warranty cannot be changed")
    s, e = data.get("starts_on", obj.starts_on), data.get("ends_on", obj.ends_on)
    if e <= s:
        raise HTTPException(status_code=422, detail="ends_on must be after starts_on")


def warranty_active(w: S.ReWarranty, on: Optional[date] = None) -> bool:
    on = on or date.today()
    return w.status == "active" and w.starts_on <= on <= w.ends_on


async def expire_warranties(db: AsyncSession, vendor_id: UUID) -> int:
    rows = (await db.execute(select(S.ReWarranty).where(
        S.ReWarranty.vendor_id == vendor_id, S.ReWarranty.status == "active", S.ReWarranty.ends_on < date.today()))).scalars().all()
    for w in rows:
        w.status = "expired"
    if rows:
        await db.flush()
    return len(rows)


# ═══ tickets ════════════════════════════════════════════════════════════════════════════════

def sla_state(t: S.ReTicket, now: Optional[datetime] = None) -> str:
    now = now or _now()
    due = _aware(t.due_at)
    if due is None:
        return "on_track"
    if t.status in ("resolved", "closed"):
        done = _aware(t.resolved_at) or _aware(t.closed_at) or now
        return "met" if done <= due else "breached"
    if now > due:
        return "breached"
    window = max(int(t.sla_hours or 1), 1) * 3600
    return "at_risk" if (due - now).total_seconds() < window * 0.25 else "on_track"


async def create_ticket(ctx: Ctx, data: dict[str, Any]) -> dict[str, Any]:
    """Validate + enrich ticket data (SLA, links to booking / warranty). Used by the generic create and the portal."""
    cust = await get_owned(ctx.db, C.ReCustomer, ctx.vendor_id, data["customer_id"], "customer")
    b = None
    if data.get("booking_id"):
        b = await get_owned(ctx.db, C.ReBooking, ctx.vendor_id, data["booking_id"], "booking")
        if b.customer_id != cust.id:
            raise HTTPException(status_code=422, detail="That booking belongs to a different customer")
        data.update(project_id=b.project_id, unit_id=b.unit_id)
    cat = data.get("category", "request")
    priority = data.get("priority", "medium")
    sla = S.SLA_HOURS.get(priority, 72)
    if cat == "structural_defect":
        if b is None:
            raise HTTPException(status_code=422, detail="Choose the booking the structural defect relates to")
        w = None
        if data.get("warranty_id"):
            w = await get_owned(ctx.db, S.ReWarranty, ctx.vendor_id, data["warranty_id"], "warranty")
            if w.booking_id != b.id:
                raise HTTPException(status_code=422, detail="That warranty belongs to a different booking")
        else:
            w = (await ctx.db.execute(select(S.ReWarranty).where(
                S.ReWarranty.booking_id == b.id, S.ReWarranty.coverage == "structural", S.ReWarranty.status != "void")
                .order_by(S.ReWarranty.ends_on.desc()).limit(1))).scalar_one_or_none()
        if w is None:
            raise HTTPException(status_code=409, detail="No structural warranty found — the 5-year defect liability starts when possession is handed over")
        if not warranty_active(w):
            raise HTTPException(status_code=409, detail=f"The structural warranty ran from {w.starts_on} to {w.ends_on}; this claim is outside it")
        data["warranty_id"] = w.id
        sla = S.STRUCTURAL_SLA_HOURS
        if priority in ("low", "medium"):
            data["priority"] = "high"
    elif data.get("warranty_id"):
        w = await get_owned(ctx.db, S.ReWarranty, ctx.vendor_id, data["warranty_id"], "warranty")
        if not warranty_active(w):
            raise HTTPException(status_code=409, detail=f"The warranty is not active (valid {w.starts_on} to {w.ends_on})")
    data["sla_hours"] = sla
    data["due_at"] = _now() + timedelta(hours=sla)
    data["status"] = "open"
    data.setdefault("channel", "phone")
    data.update(first_response_at=None, resolved_at=None, closed_at=None, resolution=None, reopen_count=0, sla_breached=False)
    return data


async def ticket_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    await create_ticket(ctx, data)


async def ticket_after_create(ctx: Ctx, t: S.ReTicket) -> None:
    await notify(ctx.db, ctx.vendor_id, f"New {t.priority} ticket {t.ticket_no}", t.subject[:200],
                 reference_type="ticket", reference_id=t.id)


async def ticket_before_update(ctx: Ctx, obj: S.ReTicket, data: dict[str, Any]) -> None:
    for k in ("customer_id", "booking_id", "category"):
        if k in data and data[k] != getattr(obj, k):
            raise HTTPException(status_code=409, detail=f"{k} cannot be changed once the ticket is raised")
    if "priority" in data and data["priority"] != obj.priority and obj.category != "structural_defect":
        hours = S.SLA_HOURS.get(data["priority"], 72)
        created = _aware(obj.created_at) or _now()
        data["sla_hours"], data["due_at"] = hours, created + timedelta(hours=hours)


def _ticket(t: S.ReTicket, allowed: tuple[str, ...], label: str) -> None:
    if t.status not in allowed:
        raise HTTPException(status_code=409, detail=f"Ticket is {t.status}; cannot {label}")


def _responded(t: S.ReTicket) -> None:
    if t.first_response_at is None:
        t.first_response_at = _now()


async def ticket_assign(ctx: Ctx, t: S.ReTicket, assignee: str) -> S.ReTicket:
    _ticket(t, ("open", "in_progress", "waiting_customer"), "assign")
    if not (assignee or "").strip():
        raise HTTPException(status_code=422, detail="Name the assignee")
    t.assigned_to_name = assignee.strip()
    if t.status == "open":
        t.status = "in_progress"
    _responded(t)
    await audit(ctx, "ticket", t.id, "assign", ref=t.ticket_no, changes={"to": t.assigned_to_name})
    return t


async def ticket_wait(ctx: Ctx, t: S.ReTicket) -> S.ReTicket:
    _ticket(t, ("open", "in_progress"), "wait for the customer")
    t.status = "waiting_customer"
    _responded(t)
    await audit(ctx, "ticket", t.id, "waiting", ref=t.ticket_no)
    return t


async def ticket_resolve(ctx: Ctx, t: S.ReTicket, resolution: str) -> S.ReTicket:
    _ticket(t, ("open", "in_progress", "waiting_customer"), "resolve")
    if not (resolution or "").strip():
        raise HTTPException(status_code=422, detail="Describe the resolution")
    t.status, t.resolution, t.resolved_at = "resolved", resolution.strip(), _now()
    _responded(t)
    t.sla_breached = sla_state(t) == "breached"
    await audit(ctx, "ticket", t.id, "resolve", ref=t.ticket_no, changes={"sla_breached": t.sla_breached})
    return t


async def ticket_close(ctx: Ctx, t: S.ReTicket) -> S.ReTicket:
    _ticket(t, ("resolved",), "close")
    t.status, t.closed_at = "closed", _now()
    await audit(ctx, "ticket", t.id, "close", ref=t.ticket_no)
    return t


async def ticket_reopen(ctx: Ctx, t: S.ReTicket, reason: str) -> S.ReTicket:
    _ticket(t, ("resolved", "closed"), "reopen")
    if not (reason or "").strip():
        raise HTTPException(status_code=422, detail="Give a reason for reopening")
    ref = _aware(t.closed_at) or _aware(t.resolved_at) or _now()
    if _now() - ref > timedelta(days=30):
        raise HTTPException(status_code=409, detail="Tickets can be reopened only within 30 days; raise a new ticket instead")
    t.status, t.resolved_at, t.closed_at = "open", None, None
    t.reopen_count = int(t.reopen_count or 0) + 1
    t.sla_breached = False
    t.due_at = _now() + timedelta(hours=int(t.sla_hours or 72))
    db_comment = S.ReTicketComment(id=uuid.uuid4(), vendor_id=ctx.vendor_id, ticket_id=t.id,
                                   author_type="customer" if ctx.role == "customer" else "staff",
                                   author_name=ctx.actor_name, body=f"Reopened: {reason.strip()}", is_internal=False)
    ctx.db.add(db_comment)
    await audit(ctx, "ticket", t.id, "reopen", ref=t.ticket_no, changes={"reason": reason})
    return t


async def comment_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    t = await get_owned(ctx.db, S.ReTicket, ctx.vendor_id, data["ticket_id"], "ticket")
    if t.status == "closed":
        raise HTTPException(status_code=409, detail="The ticket is closed; reopen it to add notes")
    if not (data.get("body") or "").strip():
        raise HTTPException(status_code=422, detail="body is required")
    data.update(author_type="staff", author_name=ctx.actor_name)


async def comment_after_create(ctx: Ctx, c: S.ReTicketComment) -> None:
    t = await ctx.db.get(S.ReTicket, c.ticket_id)
    if t is None or c.is_internal:
        return
    _responded(t)
    if t.status == "open":
        t.status = "in_progress"
    elif t.status == "waiting_customer":
        pass


async def feedback_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    await validate_feedback(ctx, data)
    data.setdefault("submitted_via", "staff")


async def validate_feedback(ctx: Ctx, data: dict[str, Any]) -> None:
    if not 1 <= int(data.get("rating") or 0) <= 5:
        raise HTTPException(status_code=422, detail="rating must be between 1 and 5")
    if data.get("nps") is not None and not 0 <= int(data["nps"]) <= 10:
        raise HTTPException(status_code=422, detail="nps must be between 0 and 10")
    if data.get("ticket_id"):
        t = await get_owned(ctx.db, S.ReTicket, ctx.vendor_id, data["ticket_id"], "ticket")
        if t.status not in ("resolved", "closed"):
            raise HTTPException(status_code=409, detail="Feedback can be given once the ticket is resolved")
        data.update(customer_id=t.customer_id, booking_id=t.booking_id, project_id=t.project_id)
        data.setdefault("kind", "ticket")
    elif data.get("handover_id"):
        h = await get_owned(ctx.db, S.ReHandover, ctx.vendor_id, data["handover_id"], "handover")
        if h.status != "handed_over":
            raise HTTPException(status_code=409, detail="Handover feedback can be given after possession")
        data.update(customer_id=h.customer_id, booking_id=h.booking_id, project_id=h.project_id)
        data.setdefault("kind", "handover")
    if not data.get("customer_id"):
        raise HTTPException(status_code=422, detail="Choose the customer this feedback is from")


# ═══ summaries ══════════════════════════════════════════════════════════════════════════════

async def care_summary(db: AsyncSession, vendor_id: UUID) -> dict:
    await expire_warranties(db, vendor_id)
    tickets = (await db.execute(select(S.ReTicket).where(S.ReTicket.vendor_id == vendor_id))).scalars().all()
    now = _now()
    open_t = [t for t in tickets if t.status not in ("resolved", "closed")]
    by_state = {"on_track": 0, "at_risk": 0, "breached": 0}
    for t in open_t:
        by_state[sla_state(t, now)] += 1
    closed = [t for t in tickets if t.status in ("resolved", "closed")]
    met = sum(1 for t in closed if sla_state(t, now) == "met")
    resp = [(_aware(t.first_response_at) - _aware(t.created_at)).total_seconds() / 3600
            for t in tickets if t.first_response_at and t.created_at]
    by_cat: dict[str, int] = {}
    for t in tickets:
        by_cat[t.category] = by_cat.get(t.category, 0) + 1
    fb = (await db.execute(select(S.ReFeedback).where(S.ReFeedback.vendor_id == vendor_id))).scalars().all()
    nps_rows = [f.nps for f in fb if f.nps is not None]
    nps = None
    if nps_rows:
        nps = round((sum(1 for n in nps_rows if n >= 9) - sum(1 for n in nps_rows if n <= 6)) / len(nps_rows) * 100, 1)
    soon = date.today() + timedelta(days=60)
    w_active = (await db.execute(select(func.count()).select_from(S.ReWarranty).where(
        S.ReWarranty.vendor_id == vendor_id, S.ReWarranty.status == "active"))).scalar_one()
    w_soon = (await db.execute(select(func.count()).select_from(S.ReWarranty).where(
        S.ReWarranty.vendor_id == vendor_id, S.ReWarranty.status == "active", S.ReWarranty.ends_on <= soon))).scalar_one()
    h_rows = (await db.execute(select(S.ReHandover.status, func.count()).where(
        S.ReHandover.vendor_id == vendor_id).group_by(S.ReHandover.status))).all()
    return {
        "tickets": {"total": len(tickets), "open": len(open_t), "sla": by_state, "by_category": by_cat,
                    "sla_met_percent": round(met / len(closed) * 100, 1) if closed else None,
                    "avg_first_response_hours": round(sum(resp) / len(resp), 1) if resp else None},
        "feedback": {"count": len(fb), "avg_rating": round(sum(f.rating for f in fb) / len(fb), 2) if fb else None, "nps": nps},
        "warranties": {"active": w_active, "expiring_60_days": w_soon},
        "handovers": {k: int(v) for k, v in h_rows},
    }
