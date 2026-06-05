# app/api/v1/vendors.py
from fastapi import APIRouter, Depends, HTTPException, Request, Query, status, UploadFile, File, Form, Body
import random, string
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.api.deps import get_current_active_user, get_current_vendor_id, preferred_vendor_id_from_request, resolve_dashboard_vendor
from app.repositories.vendor_platform_audit_repo import VendorPlatformAuditRepository
from app.schemas.vendor_platform_audit import (
    VendorPlatformAuditEntry,
    VendorPlatformAuditListResponse,
)
from app.models.user import User
from app.models.vendor_plan import VendorPlan
from app.schemas.vendor import (
    VendorCreate, VendorUpdate, VendorResponse,
    SlugCheckRequest, SlugCheckResponse
)
from app.schemas.vendor_document import DocumentType, DocumentResponse
from app.schemas.bank_account import BankAccountCreate, BankAccountResponse
from app.config import settings
from app.services.vendor_service import VendorService
from app.services.file_service import FileService

router = APIRouter()


def get_vendor_service(db: AsyncSession = Depends(get_db)) -> VendorService:
    file_service = FileService()
    return VendorService(db, file_service)


# ============== Public Endpoints ==============

@router.post("/register", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
async def register_vendor(
    data: VendorCreate,
    current_user: User = Depends(get_current_active_user),
    service: VendorService = Depends(get_vendor_service),
):
    """
    Register a new vendor.
    
    - Requires authenticated user
    - User becomes the vendor owner
    """
    vendor = await service.register(current_user.id, data)
    return vendor


@router.post("/check-slug", response_model=SlugCheckResponse)
async def check_slug_availability(
    data: SlugCheckRequest,
    service: VendorService = Depends(get_vendor_service),
):
    """
    Check if a slug is available for registration.
    
    - Returns availability status
    - Provides suggestions if slug is taken
    """
    return await service.check_slug_availability(data.slug)


# ============== Vendor Owner Endpoints ==============

@router.get("/me", response_model=VendorResponse)
async def get_my_vendor(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    service: VendorService = Depends(get_vendor_service),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's vendor profile."""
    pref = preferred_vendor_id_from_request(request)
    vendor = await resolve_dashboard_vendor(db, current_user, preferred_vendor_id=pref)
    return vendor


@router.put("/me", response_model=VendorResponse)
async def update_my_vendor(
    data: VendorUpdate,
    current_user: User = Depends(get_current_active_user),
    service: VendorService = Depends(get_vendor_service),
):
    """Update current user's vendor profile."""
    vendor = await service.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No vendor found for this user"
        )
    return await service.update(vendor.id, data)


@router.get("/me/platform-audit", response_model=VendorPlatformAuditListResponse)
async def list_vendor_platform_audit(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Platform support audit trail for this vendor (SSO handoff + recorded API changes)."""
    repo = VendorPlatformAuditRepository(db)
    total = await repo.count_for_vendor(vendor_id)
    rows = await repo.list_for_vendor(vendor_id, skip=skip, limit=limit)
    items = [
        VendorPlatformAuditEntry(
            id=row.id,
            actor_user_id=row.actor_user_id,
            actor_email=email,
            action=row.action,
            detail=row.detail,
            ip=row.ip,
            created_at=row.created_at,
        )
        for row, email in rows
    ]
    return VendorPlatformAuditListResponse(items=items, total=total)


# ============== Plan Management ==============

@router.get("/plans")
async def list_available_plans(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all active plans available for vendors to choose from."""
    result = await db.execute(
        select(VendorPlan)
        .where(VendorPlan.is_active == True)
        .order_by(VendorPlan.sort_order, VendorPlan.price_monthly)
    )
    plans = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "slug": p.slug,
            "description": p.description,
            "price_monthly": float(p.price_monthly),
            "price_yearly": float(p.price_yearly) if p.price_yearly else None,
            "currency": p.currency or "INR",
            "max_products": p.max_products,
            "max_services": p.max_services,
            "max_team_members": p.max_team_members,
            "max_storage_mb": p.max_storage_mb,
            "features": p.features or {},
            "is_featured": p.is_featured,
        }
        for p in plans
    ]


