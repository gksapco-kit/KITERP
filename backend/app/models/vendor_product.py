# app/models/vendor_product.py
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, Date,
    ForeignKey, Numeric, Integer, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Product(Base):
    __tablename__ = "product"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)

    # ── Basic Info ────────────────────────────────────────────────
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    description = Column(Text)
    short_description = Column(String(500))
    brand = Column(String(255))
    product_type = Column(String(30), default="physical")

    # ── Categorization ────────────────────────────────────────────
    category = Column(String(100))
    subcategory = Column(String(100))
    tags = Column(JSONB, default=[])

    # ── Unit of Measure ──────────────────────────────────────────
    uom = Column(String(30), default="piece")

    # ── Pricing & Discounts ───────────────────────────────────────
    price = Column(Numeric(12, 2), nullable=False)
    compare_at_price = Column(Numeric(12, 2))
    cost_price = Column(Numeric(12, 2))
    currency = Column(String(3), default="INR")
    discount_percentage = Column(Numeric(5, 2))
    discount_amount = Column(Numeric(12, 2))
    discount_start_date = Column(DateTime(timezone=True))
    discount_end_date = Column(DateTime(timezone=True))
    offer_label = Column(String(100))
    is_on_sale = Column(Boolean, default=False)

    # ── Tax & Compliance ──────────────────────────────────────────
    is_taxable = Column(Boolean, default=True)
    tax_rate = Column(Numeric(5, 2))
    hsn_code = Column(String(8))
    gst_rate = Column(Numeric(5, 2))

    # ── Inventory ─────────────────────────────────────────────────
    sku = Column(String(100))
    barcode = Column(String(100))
    track_inventory = Column(Boolean, default=True)
    quantity = Column(Integer, default=0)
    low_stock_threshold = Column(Integer, default=5)
    reorder_point = Column(Integer)
    reorder_quantity = Column(Integer)
    stock_status = Column(String(30), default="in_stock")
    allow_backorders = Column(Boolean, default=False)

    # ── Product Lifecycle ─────────────────────────────────────────
    expiration_date = Column(Date)
    manufacture_date = Column(Date)
    best_before_date = Column(Date)
    warranty_period_days = Column(Integer)
    warranty_type = Column(String(30))

    # ── Return & Warranty ─────────────────────────────────────────
    return_policy = Column(Text)
    return_days = Column(Integer)
    is_returnable = Column(Boolean, default=True)
    return_conditions = Column(Text)
    refund_policy = Column(String(50))

    # ── Shipping & Delivery ───────────────────────────────────────
    weight_kg = Column(Numeric(8, 3))
    length_cm = Column(Numeric(8, 2))
    width_cm = Column(Numeric(8, 2))
    height_cm = Column(Numeric(8, 2))
    shipping_class = Column(String(30))
    requires_shipping = Column(Boolean, default=True)
    shipping_cost_type = Column(String(30), default="fixed")
    shipping_cost = Column(Numeric(12, 2))
    free_shipping_threshold = Column(Numeric(12, 2))

    # ── Visibility & Marketing ────────────────────────────────────
    status = Column(String(30), default="draft")
    is_featured = Column(Boolean, default=False)
    is_visible = Column(Boolean, default=True)
    is_new_arrival = Column(Boolean, default=False)
    is_best_seller = Column(Boolean, default=False)
    allow_quote_request = Column(Boolean, default=False)
    quote_form_config = Column(JSONB, default=[])

    # ── SEO & Metadata ────────────────────────────────────────────
    meta_title = Column(String(255))
    meta_description = Column(Text)
    meta_keywords = Column(JSONB, default=[])
    og_image_url = Column(String(500))
    canonical_url = Column(String(500))

    # ── Advanced ──────────────────────────────────────────────────
    attributes = Column(JSONB, default={})
    specifications = Column(JSONB, default={})
    custom_fields = Column(JSONB, default={})
    related_product_ids = Column(JSONB, default=[])
    upsell_product_ids = Column(JSONB, default=[])
    cross_sell_product_ids = Column(JSONB, default=[])
    addons = Column(JSONB, default=[])

    # ── Digital Products ──────────────────────────────────────────
    is_digital = Column(Boolean, default=False)
    download_url = Column(Text)
    download_limit = Column(Integer)
    download_expiry_days = Column(Integer)

    # ── Subscription ──────────────────────────────────────────────
    is_subscription = Column(Boolean, default=False)
    subscription_interval = Column(String(20))
    subscription_price = Column(Numeric(12, 2))
    subscription_trial_days = Column(Integer, nullable=True)
    subscription_setup_fee = Column(Numeric(12, 2), nullable=True)
    subscription_billing_cycles = Column(Integer, nullable=True)  # None = indefinite

    # ── Audit & Tracking ──────────────────────────────────────────
    created_by = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"))
    updated_by = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"))
    version_number = Column(Integer, default=1)
    change_history = Column(JSONB, default=[])
    view_count = Column(Integer, default=0)
    purchase_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    published_at = Column(DateTime(timezone=True))

    # Relationships
    vendor = relationship("Vendor", back_populates="products")
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    images = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan")
    price_rules = relationship("ProductPriceRule", back_populates="product", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_product_vendor", "vendor_id"),
        Index("idx_product_slug", "vendor_id", "slug", unique=True),
        Index("idx_product_status", "status"),
        Index("idx_product_category", "category"),
        Index("idx_product_brand", "brand"),
        Index("idx_product_type", "product_type"),
        Index("idx_product_stock_status", "stock_status"),
    )


