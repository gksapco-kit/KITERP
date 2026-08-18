from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, status, Query, Request, UploadFile
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from uuid import UUID
from datetime import datetime, timezone
from xml.sax.saxutils import escape
import logging
import math
import re

from app.database import get_db
from app.middleware.tenant import get_current_vendor_id as get_tenant_vendor_id
from app.schemas.vendor import VendorResponse
from app.schemas.vendor_product import ProductResponse, ProductListResponse
from app.schemas.vendor_service import ServiceResponse, ServiceListResponse
from app.schemas.storefront_contact_query import StorefrontContactQueryCreate
from app.schemas.storefront_lead import PlatformLeadCreate, PlatformLeadLookup
from app.models.storefront_contact_query import StorefrontContactQuery
from app.models.platform_career_application import PlatformCareerApplication
from app.services.vendor_service import VendorService
from app.services.file_service import FileService
from app.repositories.vendor_repo import VendorRepository
from app.repositories.product_repo import ProductRepository
from app.repositories.service_repo import ServiceRepository
from app.api.v1.vendor_products import _product_to_dict, _effective_stock_status
from app.api.v1.vendor_services import _service_to_dict
from app.repositories.review_repo import ReviewRepository
from app.utils.geo import haversine_km
from app.utils.vendor_storefront import vendor_live_on_storefront
from app.services.storefront_theme_config import normalize_theme_config, theme_config_needs_migration
from app.utils.social_link_normalize import normalize_social_links
from app.utils.view_dedupe import claim_unique_view, visitor_key_from_request

logger = logging.getLogger(__name__)

_CAREER_CV_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
_CAREER_CV_EXTENSIONS = {".pdf", ".doc", ".docx"}
_MAX_CAREER_CV_BYTES = 10 * 1024 * 1024
_CAREER_PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp"}
_CAREER_PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
_MAX_CAREER_PHOTO_BYTES = 5 * 1024 * 1024
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

router = APIRouter()

_VISIT_COUNT_KEY = "storefront_visit_count"
_PLACEHOLDER_LOCATION = re.compile(r"^(?:[-–—._\s]+|n/?a|null|undefined|none|unknown|0+)$", re.I)


class TrackViewBody(BaseModel):
    visitor_id: Optional[str] = Field(None, max_length=120)


def _vendor_visit_count(vendor) -> int:
    settings = vendor.settings if isinstance(vendor.settings, dict) else {}
    try:
        return max(0, int(settings.get(_VISIT_COUNT_KEY) or 0))
    except (TypeError, ValueError):
        return 0


def _clean_location_part(value) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    if not text or _PLACEHOLDER_LOCATION.match(text):
        return None
    return text


def _store_address_fields(store) -> Optional[dict]:
    """Map Store.address JSON → partner directory address fields."""
    raw = store.address if isinstance(getattr(store, "address", None), dict) else {}
    street = _clean_location_part(raw.get("street"))
    city = _clean_location_part(raw.get("city"))
    state = _clean_location_part(raw.get("state"))
    postal = _clean_location_part(raw.get("pincode") or raw.get("postal_code"))
    country = _clean_location_part(raw.get("country"))
    if not any((street, city, state, postal)):
        return None

    lat = raw.get("latitude")
    lon = raw.get("longitude")
    try:
        latitude = float(lat) if lat is not None and lat != "" else None
    except (TypeError, ValueError):
        latitude = None
    try:
        longitude = float(lon) if lon is not None and lon != "" else None
    except (TypeError, ValueError):
        longitude = None

    return {
        "street_address": street,
        "city": city,
        "state": state,
        "postal_code": postal,
        "country": country,
        "latitude": latitude,
        "longitude": longitude,
        "store_name": getattr(store, "name", None),
    }


def _vendor_profile_address_fields(vendor) -> dict:
    street = _clean_location_part(vendor.street_address)
    city = _clean_location_part(vendor.city)
    state = _clean_location_part(vendor.state)
    postal = _clean_location_part(vendor.postal_code)
    country = _clean_location_part(vendor.country)
    return {
        "street_address": street,
        "city": city,
        "state": state,
        "postal_code": postal,
        "country": country,
        "latitude": float(vendor.latitude) if vendor.latitude is not None else None,
        "longitude": float(vendor.longitude) if vendor.longitude is not None else None,
    }


def _has_usable_address(fields: dict) -> bool:
    return any(
        fields.get(k)
        for k in ("street_address", "city", "state", "postal_code")
    )


def _store_logo_url(store) -> Optional[str]:
    """BU / store logo from settings.logo_url (per-unit branding)."""
    if store is None:
        return None
    settings = store.settings if isinstance(getattr(store, "settings", None), dict) else {}
    raw = settings.get("logo_url")
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return None


def _store_display_name(store) -> Optional[str]:
    if store is None:
        return None
    name = getattr(store, "name", None)
    if isinstance(name, str) and name.strip():
        return name.strip()
    return None


def _store_phone(store) -> Optional[str]:
    if store is None:
        return None
    phone = getattr(store, "phone", None)
    if isinstance(phone, str) and phone.strip():
        return phone.strip()
    settings = store.settings if isinstance(getattr(store, "settings", None), dict) else {}
    for key in ("whatsapp", "whatsapp_number", "phone"):
        raw = settings.get(key)
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
    return None


def _partner_whatsapp(vendor, store=None) -> str:
    """WhatsApp from social links, else BU phone, else vendor phone."""
    links = normalize_social_links(vendor.social_links or {})
    from_social = (links.get("whatsapp") or "").strip()
    if from_social:
        return from_social

    # Build wa.me from a phone number when social WhatsApp is not configured
    candidates = [
        _store_phone(store),
        getattr(vendor, "support_phone", None),
        getattr(vendor, "primary_phone", None),
    ]
    for raw in candidates:
        if not isinstance(raw, str) or not raw.strip():
            continue
        digits = re.sub(r"\D", "", raw.strip())
        if len(digits) >= 8:
            return f"https://wa.me/{digits}"
    return ""


def _partner_directory_item(vendor, store=None) -> dict:
    """Public partner-card payload for the Our Partners directory.

    Prefer the default business-unit / store address and logo when present;
    otherwise use the vendor profile (ignoring placeholder address values).
    """
    links = normalize_social_links(vendor.social_links or {})
    profile = _vendor_profile_address_fields(vendor)
    store_name = _store_display_name(store)
    address = profile

    store_fields = _store_address_fields(store) if store is not None else None
    if store_fields:
        # Address helper may also carry store_name; keep the resolved display name
        store_fields.pop("store_name", None)
        if store_fields.get("latitude") is None:
            store_fields["latitude"] = profile.get("latitude")
        if store_fields.get("longitude") is None:
            store_fields["longitude"] = profile.get("longitude")
        address = store_fields
    elif not _has_usable_address(profile):
        address = {
            "street_address": None,
            "city": None,
            "state": None,
            "postal_code": None,
            "country": None,
            "latitude": profile.get("latitude"),
            "longitude": profile.get("longitude"),
        }

    logo_url = _store_logo_url(store) or (vendor.logo_url or None)

    return {
        "slug": vendor.slug,
        "display_name": vendor.display_name or vendor.business_name,
        "business_name": vendor.business_name,
        "logo_url": logo_url,
        "street_address": address.get("street_address"),
        "city": address.get("city"),
        "state": address.get("state"),
        "postal_code": address.get("postal_code"),
        "country": address.get("country"),
        "latitude": address.get("latitude"),
        "longitude": address.get("longitude"),
        "store_name": store_name,
        "social_links": {
            "whatsapp": _partner_whatsapp(vendor, store),
            "website": links.get("website") or "",
        },
        "business_hours": vendor.business_hours or {},
        "visit_count": _vendor_visit_count(vendor),
    }


