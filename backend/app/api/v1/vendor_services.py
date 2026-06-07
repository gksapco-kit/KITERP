# app/api/v1/vendor_services.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from uuid import UUID
from slugify import slugify
import math
import uuid as uuid_mod

from app.database import get_db
from app.api.deps import get_current_active_user, get_current_vendor_id
from app.models.user import User
from app.models.vendor_service import Service, ServiceAvailability, ServicePlan
from app.schemas.vendor_service import (
    ServiceCreate, ServiceUpdate, ServiceResponse, ServiceListResponse,
    PriceType, UnitOfMeasurement, ServiceMode
)
from app.services.vendor_service import VendorService
from app.repositories.service_repo import ServiceRepository
from app.services.catalog_store_scope import sync_service_stores

from datetime import date as date_type, datetime

router = APIRouter()

DATE_FIELDS = {"service_expiry_date"}
DATETIME_FIELDS = {"discount_start_date", "discount_end_date"}


def _parse_date(v):
    if v is None or isinstance(v, date_type):
        return v
    return date_type.fromisoformat(str(v))


def _parse_datetime(v):
    if v is None or isinstance(v, datetime):
        return v
    s = str(v)
    if "T" not in s and len(s) == 10:
        s += "T00:00:00"
    return datetime.fromisoformat(s)


def _coerce_date_fields(fields: dict) -> dict:
    """Convert date/datetime string values to proper Python objects."""
    for k in DATE_FIELDS:
        if k in fields and fields[k] is not None:
            fields[k] = _parse_date(fields[k])
    for k in DATETIME_FIELDS:
        if k in fields and fields[k] is not None:
            fields[k] = _parse_datetime(fields[k])
    return fields


def _num(v):
    return float(v) if v is not None else None


def _dt(v):
    return v.isoformat() if v else None


def _plan_to_dict(p) -> dict:
    return {
        "id": str(p.id),
        "service_id": str(p.service_id),
        "name": p.name,
        "description": p.description,
        "price": _num(p.price),
        "uom": p.uom or "per_session",
        "price_type": p.price_type or "per_cycle",
        "service_frequency": p.service_frequency or "once",
        "service_mode": p.service_mode or "in_store",
        "subscription_interval": p.subscription_interval,
        "subscription_trial_days": p.subscription_trial_days,
        "subscription_setup_fee": _num(p.subscription_setup_fee),
        "subscription_billing_cycles": p.subscription_billing_cycles,
        "subscription_schedule_modes": p.subscription_schedule_modes or [],
        "duration_minutes": p.duration_minutes,
        "buffer_minutes": p.buffer_minutes or 0,
        "service_capacity": p.service_capacity or 1,
        # Pricing overrides
        "plan_price_type": p.plan_price_type,
        "price_min": _num(p.price_min),
        "price_max": _num(p.price_max),
        "currency": p.currency or "INR",
        "discount_percentage": _num(p.discount_percentage),
        "discount_amount": _num(p.discount_amount),
        "offer_label": p.offer_label,
        "discount_start_date": p.discount_start_date,
        "discount_end_date": p.discount_end_date,
        # Tax overrides
        "is_taxable": p.is_taxable,
        "tax_rate": _num(p.tax_rate),
        "sac_code": p.sac_code,
        "gst_rate": _num(p.gst_rate),
        # Booking overrides
        "requires_booking": p.requires_booking,
        "max_bookings_per_slot": p.max_bookings_per_slot,
        "advance_booking_days": p.advance_booking_days,
        "booking_lead_time_hours": p.booking_lead_time_hours,
        "cancellation_policy": p.cancellation_policy,
        "cancellation_hours": p.cancellation_hours,
        "rescheduling_policy": p.rescheduling_policy,
        "no_show_policy": p.no_show_policy,
        # Availability overrides
        "availability": p.availability or [],
        # Lifecycle overrides
        "service_expiry_date": p.service_expiry_date,
        "validity_period_days": p.validity_period_days,
        "renewal_required": p.renewal_required,
        "is_active": p.is_active if p.is_active is not None else True,
        "sort_order": p.sort_order or 0,
        "created_at": _dt(p.created_at),
        "updated_at": _dt(p.updated_at),
    }


