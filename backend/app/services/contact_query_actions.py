"""Shared actions for Storefront Contact Queries and Chat Conversations.

Covers:
  - Convert a contact query / chat conversation to a CRM lead (idempotent).
  - Send a reply to the submitter via Email, SMS, or WhatsApp, logging each
    send as a CrmCommunicationLog row.
  - Seed a default "Auto-acknowledge" CRM workflow for a vendor (called once on
    first query arrival so the auto-trigger toggle has something to bind to).
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.crm import CrmCommunicationLog, CrmContact, CrmEmailTemplate
from app.models.storefront_contact_query import StorefrontContactQuery
from app.schemas.crm.schemas import LeadCreate, TicketCreate
from app.services.crm.services import LeadService, TicketService

logger = logging.getLogger(__name__)

# ── helpers ──────────────────────────────────────────────────────────────────


def _split_name(full_name: str) -> tuple[str, Optional[str]]:
    parts = (full_name or "").strip().split(None, 1)
    return (parts[0] if parts else "Contact"), (parts[1] if len(parts) > 1 else None)


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ── Contact Query: convert to lead ───────────────────────────────────────────


async def convert_contact_query_to_lead(
    db: AsyncSession,
    query: StorefrontContactQuery,
    vendor_id: UUID,
    *,
    actor_id: Optional[UUID] = None,
    request: Optional[Request] = None,
    override_first_name: Optional[str] = None,
    override_last_name: Optional[str] = None,
    override_company: Optional[str] = None,
    override_assigned_to: Optional[UUID] = None,
    override_rating: Optional[str] = None,
    override_source: Optional[str] = None,
    override_notes: Optional[str] = None,
):
    """Create or return the CRM lead for a storefront contact query.

    Idempotent: if `query.converted_lead_id` is already set, loads and returns
    the existing lead without creating a duplicate.
    """
    from app.models.crm import CrmLead

    if query.converted_lead_id:
        existing = (
            await db.execute(
                select(CrmLead).where(
                    CrmLead.id == query.converted_lead_id,
                    CrmLead.vendor_id == vendor_id,
                )
            )
        ).scalar_one_or_none()
        if existing:
            return existing

    first, last = _split_name(query.name)
    data = LeadCreate(
        first_name=override_first_name or first,
        last_name=override_last_name or last,
        company=override_company or None,
        email=query.email,
        phone=query.phone,
        source=override_source or "storefront_contact",
        status="new",
        rating=override_rating,
        assigned_to=override_assigned_to,
        notes=override_notes if override_notes is not None else query.message,
        custom_fields={"contact_query_id": str(query.id)},
        intake_payload={
            "contact_query_id": str(query.id),
            "name": query.name,
            "email": query.email,
            "phone": query.phone,
            "message": query.message,
        },
    )
    lead = await LeadService(db).create(vendor_id, data, actor_id=actor_id, request=request)

    query.converted_lead_id = lead.id
    query.converted_at = _now()
    query.status = "resolved"
    await db.commit()
    await db.refresh(query)
    return lead


# ── Contact Query: reply ──────────────────────────────────────────────────────


async def reply_to_contact_query(
    db: AsyncSession,
    query: StorefrontContactQuery,
    vendor_id: UUID,
    *,
    channel: str,
    body: str,
    subject: Optional[str] = None,
    template_id: Optional[UUID] = None,
    mark_resolved: bool = False,
    actor_id: Optional[UUID] = None,
) -> dict:
    """Send an outbound reply (email / sms / whatsapp) for a contact query.

    When `template_id` is given the body is rendered through merge tags.
    Every send is logged as a CrmCommunicationLog row keyed by the query id
    so the full history is viewable from CRM.
    """
    rendered_body = body
    rendered_subject = subject or "Re: Your enquiry"
    rendered_html: Optional[str] = None

    if template_id:
        tpl = (
            await db.execute(select(CrmEmailTemplate).where(CrmEmailTemplate.id == template_id))
        ).scalar_one_or_none()
        if tpl:
            from app.services.crm.template_render import (
                render_merge_tags,
                resolve_email_body_html,
                resolve_plain_body,
            )

            first, last = _split_name(query.name)
            merge_kwargs = dict(
                first_name=first,
                last_name=last or "",
                email=query.email or "",
                company="",
                vendor_name="",
                user_name="",
            )
            rendered_body = render_merge_tags(resolve_plain_body(tpl) or body, **merge_kwargs)
            rendered_html = render_merge_tags(resolve_email_body_html(tpl) or "", **merge_kwargs)
            if tpl.subject:
                rendered_subject = render_merge_tags(tpl.subject, **merge_kwargs)

    result: dict = {"ok": False, "error": "no_adapter"}

    if channel == "email":
        if not query.email:
            raise HTTPException(400, "Contact query has no email address")
        from app.tasks.crm.send_email import send_email as _send_email

        result = await _send_email(
            vendor_id=vendor_id,
            contact_id=None,
            subject=rendered_subject,
            body_html=rendered_html or f"<p>{rendered_body}</p>",
            body_text=rendered_body,
            to_email=query.email,
        )

    elif channel in ("sms", "whatsapp"):
        if not query.phone:
            raise HTTPException(400, "Contact query has no phone number")
        if channel == "sms":
            from app.tasks.crm.send_sms import send_sms as _send_sms

            result = await _send_sms(
                vendor_id=vendor_id,
                contact_id=None,
                body=rendered_body,
                to_phone=query.phone,
            )
        else:
            from app.tasks.crm.send_whatsapp import send_whatsapp as _send_wa

            result = await _send_wa(
                vendor_id=vendor_id,
                contact_id=None,
                body=rendered_body,
                to_phone=query.phone,
            )
    else:
        raise HTTPException(400, f"Unsupported reply channel: {channel}")

    # Log regardless of success so the history is complete.
    log = CrmCommunicationLog(
        vendor_id=vendor_id,
        channel=channel,
        direction="outbound",
        related_type="contact_query",
        related_id=query.id,
        body=rendered_body,
        subject=rendered_subject if channel == "email" else None,
        status="sent" if result.get("ok") else "failed",
        provider=result.get("provider"),
        external_id=result.get("id") or result.get("sid"),
        recorded_by=actor_id,
    )
    db.add(log)

    now = _now()
    query.reply_count = (query.reply_count or 0) + 1
    query.last_reply_at = now
    if mark_resolved:
        query.status = "resolved"

    await db.commit()
    return result


# ── Contact Query: convert to ticket ─────────────────────────────────────────


async def _ensure_contact_for_query(
    db: AsyncSession,
    query: StorefrontContactQuery,
    vendor_id: UUID,
    *,
    actor_id: Optional[UUID] = None,
) -> Optional[CrmContact]:
    """Find or create a CRM contact for a storefront contact query.

    Matches on email first, then phone; creates a person contact if none found
    and the query has at least a name or email.
    """
    from app.repositories.crm.repos import ContactRepo

    repo = ContactRepo(db)
    email = (query.email or "").strip() or None
    phone = (query.phone or "").strip() or None

    existing: Optional[CrmContact] = None
    if email:
        existing = await repo.find_by_email(vendor_id, email)
    if not existing and phone:
        existing = await repo.find_by_phone(vendor_id, phone)
    if existing:
        return existing

    first, last = _split_name(query.name)
    if not first and not email and not phone:
        return None

    contact = CrmContact(
        vendor_id=vendor_id,
        record_type="person",
        first_name=first[:120],
        last_name=last[:120] if last else None,
        email=email,
        phone=phone,
        lifecycle_stage="lead",
    )
    db.add(contact)
    await db.flush()
    return contact


async def convert_contact_query_to_ticket(
    db: AsyncSession,
    query: StorefrontContactQuery,
    vendor_id: UUID,
    *,
    actor_id: Optional[UUID] = None,
    override_subject: Optional[str] = None,
    override_description: Optional[str] = None,
    override_priority: Optional[str] = None,
    override_assigned_to: Optional[UUID] = None,
    override_notes: Optional[str] = None,
):
    """Create or return the CRM ticket for a storefront contact query (idempotent).

    The customer's message becomes the ticket description. A CRM contact is
    looked-up or created so the ticket is properly linked.
    """
    from app.models.crm import CrmTicket
    from app.core.events import event_emitter

    if query.converted_ticket_id:
        existing = (
            await db.execute(
                select(CrmTicket).where(
                    CrmTicket.id == query.converted_ticket_id,
                    CrmTicket.vendor_id == vendor_id,
                )
            )
        ).scalar_one_or_none()
        if existing:
            return existing

    contact = await _ensure_contact_for_query(db, query, vendor_id, actor_id=actor_id)

    subject = (override_subject or f"Enquiry from {query.name}")[:255]
    description_parts = []
    if override_description is not None:
        description_parts.append(override_description)
    else:
        description_parts.append(query.message)
    if override_notes and override_notes.strip():
        description_parts.append(f"\n— Internal notes —\n{override_notes.strip()}")
    description = "\n".join(p for p in description_parts if p)

    data = TicketCreate(
        subject=subject,
        description=description or None,
        contact_id=contact.id if contact else None,
        assigned_to=override_assigned_to,
        priority=override_priority or "normal",
        status="open",
        source="web",
        custom_fields={
            "contact_query_id": str(query.id),
            "customer_name": query.name,
            "customer_email": query.email or "",
            "customer_phone": query.phone or "",
        },
    )
    ticket = await TicketService(db).create(vendor_id, data, actor_id=actor_id)

    query.converted_ticket_id = ticket.id
    query.ticket_converted_at = _now()
    query.status = "resolved"
    await db.commit()
    await db.refresh(query)

    # Emit rich event so the customer-notification workflow has merge fields.
    try:
        await event_emitter.emit("crm.contact_query.ticket_created", {
            "vendor_id": str(vendor_id),
            "ticket_id": str(ticket.id),
            "ticket_number": ticket.number,
            "query_id": str(query.id),
            "name": query.name,
            "email": query.email,
            "phone": query.phone,
            "subject": ticket.subject,
            "message": query.message,
        })
    except Exception:
        logger.exception("Failed to emit crm.contact_query.ticket_created event")

    return ticket


# ── Chat Conversation: convert to lead ───────────────────────────────────────


async def convert_chat_to_lead(
    db: AsyncSession,
    conv,  # CrmChatConversation
    vendor_id: UUID,
    *,
    actor_id: Optional[UUID] = None,
    request: Optional[Request] = None,
    override_assigned_to: Optional[UUID] = None,
    override_rating: Optional[str] = None,
    max_transcript_messages: int = 10,
):
    """Create or return the CRM lead for a chat conversation (idempotent)."""
    from app.models.crm import CrmChatMessage, CrmLead

    if conv.converted_lead_id:
        existing = (
            await db.execute(
                select(CrmLead).where(
                    CrmLead.id == conv.converted_lead_id,
                    CrmLead.vendor_id == vendor_id,
                )
            )
        ).scalar_one_or_none()
        if existing:
            return existing

    first, last = _split_name(conv.visitor_name or "Visitor")

    # Build a short transcript as lead notes.
    msgs = (
        await db.execute(
            select(CrmChatMessage)
            .where(CrmChatMessage.conversation_id == conv.id)
            .order_by(CrmChatMessage.created_at.desc())
            .limit(max_transcript_messages)
        )
    ).scalars().all()
    transcript_lines = [
        f"[{m.sender.upper()}] {(m.body or '').strip()}"
        for m in reversed(msgs)
        if m.body and m.body.strip()
    ]
    notes = "\n".join(transcript_lines) or None

    data = LeadCreate(
        first_name=first,
        last_name=last or None,
        email=conv.visitor_email or None,
        source="chat_widget",
        status="new",
        rating=override_rating,
        assigned_to=override_assigned_to,
        notes=notes,
        custom_fields={"chat_conversation_id": str(conv.id)},
        intake_payload={
            "chat_conversation_id": str(conv.id),
            "visitor_name": conv.visitor_name,
            "visitor_email": conv.visitor_email,
            "channel": conv.channel,
        },
    )
    lead = await LeadService(db).create(vendor_id, data, actor_id=actor_id, request=request)

    conv.converted_lead_id = lead.id
    conv.converted_at = _now()
    await db.commit()
    await db.refresh(conv)
    return lead


# ── Chat Conversation: convert to ticket ─────────────────────────────────────


async def convert_chat_to_ticket(
    db: AsyncSession,
    conv,  # CrmChatConversation
    vendor_id: UUID,
    *,
    actor_id: Optional[UUID] = None,
    override_assigned_to: Optional[UUID] = None,
    override_priority: Optional[str] = None,
    override_notes: Optional[str] = None,
    max_transcript_messages: int = 10,
):
    """Create or return the CRM ticket for a chat conversation (idempotent).

    Builds a transcript from the last messages and logs it as the ticket description.
    """
    from app.models.crm import CrmChatMessage, CrmTicket
    from app.core.events import event_emitter

    if conv.converted_ticket_id:
        existing = (
            await db.execute(
                select(CrmTicket).where(
                    CrmTicket.id == conv.converted_ticket_id,
                    CrmTicket.vendor_id == vendor_id,
                )
            )
        ).scalar_one_or_none()
        if existing:
            return existing

    first, last = _split_name(conv.visitor_name or "Visitor")

    msgs = (
        await db.execute(
            select(CrmChatMessage)
            .where(CrmChatMessage.conversation_id == conv.id)
            .order_by(CrmChatMessage.created_at.desc())
            .limit(max_transcript_messages)
        )
    ).scalars().all()
    transcript_lines = [
        f"[{m.sender.upper()}] {(m.body or '').strip()}"
        for m in reversed(msgs)
        if m.body and m.body.strip()
    ]
    transcript = "\n".join(transcript_lines) or None
    if override_notes and override_notes.strip():
        transcript = (transcript or "") + f"\n\n— Internal notes —\n{override_notes.strip()}"

    # Try to reuse existing contact linked to conversation
    contact_id = conv.contact_id if conv.contact_id else None

    subject = f"Chat enquiry from {first}"[:255]

    data = TicketCreate(
        subject=subject,
        description=transcript or None,
        contact_id=contact_id,
        assigned_to=override_assigned_to,
        priority=override_priority or "normal",
        status="open",
        source="chat_widget",
        custom_fields={
            "chat_conversation_id": str(conv.id),
            "visitor_name": conv.visitor_name,
            "visitor_email": conv.visitor_email or "",
        },
    )
    ticket = await TicketService(db).create(vendor_id, data, actor_id=actor_id)

    conv.converted_ticket_id = ticket.id
    conv.ticket_converted_at = _now()
    await db.commit()
    await db.refresh(conv)

    try:
        await event_emitter.emit("crm.contact_query.ticket_created", {
            "vendor_id": str(vendor_id),
            "ticket_id": str(ticket.id),
            "ticket_number": ticket.number,
            "chat_conversation_id": str(conv.id),
            "name": conv.visitor_name or first,
            "email": conv.visitor_email,
            "subject": ticket.subject,
        })
    except Exception:
        logger.exception("Failed to emit ticket_created event for chat")

    return ticket


# ── Workflow seed ─────────────────────────────────────────────────────────────


async def ensure_ticket_ack_workflow(db: AsyncSession, vendor_id: UUID) -> None:
    """Create a 'paused' auto-notify workflow for ticket creation (idempotent).

    Vendors activate it from the Queries page; when a query is moved as a ticket
    the workflow runs a send_email step to let the customer know their ticket number.
    """
    from app.models.crm import CrmWorkflow

    existing = (
        await db.execute(
            select(CrmWorkflow).where(
                CrmWorkflow.vendor_id == vendor_id,
                CrmWorkflow.trigger["event"].astext == "crm.contact_query.ticket_created",
            )
        )
    ).scalar_one_or_none()
    if existing:
        return

    workflow = CrmWorkflow(
        vendor_id=vendor_id,
        name="Notify Customer of Support Ticket",
        description=(
            "Sends an automatic email to the customer when their enquiry is logged as a "
            "support ticket. Activate the toggle on the Queries page to enable."
        ),
        trigger={"event": "crm.contact_query.ticket_created"},
        steps=[
            {
                "action": "send_email",
                "params": {
                    "to_email": "{{event.email}}",
                    "subject": "Your request has been logged ({{event.ticket_number}})",
                    "body_html": (
                        "<p>Hi {{event.name}},</p>"
                        "<p>Thank you for reaching out. Your request has been logged as "
                        "support ticket <strong>{{event.ticket_number}}</strong>.</p>"
                        "<p>Our team will review it and get back to you shortly.</p>"
                    ),
                },
            }
        ],
        status="paused",
    )
    db.add(workflow)
    await db.commit()


async def ensure_auto_ack_workflow(db: AsyncSession, vendor_id: UUID) -> None:
    """Create a 'paused' auto-acknowledge workflow for the vendor if none exists.

    Vendors activate it from the Queries page toggle; the workflow runs a
    send_email step using the first available email template, or a plain text
    acknowledgement when no template is configured.
    """
    from app.models.crm import CrmWorkflow

    existing = (
        await db.execute(
            select(CrmWorkflow).where(
                CrmWorkflow.vendor_id == vendor_id,
                CrmWorkflow.trigger["event"].astext == "crm.contact_query.created",
            )
        )
    ).scalar_one_or_none()
    if existing:
        return

    workflow = CrmWorkflow(
        vendor_id=vendor_id,
        name="Auto-acknowledge Contact Enquiry",
        description=(
            "Sends an automatic reply when a customer submits the Contact Us form. "
            "Activate the toggle on the Queries page to enable."
        ),
        trigger={"event": "crm.contact_query.created"},
        steps=[
            {
                "action": "send_email",
                "params": {
                    "to_email": "{{event.email}}",
                    "subject": "Thanks for reaching out",
                    "body_html": (
                        "<p>Hi {{event.name}},</p>"
                        "<p>Thank you for contacting us. We have received your message "
                        "and will get back to you shortly.</p>"
                    ),
                },
            }
        ],
        status="paused",
    )
    db.add(workflow)
    await db.commit()
