# app/models/storage_location.py
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, Index, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base


class StorageLocation(Base):
    """Hierarchical storage location within a business unit (store)."""
    __tablename__ = "storage_location"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="CASCADE"), nullable=False)
    plant_id = Column(UUID(as_uuid=True), ForeignKey("plant.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("storage_location.id", ondelete="CASCADE"), nullable=True)

    name = Column(String(200), nullable=False)
    code = Column(String(50))
    description = Column(Text())

    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)

    # Field schema for this location, e.g. [{"name": "Temperature", "type": "text"}]
    custom_fields = Column(JSONB, default=[])

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    store = relationship("Store", lazy="noload")
    plant = relationship("Plant", back_populates="storage_locations", lazy="noload")
    parent = relationship("StorageLocation", remote_side=[id], back_populates="children", lazy="noload")
    children = relationship(
        "StorageLocation",
        back_populates="parent",
        lazy="noload",
        order_by="StorageLocation.sort_order, StorageLocation.name",
    )

    __table_args__ = (
        Index("idx_storage_location_vendor", "vendor_id"),
        Index("idx_storage_location_store", "vendor_id", "store_id"),
        Index("idx_storage_location_plant", "vendor_id", "plant_id"),
        Index("idx_storage_location_parent", "vendor_id", "store_id", "parent_id"),
        Index("idx_storage_location_store_code", "store_id", "code", unique=True),
    )