def _service_to_dict(s) -> dict:
    """Serialize a Service model to JSON-compatible dict."""
    return {
        "id": str(s.id),
        "vendor_id": str(s.vendor_id),
        # Basic
        "name": s.name,
        "slug": s.slug,
        "description": s.description,
        "short_description": s.short_description,
        "brand": s.brand,
        "service_type": s.service_type or "one_time",
        "category": s.category,
        "subcategory": s.subcategory,
        "tags": s.tags or [],
        # Pricing
        "price_type": s.price_type or "fixed",
        "price": _num(s.price),
        "price_min": _num(s.price_min),
        "price_max": _num(s.price_max),
        "currency": s.currency or "INR",
        "discount_percentage": _num(s.discount_percentage),
        "discount_amount": _num(s.discount_amount),
        "discount_start_date": _dt(s.discount_start_date),
        "discount_end_date": _dt(s.discount_end_date),
        "offer_label": s.offer_label,
        # Tax
        "is_taxable": s.is_taxable if s.is_taxable is not None else True,
        "tax_rate": _num(s.tax_rate),
        "sac_code": s.sac_code,
        "gst_rate": _num(s.gst_rate),
        # Configuration
        "uom": s.uom or "per_session",
        "service_mode": s.service_mode or "in_store",
        "duration_minutes": s.duration_minutes,
        "buffer_minutes": s.buffer_minutes or 0,
        "service_capacity": s.service_capacity or 1,
        # Subscription
        "is_subscription": s.is_subscription or False,
        "subscription_interval": s.subscription_interval,
        "subscription_price": _num(s.subscription_price),
        "subscription_price_type": s.subscription_price_type or "per_cycle",
        "subscription_trial_days": s.subscription_trial_days,
        "subscription_setup_fee": _num(s.subscription_setup_fee),
        "subscription_billing_cycles": s.subscription_billing_cycles,
        "subscription_schedule_modes": s.subscription_schedule_modes or [],
        # Booking
        "requires_booking": s.requires_booking if s.requires_booking is not None else True,
        "max_bookings_per_slot": s.max_bookings_per_slot or 1,
        "advance_booking_days": s.advance_booking_days or 30,
        "booking_lead_time_hours": s.booking_lead_time_hours,
        "cancellation_policy": s.cancellation_policy,
        "cancellation_hours": s.cancellation_hours,
        "rescheduling_policy": s.rescheduling_policy,
        "no_show_policy": s.no_show_policy,
        # Lifecycle
        "service_expiry_date": str(s.service_expiry_date) if s.service_expiry_date else None,
        "validity_period_days": s.validity_period_days,
        "renewal_required": s.renewal_required or False,
        # Visibility
        "status": s.status or "draft",
        "is_featured": s.is_featured or False,
        "is_visible": s.is_visible if s.is_visible is not None else True,
        "is_popular": s.is_popular or False,
        "is_new_service": s.is_new_service or False,
        "is_on_sale": s.is_on_sale or False,
        "allow_quote_request": s.allow_quote_request or False,
        "quote_form_config": s.quote_form_config or [],
        "store_scope": s.store_scope or "all",
        "store_ids": [str(a.store_id) for a in (getattr(s, "store_assignments", None) or [])],
        # Media
        "image_url": s.image_url,
        "gallery": s.gallery or [],
        "media": s.media or [],
        # SEO
        "meta_title": s.meta_title,
        "meta_description": s.meta_description,
        "meta_keywords": s.meta_keywords or [],
        # Advanced
        "service_packages": s.service_packages or [],
        "addons": s.addons or [],
        "prerequisites": s.prerequisites,
        "whats_included": s.whats_included or [],
        "whats_not_included": s.whats_not_included or [],
        "service_areas": s.service_areas or [],
        # Audit
        "created_by": str(s.created_by) if s.created_by else None,
        "updated_by": str(s.updated_by) if s.updated_by else None,
        "version_number": s.version_number or 1,
        "change_history": s.change_history or [],
        "view_count": s.view_count or 0,
        "booking_count": s.booking_count or 0,
        # Relations
        "availability": [
            {
                "id": str(a.id),
                "day_of_week": a.day_of_week,
                "start_time": a.start_time,
                "end_time": a.end_time,
                "is_available": a.is_available if a.is_available is not None else True,
            }
            for a in (s.availability or [])
        ],
        "plans": [_plan_to_dict(p) for p in (s.plans or [])],
        "created_at": _dt(s.created_at),
        "updated_at": _dt(s.updated_at),
        "published_at": _dt(s.published_at),
    }


