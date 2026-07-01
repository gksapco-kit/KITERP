# app/models/store.py
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, Integer, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Store(Base):
    """A physical retail location / outlet belonging to a vendor.

    Self-referential hierarchy: a row with parent_id=NULL is a Business Unit
    (unit_type='business_unit'); a row with parent_id set is a Branch
    (unit_type='branch') that belongs to that Business Unit. Branches are
    ordinary Store rows, so every existing store_id FK (orders, POS, invoices,
    bookings, inventory, staff, ...) continues to work unchanged when it
    points at a branch. Only two levels are supported — a branch cannot have
    its own child branches.
    """
    __tablename__ = "store"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)

    # Hierarchy: NULL = Business Unit (root); set = Branch under that BU.
    parent_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="RESTRICT"), nullable=True, index=True)
    unit_type = Column(String(20), nullable=False, default="business_unit", server_default="business_unit")  # business_unit | branch

    name = Column(String(200), nullable=False)
    code = Column(String(50))           # short code e.g. "MUM-01"
    description = Column(Text())
    phone = Column(String(20))
    email = Column(String(255))
    address = Column(JSONB, default={}) # {street, city, state, pincode, country}

    manager_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)

    is_active = Column(Boolean, default=True)
    is_open = Column(Boolean, default=True)   # operational open/closed toggle
    is_default = Column(Boolean, default=False)
    settings = Column(JSONB, default={})  # custom per-store config

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    inventory = relationship("StoreInventory", back_populates="store", cascade="all, delete-orphan")
    staff = relationship("VendorUser", foreign_keys="VendorUser.store_id", back_populates="store")
    manager = relationship("VendorUser", foreign_keys=[manager_id])
    parent = relationship("Store", remote_side=[id], back_populates="branches", foreign_keys=[parent_id])
    branches = relationship("Store", back_populates="parent", foreign_keys=[parent_id])

    __table_args__ = (
        Index("idx_store_vendor", "vendor_id"),
        Index("idx_store_parent", "vendor_id", "parent_id"),
    )


class StoreInventory(Base):
    """Per-store stock level for a product (or specific variant)."""
    __tablename__ = "store_inventory"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="CASCADE"), nullable=False)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variant.id", ondelete="CASCADE"), nullable=True)

    quantity = Column(Integer, default=0)
    low_stock_threshold = Column(Integer, default=5)
    storage_location_id = Column(UUID(as_uuid=True), ForeignKey("storage_location.id", ondelete="SET NULL"), nullable=True)

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    store = relationship("Store", back_populates="inventory")
    product = relationship("Product")
    storage_location = relationship("StorageLocation", lazy="noload")

    __table_args__ = (
        Index("idx_store_inv_store", "store_id"),
        Index("idx_store_inv_product", "store_id", "product_id"),
        Index("idx_store_inv_location", "store_id", "storage_location_id"),
    )


class ProductStore(Base):
    """Catalog availability: which business units sell this product."""
    __tablename__ = "product_store"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", back_populates="store_assignments")
    store = relationship("Store")

    __table_args__ = (
        Index("idx_product_store_product", "product_id"),
        Index("idx_product_store_store", "store_id"),
        Index("uq_product_store", "product_id", "store_id", unique=True),
    )


class ServiceStore(Base):
    """Catalog availability: which business units offer this service."""
    __tablename__ = "service_store"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    service_id = Column(UUID(as_uuid=True), ForeignKey("service.id", ondelete="CASCADE"), nullable=False)
    store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    service = relationship("Service", back_populates="store_assignments")
    store = relationship("Store")

    __table_args__ = (
        Index("idx_service_store_service", "service_id"),
        Index("idx_service_store_store", "store_id"),
        Index("uq_service_store", "service_id", "store_id", unique=True),
    )
