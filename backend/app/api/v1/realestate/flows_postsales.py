"""Workflow endpoints — Phase 5: handover, snags, warranty, tickets, feedback and customer-portal links."""
from __future__ import annotations

import html as _html
import uuid
from datetime import date
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.models.realestate import core as C
from app.models.realestate import postsales as S
from app.services.realestate import portal as portal_svc
from app.services.realestate import postsales as ps
from app.services.realestate.common import Ctx, audit, get_owned, next_number

from .ctx import ctx_dep

router = APIRouter()

view = ctx_dep("realestate.view")
handover_dep = ctx_dep("realestate.booking")
care = ctx_dep("realestate.manage")
sales = ctx_dep("realestate.sales")


def truthy(v: Any) -> bool:
    return v is True or str(v).strip().lower() in ("yes", "true", "1", "y")


class _Reason(BaseModel):
    reason: str = ""


async def _own(ctx: Ctx, model, id_: uuid.UUID, label: str):
    return await get_owned(ctx.db, model, ctx.vendor_id, id_, label)


# ═══ summary ════════════════════════════════════════════════════════════════════════════════

@router.get("/care/summary", summary="Ticket SLA, feedback, warranty and handover overview")
async def care_summary(ctx: Ctx = Depends(view)):
    out = await ps.care_summary(ctx.db, ctx.vendor_id)
    await ctx.db.commit()  # persists warranties that have just expired
    return out


# ═══ handover ═══════════════════════════════════════════════════════════════════════════════

class ScheduleIn(BaseModel):
    scheduled_on: Optional[date] = None


@router.post("/bookings/{booking_id}/schedule-handover", status_code=201)
async def schedule_handover(booking_id: uuid.UUID, body: ScheduleIn, ctx: Ctx = Depends(handover_dep)):
    data: dict[str, Any] = {"booking_id": booking_id, "scheduled_on": body.scheduled_on or date.today()}
    await ps.handover_before_create(ctx, data)
    h = S.ReHandover(id=uuid.uuid4(), vendor_id=ctx.vendor_id, handover_no=await next_number(ctx.db, ctx.vendor_id, "handover"),
                     keys_count=0, oc_waived=False, dues_waived=False, customer_acknowledged=False, **data)
    ctx.db.add(h)
    await ctx.db.flush()
    await audit(ctx, "handover", h.id, "create", ref=h.handover_no)
    await ctx.db.commit()
    return {"id": str(h.id), "handover_no": h.handover_no, "message": f"Handover {h.handover_no} scheduled"}


@router.get("/handovers/{ho_id}/readiness")
async def handover_readiness(ho_id: uuid.UUID, ctx: Ctx = Depends(view)):
    return await ps.readiness(ctx, await _own(ctx, S.ReHandover, ho_id, "handover"))


class InspectIn(BaseModel):
    inspection_on: Optional[date] = None


@router.post("/handovers/{ho_id}/inspect")
async def handover_inspect(ho_id: uuid.UUID, body: InspectIn, ctx: Ctx = Depends(handover_dep)):
    h = await ps.handover_start_inspection(ctx, await _own(ctx, S.ReHandover, ho_id, "handover"), body.inspection_on)
    await ctx.db.commit()
    return {"message": f"Inspection of {h.handover_no} started — log snags as you find them"}


class OfferIn(BaseModel):
    waive_oc: Any = "no"
    reason: Optional[str] = None


@router.post("/handovers/{ho_id}/offer")
async def handover_offer(ho_id: uuid.UUID, body: OfferIn, ctx: Ctx = Depends(handover_dep)):
    h = await _own(ctx, S.ReHandover, ho_id, "handover")
    res = await ps.handover_offer(ctx, h, waive_oc=truthy(body.waive_oc), reason=body.reason)
    await ctx.db.commit()
    return {"message": f"Possession offered; {res['demands_created']} demand(s) issued", **res}


class CompleteIn(BaseModel):
    received_by_name: str = Field(..., min_length=1)
    keys_count: Optional[int] = Field(None, ge=0)
    electricity_meter_reading: Optional[str] = None
    water_meter_reading: Optional[str] = None
    waive_dues: Any = "no"
    reason: Optional[str] = None
    general_warranty_months: int = Field(12, ge=0, le=60)


