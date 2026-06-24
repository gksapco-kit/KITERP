"""Send campaign messages when a campaign is started (broadcast / one-shot)."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select

from app.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def _contact_merge_kwargs(db, contact, vendor_id: UUID) -> dict:
    from app.models.crm import CrmAccount
    from app.models.user import User
    from app.models.vendor import Vendor

    vendor_name = "Your Business"
    user_name = "Team"
    v_row = await db.execute(select(Vendor).where(Vendor.id == vendor_id))
    vendor = v_row.scalar_one_or_none()
    if vendor:
        vendor_name = vendor.display_name or vendor.business_name or vendor_name

    company = ""
    if contact.account_id:
        a_row = await db.execute(select(CrmAccount).where(CrmAccount.id == contact.account_id))
        account = a_row.scalar_one_or_none()
        if account and account.name:
            company = account.name

    return {
        "first_name": contact.first_name or "Customer",
        "last_name": contact.last_name or "",
        "email": contact.email or "",
        "company": company,
        "vendor_name": vendor_name,
        "user_name": user_name,
    }


async def dispatch_broadcast_campaign(campaign_id: UUID, vendor_id: UUID) -> dict:
    """Send template to all active enrollments for a one-shot / broadcast campaign."""
    from app.models.crm import (
        CrmCampaign, CrmCampaignEnrollment, CrmContact, CrmEmailTemplate,
    )
    from app.services.crm.template_render import (
        build_whatsapp_payload,
        render_merge_tags,
        resolve_email_body_html,
        resolve_plain_body,
    )
    from app.services.sms_service import SMS_TRIAL_SAFE_LEN, truncate_sms_body
    from app.tasks.crm.send_email import send_email
    from app.tasks.crm.send_sms import send_sms
    from app.tasks.crm.send_whatsapp import send_whatsapp

    sent = 0
    failed = 0

    async with AsyncSessionLocal() as db:
        row = await db.execute(
            select(CrmCampaign).where(
                CrmCampaign.id == campaign_id,
                CrmCampaign.vendor_id == vendor_id,
            )
        )
        campaign = row.scalar_one_or_none()
        if not campaign:
            return {"ok": False, "error": "campaign_not_found", "sent": 0, "failed": 0}

        if not campaign.template_id:
            return {"ok": False, "error": "no_template", "sent": 0, "failed": 0}

        t_row = await db.execute(
            select(CrmEmailTemplate).where(CrmEmailTemplate.id == campaign.template_id)
        )
        template = t_row.scalar_one_or_none()
        if not template:
            return {"ok": False, "error": "template_not_found", "sent": 0, "failed": 0}

        enr_rows = await db.execute(
            select(CrmCampaignEnrollment).where(
                CrmCampaignEnrollment.campaign_id == campaign.id,
                CrmCampaignEnrollment.status == "active",
            )
        )
        enrollments = list(enr_rows.scalars().all())
        if not enrollments:
            return {"ok": True, "sent": 0, "failed": 0, "message": "No contacts enrolled."}

        channel = (campaign.channel or template.channel or "email").lower()
        now = datetime.now(timezone.utc)

        for enr in enrollments:
            c_row = await db.execute(
                select(CrmContact).where(CrmContact.id == enr.contact_id)
            )
            contact = c_row.scalar_one_or_none()
            if not contact:
                enr.status = "exited"
                enr.exit_reason = "contact_missing"
                failed += 1
                continue

            merge = await _contact_merge_kwargs(db, contact, vendor_id)

            try:
                if channel == "email":
                    subject = render_merge_tags(
                        template.subject or template.name or campaign.name, **merge,
                    )
                    body_html = render_merge_tags(resolve_email_body_html(template), **merge)
                    body_text = render_merge_tags(template.body_text or "", **merge) or None
                    if not (body_html or "").strip():
                        body_html = "<p>Message from your campaign.</p>"
                    result = await send_email(
                        vendor_id=vendor_id,
                        contact_id=contact.id,
                        subject=subject,
                        body_html=body_html,
                        body_text=body_text,
                        campaign_id=campaign.id,
                    )
                elif channel == "sms":
                    body = truncate_sms_body(
                        render_merge_tags(
                            resolve_plain_body(template) or campaign.name, **merge,
                        ),
                        SMS_TRIAL_SAFE_LEN,
                    )
                    result = await send_sms(
                        vendor_id=vendor_id, contact_id=contact.id, body=body,
                    )
                elif channel == "whatsapp":
                    wa = build_whatsapp_payload(template, **merge)
                    result = await send_whatsapp(
                        vendor_id=vendor_id,
                        contact_id=contact.id,
                        body=str(wa["body"] or ""),
                        media_url=wa.get("media_url"),
                        footer=wa.get("footer"),
                        cta_label=wa.get("cta_label"),
                        cta_url=wa.get("cta_url"),
                        media_type=wa.get("media_type"),
                    )
                else:
                    result = {"ok": False, "error": f"unsupported_channel:{channel}"}

                if result.get("ok"):
                    sent += 1
                    enr.status = "completed"
                    enr.completed_at = now
                    enr.last_action_at = now
                    enr.next_action_at = None
                else:
                    failed += 1
                    logger.warning(
                        "Campaign %s send failed for contact %s: %s",
                        campaign_id, contact.id, result.get("error"),
                    )
            except Exception:
                logger.exception("Campaign send failed for contact %s", contact.id)
                failed += 1

        campaign.sent_count = (campaign.sent_count or 0) + sent
        if failed == 0 and sent > 0:
            campaign.status = "completed"
            campaign.completed_at = now
        await db.commit()

    return {"ok": True, "sent": sent, "failed": failed}


async def dispatch_campaign(campaign_id: UUID, vendor_id: UUID) -> dict:
    from app.models.crm import CrmCampaign
    from app.tasks.crm.drip_step import _tick

    async with AsyncSessionLocal() as db:
        row = await db.execute(
            select(CrmCampaign).where(
                CrmCampaign.id == campaign_id,
                CrmCampaign.vendor_id == vendor_id,
            )
        )
        campaign = row.scalar_one_or_none()
        if not campaign:
            return {"ok": False, "error": "campaign_not_found", "sent": 0, "failed": 0}

    ctype = (campaign.type or "broadcast").lower()
    if ctype == "drip":
        result = await _tick()
        return {
            "ok": True,
            "sent": result.get("processed", 0),
            "failed": 0,
            "mode": "drip",
        }
    return await dispatch_broadcast_campaign(campaign_id, vendor_id)


def dispatch_campaign_now(campaign_id: UUID, vendor_id: UUID) -> dict:
    return asyncio.run(dispatch_campaign(campaign_id, vendor_id))
