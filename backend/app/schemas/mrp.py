# app/schemas/mrp.py
from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal


# ── BOM ──────────────────────────────────────────────────────────────────────

class BOMItemIn(BaseModel):
    component_id: UUID
    qty_per_unit: Decimal = Field(gt=0, decimal_places=4)
    notes: Optional[str] = None


class BOMItemOut(BaseModel):
    id: UUID
    product_id: UUID
    component_id: UUID
    component_name: str
    component_sku: Optional[str] = None
    component_uom: Optional[str] = None
    qty_per_unit: Decimal
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── MRP Calculate ─────────────────────────────────────────────────────────────

class MRPRequestItem(BaseModel):
    product_id: str
    qty: Decimal = Field(gt=0)
    name: Optional[str] = None


class MRPResultLine(BaseModel):
    component_id: str
    component_name: str
    component_sku: Optional[str] = None
    component_uom: Optional[str] = None
    required_qty: Decimal
    in_stock: Decimal
    reserved_by_others: Decimal
    already_reserved_for_order: Decimal
    available: Decimal
    shortage: Decimal
    status: str  # "ok" | "partial" | "short" | "no_bom"
    source_items: List[str] = []  # finished product names that need this component


class MRPRequest(BaseModel):
    items: List[MRPRequestItem]
    order_type: str
    order_id: str


# ── Reservations ──────────────────────────────────────────────────────────────

class ReservationItemIn(BaseModel):
    product_id: UUID
    variant_id: Optional[UUID] = None
    reserved_qty: Decimal = Field(gt=0)
    notes: Optional[str] = None


class ReservationCreate(BaseModel):
    order_type: str
    order_id: str
    items: List[ReservationItemIn]


class ReservationOut(BaseModel):
    id: UUID
    vendor_id: UUID
    order_type: str
    order_id: str
    product_id: UUID
    product_name: Optional[str] = None
    variant_id: Optional[UUID] = None
    reserved_qty: Decimal
    status: str
    notes: Optional[str] = None
    created_at: datetime
    released_at: Optional[datetime] = None

    class Config:
        from_attributes = True