async def _default_stores_by_vendor(db: AsyncSession, vendor_ids: list) -> dict:
    """Pick one active store per vendor: default first, else first with an address."""
    if not vendor_ids:
        return {}
    from sqlalchemy import select
    from app.models.store import Store

    result = await db.execute(
        select(Store)
        .where(Store.vendor_id.in_(vendor_ids), Store.is_active == True)
        .order_by(Store.is_default.desc(), Store.name.asc())
    )
    stores = list(result.scalars().all())
    chosen: dict = {}
    for store in stores:
        vid = store.vendor_id
        if vid not in chosen:
            chosen[vid] = store
            continue
        # Prefer a store that actually has address details over an empty default
        if not _store_address_fields(chosen[vid]) and _store_address_fields(store):
            chosen[vid] = store
    return chosen


async def get_vendor_id_from_tenant(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> UUID:
    """
    Get vendor ID from tenant context, X-Vendor-Slug, or X-Vendor-Id.

    Slug must win over Id: path-based live tabs send both headers, and a stale
    X-Vendor-Id from another tab's localStorage must not override /{slug}.
    (Same order as get_store_vendor_id in app.api.deps.)
    """
    # 1. Tenant middleware (subdomain / custom domain)
    vendor_id = get_tenant_vendor_id(request)
    if vendor_id:
        return UUID(vendor_id)

    # 2. X-Vendor-Slug before Id (multi-tab same-origin isolation)
    vendor_slug = request.headers.get("x-vendor-slug")
    if vendor_slug:
        repo = VendorRepository(db)
        vendor = await repo.find_by_slug(vendor_slug.strip())
        if vendor and vendor_live_on_storefront(vendor.status):
            return vendor.id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vendor '{vendor_slug}' not found or not available on the business front.",
        )

    # 3. X-Vendor-Id (mobile / callers that only have UUID)
    header_id = request.headers.get("x-vendor-id")
    if header_id:
        return UUID(header_id)

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Vendor not found. Use subdomain, X-Vendor-Id, or X-Vendor-Slug header.",
    )


