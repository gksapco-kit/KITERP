# app/models/vendor_service.py
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, Date,
    ForeignKey, Numeric, Integer, Float, Index, text
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base

SUBSCRIPTION_SCHEDULE_MODES_DEFAULT = ["dates", "cycles", "pick_dates", "weekly", "recurring"]


class Service(Base):
    __tablename__ = "service"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)

    # ── Basic Info ────────────────────────────────────────────────
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    # Unique, human-readable material/item code auto-assigned on creation (e.g. SVC-00001)
    material_code = Column(String(40))
    description = Column(Text)
    short_description = Column(String(500))
    brand = Column(String(255))
    service_type = Column(String(30), default="one_time")

    # ── Categorization ────────────────────────────────────────────
    category = Column(String(100))
    subcategory = Column(String(100))
    tags = Column(JSONB, default=[])

    # ── Pricing & Discounts ───────────────────────────────────────
    price_type = Column(String(30), default="fixed")
    price = Column(Numeric(12, 2))
    price_min = Column(Numeric(12, 2))
    price_max = Column(Numeric(12, 2))
    currency = Column(String(3), default="INR")
    discount_percentage = Column(Numeric(5, 2))
    discount_amount = Column(Numeric(12, 2))
    discount_start_date = Column(DateTime(timezone=True))
    discount_end_date = Column(DateTime(timezone=True))
    offer_label = Column(String(100))

    # ── Tax & Compliance ──────────────────────────────────────────
    is_taxable = Column(Boolean, default=True)
    tax_rate = Column(Numeric(5, 2))
    sac_code = Column(String(8))
    gst_rate = Column(Numeric(5, 2))

    # ── Service Configuration ─────────────────────────────────────
    uom = Column(String(30), default="fixed")
    service_mode = Column(String(30), default="in_store")
    duration_minutes = Column(Integer)
    buffer_minutes = Column(Integer, default=0)
    service_capacity = Column(Integer, default=1)

    # ── Booking & Scheduling ──────────────────────────────────────
    requires_booking = Column(Boolean, default=True)
    # Customer-facing label for the booking option (Business Front)
    booking_label = Column(String(100), default="Booking")
    max_bookings_per_slot = Column(Integer, default=1)
    advance_booking_days = Column(Integer, default=30)
    booking_lead_time_hours = Column(Float)
    cancellation_policy = Column(Text)
    cancellation_hours = Column(Integer)
    rescheduling_policy = Column(Text)
    no_show_policy = Column(Text)

    # ── Service Lifecycle ─────────────────────────────────────────
    service_expiry_date = Column(Date)
    validity_period_days = Column(Integer)
    renewal_required = Column(Boolean, default=False)

    # ── Visibility & Marketing ────────────────────────────────────
    status = Column(String(30), default="draft")
    is_featured = Column(Boolean, default=False)
    is_visible = Column(Boolean, default=True)
    is_popular = Column(Boolean, default=False)
    is_new_service = Column(Boolean, default=False)
    is_on_sale = Column(Boolean, default=False)
    allow_quote_request = Column(Boolean, default=False)
    # Customer-facing label for quote requests (Business Front)
    quote_request_label = Column(String(100), default="Quote Requests")
    quote_form_config = Column(JSONB, default=[])
    store_scope = Column(String(20), default="all", nullable=False)  # all | selected

    # ── Media ─────────────────────────────────────────────────────
    image_url = Column(Text)
    gallery = Column(JSONB, default=[])
    media = Column(JSONB, default=[])

    # ── SEO & Metadata ────────────────────────────────────────────
    meta_title = Column(String(255))
    meta_description = Column(Text)
    meta_keywords = Column(JSONB, default=[])

    # ── Subscription ──────────────────────────────────────────────
    is_subscription = Column(Boolean, default=False)
    # Customer-facing label for the subscription option (Business Front)
    subscription_label = Column(String(100), default="Subscription")
    subscription_interval = Column(String(30))
    subscription_price = Column(Numeric(12, 2))
    subscription_price_type = Column(String(20), default="per_cycle")
    subscription_trial_days = Column(Integer)
    subscription_setup_fee = Column(Numeric(12, 2))
    subscription_billing_cycles = Column(Integer)
    subscription_schedule_modes = Column(
        JSONB, default=list(SUBSCRIPTION_SCHEDULE_MODES_DEFAULT)
    )

    # ── Advanced Features ─────────────────────────────────────────
    service_packages = Column(JSONB, default=[])
    addons = Column(JSONB, default=[])
    prerequisites = Column(Text)
    whats_included = Column(JSONB, default=[])
    whats_not_included = Column(JSONB, default=[])
    service_areas = Column(JSONB, default=[])

    # ── Audit & Tracking ──────────────────────────────────────────
    created_by = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"))
    updated_by = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"))
    version_number = Column(Integer, default=1)
    change_history = Column(JSONB, default=[])
    view_count = Column(Integer, default=0)
    booking_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    published_at = Column(DateTime(timezone=True))

    # Relationships
    vendor = relationship("Vendor", back_populates="services")
    availability = relationship("ServiceAvailability", back_populates="service", cascade="all, delete-orphan")
    plans = relationship("ServicePlan", back_populates="service", cascade="all, delete-orphan", order_by="ServicePlan.sort_order")
    store_assignments = relationship("ServiceStore", back_populates="service", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_service_vendor", "vendor_id"),
        Index("idx_service_slug", "vendor_id", "slug", unique=True),
        Index(
            "idx_service_material_code",
            "vendor_id", "material_code",
            unique=True,
            postgresql_where=text("material_code IS NOT NULL"),
        ),
        Index("idx_service_status", "status"),
        Index("idx_service_category", "category"),
        Index("idx_service_type", "service_type"),
    )


