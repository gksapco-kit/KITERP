# app/api/v1/admin.py
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select, update, func, or_, and_
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import Optional, List, Any, Literal
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, model_validator
import math

from app.database import get_db
from app.api.deps import get_current_superuser, get_current_platform_staff
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_rm_query import VendorRmQuery
from app.models.user_contact_change_request import UserContactChangeRequest
from app.models.vendor_plan import VendorPlan
from app.models.restaurant import RestaurantOrder, RestaurantKOT, RestaurantTable, RestaurantReservation
from app.models.pos import POSTransaction
from datetime import date, timedelta
from sqlalchemy import cast, Date, and_
from app.models.platform_setting import PlatformSetting
from app.models.platform_staff_audit import PlatformStaffAuditLog
from app.schemas.vendor import (
    VendorResponse,
    VendorListResponse,
    VendorCreate,
    VendorAdminResponse,
    VendorAdminListResponse,
    serialize_vendor_admin,
)
from app.services.vendor_service import VendorService
from app.repositories.vendor_repo import VendorRepository
from app.repositories.user_repo import UserRepository
from app.core.security import get_password_hash, create_vendor_handoff_token
from app.services.platform_staff_audit_service import (
    log_platform_staff_audit,
    ACTION_SUPPORT_ACCESS_CREATED,
    ACTION_SUPPORT_PROFILE_UPDATED,
    ACTION_SUPPORT_ACCESS_REMOVED,
    ACTION_SUPPORT_PASSWORD_RESET,
    ACTION_VENDOR_DASHBOARD_HANDOFF,
)
from app.utils.platform_staff import (
    PLATFORM_SUPPORT_ROLE,
    PLATFORM_JOB_ROLES,
    PLATFORM_JOB_ROLE_TEAM_MANAGER,
    PLATFORM_JOB_ROLE_RELATIONSHIP_MANAGER,
)
from app.utils.platform_vendor_access import (
    relationship_manager_list_scope,
    ensure_vendor_visible_to_platform_staff,
)

router = APIRouter()


async def _validate_relationship_manager_assignee(db: AsyncSession, user_id: Optional[UUID]) -> None:
    """FK target must be active superuser or platform support user with job_role relationship_manager."""
    if user_id is None:
        return
    result = await db.execute(select(User).where(User.id == user_id))
    assignee = result.scalar_one_or_none()
    if not assignee or not assignee.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Relationship manager user not found or inactive",
        )
    if assignee.is_superuser:
        return
    if getattr(assignee, "platform_staff_role", None) != PLATFORM_SUPPORT_ROLE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assigned user must be platform staff",
        )
    if getattr(assignee, "platform_staff_job_role", None) != PLATFORM_JOB_ROLE_RELATIONSHIP_MANAGER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assigned user must have job role relationship_manager (or be a superuser)",
        )


# ── Plan schemas ─────────────────────────────────────────────────────────────

class PlanResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    price_monthly: float
    price_yearly: Optional[float] = None
    currency: str = "INR"
    max_products: int = -1
    max_services: int = -1
    max_team_members: int = 1
    max_storage_mb: int = 1000
    features: dict = {}
    is_active: bool = True
    is_featured: bool = False
    sort_order: int = 0

    class Config:
        from_attributes = True


class PlanCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    price_monthly: float = Field(..., ge=0)
    price_yearly: Optional[float] = Field(None, ge=0)
    currency: str = "INR"
    max_products: int = -1
    max_services: int = -1
    max_team_members: int = 1
    max_storage_mb: int = 1000
    features: dict = {}
    is_active: bool = True
    is_featured: bool = False


class PlanUpdate(BaseModel):
    """Partial update; only sent fields are applied."""

    name: Optional[str] = Field(None, min_length=2, max_length=100)
    slug: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None
    price_monthly: Optional[float] = Field(None, ge=0)
    price_yearly: Optional[float] = Field(None, ge=0)
    currency: Optional[str] = Field(None, max_length=3)
    max_products: Optional[int] = Field(None, ge=-1)
    max_services: Optional[int] = Field(None, ge=-1)
    max_team_members: Optional[int] = Field(None, ge=1)
    max_storage_mb: Optional[int] = Field(None, ge=1)
    features: Optional[dict] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    sort_order: Optional[int] = None


class PlanFeaturesUpdate(BaseModel):
    features: dict


class AssignPlanRequest(BaseModel):
    plan_id: str


class AdminVendorUpdate(BaseModel):
    """Admin can update any vendor field including ones the vendor cannot change."""
    business_name: Optional[str] = Field(None, min_length=2, max_length=255)
    display_name: Optional[str] = Field(None, min_length=2, max_length=255)
    business_type: Optional[str] = None
    offering_type: Optional[str] = None
    industry: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=2000)
    primary_email: Optional[str] = None
    primary_phone: Optional[str] = Field(None, max_length=20)
    support_email: Optional[str] = None
    support_phone: Optional[str] = Field(None, max_length=20)
    street_address: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = Field(None, max_length=100)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    service_radius_km: Optional[int] = Field(None, ge=1, le=500)
    gstin: Optional[str] = Field(None, max_length=15)
    pan_number: Optional[str] = Field(None, max_length=10)
    is_gst_registered: Optional[bool] = None
    default_tax_rate: Optional[float] = Field(None, ge=0, le=100)
    status: Optional[str] = None
    relationship_manager_user_id: Optional[UUID] = Field(
        None,
        description="Platform user id (relationship_manager staff or superuser); null clears assignment",
    )
    external_domain_access_status: Optional[str] = Field(
        None,
        description="Admin-controlled domain access status: not_requested | pending | active | revoked",
    )


class AdminVendorCreate(BaseModel):
    """Admin creates a vendor AND the owner's login account in one step."""
    owner_email: Optional[str] = Field(None, description="Login email for the vendor owner (optional if phone is set)")
    owner_password: str = Field(..., min_length=6, max_length=128, description="Login password for the vendor owner")
    owner_name: str = Field(..., min_length=2, max_length=255)
    owner_phone: Optional[str] = None
    business_name: str = Field(..., min_length=2, max_length=255)
    display_name: str = Field(..., min_length=2, max_length=255)
    slug: str = Field(..., min_length=3, max_length=100)
    business_type: str = "individual"
    offering_type: str = "both"
    industry: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    primary_email: Optional[str] = None
    primary_phone: str = Field(..., min_length=10, max_length=20)
    street_address: str = Field(..., min_length=5, max_length=500)
    city: str = Field(..., min_length=2, max_length=100)
    state: str = Field(..., min_length=2, max_length=100)
    postal_code: str = Field(..., min_length=4, max_length=20)
    country: str = "India"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    service_radius_km: int = 10


