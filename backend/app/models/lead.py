from sqlalchemy import (
    Column, String, Text, DateTime, ForeignKey, Boolean,
    Numeric, Integer, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Lead(Base):
    __tablename__ = "lead"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), index=True)
    customer_name = Column(String(255), nullable=False)
    customer_phone = Column(String(20))
    customer_email = Column(String(255))

    category = Column(String(100), nullable=False)
    subcategory = Column(String(100))
    title = Column(String(500), nullable=False)
    description = Column(Text)

    budget_min = Column(Numeric(12, 2))
    budget_max = Column(Numeric(12, 2))

    location_lat = Column(Numeric(10, 6))
    location_lng = Column(Numeric(10, 6))
    location_text = Column(String(255))
    radius_km = Column(Integer, default=10)

    photos = Column(JSONB, default=[])

    status = Column(String(20), default="open")  # open, quoted, assigned, completed, cancelled, expired
    quote_count = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    expires_at = Column(DateTime(timezone=True))

    __table_args__ = (
        Index("ix_lead_status", "status"),
        Index("ix_lead_category", "category"),
    )


class Quote(Base):
    __tablename__ = "quote"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("lead.id"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id"), nullable=False, index=True)

    price = Column(Numeric(12, 2), nullable=False)
    estimated_time = Column(String(100))
    conditions = Column(Text)
    message = Column(Text)

    status = Column(String(20), default="submitted")  # submitted, accepted, rejected, expired
    is_selected = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_quote_lead_vendor", "lead_id", "vendor_id", unique=True),
    )
