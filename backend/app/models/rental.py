from sqlalchemy import Column, Index, Integer, String, Text, DateTime, ForeignKey, Numeric, Date, Boolean, Time
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid

from app.database import Base


class RentalAsset(Base):
    """Generic rental asset (racks, furniture, equipment, etc.)."""

    __tablename__ = "rental_asset"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(160), nullable=False)
    asset_code = Column(String(50))
    sku = Column(String(100))
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id"), nullable=True)
    # Asset kind / form preset: milk_dairy | furniture | equipment | storage | vehicles | other
    # This drives the adaptive form fields (capacity units, location labels, etc.)
    # It is intentionally separate from category_id which is the merchandising category.
    category = Column(String(50), default="milk_dairy")
    # Merchandising category — FK to vendor_category tree (nullable, optional).
    # ON DELETE SET NULL keeps the asset alive if the vendor removes the category node.
    category_id = Column(
        UUID(as_uuid=True),
        ForeignKey("vendor_category.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    asset_type = Column(String(80), default="storage_rack")
    short_description = Column(String(500))
    description = Column(Text)

    # Capacity inventory
    capacity_max = Column(Numeric(12, 2), default=1)
    capacity_unit = Column(String(40), default="units")  # packets, boxes, litres, kg, units, custom
    current_occupancy = Column(Numeric(12, 2), default=0)
    # Units currently damaged (returned in damaged condition, not yet repaired)
    damaged_qty = Column(Numeric(12, 2), default=0)
    # Units recorded as lost / missing — permanently removed from available pool
    lost_qty = Column(Numeric(12, 2), default=0)
    max_weight = Column(Numeric(12, 2))
    weight_unit = Column(String(20), default="kg")

    # Pricing
    currency = Column(String(3), default="INR", server_default="INR")
    daily_rate = Column(Numeric(12, 2), default=0)
    weekly_rate = Column(Numeric(12, 2), default=0)
    monthly_rate = Column(Numeric(12, 2), default=0)
    deposit_amount = Column(Numeric(12, 2), default=0)
    extra_qty_charge = Column(Numeric(12, 2), default=0)
    extra_weight_charge = Column(Numeric(12, 2), default=0)
    # Named extras: [{id, name, description, charge_type: amount|percent, value}]
    additional_charges = Column(JSONB, default=list)
    # Per-unit pricing: rate charged per capacity_unit per rental period
    # e.g. ₹10 per packet/day. capacity_unit serves as the UOM.
    price_per_unit = Column(Numeric(12, 2), default=0)
    # Optional custom UOM label when price_per_unit pricing is used and
    # the pricing unit differs from capacity_unit (e.g. "case" vs "packets")
    pricing_uom = Column(String(40))
    # Extended time-plan rates
    hourly_rate = Column(Numeric(12, 2), default=0)
    per_minute_rate = Column(Numeric(12, 2), default=0)
    yearly_rate = Column(Numeric(12, 2), default=0)
    # Flexible minute/hour slots: [{minutes: 15, rate: 50}, {minutes: 120, rate: 200}]
    duration_rates = Column(JSONB, default=list)
    # Flexible day/week/month/year slots: [{days: 1, rate: 100}, {days: 14, rate: 800}]
    period_rates = Column(JSONB, default=list)
    # Tax % applied on rental rates (GST-style). Common values: 0, 5, 12, 18, 28.
    tax_rate = Column(Numeric(5, 2), default=0)

    # Location / sales scope (route / area)
    sales_area_id = Column(UUID(as_uuid=True), ForeignKey("sales_area.id", ondelete="SET NULL"), nullable=True, index=True)
    location = Column(String(255))
    section = Column(String(100))
    row_label = Column(String(100))
    rack_number = Column(String(50))
    # Denormalised primary thumbnail — kept in sync with the first is_primary item in media.
    image_url = Column(Text)
    # Structured media gallery: [{id, url, media_type, is_primary, alt_text, position}]
    # Mirrors vendor_service.media — supports images, video, and 3D models.
    media = Column(JSONB, default=[])

    # available | partially_occupied | fully_occupied | reserved | maintenance | unavailable | retired
    status = Column(String(30), default="available")
    # Storefront visibility window (inclusive). Null = no bound.
    display_start_date = Column(Date)
    display_end_date = Column(Date)
    notes = Column(Text)
    # Customer-facing booking / delivery message on the storefront detail panel.
    # Empty = hide the line. Vendors write whatever they want (delivery, pickup, etc.).
    delivery_info = Column(String(500))
    # When True, storefront booking form shows the "Need delivery" checkbox.
    delivery_enabled = Column(Boolean, default=False, server_default="false")
    is_active = Column(Boolean, default=True)
    # Explicit storefront toggle — mirrors Product.is_visible / Service.is_visible
    is_visible = Column(Boolean, default=True, server_default="true")
    # "all" = shown in every business unit; "selected" = only the units in rental_asset_store
    store_scope = Column(String(20), default="all", server_default="all")

    # ── Sub-asset / unit tracking ─────────────────────────────────────
    # Hierarchy: an asset may be a child of another (e.g. single van inside a fleet).
    parent_asset_id = Column(UUID(as_uuid=True), ForeignKey("rental_asset.id", ondelete="SET NULL"), nullable=True, index=True)
    # When True the asset itself can be booked; set False for pure container assets.
    is_bookable = Column(Boolean, default=True)
    # none = no unit tracking; hierarchy = uses parent_asset_id tree;
    # serialized = individual rental_asset_unit rows with serial numbers.
    unit_mode = Column(String(20), default="none")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("uq_rental_asset_vendor_slug", "vendor_id", "slug", unique=True),
    )


class RentalAssetStore(Base):
    """Catalog availability: which business units offer this rental asset.

    Only consulted when store_scope == 'selected'; when scope is 'all' the
    asset appears across every business unit regardless of this table.
    """

    __tablename__ = "rental_asset_store"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("rental_asset.id", ondelete="CASCADE"), nullable=False)
    store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_rental_asset_store_asset", "asset_id"),
        Index("idx_rental_asset_store_store", "store_id"),
        Index("uq_rental_asset_store", "asset_id", "store_id", unique=True),
    )


