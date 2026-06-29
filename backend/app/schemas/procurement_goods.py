# app/schemas/procurement_goods.py
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID
from decimal import Decimal
from enum import Enum


class QualityStatus(str, Enum):
    UNRESTRICTED = "unrestricted"
    QUALITY_INSPECTION = "quality_inspection"
    BLOCKED = "blocked"


class MovementType(str, Enum):
    GR_PO = "101"            # Goods receipt for PO
    GR_PO_REVERSAL = "102"   # Reversal of GR
    RETURN_TO_VENDOR = "122" # Return delivery to vendor
    GI_COST_CENTER = "201"   # GI for cost center
    GI_PRODUCTION = "261"    # GI for production order
    PLANT_TRANSFER = "301"   # Plant-to-plant transfer
    SLOC_TRANSFER = "311"    # Storage-location transfer


# ── Goods Batch ───────────────────────────────────────────────────

class GoodsBatchCreate(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    batch_number: str = Field(..., min_length=1, max_length=50)
    serial_numbers: Optional[List[str]] = None
    manufacturing_date: Optional[date] = None
    expiry_date: Optional[date] = None
    best_before_date: Optional[date] = None
    plant_id: Optional[str] = None
    storage_location_id: Optional[str] = None
    quantity_received: float = Field(..., gt=0)
    source_type: Optional[str] = None
    source_id: Optional[str] = None
    quality_status: Optional[QualityStatus] = QualityStatus.UNRESTRICTED
    supplier_batch_number: Optional[str] = None
    notes: Optional[str] = None


class GoodsBatchUpdate(BaseModel):
    quality_status: Optional[QualityStatus] = None
    storage_location_id: Optional[str] = None
    plant_id: Optional[str] = None
    expiry_date: Optional[date] = None
    best_before_date: Optional[date] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class GoodsBatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    vendor_id: str
    product_id: str
    variant_id: Optional[str] = None
    batch_number: str
    serial_numbers: Optional[list] = None
    manufacturing_date: Optional[str] = None
    expiry_date: Optional[str] = None
    best_before_date: Optional[str] = None
    plant_id: Optional[str] = None
    storage_location_id: Optional[str] = None
    quantity_received: float = 0
    quantity_available: float = 0
    quantity_reserved: float = 0
    quantity_consumed: float = 0
    source_type: Optional[str] = None
    source_id: Optional[str] = None
    quality_status: str = "unrestricted"
    supplier_batch_number: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @field_validator("id", "vendor_id", "product_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("variant_id", "plant_id", "storage_location_id", "source_id", mode="before")
    @classmethod
    def coerce_optional_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator(
        "quantity_received", "quantity_available", "quantity_reserved", "quantity_consumed",
        mode="before",
    )
    @classmethod
    def coerce_decimal(cls, v):
        if isinstance(v, Decimal):
            return float(v)
        return float(v) if v is not None else 0

    @field_validator(
        "manufacturing_date", "expiry_date", "best_before_date", "created_at", "updated_at",
        mode="before",
    )
    @classmethod
    def coerce_dt(cls, v):
        if isinstance(v, (datetime, date)):
            return v.isoformat()
        return v


class GoodsBatchListResponse(BaseModel):
    items: List[GoodsBatchResponse]
    total: int


# ── Goods Movement Document ───────────────────────────────────────

class GoodsMovementCreate(BaseModel):
    movement_type: MovementType
    po_receipt_id: Optional[str] = None
    production_order_id: Optional[str] = None
    plant_id: Optional[str] = None
    from_storage_location_id: Optional[str] = None
    to_storage_location_id: Optional[str] = None
    lines: List[dict] = Field(..., min_length=1)
    posting_date: Optional[date] = None
    notes: Optional[str] = None


class GoodsMovementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    vendor_id: str
    document_number: str
    movement_type: str
    po_receipt_id: Optional[str] = None
    production_order_id: Optional[str] = None
    plant_id: Optional[str] = None
    from_storage_location_id: Optional[str] = None
    to_storage_location_id: Optional[str] = None
    lines: list = []
    posting_date: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[str] = None

    @field_validator("id", "vendor_id", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator(
        "po_receipt_id", "production_order_id",
        "plant_id", "from_storage_location_id", "to_storage_location_id",
        mode="before",
    )
    @classmethod
    def coerce_optional_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    @field_validator("posting_date", "created_at", mode="before")
    @classmethod
    def coerce_dt(cls, v):
        if isinstance(v, (datetime, date)):
            return v.isoformat()
        return v
