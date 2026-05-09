"""
CRM communications, tickets, KB and inbound webhook endpoints.
"""
from __future__ import annotations

from math import ceil
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_permission
from app.database import get_db
from app.models.vendor_user import VendorUser
from app.schemas.crm.schemas import (
    ClickToCallRequest, CommunicationCreate, CommunicationResponse,
    KbArticleCreate, KbArticleResponse, KbArticleUpdate,
    PaginatedResponse, SendEmailRequest, SendSmsRequest, SendWaRequest,
    SlaPolicyCreate, SlaPolicyResponse,
    TicketCommentCreate, TicketCommentResponse,
    TicketCreate, TicketResponse, TicketUpdate,
)
from app.services.crm.services import (
    CommunicationService, KbService, SlaPolicyService, TicketService,
)

router = APIRouter()


def _paginated(items, total, page, size):
    return {
        "items": items, "total": total, "page": page, "size": size,
        "pages": ceil(total / size) if total else 0,
    }


# ── Communications ──────────────────────────────────────────────────────────

@router.get("/communications", response_model=PaginatedResponse)
async def list_communications(
    page: int = Query(1, ge=1), size: int = Query(50, ge=1, le=200),
    related_type: Optional[str] = None, related_id: Optional[UUID] = None,
    contact_id: Optional[UUID] = None,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    svc = CommunicationService(db)
    if related_type and related_id:
        items, total = await svc.for_entity(vu.vendor_id, related_type, related_id,
                                            page=page, size=size)
    else:
        from app.models.crm import CrmCommunicationLog
        where = None
        if contact_id:
            where = CrmCommunicationLog.contact_id == contact_id
        items, total = await svc.repo.list(vu.vendor_id, page=page, size=size, where=where)
    items = [CommunicationResponse.model_validate(c).model_dump() for c in items]
    return _paginated(items, total, page, size)


@router.post("/communications", response_model=CommunicationResponse,
             status_code=status.HTTP_201_CREATED)
async def log_communication(
    data: CommunicationCreate,
    vu: VendorUser = Depends(require_permission("crm.contacts.manage")),
    db: AsyncSession = Depends(get_db),
):
    obj = await CommunicationService(db).log(vu.vendor_id, data, recorded_by=vu.user_id)
    return CommunicationResponse.model_validate(obj).model_dump()


@router.post("/communications/email")
async def send_email(
    payload: SendEmailRequest,
    vu: VendorUser = Depends(require_permission("crm.contacts.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await CommunicationService(db).send_email(vu.vendor_id, payload,
                                                      recorded_by=vu.user_id)


@router.post("/communications/sms")
async def send_sms(
    payload: SendSmsRequest,
    vu: VendorUser = Depends(require_permission("crm.contacts.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await CommunicationService(db).send_sms(vu.vendor_id, payload,
                                                    recorded_by=vu.user_id)


@router.post("/communications/whatsapp")
async def send_whatsapp(
    payload: SendWaRequest,
    vu: VendorUser = Depends(require_permission("crm.contacts.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await CommunicationService(db).send_whatsapp(vu.vendor_id, payload,
                                                         recorded_by=vu.user_id)


@router.post("/communications/call")
async def click_to_call(
    payload: ClickToCallRequest,
    vu: VendorUser = Depends(require_permission("crm.contacts.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await CommunicationService(db).click_to_call(vu.vendor_id, payload,
                                                         recorded_by=vu.user_id)


# ── Inbound webhooks (no auth — verified by provider signature/secret later) ─

@router.post("/webhooks/email/{provider}")
async def webhook_email(provider: str, request: Request,
                        db: AsyncSession = Depends(get_db)):
    """Receive bounce / open / click / reply events from the email provider."""
    payload = await request.json()
    from app.models.crm import CrmEmailEvent, CrmCommunicationLog
    from sqlalchemy import select
    from datetime import datetime, timezone

    events = payload if isinstance(payload, list) else [payload]
    inserted = 0
    for ev in events:
        message_id = ev.get("sg_message_id") or ev.get("messageId") or ev.get("id")
        if not message_id:
            continue
        log_row = await db.execute(
            select(CrmCommunicationLog).where(CrmCommunicationLog.external_id == message_id)
        )
        log = log_row.scalar_one_or_none()
        if not log:
            continue
        evt = CrmEmailEvent(
            vendor_id=log.vendor_id,
            communication_id=log.id,
            event=ev.get("event") or ev.get("type") or "unknown",
            email=ev.get("email"),
            url=ev.get("url"),
            payload=ev,
            occurred_at=datetime.now(timezone.utc),
        )
        db.add(evt)
        inserted += 1
        if evt.event in ("bounce", "dropped"):
            log.status = "bounced"
        elif evt.event == "open" and log.status not in ("clicked",):
            log.status = "opened"
        elif evt.event == "click":
            log.status = "clicked"
    await db.commit()
    return {"ok": True, "ingested": inserted, "provider": provider}


@router.post("/webhooks/twilio/sms")
async def webhook_twilio_sms(request: Request, db: AsyncSession = Depends(get_db)):
    form = await request.form()
    from app.models.crm import CrmCommunicationLog
    from sqlalchemy import select
    sid = form.get("MessageSid")
    status_ = form.get("MessageStatus")
    if sid and status_:
        row = await db.execute(
            select(CrmCommunicationLog).where(CrmCommunicationLog.external_id == sid)
        )
        log = row.scalar_one_or_none()
        if log:
            log.status = status_
            await db.commit()
    return {"ok": True}


@router.post("/webhooks/twilio/voice")
async def webhook_twilio_voice(request: Request, db: AsyncSession = Depends(get_db)):
    form = await request.form()
    from app.models.crm import CrmCallRecording, CrmCommunicationLog
    from sqlalchemy import select
    call_sid = form.get("CallSid")
    if not call_sid:
        return {"ok": True}
    row = await db.execute(
        select(CrmCommunicationLog).where(CrmCommunicationLog.external_id == call_sid)
    )
    log = row.scalar_one_or_none()
    if not log:
        return {"ok": True}
    rec_url = form.get("RecordingUrl")
    if rec_url:
        rec = CrmCallRecording(
            vendor_id=log.vendor_id,
            communication_id=log.id,
            recording_url=rec_url,
            duration_seconds=int(form.get("RecordingDuration") or 0) or None,
        )
        db.add(rec)
    log.status = form.get("CallStatus") or log.status
    await db.commit()
    return {"ok": True}


# ── SLA policies ─────────────────────────────────────────────────────────────

@router.get("/sla-policies", response_model=list[SlaPolicyResponse])
async def list_sla(
    vu: VendorUser = Depends(require_permission("crm.tickets.manage")),
    db: AsyncSession = Depends(get_db),
):
    items = await SlaPolicyService(db).list(vu.vendor_id)
    return [SlaPolicyResponse.model_validate(s) for s in items]


@router.post("/sla-policies", response_model=SlaPolicyResponse,
             status_code=status.HTTP_201_CREATED)
async def create_sla(
    data: SlaPolicyCreate,
    vu: VendorUser = Depends(require_permission("crm.tickets.manage")),
    db: AsyncSession = Depends(get_db),
):
    obj = await SlaPolicyService(db).create(vu.vendor_id, data)
    return SlaPolicyResponse.model_validate(obj)


@router.delete("/sla-policies/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sla(
    policy_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.tickets.manage")),
    db: AsyncSession = Depends(get_db),
):
    await SlaPolicyService(db).delete(vu.vendor_id, policy_id)
    return None


# ── Tickets ──────────────────────────────────────────────────────────────────

@router.get("/tickets", response_model=PaginatedResponse)
async def list_tickets(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    q: Optional[str] = None,
    status_: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = None, assigned_to: Optional[UUID] = None,
    contact_id: Optional[UUID] = None,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    items, total = await TicketService(db).list(
        vu.vendor_id, page=page, size=size, q=q, status=status_,
        priority=priority, assigned_to=assigned_to, contact_id=contact_id,
    )
    items = [TicketResponse.model_validate(t).model_dump() for t in items]
    return _paginated(items, total, page, size)


@router.post("/tickets", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    data: TicketCreate,
    vu: VendorUser = Depends(require_permission("crm.tickets.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await TicketService(db).create(vu.vendor_id, data, actor_id=vu.user_id)


@router.get("/tickets/{ticket_id}", response_model=TicketResponse)
async def get_ticket(
    ticket_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    return await TicketService(db).get(vu.vendor_id, ticket_id)


@router.put("/tickets/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: UUID, data: TicketUpdate,
    vu: VendorUser = Depends(require_permission("crm.tickets.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await TicketService(db).update(vu.vendor_id, ticket_id, data, actor_id=vu.user_id)


@router.get("/tickets/{ticket_id}/comments", response_model=list[TicketCommentResponse])
async def list_ticket_comments(
    ticket_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    items = await TicketService(db).list_comments(vu.vendor_id, ticket_id)
    return [TicketCommentResponse.model_validate(c) for c in items]


@router.post("/tickets/{ticket_id}/comments", response_model=TicketCommentResponse,
             status_code=status.HTTP_201_CREATED)
async def add_ticket_comment(
    ticket_id: UUID, data: TicketCommentCreate,
    vu: VendorUser = Depends(require_permission("crm.tickets.manage")),
    db: AsyncSession = Depends(get_db),
):
    obj = await TicketService(db).add_comment(vu.vendor_id, ticket_id, data,
                                               actor_id=vu.user_id)
    return TicketCommentResponse.model_validate(obj)


# ── Knowledge base ───────────────────────────────────────────────────────────

@router.get("/kb", response_model=PaginatedResponse)
async def list_kb(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    q: Optional[str] = None,
    status_: Optional[str] = Query(None, alias="status"),
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    items, total = await KbService(db).list(vu.vendor_id, page=page, size=size,
                                             q=q, status=status_)
    items = [KbArticleResponse.model_validate(a).model_dump() for a in items]
    return _paginated(items, total, page, size)


@router.post("/kb", response_model=KbArticleResponse, status_code=status.HTTP_201_CREATED)
async def create_kb(
    data: KbArticleCreate,
    vu: VendorUser = Depends(require_permission("crm.kb.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await KbService(db).create(vu.vendor_id, data, actor_id=vu.user_id)


@router.get("/kb/{article_id}", response_model=KbArticleResponse)
async def get_kb(
    article_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    return await KbService(db).get(vu.vendor_id, article_id)


@router.put("/kb/{article_id}", response_model=KbArticleResponse)
async def update_kb(
    article_id: UUID, data: KbArticleUpdate,
    vu: VendorUser = Depends(require_permission("crm.kb.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await KbService(db).update(vu.vendor_id, article_id, data, actor_id=vu.user_id)


@router.delete("/kb/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kb(
    article_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.kb.manage")),
    db: AsyncSession = Depends(get_db),
):
    await KbService(db).delete(vu.vendor_id, article_id)
    return None
