"""Vendor recurring booking plans — synced to website builder Recurring Booking section."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSON, UUID

from app.database import Base


class VendorRecurringPlan(Base):
    __tablename__ = "vendor_recurring_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    slug = Column(String(200), nullable=False)
    image_url = Column(String(1000), nullable=True)

    start_date = Column(String(20), nullable=True)  # ISO date, e.g. 2026-05-04
    start_time = Column(String(10), nullable=True)  # HH:MM
    duration_minutes = Column(Integer, nullable=True)

    price_per_session = Column(Float, default=0, nullable=False)
    currency = Column(String(10), default="USD", nullable=False)

    default_session_count = Column(Integer, default=8, nullable=False)
    min_sessions = Column(Integer, default=2, nullable=False)
    max_sessions = Column(Integer, default=24, nullable=False)

    show_upcoming = Column(Boolean, default=True, nullable=False)
    cta_label = Column(String(120), default="Confirm series", nullable=False)

    presets = Column(JSON, nullable=False, default=list)

    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