@router.get("/nearby-vendors")
async def nearby_vendors(
    user_lat: float = Query(..., ge=-90, le=90, description="User latitude"),
    user_lon: float = Query(..., ge=-180, le=180, description="User longitude"),
    radius_km: Optional[float] = Query(None, ge=1, le=500, description="Override radius (uses vendor's own if omitted)"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    offering_type: Optional[str] = Query(None, description="products, services, or both"),
    db: AsyncSession = Depends(get_db),
):
    """
    Find vendors whose service area covers the user's location.

    Each vendor has a configurable ``service_radius_km``.
    Pass ``radius_km`` to override and search within a fixed radius instead.
    """
    repo = VendorRepository(db)
    skip = (page - 1) * size

    rows, total = await repo.find_nearby(
        user_lat=user_lat,
        user_lon=user_lon,
        radius_km=radius_km,
        skip=skip,
        limit=size,
        search=search,
        offering_type=offering_type,
    )

    items = []
    for row in rows:
        v = row["vendor"]
        items.append({
            "id": str(v.id),
            "business_name": v.business_name,
            "display_name": v.display_name,
            "slug": v.slug,
            "subdomain": v.subdomain,
            "offering_type": v.offering_type or "both",
            "industry": v.industry,
            "description": v.description,
            "logo_url": v.logo_url,
            "city": v.city,
            "state": v.state,
            "latitude": float(v.latitude) if v.latitude else None,
            "longitude": float(v.longitude) if v.longitude else None,
            "service_radius_km": v.service_radius_km,
            "distance_km": row["distance_km"],
            "status": v.status,
        })

    return JSONResponse(content={
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total > 0 else 0,
        "user_location": {"latitude": user_lat, "longitude": user_lon},
    })


@router.get("/vendors")
async def list_storefront_vendors(
    q: Optional[str] = Query(None, max_length=120, description="Filter by slug or business name"),
    limit: int = Query(60, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Public directory of vendors opted into Community / Our Partners
    (``show_in_community``) that can be opened on the path-based business front
    (``/{slug}``). Used by the marketing landing page and Our Partners page.
    """
    repo = VendorRepository(db)
    items, total = await repo.list_storefront_directory(search=q, skip=0, limit=limit)
    stores_by_vendor = await _default_stores_by_vendor(db, [v.id for v in items])
    return JSONResponse(content={
        "items": [
            _partner_directory_item(v, stores_by_vendor.get(v.id))
            for v in items
        ],
        "total": total,
    })


def _sitemap_url(loc: str, changefreq: str, priority: str, lastmod: Optional[str] = None) -> str:
    lastmod_xml = f"    <lastmod>{escape(lastmod)}</lastmod>\n" if lastmod else ""
    return (
        "  <url>\n"
        f"    <loc>{escape(loc)}</loc>\n"
        f"{lastmod_xml}"
        f"    <changefreq>{changefreq}</changefreq>\n"
        f"    <priority>{priority}</priority>\n"
        "  </url>"
    )


@router.get("/sitemap.xml")
async def get_platform_sitemap(db: AsyncSession = Depends(get_db)):
    """Public sitemap of marketing pages, partner profiles, and store homes."""
    base = "https://kiterp.com"
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    urls = [
        _sitemap_url(f"{base}/", "daily", "1.0", today),
        _sitemap_url(f"{base}/partners", "daily", "0.9", today),
        _sitemap_url(f"{base}/careers", "weekly", "0.8", today),
        _sitemap_url(f"{base}/contact", "monthly", "0.7", today),
        _sitemap_url(f"{base}/create-business", "monthly", "0.8", today),
    ]

    repo = VendorRepository(db)
    skip = 0
    page_size = 100
    while skip < 2000:
        items, total = await repo.list_storefront_directory(skip=skip, limit=page_size)
        for vendor in items:
            slug = (vendor.slug or "").strip()
            if not slug:
                continue
            urls.append(_sitemap_url(f"{base}/partners/{slug}", "weekly", "0.7", today))
            urls.append(_sitemap_url(f"{base}/{slug}", "daily", "0.8", today))
        skip += page_size
        if skip >= total or not items:
            break

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )
    return Response(content=xml, media_type="application/xml")


@router.post("/vendor/{vendor_slug}/visit")
async def record_vendor_visit(
    vendor_slug: str,
    request: Request,
    body: TrackViewBody = Body(default_factory=TrackViewBody),
    db: AsyncSession = Depends(get_db),
):
    """Count a unique partner-profile visit (once per visitor per 24h)."""
    from sqlalchemy.orm.attributes import flag_modified

    repo = VendorRepository(db)
    vendor = await repo.find_by_slug(vendor_slug)
    if not vendor or not vendor_live_on_storefront(vendor.status):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")

    current = _vendor_visit_count(vendor)
    visitor_key = visitor_key_from_request(body.visitor_id, request)
    counted = await claim_unique_view("partner", str(vendor.id), visitor_key)
    if not counted:
        return {"slug": vendor.slug, "visit_count": current, "counted": False}

    settings = dict(vendor.settings) if isinstance(vendor.settings, dict) else {}
    next_count = current + 1
    settings[_VISIT_COUNT_KEY] = next_count
    vendor.settings = settings
    flag_modified(vendor, "settings")
    await db.commit()
    return {"slug": vendor.slug, "visit_count": next_count, "counted": True}


@router.get("/vendor/{vendor_slug}/distance")
async def get_vendor_distance(
    vendor_slug: str,
    user_lat: float = Query(..., ge=-90, le=90),
    user_lon: float = Query(..., ge=-180, le=180),
    db: AsyncSession = Depends(get_db),
):
    """
    Check if a specific vendor's service area covers the user's location.
    Returns distance and whether the user is within the vendor's radius.
    """
    repo = VendorRepository(db)
    vendor = await repo.find_by_slug(vendor_slug)

    if not vendor or not vendor_live_on_storefront(vendor.status):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")

    if not vendor.latitude or not vendor.longitude:
        return JSONResponse(content={
            "vendor_slug": vendor_slug,
            "distance_km": None,
            "within_radius": True,
            "service_radius_km": vendor.service_radius_km,
            "message": "Vendor has not set a location",
        })

    distance = haversine_km(
        float(vendor.latitude), float(vendor.longitude),
        user_lat, user_lon,
    )
    within = distance <= vendor.service_radius_km

    return JSONResponse(content={
        "vendor_slug": vendor_slug,
        "distance_km": round(distance, 2),
        "within_radius": within,
        "service_radius_km": vendor.service_radius_km,
        "vendor_location": {
            "latitude": float(vendor.latitude),
            "longitude": float(vendor.longitude),
        },
    })


@router.get("/vendor/{vendor_slug}")
async def get_vendor_by_slug(
    vendor_slug: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint: Look up a vendor by slug.
    Used by the business front SaaS app to resolve vendor from URL path.
    """
    repo = VendorRepository(db)
    vendor = await repo.find_by_slug(vendor_slug)

    if not vendor or not vendor_live_on_storefront(vendor.status):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )

    raw_theme = vendor.theme_config or {}
    if theme_config_needs_migration(raw_theme):
        normalized_theme = normalize_theme_config(raw_theme)
        vendor.theme_config = normalized_theme
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(vendor, "theme_config")
        await db.commit()
        await db.refresh(vendor)
        theme_payload = normalized_theme
    else:
        theme_payload = normalize_theme_config(raw_theme)

    stores_by_vendor = await _default_stores_by_vendor(db, [vendor.id])
    partner_addr = _partner_directory_item(vendor, stores_by_vendor.get(vendor.id))

    return {
        "id": str(vendor.id),
        "business_name": vendor.business_name,
        "display_name": vendor.display_name,
        "slug": vendor.slug,
        "offering_type": vendor.offering_type or "both",
        "description": vendor.description,
        "logo_url": partner_addr.get("logo_url") or vendor.logo_url,
        "banner_url": vendor.banner_url,
        "theme_config": theme_payload,
        "primary_email": vendor.primary_email,
        "primary_phone": vendor.primary_phone,
        "support_email": vendor.support_email,
        "support_phone": vendor.support_phone,
        "settings": vendor.settings or {},
        "street_address": partner_addr.get("street_address"),
        "city": partner_addr.get("city"),
        "state": partner_addr.get("state"),
        "postal_code": partner_addr.get("postal_code"),
        "country": partner_addr.get("country") or vendor.country,
        "latitude": partner_addr.get("latitude"),
        "longitude": partner_addr.get("longitude"),
        "store_name": partner_addr.get("store_name"),
        "service_radius_km": vendor.service_radius_km,
        "social_links": {
            **normalize_social_links(vendor.social_links or {}),
            **(partner_addr.get("social_links") or {}),
        },
        "business_hours": vendor.business_hours or {},
        "visit_count": _vendor_visit_count(vendor),
        "gstin": vendor.gstin,
        "is_gst_registered": vendor.is_gst_registered,
        "default_tax_rate": float(vendor.default_tax_rate) if vendor.default_tax_rate else None,
    }


@router.get("/platform-contact")
async def get_platform_contact(db: AsyncSession = Depends(get_db)):
    """Public contact details saved in Super Admin → Settings → Contact Information."""
    from sqlalchemy import select
    from app.models.platform_setting import PlatformSetting

    result = await db.execute(select(PlatformSetting))
    settings = {row.key: (row.value or "") for row in result.scalars().all()}
    email = (settings.get("contact_email") or "").strip()
    phone = (settings.get("contact_phone") or "").strip()
    street = (settings.get("contact_street_address") or "").strip()
    city = (settings.get("contact_city") or "").strip()
    state = (settings.get("contact_state") or "").strip()
    postal = (settings.get("contact_postal_code") or "").strip()
    address_parts = [p for p in (street, city, state, postal) if p]
    return {
        "email": email or None,
        "phone": phone or None,
        "street_address": street or None,
        "city": city or None,
        "state": state or None,
        "postal_code": postal or None,
        "address": ", ".join(address_parts) if address_parts else None,
    }


@router.post("/platform-contact-queries", status_code=status.HTTP_201_CREATED)
async def submit_platform_contact_query(
    request: Request,
    body: StorefrontContactQueryCreate,
    db: AsyncSession = Depends(get_db),
):
    """Landing-page Contact form → admin Queries inbox + platform CRM lead."""
    fwd = request.headers.get("x-forwarded-for") or ""
    ip = (fwd.split(",")[0].strip() if fwd else None) or (request.client.host if request.client else None)
    ua = (request.headers.get("user-agent") or "")[:1000] or None

    row = StorefrontContactQuery(
        vendor_id=None,
        name=body.name,
        email=str(body.email) if body.email else None,
        phone=body.phone,
        message=body.message,
        status="new",
        ip_address=ip,
        user_agent=ua,
    )
    db.add(row)
    await db.flush()

    # Best-effort: also create a lead in platform CRM for the sales pipeline.
    try:
        from app.schemas.crm.schemas import LeadCreate
        from app.services.crm.services import LeadService
        from app.services.platform_crm_tenant import get_platform_crm_vendor_id

        parts = (body.name or "").strip().split(None, 1)
        first = parts[0] if parts else "Contact"
        last = parts[1] if len(parts) > 1 else None
        vid = await get_platform_crm_vendor_id(db)
        await LeadService(db).create(
            vid,
            LeadCreate(
                first_name=first,
                last_name=last,
                email=str(body.email) if body.email else None,
                phone=body.phone,
                source="platform_contact",
                status="new",
                notes=body.message,
                custom_fields={"contact_query_id": str(row.id)},
                intake_payload={
                    "contact_query_id": str(row.id),
                    "name": body.name,
                    "email": str(body.email) if body.email else None,
                    "phone": body.phone,
                    "message": body.message,
                },
            ),
            request=request,
        )
    except Exception:
        # Inbox row is already persisted; CRM lead is secondary.
        import logging
        logging.getLogger(__name__).exception(
            "Failed to create platform CRM lead from contact query %s", row.id,
        )

    await db.commit()
    await db.refresh(row)
    return {
        "ok": True,
        "id": str(row.id),
        "message": "Thanks — we received your message and will get back to you soon.",
    }


def _same_lead_name(a: Optional[str], b: Optional[str]) -> bool:
    return (a or "").strip().lower() == (b or "").strip().lower()


def _lead_phone_digits(value: Optional[str]) -> str:
    digits = re.sub(r"\D", "", value or "")
    return digits[-10:] if len(digits) > 10 else digits


def _lead_full_name(*parts: Optional[str]) -> str:
    return " ".join(p.strip().lower() for p in parts if (p or "").strip())


_LEAD_DUPLICATE_MESSAGE = (
    "We may already have your details. Submit again if this is a new enquiry."
)


async def _platform_lead_is_duplicate(
    db: AsyncSession,
    vendor_id,
    *,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
) -> bool:
    """True when any existing platform lead matches email, phone, or first+last name."""
    from app.repositories.crm.repos import LeadRepo

    first = (first_name or "").strip()
    last = (last_name or "").strip()
    email_key = (email or "").strip()
    if email_key and ("@" not in email_key or "." not in email_key.split("@")[-1]):
        email_key = ""
    phone_key = _lead_phone_digits(phone)
    entered_full = _lead_full_name(first, last)

    queries: list[str] = []
    if email_key:
        queries.append(email_key)
    if len(phone_key) >= 8:
        queries.append(phone_key)
    if len(first) >= 2:
        queries.append(first)
    if len(last) >= 2:
        queries.append(last)
    if entered_full:
        queries.append(entered_full)
    if not queries:
        return False

    candidates = await LeadRepo(db).find_identity_candidates(vendor_id, queries, size=80)
    for lead in candidates:
        if email_key and lead.email and email_key.lower() == (lead.email or "").strip().lower():
            return True
        if len(phone_key) >= 8 and _lead_phone_digits(lead.phone) == phone_key:
            return True
        lead_full = _lead_full_name(lead.first_name, lead.last_name)
        if entered_full and lead_full and entered_full == lead_full:
            return True
        if (
            len(first) >= 2
            and len(last) >= 2
            and _same_lead_name(first, lead.first_name)
            and _same_lead_name(last, lead.last_name)
        ):
            return True
        if entered_full and _same_lead_name(entered_full, lead.first_name):
            return True
    return False


@router.post("/platform-leads/check")
async def check_platform_lead(
    body: PlatformLeadLookup,
    db: AsyncSession = Depends(get_db),
):
    """Live duplicate check for the landing Add lead form. Returns no CRM records."""
    from app.services.platform_crm_tenant import get_platform_crm_vendor_id

    vid = await get_platform_crm_vendor_id(db)
    matched = await _platform_lead_is_duplicate(
        db,
        vid,
        first_name=body.first_name,
        last_name=body.last_name,
        email=body.email,
        phone=body.phone,
    )
    return {
        "duplicate": matched,
        "message": _LEAD_DUPLICATE_MESSAGE if matched else None,
    }


@router.post("/platform-leads", status_code=status.HTTP_201_CREATED)
async def submit_platform_lead(
    request: Request,
    body: PlatformLeadCreate,
    db: AsyncSession = Depends(get_db),
):
    """Landing-page New lead form → Super Admin CRM Leads."""
    from app.schemas.crm.schemas import LeadCreate
    from app.services.crm.services import LeadService
    from app.services.platform_crm_tenant import get_platform_crm_vendor_id

    vid = await get_platform_crm_vendor_id(db)
    email = str(body.email) if body.email else None
    phone = body.phone

    if not body.force and await _platform_lead_is_duplicate(
        db,
        vid,
        first_name=body.first_name,
        last_name=body.last_name,
        email=email,
        phone=phone,
    ):
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "ok": False,
                "duplicate": True,
                "message": _LEAD_DUPLICATE_MESSAGE,
            },
        )

    obj = await LeadService(db).create(
        vid,
        LeadCreate(
            first_name=body.first_name or None,
            last_name=body.last_name or None,
            title=body.title,
            company=body.company,
            email=email,
            phone=phone,
            source=body.source or "website",
            status="new",
            notes=body.notes,
            intake_payload={
                "channel": "landing_add_lead",
                "source": body.source or "website",
            },
        ),
        request=request,
    )
    return {
        "ok": True,
        "id": str(obj.id),
        "number": obj.number,
        "message": "Thanks — we received your details and will get back to you soon.",
    }


