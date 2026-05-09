# app/models/store.py
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, Integer, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Store(Base):
    """A physical retail location / outlet belonging to a vendor."""
    __tablename__ = "store"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(200), nullable=False)
    code = Column(String(50))           # short code e.g. "MUM-01"
    description = Column(Text())
    phone = Column(String(20))
    email = Column(String(255))
    address = Column(JSONB, default={}) # {street, city, state, pincode, country}

    manager_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)

    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    settings = Column(JSONB, default={})  # custom per-store config

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    inventory = relationship("StoreInventory", back_populates="store", cascade="all, delete-orphan")
    staff = relationship("VendorUser", foreign_keys="VendorUser.store_id", back_populates="store")
    manager = relationship("VendorUser", foreign_keys=[manager_id])

    __table_args__ = (
        Index("idx_store_vendor", "vendor_id"),
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

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    store = relationship("Store", back_populates="inventory")
    product = relationship("Product")

    __table_args__ = (
        Index("idx_store_inv_store", "store_id"),
        Index("idx_store_inv_product", "store_id", "product_id"),
    )
