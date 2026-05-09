# app/models/procurement.py
from sqlalchemy import (
    Column, String, Text, DateTime, Date,
    ForeignKey, Numeric, Integer, Index, Boolean
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Supplier(Base):
    __tablename__ = "supplier"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)

    # party_type: supplier | employee | partner | contractor
    party_type = Column(String(20), nullable=False, server_default="supplier")

    name = Column(String(255), nullable=False)
    contact_name = Column(String(255))
    email = Column(String(255))
    phone = Column(String(30))
    address = Column(JSONB, default={})
    notes = Column(Text)
    is_active = Column(Boolean, default=True)

    # Business / GST
    gstin = Column(String(15), nullable=True)
    pan_number = Column(String(10), nullable=True)
    cin = Column(String(21), nullable=True)
    company_name = Column(String(255), nullable=True)

    # Financial
    opening_balance = Column(Numeric(12, 2), default=0)

    # Bank Details
    bank_name = Column(String(100), nullable=True)
    account_number = Column(String(30), nullable=True)
    account_holder_name = Column(String(255), nullable=True)
    account_type = Column(String(20), default="savings")
    ifsc_code = Column(String(15), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    purchase_orders = relationship("PurchaseOrder", back_populates="supplier", lazy="noload")

    __table_args__ = (
        Index("ix_supplier_vendor", "vendor_id"),
        Index("ix_supplier_vendor_name", "vendor_id", "name"),
    )


class PurchaseOrder(Base):
    __tablename__ = "purchase_order"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier.id", ondelete="RESTRICT"), nullable=False)

    po_number = Column(String(20), nullable=False)
    status = Column(String(30), nullable=False, default="draft")
    # draft, sent, partial_received, received, closed, cancelled

    order_date = Column(Date)
    expected_delivery_date = Column(Date)
    notes = Column(Text)

    subtotal = Column(Numeric(12, 2), nullable=False, default=0)
    tax_amount = Column(Numeric(12, 2), default=0)
    total = Column(Numeric(12, 2), nullable=False, default=0)

    created_by = Column(UUID(as_uuid=True), ForeignKey("user.id"))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    received_at = Column(DateTime(timezone=True))
    closed_at = Column(DateTime(timezone=True))

    supplier = relationship("Supplier", back_populates="purchase_orders", lazy="selectin")
    items = relationship("PurchaseOrderItem", back_populates="purchase_order", lazy="selectin", cascade="all, delete-orphan")
    receipts = relationship("PurchaseOrderReceipt", back_populates="purchase_order", lazy="noload", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_po_vendor", "vendor_id"),
        Index("ix_po_vendor_status", "vendor_id", "status"),
        Index("ix_po_supplier", "supplier_id"),
        Index("uq_po_vendor_number", "vendor_id", "po_number", unique=True),
    )


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_item"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purchase_order_id = Column(UUID(as_uuid=True), ForeignKey("purchase_order.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="RESTRICT"), nullable=False)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variant.id", ondelete="SET NULL"))

    quantity_ordered = Column(Integer, nullable=False)
    quantity_received = Column(Integer, nullable=False, default=0)
    unit_cost = Column(Numeric(12, 2), nullable=False, default=0)
    total_cost = Column(Numeric(12, 2), nullable=False, default=0)
    notes = Column(Text)

    purchase_order = relationship("PurchaseOrder", back_populates="items")
    product = relationship("Product", lazy="selectin")
    variant = relationship("ProductVariant", foreign_keys=[variant_id], lazy="selectin")

    __table_args__ = (
        Index("ix_poi_po", "purchase_order_id"),
        Index("ix_poi_product", "product_id"),
    )


class PurchaseOrderReceipt(Base):
    __tablename__ = "purchase_order_receipt"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purchase_order_id = Column(UUID(as_uuid=True), ForeignKey("purchase_order.id", ondelete="CASCADE"), nullable=False)
    received_by = Column(UUID(as_uuid=True), ForeignKey("user.id"))

    received_at = Column(DateTime(timezone=True), server_default=func.now())
    notes = Column(Text)
    items = Column(JSONB, default=[])

    purchase_order = relationship("PurchaseOrder", back_populates="receipts")

    __table_args__ = (
        Index("ix_por_po", "purchase_order_id"),
    )
