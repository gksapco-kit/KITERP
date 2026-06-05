"""Transactional emails for vendor onboarding lifecycle events."""
from __future__ import annotations

import html
import logging
from typing import Optional
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.user import User
from app.models.vendor import Vendor
from app.services.email_service import send_email

logger = logging.getLogger(__name__)


def _vendor_dashboard_url(slug: str) -> str:
    settings = get_settings()
    if settings.DEBUG:
        return f"http://127.0.0.1:3001/login?vendor={slug}"
    return f"https://{slug}.{settings.BASE_DOMAIN}/login"


def _storefront_url(slug: str) -> str:
    settings = get_settings()
    if settings.DEBUG:
        return f"http://127.0.0.1:3002/store/{slug}"
    return f"https://{slug}.{settings.BASE_DOMAIN}"


def _admin_vendor_url(vendor_id: UUID) -> str:
    if get_settings().DEBUG:
        return f"http://127.0.0.1:3000/dashboard/vendors/{vendor_id}"
    return f"https://admin.{get_settings().BASE_DOMAIN}/dashboard/vendors/{vendor_id}"


def _layout(title: str, body_html: str, *, cta_label: str | None = None, cta_href: str | None = None) -> str:
    cta = ""
    if cta_label and cta_href:
        cta = f"""
          <p style="margin:24px 0 0;">
            <a href="{html.escape(cta_href)}" style="display:inline-block; background:#13624A; color:#fff; text-decoration:none; padding:12px 20px; border-radius:8px; font-weight:600; font-size:14px;">{html.escape(cta_label)}</a>
          </p>"""
    return f"""\
<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f7f7fb; padding:24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #ececf5;">
      <tr>
        <td style="background:linear-gradient(135deg,#64C3A0 0%, #13624A 100%); padding:20px 24px; color:#fff;">
          <h2 style="margin:0; font-size:18px; font-weight:600;">KITERP</h2>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <h1 style="margin:0 0 16px; font-size:20px; color:#111827;">{html.escape(title)}</h1>
          {body_html}
          {cta}
        </td>
      </tr>
      <tr>
        <td style="padding:14px 24px; background:#fafafa; border-top:1px solid #ececf5;">
          <p style="margin:0; font-size:11px; color:#9ca3af;">© KITERP</p>
        </td>
      </tr>
    </table>
  </body>
</html>"""


async def _platform_notify_emails(db: AsyncSession) -> list[str]:
    result = await db.execute(
        select(User.email).where(
            User.is_active.is_(True),
            or_(User.is_superuser.is_(True), User.platform_staff_role.isnot(None)),
        )
    )
    emails = [e.strip() for e in result.scalars().all() if e and e.strip()]
    # Deduplicate while preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for e in emails:
        low = e.lower()
        if low not in seen:
            seen.add(low)
            unique.append(e)
    return unique


async def send_vendor_welcome_email(vendor: Vendor) -> bool:
    name = html.escape(vendor.display_name or vendor.business_name or "there")
    body = f"""
      <p style="margin:0 0 12px; font-size:14px; color:#4b5563;">Hi {name},</p>
      <p style="margin:0 0 12px; font-size:14px; color:#4b5563;">Welcome to KITERP! Your business account has been created.</p>
      <p style="margin:0; font-size:14px; color:#4b5563;">Complete your onboarding profile, upload documents, and submit for review when you're ready to go live.</p>
    """
    html_doc = _layout(
        "Welcome to KITERP",
        body,
        cta_label="Open vendor dashboard",
        cta_href=_vendor_dashboard_url(vendor.slug),
    )
    text = (
        f"Hi {vendor.display_name or vendor.business_name},\n\n"
        "Welcome to KITERP! Your business account has been created.\n"
        "Complete onboarding and submit for review when ready.\n\n"
        f"Dashboard: {_vendor_dashboard_url(vendor.slug)}"
    )
    return await send_email(vendor.primary_email, "Welcome to KITERP", html_doc, text)