class ProductVariant(Base):
    __tablename__ = "product_variant"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(255), nullable=False)
    sku = Column(String(100))
    barcode = Column(String(100))
    uom = Column(String(30), default="piece")
    price_type = Column(String(20), default="per_unit")  # per_unit | per_cycle
    price = Column(Numeric(12, 2), nullable=False)
    compare_at_price = Column(Numeric(12, 2))
    cost_price = Column(Numeric(12, 2))
    currency = Column(String(3), default="INR")
    discount_percentage = Column(Numeric(5, 2))
    discount_amount = Column(Numeric(12, 2))
    offer_label = Column(String(100))
    is_on_sale = Column(Boolean, default=False)

    # Tax
    is_taxable = Column(Boolean, default=True)
    tax_rate = Column(Numeric(5, 2))
    hsn_code = Column(String(8))
    gst_rate = Column(Numeric(5, 2))

    # Inventory
    quantity = Column(Integer, default=0)
    low_stock_threshold = Column(Integer, default=5)
    stock_status = Column(String(30), default="in_stock")
    reorder_point = Column(Integer)
    reorder_quantity = Column(Integer)
    allow_backorders = Column(Boolean, default=False)
    track_inventory = Column(Boolean, default=True)
    weight_kg = Column(Numeric(8, 3))

    # Lifecycle
    expiration_date = Column(Date)
    manufacture_date = Column(Date)
    best_before_date = Column(Date)
    warranty_period_days = Column(Integer)
    warranty_type = Column(String(30))

    # Color
    color = Column(String(50))

    # Return & warranty
    is_returnable = Column(Boolean, default=True)
    return_days = Column(Integer)
    refund_policy = Column(String(30))
    return_policy = Column(Text)
    return_conditions = Column(Text)

    # Subscription (variant-level overrides)
    subscription_interval = Column(String(20), nullable=True)
    subscription_trial_days = Column(Integer, nullable=True)
    subscription_setup_fee = Column(Numeric(12, 2), nullable=True)
    subscription_billing_cycles = Column(Integer, nullable=True)
    subscription_schedule_modes = Column(JSONB, default=["dates", "cycles", "pick_dates", "weekly", "recurring"])

    # Variant attributes (e.g., {"size": "M", "color": "Red"})
    attributes = Column(JSONB, default={})

    # Variant-specific media (images/videos/3D); overrides product media when set
    media = Column(JSONB, default=[])

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    product = relationship("Product", back_populates="variants")

    __table_args__ = (
        Index("idx_variant_product", "product_id"),
        Index("idx_variant_sku", "sku"),
    )


class ProductImage(Base):
    __tablename__ = "product_image"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    
    url = Column(Text, nullable=False)
    alt_text = Column(String(255))
    position = Column(Integer, default=0)
    is_primary = Column(Boolean, default=False)
    media_type = Column(String(20), default="image")  # image, video, model3d
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", back_populates="images")

    __table_args__ = (
        Index("idx_image_product", "product_id"),
    )


class ProductPriceRule(Base):
    """
    Flexible pricing rules: party-wise, location-wise, future/scheduled,
    quantity-tier, and channel-based.
    """
    __tablename__ = "product_price_rule"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True)

    rule_type = Column(String(20), nullable=False)  # party | location | scheduled | quantity | channel
    name = Column(String(255), nullable=False)

    # Party-wise
    customer_id = Column(UUID(as_uuid=True), nullable=True)
    customer_group = Column(String(100), nullable=True)

    # Location-wise
    state = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    pincode = Column(String(20), nullable=True)
    region = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)

    # Scheduled / future-dated
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)

    # Quantity / volume tiers
    min_quantity = Column(Integer, nullable=True)
    max_quantity = Column(Integer, nullable=True)

    # Channel
    channel = Column(String(50), nullable=True)  # online | pos | wholesale | marketplace

    # Pricing outcome
    price = Column(Numeric(12, 2), nullable=True)
    discount_percentage = Column(Numeric(5, 2), nullable=True)
    discount_amount = Column(Numeric(12, 2), nullable=True)

    priority = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    product = relationship("Product", back_populates="price_rules")

    __table_args__ = (
        Index("idx_price_rule_product", "product_id"),
        Index("idx_price_rule_vendor", "vendor_id"),
        Index("idx_price_rule_type", "rule_type"),
        Index("idx_price_rule_active", "is_active"),
    )


class ProductModifierGroup(Base):
    """Modifier groups for a product (e.g. 'Spice Level', 'Add-ons', 'Size')."""
    __tablename__ = "product_modifier_group"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(120), nullable=False)
    # single = pick one; multiple = pick many
    selection_type = Column(String(20), nullable=False, default="single")
    is_required = Column(Boolean, nullable=False, default=False)
    min_select = Column(Integer, nullable=False, default=0)
    max_select = Column(Integer, nullable=False, default=1)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_product_modifier_group_product", "product_id"),
        Index("ix_product_modifier_group_vendor", "vendor_id"),
    )


class ProductModifierOption(Base):
    """Individual options inside a modifier group (e.g. 'Extra Cheese +₹20')."""
    __tablename__ = "product_modifier_option"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    group_id = Column(UUID(as_uuid=True), ForeignKey("product_modifier_group.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(120), nullable=False)
    price_delta = Column(Numeric(12, 2), nullable=False, default=0)
    is_default = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_product_modifier_option_group", "group_id"),
    )
