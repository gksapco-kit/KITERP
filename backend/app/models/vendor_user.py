# app/models/vendor_user.py
from sqlalchemy import Column, String, Boolean, DateTime, Date, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class VendorUser(Base):
    __tablename__ = "vendor_user"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=False)

    # Store assignment (nullable = access to all stores)
    store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"), nullable=True)

    # Role: system role name OR links to custom VendorRole
    role = Column(String(50), nullable=False, default="staff")  # owner, admin, manager, sales, staff, custom
    role_id = Column(UUID(as_uuid=True), ForeignKey("vendor_role.id", ondelete="SET NULL"), nullable=True)

    # Override permissions (merged with role permissions)
    permissions = Column(JSONB, default=[])

    is_active = Column(Boolean, default=True)

    # Access window (optional); access_ends_at may be synced from HR employee LWD
    access_starts_at = Column(Date, nullable=True)
    access_ends_at = Column(Date, nullable=True)
    access_end_source = Column(String(20), nullable=True)  # manual | hr_lwd
    access_sync_note = Column(Text, nullable=True)

    invited_by = Column(UUID(as_uuid=True), ForeignKey("user.id"))
    invited_at = Column(DateTime(timezone=True))
    accepted_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    vendor = relationship("Vendor", back_populates="users")
    user = relationship("User", foreign_keys=[user_id], backref="vendor_memberships")
    custom_role = relationship("VendorRole", back_populates="users", foreign_keys=[role_id])
    store = relationship("Store", foreign_keys=[store_id], back_populates="staff")

    __table_args__ = (
        Index("idx_vendor_user_vendor", "vendor_id"),
        Index("idx_vendor_user_user", "user_id"),
        Index("idx_vendor_user_role", "vendor_id", "role"),
    )
