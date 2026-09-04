# app/api/v1/vendor_procurement_supplier.py
"""
Extended Supplier Management API — Phase 1

Routes (all under /vendors/me):
  Supplier categories
    GET/POST   /supplier-categories
    GET/PUT/DELETE  /supplier-categories/{id}

  Per-supplier sub-resources
    GET/POST   /suppliers/{id}/contacts
    PUT/DELETE /suppliers/{id}/contacts/{contact_id}

    GET/POST   /suppliers/{id}/addresses
    PUT/DELETE /suppliers/{id}/addresses/{addr_id}

    GET/POST   /suppliers/{id}/documents
    PUT        /suppliers/{id}/documents/{doc_id}
    POST       /suppliers/{id}/documents/{doc_id}/verify

    GET/POST   /suppliers/{id}/onboarding
    PUT        /suppliers/{id}/onboarding
    POST       /suppliers/{id}/onboarding/review

    GET/POST   /suppliers/{id}/performance
    GET        /suppliers/{id}/performance/summary

Permissions:
  read-only endpoints → procurement.view  (via router-level dep)
  write endpoints     → procurement.manage
  document verify     → procurement.manage
  onboarding review   → procurement.manage
"""
from __future__ import annotations

import math
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_vendor_id, get_current_vendor_user, require_permission
from app.models.vendor_user import VendorUser
from app.models.procurement import Supplier
from app.models.procurement_supplier import (
    SupplierCategory, SupplierCategoryLink,
    SupplierContact, SupplierAddress,
    SupplierDocument, SupplierOnboarding, SupplierPerformance,
)
from app.schemas.procurement_supplier import (
    SupplierCategoryCreate, SupplierCategoryUpdate, SupplierCategoryResponse,
    SupplierContactCreate, SupplierContactUpdate, SupplierContactResponse,
    SupplierAddressCreate, SupplierAddressUpdate, SupplierAddressResponse,
    SupplierDocumentCreate, SupplierDocumentUpdate, SupplierDocumentResponse,
    VerifyDocumentRequest,
    SupplierOnboardingCreate, SupplierOnboardingUpdate,
    OnboardingReviewRequest, SupplierOnboardingResponse,
    SupplierPerformanceCreate, SupplierPerformanceResponse,
    AssignCategoriesRequest,
)
from app.utils.procurement_utils import append_audit_log

router = APIRouter(dependencies=[Depends(require_permission("procurement.view"))])

_MANAGE = Depends(require_permission("procurement.manage"))
_APPROVE = Depends(require_permission("procurement.supplier.approve"))


# ─────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────

async def _get_supplier_or_404(db: AsyncSession, vendor_id: UUID, supplier_id: UUID) -> Supplier:
    result = await db.execute(
        select(Supplier).where(Supplier.vendor_id == vendor_id, Supplier.id == supplier_id)
    )
    sup = result.scalar_one_or_none()
    if not sup:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return sup


