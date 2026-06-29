"""Production orders (MTO / MTS) — vendor-scoped, optional store scope."""
from sqlalchemy import (
    Column, String, Text, Integer, Date, DateTime, ForeignKey, UniqueConstraint, Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid

from app.database import Base


class ProductionOrder(Base):
    __tablename__ = "production_order"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"), nullable=True, index=True)
    plant_id = Column(UUID(as_uuid=True), ForeignKey("plant.id", ondelete="SET NULL"), nullable=True, index=True)
    output_storage_location_id = Column(UUID(as_uuid=True), ForeignKey("storage_location.id", ondelete="SET NULL"), nullable=True)

    ref = Column(String(40), nullable=False)
    type = Column(String(10), nullable=False)  # mto | mts
    template = Column(String(80), default="Standard")
    status = Column(String(30), default="draft")
    progress = Column(Integer, default=0)
    priority = Column(String(20), default="medium")

    customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id", ondelete="SET NULL"), nullable=True)
    customer_name = Column(String(255))
    customer_phone = Column(String(30))
    customer_email = Column(String(255))
    order_ref = Column(String(100))
    delivery_deadline = Column(Date)
    special_requirements = Column(Text)

    target_stock_level = Column(Integer)

    team = Column(String(120), default="")
    target_date = Column(Date)
    notes = Column(Text, default="")

    items = Column(JSONB, nullable=False, default=list)
    assignees = Column(JSONB, nullable=False, default=list)
    attachments = Column(JSONB, nullable=False, default=list)
    stock_dispatches = Column(JSONB, nullable=False, default=list)
    audit_log = Column(JSONB, nullable=False, default=list)

    created_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("vendor_id", "ref", name="uq_production_order_vendor_ref"),
        Index("ix_production_order_vendor_store", "vendor_id", "store_id"),
        Index("ix_production_order_status", "vendor_id", "status"),
    )
