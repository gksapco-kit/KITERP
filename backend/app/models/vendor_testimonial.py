"""Vendor-curated testimonials — synced to website builder Testimonials sections."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class VendorTestimonial(Base):
    __tablename__ = "vendor_testimonials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(255), nullable=False)
    role = Column(String(160), nullable=True)
    company = Column(String(160), nullable=True)
    quote = Column(Text, nullable=False)
    avatar_url = Column(String(1000), nullable=True)
    rating = Column(Integer, default=5, nullable=False)

    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