async def send_vendor_submitted_vendor_email(vendor: Vendor) -> bool:
    name = html.escape(vendor.display_name or vendor.business_name or "there")
    body = f"""
      <p style="margin:0 0 12px; font-size:14px; color:#4b5563;">Hi {name},</p>
      <p style="margin:0 0 12px; font-size:14px; color:#4b5563;">We've received your business application and our team is reviewing it.</p>
      <p style="margin:0; font-size:14px; color:#4b5563;">You'll receive another email once a decision has been made — usually within 1–2 business days.</p>
    """
    html_doc = _layout("Application submitted", body)
    text = (
        f"Hi {vendor.display_name or vendor.business_name},\n\n"
        "We've received your business application and our team is reviewing it.\n"
        "You'll receive another email once a decision has been made."
    )
    return await send_email(vendor.primary_email, "Your KITERP application was submitted", html_doc, text)


async def send_vendor_submitted_admin_email(db: AsyncSession, vendor: Vendor) -> int:
    admins = await _platform_notify_emails(db)
    if not admins:
        logger.warning("No platform admin emails found for vendor.submitted_for_review notification")
        return 0

    biz = html.escape(vendor.business_name or vendor.display_name or "New vendor")
    slug = html.escape(vendor.slug)
    body = f"""
      <p style="margin:0 0 12px; font-size:14px; color:#4b5563;"><strong>{biz}</strong> ({slug}) has submitted their profile for review.</p>
      <p style="margin:0; font-size:14px; color:#4b5563;">Please review documents and approve or reject the application in the admin dashboard.</p>
    """
    html_doc = _layout(
        "New vendor pending review",
        body,
        cta_label="Review application",
        cta_href=_admin_vendor_url(vendor.id),
    )
    text = f"{vendor.business_name} ({vendor.slug}) submitted for review.\n{_admin_vendor_url(vendor.id)}"

    sent = 0
    for admin_email in admins:
        if await send_email(admin_email, f"[KITERP] Review pending: {vendor.business_name}", html_doc, text):
            sent += 1
    return sent


async def send_vendor_approved_email(vendor: Vendor) -> bool:
    name = html.escape(vendor.display_name or vendor.business_name or "there")
    store_url = _storefront_url(vendor.slug)
    body = f"""
      <p style="margin:0 0 12px; font-size:14px; color:#4b5563;">Hi {name},</p>
      <p style="margin:0 0 12px; font-size:14px; color:#4b5563;">Great news — your business has been <strong>approved</strong> on KITERP!</p>
      <p style="margin:0 0 12px; font-size:14px; color:#4b5563;">Your business front is now live. Sign in to add products, manage orders, and configure your store.</p>
      <p style="margin:0; font-size:14px; color:#4b5563;">Store link: <a href="{html.escape(store_url)}">{html.escape(store_url)}</a></p>
    """
    html_doc = _layout(
        "You're approved!",
        body,
        cta_label="Go to dashboard",
        cta_href=_vendor_dashboard_url(vendor.slug),
    )
    text = (
        f"Hi {vendor.display_name or vendor.business_name},\n\n"
        "Your business has been approved on KITERP!\n"
        f"Dashboard: {_vendor_dashboard_url(vendor.slug)}\n"
        f"Store: {store_url}"
    )
    return await send_email(vendor.primary_email, "Your KITERP business is approved", html_doc, text)


async def send_vendor_rejected_email(vendor: Vendor, reason: Optional[str] = None) -> bool:
    name = html.escape(vendor.display_name or vendor.business_name or "there")
    reason_html = ""
    reason_text = ""
    if reason:
        reason_html = f'<p style="margin:12px 0 0; font-size:14px; color:#4b5563;"><strong>Reason:</strong> {html.escape(reason)}</p>'
        reason_text = f"\nReason: {reason}\n"
    body = f"""
      <p style="margin:0 0 12px; font-size:14px; color:#4b5563;">Hi {name},</p>
      <p style="margin:0 0 12px; font-size:14px; color:#4b5563;">Unfortunately we couldn't approve your business application at this time.</p>
      {reason_html}
      <p style="margin:12px 0 0; font-size:14px; color:#4b5563;">You can update your documents and resubmit, or contact support if you have questions.</p>
    """
    html_doc = _layout(
        "Application update",
        body,
        cta_label="Open dashboard",
        cta_href=_vendor_dashboard_url(vendor.slug),
    )
    text = (
        f"Hi {vendor.display_name or vendor.business_name},\n\n"
        "We couldn't approve your business application at this time."
        f"{reason_text}\n"
        f"Dashboard: {_vendor_dashboard_url(vendor.slug)}"
    )
    return await send_email(vendor.primary_email, "Update on your KITERP application", html_doc, text)
