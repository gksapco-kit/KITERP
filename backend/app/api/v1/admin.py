# app/api/v1/admin.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Any
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, model_validator
import math

from app.database import get_db
from app.api.deps import get_current_superuser, get_current_platform_staff
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_plan import VendorPlan
from app.models.platform_setting import PlatformSetting
from app.schemas.vendor import VendorResponse, VendorListResponse, VendorCreate
from app.services.vendor_service import VendorService
from app.repositories.vendor_repo import VendorRepository
from app.repositories.user_repo import UserRepository
from app.core.security import get_password_hash
from app.utils.platform_staff import PLATFORM_SUPPORT_ROLE

router = APIRouter()


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


class AdminVendorCreate(BaseModel):
    """Admin creates a vendor AND the owner's login account in one step."""
    owner_email: str = Field(..., description="Login email for the vendor owner")
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
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin creates a vendor AND the vendor owner's user account in one step.
    Returns the vendor data plus the owner's login credentials.
    """
    user_repo = UserRepository(db)

    # Check if user already exists with this email
    existing_user = await user_repo.get_by_email(body.owner_email)
    if existing_user:
        owner_user = existing_user
        user_created = False
    else:
        owner_user = User(
            email=body.owner_email,
            phone=body.owner_phone,
            password_hash=get_password_hash(body.owner_password),
            full_name=body.owner_name,
            is_active=True,
            is_email_verified=True,
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
        primary_email=body.primary_email or body.owner_email,
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
            "email": body.owner_email,
            "password": body.owner_password if user_created else "(existing account — password unchanged)",
            "full_name": body.owner_name,
            "user_created": user_created,
        },
        "message": (
            f"Vendor '{vendor.display_name}' created. "
            f"Owner can log in with email: {body.owner_email}"
        ),
    }


@router.get("/vendors", response_model=VendorListResponse)
async def list_vendors(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    """List all vendors (admin only)."""
    repo = VendorRepository(db)
    skip = (page - 1) * size
    
    items, total = await repo.list_vendors(
        skip=skip,
        limit=size,
        status=status,
        search=search,
    )
    
    return VendorListResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total > 0 else 0,
    )


class AdminVendorStatsResponse(BaseModel):
    total: int
    approved: int
    pending_review: int


@router.get("/vendors/stats/summary", response_model=AdminVendorStatsResponse)
async def vendor_stats_summary(
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    """Dashboard KPIs without loading full vendor rows."""
    repo = VendorRepository(db)
    return await repo.get_admin_dashboard_stats()


@router.get("/vendors/{vendor_id}", response_model=VendorResponse)
async def get_vendor(
    vendor_id: UUID,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    """Get vendor details (admin only)."""
    repo = VendorRepository(db)
    vendor = await repo.get_by_id(vendor_id)
    
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    return vendor


@router.put("/vendors/{vendor_id}", response_model=VendorResponse)
async def update_vendor(
    vendor_id: UUID,
    body: AdminVendorUpdate,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """Update vendor details (admin only). Only provided fields are updated."""
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

    for field, value in update_data.items():
        setattr(vendor, field, value)

    await db.commit()
    await db.refresh(vendor)
    return vendor


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


class PlatformStaffMemberResponse(BaseModel):
    id: str
    email: Optional[str] = None
    phone: Optional[str] = None
    full_name: str
    is_active: bool
    created_at: Optional[str] = None


class PlatformStaffCreateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=24)

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
    return [
        PlatformStaffMemberResponse(
            id=str(r.id),
            email=r.email,
            phone=r.phone,
            full_name=r.full_name,
            is_active=bool(r.is_active),
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
        for r in rows
    ]


@router.post("/platform-staff", response_model=PlatformStaffMemberResponse, status_code=201)
async def create_platform_staff_member(
    body: PlatformStaffCreateRequest,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    user_repo = UserRepository(db)
    email_norm = str(body.email).strip().lower() if body.email else None
    phone_norm = (body.phone or "").strip() or None

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

    if existing:
        if existing.is_superuser:
            raise HTTPException(status_code=400, detail="User is already a super administrator.")
        existing.platform_staff_role = PLATFORM_SUPPORT_ROLE
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
            is_email_verified=bool(email_norm),
            is_phone_verified=bool(phone_norm),
        )
        db.add(u)
        await db.commit()
        await db.refresh(u)

    return PlatformStaffMemberResponse(
        id=str(u.id),
        email=u.email,
        phone=u.phone,
        full_name=u.full_name,
        is_active=bool(u.is_active),
        created_at=u.created_at.isoformat() if u.created_at else None,
    )


@router.patch("/platform-staff/{user_id}", response_model=PlatformStaffMemberResponse)
async def update_platform_staff_member(
    user_id: UUID,
    body: PlatformStaffUpdateRequest,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    u = await db.get(User, user_id)
    if not u or u.platform_staff_role != PLATFORM_SUPPORT_ROLE:
        raise HTTPException(status_code=404, detail="Support staff user not found")

    if body.remove_access:
        u.platform_staff_role = None
    if body.is_active is not None:
        u.is_active = body.is_active

    await db.commit()
    await db.refresh(u)

    return PlatformStaffMemberResponse(
        id=str(u.id),
        email=u.email,
        phone=u.phone,
        full_name=u.full_name,
        is_active=bool(u.is_active),
        created_at=u.created_at.isoformat() if u.created_at else None,
    )
