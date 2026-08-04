# app/models/procurement_requisition.py
from sqlalchemy import (
    Column, String, Text, Date, DateTime, Boolean,
    ForeignKey, Numeric, Integer, Index, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class PurchaseRequisition(Base):
    """
    Internal demand request that precedes a PO — SAP PR / EBAN equivalent.
    Supports multi-level approval before conversion to a PurchaseOrder.

    status flow:
      draft → submitted → (approved | rejected) → (partially_converted | converted) | cancelled
      draft → open (no approvers assigned) → (partially_converted | converted) | cancelled
    """
    __tablename__ = "purchase_requisition"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)

    pr_number = Column(String(30), nullable=False)
    status = Column(String(30), nullable=False, default="draft")
    # draft | submitted | open | approved | rejected | partially_converted | converted | cancelled

    requested_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    department = Column(String(100), nullable=True)
    priority = Column(String(20), default="medium")  # low | medium | high | urgent
    requisition_type = Column(String(20), default="product")  # product | service | asset | consumption | other

    # Business unit & sourcing context
    store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"), nullable=True)
    procurement_source = Column(String(20), default="supplier")  # supplier | internal
    bu_scope = Column(String(20), nullable=True)  # within_bu | cross_bu (internal only)
    from_store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"), nullable=True)
    to_store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"), nullable=True)
    header_supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier.id", ondelete="SET NULL"), nullable=True)

    notes = Column(Text, nullable=True)
    approver_message = Column(Text, nullable=True)  # message from requester to approver(s)

    audit_log = Column(JSONB, nullable=False, default=list)  # status-change trail

    submitted_at = Column(DateTime(timezone=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship(
        "PurchaseRequisitionItem",
        back_populates="requisition",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    requester = relationship("VendorUser", foreign_keys=[requested_by], lazy="selectin")
    store = relationship("Store", foreign_keys=[store_id], lazy="selectin")
    from_store = relationship("Store", foreign_keys=[from_store_id], lazy="selectin")
    to_store = relationship("Store", foreign_keys=[to_store_id], lazy="selectin")
    header_supplier = relationship("Supplier", foreign_keys=[header_supplier_id], lazy="selectin")
    approvals = relationship(
        "PurchaseRequisitionApproval",
        back_populates="requisition",
        lazy="noload",
        cascade="all, delete-orphan",
        order_by="PurchaseRequisitionApproval.level",
    )

    __table_args__ = (
        UniqueConstraint("vendor_id", "pr_number", name="uq_pr_vendor_number"),
        Index("ix_pr_vendor", "vendor_id"),
        Index("ix_pr_vendor_status", "vendor_id", "status"),
    )


class PurchaseRequisitionItem(Base):
    """
    Individual line of a Purchase Requisition.
    Tracks how much of the requisition has been converted to a PO.
    """
    __tablename__ = "purchase_requisition_item"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requisition_id = Column(UUID(as_uuid=True), ForeignKey("purchase_requisition.id", ondelete="CASCADE"), nullable=False)
    item_type = Column(String(20), default="product")  # product | service | asset | consumption | other
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="RESTRICT"), nullable=True)
    service_id = Column(UUID(as_uuid=True), ForeignKey("service.id", ondelete="RESTRICT"), nullable=True)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True)
    description = Column(Text, nullable=True)
    asset_category_id = Column(UUID(as_uuid=True), ForeignKey("fin_asset_category.id", ondelete="SET NULL"), nullable=True)

    quantity = Column(Numeric(12, 4), nullable=False)
    unit_of_measure = Column(String(20), default="piece")
    needed_by_date = Column(Date, nullable=True)

    plant_id = Column(UUID(as_uuid=True), ForeignKey("plant.id", ondelete="SET NULL"), nullable=True)
    storage_location_id = Column(UUID(as_uuid=True), ForeignKey("storage_location.id", ondelete="SET NULL"), nullable=True)

    estimated_price = Column(Numeric(12, 2), default=0)

    # Preferred supplier (optional)
    suggested_supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier.id", ondelete="SET NULL"), nullable=True)

    # Conversion tracking
    quantity_ordered = Column(Numeric(12, 4), default=0)
    purchase_order_id = Column(UUID(as_uuid=True), ForeignKey("purchase_order.id", ondelete="SET NULL"), nullable=True)
    is_converted = Column(Boolean, default=False)

    notes = Column(Text, nullable=True)

    requisition = relationship("PurchaseRequisition", back_populates="items")
    product = relationship("Product", lazy="selectin")
    service = relationship("Service", lazy="selectin")
    variant = relationship("ProductVariant", foreign_keys=[variant_id], lazy="selectin")
    plant = relationship("Plant", foreign_keys=[plant_id], lazy="selectin")
    storage_location = relationship("StorageLocation", foreign_keys=[storage_location_id], lazy="selectin")
    suggested_supplier = relationship("Supplier", foreign_keys=[suggested_supplier_id], lazy="selectin")

    __table_args__ = (
        Index("ix_pri_requisition", "requisition_id"),
        Index("ix_pri_product", "product_id"),
    )


class PurchaseRequisitionApproval(Base):
    """
    One approval step (level) on a Purchase Requisition.
    Multiple rows per PR support multi-level release strategies.

    status: pending | approved | rejected | skipped
    """
    __tablename__ = "purchase_requisition_approval"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requisition_id = Column(UUID(as_uuid=True), ForeignKey("purchase_requisition.id", ondelete="CASCADE"), nullable=False)

    level = Column(Integer, nullable=False, default=1)      # approval tier (1 = first, 2 = second, …)
    approver_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)

    status = Column(String(20), nullable=False, default="pending")
    comments = Column(Text, nullable=True)

    actioned_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    requisition = relationship("PurchaseRequisition", back_populates="approvals")
    approver = relationship("VendorUser", foreign_keys=[approver_id], lazy="selectin")

    __table_args__ = (
        Index("ix_pra_requisition", "requisition_id"),
        Index("ix_pra_approver", "approver_id"),
    )
