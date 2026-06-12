# app/schemas/vendor.py
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator
from typing import Any, Optional, List
from datetime import datetime, date
from uuid import UUID
from enum import Enum
import re


class BusinessType(str, Enum):
    INDIVIDUAL = "individual"
    PARTNERSHIP = "partnership"
    LLC = "llc"
    CORPORATION = "corporation"
    PROPRIETORSHIP = "proprietorship"
    # Legacy / alternate values stored in the DB
    RETAIL = "retail"
    WHOLESALE = "wholesale"
    FRANCHISE = "franchise"
    SOLE_TRADER = "sole_trader"
    PVT_LTD = "pvt_ltd"
    OTHER = "other"


class VendorStatus(str, Enum):
    PENDING = "pending"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"
    DEACTIVATED = "deactivated"


class VerificationStatus(str, Enum):
    PENDING = "pending"
    DOCUMENTS_SUBMITTED = "documents_submitted"
    VERIFIED = "verified"
    REJECTED = "rejected"
    # Legacy / alternate values
    APPROVED = "approved"
    UNDER_REVIEW = "under_review"
    NOT_STARTED = "not_started"


class OfferingType(str, Enum):
    PRODUCTS = "products"
    SERVICES = "services"
    BOTH = "both"


class AddressCreate(BaseModel):
    street_address: str = Field(..., min_length=5, max_length=500)
    city: str = Field(..., min_length=2, max_length=100)
    state: str = Field(..., min_length=2, max_length=100)
    postal_code: str = Field(..., min_length=4, max_length=20)
    country: str = Field(default="India", max_length=100)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    service_radius_km: int = Field(default=10, ge=1, le=500, description="Service delivery radius in kilometres")


class AddressResponse(AddressCreate):
    pass


