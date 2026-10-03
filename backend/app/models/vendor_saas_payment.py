"""Platform SaaS subscription payments (vendor pays KIT ERP via Razorpay)."""
from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.database import Base


class VendorSaasPayment(Base):
    __tablename__ = "vendor_saas_payment"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("vendor_plan.id", ondelete="SET NULL"), nullable=True)
    plan_name = Column(String(100), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="INR")
    razorpay_order_id = Column(String(100))
    razorpay_payment_id = Column(String(100))
    status = Column(String(20), nullable=False, default="paid")
    period_start = Column(DateTime(timezone=True))
    period_end = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
