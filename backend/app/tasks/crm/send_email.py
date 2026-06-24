"""
Send a single email via the configured email provider for a vendor.
Records a CrmCommunicationLog row regardless of success/failure.
"""
from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from app.database import AsyncSessionLocal
from app.worker import CELERY_AVAILABLE, celery_app

logger = logging.getLogger(__name__)


async def send_email(vendor_id: UUID, contact_id: UUID | None, subject: str, body_html: str,
                     body_text: str | None = None, campaign_id: UUID | None = None,
                     to_email: str | None = None) -> dict:
    from app.integrations.registry import IntegrationRegistry
    from app.models.crm import CrmCommunicationLog, CrmContact, CrmEmailEvent
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        contact_email = to_email
        if contact_email is None and contact_id is not None:
            row = await db.execute(select(CrmContact).where(CrmContact.id == contact_id))
            contact = row.scalar_one_or_none()
            if contact:
                contact_email = contact.email

        registry = IntegrationRegistry(db)
        adapter = await registry.get_email_adapter(vendor_id)
        result = {"ok": False, "error": "no_adapter"}
        if not contact_email:
            result = {"ok": False, "error": "no_recipient"}
        elif adapter:
            result = await adapter.send(
                to=contact_email, subject=subject,
                html=body_html, text=body_text,
            )
            if not result.get("ok"):
                from app.services.email_service import send_email as platform_send_email

                sent = await platform_send_email(
                    to=contact_email, subject=subject, html=body_html, text=body_text,
                )
                if sent:
                    result = {"ok": True, "provider": "platform", "fallback": True}
        else:
            from app.services.email_service import send_email as platform_send_email

            sent = await platform_send_email(
                to=contact_email, subject=subject, html=body_html, text=body_text,
            )
            if sent:
                result = {"ok": True, "provider": "platform"}
            else:
                result = {
                    "ok": False,
                    "error": "no_adapter",
                    "detail": (
                        "Email is not configured. Connect SendGrid or SMTP under CRM → Integrations, "
                        "or set SENDGRID_API_KEY / SMTP_HOST in backend .env."
                    ),
                }

        log = CrmCommunicationLog(
            vendor_id=vendor_id,
            channel="email",
            direction="outbound",
            subject=subject,
            body=body_text or body_html,
            related_type="contact" if contact_id else None,
            related_id=contact_id,
            contact_id=contact_id,
            external_id=result.get("id"),
            provider=result.get("provider", "email"),
            status="sent" if result.get("ok") else "failed",
            metadata_json={"error": result.get("error")} if not result.get("ok") else {},
        )
        db.add(log)

        if campaign_id is not None:
            db.add(CrmEmailEvent(
                vendor_id=vendor_id, campaign_id=campaign_id,
                contact_id=contact_id, event="send" if result.get("ok") else "bounce",
            ))
        await db.commit()
        return result


def send_email_now(vendor_id: UUID, contact_id: UUID | None, subject: str,
                   body_html: str, body_text: str | None = None,
                   campaign_id: UUID | None = None, to_email: str | None = None) -> dict:
    """Sync entry point for inline calls."""
    return asyncio.run(
        send_email(vendor_id, contact_id, subject, body_html, body_text, campaign_id, to_email),
    )


if CELERY_AVAILABLE and celery_app is not None:
    @celery_app.task(name="crm.email.send")
    def send_email_task(vendor_id: str, contact_id: str | None, subject: str,
                        body_html: str, body_text: str | None = None,
                        campaign_id: str | None = None,
                        to_email: str | None = None) -> dict:
        return asyncio.run(send_email(
            UUID(vendor_id),
            UUID(contact_id) if contact_id else None,
            subject, body_html, body_text,
            UUID(campaign_id) if campaign_id else None,
            to_email,
        ))

    @celery_app.task(name="crm.dispatch.inline")
    def dispatch_inline(name: str) -> dict:
        return {"name": name, "ok": True}
else:
    def send_email_task(*args, **kwargs):  # type: ignore[no-redef]
        return send_email_now(*args, **kwargs)

    def dispatch_inline(*args, **kwargs):  # type: ignore[no-redef]
        return {"ok": True}
