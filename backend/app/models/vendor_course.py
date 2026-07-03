"""Vendor courses — synced to website builder Course Catalog / Course Detail sections."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID

from app.database import Base


class VendorCourse(Base):
    __tablename__ = "vendor_courses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    slug = Column(String(200), nullable=False)
    instructor = Column(String(160), nullable=True)
    level = Column(String(20), default="Beginner", nullable=False)
    category = Column(String(120), nullable=True)
    description = Column(Text, nullable=True)

    duration = Column(String(60), nullable=True)
    lessons = Column(Integer, default=0, nullable=False)
    rating = Column(Numeric(3, 2), default=0, nullable=False)
    reviews = Column(Integer, default=0, nullable=False)

    price = Column(Numeric(14, 2), nullable=True)
    currency = Column(String(3), default="USD", nullable=False)

    image_url = Column(String(1000), nullable=True)

    syllabus = Column(JSON, nullable=False, default=list)
    outcomes = Column(JSON, nullable=False, default=list)
    perks = Column(JSON, nullable=False, default=list)

    enrolled_label = Column(String(120), nullable=True)
    cta_label = Column(String(120), default="Enroll for", nullable=False)
    preview_cta_label = Column(String(120), default="Try free preview", nullable=False)

    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