def _employment_type_label(value: Optional[str]) -> str:
    raw = (value or "full_time").strip().lower()
    return {
        "full_time": "Full time",
        "part_time": "Part time",
        "contract": "Contract",
        "intern": "Internship",
    }.get(raw, raw.replace("_", " ").title() or "Full time")


@router.get("/career-openings")
async def list_career_openings(db: AsyncSession = Depends(get_db)):
    """Public Careers page: open KIT ERP (platform) job postings only."""
    from app.repositories.hr_recruit_repo import JobRepo
    from app.services.platform_crm_tenant import ensure_platform_crm_vendor

    await ensure_platform_crm_vendor(db)
    jobs = await JobRepo(db).list_open_public()
    items = []
    for j in jobs:
        dept = getattr(j, "department", None)
        desig = getattr(j, "designation", None)
        items.append(
            {
                "id": str(j.id),
                "title": j.title,
                "department": getattr(dept, "name", None),
                "designation": getattr(desig, "name", None),
                "employment_type": j.employment_type or "full_time",
                "employment_type_label": _employment_type_label(j.employment_type),
                "location": j.location,
                "openings": j.openings or 1,
                "salary_min": float(j.salary_min) if j.salary_min is not None else None,
                "salary_max": float(j.salary_max) if j.salary_max is not None else None,
                "description": j.description,
                "requirements": j.requirements,
                "benefits": j.benefits,
                "public_slug": j.public_slug,
                "posted_at": j.posted_at.isoformat() if j.posted_at else None,
                "closes_at": j.closes_at.isoformat() if j.closes_at else None,
            }
        )
    return {"items": items, "total": len(items)}


