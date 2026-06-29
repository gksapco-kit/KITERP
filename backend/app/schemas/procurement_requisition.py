# app/schemas/procurement_requisition.py
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID
from decimal import Decimal
from enum import Enum


class PRStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    PARTIALLY_CONVERTED = "partially_converted"
    CONVERTED = "converted"
    CANCELLED = "cancelled"


class PRPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SKIPPED = "skipped"


# ── Requisition Item ──────────────────────────────────────────────

class PRItemCreate(BaseModel):
    item_type: Optional[str] = Field("product", pattern="^(product|service|asset|consumption|other)$")
    product_id: Optional[str] = None
    service_id: Optional[str] = None
    variant_id: Optional[str] = None
    description: Optional[str] = None
    asset_category_id: Optional[str] = None
    quantity: float = Field(..., gt=0)
    unit_of_measure: Optional[str] = Field("PCS", max_length=20)
    needed_by_date: Optional[date] = None
    plant_id: Optional[str] = None
    storage_location_id: Optional[str] = None
    estimated_price: Optional[float] = Field(0, ge=0)
    suggested_supplier_id: Optional[str] = None
    notes: Optional[str] = None


class PRItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    requisition_id: str
    item_type: str = "product"
    product_id: Optional[str] = None
    service_id: Optional[str] = None
    variant_id: Optional[str] = None
    description: Optional[str] = None
    asset_category_id: Optional[str] = None
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    service_name: Optional[str] = None
    quantity: float
    unit_of_measure: str = "PCS"
    needed_by_date: Optional[str] = None
    plant_id: Optional[str] = None
    storage_location_id: Optional[str] = None
    estimated_price: float = 0
    suggested_supplier_id: Optional[str] = None
    quantity_ordered: float = 0
    purchase_order_id: Optional[str] = None
    is_converted: bool = False
    notes: Optional[str] = None

    @field_validator("id", "requisition_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("product_id", "service_id", mode="before")
    @classmethod
    def coerce_optional_ref_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator(
        "variant_id", "plant_id", "storage_location_id",
        "suggested_supplier_id", "purchase_order_id", "asset_category_id", mode="before"
    )
    @classmethod
    def coerce_optional_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("quantity", "quantity_ordered", "estimated_price", mode="before")
    @classmethod
    def coerce_decimal(cls, v):
        if isinstance(v, Decimal):
            return float(v)
        return float(v) if v is not None else 0

    @field_validator("needed_by_date", mode="before")
    @classmethod
    def coerce_date(cls, v):
        if isinstance(v, (datetime, date)):
            return v.isoformat()
        return v


# ── Approval ──────────────────────────────────────────────────────

class PRApprovalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    requisition_id: str
    level: int
    approver_id: Optional[str] = None
    status: str = "pending"
    comments: Optional[str] = None
    actioned_at: Optional[str] = None
    created_at: Optional[str] = None

    @field_validator("id", "requisition_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("approver_id", mode="before")
    @classmethod
    def coerce_optional_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("actioned_at", "created_at", mode="before")
    @classmethod
    def coerce_dt(cls, v):
        if isinstance(v, (datetime, date)):
            return v.isoformat()
        return v


class ApproveRejectRequest(BaseModel):
    status: ApprovalStatus  # approved | rejected
    comments: Optional[str] = None


class PRApproverAssign(BaseModel):
    approver_id: str
    level: int = Field(1, ge=1, le=5)


# ── Purchase Requisition ──────────────────────────────────────────

class PurchaseRequisitionCreate(BaseModel):
    items: List[PRItemCreate] = Field(..., min_length=1)
    requisition_type: Optional[str] = Field("product", pattern="^(product|service|asset|consumption|other)$")
    department: Optional[str] = None
    priority: Optional[PRPriority] = PRPriority.MEDIUM
    notes: Optional[str] = None
    approvers: List[PRApproverAssign] = Field(default_factory=list)
    approver_message: Optional[str] = None
    store_id: Optional[str] = None
    procurement_source: Optional[str] = Field("supplier", pattern="^(supplier|internal)$")
    bu_scope: Optional[str] = Field(None, pattern="^(within_bu|cross_bu)$")
    from_store_id: Optional[str] = None
    to_store_id: Optional[str] = None
    header_supplier_id: Optional[str] = None


class PurchaseRequisitionUpdate(BaseModel):
    requisition_type: Optional[str] = Field(None, pattern="^(product|service|asset|consumption|other)$")
    department: Optional[str] = None
    priority: Optional[PRPriority] = None
    notes: Optional[str] = None
    approver_message: Optional[str] = None
    approvers: Optional[List[PRApproverAssign]] = None
    store_id: Optional[str] = None
    procurement_source: Optional[str] = Field(None, pattern="^(supplier|internal)$")
    bu_scope: Optional[str] = Field(None, pattern="^(within_bu|cross_bu)$")
    from_store_id: Optional[str] = None
    to_store_id: Optional[str] = None
    header_supplier_id: Optional[str] = None
    items: Optional[List[PRItemCreate]] = None


class PurchaseRequisitionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    vendor_id: str
    pr_number: str
    status: str
    requisition_type: str = "product"
    department: Optional[str] = None
    priority: str = "medium"
    store_id: Optional[str] = None
    store_name: Optional[str] = None
    procurement_source: str = "supplier"
    bu_scope: Optional[str] = None
    from_store_id: Optional[str] = None
    from_store_name: Optional[str] = None
    to_store_id: Optional[str] = None
    to_store_name: Optional[str] = None
    header_supplier_id: Optional[str] = None
    header_supplier_name: Optional[str] = None
    notes: Optional[str] = None
    approver_message: Optional[str] = None
    submitted_at: Optional[str] = None
    approved_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    items: List[PRItemResponse] = []
    approvals: List[PRApprovalResponse] = []

    @field_validator("id", "vendor_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("submitted_at", "approved_at", "created_at", "updated_at", mode="before")
    @classmethod
    def coerce_dt(cls, v):
        if isinstance(v, (datetime, date)):
            return v.isoformat()
        return v


class PurchaseRequisitionListResponse(BaseModel):
    items: List[PurchaseRequisitionResponse]
    total: int
    page: int
    size: int
    pages: int


# ── Convert PR to PO ──────────────────────────────────────────────

class ConvertPRToPORequest(BaseModel):
    supplier_id: str
    item_ids: List[str] = Field(..., min_length=1)  # which PR item ids to convert
    expected_delivery_date: Optional[date] = None
    notes: Optional[str] = None
