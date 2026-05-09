from sqlalchemy import (
    Column, String, Text, DateTime, ForeignKey, Boolean,
    Numeric, Integer, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from app.database import Base


class LoyaltyProgram(Base):
    """Vendor-level loyalty program configuration."""
    __tablename__ = "loyalty_program"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id"), nullable=False, unique=True, index=True)

    is_active = Column(Boolean, default=False)
    name = Column(String(255), default="Loyalty Rewards")

    points_per_currency = Column(Numeric(10, 2), default=1)
    currency_per_point = Column(Numeric(10, 4), default=1)
    min_redeem_points = Column(Integer, default=100)
    max_redeem_percent = Column(Integer, default=50)

    signup_bonus = Column(Integer, default=0)

    tier_config = Column(JSONB, default=[])

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class LoyaltyAccount(Base):
    """Per-customer loyalty points balance."""
    __tablename__ = "loyalty_account"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id"), nullable=False, index=True)

    points_balance = Column(Integer, default=0)
    lifetime_earned = Column(Integer, default=0)
    lifetime_redeemed = Column(Integer, default=0)
    tier = Column(String(50), default="standard")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("uq_loyalty_vendor_customer", "vendor_id", "customer_id", unique=True),
    )


class LoyaltyTransaction(Base):
    """Individual points earn / redeem / adjust records."""
    __tablename__ = "loyalty_transaction"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id"), nullable=False, index=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("loyalty_account.id"), nullable=False)

    type = Column(String(20), nullable=False)  # earn, redeem, adjust, signup, expire
    points = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)
    description = Column(Text)

    reference_type = Column(String(30))  # pos_transaction, order, manual
    reference_id = Column(UUID(as_uuid=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_loyalty_txn_customer", "customer_id", "created_at"),
        Index("ix_loyalty_txn_vendor", "vendor_id", "created_at"),
    )
