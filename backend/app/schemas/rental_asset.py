"""Pydantic schemas for rental assets — vendor admin + public catalog."""
from __future__ import annotations

from typing import Any, List, Optional
from pydantic import BaseModel, Field


# ── Media ─────────────────────────────────────────────────────────────────────

class RentalMediaItem(BaseModel):
    id: str
    url: str
    media_type: str = "image"
    is_primary: bool = False
    alt_text: Optional[str] = None
    position: int = 0


# ── Request schemas ───────────────────────────────────────────────────────────

class RentalAssetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: Optional[str] = None
    asset_code: Optional[str] = None
    sku: Optional[str] = None
    product_id: Optional[str] = None
    # Asset kind / form preset (milk_dairy | furniture | equipment | storage | vehicles | other)
    category: Optional[str] = Field(None, max_length=50)
    # Merchandising category FK — UUID string from vendor_category.id
    category_id: Optional[str] = None
    asset_type: Optional[str] = Field(None, max_length=80)
    short_description: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None
    capacity_max: Optional[float] = 1
    capacity_unit: Optional[str] = Field(None, max_length=40)
    max_weight: Optional[float] = None
    weight_unit: Optional[str] = Field(None, max_length=20)
    currency: Optional[str] = Field("INR", max_length=3)
    daily_rate: Optional[float] = 0
    weekly_rate: Optional[float] = 0
    monthly_rate: Optional[float] = 0
    yearly_rate: Optional[float] = 0
    hourly_rate: Optional[float] = 0
    per_minute_rate: Optional[float] = 0
    deposit_amount: Optional[float] = 0
    extra_qty_charge: Optional[float] = 0
    extra_weight_charge: Optional[float] = 0
    price_per_unit: Optional[float] = 0
    pricing_uom: Optional[str] = Field(None, max_length=40)
    sales_area_id: Optional[str] = None
    location: Optional[str] = Field(None, max_length=255)
    section: Optional[str] = Field(None, max_length=100)
    row_label: Optional[str] = Field(None, max_length=100)
    rack_number: Optional[str] = Field(None, max_length=50)
    image_url: Optional[str] = None
    status: Optional[str] = Field(None, max_length=30)
    display_start_date: Optional[str] = None
    display_end_date: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = True
    is_visible: Optional[bool] = True
    store_scope: Optional[str] = Field("all", max_length=20)
    store_ids: Optional[List[str]] = None
    parent_asset_id: Optional[str] = None
    is_bookable: Optional[bool] = True
    unit_mode: Optional[str] = Field("none", max_length=20)

    model_config = {"extra": "allow"}


class RentalAssetUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = None
    asset_code: Optional[str] = None
    sku: Optional[str] = None
    product_id: Optional[str] = None
    category: Optional[str] = Field(None, max_length=50)
    category_id: Optional[str] = None
    asset_type: Optional[str] = Field(None, max_length=80)
    short_description: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None
    capacity_max: Optional[float] = None
    capacity_unit: Optional[str] = Field(None, max_length=40)
    max_weight: Optional[float] = None
    weight_unit: Optional[str] = Field(None, max_length=20)
    currency: Optional[str] = Field(None, max_length=3)
    daily_rate: Optional[float] = None
    weekly_rate: Optional[float] = None
    monthly_rate: Optional[float] = None
    yearly_rate: Optional[float] = None
    hourly_rate: Optional[float] = None
    per_minute_rate: Optional[float] = None
    deposit_amount: Optional[float] = None
    extra_qty_charge: Optional[float] = None
    extra_weight_charge: Optional[float] = None
    price_per_unit: Optional[float] = None
    pricing_uom: Optional[str] = Field(None, max_length=40)
    sales_area_id: Optional[str] = None
    location: Optional[str] = Field(None, max_length=255)
    section: Optional[str] = Field(None, max_length=100)
    row_label: Optional[str] = Field(None, max_length=100)
    rack_number: Optional[str] = Field(None, max_length=50)
    image_url: Optional[str] = None
    status: Optional[str] = Field(None, max_length=30)
    display_start_date: Optional[str] = None
    display_end_date: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None
    is_visible: Optional[bool] = None
    store_scope: Optional[str] = Field(None, max_length=20)
    store_ids: Optional[List[str]] = None
    parent_asset_id: Optional[str] = None
    is_bookable: Optional[bool] = None
    unit_mode: Optional[str] = Field(None, max_length=20)

    model_config = {"extra": "allow"}


# ── Response schemas ──────────────────────────────────────────────────────────

class RentalAssetResponse(BaseModel):
    id: str
    vendor_id: str
    name: str
    slug: Optional[str] = None
    asset_code: Optional[str] = None
    sku: Optional[str] = None
    product_id: Optional[str] = None
    category: Optional[str] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    asset_type: Optional[str] = None
    short_description: Optional[str] = None
    description: Optional[str] = None

    # Capacity
    capacity_max: float = 0
    capacity_unit: Optional[str] = None
    current_occupancy: float = 0
    available_capacity: float = 0
    damaged_qty: float = 0
    lost_qty: float = 0
    max_weight: Optional[float] = None
    weight_unit: Optional[str] = None

    # Pricing (time-based)
    currency: str = "INR"
    hourly_rate: float = 0
    daily_rate: float = 0
    weekly_rate: float = 0
    monthly_rate: float = 0
    yearly_rate: float = 0
    per_minute_rate: float = 0
    deposit_amount: float = 0
    extra_qty_charge: float = 0
    extra_weight_charge: float = 0
    price_per_unit: float = 0
    pricing_uom: Optional[str] = None

    # Location
    sales_area_id: Optional[str] = None
    location: Optional[str] = None
    section: Optional[str] = None
    row_label: Optional[str] = None
    rack_number: Optional[str] = None
    image_url: Optional[str] = None
    media: List[Any] = []

    # Lifecycle / visibility
    status: Optional[str] = None
    is_active: bool = True
    is_visible: bool = True
    store_scope: str = "all"
    display_start_date: Optional[str] = None
    display_end_date: Optional[str] = None

    # Hierarchy
    parent_asset_id: Optional[str] = None
    is_bookable: bool = True
    unit_mode: str = "none"

    notes: Optional[str] = None
    created_at: Optional[str] = None

    # Annotated child/unit counts (vendor dashboard)
    child_count: Optional[int] = None
    unit_count: Optional[int] = None

    model_config = {"from_attributes": True, "extra": "allow"}


class RentalAssetListResponse(BaseModel):
    items: list[RentalAssetResponse]
    total: int
    page: int
    size: int
    pages: int

    model_config = {"from_attributes": True}
