"""Public-facing Pydantic schemas for rental assets — mirrors ProductListResponse."""
from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel


class RentalAssetResponse(BaseModel):
    id: str
    vendor_id: str
    name: str
    slug: Optional[str] = None
    asset_code: Optional[str] = None
    sku: Optional[str] = None
    product_id: Optional[str] = None
    category: Optional[str] = None
    asset_type: Optional[str] = None
    description: Optional[str] = None

    # Capacity
    capacity_max: float = 0
    capacity_unit: Optional[str] = None
    current_occupancy: float = 0
    available_capacity: float = 0
    max_weight: Optional[float] = None
    weight_unit: Optional[str] = None

    # Pricing (time-based)
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