class VendorCreate(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=255)
    display_name: str = Field(..., min_length=2, max_length=255)
    slug: str = Field(..., min_length=3, max_length=100)
    business_type: BusinessType
    offering_type: OfferingType = Field(default=OfferingType.BOTH)
    industry: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=2000)
    primary_email: EmailStr
    primary_phone: str = Field(..., min_length=10, max_length=20)
    owner_name: str = Field(..., min_length=2, max_length=255)
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    address: AddressCreate

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        if not re.match(r"^[a-z0-9-]+$", v):
            raise ValueError("Slug must contain only lowercase letters, numbers, and hyphens")
        if v.startswith("-") or v.endswith("-"):
            raise ValueError("Slug cannot start or end with a hyphen")
        return v.lower()

    @field_validator("primary_phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        digits = re.sub(r"\D", "", v)
        if len(digits) < 10:
            raise ValueError("Phone number must have at least 10 digits")
        return v


class VendorUpdate(BaseModel):
    business_name: Optional[str] = Field(None, min_length=2, max_length=255)
    display_name: Optional[str] = Field(None, min_length=2, max_length=255)
    offering_type: Optional[OfferingType] = None
    description: Optional[str] = Field(None, max_length=2000)
    support_email: Optional[EmailStr] = None
    support_phone: Optional[str] = None
    gstin: Optional[str] = Field(None, max_length=15, pattern=r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$|^$")
    pan_number: Optional[str] = Field(None, max_length=10)
    is_gst_registered: Optional[bool] = None
    default_tax_rate: Optional[float] = Field(None, ge=0, le=100)
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    business_hours: Optional[dict] = None
    store_holidays: Optional[list] = None
    order_acceptance_enabled: Optional[bool] = None
    order_acceptance_hours: Optional[dict] = None
    social_links: Optional[dict] = None
    settings: Optional[dict] = None
    theme_config: Optional[dict] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    street_address: Optional[str] = Field(None, min_length=5, max_length=500)
    city: Optional[str] = Field(None, min_length=2, max_length=100)
    state: Optional[str] = Field(None, min_length=2, max_length=100)
    postal_code: Optional[str] = Field(None, min_length=4, max_length=20)
    service_radius_km: Optional[int] = Field(None, ge=1, le=500, description="Service delivery radius in km")

    # External domain access
    external_domain_enabled: Optional[bool] = None
    external_domain_scope: Optional[str] = Field(None, pattern=r'^(all|per_unit)$')
    external_domain_dns_mode: Optional[str] = Field(None, pattern=r'^(kit_assisted|self_managed)$')
    external_domain_name: Optional[str] = Field(None, max_length=255)
    external_domain_registrar: Optional[str] = Field(None, max_length=60)
    external_domain_reg_email: Optional[str] = Field(None, max_length=255)
    external_domain_holder: Optional[str] = Field(None, max_length=255)
    external_domain_expiry: Optional[date] = None
    external_domain_access_status: Optional[str] = Field(None, pattern=r'^(not_requested|pending|active|revoked)$')
    external_domain_recovery_contact: Optional[str] = Field(None, max_length=255)
    external_domain_notes: Optional[str] = None


class VendorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    business_name: str
    display_name: str
    slug: str
    subdomain: str
    business_type: Optional[str] = "other"
    offering_type: Optional[str] = "both"
    industry: Optional[str] = None
    description: Optional[str] = None
    primary_email: str
    primary_phone: str
    support_email: Optional[str] = None
    support_phone: Optional[str] = None
    street_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = "India"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    service_radius_km: Optional[int] = 10
    gstin: Optional[str] = None
    pan_number: Optional[str] = None
    is_gst_registered: Optional[bool] = False
    default_tax_rate: Optional[float] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    business_hours: Optional[dict] = None
    store_holidays: Optional[list] = None
    order_acceptance_enabled: Optional[bool] = True
    order_acceptance_hours: Optional[dict] = None
    social_links: Optional[dict] = None
    settings: Optional[dict] = None
    theme_config: Optional[dict] = None
    status: Optional[str] = "pending"
    verification_status: Optional[str] = "pending"
    verified_at: Optional[str] = None
    activated_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    checkout_layout: Optional[str] = None

    # External domain access fields
    external_domain_enabled: Optional[bool] = False
    external_domain_scope: Optional[str] = 'all'
    external_domain_dns_mode: Optional[str] = 'kit_assisted'
    external_domain_name: Optional[str] = None
    external_domain_registrar: Optional[str] = None
    external_domain_reg_email: Optional[str] = None
    external_domain_holder: Optional[str] = None
    external_domain_expiry: Optional[date] = None
    external_domain_access_status: Optional[str] = 'not_requested'
    external_domain_recovery_contact: Optional[str] = None
    external_domain_notes: Optional[str] = None
    external_domain_access_requested_at: Optional[str] = None
    external_domain_access_granted_at: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def extract_theme_fields(cls, data):
        if hasattr(data, "__dict__"):
            tc = getattr(data, "theme_config", None) or {}
            if tc.get("checkout_layout") and not getattr(data, "checkout_layout", None):
                object.__setattr__(data, "checkout_layout", tc["checkout_layout"])
        elif isinstance(data, dict):
            tc = data.get("theme_config") or {}
            if tc.get("checkout_layout") and not data.get("checkout_layout"):
                data["checkout_layout"] = tc["checkout_layout"]
        return data

    @field_validator("id", mode="before")
    @classmethod
    def coerce_id(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("verified_at", "activated_at", "created_at", "updated_at", mode="before")
    @classmethod
    def coerce_datetime(cls, v):
        if isinstance(v, datetime):
            return v.isoformat()
        return v

    @field_validator("latitude", "longitude", mode="before")
    @classmethod
    def coerce_decimal(cls, v):
        if v is not None:
            return float(v)
        return v


class VendorListResponse(BaseModel):
    items: List[VendorResponse]
    total: int
    page: int
    size: int
    pages: int


class RelationshipManagerBrief(BaseModel):
    id: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None


class VendorAdminResponse(VendorResponse):
    """Admin/vendor-directory payload including assigned relationship manager."""

    relationship_manager_user_id: Optional[str] = None
    relationship_manager: Optional[RelationshipManagerBrief] = None


class VendorAdminListResponse(BaseModel):
    items: List[VendorAdminResponse]
    total: int
    page: int
    size: int
    pages: int


def serialize_vendor_admin(vendor: Any) -> VendorAdminResponse:
    """Map ORM Vendor (+ loaded relationship_manager) to admin API shape."""
    base = VendorResponse.model_validate(vendor).model_dump()
    rm_uid = getattr(vendor, "relationship_manager_user_id", None)
    brief = None
    rm = getattr(vendor, "relationship_manager", None)
    if rm is not None:
        brief = RelationshipManagerBrief(
            id=str(rm.id),
            full_name=(rm.full_name or "").strip() or "—",
            email=rm.email,
            phone=getattr(rm, "phone", None),
        )
    return VendorAdminResponse(
        **base,
        relationship_manager_user_id=str(rm_uid) if rm_uid else None,
        relationship_manager=brief,
    )


class NearbyVendorResponse(BaseModel):
    """A vendor result that includes the distance from the querying user."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    business_name: str
    display_name: str
    slug: str
    subdomain: str
    offering_type: str = "both"
    industry: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    service_radius_km: int = 10
    distance_km: float
    status: VendorStatus

    @field_validator("id", mode="before")
    @classmethod
    def coerce_id(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("latitude", "longitude", mode="before")
    @classmethod
    def coerce_decimal(cls, v):
        if v is not None:
            return float(v)
        return v


class NearbyVendorListResponse(BaseModel):
    items: List[NearbyVendorResponse]
    total: int
    page: int
    size: int
    pages: int
    user_location: dict


class SlugCheckRequest(BaseModel):
    slug: str = Field(..., min_length=3, max_length=100)


class SlugCheckResponse(BaseModel):
    available: bool
    suggestions: Optional[List[str]] = None
