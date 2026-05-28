import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Date, ForeignKey, Text, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from app.database import Base


class RestaurantZone(Base):
    __tablename__ = "restaurant_zone"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RestaurantTable(Base):
    __tablename__ = "restaurant_table"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    zone_id = Column(UUID(as_uuid=True), ForeignKey("restaurant_zone.id", ondelete="SET NULL"))
    label = Column(String(40), nullable=False)
    capacity = Column(Integer, nullable=False, default=4)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    # free | seated | ordering | billed | dirty
    status = Column(String(20), nullable=False, default="free")
    # Unique token for customer-facing QR ordering
    qr_token = Column(String(80), unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RestaurantOrder(Base):
    """Open dine-in tab — one per table, created at seating, closed after POS checkout."""
    __tablename__ = "restaurant_order"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    table_id = Column(UUID(as_uuid=True), ForeignKey("restaurant_table.id", ondelete="SET NULL"), index=True)
    # open | billed | closed | voided
    status = Column(String(20), nullable=False, default="open")
    covers = Column(Integer, nullable=False, default=1)
    server_name = Column(String(120))
    # accumulated line items [{product_id, name, qty, unit_price, tax_rate, item_type}]
    items = Column(JSONB, nullable=False, default=list)
    notes = Column(Text)
    pos_transaction_id = Column(UUID(as_uuid=True), ForeignKey("pos_transaction.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class RestaurantKOT(Base):
    """Kitchen Order Ticket — one per 'Send to Kitchen' event on an open order."""
    __tablename__ = "restaurant_kot"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("restaurant_order.id", ondelete="CASCADE"), nullable=False, index=True)
    table_id = Column(UUID(as_uuid=True), ForeignKey("restaurant_table.id", ondelete="SET NULL"))
    kot_number = Column(Integer, nullable=False, default=1)
    # new | preparing | ready | done
    status = Column(String(20), nullable=False, default="new")
    items = Column(JSONB, nullable=False, default=list)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class RestaurantReservation(Base):
    """Guest table reservation — submitted online or by phone."""
    __tablename__ = "restaurant_reservation"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    table_id = Column(UUID(as_uuid=True), ForeignKey("restaurant_table.id", ondelete="SET NULL"))
    guest_name = Column(String(200), nullable=False)
    guest_phone = Column(String(30))
    guest_email = Column(String(200))
    reservation_date = Column(Date, nullable=False)
    reservation_time = Column(String(10), nullable=False)  # HH:MM
    party_size = Column(Integer, nullable=False, default=2)
    # pending | confirmed | seated | cancelled | no_show
    status = Column(String(20), nullable=False, default="pending")
    notes = Column(Text)
    # online | phone | walk_in
    source = Column(String(20), nullable=False, default="online")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_restaurant_reservation_vendor_date", "vendor_id", "reservation_date"),
    )
