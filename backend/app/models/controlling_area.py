# app/models/controlling_area.py
"""Controlling Area — the CO-level org unit that groups one or more
`FinCompany` (posting entities) under a shared cost-accounting scope.

Mirrors SAP's Controlling Area / Company Code assignment: a vendor typically
starts with a single "Standard" Controlling Area covering every company, and
only needs more than one when separate legal entities must be kept apart for
CO purposes (different CO currency, no shared cost-center hierarchy, etc.).
See `app/models/controlling.py` for the rest of the CO module, which is
scoped by `company_id`; `CoControllingArea` sits one level above that.
"""
import uuid
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, ForeignKey, UniqueConstraint, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class CoControllingArea(Base):
    __tablename__ = "co_controlling_area"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(20), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    currency = Column(String(3), default="INR")
    is_active = Column(Boolean, default=True, server_default="true")
    is_default = Column(Boolean, default=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    companies = relationship("FinCompany", back_populates="controlling_area")

    __table_args__ = (
        UniqueConstraint("vendor_id", "code", name="uq_co_controlling_area_vendor_code"),
        Index("ix_co_controlling_area_vendor", "vendor_id", "is_active"),
    )