@router.post("/career-applications", status_code=status.HTTP_201_CREATED)
async def submit_career_application(
    request: Request,
    full_name: str = Form(...),
    email: str = Form(...),
    phone: Optional[str] = Form(None),
    college: Optional[str] = Form(None),
    course: Optional[str] = Form(None),
    graduation_year: Optional[str] = Form(None),
    city: Optional[str] = Form(None),
    skills: Optional[str] = Form(None),
    linkedin_url: Optional[str] = Form(None),
    cover_note: Optional[str] = Form(None),
    job_posting_id: Optional[str] = Form(None),
    cv: Optional[UploadFile] = File(None),
    photo: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
):
    """Public Careers page: applicant details + optional CV and passport photo."""
    from app.models.hr_recruit import JobPosting
    from app.repositories.hr_recruit_repo import ApplicationRepo, CandidateRepo
    from sqlalchemy import select as sa_select
    from sqlalchemy.orm import selectinload

    name = (full_name or "").strip()
    email_clean = (email or "").strip().lower()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Please enter your full name")
    if not email_clean or not _EMAIL_RE.match(email_clean):
        raise HTTPException(status_code=400, detail="Please enter a valid email address")

    phone_clean = (phone or "").strip() or None
    college_clean = (college or "").strip() or None
    course_clean = (course or "").strip() or None
    city_clean = (city or "").strip() or None
    skills_raw = (skills or "").strip()
    skills_list = [
        s.strip()[:80]
        for s in skills_raw.replace(";", ",").replace("\n", ",").split(",")
        if s.strip()
    ][:40]
    linkedin_clean = (linkedin_url or "").strip() or None
    note_clean = (cover_note or "").strip() or None

    year_val: Optional[int] = None
    year_raw = (graduation_year or "").strip()
    if year_raw:
        try:
            year_val = int(year_raw)
        except ValueError:
            raise HTTPException(status_code=400, detail="Years of experience must be a number")
        # Field stores years of experience (0–80) from the Careers form.
        if year_val < 0 or year_val > 80:
            raise HTTPException(status_code=400, detail="Years of experience looks invalid")

    if linkedin_clean and not linkedin_clean.startswith(("http://", "https://")):
        linkedin_clean = f"https://{linkedin_clean}"

    job_uuid: Optional[UUID] = None
    position_title: Optional[str] = None
    job_row: Optional[JobPosting] = None
    job_id_raw = (job_posting_id or "").strip()
    if job_id_raw:
        from app.services.platform_crm_tenant import PLATFORM_CRM_VENDOR_ID

        try:
            job_uuid = UUID(job_id_raw)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid job opening selected")
        result = await db.execute(
            sa_select(JobPosting)
            .where(
                JobPosting.id == job_uuid,
                JobPosting.status == "open",
                JobPosting.vendor_id == PLATFORM_CRM_VENDOR_ID,
            )
            .options(selectinload(JobPosting.department))
        )
        job_row = result.scalar_one_or_none()
        if not job_row:
            raise HTTPException(status_code=400, detail="That job opening is no longer available")
        position_title = (job_row.title or "").strip()[:200] or None

    files = FileService()
    cv_url: Optional[str] = None
    filename: Optional[str] = None
    if cv is not None and (cv.filename or "").strip():
        ct = (cv.content_type or "").split(";")[0].strip().lower()
        filename = (cv.filename or "cv.pdf").strip().replace("\\", "/").split("/")[-1]
        ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""
        if ct not in _CAREER_CV_TYPES and ext not in _CAREER_CV_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail="CV must be a PDF or Word document (.pdf, .doc, .docx)",
            )

        contents = await cv.read()
        if not contents:
            raise HTTPException(status_code=400, detail="CV file is empty")
        if len(contents) > _MAX_CAREER_CV_BYTES:
            raise HTTPException(status_code=400, detail="CV file is too large (max 10 MB)")

        cv_url = await files.upload_file(cv, "career-cvs", content=contents)

    photo_url: Optional[str] = None
    photo_filename: Optional[str] = None
    if photo is not None and (photo.filename or "").strip():
        pct = (photo.content_type or "").split(";")[0].strip().lower()
        photo_filename = (photo.filename or "photo.jpg").strip().replace("\\", "/").split("/")[-1]
        pext = ("." + photo_filename.rsplit(".", 1)[-1].lower()) if "." in photo_filename else ""
        if pct not in _CAREER_PHOTO_TYPES and pext not in _CAREER_PHOTO_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail="Passport photo must be JPG, PNG, or WebP",
            )
        photo_bytes = await photo.read()
        if not photo_bytes:
            raise HTTPException(status_code=400, detail="Passport photo file is empty")
        if len(photo_bytes) > _MAX_CAREER_PHOTO_BYTES:
            raise HTTPException(status_code=400, detail="Passport photo is too large (max 5 MB)")
        photo_url = await files.upload_file(photo, "career-photos", content=photo_bytes)

    fwd = request.headers.get("x-forwarded-for") or ""
    ip = (fwd.split(",")[0].strip() if fwd else None) or (request.client.host if request.client else None)
    ua = (request.headers.get("user-agent") or "")[:1000] or None

    row = PlatformCareerApplication(
        full_name=name[:255],
        email=email_clean[:255],
        phone=phone_clean[:40] if phone_clean else None,
        college=college_clean[:255] if college_clean else None,
        course=course_clean[:255] if course_clean else None,
        graduation_year=year_val,
        city=city_clean[:120] if city_clean else None,
        linkedin_url=linkedin_clean[:500] if linkedin_clean else None,
        cover_note=note_clean[:4000] if note_clean else None,
        # Empty string keeps older DBs with NOT NULL cv_url working until ALTER runs.
        cv_url=cv_url or "",
        cv_filename=filename[:255] if filename else None,
        photo_url=photo_url,
        photo_filename=photo_filename[:255] if photo_filename else None,
        job_posting_id=job_uuid,
        position_title=position_title,
        status="new",
        ip_address=ip,
        user_agent=ua,
    )
    db.add(row)

    # Mirror into vendor HR recruitment pipeline when a job was selected.
    if job_row is not None:
        cand_repo = CandidateRepo(db)
        existing = None
        for c in await cand_repo.list(job_row.vendor_id, search=email_clean):
            if (c.email or "").strip().lower() == email_clean:
                existing = c
                break
        if existing is None:
            existing = await cand_repo.create(
                job_row.vendor_id,
                {
                    "full_name": name[:200],
                    "email": email_clean[:255],
                    "phone": phone_clean[:30] if phone_clean else None,
                    "resume_url": cv_url,
                    "current_company": college_clean[:200] if college_clean else None,
                    "current_designation": course_clean[:150] if course_clean else None,
                    "total_experience_years": float(year_val) if year_val is not None else None,
                    "location": city_clean[:200] if city_clean else None,
                    "skills": skills_list or None,
                    "source": "portal",
                    "notes": note_clean[:4000] if note_clean else None,
                },
            )
        else:
            await cand_repo.update(
                existing,
                {
                    "resume_url": cv_url or existing.resume_url,
                    "phone": phone_clean[:30] if phone_clean else existing.phone,
                    "current_company": college_clean[:200] if college_clean else existing.current_company,
                    "current_designation": course_clean[:150] if course_clean else existing.current_designation,
                    "location": city_clean[:200] if city_clean else existing.location,
                    **({"skills": skills_list} if skills_list else {}),
                },
            )

        apps = await ApplicationRepo(db).list(job_row.vendor_id, job_id=job_row.id)
        already = next((a for a in apps if a.candidate_id == existing.id), None)
        if already is None:
            await ApplicationRepo(db).create(
                job_row.vendor_id,
                {
                    "candidate_id": existing.id,
                    "job_posting_id": job_row.id,
                    "current_stage": "applied",
                    "cover_letter": note_clean[:4000] if note_clean else None,
                },
            )

    try:
        await db.commit()
        await db.refresh(row)
    except Exception:
        await db.rollback()
        logger.exception("career application submit failed")
        raise HTTPException(
            status_code=500,
            detail="Could not save your application. Please try again in a moment.",
        )
    return {
        "ok": True,
        "id": str(row.id),
        "message": "Thanks — your application was received. Our team will review it soon.",
    }


