# app/models/vendor_platform_audit.py
import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.database import Base


class VendorPlatformAuditLog(Base):
    """Platform support actions scoped to a vendor tenant (e.g. dashboard handoff)."""

    __tablename__ = "vendor_platform_audit_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("vendor.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("user.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action = Column(String(64), nullable=False)
    detail = Column(JSONB, nullable=True)
    ip = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_vendor_platform_audit_vendor_created", "vendor_id", "created_at"),
    )
