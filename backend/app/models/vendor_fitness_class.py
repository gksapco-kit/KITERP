"""Vendor fitness classes — synced to website builder Fitness Schedule section."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class VendorFitnessClass(Base):
    __tablename__ = "vendor_fitness_classes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(255), nullable=False)
    slug = Column(String(200), nullable=False)
    instructor = Column(String(160), nullable=True)
    class_type = Column(String(20), default="Yoga", nullable=False)

    duration = Column(Integer, default=60, nullable=False)
    intensity = Column(Integer, default=3, nullable=False)

    date = Column(String(60), nullable=True)
    time = Column(String(40), nullable=True)

    capacity = Column(Integer, default=20, nullable=False)
    booked = Column(Integer, default=0, nullable=False)
    studio = Column(String(160), nullable=True)

    price = Column(Numeric(14, 2), nullable=True)
    currency = Column(String(3), default="USD", nullable=False)

    cta_label = Column(String(120), default="Reserve", nullable=False)

    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
