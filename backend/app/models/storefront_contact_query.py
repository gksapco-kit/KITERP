"""Customer contact-us queries from the storefront Contact page."""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.database import Base


class StorefrontContactQuery(Base):
    __tablename__ = "storefront_contact_query"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Null = inquiry from the platform landing Contact page (admin Settings contact).
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(40), nullable=True)
    message = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="new")  # new | read | resolved
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Lead conversion tracking
    converted_lead_id = Column(UUID(as_uuid=True), ForeignKey("crm_lead.id", ondelete="SET NULL"), nullable=True, index=True)
    converted_at = Column(DateTime(timezone=True), nullable=True)

    # Ticket conversion tracking
    converted_ticket_id = Column(UUID(as_uuid=True), ForeignKey("crm_ticket.id", ondelete="SET NULL"), nullable=True, index=True)
    ticket_converted_at = Column(DateTime(timezone=True), nullable=True)

    # Reply tracking (logged to crm_communication_log; these are counters for quick display)
    reply_count = Column(Integer, nullable=False, default=0)
    last_reply_at = Column(DateTime(timezone=True), nullable=True)
