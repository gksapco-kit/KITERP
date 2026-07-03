"""Vendor ticketed events — synced to website builder Ticket Picker section."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSON, UUID

from app.database import Base


class VendorEvent(Base):
    __tablename__ = "vendor_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    slug = Column(String(200), nullable=False)
    tagline = Column(String(500), nullable=True)
    image_url = Column(String(1000), nullable=True)

    event_date = Column(String(20), nullable=True)  # ISO date, e.g. 2026-06-05
    doors_time = Column(String(10), nullable=True)  # HH:MM
    start_time = Column(String(10), nullable=True)  # HH:MM

    venue = Column(String(255), nullable=True)
    address = Column(String(500), nullable=True)
    age_note = Column(String(255), nullable=True)

    order_title = Column(String(120), default="Your order", nullable=False)
    seating_title = Column(String(120), default="Seating chart", nullable=False)
    show_seating = Column(Boolean, default=True, nullable=False)
    max_per_order = Column(Integer, default=8, nullable=False)
    cta_label = Column(String(120), default="Continue to checkout", nullable=False)

    tiers = Column(JSON, nullable=False, default=list)

    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
