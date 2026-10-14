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


def _is_placeholder_email(email: str) -> bool:
    from app.utils.validators import is_phone_signup_placeholder_email
    return is_phone_signup_placeholder_email(email)


def _format_public_phones(values: list[str]) -> list[str]:
    from app.services.sms_service import format_public_phone

    out: list[str] = []
    for value in values:
        formatted = format_public_phone(value)
        if formatted:
            out.append(formatted)
    return out


def _is_placeholder_contact(value: str) -> bool:
    """Dashes / n/a placeholders should not appear on the public contact panel."""
    if not value:
        return True
    if all(ch in "-–—._ \t" for ch in value):
        return True
    return value.lower() in {"n/a", "na", "none", "null", "undefined"}


def resolve_public_support_email(vendor, store=None) -> Optional[str]:
    """Business support email only (BU → vendor defaults). No account primary_email fallback."""
    branch_email = _str(getattr(store, "email", None)) if store else ""
    if branch_email and not _is_placeholder_email(branch_email) and not _is_placeholder_contact(branch_email):
        return branch_email
    primary = _str(getattr(vendor, "support_email", None))
    if primary and not _is_placeholder_email(primary) and not _is_placeholder_contact(primary):
        return primary
    return None


def _dedupe_lines(values: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for value in values:
        text = value.strip()
        if not text:
            continue
        key = "".join(text.lower().split())
        if key in seen:
            continue
        seen.add(key)
        out.append(text)
    return out


def _address_line(*parts: Any) -> str:
    cleaned = []
    for part in parts:
        text = _str(part)
        if text and not _is_placeholder_contact(text):
            cleaned.append(text)
    return ", ".join(cleaned)


def resolve_public_addresses(vendor, store=None) -> list[str]:
    """Branch location and registered HQ as separate lines. Identical lines collapse to one."""
    lines: list[str] = []
    if store and isinstance(getattr(store, "address", None), dict):
        addr = store.address or {}
        branch = _address_line(
            addr.get("street"),
            addr.get("city"),
            addr.get("state"),
            addr.get("pincode") or addr.get("postal_code"),
        )
        if branch:
            lines.append(branch)
    hq = _address_line(
        getattr(vendor, "street_address", None),
        getattr(vendor, "city", None),
        getattr(vendor, "state", None),
        getattr(vendor, "postal_code", None),
    )
    if hq:
        lines.append(hq)
    return _dedupe_lines(lines)


def resolve_public_support_phones(vendor, store=None) -> list[str]:
    """Every business support number (primary + extras). A unit list replaces the company list."""
    vendor_settings = dict(getattr(vendor, "settings", None) or {})
    store_settings = dict(getattr(store, "settings", None) or {}) if store else {}
    branch_phone = _str(getattr(store, "phone", None)) if store else ""
    branch_extra = _extra_strings(store_settings, "support_phones")
    vendor_phone = _str(getattr(vendor, "support_phone", None))
    vendor_extra = _extra_strings(vendor_settings, "support_phones")

    if branch_phone or branch_extra:
        raw = [branch_phone, *branch_extra]
    else:
        raw = [vendor_phone, *vendor_extra]

    usable = [value for value in raw if value and not _is_placeholder_contact(value)]
    return _dedupe_lines(_format_public_phones(usable))


def resolve_public_support_phone(vendor, store=None) -> Optional[str]:
    """First business support phone (BU → vendor defaults). No account primary_phone fallback."""
    phones = resolve_public_support_phones(vendor, store)
    return phones[0] if phones else None


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
    phones = resolve_public_support_phones(vendor, store)
    support_phone = phones[0] if phones else None
    addresses = resolve_public_addresses(vendor, store)
    addr_parts = resolve_public_address_parts(vendor, store)
    addr = addresses[0] if addresses else format_public_address(addr_parts)

    vendor_settings = dict(getattr(vendor, "settings", None) or {})
    store_settings = dict(getattr(store, "settings", None) or {}) if store else {}

    branch_email = _str(getattr(store, "email", None)) if store else ""
    branch_extra_emails = _extra_strings(store_settings, "support_emails")

    use_branch_emails = bool(branch_email or branch_extra_emails)

    meta = {
        "business_name": vendor.business_name,
        "display_name": vendor.display_name,
        "description": vendor.description,
        "email": support_email,
        "support_email": support_email,
        "phone": support_phone,
        "support_phone": support_phone,
        "phones": phones,
        "address": addr,
        "addresses": addresses,
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
        "support_phones": phones[1:],
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