@router.post("/vendors/create", status_code=201)
async def admin_create_vendor(
    body: AdminVendorCreate,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    """
    Platform staff creates a vendor AND the vendor owner's user account in one step.
    Returns the vendor data plus the owner's login credentials.
    """
    user_repo = UserRepository(db)

    owner_email = (body.owner_email or "").strip().lower() or None
    owner_phone = (body.owner_phone or "").strip() or None
    if not owner_email and not owner_phone:
        raise HTTPException(
            status_code=422,
            detail="Owner must have at least an email or phone for login.",
        )

    existing_user = None
    if owner_email:
        existing_user = await user_repo.get_by_email(owner_email)
    elif owner_phone:
        existing_user = await user_repo.get_by_phone(owner_phone)

    if existing_user:
        owner_user = existing_user
        user_created = False
    else:
        owner_user = User(
            email=owner_email,
            phone=owner_phone,
            password_hash=get_password_hash(body.owner_password),
            full_name=body.owner_name,
            is_active=True,
            is_email_verified=bool(owner_email),
            is_phone_verified=bool(owner_phone),
        )
        db.add(owner_user)
        await db.flush()
        user_created = True

    # Build VendorCreate schema
    from app.schemas.vendor import AddressCreate, BusinessType, OfferingType
    vendor_data = VendorCreate(
        business_name=body.business_name,
        display_name=body.display_name,
        slug=body.slug,
        business_type=BusinessType(body.business_type),
        offering_type=OfferingType(body.offering_type),
        industry=body.industry,
        description=body.description,
        primary_email=body.primary_email or owner_email,
        primary_phone=body.primary_phone,
        owner_name=body.owner_name,
        address=AddressCreate(
            street_address=body.street_address,
            city=body.city,
            state=body.state,
            postal_code=body.postal_code,
            country=body.country,
            latitude=body.latitude,
            longitude=body.longitude,
            service_radius_km=body.service_radius_km,
        ),
    )

    service = VendorService(db)
    vendor = await service.register(owner_user.id, vendor_data)

    return {
        "vendor": {
            "id": str(vendor.id),
            "business_name": vendor.business_name,
            "display_name": vendor.display_name,
            "slug": vendor.slug,
            "subdomain": vendor.subdomain,
            "status": vendor.status,
        },
        "owner_account": {
            "user_id": str(owner_user.id),
            "email": owner_email,
            "phone": owner_phone,
            "password": body.owner_password if user_created else "(existing account — password unchanged)",
            "full_name": body.owner_name,
            "user_created": user_created,
        },
        "message": (
            f"Vendor '{vendor.display_name}' created. "
            f"Owner can log in with: {owner_email or owner_phone}"
        ),
    }


@router.get("/vendors", response_model=VendorAdminListResponse)
async def list_vendors(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    search: Optional[str] = None,
    relationship_manager_user_id: Optional[UUID] = Query(
        None,
        description="Superusers only: restrict results to vendors assigned to this relationship manager user id.",
    ),
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    """List vendors; relationship managers only see vendors assigned to them."""
    repo = VendorRepository(db)
    skip = (page - 1) * size
    rm_scope = relationship_manager_list_scope(current_user)
    effective_rm_filter = rm_scope if rm_scope is not None else relationship_manager_user_id

    items, total = await repo.list_vendors(
        skip=skip,
        limit=size,
        status=status,
        search=search,
        relationship_manager_user_id=effective_rm_filter,
    )

    return VendorAdminListResponse(
        items=[serialize_vendor_admin(v) for v in items],
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total > 0 else 0,
    )


class AdminVendorStatsResponse(BaseModel):
    total: int
    approved: int
    pending_review: int


class VendorRmQueryAdminRow(BaseModel):
    id: str
    vendor_id: str
    vendor_display_name: Optional[str] = None
    created_by_user_id: str
    created_by_name: Optional[str] = None
    subject: str
    body: str
    status: str
    created_at: Optional[str] = None


class VendorRmQueryAdminListResponse(BaseModel):
    items: List[VendorRmQueryAdminRow]
    total: int
    page: int
    size: int
    pages: int


class VendorRmQueryStatusPatch(BaseModel):
    status: Literal["open", "in_progress", "closed"]


@router.get("/vendors/stats/summary", response_model=AdminVendorStatsResponse)
async def vendor_stats_summary(
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    """Dashboard KPIs without loading full vendor rows."""
    repo = VendorRepository(db)
    return await repo.get_admin_dashboard_stats()


class RelationshipManagerOption(BaseModel):
    id: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    login_display: str
    role_label: str


def _relationship_manager_role_label(is_superuser: bool, job_role: Optional[str]) -> str:
    if is_superuser:
        return "Super Admin"
    if job_role == PLATFORM_JOB_ROLE_RELATIONSHIP_MANAGER:
        return "Relationship manager"
    if job_role:
        return job_role.replace("_", " ").strip().title()
    return "Support"


@router.get("/vendors/relationship-manager-options", response_model=List[RelationshipManagerOption])
async def list_relationship_manager_options(
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    """Eligible relationship managers (superusers + support RMs) for directory filters."""
    stmt = (
        select(
            User.id,
            User.full_name,
            User.email,
            User.phone,
            User.is_superuser,
            User.platform_staff_job_role,
        )
        .where(
            User.is_active.is_(True),
            or_(
                User.is_superuser.is_(True),
                and_(
                    User.platform_staff_role == PLATFORM_SUPPORT_ROLE,
                    User.platform_staff_job_role == PLATFORM_JOB_ROLE_RELATIONSHIP_MANAGER,
                ),
            ),
        )
        .order_by(User.full_name)
    )
    result = await db.execute(stmt)
    out: List[RelationshipManagerOption] = []
    for uid, name, email, phone, is_super, job_role in result.all():
        e = (email or "").strip() or None
        p = (phone or "").strip() or None
        nm = (name or "").strip()
        login_display = e or p or nm or str(uid)
        role_label = _relationship_manager_role_label(bool(is_super), job_role)
        out.append(
            RelationshipManagerOption(
                id=str(uid),
                full_name=nm,
                email=e,
                phone=p,
                login_display=login_display,
                role_label=role_label,
            )
        )
    return out


@router.get("/vendors/{vendor_id}", response_model=VendorAdminResponse)
async def get_vendor(
    vendor_id: UUID,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    """Get vendor details (platform staff)."""
    repo = VendorRepository(db)
    vendor = await repo.get_by_id(vendor_id)

    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )

    await ensure_vendor_visible_to_platform_staff(current_user, vendor)

    return serialize_vendor_admin(vendor)


class VendorDashboardHandoffResponse(BaseModel):
    handoff_token: str
    vendor_id: str
    vendor_slug: str


@router.post("/vendors/{vendor_id}/dashboard-handoff", response_model=VendorDashboardHandoffResponse)
async def create_vendor_dashboard_handoff(
    vendor_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    """
    Issue a short-lived token for opening vendor-web (central app) as this platform user,
    scoped to the given vendor. Logged in platform staff audit and vendor platform audit on redeem.
    """
    vendor = await db.get(Vendor, vendor_id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )
    await ensure_vendor_visible_to_platform_staff(current_user, vendor)
    token = create_vendor_handoff_token(current_user.id, vendor_id)
    await log_platform_staff_audit(
        db,
        subject_user_id=current_user.id,
        actor_user_id=current_user.id,
        action=ACTION_VENDOR_DASHBOARD_HANDOFF,
        detail={"vendor_id": str(vendor_id), "slug": vendor.slug},
        request=request,
    )
    await db.commit()
    return VendorDashboardHandoffResponse(
        handoff_token=token,
        vendor_id=str(vendor_id),
        vendor_slug=vendor.slug or "",
    )


@router.get("/vendors/{vendor_id}/restaurant-snapshot")
async def admin_restaurant_snapshot(
    vendor_id: UUID,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """Read-only restaurant ops snapshot for platform support."""
    vendor = await db.get(Vendor, vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    today = date.today()
    vid = vendor_id

    open_orders = (await db.execute(
        select(func.count(RestaurantOrder.id))
        .where(and_(
            RestaurantOrder.vendor_id == vid,
            RestaurantOrder.status.in_(["open", "billed"]),
            cast(RestaurantOrder.created_at, Date) == today,
        ))
    )).scalar_one()

    total_covers = (await db.execute(
        select(func.coalesce(func.sum(RestaurantOrder.covers), 0))
        .where(and_(
            RestaurantOrder.vendor_id == vid,
            cast(RestaurantOrder.created_at, Date) == today,
        ))
    )).scalar_one()

    restaurant_revenue = (await db.execute(
        select(func.coalesce(func.sum(POSTransaction.total), 0))
        .where(and_(
            POSTransaction.vendor_id == vid,
            POSTransaction.transaction_type == "sale",
            POSTransaction.restaurant_table_id.isnot(None),
            cast(POSTransaction.created_at, Date) == today,
        ))
    )).scalar_one()

    kot_status_rows = (await db.execute(
        select(RestaurantKOT.status, func.count(RestaurantKOT.id).label("cnt"))
        .where(and_(
            RestaurantKOT.vendor_id == vid,
            cast(RestaurantKOT.created_at, Date) == today,
        ))
        .group_by(RestaurantKOT.status)
    )).all()

    table_status_rows = (await db.execute(
        select(RestaurantTable.status, func.count(RestaurantTable.id).label("cnt"))
        .where(and_(RestaurantTable.vendor_id == vid, RestaurantTable.is_active == True))
        .group_by(RestaurantTable.status)
    )).all()

    upcoming_reservations = (await db.execute(
        select(func.count(RestaurantReservation.id))
        .where(and_(
            RestaurantReservation.vendor_id == vid,
            RestaurantReservation.reservation_date >= today,
            RestaurantReservation.reservation_date <= today + timedelta(days=7),
            RestaurantReservation.status.in_(["pending", "confirmed"]),
        ))
    )).scalar_one()

    active_kots = (await db.execute(
        select(func.count(RestaurantKOT.id))
        .where(and_(
            RestaurantKOT.vendor_id == vid,
            RestaurantKOT.status.in_(["new", "preparing", "ready"]),
        ))
    )).scalar_one()

    settings = vendor.settings or {}
    module_on = settings.get("restaurant_enabled") is not False and vendor.offering_type in (
        "products",
        "both",
        None,
    )

    return JSONResponse(content={
        "vendor_id": str(vendor_id),
        "module_enabled": module_on,
        "today": {
            "open_orders": int(open_orders or 0),
            "total_covers": int(total_covers or 0),
            "restaurant_revenue": float(restaurant_revenue or 0),
            "active_kots": int(active_kots or 0),
        },
        "kots_by_status": {r.status: r.cnt for r in kot_status_rows},
        "tables_by_status": {r.status: r.cnt for r in table_status_rows},
        "upcoming_reservations": int(upcoming_reservations or 0),
    })


@router.put("/vendors/{vendor_id}", response_model=VendorAdminResponse)
async def update_vendor(
    vendor_id: UUID,
    body: AdminVendorUpdate,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """Update vendor details (superuser). Only provided fields are updated."""
    repo = VendorRepository(db)
    vendor = await repo.get_by_id(vendor_id)

    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )

    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )

    if "relationship_manager_user_id" in update_data:
        await _validate_relationship_manager_assignee(
            db, update_data["relationship_manager_user_id"]
        )

    for field, value in update_data.items():
        setattr(vendor, field, value)

    await db.commit()
    await db.refresh(vendor)
    vendor = await repo.get_by_id(vendor_id)
    return serialize_vendor_admin(vendor)


@router.get("/vendor-rm-queries", response_model=VendorRmQueryAdminListResponse)
async def list_vendor_rm_queries(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    vendor_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    """List vendor questions to their relationship manager (scoped for RM staff)."""
    rm_scope = relationship_manager_list_scope(current_user)

    filters = []
    if rm_scope is not None:
        filters.append(Vendor.relationship_manager_user_id == rm_scope)
    if vendor_id is not None:
        filters.append(VendorRmQuery.vendor_id == vendor_id)
    if status_filter:
        filters.append(VendorRmQuery.status == status_filter)

    count_stmt = (
        select(func.count())
        .select_from(VendorRmQuery)
        .join(Vendor, VendorRmQuery.vendor_id == Vendor.id)
    )
    list_stmt = (
        select(VendorRmQuery)
        .join(Vendor, VendorRmQuery.vendor_id == Vendor.id)
        .options(
            selectinload(VendorRmQuery.vendor),
            selectinload(VendorRmQuery.created_by),
        )
    )
    for f in filters:
        count_stmt = count_stmt.where(f)
        list_stmt = list_stmt.where(f)

    total = (await db.execute(count_stmt)).scalar_one()
    skip = (page - 1) * size
    list_stmt = list_stmt.order_by(VendorRmQuery.created_at.desc()).offset(skip).limit(size)
    rows = list((await db.execute(list_stmt)).scalars().all())

    items: List[VendorRmQueryAdminRow] = []
    for r in rows:
        v = r.vendor
        cb = r.created_by
        items.append(
            VendorRmQueryAdminRow(
                id=str(r.id),
                vendor_id=str(r.vendor_id),
                vendor_display_name=v.display_name if v else None,
                created_by_user_id=str(r.created_by_user_id),
                created_by_name=(cb.full_name or "").strip() if cb else None,
                subject=r.subject,
                body=r.body,
                status=r.status,
                created_at=r.created_at.isoformat() if r.created_at else None,
            )
        )

    return VendorRmQueryAdminListResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total > 0 else 0,
    )


@router.patch("/vendor-rm-queries/{query_id}", response_model=VendorRmQueryAdminRow)
async def patch_vendor_rm_query_status(
    query_id: UUID,
    body: VendorRmQueryStatusPatch,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(VendorRmQuery)
        .where(VendorRmQuery.id == query_id)
        .options(selectinload(VendorRmQuery.vendor), selectinload(VendorRmQuery.created_by))
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Query not found")
    vendor = row.vendor
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")

    await ensure_vendor_visible_to_platform_staff(current_user, vendor)

    row.status = body.status
    await db.commit()
    await db.refresh(row)
    cb = row.created_by
    return VendorRmQueryAdminRow(
        id=str(row.id),
        vendor_id=str(row.vendor_id),
        vendor_display_name=vendor.display_name,
        created_by_user_id=str(row.created_by_user_id),
        created_by_name=(cb.full_name or "").strip() if cb else None,
        subject=row.subject,
        body=row.body,
        status=row.status,
        created_at=row.created_at.isoformat() if row.created_at else None,
    )


class UserContactChangeAdminRow(BaseModel):
    id: str
    user_id: str
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    vendor_id: str
    vendor_display_name: Optional[str] = None
    field_type: str
    current_value: str
    requested_value: str
    reason: Optional[str] = None
    status: str
    review_notes: Optional[str] = None
    created_at: Optional[str] = None
    resolved_at: Optional[str] = None


class UserContactChangeAdminListResponse(BaseModel):
    items: List[UserContactChangeAdminRow]
    total: int
    page: int
    size: int
    pages: int


class UserContactChangeReviewPatch(BaseModel):
    action: Literal["approve", "reject"]
    review_notes: Optional[str] = Field(None, max_length=2000)


@router.get("/user-contact-change-requests", response_model=UserContactChangeAdminListResponse)
async def list_user_contact_change_requests(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    vendor_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    rm_scope = relationship_manager_list_scope(current_user)
    filters = []
    if rm_scope is not None:
        filters.append(Vendor.relationship_manager_user_id == rm_scope)
    if vendor_id is not None:
        filters.append(UserContactChangeRequest.vendor_id == vendor_id)
    if status_filter:
        filters.append(UserContactChangeRequest.status == status_filter)

    count_stmt = (
        select(func.count())
        .select_from(UserContactChangeRequest)
        .join(Vendor, UserContactChangeRequest.vendor_id == Vendor.id)
        .join(User, UserContactChangeRequest.user_id == User.id)
    )
    list_stmt = (
        select(UserContactChangeRequest)
        .join(Vendor, UserContactChangeRequest.vendor_id == Vendor.id)
        .join(User, UserContactChangeRequest.user_id == User.id)
        .options(
            selectinload(UserContactChangeRequest.vendor),
            selectinload(UserContactChangeRequest.user),
        )
    )
    for f in filters:
        count_stmt = count_stmt.where(f)
        list_stmt = list_stmt.where(f)

    total = (await db.execute(count_stmt)).scalar_one()
    skip = (page - 1) * size
    list_stmt = (
        list_stmt.order_by(UserContactChangeRequest.created_at.desc())
        .offset(skip)
        .limit(size)
    )
    rows = list((await db.execute(list_stmt)).scalars().all())

    items: List[UserContactChangeAdminRow] = []
    for r in rows:
        u = r.user
        v = r.vendor
        items.append(
            UserContactChangeAdminRow(
                id=str(r.id),
                user_id=str(r.user_id),
                user_name=(u.full_name or "").strip() if u else None,
                user_email=u.email if u else None,
                vendor_id=str(r.vendor_id),
                vendor_display_name=v.display_name if v else None,
                field_type=r.field_type,
                current_value=r.current_value,
                requested_value=r.requested_value,
                reason=r.reason,
                status=r.status,
                review_notes=r.review_notes,
                created_at=r.created_at.isoformat() if r.created_at else None,
                resolved_at=r.resolved_at.isoformat() if r.resolved_at else None,
            )
        )

    return UserContactChangeAdminListResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total > 0 else 0,
    )


@router.patch("/user-contact-change-requests/{request_id}", response_model=UserContactChangeAdminRow)
async def review_user_contact_change_request(
    request_id: UUID,
    body: UserContactChangeReviewPatch,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    from app.api.v1.vendor_contact_change import apply_contact_change_request

    result = await db.execute(
        select(UserContactChangeRequest)
        .where(UserContactChangeRequest.id == request_id)
        .options(
            selectinload(UserContactChangeRequest.vendor),
            selectinload(UserContactChangeRequest.user),
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    vendor = row.vendor
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")

    await ensure_vendor_visible_to_platform_staff(current_user, vendor)

    row = await apply_contact_change_request(
        db,
        row,
        current_user,
        approve=body.action == "approve",
        review_notes=body.review_notes,
    )
    u = await db.get(User, row.user_id)
    return UserContactChangeAdminRow(
        id=str(row.id),
        user_id=str(row.user_id),
        user_name=(u.full_name or "").strip() if u else None,
        user_email=u.email if u else None,
        vendor_id=str(row.vendor_id),
        vendor_display_name=vendor.display_name,
        field_type=row.field_type,
        current_value=row.current_value,
        requested_value=row.requested_value,
        reason=row.reason,
        status=row.status,
        review_notes=row.review_notes,
        created_at=row.created_at.isoformat() if row.created_at else None,
        resolved_at=row.resolved_at.isoformat() if row.resolved_at else None,
    )


class CreateOwnerAccountRequest(BaseModel):
    email: str = Field(..., description="Login email for the new owner account")
    password: str = Field(..., min_length=6, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=255)
    phone: Optional[str] = None


@router.post("/vendors/{vendor_id}/create-owner-account")
async def create_owner_account_for_vendor(
    vendor_id: UUID,
    body: CreateOwnerAccountRequest,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a user account for an existing vendor that doesn't have a proper owner login.
    Re-links VendorOwner and VendorUser records to the new user.
    """
    from app.models.vendor import VendorOwner
    from app.models.vendor_user import VendorUser as VU

    repo = VendorRepository(db)
    vendor = await repo.get_by_id(vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    user_repo = UserRepository(db)
    existing = await user_repo.get_by_email(body.email)
    if existing:
        new_user = existing
        user_created = False
    else:
        new_user = User(
            email=body.email,
            phone=body.phone,
            password_hash=get_password_hash(body.password),
            full_name=body.full_name,
            is_active=True,
            is_email_verified=True,
        )
        db.add(new_user)
        await db.flush()
        user_created = True

    # Update VendorOwner to point to the new user
    owner_result = await db.execute(
        select(VendorOwner).where(
            VendorOwner.vendor_id == vendor_id,
            VendorOwner.is_primary == True,
        )
    )
    owner = owner_result.scalar_one_or_none()
    if owner:
        owner.user_id = new_user.id
        owner.full_name = body.full_name
        owner.email = body.email
        owner.phone = body.phone
    else:
        owner = VendorOwner(
            vendor_id=vendor_id,
            user_id=new_user.id,
            full_name=body.full_name,
            email=body.email,
            phone=body.phone,
            is_primary=True,
        )
        db.add(owner)

    # Update or create VendorUser entry
    vu_result = await db.execute(
        select(VU).where(VU.vendor_id == vendor_id, VU.role == "owner")
    )
    vu = vu_result.scalar_one_or_none()
    if vu:
        vu.user_id = new_user.id
    else:
        vu = VU(
            vendor_id=vendor_id,
            user_id=new_user.id,
            role="owner",
            permissions=[],
            is_active=True,
        )
        db.add(vu)

    await db.commit()

    return {
        "vendor_id": str(vendor_id),
        "vendor_name": vendor.display_name,
        "owner_account": {
            "user_id": str(new_user.id),
            "email": body.email,
            "password": body.password if user_created else "(existing account — password unchanged)",
            "full_name": body.full_name,
            "user_created": user_created,
        },
        "message": f"Owner account linked. Login with: {body.email}",
    }


@router.get("/vendors/{vendor_id}/owner")
async def get_vendor_owner(
    vendor_id: UUID,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    """Get the vendor owner's user account info."""
    from app.models.vendor import VendorOwner

    repo = VendorRepository(db)
    vendor = await repo.get_by_id(vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    await ensure_vendor_visible_to_platform_staff(current_user, vendor)

    result = await db.execute(
        select(VendorOwner).where(
            VendorOwner.vendor_id == vendor_id,
            VendorOwner.is_primary == True,
        )
    )
    owner = result.scalar_one_or_none()
    if not owner:
        raise HTTPException(status_code=404, detail="Owner not found")

    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(owner.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Owner user account not found")

    return {
        "user_id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "is_active": user.is_active,
        "is_email_verified": user.is_email_verified,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.put("/vendors/{vendor_id}/approve", response_model=VendorResponse)
async def approve_vendor(
    vendor_id: UUID,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """Approve a vendor (admin only)."""
    service = VendorService(db)
    return await service.approve_vendor(vendor_id, current_user.id)


@router.put("/vendors/{vendor_id}/reject", response_model=VendorResponse)
async def reject_vendor(
    vendor_id: UUID,
    reason: str = Query(..., min_length=10),
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """Reject a vendor (admin only)."""
    service = VendorService(db)
    return await service.reject_vendor(vendor_id, current_user.id, reason)


@router.delete("/vendors/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vendor(
    vendor_id: UUID,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a business account and its owner login when they have no other stores."""
    service = VendorService(db)
    await service.delete_vendor(vendor_id, current_user.id)


# ── Plan Management ──────────────────────────────────────────────────────────

@router.get("/plans")
async def list_plans(
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    """List all vendor plans."""
    result = await db.execute(select(VendorPlan).order_by(VendorPlan.sort_order))
    plans = result.scalars().all()
    return [
        PlanResponse(
            id=str(p.id), name=p.name, slug=p.slug,
            description=p.description,
            price_monthly=float(p.price_monthly),
            price_yearly=float(p.price_yearly) if p.price_yearly else None,
            currency=p.currency or "INR",
            max_products=p.max_products, max_services=p.max_services,
            max_team_members=p.max_team_members, max_storage_mb=p.max_storage_mb,
            features=p.features or {},
            is_active=p.is_active, is_featured=p.is_featured,
            sort_order=p.sort_order,
        )
        for p in plans
    ]


@router.post("/plans", status_code=201)
async def create_plan(
    body: PlanCreate,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """Create a new vendor plan."""
    plan = VendorPlan(
        name=body.name, slug=body.slug, description=body.description,
        price_monthly=body.price_monthly, price_yearly=body.price_yearly,
        currency=body.currency,
        max_products=body.max_products, max_services=body.max_services,
        max_team_members=body.max_team_members, max_storage_mb=body.max_storage_mb,
        features=body.features,
        is_active=body.is_active, is_featured=body.is_featured,
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return PlanResponse(
        id=str(plan.id), name=plan.name, slug=plan.slug,
        description=plan.description,
        price_monthly=float(plan.price_monthly),
        price_yearly=float(plan.price_yearly) if plan.price_yearly else None,
        currency=plan.currency or "INR",
        max_products=plan.max_products, max_services=plan.max_services,
        max_team_members=plan.max_team_members, max_storage_mb=plan.max_storage_mb,
        features=plan.features or {},
        is_active=plan.is_active, is_featured=plan.is_featured,
        sort_order=plan.sort_order,
    )


@router.put("/plans/{plan_id}", response_model=PlanResponse)
async def update_plan(
    plan_id: UUID,
    body: PlanUpdate,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing vendor plan (partial)."""
    result = await db.execute(select(VendorPlan).where(VendorPlan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    new_slug = update_data.get("slug")
    if new_slug is not None and new_slug != plan.slug:
        taken = await db.execute(
            select(VendorPlan.id).where(VendorPlan.slug == new_slug, VendorPlan.id != plan_id)
        )
        if taken.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Slug already in use")

    for field, value in update_data.items():
        setattr(plan, field, value)

    await db.commit()
    await db.refresh(plan)

    return PlanResponse(
        id=str(plan.id),
        name=plan.name,
        slug=plan.slug,
        description=plan.description,
        price_monthly=float(plan.price_monthly),
        price_yearly=float(plan.price_yearly) if plan.price_yearly else None,
        currency=plan.currency or "INR",
        max_products=plan.max_products,
        max_services=plan.max_services,
        max_team_members=plan.max_team_members,
        max_storage_mb=plan.max_storage_mb,
        features=plan.features or {},
        is_active=plan.is_active,
        is_featured=plan.is_featured,
        sort_order=plan.sort_order,
    )


@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(
    plan_id: UUID,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """Delete a plan. Vendors assigned to this plan have plan_id cleared."""
    result = await db.execute(select(VendorPlan).where(VendorPlan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    await db.execute(update(Vendor).where(Vendor.plan_id == plan_id).values(plan_id=None))
    await db.delete(plan)
    await db.commit()
    return None


@router.put("/plans/{plan_id}/features")
async def update_plan_features(
    plan_id: UUID,
    body: PlanFeaturesUpdate,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """Update a plan's feature flags (merge with existing)."""
    result = await db.execute(select(VendorPlan).where(VendorPlan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    current_features = dict(plan.features or {})
    current_features.update(body.features)
    plan.features = current_features
    await db.commit()
    await db.refresh(plan)

    return {"id": str(plan.id), "name": plan.name, "features": plan.features}


# ── Assign Plan to Vendor ────────────────────────────────────────────────────

@router.put("/vendors/{vendor_id}/plan")
async def assign_plan_to_vendor(
    vendor_id: UUID,
    body: AssignPlanRequest,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """Assign a plan to a vendor."""
    repo = VendorRepository(db)
    vendor = await repo.get_by_id(vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    plan_result = await db.execute(
        select(VendorPlan).where(VendorPlan.id == UUID(body.plan_id))
    )
    plan = plan_result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    vendor.plan_id = plan.id
    await db.commit()
    await db.refresh(vendor)

    return {
        "vendor_id": str(vendor.id),
        "vendor_name": vendor.display_name,
        "plan_id": str(plan.id),
        "plan_name": plan.name,
        "features": plan.features,
    }


@router.get("/vendors/{vendor_id}/plan")
async def get_vendor_plan(
    vendor_id: UUID,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    """Get a vendor's current plan details."""
    repo = VendorRepository(db)
    vendor = await repo.get_by_id(vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    if not vendor.plan_id:
        return {"vendor_id": str(vendor.id), "plan": None, "message": "No plan assigned"}

    plan_result = await db.execute(
        select(VendorPlan).where(VendorPlan.id == vendor.plan_id)
    )
    plan = plan_result.scalar_one_or_none()
    if not plan:
        return {"vendor_id": str(vendor.id), "plan": None, "message": "Plan not found"}

    return {
        "vendor_id": str(vendor.id),
        "plan": PlanResponse(
            id=str(plan.id), name=plan.name, slug=plan.slug,
            description=plan.description,
            price_monthly=float(plan.price_monthly),
            price_yearly=float(plan.price_yearly) if plan.price_yearly else None,
            currency=plan.currency or "INR",
            max_products=plan.max_products, max_services=plan.max_services,
            max_team_members=plan.max_team_members, max_storage_mb=plan.max_storage_mb,
            features=plan.features or {},
            is_active=plan.is_active, is_featured=plan.is_featured,
            sort_order=plan.sort_order,
        ),
    }


# ── Platform Settings ─────────────────────────────────────────────────────────

class PlatformSettingsPayload(BaseModel):
    """Arbitrary key-value pairs to upsert into platform_setting."""
    settings: dict[str, Any]


@router.get("/platform-settings")
async def get_platform_settings(
    _: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """Return all platform-level settings as a flat dict (superuser only)."""
    result = await db.execute(select(PlatformSetting))
    rows = result.scalars().all()
    return {row.key: row.value for row in rows}


@router.put("/platform-settings")
async def update_platform_settings(
    payload: PlatformSettingsPayload,
    _: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """Upsert platform-level settings (superuser only). Null values delete the key."""
    for key, value in payload.settings.items():
        if value is None:
            # Delete the key
            row = await db.get(PlatformSetting, key)
            if row:
                await db.delete(row)
        else:
            stmt = (
                pg_insert(PlatformSetting)
                .values(key=key, value=str(value))
                .on_conflict_do_update(
                    index_elements=["key"],
                    set_={"value": str(value)},
                )
            )
            await db.execute(stmt)
    await db.commit()
    # Return updated settings
    result = await db.execute(select(PlatformSetting))
    rows = result.scalars().all()
    return {row.key: row.value for row in rows}


# ── Platform support staff (superuser manages; support can sign in to admin app) ──


async def _validate_platform_staff_manager_assignment(
    db: AsyncSession,
    *,
    job_role: str,
    manager_id: Optional[UUID],
    subject_user_id: Optional[UUID],
) -> None:
    if job_role not in PLATFORM_JOB_ROLES:
        raise HTTPException(status_code=422, detail="Invalid job_role.")
    if job_role == PLATFORM_JOB_ROLE_TEAM_MANAGER:
        if manager_id is not None:
            raise HTTPException(
                status_code=422,
                detail="Team managers cannot have a manager assigned.",
            )
        return
    if manager_id is None:
        return
    if subject_user_id is not None and manager_id == subject_user_id:
        raise HTTPException(status_code=422, detail="A user cannot be assigned as their own manager.")
    mgr = await db.get(User, manager_id)
    if not mgr or mgr.platform_staff_role != PLATFORM_SUPPORT_ROLE:
        raise HTTPException(status_code=422, detail="Manager must be an active platform support user.")
    if getattr(mgr, "platform_staff_job_role", None) != PLATFORM_JOB_ROLE_TEAM_MANAGER:
        raise HTTPException(status_code=422, detail="Manager must have the team manager job role.")


async def _platform_staff_manager_name_map(db: AsyncSession, rows: List[User]) -> dict:
    ids = {
        r.platform_staff_manager_id
        for r in rows
        if getattr(r, "platform_staff_manager_id", None) is not None
    }
    if not ids:
        return {}
    res = await db.execute(select(User.id, User.full_name).where(User.id.in_(ids)))
    return {uid: name for uid, name in res.all()}


async def _relationship_manager_vendor_counts(
    db: AsyncSession, user_ids: List[UUID]
) -> dict:
    """Count vendors per user where that user is assigned relationship manager."""
    if not user_ids:
        return {}
    stmt = (
        select(Vendor.relationship_manager_user_id, func.count())
        .where(Vendor.relationship_manager_user_id.in_(user_ids))
        .group_by(Vendor.relationship_manager_user_id)
    )
    rows = (await db.execute(stmt)).all()
    return {uid: int(n) for uid, n in rows}


def _platform_staff_member_response(
    u: User,
    manager_names: dict,
    rm_counts: Optional[dict] = None,
) -> "PlatformStaffMemberResponse":
    mid = getattr(u, "platform_staff_manager_id", None)
    cnt = int(rm_counts.get(u.id, 0)) if rm_counts is not None else 0
    return PlatformStaffMemberResponse(
        id=str(u.id),
        email=u.email,
        phone=u.phone,
        full_name=u.full_name,
        is_active=bool(u.is_active),
        created_at=u.created_at.isoformat() if u.created_at else None,
        job_role=getattr(u, "platform_staff_job_role", None),
        manager_id=str(mid) if mid else None,
        manager_name=manager_names.get(mid) if mid else None,
        assigned_business_account_count=cnt,
    )


class PlatformStaffMemberResponse(BaseModel):
    id: str
    email: Optional[str] = None
    phone: Optional[str] = None
    full_name: str
    is_active: bool
    created_at: Optional[str] = None
    job_role: Optional[str] = None
    manager_id: Optional[str] = None
    manager_name: Optional[str] = None
    assigned_business_account_count: int = 0


class PlatformStaffCreateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=24)
    job_role: str = Field(..., min_length=3, max_length=32)
    manager_id: Optional[UUID] = None

    @model_validator(mode="after")
    def require_email_or_phone(self):
        has_email = self.email is not None and str(self.email).strip() != ""
        has_phone = self.phone is not None and str(self.phone).strip() != ""
        if not has_email and not has_phone:
            raise ValueError("Either email or phone is required")
        return self


class PlatformStaffUpdateRequest(BaseModel):
    is_active: Optional[bool] = None
    remove_access: bool = False
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=24)
    job_role: Optional[str] = Field(None, min_length=3, max_length=32)
    manager_id: Optional[UUID] = None


class PlatformStaffResetPasswordRequest(BaseModel):
    password: str = Field(..., min_length=6, max_length=128)


class PlatformStaffAuditEntryResponse(BaseModel):
    id: str
    action: str
    detail: Optional[dict] = None
    actor_user_id: Optional[str] = None
    actor_full_name: Optional[str] = None
    ip: Optional[str] = None
    created_at: str


class PlatformStaffAuditListResponse(BaseModel):
    items: List[PlatformStaffAuditEntryResponse]
    total: int
    page: int
    size: int
    pages: int


def _platform_staff_audit_snapshot(u: User) -> dict:
    mid = getattr(u, "platform_staff_manager_id", None)
    return {
        "is_active": u.is_active,
        "full_name": u.full_name,
        "email": u.email,
        "phone": u.phone,
        "job_role": getattr(u, "platform_staff_job_role", None),
        "manager_id": str(mid) if mid else None,
        "has_support_access": u.platform_staff_role == PLATFORM_SUPPORT_ROLE,
    }


def _platform_staff_audit_diff(before: dict, after: dict) -> dict:
    changes: dict = {}
    for k in before:
        if before[k] != after.get(k):
            changes[k] = {"before": before[k], "after": after[k]}
    return changes


async def _platform_staff_audit_page(
    db: AsyncSession,
    *,
    subject_user_id: UUID,
    page: int,
    size: int,
) -> PlatformStaffAuditListResponse:
    page = max(1, page)
    size = min(max(1, size), 100)
    offset = (page - 1) * size
    count_stmt = (
        select(func.count())
        .select_from(PlatformStaffAuditLog)
        .where(PlatformStaffAuditLog.subject_user_id == subject_user_id)
    )
    total = int((await db.execute(count_stmt)).scalar_one() or 0)
    stmt = (
        select(PlatformStaffAuditLog)
        .where(PlatformStaffAuditLog.subject_user_id == subject_user_id)
        .order_by(PlatformStaffAuditLog.created_at.desc())
        .offset(offset)
        .limit(size)
    )
    rows = (await db.execute(stmt)).scalars().all()
    actor_ids = {r.actor_user_id for r in rows if r.actor_user_id}
    actor_names: dict = {}
    if actor_ids:
        res = await db.execute(select(User.id, User.full_name).where(User.id.in_(actor_ids)))
        actor_names = {uid: name for uid, name in res.all()}
    items: List[PlatformStaffAuditEntryResponse] = []
    for r in rows:
        aid = r.actor_user_id
        items.append(
            PlatformStaffAuditEntryResponse(
                id=str(r.id),
                action=r.action,
                detail=r.detail if isinstance(r.detail, dict) else None,
                actor_user_id=str(aid) if aid else None,
                actor_full_name=actor_names.get(aid) if aid else None,
                ip=r.ip,
                created_at=r.created_at.isoformat() if r.created_at else "",
            )
        )
    pages = math.ceil(total / size) if total > 0 else 1
    return PlatformStaffAuditListResponse(
        items=items, total=total, page=page, size=size, pages=pages
    )


@router.get("/platform-staff/me/audit-log", response_model=PlatformStaffAuditListResponse)
async def list_my_platform_staff_audit_log(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    """Support users (and superusers) see their own platform audit timeline."""
    return await _platform_staff_audit_page(
        db, subject_user_id=current_user.id, page=page, size=size
    )


@router.get("/platform-staff/{user_id}/audit-log", response_model=PlatformStaffAuditListResponse)
async def list_platform_staff_member_audit_log(
    user_id: UUID,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """Superuser: audit history for a given user id (typically a support team member)."""
    if await db.get(User, user_id) is None:
        raise HTTPException(status_code=404, detail="User not found")
    return await _platform_staff_audit_page(db, subject_user_id=user_id, page=page, size=size)


@router.get("/platform-staff", response_model=List[PlatformStaffMemberResponse])
async def list_platform_staff_members(
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User)
        .where(User.platform_staff_role == PLATFORM_SUPPORT_ROLE)
        .order_by(User.created_at.desc())
    )
    rows = result.scalars().all()
    mgr_names = await _platform_staff_manager_name_map(db, rows)
    ids = [r.id for r in rows]
    rm_counts = await _relationship_manager_vendor_counts(db, ids)
    return [_platform_staff_member_response(r, mgr_names, rm_counts) for r in rows]


@router.post("/platform-staff", response_model=PlatformStaffMemberResponse, status_code=201)
async def create_platform_staff_member(
    body: PlatformStaffCreateRequest,
    request: Request,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    user_repo = UserRepository(db)
    email_norm = str(body.email).strip().lower() if body.email else None
    phone_norm = (body.phone or "").strip() or None

    job_role = body.job_role.strip().lower()
    if job_role not in PLATFORM_JOB_ROLES:
        raise HTTPException(status_code=422, detail="Invalid job_role.")
    mgr_id: Optional[UUID] = body.manager_id
    if job_role == PLATFORM_JOB_ROLE_TEAM_MANAGER:
        mgr_id = None

    existing: Optional[User] = None
    if email_norm:
        matches = await user_repo.list_users_by_email_ci(email_norm)
        if len(matches) > 1:
            raise HTTPException(
                status_code=400,
                detail="Multiple users share this email — resolve duplicates before adding support access.",
            )
        existing = matches[0] if matches else None
    if existing is None and phone_norm:
        matches = await user_repo.list_users_by_phone(phone_norm)
        if len(matches) > 1:
            raise HTTPException(
                status_code=400,
                detail="Multiple users share this phone — resolve duplicates before adding support access.",
            )
        existing = matches[0] if matches else None

    converted_existing = existing is not None

    if existing:
        if existing.is_superuser:
            raise HTTPException(status_code=400, detail="User is already a super administrator.")
        await _validate_platform_staff_manager_assignment(
            db,
            job_role=job_role,
            manager_id=mgr_id,
            subject_user_id=existing.id,
        )
        existing.platform_staff_role = PLATFORM_SUPPORT_ROLE
        existing.platform_staff_job_role = job_role
        existing.platform_staff_manager_id = mgr_id
        existing.password_hash = get_password_hash(body.password)
        existing.full_name = body.full_name
        if email_norm:
            existing.email = email_norm
        if phone_norm:
            existing.phone = phone_norm
        existing.is_active = True
        if email_norm:
            existing.is_email_verified = True
        if phone_norm:
            existing.is_phone_verified = True
        await db.commit()
        await db.refresh(existing)
        u = existing
    else:
        u = User(
            email=email_norm,
            phone=phone_norm,
            password_hash=get_password_hash(body.password),
            full_name=body.full_name,
            is_active=True,
            is_superuser=False,
            platform_staff_role=PLATFORM_SUPPORT_ROLE,
            platform_staff_job_role=job_role,
            platform_staff_manager_id=mgr_id,
            is_email_verified=bool(email_norm),
            is_phone_verified=bool(phone_norm),
        )
        db.add(u)
        await db.flush()
        await _validate_platform_staff_manager_assignment(
            db,
            job_role=job_role,
            manager_id=mgr_id,
            subject_user_id=u.id,
        )
        await db.commit()
        await db.refresh(u)

    await log_platform_staff_audit(
        db,
        subject_user_id=u.id,
        actor_user_id=current_user.id,
        action=ACTION_SUPPORT_ACCESS_CREATED,
        detail={
            "job_role": job_role,
            "manager_id": str(mgr_id) if mgr_id else None,
            "converted_existing_user": converted_existing,
        },
        request=request,
    )
    await db.commit()

    mgr_names = await _platform_staff_manager_name_map(db, [u])
    rm_counts = await _relationship_manager_vendor_counts(db, [u.id])
    return _platform_staff_member_response(u, mgr_names, rm_counts)


async def _apply_platform_staff_contact_updates(
    db: AsyncSession,
    user_repo: UserRepository,
    u: User,
    *,
    data: dict,
    body: PlatformStaffUpdateRequest,
) -> None:
    """Mutates email/phone/full_name on ``u``; raises HTTPException on conflicts or missing login id."""
    if body.full_name is not None:
        fn = body.full_name.strip()
        if len(fn) < 2:
            raise HTTPException(status_code=422, detail="full_name must be at least 2 characters.")
        u.full_name = fn

    new_email = u.email
    new_phone = u.phone
    if "email" in data:
        raw = body.email
        if raw is None or (isinstance(raw, str) and not str(raw).strip()):
            new_email = None
        else:
            new_email = str(raw).strip().lower()
    if "phone" in data:
        raw = body.phone
        if raw is None or (isinstance(raw, str) and not str(raw).strip()):
            new_phone = None
        else:
            new_phone = str(raw).strip()

    if "email" in data or "phone" in data:
        if not new_email and not new_phone:
            raise HTTPException(
                status_code=422,
                detail="Support user must keep at least one of email or phone for sign-in.",
            )

    if "email" in data and new_email != u.email:
        if new_email:
            matches = await user_repo.list_users_by_email_ci(new_email)
            others = [x for x in matches if x.id != u.id]
            if len(others) > 1:
                raise HTTPException(
                    status_code=400,
                    detail="Multiple users share this email — resolve duplicates first.",
                )
            if len(others) == 1:
                raise HTTPException(status_code=400, detail="Another account already uses this email.")
        u.email = new_email
        u.is_email_verified = bool(new_email)

    if "phone" in data and new_phone != u.phone:
        if new_phone:
            matches = await user_repo.list_users_by_phone(new_phone)
            others = [x for x in matches if x.id != u.id]
            if len(others) > 1:
                raise HTTPException(
                    status_code=400,
                    detail="Multiple users share this phone — resolve duplicates first.",
                )
            if len(others) == 1:
                raise HTTPException(status_code=400, detail="Another account already uses this phone.")
        u.phone = new_phone
        u.is_phone_verified = bool(new_phone)


@router.patch("/platform-staff/{user_id}", response_model=PlatformStaffMemberResponse)
async def update_platform_staff_member(
    user_id: UUID,
    body: PlatformStaffUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    u = await db.get(User, user_id)
    if not u or u.platform_staff_role != PLATFORM_SUPPORT_ROLE:
        raise HTTPException(status_code=404, detail="Support staff user not found")

    snap_before = _platform_staff_audit_snapshot(u)
    data = body.model_dump(exclude_unset=True)

    if body.remove_access:
        await db.execute(
            update(User)
            .where(User.platform_staff_manager_id == user_id)
            .values(platform_staff_manager_id=None)
        )
        u.platform_staff_role = None
        u.platform_staff_job_role = None
        u.platform_staff_manager_id = None
    else:
        user_repo = UserRepository(db)
        if body.is_active is not None:
            u.is_active = body.is_active
        if "full_name" in data or "email" in data or "phone" in data:
            await _apply_platform_staff_contact_updates(
                db,
                user_repo,
                u,
                data=data,
                body=body,
            )
        if "job_role" in data or "manager_id" in data:
            role = data["job_role"] if "job_role" in data else u.platform_staff_job_role
            mgr_id = data["manager_id"] if "manager_id" in data else u.platform_staff_manager_id
            if role is None:
                raise HTTPException(
                    status_code=422,
                    detail="Support user has no job_role; set job_role first.",
                )
            if role not in PLATFORM_JOB_ROLES:
                raise HTTPException(status_code=422, detail="Invalid job_role.")
            if role == PLATFORM_JOB_ROLE_TEAM_MANAGER:
                mgr_id = None
            await _validate_platform_staff_manager_assignment(
                db,
                job_role=role,
                manager_id=mgr_id,
                subject_user_id=u.id,
            )
            if "job_role" in data:
                u.platform_staff_job_role = role
            if "manager_id" in data or ("job_role" in data and role == PLATFORM_JOB_ROLE_TEAM_MANAGER):
                u.platform_staff_manager_id = mgr_id

    if body.remove_access:
        await log_platform_staff_audit(
            db,
            subject_user_id=u.id,
            actor_user_id=current_user.id,
            action=ACTION_SUPPORT_ACCESS_REMOVED,
            request=request,
        )
    else:
        diff = _platform_staff_audit_diff(snap_before, _platform_staff_audit_snapshot(u))
        if diff:
            await log_platform_staff_audit(
                db,
                subject_user_id=u.id,
                actor_user_id=current_user.id,
                action=ACTION_SUPPORT_PROFILE_UPDATED,
                detail={"changes": diff},
                request=request,
            )

    await db.commit()
    await db.refresh(u)

    mgr_names = await _platform_staff_manager_name_map(db, [u])
    rm_counts = await _relationship_manager_vendor_counts(db, [u.id])
    return _platform_staff_member_response(u, mgr_names, rm_counts)


@router.post("/platform-staff/{user_id}/reset-password", response_model=PlatformStaffMemberResponse)
async def reset_platform_staff_password(
    user_id: UUID,
    body: PlatformStaffResetPasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    u = await db.get(User, user_id)
    if not u or u.platform_staff_role != PLATFORM_SUPPORT_ROLE:
        raise HTTPException(status_code=404, detail="Support staff user not found")
    u.password_hash = get_password_hash(body.password)
    await log_platform_staff_audit(
        db,
        subject_user_id=u.id,
        actor_user_id=current_user.id,
        action=ACTION_SUPPORT_PASSWORD_RESET,
        request=request,
    )
    await db.commit()
    await db.refresh(u)
    mgr_names = await _platform_staff_manager_name_map(db, [u])
    rm_counts = await _relationship_manager_vendor_counts(db, [u.id])
    return _platform_staff_member_response(u, mgr_names, rm_counts)


# ── Order disputes & fraud triage ────────────────────────────────────────────

class DisputeUpdate(BaseModel):
    status: str = Field(..., pattern="^(open|investigating|resolved|rejected)$")
    resolution_notes: Optional[str] = None


@router.get("/contact-queries")
async def list_storefront_contact_queries(
    status: Optional[str] = Query(None),
    vendor_id: Optional[UUID] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    """Platform admin inbox for storefront Contact Us submissions."""
    from app.models.storefront_contact_query import StorefrontContactQuery

    filters = []
    if status:
        filters.append(StorefrontContactQuery.status == status)
    if vendor_id:
        filters.append(StorefrontContactQuery.vendor_id == vendor_id)

    count_stmt = select(func.count(StorefrontContactQuery.id))
    for f in filters:
        count_stmt = count_stmt.where(f)
    total = (await db.execute(count_stmt)).scalar() or 0

    base = (
        select(StorefrontContactQuery, Vendor.display_name, Vendor.business_name)
        .outerjoin(Vendor, Vendor.id == StorefrontContactQuery.vendor_id)
    )
    for f in filters:
        base = base.where(f)
    rows = (
        await db.execute(
            base.order_by(StorefrontContactQuery.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
    ).all()

    items = [
        {
            "id": str(q.id),
            "vendor_id": str(q.vendor_id) if q.vendor_id else None,
            "vendor_display_name": (display_name or business_name) or "KIT ERP Platform",
            "name": q.name,
            "email": q.email,
            "phone": q.phone,
            "message": q.message,
            "status": q.status,
            "created_at": q.created_at.isoformat() if q.created_at else None,
        }
        for q, display_name, business_name in rows
    ]
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total else 0,
    }


@router.patch("/contact-queries/{query_id}")
async def update_storefront_contact_query(
    query_id: UUID,
    body: dict,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    from app.models.storefront_contact_query import StorefrontContactQuery
    from app.schemas.storefront_contact_query import StorefrontContactQueryStatusUpdate

    try:
        parsed = StorefrontContactQueryStatusUpdate.model_validate(body)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    result = await db.execute(
        select(StorefrontContactQuery).where(StorefrontContactQuery.id == query_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Query not found")
    row.status = parsed.status
    await db.commit()
    return {"ok": True, "id": str(row.id), "status": row.status}


@router.get("/disputes")
async def list_order_disputes(
    status: Optional[str] = Query(None),
    dispute_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    from app.models.order_dispute import OrderDispute
    from app.models.order import Order

    filters = []
    if status:
        filters.append(OrderDispute.status == status)
    if dispute_type:
        filters.append(OrderDispute.dispute_type == dispute_type)
    count_stmt = select(func.count(OrderDispute.id))
    for f in filters:
        count_stmt = count_stmt.where(f)
    total = (await db.execute(count_stmt)).scalar() or 0
    base = select(OrderDispute, Order.order_number).join(Order, Order.id == OrderDispute.order_id)
    for f in filters:
        base = base.where(f)
    rows = (
        await db.execute(
            base.order_by(OrderDispute.created_at.desc()).offset((page - 1) * size).limit(size)
        )
    ).all()
    items = [
        {
            "id": str(d.id),
            "order_id": str(d.order_id),
            "order_number": order_number,
            "vendor_id": str(d.vendor_id),
            "dispute_type": d.dispute_type,
            "reason": d.reason,
            "status": d.status,
            "amount": float(d.amount) if d.amount else None,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d, order_number in rows
    ]
    return {"items": items, "total": total, "page": page, "size": size, "pages": math.ceil(total / size) if total else 0}


@router.patch("/disputes/{dispute_id}")
async def update_order_dispute(
    dispute_id: UUID,
    body: DisputeUpdate,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime, timezone
    from app.models.order_dispute import OrderDispute

    result = await db.execute(select(OrderDispute).where(OrderDispute.id == dispute_id))
    dispute = result.scalar_one_or_none()
    if not dispute:
        raise HTTPException(404, "Dispute not found")
    dispute.status = body.status
    if body.resolution_notes:
        dispute.resolution_notes = body.resolution_notes
    if body.status in ("resolved", "rejected"):
        dispute.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True, "id": str(dispute.id), "status": dispute.status}
