# app/models/yield_management.py
"""Cutting yield for products sold after processing (meat, poultry, seafood …).

A yield profile lists the cuts of one category and how much raw stock each cut needs
to give 1 unit of finished output (boneless chicken: 1.30 kg raw → 1 kg). A product
links to a profile and each cut variant carries its factor, so one sale removes
output × factor from the raw stock balance.

YieldDayClose freezes one product's end-of-day figures once the physical count is in.
"""
from sqlalchemy import (
    Column, String, Text, Boolean, Date, DateTime, ForeignKey, Index, Integer,
    Numeric, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base


class YieldProfile(Base):
    __tablename__ = "yield_profile"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(150), nullable=False)
    # Product category (product.category) this profile is suggested for.
    category = Column(String(100), nullable=True)
    input_uom = Column(String(30), nullable=False, default="kg")
    description = Column(Text)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    lines = relationship(
        "YieldProfileLine", back_populates="profile",
        cascade="all, delete-orphan", order_by="YieldProfileLine.sort_order",
        lazy="selectin",
    )

    __table_args__ = (
        Index("idx_yield_profile_vendor", "vendor_id"),
    )


class YieldProfileLine(Base):
    __tablename__ = "yield_profile_line"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("yield_profile.id", ondelete="CASCADE"), nullable=False)
    cut_name = Column(String(100), nullable=False)
    # Raw input needed for 1 unit of output (1.30 = 1.30 kg raw gives 1 kg).
    input_per_output = Column(Numeric(8, 4), nullable=False)
    # Weigh-out step for the cutter, in input_uom (0.05 = round to 50 g).
    rounding_step = Column(Numeric(8, 3), nullable=True)
    byproduct = Column(String(150), nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)

    profile = relationship("YieldProfile", back_populates="lines")

    __table_args__ = (
        Index("idx_yield_profile_line_profile", "profile_id"),
    )


class YieldDayClose(Base):
    __tablename__ = "yield_day_close"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    business_date = Column(Date, nullable=False)
    pool_uom = Column(String(30), nullable=False, default="kg")

    opening_qty = Column(Numeric(14, 4), nullable=False, default=0)
    purchased_qty = Column(Numeric(14, 4), nullable=False, default=0)
    raw_cut_qty = Column(Numeric(14, 4), nullable=False, default=0)
    returned_qty = Column(Numeric(14, 4), nullable=False, default=0)
    wastage_qty = Column(Numeric(14, 4), nullable=False, default=0)
    other_qty = Column(Numeric(14, 4), nullable=False, default=0)
    closing_system_qty = Column(Numeric(14, 4), nullable=False, default=0)
    closing_physical_qty = Column(Numeric(14, 4), nullable=False, default=0)
    variance_qty = Column(Numeric(14, 4), nullable=False, default=0)
    output_sold_qty = Column(Numeric(14, 4), nullable=False, default=0)
    cutting_loss_qty = Column(Numeric(14, 4), nullable=False, default=0)

    sales_amount = Column(Numeric(14, 2), nullable=False, default=0)
    raw_cost_per_unit = Column(Numeric(12, 4), nullable=True)
    cogs_amount = Column(Numeric(14, 2), nullable=False, default=0)

    # Per-cut breakdown as shown on the report at close time.
    cuts = Column(JSONB, nullable=False, default=list)
    notes = Column(Text)
    closed_by = Column(UUID(as_uuid=True), ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    closed_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("vendor_id", "product_id", "business_date", name="uq_yield_day_close"),
        Index("idx_yield_day_close_vendor_date", "vendor_id", "business_date"),
    )
