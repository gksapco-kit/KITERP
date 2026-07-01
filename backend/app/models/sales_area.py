# app/models/sales_area.py
"""Sales & Distribution (SD) organizational data.

Sales Organization is not duplicated here — it reuses the existing Business
Unit (a `Store` row with `parent_id IS NULL`; see app/models/store.py). This
module adds the remaining SAP-SD-style dimensions on top of it:

  Division              — product-line grouping (Food, Apparel, Services...)
  Distribution Channel  — how products are SOLD (Retail, Wholesale, Online, B2B, POS)
  Delivery Channel      — how goods/services are FULFILLED (own fleet, courier,
                           pickup, third-party) — a logistics dimension, distinct
                           from distribution channel.
  Sales Area            — the combination (Business Unit or Branch) x Distribution
                           Channel x Division that transactions are posted against.
                           The business_unit_id column stores the effective store
                           scope (root BU or a branch under it).
"""
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, ForeignKey,
    Integer, Numeric, Index, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class SalesDivision(Base):
    """Product-line grouping (SAP: Division)."""
    __tablename__ = "sales_division"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    code = Column(String(20), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)

    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("vendor_id", "code", name="uq_sales_division_vendor_code"),
        Index("ix_sales_division_vendor", "vendor_id", "is_active"),
    )


class DistributionChannel(Base):
    """How products/services are sold (SAP: Distribution Channel) — a pricing/sales dimension."""
    __tablename__ = "distribution_channel"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    code = Column(String(20), nullable=False)
    name = Column(String(200), nullable=False)
    # retail | wholesale | online | pos | b2b | marketplace | other
    channel_type = Column(String(20), nullable=False, default="retail")
    description = Column(Text)

    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("vendor_id", "code", name="uq_distribution_channel_vendor_code"),
        Index("ix_distribution_channel_vendor", "vendor_id", "is_active"),
    )


class DeliveryChannel(Base):
    """How goods/services are physically fulfilled — a logistics dimension, distinct
    from DistributionChannel (which is a sales/pricing dimension)."""
    __tablename__ = "delivery_channel"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    code = Column(String(20), nullable=False)
    name = Column(String(200), nullable=False)
    # own_fleet | courier | pickup | third_party | postal | other
    mode = Column(String(20), nullable=False, default="own_fleet")
    description = Column(Text)

    lead_time_days = Column(Integer, nullable=True)
    base_charge = Column(Numeric(12, 2), default=0)
    settings = Column(JSONB, default={})  # carrier config, zones, API keys, etc.

    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("vendor_id", "code", name="uq_delivery_channel_vendor_code"),
        Index("ix_delivery_channel_vendor", "vendor_id", "is_active"),
    )


class SalesArea(Base):
    """(Business Unit or Branch) x Distribution Channel x Division (SAP: Sales Area).

    `business_unit_id` stores the effective store scope — either a root Business
    Unit or a Branch under it. Transactions carry a `sales_area_id` to record
    which combination they were sold under.
    """
    __tablename__ = "sales_area"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    business_unit_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="CASCADE"), nullable=False, index=True)
    distribution_channel_id = Column(UUID(as_uuid=True), ForeignKey("distribution_channel.id", ondelete="CASCADE"), nullable=False, index=True)
    division_id = Column(UUID(as_uuid=True), ForeignKey("sales_division.id", ondelete="CASCADE"), nullable=False, index=True)

    # Optional short label, e.g. "MUM-01/RET/FOOD"; auto-derived if left blank.
    code = Column(String(80), nullable=True)
    name = Column(String(255), nullable=True)

    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    business_unit = relationship("Store", lazy="noload")
    distribution_channel = relationship("DistributionChannel", lazy="noload")
    division = relationship("SalesDivision", lazy="noload")

    __table_args__ = (
        UniqueConstraint(
            "vendor_id", "business_unit_id", "distribution_channel_id", "division_id",
            name="uq_sales_area_combo",
        ),
        Index("ix_sales_area_vendor", "vendor_id", "is_active"),
        Index("ix_sales_area_bu", "business_unit_id"),
    )
