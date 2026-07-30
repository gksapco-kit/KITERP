# app/schemas/procurement.py
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID
from enum import Enum
from decimal import Decimal


# ── Enums ────────────────────────────────────────────────────────

class PurchaseOrderStatus(str, Enum):
    DRAFT = "draft"
    SENT = "sent"
    PARTIAL_RECEIVED = "partial_received"
    RECEIVED = "received"
    CLOSED = "closed"
    CANCELLED = "cancelled"


# ── Supplier Schemas ─────────────────────────────────────────────

class SupplierAddress(BaseModel):
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = "India"


_GSTIN_RE = r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
_PAN_RE = r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$"


def _validate_gstin_field(v: Optional[str]) -> Optional[str]:
    import re
    if v:
        v = v.upper().strip()
        if not re.match(_GSTIN_RE, v):
            raise ValueError("Invalid GSTIN format (must be 15 chars, e.g. 36AABCS1429B1ZV)")
    return v or None


def _validate_pan_field(v: Optional[str]) -> Optional[str]:
    import re
    if v:
        v = v.upper().strip()
        if not re.match(_PAN_RE, v):
            raise ValueError("Invalid PAN format (must be 10 chars, e.g. ABCDE1234F)")
    return v or None


class SupplierCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    party_type: Optional[str] = Field("supplier", pattern=r"^(supplier|employee|partner|contractor)$")
    contact_name: Optional[str] = Field(None, max_length=255)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=30)
    address: Optional[SupplierAddress] = None
    notes: Optional[str] = None
    gstin: Optional[str] = Field(None, max_length=15)
    pan_number: Optional[str] = Field(None, max_length=10)
    cin: Optional[str] = Field(None, max_length=21)
    company_name: Optional[str] = Field(None, max_length=255)
    opening_balance: Optional[float] = 0
    bank_name: Optional[str] = Field(None, max_length=100)
    account_number: Optional[str] = Field(None, max_length=30)
    account_holder_name: Optional[str] = Field(None, max_length=255)
    account_type: Optional[str] = Field("savings", pattern=r"^(savings|current)$")
    ifsc_code: Optional[str] = Field(None, max_length=15)

    @field_validator("gstin", mode="before")
    @classmethod
    def validate_gstin(cls, v):
        return _validate_gstin_field(v)

    @field_validator("pan_number", mode="before")
    @classmethod
    def validate_pan(cls, v):
        return _validate_pan_field(v)


class SupplierUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    party_type: Optional[str] = Field(None, pattern=r"^(supplier|employee|partner|contractor)$")
    contact_name: Optional[str] = Field(None, max_length=255)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=30)
    address: Optional[SupplierAddress] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None
    gstin: Optional[str] = Field(None, max_length=15)
    pan_number: Optional[str] = Field(None, max_length=10)
    cin: Optional[str] = Field(None, max_length=21)
    company_name: Optional[str] = Field(None, max_length=255)
    opening_balance: Optional[float] = None
    bank_name: Optional[str] = Field(None, max_length=100)
    account_number: Optional[str] = Field(None, max_length=30)
    account_holder_name: Optional[str] = Field(None, max_length=255)
    account_type: Optional[str] = Field(None, pattern=r"^(savings|current)$")
    ifsc_code: Optional[str] = Field(None, max_length=15)

    @field_validator("gstin", mode="before")
    @classmethod
    def validate_gstin(cls, v):
        return _validate_gstin_field(v)

    @field_validator("pan_number", mode="before")
    @classmethod
    def validate_pan(cls, v):
        return _validate_pan_field(v)


class SupplierResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    vendor_id: str
    name: str
    party_type: str = "supplier"
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[dict] = None
    notes: Optional[str] = None
    is_active: bool = True
    gstin: Optional[str] = None
    pan_number: Optional[str] = None
    cin: Optional[str] = None
    company_name: Optional[str] = None
    opening_balance: Optional[float] = 0
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    account_holder_name: Optional[str] = None
    account_type: Optional[str] = None
    ifsc_code: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @field_validator("id", "vendor_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("created_at", "updated_at", mode="before")
    @classmethod
    def coerce_datetime(cls, v):
        if isinstance(v, datetime):
            return v.isoformat()
        return v


class SupplierListResponse(BaseModel):
    items: List[SupplierResponse]
    total: int


# ── Purchase Order Item Schemas ──────────────────────────────────

class PurchaseOrderItemCreate(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    quantity: int = Field(..., gt=0)
    unit_cost: float = Field(..., ge=0)
    plant_id: Optional[str] = None
    storage_location_id: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None


class PurchaseOrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    purchase_order_id: str
    product_id: str
    variant_id: Optional[str] = None
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    variant_name: Optional[str] = None
    variant_sku: Optional[str] = None
    variant_barcode: Optional[str] = None
    quantity_ordered: int
    quantity_received: int = 0
    unit_cost: float = 0
    total_cost: float = 0
    plant_id: Optional[str] = None
    storage_location_id: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("id", "purchase_order_id", "product_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("variant_id", "plant_id", "storage_location_id", mode="before")
    @classmethod
    def coerce_optional_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("unit_cost", "total_cost", mode="before")
    @classmethod
    def coerce_decimal(cls, v):
        if isinstance(v, Decimal):
            return float(v)
        return float(v) if v is not None else 0

# ── Purchase Order Schemas ───────────────────────────────────────

class PurchaseOrderCreate(BaseModel):
    supplier_id: str
    items: List[PurchaseOrderItemCreate] = Field(..., min_length=1)
    expected_delivery_date: Optional[date] = None
    notes: Optional[str] = None


class PurchaseOrderUpdate(BaseModel):
    supplier_id: Optional[str] = None
    items: Optional[List[PurchaseOrderItemCreate]] = None
    expected_delivery_date: Optional[date] = None
    notes: Optional[str] = None


class ReceiveItemEntry(BaseModel):
    item_id: str
    quantity: float = Field(..., gt=0)
    batch_number: Optional[str] = None
    supplier_batch_number: Optional[str] = None  # external / supplier lot ID
    manufacturing_date: Optional[date] = None
    expiry_date: Optional[date] = None
    track_id: Optional[str] = None
    reference: Optional[str] = None
    plant_id: Optional[str] = None
    storage_location_id: Optional[str] = None


class ReceiveItemsRequest(BaseModel):
    items: List[ReceiveItemEntry] = Field(..., min_length=1)
    notes: Optional[str] = None
    plant_id: Optional[str] = None
    storage_location_id: Optional[str] = None
    posting_date: Optional[date] = None


class PurchaseOrderReceiptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    purchase_order_id: str
    received_by: Optional[str] = None
    received_at: Optional[str] = None
    notes: Optional[str] = None
    items: list = []

    @field_validator("id", "purchase_order_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("received_by", mode="before")
    @classmethod
    def coerce_optional_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("received_at", mode="before")
    @classmethod
    def coerce_datetime(cls, v):
        if isinstance(v, datetime):
            return v.isoformat()
        return v


class PurchaseOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    vendor_id: str
    supplier_id: str
    supplier_name: Optional[str] = None
    po_number: str
    status: str
    order_date: Optional[str] = None
    expected_delivery_date: Optional[str] = None
    notes: Optional[str] = None
    subtotal: float = 0
    tax_amount: float = 0
    total: float = 0
    created_by: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    received_at: Optional[str] = None
    closed_at: Optional[str] = None
    items: List[PurchaseOrderItemResponse] = []
    receipts: List[PurchaseOrderReceiptResponse] = []

    @field_validator("id", "vendor_id", "supplier_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("created_by", mode="before")
    @classmethod
    def coerce_optional_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("subtotal", "tax_amount", "total", mode="before")
    @classmethod
    def coerce_decimal(cls, v):
        if isinstance(v, Decimal):
            return float(v)
        return float(v) if v is not None else 0

    @field_validator(
        "order_date", "expected_delivery_date",
        "created_at", "updated_at", "received_at", "closed_at",
        mode="before",
    )
    @classmethod
    def coerce_datetime(cls, v):
        if isinstance(v, (datetime, date)):
            return v.isoformat()
        return v


class PurchaseOrderListResponse(BaseModel):
    items: List[PurchaseOrderResponse]
    total: int
    page: int
    size: int
    pages: int
