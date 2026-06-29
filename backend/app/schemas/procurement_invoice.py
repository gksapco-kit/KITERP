# app/schemas/procurement_invoice.py
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID
from decimal import Decimal
from enum import Enum


class InvoiceStatus(str, Enum):
    DRAFT = "draft"
    POSTED = "posted"
    MATCHED = "matched"
    PARTIAL_MATCH = "partial_match"
    BLOCKED = "blocked"
    PAID = "paid"
    CANCELLED = "cancelled"


class MatchStatus(str, Enum):
    UNMATCHED = "unmatched"
    MATCHED = "matched"
    PARTIAL = "partial"
    BLOCKED_QTY = "blocked_qty"
    BLOCKED_PRICE = "blocked_price"


# ── Invoice Item ──────────────────────────────────────────────────

class VendorInvoiceItemCreate(BaseModel):
    po_item_id: Optional[str] = None
    product_id: str
    variant_id: Optional[str] = None
    invoiced_qty: float = Field(..., gt=0)
    unit_price: float = Field(..., ge=0)
    hsn_code: Optional[str] = Field(None, max_length=10)
    tax_code: Optional[str] = None
    cgst_rate: Optional[float] = Field(0, ge=0)
    sgst_rate: Optional[float] = Field(0, ge=0)
    igst_rate: Optional[float] = Field(0, ge=0)
    notes: Optional[str] = None


class VendorInvoiceItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    invoice_id: str
    po_item_id: Optional[str] = None
    product_id: str
    variant_id: Optional[str] = None
    ordered_qty: float = 0
    received_qty: float = 0
    invoiced_qty: float
    po_unit_price: float = 0
    unit_price: float
    hsn_code: Optional[str] = None
    tax_code: Optional[str] = None
    cgst_rate: float = 0
    sgst_rate: float = 0
    igst_rate: float = 0
    cgst_amount: float = 0
    sgst_amount: float = 0
    igst_amount: float = 0
    subtotal: float = 0
    tax_total: float = 0
    total: float = 0
    qty_variance: float = 0
    price_variance: float = 0
    match_status: str = "unmatched"
    notes: Optional[str] = None

    @field_validator("id", "invoice_id", "product_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("po_item_id", "variant_id", mode="before")
    @classmethod
    def coerce_optional_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator(
        "ordered_qty", "received_qty", "invoiced_qty",
        "po_unit_price", "unit_price",
        "cgst_rate", "sgst_rate", "igst_rate",
        "cgst_amount", "sgst_amount", "igst_amount",
        "subtotal", "tax_total", "total",
        "qty_variance", "price_variance",
        mode="before",
    )
    @classmethod
    def coerce_decimal(cls, v):
        if isinstance(v, Decimal):
            return float(v)
        return float(v) if v is not None else 0


# ── Vendor Invoice ────────────────────────────────────────────────

class VendorInvoiceCreate(BaseModel):
    supplier_id: str
    purchase_order_id: Optional[str] = None
    invoice_number: str = Field(..., min_length=1, max_length=50)
    supplier_invoice_number: Optional[str] = Field(None, max_length=50)
    invoice_date: date
    due_date: Optional[date] = None
    posting_date: Optional[date] = None
    currency: Optional[str] = Field("INR", max_length=3)
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    items: List[VendorInvoiceItemCreate] = Field(..., min_length=1)


class VendorInvoiceUpdate(BaseModel):
    supplier_invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    posting_date: Optional[date] = None
    payment_terms: Optional[str] = None
    notes: Optional[str] = None


class VendorInvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    vendor_id: str
    supplier_id: str
    supplier_name: Optional[str] = None
    purchase_order_id: Optional[str] = None
    invoice_number: str
    supplier_invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    posting_date: Optional[str] = None
    status: str = "draft"
    match_status: str = "unmatched"
    currency: str = "INR"
    subtotal: float = 0
    cgst_amount: float = 0
    sgst_amount: float = 0
    igst_amount: float = 0
    tax_amount: float = 0
    total: float = 0
    amount_paid: float = 0
    amount_due: float = 0
    payment_terms: Optional[str] = None
    block_reason: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    items: List[VendorInvoiceItemResponse] = []

    @field_validator("id", "vendor_id", "supplier_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("purchase_order_id", mode="before")
    @classmethod
    def coerce_optional_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator(
        "subtotal", "cgst_amount", "sgst_amount", "igst_amount",
        "tax_amount", "total", "amount_paid", "amount_due",
        mode="before",
    )
    @classmethod
    def coerce_decimal(cls, v):
        if isinstance(v, Decimal):
            return float(v)
        return float(v) if v is not None else 0

    @field_validator(
        "invoice_date", "due_date", "posting_date", "created_at", "updated_at",
        mode="before",
    )
    @classmethod
    def coerce_dt(cls, v):
        if isinstance(v, (datetime, date)):
            return v.isoformat()
        return v


class VendorInvoiceListResponse(BaseModel):
    items: List[VendorInvoiceResponse]
    total: int
    page: int
    size: int
    pages: int


# ── 3-way match trigger ───────────────────────────────────────────

class RunMatchRequest(BaseModel):
    """Trigger the 3-way match calculation on an invoice."""
    invoice_id: str
    qty_tolerance_pct: Optional[float] = Field(0.0, ge=0, le=100)     # % over/under allowed on qty
    price_tolerance_pct: Optional[float] = Field(0.0, ge=0, le=100)   # % over/under allowed on price
