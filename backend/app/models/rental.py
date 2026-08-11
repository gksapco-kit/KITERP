from sqlalchemy import Column, Index, String, Text, DateTime, ForeignKey, Numeric, Date, Boolean
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
    category = Column(String(50), default="milk_dairy")  # milk_dairy, furniture, equipment, storage, vehicles, other
    asset_type = Column(String(80), default="storage_rack")
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
    daily_rate = Column(Numeric(12, 2), default=0)
    weekly_rate = Column(Numeric(12, 2), default=0)
    monthly_rate = Column(Numeric(12, 2), default=0)
    deposit_amount = Column(Numeric(12, 2), default=0)
    extra_qty_charge = Column(Numeric(12, 2), default=0)
    extra_weight_charge = Column(Numeric(12, 2), default=0)
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

    # Location / sales scope (route / area)
    sales_area_id = Column(UUID(as_uuid=True), ForeignKey("sales_area.id", ondelete="SET NULL"), nullable=True, index=True)
    location = Column(String(255))
    section = Column(String(100))
    row_label = Column(String(100))
    rack_number = Column(String(50))
    image_url = Column(String(500))

    # available | partially_occupied | fully_occupied | reserved | maintenance | unavailable | retired
    status = Column(String(30), default="available")
    # Storefront visibility window (inclusive). Null = no bound.
    display_start_date = Column(Date)
    display_end_date = Column(Date)
    notes = Column(Text)
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
    pricing_plan = Column(String(20), default="daily")  # daily, weekly, monthly
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)

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