class RentalBooking(Base):
    __tablename__ = "rental_booking"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id"), nullable=True)
    sales_area_id = Column(UUID(as_uuid=True), ForeignKey("sales_area.id", ondelete="SET NULL"), nullable=True, index=True)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("rental_asset.id"), nullable=False)
    booking_number = Column(String(40))

    customer_name = Column(String(255), nullable=False)
    customer_email = Column(String(255))
    customer_phone = Column(String(20))

    quantity = Column(Numeric(12, 2), default=1)
    weight_requested = Column(Numeric(12, 2))
    pricing_plan = Column(String(20), default="daily")  # daily, weekly, monthly, yearly, hourly, per_minute
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    # Optional check-in / check-out (or hourly window) times — HH:MM stored as Time
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)

    # pending | approved | confirmed | active | completed | cancelled | rejected
    status = Column(String(20), default="pending")
    rental_amount = Column(Numeric(12, 2), default=0)
    deposit_amount = Column(Numeric(12, 2), default=0)
    total_amount = Column(Numeric(12, 2), default=0)

    # unpaid | pending | paid | partial | refunded
    payment_status = Column(String(20), default="unpaid")
    payment_method = Column(String(40))
    payment_reference = Column(String(100))
    paid_at = Column(DateTime(timezone=True))

    # not_required | pending | assigned | in_transit | delivered | return_scheduled | returned
    delivery_status = Column(String(30), default="not_required")
    van_number = Column(String(50))
    van_driver_name = Column(String(120))
    van_driver_phone = Column(String(20))
    van_vehicle_type = Column(String(80))
    estimated_delivery_at = Column(DateTime(timezone=True))
    delivered_at = Column(DateTime(timezone=True))
    delivery_notes = Column(Text)
    delivery_address = Column(Text)

    # Return / check-in tracking
    # good | damaged | missing
    return_condition = Column(String(20))
    returned_at = Column(DateTime(timezone=True))
    quantity_returned = Column(Numeric(12, 2))
    damage_charge = Column(Numeric(12, 2), default=0)
    late_fee = Column(Numeric(12, 2), default=0)
    deposit_refunded = Column(Numeric(12, 2), default=0)
    return_notes = Column(Text)

    timeline = Column(JSONB, default=list)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class RentalAssetUnit(Base):
    """Individual serialized unit belonging to a RentalAsset (unit_mode='serialized').

    Examples: a rack set with 10 individually numbered racks, or a fleet of
    numbered cylinders. Each unit can carry its own condition and availability.
    """

    __tablename__ = "rental_asset_unit"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("rental_asset.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id"), nullable=False, index=True)
    serial_no = Column(String(100), nullable=False)
    label = Column(String(255))
    # good | damaged | lost | retired
    condition = Column(String(20), default="good")
    # available | rented | maintenance | retired
    status = Column(String(20), default="available")
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class RentalBookingUnit(Base):
    """Join table: one row per serialized unit assigned to a specific booking.

    Created automatically when a booking moves to 'active' (auto-assign picks
    the first available units) or when the vendor manually assigns units via
    the booking sheet. The row is 'closed' (released_at set) on return.

    A unit that is reassigned mid-rental gets its current join row released
    and a new row opened for the replacement.
    """

    __tablename__ = "rental_booking_unit"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("rental_booking.id", ondelete="CASCADE"), nullable=False, index=True)
    unit_id = Column(UUID(as_uuid=True), ForeignKey("rental_asset_unit.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id"), nullable=False, index=True)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    released_at = Column(DateTime(timezone=True), nullable=True)
    assigned_by = Column(String(255))
    notes = Column(Text)

    __table_args__ = (
        Index("uq_rental_booking_unit_active", "booking_id", "unit_id", unique=True),
    )


