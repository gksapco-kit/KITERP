"""Public contact + address resolution for storefront and website builder live feeds."""
from __future__ import annotations

from typing import Any, Mapping, Optional

from app.utils.social_links_mode import resolve_public_social_links


def _str(v: Any) -> str:
    return v.strip() if isinstance(v, str) else ""


def _extra_strings(settings: Mapping[str, Any] | None, key: str) -> list[str]:
    if not settings:
        return []
    raw = settings.get(key)
    if not isinstance(raw, list):
        return []
    return [s.strip() for s in raw if isinstance(s, str) and s.strip()]


def resolve_public_support_email(vendor, store=None) -> Optional[str]:
    branch_email = _str(getattr(store, "email", None)) if store else ""
    if branch_email:
        return branch_email
    primary = _str(getattr(vendor, "support_email", None))
    return primary or _str(getattr(vendor, "primary_email", None)) or None


def resolve_public_support_phone(vendor, store=None) -> Optional[str]:
    branch_phone = _str(getattr(store, "phone", None)) if store else ""
    if branch_phone:
        return branch_phone
    primary = _str(getattr(vendor, "support_phone", None))
    return primary or _str(getattr(vendor, "primary_phone", None)) or None


def resolve_public_address_parts(vendor, store=None) -> dict[str, Optional[str]]:
    street = _str(getattr(vendor, "street_address", None)) or None
    city = _str(getattr(vendor, "city", None)) or None
    state = _str(getattr(vendor, "state", None)) or None
    postal = _str(getattr(vendor, "postal_code", None)) or None
    country = _str(getattr(vendor, "country", None)) or None

    if store and isinstance(getattr(store, "address", None), dict):
        addr = store.address or {}
        if any(_str(addr.get(k)) for k in ("street", "city", "state", "pincode")):
            street = _str(addr.get("street")) or street
            city = _str(addr.get("city")) or city
            state = _str(addr.get("state")) or state
            postal = _str(addr.get("pincode")) or postal

    return {
        "street_address": street,
        "city": city,
        "state": state,
        "postal_code": postal,
        "country": country,
    }


def format_public_address(parts: Mapping[str, Optional[str]]) -> str:
    return " ".join(
        filter(
            None,
            [
                parts.get("street_address"),
                parts.get("city"),
                parts.get("state"),
                parts.get("postal_code"),
                parts.get("country"),
            ],
        )
    )


def build_profile_live_meta(vendor, store=None) -> dict[str, Any]:
    """Profile meta for website builder / public site live `profile` resource."""
    support_email = resolve_public_support_email(vendor, store)
    support_phone = resolve_public_support_phone(vendor, store)
    addr_parts = resolve_public_address_parts(vendor, store)
    addr = format_public_address(addr_parts)

    vendor_settings = dict(getattr(vendor, "settings", None) or {})
    store_settings = dict(getattr(store, "settings", None) or {}) if store else {}

    branch_email = _str(getattr(store, "email", None)) if store else ""
    branch_phone = _str(getattr(store, "phone", None)) if store else ""
    branch_extra_emails = _extra_strings(store_settings, "support_emails")
    branch_extra_phones = _extra_strings(store_settings, "support_phones")

    use_branch_emails = bool(branch_email or branch_extra_emails)
    use_branch_phones = bool(branch_phone or branch_extra_phones)

    meta = {
        "business_name": vendor.business_name,
        "display_name": vendor.display_name,
        "description": vendor.description,
        "email": support_email,
        "support_email": support_email,
        "phone": support_phone,
        "support_phone": support_phone,
        "address": addr,
        "city": addr_parts.get("city"),
        "state": addr_parts.get("state"),
        "country": addr_parts.get("country"),
        "postal_code": addr_parts.get("postal_code"),
        "logo_url": vendor.logo_url,
        "banner_url": vendor.banner_url,
        "subdomain": vendor.subdomain,
        "custom_domain": vendor.custom_domain,
        "social_links": resolve_public_social_links(vendor, store),
        "business_hours": vendor.business_hours or {},
        "latitude": float(vendor.latitude) if vendor.latitude is not None else None,
        "longitude": float(vendor.longitude) if vendor.longitude is not None else None,
        "support_emails": branch_extra_emails
        if use_branch_emails
        else _extra_strings(vendor_settings, "support_emails"),
        "support_phones": branch_extra_phones
        if use_branch_phones
        else _extra_strings(vendor_settings, "support_phones"),
    }
    return meta


async def load_linked_store_for_site(db, vendor_id, style_config) -> Any | None:
    """Load the business unit linked to a store-scoped website, if any."""
    from uuid import UUID

    from sqlalchemy import select

    from app.models.store import Store

    sc = style_config or {}
    if str(sc.get("website_store_scope") or "").strip().lower() != "store":
        return None
    raw_id = str(sc.get("website_store_id") or "").strip()
    if not raw_id:
        return None
    try:
        store_id = UUID(raw_id)
    except ValueError:
        return None
    row = await db.execute(
        select(Store).where(Store.id == store_id, Store.vendor_id == vendor_id)
    )
    return row.scalar_one_or_none()
