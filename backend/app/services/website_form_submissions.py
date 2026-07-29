"""Shared website contact-form handling for public storefront and vendor builder."""
from __future__ import annotations

from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.website import WebsiteBuilderPreview, WebsiteFormSubmission, WebsiteSite


def _try_uuid(value: Any) -> Optional[UUID]:
    if not value:
        return None
    try:
        return UUID(str(value))
    except Exception:
        return None


async def resolve_site_for_public_contact_form(
    db: AsyncSession,
    site_id: str,
    preview_token: Optional[str] = None,
) -> WebsiteSite:
    """Published sites are public; draft sites accept a valid builder preview token."""
    try:
        sid = UUID(site_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Site not found") from exc

    token = (preview_token or "").strip()
    if token:
        preview_row = await db.execute(
            select(WebsiteBuilderPreview).where(
                WebsiteBuilderPreview.preview_token == token,
                WebsiteBuilderPreview.site_id == sid,
            )
        )
        if preview_row.scalar_one_or_none() is not None:
            site_row = await db.execute(
                select(WebsiteSite).where(
                    WebsiteSite.id == sid,
                    WebsiteSite.deleted_at.is_(None),
                )
            )
            site = site_row.scalar_one_or_none()
            if site:
                return site

    site_row = await db.execute(
        select(WebsiteSite).where(
            WebsiteSite.id == sid,
            WebsiteSite.is_published == True,  # noqa: E712
            WebsiteSite.deleted_at.is_(None),
        )
    )
    site = site_row.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


async def submit_website_contact_form(
    db: AsyncSession,
    site: WebsiteSite,
    body: Dict[str, Any],
    *,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Persist inbox submission and create a CRM lead (best-effort).
    Returns ids for webhook dispatch by the caller.
    """
    page_id_raw = body.get("page_id") or body.get("_page_id")
    block_id_raw = body.get("block_id") or body.get("_block_id")
    form_type = (body.get("_form_type") or body.get("form_type") or "contact")[:50]
    gdpr_consent = bool(body.get("gdpr_consent") or body.get("consent") or False)
    payload_for_storage = {k: v for k, v in body.items() if not str(k).startswith("_")}

    submission = WebsiteFormSubmission(
        site_id=site.id,
        page_id=_try_uuid(page_id_raw),
        block_id=_try_uuid(block_id_raw),
        form_type=form_type,
        payload=payload_for_storage,
        gdpr_consent=gdpr_consent,
        ip_address=ip_address,
        user_agent=(user_agent or "")[:1000] or None,
    )
    db.add(submission)

    lead_id_str: Optional[str] = None
    try:
        from app.schemas.crm.schemas import LeadCreate
        from app.services.crm.services import LeadService

        raw_name = (body.get("name") or "Website Visitor").strip()
        first, _, last = raw_name.partition(" ")
        lead = await LeadService(db).create(
            site.vendor_id,
            LeadCreate(
                first_name=(first or "Website")[:120],
                last_name=(last or "Visitor")[:120],
                email=(body.get("email") or None),
                phone=(body.get("phone") or None),
                notes=(body.get("message") or None),
                source="website",
                source_campaign=f"website:{site.id}",
                status="new",
                intake_payload=payload_for_storage,
            ),
        )
        await db.refresh(submission)
        lead_id_str = str(lead.id)
        submission.crm_lead_id = lead.id
        await db.commit()
    except Exception:
        await db.rollback()
        try:
            db.add(submission)
            await db.commit()
            await db.refresh(submission)
        except Exception:
            await db.rollback()
            submission = None

    return {
        "ok": True,
        "submission_id": str(submission.id) if submission and submission.id else None,
        "lead_id": lead_id_str,
        "form_type": form_type,
        "page_id_raw": page_id_raw,
        "block_id_raw": block_id_raw,
        "payload_for_storage": payload_for_storage,
    }
