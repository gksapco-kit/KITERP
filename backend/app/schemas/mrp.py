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
    is_leaf: bool = True  # False = this component is itself manufactured (has its own BOM) and was exploded further
    bom_depth: int = 1  # 1 = direct component of the requested product; 2+ = sub-assembly level
    required_qty: Decimal  # exact requirement from BOM explosion
    reserve_qty: Decimal  # required_qty rounded up (ceiling) to whole units — what is actually held/consumed against StoreInventory
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
    store_id: Optional[UUID] = None  # business unit to check/reserve stock against; omit to use global Product.quantity


# ── Reservations ──────────────────────────────────────────────────────────────

class ReservationItemIn(BaseModel):
    product_id: UUID
    variant_id: Optional[UUID] = None
    reserved_qty: Decimal = Field(gt=0)
    notes: Optional[str] = None


class ReservationCreate(BaseModel):
    order_type: str
    order_id: str
    store_id: Optional[UUID] = None
    storage_location_id: Optional[UUID] = None
    items: List[ReservationItemIn]


class ReservationOut(BaseModel):
    id: UUID
    vendor_id: UUID
    order_type: str
    order_id: str
    store_id: Optional[UUID] = None
    storage_location_id: Optional[UUID] = None
    product_id: UUID
    product_name: Optional[str] = None
    variant_id: Optional[UUID] = None
    reserved_qty: Decimal
    status: str
    notes: Optional[str] = None
    created_at: datetime
    released_at: Optional[datetime] = None
    consumed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
