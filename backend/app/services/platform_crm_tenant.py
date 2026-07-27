"""
Platform (Kiterp) internal tenant.

CRM / HR tables require a real vendor_id (NOT NULL + FK). We seed one internal
vendor row used only as the tenant for platform CRM and admin HR data — never as a
storefront / marketplace business account.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vendor import Vendor

# Stable UUID so all environments share the same platform CRM/HR tenant.
PLATFORM_CRM_VENDOR_ID = UUID("00000000-0000-4000-8000-0000000000c1")
PLATFORM_CRM_SLUG = "kiterp-platform"
PLATFORM_CRM_SUBDOMAIN = "kiterp-platform"


async def ensure_platform_crm_vendor(db: AsyncSession) -> Vendor:
    """Return the platform CRM/HR vendor, creating it if missing."""
    result = await db.execute(select(Vendor).where(Vendor.id == PLATFORM_CRM_VENDOR_ID))
    vendor = result.scalar_one_or_none()
    if vendor:
        return vendor

    by_slug = await db.execute(select(Vendor).where(Vendor.slug == PLATFORM_CRM_SLUG))
    existing = by_slug.scalar_one_or_none()
    if existing:
        return existing

    vendor = Vendor(
        id=PLATFORM_CRM_VENDOR_ID,
        business_name="Kiterp Platform",
        display_name="Kiterp",
        slug=PLATFORM_CRM_SLUG,
        business_type="platform",
        industry="Software",
        description="Internal tenant for Kiterp platform CRM and HR. Not a customer business.",
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