def _build_plans(service_id, plans_data: list) -> list:
    """Create ServicePlan ORM objects from plan data list."""
    result = []
    for i, plan in enumerate(plans_data):
        pd = plan.model_dump() if hasattr(plan, "model_dump") else dict(plan)
        avail = pd.get("availability")
        if avail:
            avail = [a.model_dump() if hasattr(a, "model_dump") else dict(a) for a in avail] if avail else None
        p = ServicePlan(
            id=uuid_mod.uuid4(),
            service_id=service_id,
            name=pd.get("name", "Plan"),
            description=pd.get("description"),
            price=pd.get("price"),
            uom=pd.get("uom") or "per_session",
            price_type=pd.get("price_type") or "per_cycle",
            service_frequency=pd.get("service_frequency") or "once",
            service_mode=pd.get("service_mode") or "in_store",
            subscription_interval=pd.get("subscription_interval"),
            subscription_trial_days=pd.get("subscription_trial_days"),
            subscription_setup_fee=pd.get("subscription_setup_fee"),
            subscription_billing_cycles=pd.get("subscription_billing_cycles"),
            subscription_schedule_modes=pd.get("subscription_schedule_modes"),
            duration_minutes=pd.get("duration_minutes"),
            buffer_minutes=pd.get("buffer_minutes") or 0,
            service_capacity=pd.get("service_capacity") or 1,
            plan_price_type=pd.get("plan_price_type"),
            price_min=pd.get("price_min"),
            price_max=pd.get("price_max"),
            currency=pd.get("currency") or "INR",
            discount_percentage=pd.get("discount_percentage"),
            discount_amount=pd.get("discount_amount"),
            offer_label=pd.get("offer_label"),
            discount_start_date=pd.get("discount_start_date"),
            discount_end_date=pd.get("discount_end_date"),
            is_taxable=pd.get("is_taxable"),
            tax_rate=pd.get("tax_rate"),
            sac_code=pd.get("sac_code"),
            gst_rate=pd.get("gst_rate"),
            requires_booking=pd.get("requires_booking"),
            max_bookings_per_slot=pd.get("max_bookings_per_slot"),
            advance_booking_days=pd.get("advance_booking_days"),
            booking_lead_time_hours=pd.get("booking_lead_time_hours"),
            cancellation_policy=pd.get("cancellation_policy"),
            cancellation_hours=pd.get("cancellation_hours"),
            rescheduling_policy=pd.get("rescheduling_policy"),
            no_show_policy=pd.get("no_show_policy"),
            availability=avail,
            service_expiry_date=pd.get("service_expiry_date"),
            validity_period_days=pd.get("validity_period_days"),
            renewal_required=pd.get("renewal_required"),
            is_active=pd.get("is_active", True),
            sort_order=pd.get("sort_order", i),
        )
        result.append(p)
    return result


