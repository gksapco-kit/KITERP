# app/schemas/procurement_supplier.py
"""Pydantic DTOs for the extended Supplier Management API (Phase 1)."""
from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator


# ─────────────────────────────────────────────────────────────────
# Supplier Category
# ─────────────────────────────────────────────────────────────────

class SupplierCategoryCreate(BaseModel):
    name: str
    code: Optional[str] = None
    parent_id: Optional[str] = None
    description: Optional[str] = None


class SupplierCategoryUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    parent_id: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class SupplierCategoryResponse(BaseModel):
    id: str
    vendor_id: str
    name: str
    code: Optional[str] = None
    parent_id: Optional[str] = None
    description: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────
# Supplier Contact
# ─────────────────────────────────────────────────────────────────

class SupplierContactCreate(BaseModel):
    name: str
    designation: Optional[str] = None
    department: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    is_primary: bool = False
    notes: Optional[str] = None


class SupplierContactUpdate(BaseModel):
    name: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    is_primary: Optional[bool] = None
    notes: Optional[str] = None


class SupplierContactResponse(BaseModel):
    id: str
    supplier_id: str
    name: str
    designation: Optional[str] = None
    department: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    is_primary: bool
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────
# Supplier Address
# ─────────────────────────────────────────────────────────────────

class SupplierAddressCreate(BaseModel):
    address_type: str = "billing"
    line1: str
    line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    country: str = "India"
    gstin: Optional[str] = None
    is_default: bool = False


class SupplierAddressUpdate(BaseModel):
    address_type: Optional[str] = None
    line1: Optional[str] = None
    line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    country: Optional[str] = None
    gstin: Optional[str] = None
    is_default: Optional[bool] = None


class SupplierAddressResponse(BaseModel):
    id: str
    supplier_id: str
    address_type: str
    line1: str
    line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    country: str
    gstin: Optional[str] = None
    is_default: bool

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────
# Supplier Document
# ─────────────────────────────────────────────────────────────────

class SupplierDocumentCreate(BaseModel):
    document_type: str
    document_number: Optional[str] = None
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    issuing_authority: Optional[str] = None
    notes: Optional[str] = None


class SupplierDocumentUpdate(BaseModel):
    document_number: Optional[str] = None
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    issuing_authority: Optional[str] = None
    status: Optional[str] = None
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None


class SupplierDocumentResponse(BaseModel):
    id: str
    supplier_id: str
    document_type: str
    document_number: Optional[str] = None
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    issuing_authority: Optional[str] = None
    status: str
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class VerifyDocumentRequest(BaseModel):
    status: str   # valid | rejected
    rejection_reason: Optional[str] = None


# ─────────────────────────────────────────────────────────────────
# Supplier Onboarding
# ─────────────────────────────────────────────────────────────────

class OnboardingChecklistItem(BaseModel):
    item: str
    passed: bool = False
    notes: Optional[str] = None


class SupplierOnboardingCreate(BaseModel):
    payment_terms: Optional[str] = None
    credit_limit: Optional[float] = None
    currency: str = "INR"
    checklist: List[OnboardingChecklistItem] = []
    internal_notes: Optional[str] = None
    re_evaluation_due: Optional[date] = None


class SupplierOnboardingUpdate(BaseModel):
    payment_terms: Optional[str] = None
    credit_limit: Optional[float] = None
    currency: Optional[str] = None
    checklist: Optional[List[OnboardingChecklistItem]] = None
    internal_notes: Optional[str] = None
    re_evaluation_due: Optional[date] = None


class OnboardingReviewRequest(BaseModel):
    action: str   # approve | reject | put_on_hold | blacklist
    qualification_score: Optional[float] = None
    rejection_reason: Optional[str] = None
    internal_notes: Optional[str] = None


class SupplierOnboardingResponse(BaseModel):
    id: str
    supplier_id: str
    status: str
    qualification_score: Optional[float] = None
    payment_terms: Optional[str] = None
    credit_limit: Optional[float] = None
    currency: str
    checklist: list
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    approved_at: Optional[datetime] = None
    re_evaluation_due: Optional[date] = None
    audit_log: list
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────
# Supplier Performance
# ─────────────────────────────────────────────────────────────────

class SupplierPerformanceCreate(BaseModel):
    period_type: str = "monthly"
    period_start: date
    period_end: date
    po_count: int = 0
    on_time_delivery_pct: Optional[float] = None
    quality_acceptance_pct: Optional[float] = None
    price_variance_pct: Optional[float] = None
    response_time_days: Optional[float] = None
    weight_delivery: float = 40
    weight_quality: float = 35
    weight_price: float = 15
    weight_response: float = 10
    comments: Optional[str] = None


class SupplierPerformanceResponse(BaseModel):
    id: str
    supplier_id: str
    period_type: str
    period_start: date
    period_end: date
    po_count: int
    on_time_delivery_pct: Optional[float] = None
    quality_acceptance_pct: Optional[float] = None
    price_variance_pct: Optional[float] = None
    response_time_days: Optional[float] = None
    overall_score: Optional[float] = None
    weight_delivery: float
    weight_quality: float
    weight_price: float
    weight_response: float
    comments: Optional[str] = None
    computed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────
# Category assignment
# ─────────────────────────────────────────────────────────────────

class AssignCategoriesRequest(BaseModel):
    category_ids: List[str]
