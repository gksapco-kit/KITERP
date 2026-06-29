# app/models/plant.py
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, Integer, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base


class Plant(Base):
    """Manufacturing / distribution plant belonging to a business unit (store)."""
    __tablename__ = "plant"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(200), nullable=False)
    code = Column(String(50), nullable=True)
    description = Column(Text(), nullable=True)
    address = Column(JSONB, default={})

    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    store = relationship("Store", lazy="noload")
    storage_locations = relationship(
        "StorageLocation",
        back_populates="plant",
        lazy="noload",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_plant_vendor", "vendor_id"),
        Index("idx_plant_store", "vendor_id", "store_id"),
        Index("idx_plant_store_code", "store_id", "code", unique=True),
    )
