"""Vendor real-estate property listings — synced to website builder Property sections."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID

from app.database import Base


class VendorProperty(Base):
    __tablename__ = "vendor_properties"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    slug = Column(String(200), nullable=False)
    address = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)

    price = Column(Numeric(14, 2), nullable=True)
    currency = Column(String(3), default="USD", nullable=False)

    beds = Column(Integer, default=0, nullable=False)
    baths = Column(Integer, default=0, nullable=False)
    sqft = Column(Integer, default=0, nullable=False)

    property_type = Column(String(40), default="house", nullable=False)
    status = Column(String(40), default="for-sale", nullable=False)

    image_url = Column(String(1000), nullable=True)
    gallery = Column(JSON, nullable=False, default=list)

    agent_name = Column(String(160), nullable=True)
    agent_phone = Column(String(60), nullable=True)
    agent_email = Column(String(200), nullable=True)
    cta_label = Column(String(120), default="Schedule tour", nullable=False)

    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