def _cat_to_dict(c: SupplierCategory) -> dict:
    return {
        "id": str(c.id),
        "vendor_id": str(c.vendor_id),
        "name": c.name,
        "code": c.code,
        "parent_id": str(c.parent_id) if c.parent_id else None,
        "description": c.description,
        "is_active": c.is_active,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def _contact_to_dict(c: SupplierContact) -> dict:
    return {
        "id": str(c.id),
        "supplier_id": str(c.supplier_id),
        "name": c.name,
        "designation": c.designation,
        "department": c.department,
        "email": c.email,
        "phone": c.phone,
        "mobile": c.mobile,
        "is_primary": c.is_primary,
        "notes": c.notes,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def _address_to_dict(a: SupplierAddress) -> dict:
    return {
        "id": str(a.id),
        "supplier_id": str(a.supplier_id),
        "address_type": a.address_type,
        "line1": a.line1,
        "line2": a.line2,
        "city": a.city,
        "state": a.state,
        "pincode": a.pincode,
        "country": a.country,
        "gstin": a.gstin,
        "is_default": a.is_default,
    }


def _doc_to_dict(d: SupplierDocument) -> dict:
    return {
        "id": str(d.id),
        "supplier_id": str(d.supplier_id),
        "document_type": d.document_type,
        "document_number": d.document_number,
        "file_url": d.file_url,
        "file_name": d.file_name,
        "issue_date": d.issue_date.isoformat() if d.issue_date else None,
        "expiry_date": d.expiry_date.isoformat() if d.expiry_date else None,
        "issuing_authority": d.issuing_authority,
        "status": d.status,
        "verified_by": str(d.verified_by) if d.verified_by else None,
        "verified_at": d.verified_at.isoformat() if d.verified_at else None,
        "rejection_reason": d.rejection_reason,
        "notes": d.notes,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }


def _onboarding_to_dict(ob: SupplierOnboarding) -> dict:
    return {
        "id": str(ob.id),
        "supplier_id": str(ob.supplier_id),
        "status": ob.status,
        "qualification_score": float(ob.qualification_score) if ob.qualification_score else None,
        "payment_terms": ob.payment_terms,
        "credit_limit": float(ob.credit_limit) if ob.credit_limit else None,
        "currency": ob.currency,
        "checklist": ob.checklist or [],
        "reviewed_by": str(ob.reviewed_by) if ob.reviewed_by else None,
        "reviewed_at": ob.reviewed_at.isoformat() if ob.reviewed_at else None,
        "rejection_reason": ob.rejection_reason,
        "approved_at": ob.approved_at.isoformat() if ob.approved_at else None,
        "re_evaluation_due": ob.re_evaluation_due.isoformat() if ob.re_evaluation_due else None,
        "audit_log": ob.audit_log or [],
        "created_at": ob.created_at.isoformat() if ob.created_at else None,
        "updated_at": ob.updated_at.isoformat() if ob.updated_at else None,
    }


def _perf_to_dict(p: SupplierPerformance) -> dict:
    def _f(v):
        return float(v) if v is not None else None

    return {
        "id": str(p.id),
        "supplier_id": str(p.supplier_id),
        "period_type": p.period_type,
        "period_start": p.period_start.isoformat(),
        "period_end": p.period_end.isoformat(),
        "po_count": p.po_count or 0,
        "on_time_delivery_pct": _f(p.on_time_delivery_pct),
        "quality_acceptance_pct": _f(p.quality_acceptance_pct),
        "price_variance_pct": _f(p.price_variance_pct),
        "response_time_days": _f(p.response_time_days),
        "overall_score": _f(p.overall_score),
        "weight_delivery": _f(p.weight_delivery),
        "weight_quality": _f(p.weight_quality),
        "weight_price": _f(p.weight_price),
        "weight_response": _f(p.weight_response),
        "comments": p.comments,
        "computed_at": p.computed_at.isoformat() if p.computed_at else None,
    }


def _compute_overall_score(p: SupplierPerformance) -> float | None:
    """Weighted composite score 0-100.  Returns None if all metric inputs are absent."""
    metrics = []
    if p.on_time_delivery_pct is not None:
        metrics.append((float(p.on_time_delivery_pct), float(p.weight_delivery or 40)))
    if p.quality_acceptance_pct is not None:
        metrics.append((float(p.quality_acceptance_pct), float(p.weight_quality or 35)))
    if p.price_variance_pct is not None:
        # Negative variance = supplier was cheaper → score 100, positive = more expensive → 0
        pv = float(p.price_variance_pct)
        price_score = max(0.0, min(100.0, 100.0 - pv))
        metrics.append((price_score, float(p.weight_price or 15)))
    if p.response_time_days is not None:
        # ≤3 days → 100, >10 days → 0 (linear interpolation)
        rt = float(p.response_time_days)
        rt_score = max(0.0, min(100.0, 100.0 - (rt - 3) * (100.0 / 7))) if rt > 3 else 100.0
        metrics.append((rt_score, float(p.weight_response or 10)))

    if not metrics:
        return None

    total_weight = sum(w for _, w in metrics)
    if total_weight == 0:
        return None
    return round(sum(s * w for s, w in metrics) / total_weight, 2)


# ═══════════════════════════════════════════════════════════════════
#  SUPPLIER CATEGORIES
# ═══════════════════════════════════════════════════════════════════

@router.get("/supplier-categories")
async def list_supplier_categories(
    is_active: Optional[bool] = Query(None),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(SupplierCategory).where(SupplierCategory.vendor_id == vendor_id)
    if is_active is not None:
        stmt = stmt.where(SupplierCategory.is_active == is_active)
    result = await db.execute(stmt.order_by(SupplierCategory.name))
    cats = result.scalars().all()
    return JSONResponse(content={"items": [_cat_to_dict(c) for c in cats], "total": len(cats)})


@router.post("/supplier-categories", status_code=201)
async def create_supplier_category(
    data: SupplierCategoryCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    cat = SupplierCategory(vendor_id=vendor_id, **data.model_dump(exclude_none=True))
    if data.parent_id:
        cat.parent_id = UUID(data.parent_id)
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return JSONResponse(content=_cat_to_dict(cat), status_code=201)


@router.get("/supplier-categories/{cat_id}")
async def get_supplier_category(
    cat_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SupplierCategory).where(
            SupplierCategory.vendor_id == vendor_id, SupplierCategory.id == cat_id
        )
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    return JSONResponse(content=_cat_to_dict(cat))


@router.put("/supplier-categories/{cat_id}")
async def update_supplier_category(
    cat_id: UUID,
    data: SupplierCategoryUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    result = await db.execute(
        select(SupplierCategory).where(
            SupplierCategory.vendor_id == vendor_id, SupplierCategory.id == cat_id
        )
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for field, val in data.model_dump(exclude_none=True).items():
        if field == "parent_id":
            setattr(cat, field, UUID(val) if val else None)
        else:
            setattr(cat, field, val)
    await db.commit()
    await db.refresh(cat)
    return JSONResponse(content=_cat_to_dict(cat))


@router.delete("/supplier-categories/{cat_id}", status_code=204)
async def delete_supplier_category(
    cat_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    result = await db.execute(
        select(SupplierCategory).where(
            SupplierCategory.vendor_id == vendor_id, SupplierCategory.id == cat_id
        )
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.delete(cat)
    await db.commit()


# ─── Category assignment ────────────────────────────────────────

@router.post("/suppliers/{supplier_id}/categories")
async def assign_categories(
    supplier_id: UUID,
    data: AssignCategoriesRequest,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    await _get_supplier_or_404(db, vendor_id, supplier_id)

    # Validate all category IDs belong to this vendor
    if data.category_ids:
        cat_result = await db.execute(
            select(SupplierCategory.id).where(
                SupplierCategory.vendor_id == vendor_id,
                SupplierCategory.id.in_([UUID(cid) for cid in data.category_ids]),
            )
        )
        valid_ids = {str(r) for r in cat_result.scalars().all()}
        invalid = [cid for cid in data.category_ids if cid not in valid_ids]
        if invalid:
            raise HTTPException(status_code=400, detail=f"Unknown category IDs: {invalid}")

    # Remove existing links then bulk insert
    await db.execute(
        delete(SupplierCategoryLink).where(SupplierCategoryLink.supplier_id == supplier_id)
    )
    for cid_str in data.category_ids:
        db.add(SupplierCategoryLink(supplier_id=supplier_id, category_id=UUID(cid_str)))
    await db.commit()
    result = await db.execute(
        select(SupplierCategoryLink).where(SupplierCategoryLink.supplier_id == supplier_id)
    )
    links = result.scalars().all()
    return JSONResponse(content={"category_ids": [str(lk.category_id) for lk in links]})


@router.get("/suppliers/{supplier_id}/categories")
async def get_supplier_categories(
    supplier_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_supplier_or_404(db, vendor_id, supplier_id)
    result = await db.execute(
        select(SupplierCategory)
        .join(SupplierCategoryLink, SupplierCategoryLink.category_id == SupplierCategory.id)
        .where(SupplierCategoryLink.supplier_id == supplier_id)
        .order_by(SupplierCategory.name)
    )
    cats = result.scalars().all()
    return JSONResponse(content={"items": [_cat_to_dict(c) for c in cats]})


# ═══════════════════════════════════════════════════════════════════
#  SUPPLIER CONTACTS
# ═══════════════════════════════════════════════════════════════════

@router.get("/suppliers/{supplier_id}/contacts")
async def list_supplier_contacts(
    supplier_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_supplier_or_404(db, vendor_id, supplier_id)
    result = await db.execute(
        select(SupplierContact)
        .where(SupplierContact.supplier_id == supplier_id, SupplierContact.vendor_id == vendor_id)
        .order_by(SupplierContact.is_primary.desc(), SupplierContact.name)
    )
    contacts = result.scalars().all()
    return JSONResponse(content={"items": [_contact_to_dict(c) for c in contacts]})


@router.post("/suppliers/{supplier_id}/contacts", status_code=201)
async def create_supplier_contact(
    supplier_id: UUID,
    data: SupplierContactCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    await _get_supplier_or_404(db, vendor_id, supplier_id)
    if data.is_primary:
        # Unset existing primaries
        existing = await db.execute(
            select(SupplierContact).where(
                SupplierContact.supplier_id == supplier_id, SupplierContact.is_primary == True
            )
        )
        for c in existing.scalars().all():
            c.is_primary = False

    contact = SupplierContact(
        vendor_id=vendor_id,
        supplier_id=supplier_id,
        **data.model_dump(),
    )
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return JSONResponse(content=_contact_to_dict(contact), status_code=201)


@router.put("/suppliers/{supplier_id}/contacts/{contact_id}")
async def update_supplier_contact(
    supplier_id: UUID,
    contact_id: UUID,
    data: SupplierContactUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    result = await db.execute(
        select(SupplierContact).where(
            SupplierContact.id == contact_id,
            SupplierContact.supplier_id == supplier_id,
            SupplierContact.vendor_id == vendor_id,
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    if data.is_primary:
        existing = await db.execute(
            select(SupplierContact).where(
                SupplierContact.supplier_id == supplier_id,
                SupplierContact.is_primary == True,
                SupplierContact.id != contact_id,
            )
        )
        for c in existing.scalars().all():
            c.is_primary = False
    for field, val in data.model_dump(exclude_none=True).items():
        setattr(contact, field, val)
    await db.commit()
    await db.refresh(contact)
    return JSONResponse(content=_contact_to_dict(contact))


@router.delete("/suppliers/{supplier_id}/contacts/{contact_id}", status_code=204)
async def delete_supplier_contact(
    supplier_id: UUID,
    contact_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    result = await db.execute(
        select(SupplierContact).where(
            SupplierContact.id == contact_id,
            SupplierContact.supplier_id == supplier_id,
            SupplierContact.vendor_id == vendor_id,
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    await db.delete(contact)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════
#  SUPPLIER ADDRESSES
# ═══════════════════════════════════════════════════════════════════

@router.get("/suppliers/{supplier_id}/addresses")
async def list_supplier_addresses(
    supplier_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_supplier_or_404(db, vendor_id, supplier_id)
    result = await db.execute(
        select(SupplierAddress).where(
            SupplierAddress.supplier_id == supplier_id,
            SupplierAddress.vendor_id == vendor_id,
        )
    )
    addrs = result.scalars().all()
    return JSONResponse(content={"items": [_address_to_dict(a) for a in addrs]})


@router.post("/suppliers/{supplier_id}/addresses", status_code=201)
async def create_supplier_address(
    supplier_id: UUID,
    data: SupplierAddressCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    await _get_supplier_or_404(db, vendor_id, supplier_id)
    addr = SupplierAddress(vendor_id=vendor_id, supplier_id=supplier_id, **data.model_dump())
    db.add(addr)
    await db.commit()
    await db.refresh(addr)
    return JSONResponse(content=_address_to_dict(addr), status_code=201)


@router.put("/suppliers/{supplier_id}/addresses/{addr_id}")
async def update_supplier_address(
    supplier_id: UUID,
    addr_id: UUID,
    data: SupplierAddressUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    result = await db.execute(
        select(SupplierAddress).where(
            SupplierAddress.id == addr_id,
            SupplierAddress.supplier_id == supplier_id,
            SupplierAddress.vendor_id == vendor_id,
        )
    )
    addr = result.scalar_one_or_none()
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found")
    for field, val in data.model_dump(exclude_none=True).items():
        setattr(addr, field, val)
    await db.commit()
    await db.refresh(addr)
    return JSONResponse(content=_address_to_dict(addr))


@router.delete("/suppliers/{supplier_id}/addresses/{addr_id}", status_code=204)
async def delete_supplier_address(
    supplier_id: UUID,
    addr_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    result = await db.execute(
        select(SupplierAddress).where(
            SupplierAddress.id == addr_id,
            SupplierAddress.supplier_id == supplier_id,
            SupplierAddress.vendor_id == vendor_id,
        )
    )
    addr = result.scalar_one_or_none()
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found")
    await db.delete(addr)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════
#  SUPPLIER DOCUMENTS
# ═══════════════════════════════════════════════════════════════════

@router.get("/suppliers/{supplier_id}/documents")
async def list_supplier_documents(
    supplier_id: UUID,
    document_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_supplier_or_404(db, vendor_id, supplier_id)
    stmt = select(SupplierDocument).where(
        SupplierDocument.supplier_id == supplier_id,
        SupplierDocument.vendor_id == vendor_id,
    )
    if document_type:
        stmt = stmt.where(SupplierDocument.document_type == document_type)
    if status:
        stmt = stmt.where(SupplierDocument.status == status)
    result = await db.execute(stmt.order_by(SupplierDocument.document_type))
    docs = result.scalars().all()
    return JSONResponse(content={"items": [_doc_to_dict(d) for d in docs]})


@router.post("/suppliers/{supplier_id}/documents", status_code=201)
async def create_supplier_document(
    supplier_id: UUID,
    data: SupplierDocumentCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    await _get_supplier_or_404(db, vendor_id, supplier_id)
    doc = SupplierDocument(
        vendor_id=vendor_id,
        supplier_id=supplier_id,
        **data.model_dump(),
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return JSONResponse(content=_doc_to_dict(doc), status_code=201)


@router.put("/suppliers/{supplier_id}/documents/{doc_id}")
async def update_supplier_document(
    supplier_id: UUID,
    doc_id: UUID,
    data: SupplierDocumentUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    result = await db.execute(
        select(SupplierDocument).where(
            SupplierDocument.id == doc_id,
            SupplierDocument.supplier_id == supplier_id,
            SupplierDocument.vendor_id == vendor_id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    for field, val in data.model_dump(exclude_none=True).items():
        setattr(doc, field, val)
    await db.commit()
    await db.refresh(doc)
    return JSONResponse(content=_doc_to_dict(doc))


@router.post("/suppliers/{supplier_id}/documents/{doc_id}/verify")
async def verify_supplier_document(
    supplier_id: UUID,
    doc_id: UUID,
    data: VerifyDocumentRequest,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    if data.status not in ("valid", "rejected"):
        raise HTTPException(status_code=400, detail="status must be 'valid' or 'rejected'")
    if data.status == "rejected" and not data.rejection_reason:
        raise HTTPException(status_code=400, detail="rejection_reason required when rejecting")

    result = await db.execute(
        select(SupplierDocument).where(
            SupplierDocument.id == doc_id,
            SupplierDocument.supplier_id == supplier_id,
            SupplierDocument.vendor_id == vendor_id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc.status = data.status
    doc.verified_by = vendor_user.id
    doc.verified_at = datetime.now(timezone.utc)
    doc.rejection_reason = data.rejection_reason
    await db.commit()
    await db.refresh(doc)
    return JSONResponse(content=_doc_to_dict(doc))


@router.delete("/suppliers/{supplier_id}/documents/{doc_id}", status_code=204)
async def delete_supplier_document(
    supplier_id: UUID,
    doc_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    result = await db.execute(
        select(SupplierDocument).where(
            SupplierDocument.id == doc_id,
            SupplierDocument.supplier_id == supplier_id,
            SupplierDocument.vendor_id == vendor_id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    await db.delete(doc)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════
#  SUPPLIER ONBOARDING
# ═══════════════════════════════════════════════════════════════════

@router.get("/suppliers/{supplier_id}/onboarding")
async def get_onboarding(
    supplier_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_supplier_or_404(db, vendor_id, supplier_id)
    result = await db.execute(
        select(SupplierOnboarding).where(
            SupplierOnboarding.supplier_id == supplier_id,
            SupplierOnboarding.vendor_id == vendor_id,
        )
    )
    ob = result.scalar_one_or_none()
    if not ob:
        raise HTTPException(status_code=404, detail="No onboarding record for this supplier")
    return JSONResponse(content=_onboarding_to_dict(ob))


@router.post("/suppliers/{supplier_id}/onboarding", status_code=201)
async def create_onboarding(
    supplier_id: UUID,
    data: SupplierOnboardingCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    await _get_supplier_or_404(db, vendor_id, supplier_id)
    existing = await db.execute(
        select(SupplierOnboarding).where(SupplierOnboarding.supplier_id == supplier_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Onboarding record already exists")

    payload = data.model_dump()
    payload["checklist"] = [item.model_dump() for item in (data.checklist or [])]
    ob = SupplierOnboarding(
        vendor_id=vendor_id,
        supplier_id=supplier_id,
        **{k: v for k, v in payload.items() if v is not None},
    )
    append_audit_log(ob, "created", vendor_user.id)
    db.add(ob)
    await db.commit()
    await db.refresh(ob)
    return JSONResponse(content=_onboarding_to_dict(ob), status_code=201)


@router.put("/suppliers/{supplier_id}/onboarding")
async def update_onboarding(
    supplier_id: UUID,
    data: SupplierOnboardingUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    result = await db.execute(
        select(SupplierOnboarding).where(
            SupplierOnboarding.supplier_id == supplier_id,
            SupplierOnboarding.vendor_id == vendor_id,
        )
    )
    ob = result.scalar_one_or_none()
    if not ob:
        raise HTTPException(status_code=404, detail="Onboarding record not found")
    if ob.status in ("approved",):
        raise HTTPException(status_code=400, detail="Cannot edit an approved onboarding record")

    payload = data.model_dump(exclude_none=True)
    if "checklist" in payload:
        payload["checklist"] = [item.model_dump() for item in (data.checklist or [])]
    for field, val in payload.items():
        setattr(ob, field, val)
    append_audit_log(ob, "updated", vendor_user.id)
    await db.commit()
    await db.refresh(ob)
    return JSONResponse(content=_onboarding_to_dict(ob))


_REVIEW_ACTIONS: frozenset[str] = frozenset({"approve", "reject", "put_on_hold", "blacklist"})

_REVIEW_TRANSITIONS: dict[str, tuple[str, ...]] = {
    "approve": ("submitted", "under_review"),
    "reject": ("submitted", "under_review"),
    "put_on_hold": ("submitted", "under_review", "approved"),
    "blacklist": ("approved", "on_hold", "submitted", "under_review"),
}

_ACTION_TO_STATUS: dict[str, str] = {
    "approve": "approved",
    "reject": "rejected",
    "put_on_hold": "on_hold",
    "blacklist": "blacklisted",
}


async def _get_onboarding_or_404(db: AsyncSession, vendor_id: UUID, supplier_id: UUID) -> SupplierOnboarding:
    result = await db.execute(
        select(SupplierOnboarding).where(
            SupplierOnboarding.supplier_id == supplier_id,
            SupplierOnboarding.vendor_id == vendor_id,
        )
    )
    ob = result.scalar_one_or_none()
    if not ob:
        raise HTTPException(status_code=404, detail="Onboarding record not found")
    return ob


@router.post("/suppliers/{supplier_id}/onboarding/submit")
async def submit_onboarding(
    supplier_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    ob = await _get_onboarding_or_404(db, vendor_id, supplier_id)
    if ob.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft onboarding can be submitted")
    ob.status = "submitted"
    append_audit_log(ob, "submitted", vendor_user.id)
    await db.commit()
    await db.refresh(ob)
    return JSONResponse(content=_onboarding_to_dict(ob))


@router.post("/suppliers/{supplier_id}/onboarding/start-review")
async def start_review_onboarding(
    supplier_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _APPROVE,
):
    """Move a submitted onboarding into under_review so that approver takes ownership."""
    ob = await _get_onboarding_or_404(db, vendor_id, supplier_id)
    if ob.status != "submitted":
        raise HTTPException(status_code=400, detail="Only submitted onboarding can be moved to under_review")
    ob.status = "under_review"
    ob.reviewed_by = vendor_user.id
    ob.reviewed_at = datetime.now(timezone.utc)
    append_audit_log(ob, "start_review", vendor_user.id)
    await db.commit()
    await db.refresh(ob)
    return JSONResponse(content=_onboarding_to_dict(ob))


@router.post("/suppliers/{supplier_id}/onboarding/review")
async def review_onboarding(
    supplier_id: UUID,
    data: OnboardingReviewRequest,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vendor_user: VendorUser = Depends(get_current_vendor_user),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _APPROVE,
):
    if data.action not in _REVIEW_ACTIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid action '{data.action}'. Choose from: {sorted(_REVIEW_ACTIONS)}",
        )
    if data.action == "reject" and not data.rejection_reason:
        raise HTTPException(status_code=400, detail="rejection_reason is required when rejecting")

    ob = await _get_onboarding_or_404(db, vendor_id, supplier_id)

    allowed_from = _REVIEW_TRANSITIONS[data.action]
    if ob.status not in allowed_from:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot '{data.action}' from status '{ob.status}'. Allowed from: {list(allowed_from)}",
        )

    now = datetime.now(timezone.utc)
    ob.status = _ACTION_TO_STATUS[data.action]
    ob.reviewed_by = vendor_user.id
    ob.reviewed_at = now

    if data.action == "approve":
        ob.approved_at = now
        if data.qualification_score is not None:
            ob.qualification_score = Decimal(str(data.qualification_score))
        # Approved supplier becomes active
        sup = await _get_supplier_or_404(db, vendor_id, supplier_id)
        sup.is_active = True

    if data.action == "blacklist":
        # Blacklisted supplier is deactivated immediately
        sup = await _get_supplier_or_404(db, vendor_id, supplier_id)
        sup.is_active = False

    if data.rejection_reason:
        ob.rejection_reason = data.rejection_reason
    if data.internal_notes:
        ob.internal_notes = data.internal_notes
    append_audit_log(ob, data.action, vendor_user.id,
                     reason=data.rejection_reason, notes=data.internal_notes)
    await db.commit()
    await db.refresh(ob)
    return JSONResponse(content=_onboarding_to_dict(ob))


# ═══════════════════════════════════════════════════════════════════
#  SUPPLIER PERFORMANCE
# ═══════════════════════════════════════════════════════════════════

@router.get("/suppliers/{supplier_id}/performance")
async def list_supplier_performance(
    supplier_id: UUID,
    period_type: Optional[str] = Query(None),
    limit: int = Query(12, ge=1, le=60),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    await _get_supplier_or_404(db, vendor_id, supplier_id)
    stmt = (
        select(SupplierPerformance)
        .where(
            SupplierPerformance.supplier_id == supplier_id,
            SupplierPerformance.vendor_id == vendor_id,
        )
        .order_by(SupplierPerformance.period_start.desc())
        .limit(limit)
    )
    if period_type:
        stmt = stmt.where(SupplierPerformance.period_type == period_type)
    result = await db.execute(stmt)
    perfs = result.scalars().all()
    return JSONResponse(content={"items": [_perf_to_dict(p) for p in perfs]})


@router.post("/suppliers/{supplier_id}/performance", status_code=201)
async def create_supplier_performance(
    supplier_id: UUID,
    data: SupplierPerformanceCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _: VendorUser = _MANAGE,
):
    await _get_supplier_or_404(db, vendor_id, supplier_id)
    perf = SupplierPerformance(
        vendor_id=vendor_id,
        supplier_id=supplier_id,
        **data.model_dump(),
    )
    perf.overall_score = _compute_overall_score(perf)
    db.add(perf)
    await db.commit()
    await db.refresh(perf)
    return JSONResponse(content=_perf_to_dict(perf), status_code=201)


@router.get("/suppliers/{supplier_id}/performance/summary")
async def get_performance_summary(
    supplier_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Return the latest scorecard and a rolling average of the last 4 periods."""
    await _get_supplier_or_404(db, vendor_id, supplier_id)
    result = await db.execute(
        select(SupplierPerformance)
        .where(
            SupplierPerformance.supplier_id == supplier_id,
            SupplierPerformance.vendor_id == vendor_id,
        )
        .order_by(SupplierPerformance.period_start.desc())
        .limit(4)
    )
    perfs = result.scalars().all()
    if not perfs:
        return JSONResponse(content={"latest": None, "avg_score_4p": None, "periods": []})

    scores = [float(p.overall_score) for p in perfs if p.overall_score is not None]
    avg = round(sum(scores) / len(scores), 2) if scores else None
    return JSONResponse(content={
        "latest": _perf_to_dict(perfs[0]),
        "avg_score_4p": avg,
        "periods": [_perf_to_dict(p) for p in perfs],
    })
