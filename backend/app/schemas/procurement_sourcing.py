# app/schemas/procurement_sourcing.py
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID
from decimal import Decimal


# ── Purchasing Info Record ────────────────────────────────────────

class PurchasingInfoRecordCreate(BaseModel):
    supplier_id: str
    product_id: str
    variant_id: Optional[str] = None
    plant_id: Optional[str] = None

    currency: Optional[str] = Field("INR", max_length=3)
    price: float = Field(..., ge=0)
    price_unit: Optional[int] = Field(1, ge=1)

    min_order_qty: Optional[float] = Field(1, ge=0)
    max_order_qty: Optional[float] = None
    order_unit: Optional[str] = Field("PCS", max_length=20)

    lead_time_days: Optional[int] = Field(0, ge=0)
    planned_delivery_days: Optional[int] = Field(0, ge=0)

    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    notes: Optional[str] = None


class PurchasingInfoRecordUpdate(BaseModel):
    supplier_id: Optional[str] = None
    product_id: Optional[str] = None
    variant_id: Optional[str] = None
    plant_id: Optional[str] = None

    currency: Optional[str] = Field(None, max_length=3)
    price: Optional[float] = Field(None, ge=0)
    price_unit: Optional[int] = Field(None, ge=1)

    min_order_qty: Optional[float] = None
    max_order_qty: Optional[float] = None
    order_unit: Optional[str] = None

    lead_time_days: Optional[int] = None
    planned_delivery_days: Optional[int] = None

    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class PurchasingInfoRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    vendor_id: str
    supplier_id: str
    product_id: str
    variant_id: Optional[str] = None
    plant_id: Optional[str] = None
    currency: str = "INR"
    price: float = 0
    price_unit: int = 1
    min_order_qty: float = 1
    max_order_qty: Optional[float] = None
    order_unit: str = "PCS"
    lead_time_days: int = 0
    planned_delivery_days: int = 0
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None
    is_active: bool = True
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @field_validator("id", "vendor_id", "supplier_id", "product_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("variant_id", "plant_id", mode="before")
    @classmethod
    def coerce_optional_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("price", "min_order_qty", "max_order_qty", mode="before")
    @classmethod
    def coerce_decimal(cls, v):
        if isinstance(v, Decimal):
            return float(v)
        return float(v) if v is not None else None

    @field_validator("valid_from", "valid_to", "created_at", "updated_at", mode="before")
    @classmethod
    def coerce_date(cls, v):
        if isinstance(v, (datetime, date)):
            return v.isoformat()
        return v


class PurchasingInfoRecordListResponse(BaseModel):
    items: List[PurchasingInfoRecordResponse]
    total: int


# ── Source List ───────────────────────────────────────────────────

class SourceListCreate(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    supplier_id: str
    plant_id: Optional[str] = None

    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    is_fixed: Optional[bool] = False
    is_blocked: Optional[bool] = False
    priority: Optional[int] = Field(0, ge=0)
    notes: Optional[str] = None


class SourceListUpdate(BaseModel):
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    is_fixed: Optional[bool] = None
    is_blocked: Optional[bool] = None
    priority: Optional[int] = None
    notes: Optional[str] = None


class SourceListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    vendor_id: str
    product_id: str
    variant_id: Optional[str] = None
    supplier_id: str
    plant_id: Optional[str] = None
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None
    is_fixed: bool = False
    is_blocked: bool = False
    priority: int = 0
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @field_validator("id", "vendor_id", "product_id", "supplier_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("variant_id", "plant_id", mode="before")
    @classmethod
    def coerce_optional_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("valid_from", "valid_to", "created_at", "updated_at", mode="before")
    @classmethod
    def coerce_date(cls, v):
        if isinstance(v, (datetime, date)):
            return v.isoformat()
        return v


class SourceListListResponse(BaseModel):
    items: List[SourceListResponse]
    total: int
