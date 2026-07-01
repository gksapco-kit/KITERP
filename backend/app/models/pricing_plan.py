"""Vendor storefront pricing plans — synced to website builder pricing sections."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID

from app.database import Base


class VendorPricingPlan(Base):
    __tablename__ = "vendor_pricing_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(255), nullable=False)
    slug = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    price = Column(Numeric(12, 2), nullable=True)
    currency = Column(String(3), default="INR", nullable=False)
    period = Column(String(40), default="mo", nullable=False)

    features = Column(JSON, nullable=False, default=list)

    is_featured = Column(Boolean, default=False, nullable=False)
    cta_label = Column(String(120), default="Get started", nullable=False)
    cta_url = Column(String(500), default="/contact", nullable=False)

    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