@router.get("/me/plan")
async def get_my_plan(
    current_user: User = Depends(get_current_active_user),
    service: VendorService = Depends(get_vendor_service),
    db: AsyncSession = Depends(get_db),
):
    """Get the current vendor's active plan and its features."""
    vendor = await service.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(status_code=404, detail="No vendor found for this user")

    if not vendor.plan_id:
        return {"plan": None, "message": "No plan assigned"}

    result = await db.execute(select(VendorPlan).where(VendorPlan.id == vendor.plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        return {"plan": None, "message": "Plan not found"}

    return {
        "plan": {
            "id": str(plan.id),
            "name": plan.name,
            "slug": plan.slug,
            "description": plan.description,
            "price_monthly": float(plan.price_monthly),
            "price_yearly": float(plan.price_yearly) if plan.price_yearly else None,
            "currency": plan.currency or "INR",
            "max_products": plan.max_products,
            "max_services": plan.max_services,
            "max_team_members": plan.max_team_members,
            "max_storage_mb": plan.max_storage_mb,
            "features": plan.features or {},
            "is_featured": plan.is_featured,
        }
    }


@router.put("/me/plan")
async def change_my_plan(
    body: dict,
    current_user: User = Depends(get_current_active_user),
    service: VendorService = Depends(get_vendor_service),
    db: AsyncSession = Depends(get_db),
):
    """
    Self-service plan upgrade or downgrade.
    Body: { "plan_id": "<uuid>" }
    """
    plan_id = body.get("plan_id")
    if not plan_id:
        raise HTTPException(status_code=422, detail="plan_id is required")

    vendor = await service.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(status_code=404, detail="No vendor found for this user")

    try:
        plan_uuid = UUID(plan_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid plan_id format")

    result = await db.execute(
        select(VendorPlan).where(VendorPlan.id == plan_uuid, VendorPlan.is_active == True)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found or inactive")

    old_plan_id = vendor.plan_id
    vendor.plan_id = plan.id
    await db.commit()
    await db.refresh(vendor)

    action = "upgraded" if (not old_plan_id or float(plan.price_monthly) >= 0) else "downgraded"

    return {
        "message": f"Plan {action} to '{plan.name}' successfully",
        "plan": {
            "id": str(plan.id),
            "name": plan.name,
            "slug": plan.slug,
            "price_monthly": float(plan.price_monthly),
            "currency": plan.currency or "INR",
            "features": plan.features or {},
        },
    }


# ============== Document Management ==============

@router.post("/me/documents", response_model=DocumentResponse)
async def upload_document(
    document_type: DocumentType = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    service: VendorService = Depends(get_vendor_service),
):
    """
    Upload a verification document.
    
    - Supported types: business_registration, tax_id, id_proof, address_proof
    - Allowed formats: JPEG, PNG, PDF
    - Maximum size: 10MB
    """
    vendor = await service.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No vendor found for this user"
        )
    
    return await service.upload_document(vendor.id, document_type, file)


@router.get("/me/documents", response_model=List[DocumentResponse])
async def get_my_documents(
    current_user: User = Depends(get_current_active_user),
    service: VendorService = Depends(get_vendor_service),
):
    """Get all uploaded verification documents."""
    vendor = await service.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No vendor found for this user"
        )
    
    return await service.get_documents(vendor.id)


# ============== Bank Account ==============

@router.post("/me/bank-account", response_model=BankAccountResponse)
async def add_bank_account(
    data: BankAccountCreate,
    current_user: User = Depends(get_current_active_user),
    service: VendorService = Depends(get_vendor_service),
):
    """Add a bank account for payouts."""
    vendor = await service.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No vendor found for this user"
        )
    
    return await service.add_bank_account(vendor.id, data)


@router.get("/me/bank-accounts", response_model=List[BankAccountResponse])
async def get_bank_accounts(
    current_user: User = Depends(get_current_active_user),
    service: VendorService = Depends(get_vendor_service),
):
    """Get all bank accounts."""
    vendor = await service.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No vendor found for this user"
        )
    
    return await service.get_bank_accounts(vendor.id)


