from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from app.database import Base


class InvoiceTemplate(Base):
    __tablename__ = "invoice_template"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    is_default = Column(Boolean, default=False)

    sections = Column(JSONB, default={
        "show_logo": True,
        "show_header": True,
        "show_customer_details": True,
        "show_customer_gstin": True,
        "show_shipping_address": True,
        "show_bank_details": True,
        "show_signature": True,
        "show_tax_breakdown": True,
        "show_notes": True,
        "show_terms": True,
    })

    bank_details = Column(JSONB, default={})
    signature_url = Column(Text)
    header_text = Column(Text)
    footer_text = Column(Text)
    terms_text = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
