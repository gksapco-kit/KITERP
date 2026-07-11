# app/schemas/variant_management.py
"""Schemas for the Variant Management grid: list/paginate, inline patch (one
field or many, from a single grid cell edit), and bulk operations (multi-row
price adjustment / activate-deactivate / delete)."""
from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from enum import Enum


class VariantListItem(BaseModel):
    id: str
    name: str
    sku: Optional[str] = None
    barcode: Optional[str] = None
    uom: str = "piece"
    price: float
    compare_at_price: Optional[float] = None
    cost_price: Optional[float] = None
    currency: str = "INR"
    is_taxable: bool = True
    tax_rate: Optional[float] = None
    quantity: int = 0
    low_stock_threshold: int = 5
    stock_status: Optional[str] = None
    track_inventory: bool = True
    attributes: Dict[str, Any] = Field(default_factory=dict)
    config_selection: Optional[Dict[str, Any]] = None
    variant_hash: Optional[str] = None
    media: List[Any] = Field(default_factory=list)
    color: Optional[str] = None
    is_active: bool = True
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class VariantListResponse(BaseModel):
    items: List[VariantListItem]
    total: int
    page: int
    size: int
    pages: int


class VariantPatchRequest(BaseModel):
    """Every field is optional — only the ones present are updated (used for
    single-cell inline edits from the grid, so most calls set exactly one field)."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    sku: Optional[str] = None
    barcode: Optional[str] = None
    uom: Optional[str] = None
    uom_quantity: Optional[float] = None
    price: Optional[float] = Field(None, ge=0)
    compare_at_price: Optional[float] = None
    cost_price: Optional[float] = None
    currency: Optional[str] = None
    discount_percentage: Optional[float] = Field(None, ge=0, le=100)
    discount_amount: Optional[float] = Field(None, ge=0)
    offer_label: Optional[str] = Field(None, max_length=100)
    is_on_sale: Optional[bool] = None
    is_taxable: Optional[bool] = None
    tax_rate: Optional[float] = Field(None, ge=0, le=100)
    hsn_code: Optional[str] = Field(None, max_length=8)
    gst_rate: Optional[float] = Field(None, ge=0, le=100)
    quantity: Optional[int] = Field(None, ge=0)
    low_stock_threshold: Optional[int] = Field(None, ge=0)
    stock_status: Optional[str] = None
    track_inventory: Optional[bool] = None
    allow_backorders: Optional[bool] = None
    reorder_point: Optional[int] = None
    reorder_quantity: Optional[int] = None
    max_quantity_per_order: Optional[int] = None
    min_quantity_per_order: Optional[int] = None
    weight_kg: Optional[float] = None
    manufacture_date: Optional[str] = None  # YYYY-MM-DD or null to clear
    expiration_date: Optional[str] = None
    best_before_date: Optional[str] = None
    warranty_period_days: Optional[int] = None
    warranty_type: Optional[str] = None
    is_returnable: Optional[bool] = None
    return_days: Optional[int] = None
    refund_policy: Optional[str] = None
    return_policy: Optional[str] = None
    return_conditions: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


class PriceAdjustMode(str, Enum):
    SET = "set"
    INCREASE_PCT = "increase_pct"
    DECREASE_PCT = "decrease_pct"
    INCREASE_AMT = "increase_amt"
    DECREASE_AMT = "decrease_amt"


class PriceAdjustment(BaseModel):
    field: str = Field("price", description="price | compare_at_price | cost_price")
    mode: PriceAdjustMode
    value: float


class BulkUpdateRequest(BaseModel):
    variant_ids: List[str] = Field(..., min_length=1)
    set_fields: Optional[VariantPatchRequest] = None
    price_adjustment: Optional[PriceAdjustment] = None


class BulkUpdateResponse(BaseModel):
    updated_count: int


class BulkDeleteRequest(BaseModel):
    variant_ids: List[str] = Field(..., min_length=1)


class BulkDeleteResponse(BaseModel):
    deleted_count: int
