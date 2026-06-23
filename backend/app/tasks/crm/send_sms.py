"""Send SMS via configured Twilio integration."""
from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from app.database import AsyncSessionLocal
from app.worker import CELERY_AVAILABLE, celery_app

logger = logging.getLogger(__name__)


async def send_sms(vendor_id: UUID, contact_id: UUID | None, body: str,
                   to_phone: str | None = None) -> dict:
    from app.integrations.registry import IntegrationRegistry
    from app.models.crm import CrmCommunicationLog, CrmContact
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        target = to_phone
        if target is None and contact_id is not None:
            row = await db.execute(select(CrmContact).where(CrmContact.id == contact_id))
            contact = row.scalar_one_or_none()
            if contact:
                target = contact.mobile or contact.phone

        registry = IntegrationRegistry(db)
        adapter = await registry.get_sms_adapter(vendor_id)
        result = {"ok": False, "error": "no_adapter"}
        if adapter and target:
            result = await adapter.send(to=target, body=body)

        log = CrmCommunicationLog(
            vendor_id=vendor_id,
            channel="sms",
            direction="outbound",
            body=body,
            related_type="contact" if contact_id else None,
            related_id=contact_id,
            contact_id=contact_id,
            external_id=result.get("id"),
            provider=result.get("provider", "sms"),
            status="sent" if result.get("ok") else "failed",
            metadata_json={"error": result.get("error")} if not result.get("ok") else {},
        )
        db.add(log)
        await db.commit()
        return result


def send_sms_now(vendor_id: UUID, contact_id: UUID | None, body: str,
                 to_phone: str | None = None) -> dict:
    return asyncio.run(send_sms(vendor_id, contact_id, body, to_phone))


if CELERY_AVAILABLE and celery_app is not None:
    @celery_app.task(name="crm.sms.send")
    def send_sms_task(vendor_id: str, contact_id: str | None, body: str, to_phone: str | None = None) -> dict:
        return asyncio.run(send_sms(
            UUID(vendor_id),
            UUID(contact_id) if contact_id else None,
            body, to_phone,
        ))
else:
    def send_sms_task(*args, **kwargs):  # type: ignore[no-redef]
        return send_sms_now(*args, **kwargs)
