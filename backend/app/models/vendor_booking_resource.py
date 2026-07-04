"""Vendor-configurable bookable resources (rooms, courts, equipment) — synced to website
builder Resource Picker sections."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID

from app.database import Base


class VendorBookingResource(Base):
    __tablename__ = "vendor_booking_resources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(255), nullable=False)
    resource_type = Column(String(60), default="room", nullable=False)  # room, table, court, equipment
    capacity = Column(Integer, default=1, nullable=False)
    description = Column(Text, nullable=True)
    features = Column(JSON, nullable=False, default=list)

    price_per_hour = Column(Float, default=0, nullable=False)
    currency = Column(String(10), default="USD", nullable=False)

    is_available = Column(Boolean, default=True, nullable=False)  # bookable right now vs. currently reserved
    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)  # shown on storefront at all

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
