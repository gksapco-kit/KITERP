# app/schemas/procurement_special.py
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID
from decimal import Decimal
from enum import Enum


class ValuationMethod(str, Enum):
    MOVING_AVERAGE = "moving_average"
    STANDARD_PRICE = "standard_price"


# ── Material Valuation ────────────────────────────────────────────

class MaterialValuationCreate(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    plant_id: Optional[str] = None
    valuation_method: Optional[ValuationMethod] = ValuationMethod.MOVING_AVERAGE
    currency: Optional[str] = Field("INR", max_length=3)
    standard_price: Optional[float] = Field(0, ge=0)
    moving_avg_price: Optional[float] = Field(0, ge=0)


class MaterialValuationUpdate(BaseModel):
    valuation_method: Optional[ValuationMethod] = None
    standard_price: Optional[float] = None
    moving_avg_price: Optional[float] = None


class MaterialValuationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    vendor_id: str
    product_id: str
    variant_id: Optional[str] = None
    plant_id: Optional[str] = None
    valuation_method: str = "moving_average"
    currency: str = "INR"
    standard_price: float = 0
    moving_avg_price: float = 0
    total_stock: float = 0
    total_value: float = 0
    last_po_price: float = 0
    last_purchase_date: Optional[str] = None
    updated_at: Optional[str] = None

    @field_validator("id", "vendor_id", "product_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("variant_id", "plant_id", mode="before")
    @classmethod
    def coerce_optional_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator(
        "standard_price", "moving_avg_price", "total_stock", "total_value", "last_po_price",
        mode="before",
    )
    @classmethod
    def coerce_decimal(cls, v):
        if isinstance(v, Decimal):
            return float(v)
        return float(v) if v is not None else 0

    @field_validator("last_purchase_date", "updated_at", mode="before")
    @classmethod
    def coerce_dt(cls, v):
        if isinstance(v, (datetime, date)):
            return v.isoformat()
        return v


class MaterialValuationListResponse(BaseModel):
    items: List[MaterialValuationResponse]
    total: int


# ── Subcontracting Order ──────────────────────────────────────────

class SubcontractingOrderCreate(BaseModel):
    purchase_order_id: str
    supplier_id: str
    plant_id: Optional[str] = None
    ref: str = Field(..., min_length=1, max_length=30)
    components: List[dict] = Field(..., min_length=1)
    finished_product_id: Optional[str] = None
    finished_variant_id: Optional[str] = None
    qty_expected: Optional[float] = Field(0, ge=0)
    notes: Optional[str] = None


class SubcontractingOrderUpdate(BaseModel):
    status: Optional[str] = None
    components: Optional[List[dict]] = None
    qty_received: Optional[float] = None
    notes: Optional[str] = None


class SubcontractingOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    vendor_id: str
    purchase_order_id: str
    supplier_id: str
    plant_id: Optional[str] = None
    ref: str
    status: str = "open"
    components: list = []
    finished_product_id: Optional[str] = None
    finished_variant_id: Optional[str] = None
    qty_expected: float = 0
    qty_received: float = 0
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @field_validator("id", "vendor_id", "purchase_order_id", "supplier_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("plant_id", "finished_product_id", "finished_variant_id", mode="before")
    @classmethod
    def coerce_optional_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("qty_expected", "qty_received", mode="before")
    @classmethod
    def coerce_decimal(cls, v):
        if isinstance(v, Decimal):
            return float(v)
        return float(v) if v is not None else 0

    @field_validator("created_at", "updated_at", mode="before")
    @classmethod
    def coerce_dt(cls, v):
        if isinstance(v, (datetime, date)):
            return v.isoformat()
        return v


# ── Consignment Stock ─────────────────────────────────────────────

class ConsignmentStockResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    vendor_id: str
    supplier_id: str
    product_id: str
    variant_id: Optional[str] = None
    plant_id: Optional[str] = None
    storage_location_id: Optional[str] = None
    quantity_available: float = 0
    quantity_withdrawn: float = 0
    unit_price: float = 0
    currency: str = "INR"
    updated_at: Optional[str] = None

    @field_validator("id", "vendor_id", "supplier_id", "product_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("variant_id", "plant_id", "storage_location_id", mode="before")
    @classmethod
    def coerce_optional_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("quantity_available", "quantity_withdrawn", "unit_price", mode="before")
    @classmethod
    def coerce_decimal(cls, v):
        if isinstance(v, Decimal):
            return float(v)
        return float(v) if v is not None else 0

    @field_validator("updated_at", mode="before")
    @classmethod
    def coerce_dt(cls, v):
        if isinstance(v, (datetime, date)):
            return v.isoformat()
        return v


# ── Service Entry Sheet ───────────────────────────────────────────

class ServiceEntrySheetCreate(BaseModel):
    purchase_order_id: str
    supplier_id: str
    entry_number: str = Field(..., min_length=1, max_length=30)
    service_period_from: Optional[date] = None
    service_period_to: Optional[date] = None
    lines: List[dict] = Field(..., min_length=1)
    total_amount: float = Field(0, ge=0)
    currency: Optional[str] = Field("INR", max_length=3)
    notes: Optional[str] = None


class ServiceEntrySheetUpdate(BaseModel):
    service_period_from: Optional[date] = None
    service_period_to: Optional[date] = None
    lines: Optional[List[dict]] = None
    total_amount: Optional[float] = None
    notes: Optional[str] = None


class ServiceEntrySheetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    vendor_id: str
    purchase_order_id: str
    supplier_id: str
    entry_number: str
    status: str = "draft"
    service_period_from: Optional[str] = None
    service_period_to: Optional[str] = None
    lines: list = []
    total_amount: float = 0
    currency: str = "INR"
    accepted_by: Optional[str] = None
    accepted_at: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @field_validator("id", "vendor_id", "purchase_order_id", "supplier_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("accepted_by", mode="before")
    @classmethod
    def coerce_optional_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("total_amount", mode="before")
    @classmethod
    def coerce_decimal(cls, v):
        if isinstance(v, Decimal):
            return float(v)
        return float(v) if v is not None else 0

    @field_validator(
        "service_period_from", "service_period_to", "accepted_at", "created_at", "updated_at",
        mode="before",
    )
    @classmethod
    def coerce_dt(cls, v):
        if isinstance(v, (datetime, date)):
            return v.isoformat()
        return v


class ServiceEntrySheetListResponse(BaseModel):
    items: List[ServiceEntrySheetResponse]
    total: int