@router.post("/vendor/{vendor_slug}/contact-queries", status_code=status.HTTP_201_CREATED)
async def submit_storefront_contact_query(
    vendor_slug: str,
    request: Request,
    body: StorefrontContactQueryCreate,
    db: AsyncSession = Depends(get_db),
):
    """Public Contact Us form: store a customer query for the store / admin Queries inbox."""
    repo = VendorRepository(db)
    vendor = await repo.find_by_slug(vendor_slug)
    if not vendor or not vendor_live_on_storefront(vendor.status):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )

    fwd = request.headers.get("x-forwarded-for") or ""
    ip = (fwd.split(",")[0].strip() if fwd else None) or (request.client.host if request.client else None)
    ua = (request.headers.get("user-agent") or "")[:1000] or None

    row = StorefrontContactQuery(
        vendor_id=vendor.id,
        name=body.name,
        email=str(body.email) if body.email else None,
        phone=body.phone,
        message=body.message,
        status="new",
        ip_address=ip,
        user_agent=ua,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)

    # Fire event for auto-trigger workflows (best-effort, non-blocking).
    try:
        from app.core.events import event_emitter
        await event_emitter.emit("crm.contact_query.created", {
            "vendor_id": str(vendor.id),
            "query_id": str(row.id),
            "name": row.name,
            "email": row.email,
            "phone": row.phone,
            "message": row.message,
        })
    except Exception:
        pass

    return {
        "ok": True,
        "id": str(row.id),
        "message": "Thanks — we received your message and will get back to you soon.",
    }


