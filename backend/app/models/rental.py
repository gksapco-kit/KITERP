from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Numeric, Date, Boolean
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
    max_weight = Column(Numeric(12, 2))
    weight_unit = Column(String(20), default="kg")

    # Pricing
    daily_rate = Column(Numeric(12, 2), default=0)
    weekly_rate = Column(Numeric(12, 2), default=0)
    monthly_rate = Column(Numeric(12, 2), default=0)
    deposit_amount = Column(Numeric(12, 2), default=0)
    extra_qty_charge = Column(Numeric(12, 2), default=0)
    extra_weight_charge = Column(Numeric(12, 2), default=0)

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
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


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

    timeline = Column(JSONB, default=list)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
