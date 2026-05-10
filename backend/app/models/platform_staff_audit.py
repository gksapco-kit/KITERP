# app/models/platform_staff_audit.py
import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.database import Base


class PlatformStaffAuditLog(Base):
    """Timeline of platform-admin events associated with a support user (or superuser using platform login)."""

    __tablename__ = "platform_staff_audit_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subject_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("user.id", ondelete="CASCADE"),
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
    user_agent = Column(String(500), nullable=True)
    request_path = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_platform_staff_audit_subject_created", "subject_user_id", "created_at"),
    )
