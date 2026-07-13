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
    SlugCheckRequest, SlugCheckResponse,
    BusinessDescriptionAIRequest, BusinessDescriptionAIResponse,
    AiCopyRequest, AiCopyResponse,
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


@router.post("/me/ai/business-description", response_model=BusinessDescriptionAIResponse)
async def ai_generate_business_description(
    body: BusinessDescriptionAIRequest,
    current_user: User = Depends(get_current_active_user),
    service: VendorService = Depends(get_vendor_service),
):
    """Backward-compatible alias for business profile description generation."""
    return await ai_generate_copy(
        AiCopyRequest(
            field_kind="business_description",
            name=body.business_name,
            business_name=body.business_name,
            company_type=body.company_type,
            offering_type=body.offering_type,
            current_text=body.current_description,
            current_description=body.current_description,
            tone=body.tone,
            max_chars=2000,
        ),
        current_user,
        service,
    )


@router.post("/me/ai/copy", response_model=AiCopyResponse)
async def ai_generate_copy(
    body: AiCopyRequest,
    current_user: User = Depends(get_current_active_user),
    service: VendorService = Depends(get_vendor_service),
):
    """
    Generate customer-facing copy for description / summary / SEO textareas.
    Uses OpenAI when OPENAI_API_KEY is set; otherwise returns a template fallback.
    """
    vendor = await service.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No vendor found for this user",
        )

    field_kind = (body.field_kind or "general").strip().lower()
    name = (
        body.name
        or body.business_name
        or (getattr(vendor, "business_name", None) if field_kind == "business_description" else None)
        or ""
    ).strip()
    category = (body.category or body.company_type or "").strip()
    if field_kind == "business_description" and not category:
        category = (getattr(vendor, "business_type", None) or "").strip()
    offering_type = (
        body.offering_type
        or (getattr(vendor, "offering_type", None) if field_kind == "business_description" else None)
        or ""
    ).strip()
    draft = (body.current_text or body.current_description or "").strip()
    tone = (body.tone or "friendly").strip()
    max_chars = min(max(int(body.max_chars or 2000), 40), 4000)
    extra = body.extra_context or {}

    if not name and not category and not draft:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enter a name/title or category before generating",
        )

    kind_guides = {
        "business_description": (
            "Write a customer-facing business / storefront about description.",
            "80-250 words",
        ),
        "product_short": (
            "Write a brief product summary for a catalog listing card.",
            "1-2 short sentences",
        ),
        "product_description": (
            "Write a detailed product description for a product detail page.",
            "2-4 short paragraphs",
        ),
        "product_meta": (
            "Write an SEO meta description for a product page.",
            "about 140-160 characters",
        ),
        "service_short": (
            "Write a brief service summary for a catalog listing card.",
            "1-2 short sentences",
        ),
        "service_description": (
            "Write a detailed service description for a service detail page.",
            "2-4 short paragraphs",
        ),
        "service_meta": (
            "Write an SEO meta description for a service page.",
            "about 140-160 characters",
        ),
        "category_description": (
            "Write a short category description for a storefront category page.",
            "1-3 sentences",
        ),
        "store_description": (
            "Write a brief description of this business unit / store location.",
            "1-3 sentences",
        ),
        "course_description": (
            "Write a customer-facing course description.",
            "2-3 short paragraphs",
        ),
        "property_description": (
            "Write a property listing description for buyers/renters.",
            "2-3 short paragraphs",
        ),
        "booking_resource_description": (
            "Write a short description of a bookable room/resource.",
            "1-3 sentences",
        ),
        "blog_excerpt": (
            "Write a short blog excerpt / summary for listings.",
            "1-2 sentences",
        ),
        "general": (
            "Write clear customer-facing marketing copy.",
            "2-3 short paragraphs",
        ),
    }
    purpose, length_hint = kind_guides.get(field_kind, kind_guides["general"])

    offering_label = {
        "products": "products",
        "services": "services",
        "both": "products and services",
    }.get(offering_type, offering_type or "")

    try:
        import os
        api_key = os.environ.get("OPENAI_API_KEY")
        if api_key:
            import httpx

            system = (
                f"You are a professional copywriter for storefronts and marketplaces. {purpose} "
                f"Tone: {tone}. Length: {length_hint}, hard max {max_chars} characters. "
                "Return ONLY the text — no title, no markdown, no quotes, no preamble."
            )
            user_parts = [
                f"Field type: {field_kind}",
                f"Name/title: {name or 'not provided'}",
                f"Category: {category or 'not provided'}",
            ]
            if offering_label:
                user_parts.append(f"Offers: {offering_label}")
            for k, v in extra.items():
                if v is None or v == "":
                    continue
                user_parts.append(f"{k}: {v}")
            if draft:
                user_parts.append(f"Owner draft / notes (improve and keep facts):\n{draft}")
            else:
                user_parts.append("No draft provided — write from the context above.")
            user_parts.append("Write the text now.")

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": "\n".join(user_parts)},
                        ],
                        "n": 1,
                        "max_tokens": min(800, max(120, max_chars // 2)),
                        "temperature": 0.7,
                    },
                )
                if resp.status_code >= 400:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail="AI provider returned an error. Please try again.",
                    )
                data = resp.json()
                choices = data.get("choices", [])
                texts = [
                    (c.get("message") or {}).get("content", "").strip()
                    for c in choices
                    if (c.get("message") or {}).get("content")
                ]
                if texts:
                    return AiCopyResponse(result=texts[0][:max_chars], alternatives=[])
    except HTTPException:
        raise
    except Exception:
        pass

    label = name or category or "this offering"
    if draft:
        fallback = f"{draft} {label} — quality you can trust."
    elif field_kind.endswith("_meta") or field_kind == "blog_excerpt" or field_kind.endswith("_short"):
        fallback = f"Discover {label}. Quality, value, and a smooth experience every time."
    else:
        fallback = (
            f"Welcome to {label}. "
            f"We focus on quality, clear value, and a smooth customer experience. "
            f"Browse with confidence and find exactly what you need."
        )
    return AiCopyResponse(result=fallback[:max_chars], alternatives=[])


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
    from app.services.phone_otp_service import OtpService

    otp_svc = OtpService()
    if phone and otp_svc.is_sms_configured:
        dispatch = await otp_svc.send_and_store_code(phone, channel="sms", purpose="domain deactivation")
        if dispatch.result.sent:
            current_user.verification_code = (
                DOMAIN_OFF_VERIFY_MARKER if dispatch.verify_marker else f"domain-off:{dispatch.stored_code}"
            )
            to = phone
            sent = True
        elif settings.DEBUG:
            current_user.verification_code = f"domain-off:{code}"
            extra["dev_hint"] = code
        else:
            raise HTTPException(
                status_code=503,
                detail=dispatch.result.user_message(
                    fallback="Could not send verification SMS. Check your phone number and try again.",
                ),
            )
    elif current_user.email and otp_svc.is_email_configured:
        dispatch = await otp_svc.send_and_store_code(
            current_user.email.lower(),
            channel="email",
            purpose="domain deactivation",
        )
        if dispatch.result.sent:
            from app.services.phone_otp_service import TWILIO_VERIFY_EMAIL_MARKER

            current_user.verification_code = (
                f"domain-off:{TWILIO_VERIFY_EMAIL_MARKER}"
                if dispatch.verify_marker
                else f"domain-off:{dispatch.stored_code}"
            )
            to = current_user.email
            sent = True
        elif settings.DEBUG:
            current_user.verification_code = f"domain-off:{code}"
            extra["dev_hint"] = code
        else:
            raise HTTPException(
                status_code=503,
                detail=dispatch.result.user_message(
                    fallback="Could not send verification email. Try again.",
                ),
            )
    else:
        current_user.verification_code = f"domain-off:{code}"
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
    from app.services.phone_otp_service import OtpService, DOMAIN_OFF_VERIFY_MARKER, TWILIO_VERIFY_EMAIL_MARKER

    stored = current_user.verification_code or ''
    code_ok = False
    if stored == DOMAIN_OFF_VERIFY_MARKER and current_user.phone:
        check = await OtpService().verify_otp(current_user.phone, code, channel="sms")
        code_ok = check.approved
    elif stored == f"domain-off:{TWILIO_VERIFY_EMAIL_MARKER}" and current_user.email:
        check = await OtpService().verify_otp(current_user.email, code, channel="email")
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