class RentalReturn(Base):
    """Immutable audit record written for every process_return call.

    Unlike booking.quantity_returned (a running total), each RentalReturn row
    captures a single return event so operators have a full return history.
    """

    __tablename__ = "rental_return"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("rental_booking.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id"), nullable=False, index=True)
    quantity_returned = Column(Numeric(12, 2), nullable=False)
    # good | damaged | missing
    return_condition = Column(String(20), nullable=False, default="good")
    damage_charge = Column(Numeric(12, 2), default=0)
    late_fee = Column(Numeric(12, 2), default=0)
    deposit_refunded = Column(Numeric(12, 2), default=0)
    return_notes = Column(Text)
    # JSON list of RentalAssetUnit IDs returned in this event (serialized assets only)
    unit_ids = Column(JSONB, default=list)
    returned_at = Column(DateTime(timezone=True), server_default=func.now())


class RentalRegistrationForm(Base):
    """Google Forms-style intake template shown before a rental booking."""

    __tablename__ = "rental_registration_form"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(160), nullable=False)
    description = Column(Text)
    template_key = Column(String(40), default="blank")
    # draft | published
    status = Column(String(20), default="draft", server_default="draft")
    version = Column(Integer, default=1, server_default="1")
    fields = Column(JSONB, default=list)
    theme = Column(JSONB, default=dict)
    use_on_storefront = Column(Boolean, default=False, server_default="false")
    use_on_staff_booking = Column(Boolean, default=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class RentalRegistrationSubmission(Base):
    """Filled registration answers, linked to a booking when one is created."""

    __tablename__ = "rental_registration_submission"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    form_id = Column(UUID(as_uuid=True), ForeignKey("rental_registration_form.id", ondelete="CASCADE"), nullable=False, index=True)
    form_version = Column(Integer, default=1)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("rental_booking.id", ondelete="SET NULL"), nullable=True, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id", ondelete="SET NULL"), nullable=True)
    customer_name = Column(String(255))
    channel = Column(String(20), default="storefront")  # storefront | staff
    answers = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
