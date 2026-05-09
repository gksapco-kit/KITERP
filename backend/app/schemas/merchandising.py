# app/schemas/merchandising.py
from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class RelationType(str, Enum):
    CROSS_SELL = "cross_sell"
    UPSELL = "upsell"


class TriggerStage(str, Enum):
    PDP = "PDP"
    CART = "CART"
    CHECKOUT = "CHECKOUT"


class DiscountType(str, Enum):
    NONE = "none"
    PERCENTAGE = "percentage"
    FIXED = "fixed"


# ── Bundle ────────────────────────────────────────────────────────

class BundleItemCreate(BaseModel):
    product_id: str
    quantity: int = 1
    sort_order: int = 0


class BundleItemResponse(BaseModel):
    id: str
    bundle_id: str
    product_id: str
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    quantity: int = 1
    sort_order: int = 0

    model_config = {"from_attributes": True}


class BundleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    discount_type: DiscountType = DiscountType.NONE
    discount_value: float = 0
    is_active: bool = True
    items: List[BundleItemCreate] = []


class BundleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    discount_type: Optional[DiscountType] = None
    discount_value: Optional[float] = None
    is_active: Optional[bool] = None
    items: Optional[List[BundleItemCreate]] = None


class BundleResponse(BaseModel):
    id: str
    vendor_id: str
    name: str
    slug: str
    description: Optional[str] = None
    discount_type: str = "none"
    discount_value: float = 0
    is_active: bool = True
    items: List[BundleItemResponse] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True}


class BundleListResponse(BaseModel):
    items: List[BundleResponse] = []
    total: int = 0


# ── UpsellMapping ─────────────────────────────────────────────────

class TargetType(str, Enum):
    PRODUCT = "product"
    CATEGORY = "category"


class UpsellMappingCreate(BaseModel):
    source_product_id: str
    target_type: TargetType = TargetType.PRODUCT
    target_product_id: Optional[str] = None
    target_category: Optional[str] = None
    relation_type: RelationType
    bundle_id: Optional[str] = None
    trigger_stage: TriggerStage = TriggerStage.PDP
    priority: int = 0
    is_active: bool = True


class UpsellMappingUpdate(BaseModel):
    target_type: Optional[TargetType] = None
    target_product_id: Optional[str] = None
    target_category: Optional[str] = None
    bundle_id: Optional[str] = None
    trigger_stage: Optional[TriggerStage] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None


class UpsellMappingResponse(BaseModel):
    id: str
    vendor_id: str
    source_product_id: str
    target_type: str = "product"
    target_product_id: Optional[str] = None
    target_product_name: Optional[str] = None
    target_product_sku: Optional[str] = None
    target_category: Optional[str] = None
    relation_type: str
    bundle_id: Optional[str] = None
    bundle_name: Optional[str] = None
    trigger_stage: str = "PDP"
    priority: int = 0
    is_active: bool = True
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True}


class UpsellMappingListResponse(BaseModel):
    items: List[UpsellMappingResponse] = []
    total: int = 0


# ── Bulk sync (used by product form) ─────────────────────────────

class MappingEntry(BaseModel):
    target_type: TargetType = TargetType.PRODUCT
    target_product_id: Optional[str] = None
    target_category: Optional[str] = None
    relation_type: RelationType
    bundle_id: Optional[str] = None
    trigger_stage: TriggerStage = TriggerStage.PDP
    priority: int = 0


class ProductMerchandisingSync(BaseModel):
    """Full replace of all upsell/cross-sell for one source product."""
    mappings: List[MappingEntry] = []


class ProductMerchandisingResponse(BaseModel):
    cross_sell: List[UpsellMappingResponse] = []
    upsell: List[UpsellMappingResponse] = []
