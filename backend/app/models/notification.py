from sqlalchemy import (
    Column, String, Text, DateTime, ForeignKey, Boolean, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Notification(Base):
    __tablename__ = "notification"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id"), index=True)

    title = Column(String(255), nullable=False)
    message = Column(Text)
    type = Column(String(50), default="info")
    # info, order, payment, inventory, review, system

    channel = Column(String(20), default="in_app")
    # in_app, email, sms, push

    reference_type = Column(String(50))
    reference_id = Column(UUID(as_uuid=True))

    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime(timezone=True))

    data = Column(JSONB, default={})

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_notification_user_read", "user_id", "is_read"),
        Index("ix_notification_customer_read", "customer_id", "is_read"),
        Index("ix_notification_vendor_created", "vendor_id", "created_at"),
    )
