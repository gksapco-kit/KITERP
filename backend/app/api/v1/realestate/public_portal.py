"""Public (token-authenticated) customer portal API — mounted at ``/public/realestate``.

Every request is scoped to the single customer the signed, revocable link was issued for.
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.realestate import core as C
from app.models.realestate import postsales as S
from app.models.realestate import receivables as R
from app.services.realestate import portal as portal_svc
from app.services.realestate import postsales as ps
from app.services.realestate.common import Ctx, audit, next_number

from .ratelimit import portal_rate_limit

MAX_OPEN_TICKETS = 20

# Never let a portal response be cached, sniffed or leak its URL through the Referer header.
SECURITY_HEADERS = {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
}
# Vendor-authored demand-letter HTML: styles and images only, no scripts, forms, frames or network calls.
LETTER_CSP = ("default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; font-src https: data:; "
              "base-uri 'none'; form-action 'none'; frame-ancestors 'none'; sandbox")


async def _security_headers(response: Response) -> None:
    for k, v in SECURITY_HEADERS.items():
        response.headers[k] = v


public_router = APIRouter(dependencies=[Depends(portal_rate_limit), Depends(_security_headers)])


async def portal_ctx(
    x_portal_token: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> Ctx:
    """The link token is accepted only in the ``X-Portal-Token`` header, never in a URL (history / logs / Referer)."""
    ctx = await portal_svc.authenticate(db, x_portal_token)
    await db.flush()
    return ctx


@public_router.get("/portal/me", summary="Everything the customer can see: bookings, dues, handover, snags, warranties, tickets")
async def portal_me(ctx: Ctx = Depends(portal_ctx)):
    out = await portal_svc.portal_overview(ctx, ctx.customer)  # type: ignore[attr-defined]
    await ctx.db.commit()  # records link usage
    return out


class TicketIn(BaseModel):
    booking_id: Optional[uuid.UUID] = None
    category: str = Field("request", pattern="^(" + "|".join(S.TICKET_CATEGORIES) + ")$")
    subject: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = Field(None, max_length=4000)


@public_router.post("/portal/tickets", status_code=201)
async def portal_ticket(body: TicketIn, ctx: Ctx = Depends(portal_ctx)):
    cust: C.ReCustomer = ctx.customer  # type: ignore[attr-defined]
    open_n = (await ctx.db.execute(select(func.count()).select_from(S.ReTicket).where(
        S.ReTicket.customer_id == cust.id, S.ReTicket.status.notin_(("resolved", "closed"))))).scalar_one()
    if open_n >= MAX_OPEN_TICKETS:
        raise HTTPException(status_code=429, detail="You have many open requests; please wait for them to be resolved or call us.")
    await portal_svc.customer_booking(ctx, cust, body.booking_id)
    data = {"customer_id": cust.id, "booking_id": body.booking_id, "category": body.category, "subject": body.subject.strip(),
            "description": body.description, "priority": "medium", "channel": "portal"}
    await ps.create_ticket(ctx, data)
    t = S.ReTicket(id=uuid.uuid4(), vendor_id=ctx.vendor_id, ticket_no=await next_number(ctx.db, ctx.vendor_id, "ticket"), **data)
    ctx.db.add(t)
    await ctx.db.flush()
    await ps.ticket_after_create(ctx, t)
    await audit(ctx, "ticket", t.id, "create", ref=t.ticket_no, changes={"via": "portal"})
    await ctx.db.commit()
    return {"id": str(t.id), "ticket_no": t.ticket_no, "due_at": t.due_at.isoformat(),
            "message": f"Request {t.ticket_no} received. We aim to resolve it by {t.due_at:%d %b %Y}."}


class CommentIn(BaseModel):
    body: str = Field(..., min_length=1, max_length=4000)


@public_router.post("/portal/tickets/{ticket_id}/comments", status_code=201)
async def portal_comment(ticket_id: uuid.UUID, body: CommentIn, ctx: Ctx = Depends(portal_ctx)):
    cust: C.ReCustomer = ctx.customer  # type: ignore[attr-defined]
    t = (await ctx.db.execute(select(S.ReTicket).where(
        S.ReTicket.id == ticket_id, S.ReTicket.customer_id == cust.id, S.ReTicket.vendor_id == ctx.vendor_id))).scalar_one_or_none()
    if t is None:
        raise HTTPException(status_code=404, detail="ticket not found")
    if t.status == "closed":
        raise HTTPException(status_code=409, detail="This request is closed. Please raise a new one.")
    if t.status == "resolved":
        await ps.ticket_reopen(ctx, t, body.body)  # a reply to a resolved ticket reopens it (and records the reply)
    else:
        ctx.db.add(S.ReTicketComment(id=uuid.uuid4(), vendor_id=ctx.vendor_id, ticket_id=t.id, author_type="customer",
                                     author_name=cust.full_name, body=body.body.strip(), is_internal=False))
        if t.status == "waiting_customer":
            t.status = "in_progress"
    await ctx.db.commit()
    return {"message": "Your message was sent"}


class FeedbackIn(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    nps: Optional[int] = Field(None, ge=0, le=10)
    comments: Optional[str] = Field(None, max_length=2000)
    ticket_id: Optional[uuid.UUID] = None
    handover_id: Optional[uuid.UUID] = None


@public_router.post("/portal/feedback", status_code=201)
async def portal_feedback(body: FeedbackIn, ctx: Ctx = Depends(portal_ctx)):
    cust: C.ReCustomer = ctx.customer  # type: ignore[attr-defined]
    data = {"customer_id": cust.id, "rating": body.rating, "nps": body.nps, "comments": body.comments,
            "ticket_id": body.ticket_id, "handover_id": body.handover_id, "kind": "general"}
    if body.ticket_id:
        t = await ctx.db.get(S.ReTicket, body.ticket_id)
        if t is None or t.customer_id != cust.id:
            raise HTTPException(status_code=404, detail="ticket not found")
    if body.handover_id:
        h = await ctx.db.get(S.ReHandover, body.handover_id)
        if h is None or h.customer_id != cust.id:
            raise HTTPException(status_code=404, detail="handover not found")
    await ps.validate_feedback(ctx, data)
    fb = S.ReFeedback(id=uuid.uuid4(), vendor_id=ctx.vendor_id, submitted_via="portal", **data)
    ctx.db.add(fb)
    await ctx.db.commit()
    return {"message": "Thank you for your feedback"}


@public_router.get("/portal/demands/{demand_id}/letter", response_class=HTMLResponse)
async def portal_demand_letter(demand_id: uuid.UUID, ctx: Ctx = Depends(portal_ctx)):
    cust: C.ReCustomer = ctx.customer  # type: ignore[attr-defined]
    d = (await ctx.db.execute(select(R.ReDemand).where(
        R.ReDemand.id == demand_id, R.ReDemand.customer_id == cust.id, R.ReDemand.vendor_id == ctx.vendor_id))).scalar_one_or_none()
    if d is None or not d.letter_html:
        raise HTTPException(status_code=404, detail="demand letter not found")
    return HTMLResponse(d.letter_html, headers={**SECURITY_HEADERS, "Content-Security-Policy": LETTER_CSP})
