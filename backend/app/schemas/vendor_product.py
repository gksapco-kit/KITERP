# app/schemas/vendor_product.py
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from enum import Enum


class ProductStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class ProductType(str, Enum):
    PHYSICAL = "physical"
    DIGITAL = "digital"
    SUBSCRIPTION = "subscription"
    BUNDLE = "bundle"
    RAW_MATERIAL = "raw_material"


class StockStatus(str, Enum):
    IN_STOCK = "in_stock"
    OUT_OF_STOCK = "out_of_stock"
    BACKORDER = "backorder"
    DISCONTINUED = "discontinued"


class WarrantyType(str, Enum):
    MANUFACTURER = "manufacturer"
    VENDOR = "vendor"
    NONE = "none"


class RefundPolicy(str, Enum):
    FULL_REFUND = "full_refund"
    STORE_CREDIT = "store_credit"
    EXCHANGE_ONLY = "exchange_only"


class ShippingClass(str, Enum):
    STANDARD = "standard"
    EXPRESS = "express"
    FRAGILE = "fragile"
    OVERSIZED = "oversized"


class SubscriptionInterval(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"


# ── Variant & Image ──────────────────────────────────────────────

class ProductVariantCreate(BaseModel):
    id: Optional[str] = None   # present when updating an existing variant
    name: str = Field(..., min_length=1, max_length=255)
    sku: Optional[str] = None
    barcode: Optional[str] = None
    uom: Optional[str] = "piece"
    uom_quantity: Optional[float] = Field(None, ge=0)
    price_type: Optional[str] = "per_unit"  # per_unit | per_cycle | not_applicable
    price: float = Field(..., ge=0)
    compare_at_price: Optional[float] = None
    cost_price: Optional[float] = None
    cost_price_fixed: Optional[float] = None
    # NULL = inherit parent product's method; set to override for this SKU
    valuation_method: Optional[str] = Field(
        None,
        pattern="^(moving_average|fixed|standard)$",
    )
    currency: Optional[str] = "INR"
    discount_percentage: Optional[float] = Field(None, ge=0, le=100)
    discount_amount: Optional[float] = None
    offer_label: Optional[str] = Field(None, max_length=100)
    is_on_sale: bool = False
    # Tax
    is_taxable: bool = True
    tax_rate: Optional[float] = Field(None, ge=0, le=100)
    hsn_code: Optional[str] = Field(None, max_length=8)
    gst_rate: Optional[float] = Field(None, ge=0, le=100)
    # Inventory
    quantity: int = Field(default=0, ge=0)
    low_stock_threshold: int = 5
    stock_status: Optional[str] = "in_stock"
    reorder_point: Optional[int] = None
    reorder_quantity: Optional[int] = None
    allow_backorders: bool = False
    track_inventory: bool = True
    max_quantity_per_order: Optional[int] = Field(None, ge=1)
    min_quantity_per_order: Optional[int] = Field(None, ge=1)
    weight_kg: Optional[float] = None
    # Lifecycle
    expiration_date: Optional[str] = None
    manufacture_date: Optional[str] = None
    best_before_date: Optional[str] = None
    warranty_period_days: Optional[int] = None
    warranty_type: Optional[str] = None
    # Return & warranty
    is_returnable: bool = True
    return_days: Optional[int] = None
    refund_policy: Optional[str] = None
    return_policy: Optional[str] = None
    return_conditions: Optional[str] = None
    color: Optional[str] = None
    attributes: Optional[dict] = {}
    # Subscription (variant-level)
    subscription_interval: Optional[str] = None
    subscription_trial_days: Optional[int] = None
    subscription_setup_fee: Optional[float] = None
    subscription_billing_cycles: Optional[int] = None
    subscription_schedule_modes: Optional[List[str]] = None
    is_active: bool = True


class ProductVariantResponse(BaseModel):
    id: str
    name: str
    sku: Optional[str] = None
    barcode: Optional[str] = None
    uom: str = "piece"
    uom_quantity: Optional[float] = None
    price_type: str = "per_unit"
    price: float
    compare_at_price: Optional[float] = None
    cost_price: Optional[float] = None
    cost_price_fixed: Optional[float] = None
    # NULL = inherits parent product's method
    valuation_method: Optional[str] = None
    cost_source: Optional[str] = None
    cost_updated_at: Optional[str] = None
    currency: str = "INR"
    discount_percentage: Optional[float] = None
    discount_amount: Optional[float] = None
    offer_label: Optional[str] = None
    is_on_sale: bool = False
    # Tax
    is_taxable: bool = True
    tax_rate: Optional[float] = None
    hsn_code: Optional[str] = None
    gst_rate: Optional[float] = None
    # Inventory
    quantity: int
    low_stock_threshold: int = 5
    stock_status: str = "in_stock"
    reorder_point: Optional[int] = None
    reorder_quantity: Optional[int] = None
    allow_backorders: bool = False
    track_inventory: bool = True
    max_quantity_per_order: Optional[int] = None
    min_quantity_per_order: Optional[int] = None
    weight_kg: Optional[float] = None
    # Lifecycle
    expiration_date: Optional[str] = None
    manufacture_date: Optional[str] = None
    best_before_date: Optional[str] = None
    warranty_period_days: Optional[int] = None
    warranty_type: Optional[str] = None
    # Return & warranty
    is_returnable: bool = True
    return_days: Optional[int] = None
    refund_policy: Optional[str] = None
    return_policy: Optional[str] = None
    return_conditions: Optional[str] = None
    color: Optional[str] = None
    attributes: dict = {}
    # Subscription (variant-level)
    subscription_interval: Optional[str] = None
    subscription_trial_days: Optional[int] = None
    subscription_setup_fee: Optional[float] = None
    subscription_billing_cycles: Optional[int] = None
    subscription_schedule_modes: Optional[List[str]] = None
    is_active: bool
    created_at: Optional[str] = None


class ProductImageCreate(BaseModel):
    url: str
    alt_text: Optional[str] = None
    position: int = 0
    is_primary: bool = False


class ProductImageResponse(BaseModel):
    id: str
    url: str
    alt_text: Optional[str] = None
    position: int
    is_primary: bool


# ── Product Create ───────────────────────────────────────────────

class ProductCreate(BaseModel):
    # Basic
    name: str = Field(..., min_length=2, max_length=255)
    slug: Optional[str] = None
    material_code: Optional[str] = Field(None, max_length=40)
    description: Optional[str] = None
    short_description: Optional[str] = Field(None, max_length=500)
    brand: Optional[str] = Field(None, max_length=255)
    product_type: Optional[str] = "physical"
    category: Optional[str] = None
    subcategory: Optional[str] = None
    tags: List[str] = []
    # Sales & Distribution division this product belongs to
    division_id: Optional[str] = None

    # Unit of Measure
    uom: Optional[str] = "piece"
    uom_quantity: Optional[float] = Field(None, ge=0)

    # Pricing
    price: float = Field(0, ge=0)
    compare_at_price: Optional[float] = None
    cost_price: Optional[float] = None
    cost_price_fixed: Optional[float] = None
    valuation_method: Optional[str] = Field(
        "moving_average",
        pattern="^(moving_average|fixed|standard)$",
    )
    cost_source: Optional[str] = None
    currency: str = "INR"
    discount_percentage: Optional[float] = Field(None, ge=0, le=100)
    discount_amount: Optional[float] = None
    discount_start_date: Optional[str] = None
    discount_end_date: Optional[str] = None
    offer_label: Optional[str] = Field(None, max_length=100)
    is_on_sale: bool = False

    # Tax
    is_taxable: bool = True
    tax_rate: Optional[float] = Field(None, ge=0, le=100)
    hsn_code: Optional[str] = Field(None, max_length=8)
    gst_rate: Optional[float] = Field(None, ge=0, le=100)

    # Inventory
    sku: Optional[str] = None
    barcode: Optional[str] = None
    track_inventory: bool = True
    quantity: int = Field(default=0, ge=0)
    low_stock_threshold: int = 5
    reorder_point: Optional[int] = None
    reorder_quantity: Optional[int] = None
    stock_status: Optional[str] = "in_stock"
    allow_backorders: bool = False

    # Lifecycle
    expiration_date: Optional[str] = None
    manufacture_date: Optional[str] = None
    best_before_date: Optional[str] = None
    warranty_period_days: Optional[int] = None
    warranty_type: Optional[str] = None

    # Pharma / batch control
    pharma_managed: bool = False
    batch_managed: bool = False
    serial_managed: bool = False
    shelf_life_days: Optional[int] = None
    retest_days: Optional[int] = None
    qc_required_on_receipt: bool = False
    qc_required_on_production: bool = False
    gtin: Optional[str] = None
    ndc: Optional[str] = None
    requires_cold_chain: bool = False
    storage_condition: Optional[str] = None

    # Return
    return_policy: Optional[str] = None
    return_days: Optional[int] = None
    is_returnable: bool = True
    return_conditions: Optional[str] = None
    refund_policy: Optional[str] = None

    # Shipping
    weight_kg: Optional[float] = None
    length_cm: Optional[float] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None
    shipping_class: Optional[str] = None
    requires_shipping: bool = True
    shipping_cost_type: Optional[str] = "fixed"
    shipping_cost: Optional[float] = None
    free_shipping_threshold: Optional[float] = None

    # Visibility
    status: Optional[str] = "draft"
    is_featured: bool = False
    is_visible: bool = True
    is_new_arrival: bool = False
    is_best_seller: bool = False
    allow_quote_request: bool = False
    quote_form_config: Optional[list] = []
    store_scope: Optional[str] = "all"  # all | selected
    store_ids: List[str] = []

    # SEO
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: List[str] = []
    og_image_url: Optional[str] = None
    canonical_url: Optional[str] = None

    # Advanced
    attributes: Optional[dict] = {}
    specifications: Optional[dict] = {}
    custom_fields: Optional[dict] = {}
    related_product_ids: List[str] = []
    upsell_product_ids: List[str] = []
    cross_sell_product_ids: List[str] = []
    addons: List[Any] = []

    # Digital
    is_digital: bool = False
    download_url: Optional[str] = None
    download_limit: Optional[int] = None
    download_expiry_days: Optional[int] = None

    # Subscription
    is_subscription: bool = False
    subscription_interval: Optional[str] = None
    subscription_price: Optional[float] = None
    subscription_trial_days: Optional[int] = None
    subscription_setup_fee: Optional[float] = None
    subscription_billing_cycles: Optional[int] = None

    # Variants (optional; persisted as product_variant rows)
    variants: List[ProductVariantCreate] = []


# ── Product Update ───────────────────────────────────────────────

class ProductUpdate(BaseModel):
    # Basic
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    material_code: Optional[str] = Field(None, max_length=40)
    description: Optional[str] = None
    short_description: Optional[str] = Field(None, max_length=500)
    brand: Optional[str] = Field(None, max_length=255)
    product_type: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    tags: Optional[List[str]] = None
    # Sales & Distribution division this product belongs to
    division_id: Optional[str] = None

    # Unit of Measure
    uom: Optional[str] = None
    uom_quantity: Optional[float] = Field(None, ge=0)

    # Pricing
    price: Optional[float] = None
    compare_at_price: Optional[float] = None
    cost_price: Optional[float] = None
    cost_price_fixed: Optional[float] = None
    valuation_method: Optional[str] = Field(
        None,
        pattern="^(moving_average|fixed|standard)$",
    )
    cost_source: Optional[str] = None
    currency: Optional[str] = None
    discount_percentage: Optional[float] = Field(None, ge=0, le=100)
    discount_amount: Optional[float] = None
    discount_start_date: Optional[str] = None
    discount_end_date: Optional[str] = None
    offer_label: Optional[str] = Field(None, max_length=100)
    is_on_sale: Optional[bool] = None

    # Tax
    is_taxable: Optional[bool] = None
    tax_rate: Optional[float] = Field(None, ge=0, le=100)
    hsn_code: Optional[str] = Field(None, max_length=8)
    gst_rate: Optional[float] = Field(None, ge=0, le=100)

    # Inventory
    sku: Optional[str] = None
    barcode: Optional[str] = None
    track_inventory: Optional[bool] = None
    quantity: Optional[int] = None
    low_stock_threshold: Optional[int] = None
    reorder_point: Optional[int] = None
    reorder_quantity: Optional[int] = None
    stock_status: Optional[str] = None
    allow_backorders: Optional[bool] = None

    # Lifecycle
    expiration_date: Optional[str] = None
    manufacture_date: Optional[str] = None
    best_before_date: Optional[str] = None
    warranty_period_days: Optional[int] = None
    warranty_type: Optional[str] = None

    # Pharma / batch control
    pharma_managed: Optional[bool] = None
    batch_managed: Optional[bool] = None
    serial_managed: Optional[bool] = None
    shelf_life_days: Optional[int] = None
    retest_days: Optional[int] = None
    qc_required_on_receipt: Optional[bool] = None
    qc_required_on_production: Optional[bool] = None
    gtin: Optional[str] = None
    ndc: Optional[str] = None
    requires_cold_chain: Optional[bool] = None
    storage_condition: Optional[str] = None

    # Return
    return_policy: Optional[str] = None
    return_days: Optional[int] = None
    is_returnable: Optional[bool] = None
    return_conditions: Optional[str] = None
    refund_policy: Optional[str] = None

    # Shipping
    weight_kg: Optional[float] = None
    length_cm: Optional[float] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None
    shipping_class: Optional[str] = None
    requires_shipping: Optional[bool] = None
    shipping_cost_type: Optional[str] = None
    shipping_cost: Optional[float] = None
    free_shipping_threshold: Optional[float] = None

    # Visibility
    status: Optional[ProductStatus] = None
    is_featured: Optional[bool] = None
    is_visible: Optional[bool] = None
    is_new_arrival: Optional[bool] = None
    is_best_seller: Optional[bool] = None
    allow_quote_request: Optional[bool] = None
    quote_form_config: Optional[list] = None
    store_scope: Optional[str] = None
    store_ids: Optional[List[str]] = None

    # SEO
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: Optional[List[str]] = None
    og_image_url: Optional[str] = None
    canonical_url: Optional[str] = None

    # Advanced
    attributes: Optional[dict] = None
    specifications: Optional[dict] = None
    custom_fields: Optional[dict] = None
    related_product_ids: Optional[List[str]] = None
    upsell_product_ids: Optional[List[str]] = None
    cross_sell_product_ids: Optional[List[str]] = None
    addons: Optional[List[Any]] = None

    # Digital
    is_digital: Optional[bool] = None
    download_url: Optional[str] = None
    download_limit: Optional[int] = None
    download_expiry_days: Optional[int] = None

    # Subscription
    is_subscription: Optional[bool] = None
    subscription_interval: Optional[str] = None
    subscription_price: Optional[float] = None
    subscription_trial_days: Optional[int] = None
    subscription_setup_fee: Optional[float] = None
    subscription_billing_cycles: Optional[int] = None

    # Replace all variants when provided (omit to leave unchanged)
    variants: Optional[List[ProductVariantCreate]] = None


# ── Product Response ─────────────────────────────────────────────

class ProductResponse(BaseModel):
    id: str
    vendor_id: str

    # Basic
    name: str
    slug: str
    material_code: Optional[str] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    brand: Optional[str] = None
    product_type: str = "physical"
    category: Optional[str] = None
    subcategory: Optional[str] = None
    tags: List[str] = []

    # Unit of Measure
    uom: str = "piece"
    uom_quantity: Optional[float] = None

    # Pricing
    price: float
    compare_at_price: Optional[float] = None
    cost_price: Optional[float] = None
    cost_price_fixed: Optional[float] = None
    valuation_method: str = "moving_average"
    cost_source: Optional[str] = None
    cost_updated_at: Optional[str] = None
    currency: str = "INR"
    discount_percentage: Optional[float] = None
    discount_amount: Optional[float] = None
    discount_start_date: Optional[str] = None
    discount_end_date: Optional[str] = None
    offer_label: Optional[str] = None
    is_on_sale: bool = False

    # Tax
    is_taxable: bool = True
    tax_rate: Optional[float] = None
    hsn_code: Optional[str] = None
    gst_rate: Optional[float] = None

    # Inventory
    sku: Optional[str] = None
    barcode: Optional[str] = None
    track_inventory: bool = True
    quantity: int = 0
    low_stock_threshold: int = 5
    reorder_point: Optional[int] = None
    reorder_quantity: Optional[int] = None
    stock_status: str = "in_stock"
    allow_backorders: bool = False

    # Lifecycle
    expiration_date: Optional[str] = None
    manufacture_date: Optional[str] = None
    best_before_date: Optional[str] = None
    warranty_period_days: Optional[int] = None
    warranty_type: Optional[str] = None

    # Pharma / batch control
    pharma_managed: bool = False
    batch_managed: bool = False
    serial_managed: bool = False
    shelf_life_days: Optional[int] = None
    retest_days: Optional[int] = None
    qc_required_on_receipt: bool = False
    qc_required_on_production: bool = False
    gtin: Optional[str] = None
    ndc: Optional[str] = None
    requires_cold_chain: bool = False
    storage_condition: Optional[str] = None

    # Return
    return_policy: Optional[str] = None
    return_days: Optional[int] = None
    is_returnable: bool = True
    return_conditions: Optional[str] = None
    refund_policy: Optional[str] = None

    # Shipping
    weight_kg: Optional[float] = None
    length_cm: Optional[float] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None
    shipping_class: Optional[str] = None
    requires_shipping: bool = True
    shipping_cost_type: Optional[str] = "fixed"
    shipping_cost: Optional[float] = None
    free_shipping_threshold: Optional[float] = None

    # Visibility
    status: ProductStatus
    is_featured: bool = False
    is_visible: bool = True
    is_new_arrival: bool = False
    is_best_seller: bool = False
    store_scope: str = "all"
    store_ids: List[str] = []

    # SEO
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: List[str] = []
    og_image_url: Optional[str] = None
    canonical_url: Optional[str] = None

    # Advanced
    attributes: dict = {}
    specifications: dict = {}
    custom_fields: dict = {}
    related_product_ids: List[str] = []
    upsell_product_ids: List[str] = []
    cross_sell_product_ids: List[str] = []
    addons: List[Any] = []

    # Digital
    is_digital: bool = False
    download_url: Optional[str] = None
    download_limit: Optional[int] = None
    download_expiry_days: Optional[int] = None

    # Subscription
    is_subscription: bool = False
    subscription_interval: Optional[str] = None
    subscription_price: Optional[float] = None
    subscription_trial_days: Optional[int] = None
    subscription_setup_fee: Optional[float] = None
    subscription_billing_cycles: Optional[int] = None

    # Audit
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    version_number: int = 1
    view_count: int = 0
    purchase_count: int = 0

    # Relations
    variants: List[ProductVariantResponse] = []
    images: List[ProductImageResponse] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    published_at: Optional[str] = None


class ProductListResponse(BaseModel):
    items: List[ProductResponse]
    total: int
    page: int
    size: int
    pages: int


# ── Price-Rule schemas ────────────────────────────────────────────

class PriceRuleType(str, Enum):
    PARTY = "party"
    LOCATION = "location"
    SCHEDULED = "scheduled"
    QUANTITY = "quantity"
    CHANNEL = "channel"


class PriceRuleCreate(BaseModel):
    rule_type: PriceRuleType
    name: str
    variant_id: Optional[str] = None
    # Party
    customer_id: Optional[str] = None
    customer_group: Optional[str] = None
    # Location
    state: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    # Scheduled
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    # Quantity
    min_quantity: Optional[int] = None
    max_quantity: Optional[int] = None
    # Channel
    channel: Optional[str] = None
    # Pricing
    price: Optional[float] = None
    discount_percentage: Optional[float] = None
    discount_amount: Optional[float] = None
    priority: int = 0
    is_active: bool = True
    notes: Optional[str] = None


class PriceRuleUpdate(BaseModel):
    name: Optional[str] = None
    variant_id: Optional[str] = None
    customer_id: Optional[str] = None
    customer_group: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    min_quantity: Optional[int] = None
    max_quantity: Optional[int] = None
    channel: Optional[str] = None
    price: Optional[float] = None
    discount_percentage: Optional[float] = None
    discount_amount: Optional[float] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class PriceRuleResponse(BaseModel):
    id: str
    product_id: str
    variant_id: Optional[str] = None
    rule_type: str
    name: str
    customer_id: Optional[str] = None
    customer_group: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    min_quantity: Optional[int] = None
    max_quantity: Optional[int] = None
    channel: Optional[str] = None
    price: Optional[float] = None
    discount_percentage: Optional[float] = None
    discount_amount: Optional[float] = None
    priority: int = 0
    is_active: bool = True
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True