@router.post("/handovers/{ho_id}/complete")
async def handover_complete(ho_id: uuid.UUID, body: CompleteIn, ctx: Ctx = Depends(handover_dep)):
    h = await _own(ctx, S.ReHandover, ho_id, "handover")
    res = await ps.handover_complete(
        ctx, h, received_by_name=body.received_by_name, keys_count=body.keys_count, electricity=body.electricity_meter_reading,
        water=body.water_meter_reading, waive_dues=truthy(body.waive_dues), reason=body.reason,
        general_warranty_months=body.general_warranty_months)
    await ctx.db.commit()
    return {"message": f"Possession of the unit handed over; {len(res['warranties'])} warranty record(s) created", **res}


@router.post("/handovers/{ho_id}/cancel")
async def handover_cancel(ho_id: uuid.UUID, body: _Reason, ctx: Ctx = Depends(handover_dep)):
    h = await ps.handover_cancel(ctx, await _own(ctx, S.ReHandover, ho_id, "handover"), body.reason)
    await ctx.db.commit()
    return {"message": f"{h.handover_no} cancelled"}


# ═══ snags ══════════════════════════════════════════════════════════════════════════════════

class AssignSnagIn(BaseModel):
    assigned_to: Optional[str] = None
    contractor_id: Optional[uuid.UUID] = None
    due_date: Optional[date] = None


@router.post("/snags/{snag_id}/assign")
async def snag_assign(snag_id: uuid.UUID, body: AssignSnagIn, ctx: Ctx = Depends(care)):
    await ps.snag_assign(ctx, await _own(ctx, S.ReSnag, snag_id, "snag"), body.assigned_to or "", body.contractor_id, body.due_date)
    await ctx.db.commit()
    return {"message": "Snag assigned"}


class ResolutionIn(BaseModel):
    resolution: str = ""


@router.post("/snags/{snag_id}/rectify")
async def snag_rectify(snag_id: uuid.UUID, body: ResolutionIn, ctx: Ctx = Depends(care)):
    await ps.snag_rectify(ctx, await _own(ctx, S.ReSnag, snag_id, "snag"), body.resolution)
    await ctx.db.commit()
    return {"message": "Snag marked as rectified"}


@router.post("/snags/{snag_id}/verify")
async def snag_verify(snag_id: uuid.UUID, ctx: Ctx = Depends(care)):
    await ps.snag_verify(ctx, await _own(ctx, S.ReSnag, snag_id, "snag"))
    await ctx.db.commit()
    return {"message": "Snag verified"}


@router.post("/snags/{snag_id}/reopen")
async def snag_reopen(snag_id: uuid.UUID, body: _Reason, ctx: Ctx = Depends(care)):
    await ps.snag_reopen(ctx, await _own(ctx, S.ReSnag, snag_id, "snag"), body.reason)
    await ctx.db.commit()
    return {"message": "Snag reopened"}


@router.post("/snags/{snag_id}/waive")
async def snag_waive(snag_id: uuid.UUID, body: _Reason, ctx: Ctx = Depends(care)):
    await ps.snag_waive(ctx, await _own(ctx, S.ReSnag, snag_id, "snag"), body.reason)
    await ctx.db.commit()
    return {"message": "Snag accepted as is"}


# ═══ warranty ═══════════════════════════════════════════════════════════════════════════════

class ClaimIn(BaseModel):
    subject: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    priority: str = Field("medium", pattern="^(low|medium|high|urgent)$")


@router.post("/warranties/{w_id}/claim", status_code=201)
async def warranty_claim(w_id: uuid.UUID, body: ClaimIn, ctx: Ctx = Depends(care)):
    w = await _own(ctx, S.ReWarranty, w_id, "warranty")
    if not ps.warranty_active(w):
        raise HTTPException(status_code=409, detail=f"This warranty is not active (valid {w.starts_on} to {w.ends_on})")
    data: dict[str, Any] = {
        "customer_id": w.customer_id, "booking_id": w.booking_id, "warranty_id": w.id, "subject": body.subject,
        "description": body.description, "priority": body.priority, "channel": "phone",
        "category": "structural_defect" if w.coverage == "structural" else "defect"}
    await ps.create_ticket(ctx, data)
    t = S.ReTicket(id=uuid.uuid4(), vendor_id=ctx.vendor_id, ticket_no=await next_number(ctx.db, ctx.vendor_id, "ticket"), **data)
    ctx.db.add(t)
    await ctx.db.flush()
    await ps.ticket_after_create(ctx, t)
    await audit(ctx, "ticket", t.id, "create", ref=t.ticket_no, changes={"warranty": str(w.id)})
    await ctx.db.commit()
    return {"id": str(t.id), "ticket_no": t.ticket_no, "due_at": t.due_at.isoformat(),
            "message": f"Ticket {t.ticket_no} raised; resolution due {t.due_at:%d %b %Y}"}


