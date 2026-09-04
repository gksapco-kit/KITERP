# app/models/procurement_special.py
from sqlalchemy import (
    Column, String, Text, Date, DateTime, Boolean,
    ForeignKey, Numeric, Integer, Index, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class MaterialValuation(Base):
    """
    Stock value & valuation price per product per plant — SAP MBEW equivalent.
    Updated on every goods movement to keep total_value and moving_avg_price current.

    valuation_method:
      moving_average  — price recalculated on each goods receipt (MAP)
      standard_price  — fixed; variances are posted to a price difference account
    """
    __tablename__ = "material_valuation"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True)
    plant_id = Column(UUID(as_uuid=True), ForeignKey("plant.id", ondelete="SET NULL"), nullable=True)

    valuation_method = Column(String(20), nullable=False, default="moving_average")
    currency = Column(String(3), default="INR", nullable=False)

    # Prices
    standard_price = Column(Numeric(14, 4), default=0)
    moving_avg_price = Column(Numeric(14, 4), default=0)

    # Stock totals (updated in real time)
    total_stock = Column(Numeric(14, 4), default=0)   # unrestricted + QI + blocked
    total_value = Column(Numeric(16, 2), default=0)

    # Last purchase info
    last_po_price = Column(Numeric(14, 4), default=0)
    last_purchase_date = Column(Date, nullable=True)

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    product = relationship("Product", lazy="noload")

    __table_args__ = (
        UniqueConstraint("vendor_id", "product_id", "variant_id", "plant_id", name="uq_mat_val_product_plant"),
        Index("ix_mv_vendor", "vendor_id"),
        Index("ix_mv_product", "vendor_id", "product_id"),
    )


class SubcontractingOrder(Base):
    """
    Subcontracting arrangement: components are issued to a supplier who
    returns the finished good — SAP item category L equivalent.

    components JSONB schema:
      [{product_id, variant_id, qty_required, qty_issued, uom, batch_number}]
    """
    __tablename__ = "subcontracting_order"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    purchase_order_id = Column(UUID(as_uuid=True), ForeignKey("purchase_order.id", ondelete="CASCADE"), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier.id", ondelete="RESTRICT"), nullable=False)
    plant_id = Column(UUID(as_uuid=True), ForeignKey("plant.id", ondelete="SET NULL"), nullable=True)

    ref = Column(String(30), nullable=False)
    status = Column(String(20), nullable=False, default="open")
    # open | components_issued | in_progress | received | closed | cancelled

    # Components to be issued
    components = Column(JSONB, nullable=False, default=list)

    # Finished goods expected back
    finished_product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="RESTRICT"), nullable=True)
    finished_variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True)
    qty_expected = Column(Numeric(12, 4), default=0)
    qty_received = Column(Numeric(12, 4), default=0)

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    supplier = relationship("Supplier", lazy="noload")
    finished_product = relationship("Product", foreign_keys=[finished_product_id], lazy="noload")

    __table_args__ = (
        Index("ix_sc_vendor", "vendor_id"),
        Index("ix_sc_po", "purchase_order_id"),
        Index("ix_sc_supplier", "vendor_id", "supplier_id"),
    )


class ConsignmentStock(Base):
    """
    Vendor-owned stock physically held at the buyer's premises.
    Liability transfers only when stock is withdrawn (settled periodically).
    """
    __tablename__ = "consignment_stock"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier.id", ondelete="RESTRICT"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True)
    plant_id = Column(UUID(as_uuid=True), ForeignKey("plant.id", ondelete="SET NULL"), nullable=True)
    storage_location_id = Column(UUID(as_uuid=True), ForeignKey("storage_location.id", ondelete="SET NULL"), nullable=True)

    quantity_available = Column(Numeric(12, 4), nullable=False, default=0)
    quantity_withdrawn = Column(Numeric(12, 4), nullable=False, default=0)  # cumulative withdrawn

    unit_price = Column(Numeric(12, 4), default=0)
    currency = Column(String(3), default="INR", nullable=False)

    # Optional link to the consignment PO that brought this stock in
    purchase_order_id = Column(UUID(as_uuid=True), ForeignKey("purchase_order.id", ondelete="SET NULL"), nullable=True)

    last_replenished_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    supplier = relationship("Supplier", lazy="noload")
    product = relationship("Product", lazy="noload")
    purchase_order = relationship("PurchaseOrder", lazy="noload")

    __table_args__ = (
        Index("ix_cs_vendor", "vendor_id"),
        Index("ix_cs_supplier_product", "vendor_id", "supplier_id", "product_id"),
        Index("ix_cs_plant", "vendor_id", "plant_id"),
        Index("ix_cs_po", "purchase_order_id"),
    )


class ServiceEntrySheet(Base):
    """
    Confirmation that contracted services have been rendered — SAP ML81N equivalent.
    Must be approved before the corresponding vendor invoice is released for payment.

    lines JSONB schema:
      [{po_item_id, service_description, qty_confirmed, unit_price, total, uom}]
    """
    __tablename__ = "service_entry_sheet"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    purchase_order_id = Column(UUID(as_uuid=True), ForeignKey("purchase_order.id", ondelete="RESTRICT"), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier.id", ondelete="RESTRICT"), nullable=False)

    entry_number = Column(String(30), nullable=False)
    status = Column(String(20), nullable=False, default="draft")
    # draft | submitted | approved | rejected

    service_period_from = Column(Date, nullable=True)
    service_period_to = Column(Date, nullable=True)

    lines = Column(JSONB, nullable=False, default=list)
    total_amount = Column(Numeric(14, 2), default=0)
    currency = Column(String(3), default="INR", nullable=False)

    accepted_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    supplier = relationship("Supplier", lazy="noload")

    __table_args__ = (
        UniqueConstraint("vendor_id", "entry_number", name="uq_ses_vendor_entry_number"),
        Index("ix_ses_vendor", "vendor_id"),
        Index("ix_ses_po", "purchase_order_id"),
        Index("ix_ses_status", "vendor_id", "status"),
    )