class ServiceAvailability(Base):
    __tablename__ = "service_availability"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    service_id = Column(UUID(as_uuid=True), ForeignKey("service.id", ondelete="CASCADE"), nullable=False)

    day_of_week = Column(Integer, nullable=False)  # 0=Monday, 6=Sunday
    start_time = Column(String(5), nullable=False)  # HH:MM format
    end_time = Column(String(5), nullable=False)
    is_available = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    service = relationship("Service", back_populates="availability")

    __table_args__ = (
        Index("idx_availability_service", "service_id"),
    )


class ServicePlan(Base):
    """Subscription plans for a service (analogous to product variants for subscriptions)."""
    __tablename__ = "service_plan"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    service_id = Column(UUID(as_uuid=True), ForeignKey("service.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(255), nullable=False)
    description = Column(Text)
    price = Column(Numeric(12, 2))
    uom = Column(String(30), default="per_session")
    price_type = Column(String(20), default="per_cycle")
    service_frequency = Column(String(20), default="once")
    service_mode = Column(String(30), default="in_store")

    subscription_interval = Column(String(30))
    subscription_trial_days = Column(Integer)
    subscription_setup_fee = Column(Numeric(12, 2))
    subscription_billing_cycles = Column(Integer)
    subscription_schedule_modes = Column(
        JSONB, default=list(SUBSCRIPTION_SCHEDULE_MODES_DEFAULT)
    )

    duration_minutes = Column(Integer)
    buffer_minutes = Column(Integer, default=0)
    service_capacity = Column(Integer, default=1)
    max_quantity_per_order = Column(Integer, nullable=True)
    min_quantity_per_order = Column(Integer, nullable=True)

    # Pricing overrides
    plan_price_type = Column(String(20))
    price_min = Column(Numeric(12, 2))
    price_max = Column(Numeric(12, 2))
    currency = Column(String(3), default="INR")
    discount_percentage = Column(Numeric(5, 2))
    discount_amount = Column(Numeric(12, 2))
    offer_label = Column(String(100))
    discount_start_date = Column(Text)
    discount_end_date = Column(Text)

    # Tax overrides
    is_taxable = Column(Boolean)
    tax_rate = Column(Numeric(5, 2))
    sac_code = Column(String(8))
    gst_rate = Column(Numeric(5, 2))

    # Booking overrides
    requires_booking = Column(Boolean)
    max_bookings_per_slot = Column(Integer)
    advance_booking_days = Column(Integer)
    booking_lead_time_hours = Column(Float)
    cancellation_policy = Column(Text)
    cancellation_hours = Column(Integer)
    rescheduling_policy = Column(Text)
    no_show_policy = Column(Text)

    # Availability overrides (JSONB array of day/time slots)
    availability = Column(JSONB)

    # Lifecycle overrides
    service_expiry_date = Column(Text)
    validity_period_days = Column(Integer)
    renewal_required = Column(Boolean)

    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    service = relationship("Service", back_populates="plans")

    __table_args__ = (
        Index("idx_service_plan_service", "service_id"),
    )


class ServiceBOMItem(Base):
    """Materials / products consumed to deliver one unit of a service."""
    __tablename__ = "service_bom_item"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    service_id = Column(UUID(as_uuid=True), ForeignKey("service.id", ondelete="CASCADE"), nullable=False)
    component_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    qty_per_service = Column(Numeric(12, 4), nullable=False)
    unit_cost_override = Column(Numeric(12, 4), nullable=True)
    auto_reserve = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    service = relationship("Service", backref="bom_items")
    component = relationship("Product", foreign_keys=[component_id])

    __table_args__ = (
        Index("idx_svc_bom_vendor", "vendor_id"),
        Index("idx_svc_bom_service", "service_id"),
        Index("idx_svc_bom_component", "component_id"),
    )


class ServiceResource(Base):
    """People, equipment, or facilities required to perform a service."""
    __tablename__ = "service_resource"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    service_id = Column(UUID(as_uuid=True), ForeignKey("service.id", ondelete="CASCADE"), nullable=False)
    resource_type = Column(String(30), nullable=False, default="employee")  # employee | work_center | equipment | room
    resource_id = Column(UUID(as_uuid=True), nullable=True)
    resource_name = Column(String(255), nullable=False)
    quantity = Column(Numeric(8, 2), default=1)
    duration_minutes = Column(Integer, nullable=True)
    cost_type = Column(String(20), default="hourly")  # hourly | fixed
    cost_rate = Column(Numeric(12, 4), default=0)
    auto_reserve = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    service = relationship("Service", backref="resources")

    __table_args__ = (
        Index("idx_svc_res_vendor", "vendor_id"),
        Index("idx_svc_res_service", "service_id"),
        Index("idx_svc_res_type", "resource_type"),
    )