@router.post("/warranties/{w_id}/void")
async def warranty_void(w_id: uuid.UUID, body: _Reason, ctx: Ctx = Depends(care)):
    w = await _own(ctx, S.ReWarranty, w_id, "warranty")
    if w.statutory:
        raise HTTPException(status_code=409, detail="A statutory (RERA) warranty cannot be voided")
    if w.status != "active":
        raise HTTPException(status_code=409, detail=f"Warranty is {w.status}")
    if not body.reason.strip():
        raise HTTPException(status_code=422, detail="Give a reason")
    w.status = "void"
    w.terms = f"{w.terms or ''} | Void: {body.reason.strip()}"[:500]
    await audit(ctx, "warranty", w.id, "void", changes={"reason": body.reason})
    await ctx.db.commit()
    return {"message": "Warranty voided"}


# ═══ tickets ════════════════════════════════════════════════════════════════════════════════

class AssigneeIn(BaseModel):
    assignee: str = ""


@router.post("/tickets/{t_id}/assign")
async def ticket_assign(t_id: uuid.UUID, body: AssigneeIn, ctx: Ctx = Depends(care)):
    t = await ps.ticket_assign(ctx, await _own(ctx, S.ReTicket, t_id, "ticket"), body.assignee)
    await ctx.db.commit()
    return {"message": f"{t.ticket_no} assigned to {t.assigned_to_name}"}


@router.post("/tickets/{t_id}/wait")
async def ticket_wait(t_id: uuid.UUID, ctx: Ctx = Depends(care)):
    t = await ps.ticket_wait(ctx, await _own(ctx, S.ReTicket, t_id, "ticket"))
    await ctx.db.commit()
    return {"message": f"{t.ticket_no} is waiting on the customer"}


@router.post("/tickets/{t_id}/resolve")
async def ticket_resolve(t_id: uuid.UUID, body: ResolutionIn, ctx: Ctx = Depends(care)):
    t = await ps.ticket_resolve(ctx, await _own(ctx, S.ReTicket, t_id, "ticket"), body.resolution)
    await ctx.db.commit()
    return {"message": f"{t.ticket_no} resolved" + (" (SLA breached)" if t.sla_breached else " within SLA")}


@router.post("/tickets/{t_id}/close")
async def ticket_close(t_id: uuid.UUID, ctx: Ctx = Depends(care)):
    t = await ps.ticket_close(ctx, await _own(ctx, S.ReTicket, t_id, "ticket"))
    await ctx.db.commit()
    return {"message": f"{t.ticket_no} closed"}


@router.post("/tickets/{t_id}/reopen")
async def ticket_reopen(t_id: uuid.UUID, body: _Reason, ctx: Ctx = Depends(care)):
    t = await ps.ticket_reopen(ctx, await _own(ctx, S.ReTicket, t_id, "ticket"), body.reason)
    await ctx.db.commit()
    return {"message": f"{t.ticket_no} reopened; the SLA clock restarts"}


# ═══ customer-portal links ══════════════════════════════════════════════════════════════════

class LinkIn(BaseModel):
    days: int = Field(portal_svc.DEFAULT_DAYS, ge=1, le=portal_svc.MAX_DAYS)


@router.post("/customers/{customer_id}/portal-link")
async def portal_link(customer_id: uuid.UUID, body: LinkIn, request: Request, ctx: Ctx = Depends(sales)):
    cust = await _own(ctx, C.ReCustomer, customer_id, "customer")
    link = await portal_svc.create_link(ctx, cust, body.days)
    await ctx.db.commit()
    origin = (request.headers.get("origin") or "").rstrip("/")
    url = f"{origin}{link['path']}"
    safe = _html.escape(url)
    return {
        "message": "Portal link created", "url": url, **link,
        "html": (f"<p>Share this private link with <b>{_html.escape(cust.full_name)}</b>. It works until "
                 f"{link['expires_at'][:10]} or until you revoke it, and shows only their own bookings.</p>"
                 f"<p style='word-break:break-all'><a href=\"{safe}\" target=\"_blank\">{safe}</a></p>"),
    }


@router.post("/customers/{customer_id}/portal-revoke")
async def portal_revoke(customer_id: uuid.UUID, ctx: Ctx = Depends(sales)):
    cust = await _own(ctx, C.ReCustomer, customer_id, "customer")
    n = await portal_svc.revoke_links(ctx, cust)
    await ctx.db.commit()
    return {"message": f"Portal access revoked ({n} active link(s))"}