@router.post("/contact-queries", status_code=status.HTTP_201_CREATED)
async def submit_storefront_contact_query_by_tenant(
    request: Request,
    body: StorefrontContactQueryCreate,
    vendor_id: UUID = Depends(get_vendor_id_from_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Same as slug submit, for storefronts that resolve vendor via subdomain / headers."""
    repo = VendorRepository(db)
    vendor = await repo.get_by_id(vendor_id)
    if not vendor or not vendor_live_on_storefront(vendor.status):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")

    fwd = request.headers.get("x-forwarded-for") or ""
    ip = (fwd.split(",")[0].strip() if fwd else None) or (request.client.host if request.client else None)
    ua = (request.headers.get("user-agent") or "")[:1000] or None

    row = StorefrontContactQuery(
        vendor_id=vendor.id,
        name=body.name,
        email=str(body.email) if body.email else None,
        phone=body.phone,
        message=body.message,
        status="new",
        ip_address=ip,
        user_agent=ua,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)

    # Fire event for auto-trigger workflows (best-effort, non-blocking).
    try:
        from app.core.events import event_emitter
        await event_emitter.emit("crm.contact_query.created", {
            "vendor_id": str(vendor.id),
            "query_id": str(row.id),
            "name": row.name,
            "email": row.email,
            "phone": row.phone,
            "message": row.message,
        })
    except Exception:
        pass

    return {
        "ok": True,
        "id": str(row.id),
        "message": "Thanks — we received your message and will get back to you soon.",
    }


@router.get("/stores")
async def list_public_stores(
    vendor_id: UUID = Depends(get_vendor_id_from_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Return active store locations for the vendor's business front.

    Includes temporarily closed units so ``?branch=`` can resolve per-BU templates
    and branding; UIs filter on ``is_open`` when listing shoppable locations.
    """
    from sqlalchemy import select
    from app.models.store import Store

    result = await db.execute(
        select(Store)
        .where(Store.vendor_id == vendor_id, Store.is_active == True)
        .order_by(Store.is_default.desc(), Store.name)
    )
    stores = result.scalars().all()

    def _to_dict(s: Store) -> dict:
        return {
            "id": str(s.id),
            "name": s.name,
            "code": s.code,
            "description": s.description,
            "phone": s.phone,
            "email": s.email,
            "address": s.address or {},
            "is_default": s.is_default,
            "is_open": s.is_open if s.is_open is not None else True,
            "settings": s.settings or {},
        }

    return {"stores": [_to_dict(s) for s in stores], "total": len(stores)}


@router.get("/info", response_model=VendorResponse)
async def get_vendor_info(
    vendor_id: UUID = Depends(get_vendor_id_from_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get public vendor information."""
    repo = VendorRepository(db)
    vendor = await repo.get_by_id(vendor_id)
    
    if not vendor or not vendor_live_on_storefront(vendor.status):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    return vendor


def _store_cat_dict(c):
    return {
        "id": str(c.id),
        "parent_id": str(c.parent_id) if c.parent_id else None,
        "name": c.name,
        "slug": c.slug,
        "description": c.description,
        "image_url": c.image_url,
        "applies_to": c.applies_to,
        "children": [],
    }


def _store_tree_node(node):
    c = node["_model"]
    d = _store_cat_dict(c)
    d["children"] = [_store_tree_node(ch) for ch in node.get("children", [])]
    return d


@router.get("/categories")
async def list_categories(
    applies_to: Optional[str] = Query(None, description="Filter: product, service, or both"),
    tree: bool = Query(False, description="Return as nested tree"),
    vendor_id: UUID = Depends(get_vendor_id_from_tenant),
    db: AsyncSession = Depends(get_db),
):
    """List active categories for the vendor business front."""
    from app.repositories.vendor_category_repo import VendorCategoryRepository
    repo = VendorCategoryRepository(db)

    if tree:
        tree_data = await repo.get_tree(
            vendor_id, applies_to=applies_to, is_active=True, is_visible=True,
        )
        return JSONResponse(content={
            "categories": [_store_tree_node(n) for n in tree_data],
        })

    items = await repo.list_by_vendor(
        vendor_id, applies_to=applies_to, is_active=True, is_visible=True,
    )
    return JSONResponse(content={
        "categories": [_store_cat_dict(c) for c in items],
    })


@router.get("/products")
async def list_products(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    search: Optional[str] = None,
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    branch: Optional[str] = Query(None, description="Business unit code or id"),
    store_id: Optional[str] = Query(None, description="Business unit id"),
    vendor_id: UUID = Depends(get_vendor_id_from_tenant),
    db: AsyncSession = Depends(get_db),
):
    """List active products for vendor business front."""
    from app.services.catalog_store_scope import resolve_store_id
    repo = ProductRepository(db)
    skip = (page - 1) * size
    sid = await resolve_store_id(db, vendor_id, store_id=store_id, branch=branch)
    
    items, total = await repo.list_by_vendor(
        vendor_id=vendor_id,
        skip=skip,
        limit=size,
        status="active",
        category=category,
        search=search,
        visible_only=True,
        store_id=sid,
    )

    # Apply price range filter if provided
    if min_price is not None:
        items = [p for p in items if float(p.price or 0) >= min_price]
    if max_price is not None:
        items = [p for p in items if float(p.price or 0) <= max_price]

    # Recalculate total if price filters applied
    if min_price is not None or max_price is not None:
        all_items, _ = await repo.list_by_vendor(
            vendor_id=vendor_id,
            skip=0,
            limit=10000,
            status="active",
            category=category,
            search=search,
            visible_only=True,
            store_id=sid,
        )
        if min_price is not None:
            all_items = [p for p in all_items if float(p.price or 0) >= min_price]
        if max_price is not None:
            all_items = [p for p in all_items if float(p.price or 0) <= max_price]
        total = len(all_items)

    review_repo = ReviewRepository(db)
    product_dicts = []
    for p in items:
        d = _product_to_dict(p)
        stats = await review_repo.get_avg_rating("product", product_id=p.id)
        d["avg_rating"] = stats["avg_rating"]
        d["review_count"] = stats["review_count"]
        product_dicts.append(d)

    return JSONResponse(content={
        "items": product_dicts,
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total > 0 else 0,
    })


@router.get("/products/{slug}")
async def get_product(
    slug: str,
    vendor_id: UUID = Depends(get_vendor_id_from_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific product by slug (does not increment view_count)."""
    repo = ProductRepository(db)
    product = await repo.find_by_slug(vendor_id, slug)

    if not product or product.status != "active" or not product.is_visible:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    review_repo = ReviewRepository(db)
    d = _product_to_dict(product)
    stats = await review_repo.get_avg_rating("product", product_id=product.id)
    d["avg_rating"] = stats["avg_rating"]
    d["review_count"] = stats["review_count"]
    distribution = await review_repo.get_rating_distribution("product", product_id=product.id)
    d["rating_distribution"] = distribution

    # Attach cross-sell and upsell product cards
    merch = await _get_product_merchandising(product.id, vendor_id, db, source_product=product)
    d["cross_sell_products"] = merch["cross_sell"]
    d["upsell_products"] = merch["upsell"]

    return JSONResponse(content=d)


@router.post("/products/{slug}/view")
async def record_product_view(
    slug: str,
    request: Request,
    body: TrackViewBody = Body(default_factory=TrackViewBody),
    vendor_id: UUID = Depends(get_vendor_id_from_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Count a unique product detail view (once per visitor per 24h)."""
    repo = ProductRepository(db)
    product = await repo.find_by_slug(vendor_id, slug)

    if not product or product.status != "active" or not product.is_visible:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    current = int(product.view_count or 0)
    visitor_key = visitor_key_from_request(body.visitor_id, request)
    counted = await claim_unique_view("product", str(product.id), visitor_key)
    if not counted:
        return {"slug": product.slug, "view_count": current, "counted": False}

    product.view_count = current + 1
    await db.commit()
    await db.refresh(product)
    return {
        "slug": product.slug,
        "view_count": int(product.view_count or 0),
        "counted": True,
    }


async def _product_to_card(p, review_repo: ReviewRepository) -> dict:
    stats = await review_repo.get_avg_rating("product", product_id=p.id)
    return {
        "id": str(p.id),
        "name": p.name,
        "slug": p.slug,
        "price": float(p.price or 0),
        "compare_at_price": float(p.compare_at_price) if p.compare_at_price else None,
        "currency": p.currency or "INR",
        "images": [{"id": str(img.id), "url": img.url, "alt_text": img.alt_text, "is_primary": img.is_primary, "media_type": img.media_type or "image"} for img in (p.images or [])],
        "avg_rating": stats["avg_rating"],
        "review_count": stats["review_count"],
        "view_count": int(p.view_count or 0),
        "stock_status": _effective_stock_status(
            quantity=p.quantity,
            stock_status=p.stock_status,
            track_inventory=p.track_inventory,
            allow_backorders=p.allow_backorders,
            low_stock_threshold=p.low_stock_threshold,
        ),
        "brand": p.brand,
        "category": p.category,
    }


async def _get_product_merchandising(
    product_id: UUID, vendor_id: UUID, db: AsyncSession,
    source_product=None,
) -> dict:
    """
    Resolve cross-sell and upsell products.
    1. Use manual UpsellMapping rows if they exist.
    2. Otherwise auto-recommend:
       - cross_sell: same-category products
       - upsell: best-selling / featured / highest-rated products
    """
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.merchandising import UpsellMapping
    from app.models.vendor_product import Product

    review_repo = ReviewRepository(db)

    # ── Try manual mappings first ──
    stmt = (
        select(UpsellMapping)
        .where(
            UpsellMapping.vendor_id == vendor_id,
            UpsellMapping.source_product_id == product_id,
            UpsellMapping.is_active == True,
            UpsellMapping.trigger_stage == "PDP",
            UpsellMapping.target_type == "product",
            UpsellMapping.target_product_id.isnot(None),
        )
        .order_by(UpsellMapping.priority.desc())
    )
    result = await db.execute(stmt)
    mappings = result.scalars().all()

    if mappings:
        target_ids = [m.target_product_id for m in mappings]
        prod_stmt = (
            select(Product)
            .options(selectinload(Product.images))
            .where(Product.id.in_(target_ids), Product.status == "active", Product.is_visible == True, Product.deleted_at.is_(None))
        )
        prod_result = await db.execute(prod_stmt)
        products_by_id = {p.id: p for p in prod_result.scalars().all()}

        cross_sell, upsell = [], []
        for m in mappings:
            p = products_by_id.get(m.target_product_id)
            if not p:
                continue
            card = await _product_to_card(p, review_repo)
            if m.relation_type == "cross_sell":
                cross_sell.append(card)
            else:
                upsell.append(card)
        return {"cross_sell": cross_sell, "upsell": upsell}

    # ── Auto-recommend when no manual mappings exist ──
    MAX_ITEMS = 6

    # Cross-sell: products in the same category (excluding current product)
    cross_sell = []
    category = source_product.category if source_product else None
    if category:
        cat_stmt = (
            select(Product)
            .options(selectinload(Product.images))
            .where(
                Product.vendor_id == vendor_id,
                Product.id != product_id,
                Product.status == "active",
                Product.is_visible == True,
                Product.deleted_at.is_(None),
                Product.category == category,
            )
            .order_by(Product.is_featured.desc(), Product.created_at.desc())
            .limit(MAX_ITEMS)
        )
        cat_result = await db.execute(cat_stmt)
        for p in cat_result.scalars().all():
            cross_sell.append(await _product_to_card(p, review_repo))

    # Upsell: best-selling / featured / highest-rated across the store
    # Prefer featured products, then those with more reviews (proxy for popularity)
    seen_ids = {product_id} | {UUID(c["id"]) for c in cross_sell}
    upsell_stmt = (
        select(Product)
        .options(selectinload(Product.images))
        .where(
            Product.vendor_id == vendor_id,
            Product.id.notin_(seen_ids),
            Product.status == "active",
            Product.is_visible == True,
            Product.deleted_at.is_(None),
        )
        .order_by(
            Product.is_best_seller.desc(),
            Product.is_featured.desc(),
            Product.is_new_arrival.desc(),
            Product.created_at.desc(),
        )
        .limit(MAX_ITEMS)
    )
    upsell_result = await db.execute(upsell_stmt)
    upsell = []
    for p in upsell_result.scalars().all():
        upsell.append(await _product_to_card(p, review_repo))

    return {"cross_sell": cross_sell, "upsell": upsell}


@router.get("/services")
async def list_services(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    search: Optional[str] = None,
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    branch: Optional[str] = Query(None, description="Business unit code or id"),
    store_id: Optional[str] = Query(None, description="Business unit id"),
    vendor_id: UUID = Depends(get_vendor_id_from_tenant),
    db: AsyncSession = Depends(get_db),
):
    """List active services for vendor business front."""
    from app.services.catalog_store_scope import resolve_store_id
    repo = ServiceRepository(db)
    skip = (page - 1) * size
    sid = await resolve_store_id(db, vendor_id, store_id=store_id, branch=branch)

    items, total = await repo.list_by_vendor(
        vendor_id=vendor_id,
        skip=skip,
        limit=size,
        status="active",
        category=category,
        search=search,
        visible_only=True,
        store_id=sid,
    )

    # Apply price range filter if provided
    if min_price is not None:
        items = [s for s in items if float(s.price or s.price_min or 0) >= min_price]
    if max_price is not None:
        items = [s for s in items if float(s.price or s.price_max or 0) <= max_price]

    # Recalculate total if price filters applied
    if min_price is not None or max_price is not None:
        all_items, _ = await repo.list_by_vendor(
            vendor_id=vendor_id,
            skip=0,
            limit=10000,
            status="active",
            category=category,
            search=search,
            visible_only=True,
            store_id=sid,
        )
        if min_price is not None:
            all_items = [s for s in all_items if float(s.price or s.price_min or 0) >= min_price]
        if max_price is not None:
            all_items = [s for s in all_items if float(s.price or s.price_max or 0) <= max_price]
        total = len(all_items)

    review_repo = ReviewRepository(db)
    from app.services.service_media import resolve_service_thumbnail_url
    service_dicts = []
    for s in items:
        d = _service_to_dict(s)
        d["image_url"] = resolve_service_thumbnail_url(s) or d.get("image_url")
        stats = await review_repo.get_avg_rating("service", service_id=s.id)
        d["avg_rating"] = stats["avg_rating"]
        d["review_count"] = stats["review_count"]
        service_dicts.append(d)

    return JSONResponse(content={
        "items": service_dicts,
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total > 0 else 0,
    })


@router.get("/services/{slug}")
async def get_service(
    slug: str,
    vendor_id: UUID = Depends(get_vendor_id_from_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific service by slug (does not increment view_count)."""
    repo = ServiceRepository(db)
    svc = await repo.find_by_slug(vendor_id, slug)

    if not svc or svc.status != "active" or not svc.is_visible:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )

    review_repo = ReviewRepository(db)
    from app.services.service_media import resolve_service_thumbnail_url
    d = _service_to_dict(svc)
    d["image_url"] = resolve_service_thumbnail_url(svc) or d.get("image_url")
    stats = await review_repo.get_avg_rating("service", service_id=svc.id)
    d["avg_rating"] = stats["avg_rating"]
    d["review_count"] = stats["review_count"]
    distribution = await review_repo.get_rating_distribution("service", service_id=svc.id)
    d["rating_distribution"] = distribution

    return JSONResponse(content=d)


@router.post("/services/{slug}/view")
async def record_service_view(
    slug: str,
    request: Request,
    body: TrackViewBody = Body(default_factory=TrackViewBody),
    vendor_id: UUID = Depends(get_vendor_id_from_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Count a unique service detail view (once per visitor per 24h)."""
    repo = ServiceRepository(db)
    svc = await repo.find_by_slug(vendor_id, slug)

    if not svc or svc.status != "active" or not svc.is_visible:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found",
        )

    current = int(svc.view_count or 0)
    visitor_key = visitor_key_from_request(body.visitor_id, request)
    counted = await claim_unique_view("service", str(svc.id), visitor_key)
    if not counted:
        return {"slug": svc.slug, "view_count": current, "counted": False}

    svc.view_count = current + 1
    await db.commit()
    await db.refresh(svc)
    return {
        "slug": svc.slug,
        "view_count": int(svc.view_count or 0),
        "counted": True,
    }


# ── Rental Assets (public catalog) ───────────────────────────────────────────

@router.get("/rentals")
async def list_catalog_rentals(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    category: Optional[str] = None,
    min_daily_rate: Optional[float] = Query(None, ge=0, description="Minimum daily rate filter"),
    max_daily_rate: Optional[float] = Query(None, ge=0, description="Maximum daily rate filter"),
    branch: Optional[str] = Query(None, description="Business unit code or UUID"),
    store_id: Optional[str] = Query(None, description="Business unit UUID"),
    vendor_id: UUID = Depends(get_vendor_id_from_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Paginated public rental asset catalog — same tenant resolution as /catalog/products."""
    from app.services.catalog_store_scope import resolve_store_id
    from app.services.rental_service import RentalService

    sid = await resolve_store_id(db, vendor_id, store_id=store_id, branch=branch)
    svc = RentalService(db)
    items, total = await svc.list_catalog_assets(
        vendor_id,
        page=page,
        size=size,
        search=search,
        category=category,
        min_daily_rate=min_daily_rate,
        max_daily_rate=max_daily_rate,
        store_id=sid,
    )
    return JSONResponse(content={
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total > 0 else 0,
    })


@router.get("/rentals/{slug}")
async def get_catalog_rental(
    slug: str,
    vendor_id: UUID = Depends(get_vendor_id_from_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get a single rental asset by slug for the public catalog."""
    from app.services.rental_service import RentalService

    asset = await RentalService(db).get_catalog_asset_by_slug(vendor_id, slug)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rental asset not found")
    return JSONResponse(content=asset)
