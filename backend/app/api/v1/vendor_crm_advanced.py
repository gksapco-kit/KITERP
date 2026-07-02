"""
Advanced CRM endpoints: reports, AI insights, chat (REST + WebSocket),
audit, public lead intake and business front chat widget.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from math import ceil
from typing import Optional
from uuid import UUID

from fastapi import (
    APIRouter, Body, Depends, HTTPException, Query, Request,
    WebSocket, WebSocketDisconnect, status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_permission
from app.core.security import decode_token
from app.database import get_db
from app.models.vendor import Vendor
from app.models.vendor_user import VendorUser
from app.schemas.crm.schemas import (
    AiInsightResponse, AuditLogResponse, ChatConversationResponse,
    ChatMessageResponse, IntakeTokenCreate, IntakeTokenResponse,
    JourneyEventBase, JourneyEventResponse,
    LeadResponse, PaginatedResponse, PublicLeadPayload, WidgetMessagePayload,
)
from app.services.crm.services import (
    AiService, AuditQueryService, ChatService, IntakeTokenService,
    JourneyService, LeadService, ReportService,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _paginated(items, total, page, size):
    return {
        "items": items, "total": total, "page": page, "size": size,
        "pages": ceil(total / size) if total else 0,
    }


# ── Reports ──────────────────────────────────────────────────────────────────

@router.get("/reports/overview")
async def report_overview(
    range: str = Query("30d", pattern="^(30d|3m|6m|1y|2y|5y|10y)$"),
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    return await ReportService(db).overview(vu.vendor_id, range_key=range)


@router.get("/reports/sales-performance")
async def report_sales(
    vu: VendorUser = Depends(require_permission("crm.reports.view")),
    db: AsyncSession = Depends(get_db),
):
    return await ReportService(db).sales_performance(vu.vendor_id)


@router.get("/reports/campaigns")
async def report_campaigns(
    vu: VendorUser = Depends(require_permission("crm.reports.view")),
    db: AsyncSession = Depends(get_db),
):
    return await ReportService(db).campaign_performance(vu.vendor_id)


@router.get("/reports/tickets")
async def report_tickets(
    vu: VendorUser = Depends(require_permission("crm.reports.view")),
    db: AsyncSession = Depends(get_db),
):
    return await ReportService(db).ticket_performance(vu.vendor_id)


@router.get("/reports/funnel")
async def report_funnel(
    events: str = Query("page_view,signup,trial,purchase"),
    vu: VendorUser = Depends(require_permission("crm.reports.view")),
    db: AsyncSession = Depends(get_db),
):
    types = [e.strip() for e in events.split(",") if e.strip()]
    return await JourneyService(db).funnel(vu.vendor_id, types)


# ── AI insights ──────────────────────────────────────────────────────────────

@router.get("/ai/insights/{entity_type}/{entity_id}", response_model=list[AiInsightResponse])
async def list_insights(
    entity_type: str, entity_id: UUID, kind: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("crm.ai.use")),
    db: AsyncSession = Depends(get_db),
):
    items = await AiService(db).latest(vu.vendor_id, entity_type, entity_id, kind)
    return [AiInsightResponse.model_validate(i) for i in items]


@router.post("/ai/summarise/{entity_type}/{entity_id}")
async def ai_summarise(
    entity_type: str, entity_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.ai.use")),
    db: AsyncSession = Depends(get_db),
):
    return await AiService(db).summarise_entity(vu.vendor_id, entity_type, entity_id)


@router.post("/ai/next-best-action/{contact_id}")
async def ai_next_best(
    contact_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.ai.use")),
    db: AsyncSession = Depends(get_db),
):
    return await AiService(db).next_best_action(vu.vendor_id, contact_id)


# ── Audit log ────────────────────────────────────────────────────────────────

@router.get("/audit", response_model=PaginatedResponse)
async def list_audit(
    page: int = Query(1, ge=1), size: int = Query(50, ge=1, le=200),
    entity: Optional[str] = None, actor_id: Optional[UUID] = None,
    entity_id: Optional[UUID] = None,
    vu: VendorUser = Depends(require_permission("crm.audit.view")),
    db: AsyncSession = Depends(get_db),
):
    items, total = await AuditQueryService(db).list(
        vu.vendor_id, page=page, size=size, entity=entity, actor_id=actor_id,
        entity_id=entity_id,
    )
    items = [AuditLogResponse.model_validate(a).model_dump() for a in items]
    return _paginated(items, total, page, size)


# ── Customer journey ─────────────────────────────────────────────────────────

@router.get("/journey/{contact_id}", response_model=PaginatedResponse)
async def list_journey(
    contact_id: UUID, page: int = Query(1, ge=1), size: int = Query(50, ge=1, le=200),
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    items, total = await JourneyService(db).for_contact(vu.vendor_id, contact_id,
                                                         page=page, size=size)
    items = [JourneyEventResponse.model_validate(e).model_dump() for e in items]
    return _paginated(items, total, page, size)


@router.post("/journey", response_model=JourneyEventResponse,
             status_code=status.HTTP_201_CREATED)
async def record_journey(
    payload: JourneyEventBase,
    vu: VendorUser = Depends(require_permission("crm.contacts.manage")),
    db: AsyncSession = Depends(get_db),
):
    obj = await JourneyService(db).record(vu.vendor_id, payload)
    return JourneyEventResponse.model_validate(obj)


# ── Chat (REST) ──────────────────────────────────────────────────────────────

@router.get("/chat/conversations", response_model=PaginatedResponse)
async def list_conversations(
    page: int = Query(1, ge=1), size: int = Query(50, ge=1, le=200),
    status_: Optional[str] = Query(None, alias="status"),
    vu: VendorUser = Depends(require_permission("crm.chat.handle")),
    db: AsyncSession = Depends(get_db),
):
    items, total = await ChatService(db).list_conversations(
        vu.vendor_id, status=status_, page=page, size=size,
    )
    items = [ChatConversationResponse.model_validate(c).model_dump() for c in items]
    return _paginated(items, total, page, size)


@router.get("/chat/conversations/{conv_id}")
async def get_conversation(
    conv_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.chat.handle")),
    db: AsyncSession = Depends(get_db),
):
    conv = await ChatService(db).get_conversation(vu.vendor_id, conv_id)
    return {
        "conversation": ChatConversationResponse.model_validate(conv).model_dump(),
        "messages": [ChatMessageResponse.model_validate(m).model_dump() for m in conv.messages],
    }


@router.post("/chat/conversations/{conv_id}/messages", response_model=ChatMessageResponse,
             status_code=status.HTTP_201_CREATED)
async def post_agent_message(
    conv_id: UUID, payload: dict = Body(...),
    vu: VendorUser = Depends(require_permission("crm.chat.handle")),
    db: AsyncSession = Depends(get_db),
):
    body = payload.get("body")
    if not body:
        raise HTTPException(status_code=400, detail="body required")
    msg = await ChatService(db).post_message(
        vu.vendor_id, conv_id, sender="agent", sender_id=vu.user_id, body=body,
        attachments=payload.get("attachments") or [],
        metadata=payload.get("metadata"),
    )
    await _broadcast_to_conv(conv_id, {
        "type": "message",
        "message": ChatMessageResponse.model_validate(msg).model_dump(mode="json"),
    })
    return ChatMessageResponse.model_validate(msg)


@router.post("/chat/conversations/{conv_id}/assign")
async def assign_conversation(
    conv_id: UUID, payload: dict = Body(...),
    vu: VendorUser = Depends(require_permission("crm.chat.handle")),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("user_id") or vu.user_id
    obj = await ChatService(db).assign(vu.vendor_id, conv_id, UUID(str(user_id)))
    return ChatConversationResponse.model_validate(obj)


@router.post("/chat/conversations/{conv_id}/close")
async def close_conversation(
    conv_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.chat.handle")),
    db: AsyncSession = Depends(get_db),
):
    obj = await ChatService(db).close(vu.vendor_id, conv_id)
    return ChatConversationResponse.model_validate(obj)


# ── Chat WebSocket (agents) ──────────────────────────────────────────────────

class _ChatHub:
    def __init__(self):
        self._rooms: dict[str, set[WebSocket]] = {}

    async def join(self, conv_id: UUID, ws: WebSocket):
        await ws.accept()
        self._rooms.setdefault(str(conv_id), set()).add(ws)

    def leave(self, conv_id: UUID, ws: WebSocket):
        room = self._rooms.get(str(conv_id))
        if room:
            room.discard(ws)
            if not room:
                self._rooms.pop(str(conv_id), None)

    async def broadcast(self, conv_id: UUID, payload: dict):
        room = self._rooms.get(str(conv_id))
        if not room:
            return
        msg = json.dumps(payload, default=str)
        dead = []
        for ws in room:
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.leave(conv_id, ws)


_hub = _ChatHub()


async def _broadcast_to_conv(conv_id: UUID, payload: dict):
    await _hub.broadcast(conv_id, payload)


@router.websocket("/chat/ws/{conv_id}")
async def chat_ws(websocket: WebSocket, conv_id: UUID,
                  token: Optional[str] = Query(None)):
    """Agent WebSocket. Auth via JWT in `?token=`."""
    if not token:
        await websocket.close(code=4401)
        return
    payload = decode_token(token)
    if not payload:
        await websocket.close(code=4401)
        return
    await _hub.join(conv_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                evt = json.loads(data)
            except json.JSONDecodeError:
                continue
            if evt.get("type") == "typing":
                await _hub.broadcast(conv_id, {
                    "type": "typing", "from": "agent", "user_id": payload.get("sub"),
                })
    except WebSocketDisconnect:
        _hub.leave(conv_id, websocket)


# ── Lead intake tokens (admin) ───────────────────────────────────────────────

@router.get("/intake-tokens", response_model=list[IntakeTokenResponse])
async def list_intake_tokens(
    vu: VendorUser = Depends(require_permission("crm.leads.manage")),
    db: AsyncSession = Depends(get_db),
):
    items = await IntakeTokenService(db).list(vu.vendor_id)
    return [IntakeTokenResponse.model_validate(t) for t in items]


@router.post("/intake-tokens", response_model=IntakeTokenResponse,
             status_code=status.HTTP_201_CREATED)
async def create_intake_token(
    data: IntakeTokenCreate,
    vu: VendorUser = Depends(require_permission("crm.leads.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await IntakeTokenService(db).create(vu.vendor_id, data)


@router.post("/intake-tokens/{token_id}/revoke")
async def revoke_intake_token(
    token_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.leads.manage")),
    db: AsyncSession = Depends(get_db),
):
    await IntakeTokenService(db).revoke(vu.vendor_id, token_id)
    return {"ok": True}


# ── Public lead intake (unauthenticated) ─────────────────────────────────────

public_router = APIRouter()


@public_router.post("/lead-intake/{token}", response_model=LeadResponse,
                    status_code=status.HTTP_201_CREATED)
async def public_lead_intake(
    token: str, payload: PublicLeadPayload, request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Capture a lead from a public form/landing page using an intake token."""
    from app.repositories.crm.repos import IntakeTokenRepo
    repo = IntakeTokenRepo(db)
    rec = await repo.by_token(token)
    if not rec:
        raise HTTPException(status_code=404, detail="Invalid or expired token")

    first_name = payload.first_name
    last_name = payload.last_name
    if not first_name and payload.full_name:
        parts = payload.full_name.strip().split(" ", 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else None

    lead_create_payload = type("L", (), {
        "model_dump": lambda self=None, **kwargs: {
            k: v for k, v in {
                "first_name": first_name, "last_name": last_name,
                "company": payload.company, "email": payload.email,
                "phone": payload.phone, "title": payload.title,
                "website": payload.website, "notes": payload.notes,
                "source": payload.source or rec.source_default,
                "source_campaign": payload.source_campaign,
                "intake_payload": (payload.extra or {}) | {
                    "ip": request.client.host if request.client else None,
                    "user_agent": request.headers.get("user-agent"),
                    "received_at": datetime.now(timezone.utc).isoformat(),
                },
            }.items() if v is not None
        },
    })()

    lead = await LeadService(db).create(rec.vendor_id, lead_create_payload, request=request)
    rec.last_used_at = datetime.now(timezone.utc)
    await db.commit()
    return LeadResponse.model_validate(lead)


# ── Public chat widget (business front / landing pages) ──────────────────────────

async def _live_chat_enabled(db: AsyncSession, vendor_id: UUID) -> bool:
    """Live chat is opt-out — enabled unless the vendor set live_chat_enabled to False."""
    settings = await db.scalar(select(Vendor.settings).where(Vendor.id == vendor_id))
    if isinstance(settings, dict):
        return settings.get("live_chat_enabled") is not False
    return True


@public_router.post("/chat/widget/{vendor_id}/messages")
async def widget_post_message(
    vendor_id: UUID, payload: WidgetMessagePayload,
    db: AsyncSession = Depends(get_db),
):
    """Visitor sends a message via the embeddable chat widget."""
    if not await _live_chat_enabled(db, vendor_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Live chat is turned off.")
    chat = ChatService(db)
    conv = await chat.get_or_create_for_visitor(
        vendor_id, payload.visitor_id,
        visitor_name=payload.visitor_name,
        visitor_email=payload.visitor_email,
    )
    msg = await chat.post_message(
        vendor_id, conv.id, sender="customer", body=payload.body,
        metadata=payload.metadata,
    )
    await _broadcast_to_conv(conv.id, {
        "type": "message",
        "message": ChatMessageResponse.model_validate(msg).model_dump(mode="json"),
    })

    bot_msg = None
    if conv.bot_handled:
        try:
            bot_msg = await chat.bot_reply(vendor_id, conv.id, payload.body)
            if bot_msg:
                await _broadcast_to_conv(conv.id, {
                    "type": "message",
                    "message": ChatMessageResponse.model_validate(bot_msg).model_dump(mode="json"),
                })
        except Exception as e:
            logger.warning("widget bot reply failed: %s", e)

    return {
        "conversation_id": str(conv.id),
        "message": ChatMessageResponse.model_validate(msg).model_dump(mode="json"),
        "bot_reply": ChatMessageResponse.model_validate(bot_msg).model_dump(mode="json") if bot_msg else None,
    }


@public_router.get("/chat/widget/{vendor_id}/conversations/{visitor_id}")
async def widget_history(
    vendor_id: UUID, visitor_id: str,
    db: AsyncSession = Depends(get_db),
):
    from app.repositories.crm.repos import ChatConversationRepo
    repo = ChatConversationRepo(db)
    conv = await repo.by_visitor(vendor_id, visitor_id)
    if not conv:
        return {"conversation": None, "messages": []}
    full = await repo.with_messages(vendor_id, conv.id)
    return {
        "conversation": ChatConversationResponse.model_validate(full).model_dump(),
        "messages": [ChatMessageResponse.model_validate(m).model_dump() for m in full.messages],
    }


@public_router.post("/journey/beacon/{vendor_id}")
async def public_journey_beacon(
    vendor_id: UUID, payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """Lightweight journey-event beacon for business fronts (page_view, etc.)."""
    from app.models.crm import CrmJourneyEvent
    event_type = payload.get("event_type") or "page_view"
    obj = CrmJourneyEvent(
        vendor_id=vendor_id,
        event_type=event_type,
        payload=payload.get("payload") or {},
        visitor_id=payload.get("visitor_id"),
        contact_id=UUID(payload["contact_id"]) if payload.get("contact_id") else None,
        customer_id=UUID(payload["customer_id"]) if payload.get("customer_id") else None,
    )
    db.add(obj)
    await db.commit()
    return {"ok": True}
