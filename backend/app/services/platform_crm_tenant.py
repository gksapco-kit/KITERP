"""
Platform (KIT ERP) internal tenant.

CRM / HR / Finance tables require a real vendor_id (NOT NULL + FK). We seed one internal
vendor row used only as the tenant for platform CRM, admin HR, and admin Finance data —
never as a storefront / marketplace business account.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.vendor import Vendor

# Stable UUID so all environments share the same platform CRM/HR/Finance tenant.
PLATFORM_CRM_VENDOR_ID = UUID("00000000-0000-4000-8000-0000000000c1")
PLATFORM_CRM_SLUG = "kiterp-platform"
PLATFORM_CRM_SUBDOMAIN = "kiterp-platform"


def _ensure_platform_finance_settings(vendor: Vendor) -> bool:
    """Keep platform tenant on advanced finance so admin Finance Management works."""
    settings = dict(vendor.settings or {})
    changed = False
    if settings.get("finance_mode") != "advanced":
        settings["finance_mode"] = "advanced"
        changed = True
    if settings.get("finance_enabled") is False:
        settings["finance_enabled"] = True
        changed = True
    if changed:
        vendor.settings = settings
        flag_modified(vendor, "settings")
    return changed


async def ensure_platform_crm_vendor(db: AsyncSession) -> Vendor:
    """Return the platform CRM/HR/Finance vendor, creating it if missing."""
    result = await db.execute(select(Vendor).where(Vendor.id == PLATFORM_CRM_VENDOR_ID))
    vendor = result.scalar_one_or_none()
    if vendor:
        if _ensure_platform_finance_settings(vendor):
            await db.commit()
            await db.refresh(vendor)
        return vendor

    by_slug = await db.execute(select(Vendor).where(Vendor.slug == PLATFORM_CRM_SLUG))
    existing = by_slug.scalar_one_or_none()
    if existing:
        if _ensure_platform_finance_settings(existing):
            await db.commit()
            await db.refresh(existing)
        return existing

    vendor = Vendor(
        id=PLATFORM_CRM_VENDOR_ID,
        business_name="KIT ERP Platform",
        display_name="KIT ERP",
        slug=PLATFORM_CRM_SLUG,
        business_type="platform",
        industry="Software",
        description="Internal tenant for KIT ERP platform CRM, HR, and Finance. Not a customer business.",
        offering_type="services",
        primary_email="crm@kiterp.com",
        primary_phone="+910000000000",
        subdomain=PLATFORM_CRM_SUBDOMAIN,
        status="suspended",
        verification_status="verified",
        settings={
            "timezone": "Asia/Kolkata",
            "currency": "INR",
            "language": "en",
            "is_platform_crm": True,
            "finance_mode": "advanced",
            "finance_enabled": True,
            "features": {
                "products": False,
                "services": False,
                "appointments": False,
                "blog": False,
            },
        },
    )
    db.add(vendor)
    await db.commit()
    await db.refresh(vendor)
    return vendor


async def get_platform_crm_vendor_id(db: AsyncSession) -> UUID:
    vendor = await ensure_platform_crm_vendor(db)
    return vendor.id


def is_platform_crm_vendor(vendor: Vendor | None) -> bool:
    if not vendor:
        return False
    if vendor.id == PLATFORM_CRM_VENDOR_ID:
        return True
    if vendor.slug == PLATFORM_CRM_SLUG:
        return True
    settings = vendor.settings or {}
    return bool(settings.get("is_platform_crm"))