# ============== Review Submission ==============

@router.post("/me/submit-review", response_model=VendorResponse)
async def submit_for_review(
    current_user: User = Depends(get_current_active_user),
    service: VendorService = Depends(get_vendor_service),
):
    """
    Submit vendor for admin review.
    
    Requirements:
    - All required documents uploaded
    - Primary bank account added
    """
    vendor = await service.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No vendor found for this user"
        )
    
    return await service.submit_for_review(vendor.id)


# ── External domain deactivation OTP ────────────────────────────────────────

@router.post("/me/domain/send-deactivation-otp")
async def send_domain_deactivation_otp(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Send OTP via SMS (preferred) or email to confirm external domain deactivation."""
    from app.config import settings
    from app.services.phone_otp_service import PhoneOtpService, DOMAIN_OFF_VERIFY_MARKER, generate_otp_code
    from app.services.sms_service import normalize_e164

    code = generate_otp_code()
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    current_user.verification_code_expires_at = expires
    extra: dict = {}
    to = current_user.email or current_user.phone or "your registered contact"
    sent = False

    phone = normalize_e164(current_user.phone or "") if current_user.phone else ""
    otp_svc = PhoneOtpService()
    if phone and otp_svc.is_configured:
        dispatch = await otp_svc.send_and_store_code(phone, purpose="domain deactivation")
        if dispatch.result.sent:
            current_user.verification_code = (
                DOMAIN_OFF_VERIFY_MARKER if dispatch.verify_marker else f"domain-off:{dispatch.stored_code}"
            )
            to = phone
            sent = True
        elif not settings.DEBUG:
            raise HTTPException(
                status_code=503,
                detail=dispatch.result.user_message(
                    fallback="Could not send verification SMS. Check your phone number and try again.",
                ),
            )
        else:
            current_user.verification_code = f"domain-off:{code}"
            extra["dev_hint"] = code
    else:
        current_user.verification_code = f"domain-off:{code}"
        if current_user.email:
            from app.services.email_service import send_email
            subject = "Confirm external domain deactivation"
            text = f"Your KITERP deactivation code is {code}. It expires in 10 minutes."
            await send_email(to=current_user.email, subject=subject, html=f"<p>{text}</p>", text=text)
            to = current_user.email
            sent = bool((settings.SMTP_HOST or "").strip())
        if not sent and settings.DEBUG:
            extra["dev_hint"] = code

    db.add(current_user)
    await db.commit()
    return {
        "sent": sent or bool(extra.get("dev_hint")),
        "to": to,
        "expires_at": expires.isoformat(),
        "channel": "phone" if sent and phone else "email",
        **extra,
    }


@router.post("/me/domain/verify-deactivation-otp")
async def verify_domain_deactivation_otp(
    code: str = Body(..., embed=True),
    current_user: User = Depends(get_current_active_user),
    service: VendorService = Depends(get_vendor_service),
    db: AsyncSession = Depends(get_db),
):
    """Verify OTP and deactivate the external domain (set status to revoked, enabled to false)."""
    from app.services.phone_otp_service import PhoneOtpService, DOMAIN_OFF_VERIFY_MARKER

    stored = current_user.verification_code or ''
    code_ok = False
    if stored == DOMAIN_OFF_VERIFY_MARKER and current_user.phone:
        check = await PhoneOtpService().verify_otp(current_user.phone, code)
        code_ok = check.approved
    elif stored.startswith("domain-off:") and stored == f"domain-off:{code}":
        code_ok = True

    if not code_ok:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    if current_user.verification_code_expires_at and \
       current_user.verification_code_expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Code has expired — request a new one")

    # Clear OTP
    current_user.verification_code = None
    current_user.verification_code_expires_at = None
    db.add(current_user)

    # Deactivate domain
    vendor = await service.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    from app.schemas.vendor import VendorUpdate
    updated = await service.update(vendor.id, VendorUpdate(
        external_domain_enabled=False,
        external_domain_access_status='revoked',
    ))
    await db.commit()
    return updated
