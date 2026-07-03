"""Vendor vehicle inventory — synced to website builder Auto Inventory / Vehicle Detail sections."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, Numeric, String
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class VendorVehicle(Base):
    __tablename__ = "vendor_vehicles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    slug = Column(String(200), nullable=False)
    year = Column(Integer, default=2024, nullable=False)
    make = Column(String(120), nullable=False)
    model = Column(String(120), nullable=False)
    trim = Column(String(120), nullable=True)
    condition = Column(String(20), default="Used", nullable=False)

    price = Column(Numeric(14, 2), default=0, nullable=False)
    currency = Column(String(3), default="USD", nullable=False)
    mileage = Column(Integer, default=0, nullable=False)
    fuel = Column(String(20), default="Gas", nullable=False)
    transmission = Column(String(20), default="Auto", nullable=False)
    body_style = Column(String(60), nullable=True)
    exterior_color = Column(String(60), nullable=True)
    image_url = Column(String(1000), nullable=True)

    stock_number = Column(String(80), nullable=True)
    location_note = Column(String(500), nullable=True)
    cta_label = Column(String(120), default="Schedule test drive", nullable=False)
    highlights = Column(JSON, nullable=False, default=list)

    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