@router.get("")
async def list_services(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=500),
    status: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    store_id: Optional[str] = Query(None, description="Filter by business unit availability"),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = ServiceRepository(db)
    skip = (page - 1) * size
    sid = None
    if store_id:
        try:
            sid = UUID(store_id)
        except ValueError:
            raise HTTPException(400, "Invalid store_id")

    items, total = await repo.list_by_vendor(
        vendor_id=vendor_id,
        skip=skip,
        limit=size,
        status=status,
        category=category,
        search=search,
        store_id=sid,
    )

    return JSONResponse(content={
        "items": [_service_to_dict(s) for s in items],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total > 0 else 0,
    })


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_service(
    data: ServiceCreate,
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = ServiceRepository(db)

    slug = data.slug or slugify(data.name, lowercase=True)
    if await repo.slug_exists(vendor_id, slug):
        slug = f"{slug}-{str(uuid_mod.uuid4())[:8]}"

    fields = data.model_dump(exclude={"slug", "availability", "plans", "store_ids"})
    availability_data = data.availability or []
    plans_data = data.plans or []
    store_scope = fields.pop("store_scope", "all") or "all"
    store_ids = data.store_ids or []
    fields["store_scope"] = store_scope

    # Convert enum values to strings for SQLAlchemy
    for key in ("price_type",):
        val = fields.get(key)
        if val and hasattr(val, "value"):
            fields[key] = val.value

    fields["slug"] = slug
    fields["vendor_id"] = vendor_id
    fields["created_by"] = current_user.id
    fields["updated_by"] = current_user.id
    if not fields.get("status"):
        fields["status"] = "draft"

    _coerce_date_fields(fields)

    fields["change_history"] = [{
        "version": 1,
        "changed_by": str(current_user.id),
        "changed_by_name": current_user.full_name or current_user.email,
        "changed_at": datetime.utcnow().isoformat() + "Z",
        "changes": {"_action": {"old": None, "new": "Service created"}},
    }]

    svc = Service(**fields)
    db.add(svc)
    await db.flush()  # get ID before adding relations

    for avail in availability_data:
        a = ServiceAvailability(
            service_id=svc.id,
            day_of_week=avail.day_of_week,
            start_time=avail.start_time,
            end_time=avail.end_time,
            is_available=avail.is_available,
        )
        db.add(a)

    for plan in _build_plans(svc.id, plans_data):
        db.add(plan)

    await sync_service_stores(db, vendor_id, svc.id, store_scope, store_ids)
    await db.commit()

    svc = await repo.get_by_vendor_and_id(vendor_id, svc.id)
    return JSONResponse(content=_service_to_dict(svc), status_code=201)


@router.get("/{service_id}")
async def get_service(
    service_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = ServiceRepository(db)
    svc = await repo.get_by_vendor_and_id(vendor_id, service_id)

    if not svc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )

    return JSONResponse(content=_service_to_dict(svc))


@router.put("/{service_id}")
async def update_service(
    service_id: UUID,
    data: ServiceUpdate,
    current_user: User = Depends(get_current_active_user),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = ServiceRepository(db)
    svc = await repo.get_by_vendor_and_id(vendor_id, service_id)

    if not svc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )

    update_data = data.model_dump(exclude_unset=True)
    availability_data = update_data.pop("availability", None)
    plans_data = update_data.pop("plans", None)
    store_ids_payload = update_data.pop("store_ids", None)
    _coerce_date_fields(update_data)

    # Build change diff for audit history
    # Fields that are internal/noisy and should never appear in user-visible history
    skip_diff = {
        "availability", "plans", "updated_by", "version_number", "change_history",
        "quote_form_config", "media", "images", "created_by", "created_at", "updated_at",
        "slug", "store_ids",
    }

    def _norm(val):
        """Normalize a value for human-readable diffing."""
        if val is None:
            return None
        # Strip enum class prefix e.g. "ServiceStatus.ACTIVE" -> "active"
        s = str(val)
        if "." in s and s.split(".")[0][0].isupper():
            s = s.split(".", 1)[1].lower()
        # Normalize numeric: try to represent as int if whole, else float
        try:
            f = float(s)
            return str(int(f)) if f == int(f) else str(round(f, 6))
        except (ValueError, TypeError, OverflowError):
            pass
        return s

    changes = {}
    for field, new_value in update_data.items():
        if field in skip_diff:
            continue
        old_value = getattr(svc, field, None)
        old_norm = _norm(old_value)
        new_norm = _norm(new_value)
        if old_norm != new_norm:
            changes[field] = {"old": old_norm, "new": new_norm}

    if availability_data is not None:
        old_slots = len(svc.availability or [])
        new_slots = len(availability_data)
        if old_slots != new_slots:
            changes["availability"] = {"old": f"{old_slots} slot(s)", "new": f"{new_slots} slot(s)"}

    if plans_data is not None:
        old_plans = len(svc.plans or [])
        new_plans = len(plans_data)
        if old_plans != new_plans:
            changes["plans"] = {"old": f"{old_plans} plan(s)", "new": f"{new_plans} plan(s)"}
        else:
            changes["plans"] = {"old": f"{old_plans} plan(s)", "new": f"{new_plans} plan(s) (updated)"}

    if changes:
        history_entry = {
            "version": (svc.version_number or 1) + 1,
            "changed_by": str(current_user.id),
            "changed_by_name": current_user.full_name or current_user.email,
            "changed_at": datetime.utcnow().isoformat() + "Z",
            "changes": changes,
        }
        existing_history = list(svc.change_history or [])
        existing_history.append(history_entry)
        svc.change_history = existing_history

    for field, value in update_data.items():
        if field in ("price_type", "status") and value and hasattr(value, "value"):
            value = value.value
        setattr(svc, field, value)

    # Replace availability slots when provided
    if availability_data is not None:
        for existing in list(svc.availability):
            await db.delete(existing)
        await db.flush()
        for avail in availability_data:
            g = avail.get if isinstance(avail, dict) else lambda k, d=None: getattr(avail, k, d)
            a = ServiceAvailability(
                service_id=svc.id,
                day_of_week=g("day_of_week"),
                start_time=g("start_time"),
                end_time=g("end_time"),
                is_available=g("is_available") if g("is_available") is not None else True,
            )
            db.add(a)

    # Replace plans when provided
    if plans_data is not None:
        for existing in list(svc.plans):
            await db.delete(existing)
        await db.flush()
        for plan in _build_plans(svc.id, plans_data):
            db.add(plan)

    svc.updated_by = current_user.id
    if changes:
        svc.version_number = (svc.version_number or 1) + 1

    if store_ids_payload is not None or "store_scope" in update_data:
        scope = svc.store_scope or "all"
        ids = store_ids_payload if store_ids_payload is not None else [
            str(a.store_id) for a in (getattr(svc, "store_assignments", None) or [])
        ]
        await sync_service_stores(db, vendor_id, svc.id, scope, ids)

    await db.commit()
    svc = await repo.get_by_vendor_and_id(vendor_id, service_id)
    return JSONResponse(content=_service_to_dict(svc))


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(
    service_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    repo = ServiceRepository(db)
    svc = await repo.get_by_vendor_and_id(vendor_id, service_id)

    if not svc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )

    await db.delete(svc)
    await db.commit()
