"""Advance enrolled contacts through campaign drip sequences."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.worker import CELERY_AVAILABLE, celery_app

logger = logging.getLogger(__name__)


async def _tick() -> dict:
    from app.models.crm import (
        CrmCampaign, CrmCampaignEnrollment, CrmCampaignStep, CrmEmailTemplate,
    )
    from app.tasks.crm.send_email import send_email_now
    from app.tasks.crm.send_sms import send_sms_now
    from app.tasks.crm.send_whatsapp import send_whatsapp_now

    now = datetime.now(timezone.utc)
    processed = 0

    async with AsyncSessionLocal() as db:
        rows = await db.execute(
            select(CrmCampaignEnrollment).where(
                CrmCampaignEnrollment.status == "active",
                CrmCampaignEnrollment.next_action_at <= now,
            ).limit(200)
        )
        enrollments = rows.scalars().all()

        for enr in enrollments:
            campaign_row = await db.execute(
                select(CrmCampaign).where(CrmCampaign.id == enr.campaign_id)
            )
            campaign = campaign_row.scalar_one_or_none()
            if not campaign or campaign.status not in ("active", "scheduled"):
                enr.status = "exited"
                enr.exit_reason = "campaign_inactive"
                continue

            steps_row = await db.execute(
                select(CrmCampaignStep)
                .where(CrmCampaignStep.campaign_id == campaign.id)
                .order_by(CrmCampaignStep.sort_order)
            )
            steps = steps_row.scalars().all()
            if not steps or enr.current_step >= len(steps):
                enr.status = "completed"
                enr.completed_at = now
                continue

            step = steps[enr.current_step]
            template = None
            if step.template_id:
                t_row = await db.execute(
                    select(CrmEmailTemplate).where(CrmEmailTemplate.id == step.template_id)
                )
                template = t_row.scalar_one_or_none()

            try:
                if step.channel == "email" and template:
                    send_email_now(
                        vendor_id=campaign.vendor_id,
                        contact_id=enr.contact_id,
                        subject=template.subject,
                        body_html=template.body_html,
                        body_text=template.body_text,
                        campaign_id=campaign.id,
                    )
                elif step.channel == "sms":
                    body = (template.body_text if template else None) or "Update from us"
                    send_sms_now(
                        vendor_id=campaign.vendor_id, contact_id=enr.contact_id, body=body,
                    )
                elif step.channel == "whatsapp":
                    from app.services.crm.template_render import build_whatsapp_payload

                    wa = build_whatsapp_payload(template) if template else {
                        "body": "Update from us", "footer": None,
                        "cta_label": None, "cta_url": None, "media_url": None,
                    }
                    send_whatsapp_now(
                        vendor_id=campaign.vendor_id,
                        contact_id=enr.contact_id,
                        body=str(wa["body"] or "Update from us"),
                        media_url=wa.get("media_url"),
                        footer=wa.get("footer"),
                        cta_label=wa.get("cta_label"),
                        cta_url=wa.get("cta_url"),
                        media_type=wa.get("media_type"),
                    )
            except Exception as e:
                logger.exception("drip step failed: %s", e)

            enr.last_action_at = now
            enr.current_step += 1
            if enr.current_step >= len(steps):
                enr.status = "completed"
                enr.completed_at = now
                enr.next_action_at = None
            else:
                next_step = steps[enr.current_step]
                enr.next_action_at = now + timedelta(minutes=next_step.delay_minutes or 0)

            processed += 1

        await db.commit()

    return {"processed": processed}


def tick_now() -> dict:
    return asyncio.run(_tick())


if CELERY_AVAILABLE and celery_app is not None:
    @celery_app.task(name="crm.drip.tick")
    def drip_tick_task() -> dict:
        return asyncio.run(_tick())
else:
    def drip_tick_task():  # type: ignore[no-redef]
        return tick_now()
