# app/models/commission.py
"""
Sales Commission Module Models
Covers: Payees, Plans, Rules, Assignments, Accruals, Payout Runs, Payout Items, Approval Log
"""
import uuid
from sqlalchemy import (
    Column, String, Text, DateTime, ForeignKey, Boolean,
    Numeric, Integer, Date, UniqueConstraint, Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class CommissionPayee(Base):
    """Unified commission earner — links to VendorUser, Supplier, or Customer."""
    __tablename__ = "commission_payee"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)

    code = Column(String(30), nullable=True)          # human-readable short code
    display_name = Column(String(200), nullable=False)
    phone = Column(String(30), nullable=True)
    email = Column(String(255), nullable=True)
    external_user_id = Column(String(100), nullable=True)  # partner/agent user ID from external system

    # link_type: vendor_user | supplier | customer | external
    link_type = Column(String(30), nullable=False, default="external")
    vendor_user_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier.id", ondelete="SET NULL"), nullable=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id", ondelete="SET NULL"), nullable=True)

    default_payout_method = Column(String(30), default="bank_transfer")  # bank_transfer, cash, upi, wallet, cheque
    # bank_source: 'master' = use bank from linked staff/supplier/customer, 'custom' = fields below
    bank_source = Column(String(10), default="master")
    bank_name = Column(String(100), nullable=True)
    account_number = Column(String(30), nullable=True)
    account_holder_name = Column(String(255), nullable=True)
    ifsc_code = Column(String(15), nullable=True)
    upi_id = Column(String(100), nullable=True)
    wallet_provider = Column(String(50), nullable=True)
    wallet_id = Column(String(100), nullable=True)
    currency = Column(String(3), default="INR")
    status = Column(String(20), default="active")    # active, inactive, suspended

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    assignments = relationship("CommissionAssignment", back_populates="payee", cascade="all, delete-orphan")
    accruals = relationship("CommissionAccrual", back_populates="payee")
    payout_items = relationship("CommissionPayoutItem", back_populates="payee")

    __table_args__ = (
        Index("idx_comm_payee_vendor_phone", "vendor_id", "phone"),
        Index("idx_comm_payee_vendor_ext_id", "vendor_id", "external_user_id"),
        Index("idx_comm_payee_vendor_code", "vendor_id", "code"),
    )


class CommissionPlan(Base):
    """A named commission plan belonging to a vendor."""
    __tablename__ = "commission_plan"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(30), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), default="active")   # active, inactive, draft
    effective_from = Column(Date, nullable=True)
    effective_to = Column(Date, nullable=True)
    # payee_scope: any | employee | vendor | contractor | agent | customer
    payee_scope = Column(String(30), default="any")
    priority = Column(Integer, default=10)           # lower = higher priority
    stackable = Column(Boolean, default=False)       # can multiple plans fire on same sale?
    settings = Column(JSONB, default={})

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    rules = relationship("CommissionRule", back_populates="plan", cascade="all, delete-orphan", order_by="CommissionRule.priority")
    assignments = relationship("CommissionAssignment", back_populates="plan", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("vendor_id", "code", name="uq_comm_plan_vendor_code"),
        Index("idx_comm_plan_vendor_status", "vendor_id", "status"),
    )


class CommissionRule(Base):
    """One rule within a plan. Evaluated in priority order; first match wins (unless plan.stackable)."""
    __tablename__ = "commission_rule"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("commission_plan.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=True)
    priority = Column(Integer, default=10)
    is_active = Column(Boolean, default=True)

    # ── Match conditions ──────────────────────────────────────────
    applies_to = Column(String(20), default="all")   # all | product | service | category
    product_id = Column(UUID(as_uuid=True), nullable=True)
    service_id = Column(UUID(as_uuid=True), nullable=True)
    category_id = Column(UUID(as_uuid=True), nullable=True)
    uom = Column(String(30), nullable=True)
    store_id = Column(UUID(as_uuid=True), nullable=True)
    customer_group = Column(String(100), nullable=True)
    channel = Column(String(20), default="any")       # any | online | pos | booking
    event_tag = Column(String(100), nullable=True)
    team_id = Column(UUID(as_uuid=True), nullable=True)
    min_qty = Column(Numeric(12, 4), nullable=True)
    min_amount = Column(Numeric(12, 2), nullable=True)

    # ── Aggregation window ────────────────────────────────────────
    # per_line | per_sale | per_period
    window_type = Column(String(20), default="per_line")
    # day | week | month | quarter | year (applies when window_type=per_period)
    period = Column(String(20), nullable=True)
    revenue_threshold = Column(Numeric(12, 2), nullable=True)  # trigger tier at this revenue
    count_threshold = Column(Integer, nullable=True)             # trigger tier at this count

    # ── Outcome ───────────────────────────────────────────────────
    # percentage | flat | points | tiered | time_based | revenue_based | count_based | equity
    calculation_type = Column(String(30), nullable=False, default="percentage")
    value_numeric = Column(Numeric(12, 4), nullable=True)        # e.g. 5.0 for 5%
    value_currency = Column(Numeric(12, 2), nullable=True)       # flat amount
    points_per_unit = Column(Numeric(12, 4), nullable=True)      # for points type
    equity_units = Column(Numeric(18, 6), nullable=True)         # for equity type
    tier_table = Column(JSONB, nullable=True)  # [{from, to, rate, flat}, ...]
    time_rate = Column(JSONB, nullable=True)   # {rate_per_hour, uom, ...}

    cap_amount = Column(Numeric(12, 2), nullable=True)
    floor_amount = Column(Numeric(12, 2), nullable=True)
    payee_share_percent = Column(Numeric(5, 2), nullable=True)  # for split rules

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    plan = relationship("CommissionPlan", back_populates="rules")


class CommissionAssignment(Base):
    """Links a payee to a plan, scoped by store / team / period / weight."""
    __tablename__ = "commission_assignment"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("commission_plan.id", ondelete="CASCADE"), nullable=False, index=True)
    payee_id = Column(UUID(as_uuid=True), ForeignKey("commission_payee.id", ondelete="CASCADE"), nullable=False, index=True)

    store_id = Column(UUID(as_uuid=True), nullable=True)
    team_id = Column(UUID(as_uuid=True), nullable=True)
    location = Column(String(200), nullable=True)
    group_name = Column(String(100), nullable=True)

    valid_from = Column(Date, nullable=True)
    valid_to = Column(Date, nullable=True)
    weight_percent = Column(Numeric(5, 2), default=100)   # for revenue-split among payees

    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    plan = relationship("CommissionPlan", back_populates="assignments")
    payee = relationship("CommissionPayee", back_populates="assignments")

    __table_args__ = (
        Index("idx_comm_assign_vendor_payee", "vendor_id", "payee_id"),
        Index("idx_comm_assign_vendor_plan", "vendor_id", "plan_id"),
    )


class CommissionAccrual(Base):
    """One earned commission record per sale-line x payee x rule."""
    __tablename__ = "commission_accrual"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    payee_id = Column(UUID(as_uuid=True), ForeignKey("commission_payee.id", ondelete="RESTRICT"), nullable=False, index=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("commission_plan.id", ondelete="SET NULL"), nullable=True)
    rule_id = Column(UUID(as_uuid=True), ForeignKey("commission_rule.id", ondelete="SET NULL"), nullable=True)
    assignment_id = Column(UUID(as_uuid=True), ForeignKey("commission_assignment.id", ondelete="SET NULL"), nullable=True)

    # Source sale
    source_type = Column(String(20), nullable=False)   # order | pos | booking
    source_id = Column(UUID(as_uuid=True), nullable=False)
    source_line_ref = Column(String(100), nullable=True)  # e.g. "item_0" within the JSONB array
    sale_date = Column(Date, nullable=False)
    store_id = Column(UUID(as_uuid=True), nullable=True)
    channel = Column(String(20), nullable=True)          # online | pos | booking

    # Amounts
    base_amount = Column(Numeric(12, 2), nullable=False, default=0)
    calculation_type = Column(String(30), nullable=False)
    value_applied = Column(Numeric(12, 4), nullable=True)   # actual % or flat used
    commission_amount = Column(Numeric(12, 2), nullable=False, default=0)
    points_amount = Column(Numeric(12, 4), default=0)
    equity_units_amount = Column(Numeric(18, 6), default=0)
    currency = Column(String(3), default="INR")

    # State: draft | accrued | approved | paid | reversed | disputed
    status = Column(String(20), nullable=False, default="accrued", index=True)
    payout_item_id = Column(UUID(as_uuid=True), ForeignKey("commission_payout_item.id", ondelete="SET NULL"), nullable=True)
    gl_entry_id = Column(UUID(as_uuid=True), nullable=True)
    reversal_of = Column(UUID(as_uuid=True), ForeignKey("commission_accrual.id", ondelete="SET NULL"), nullable=True)

    # Audit
    created_by_id = Column(UUID(as_uuid=True), nullable=True)
    approved_by_id = Column(UUID(as_uuid=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    payee = relationship("CommissionPayee", back_populates="accruals")
    payout_item = relationship("CommissionPayoutItem", back_populates="accruals")

    __table_args__ = (
        # Idempotency key
        UniqueConstraint(
            "vendor_id", "source_type", "source_id", "source_line_ref", "payee_id", "rule_id",
            name="uq_comm_accrual_idempotent",
        ),
        Index("idx_comm_accrual_vendor_status", "vendor_id", "status"),
        Index("idx_comm_accrual_source", "source_type", "source_id"),
        Index("idx_comm_accrual_sale_date", "vendor_id", "sale_date"),
    )


class CommissionPayoutRun(Base):
    """A batch payout run grouping accruals for payment."""
    __tablename__ = "commission_payout_run"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    run_no = Column(String(30), nullable=False)
    period_start = Column(Date, nullable=True)
    period_end = Column(Date, nullable=True)

    # open | approved | paid | cancelled
    status = Column(String(20), nullable=False, default="open")
    total_amount = Column(Numeric(12, 2), default=0)
    total_points = Column(Numeric(12, 4), default=0)
    payee_count = Column(Integer, default=0)
    payment_method = Column(String(30), nullable=True)  # bank_transfer, cash, etc.
    gl_entry_id = Column(UUID(as_uuid=True), nullable=True)
    notes = Column(Text, nullable=True)

    created_by_id = Column(UUID(as_uuid=True), nullable=True)
    approved_by_id = Column(UUID(as_uuid=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    items = relationship("CommissionPayoutItem", back_populates="run", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("vendor_id", "run_no", name="uq_comm_payout_run_no"),
        Index("idx_comm_payout_run_vendor_status", "vendor_id", "status"),
    )


class CommissionPayoutItem(Base):
    """One payee's total within a payout run."""
    __tablename__ = "commission_payout_item"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("commission_payout_run.id", ondelete="CASCADE"), nullable=False, index=True)
    payee_id = Column(UUID(as_uuid=True), ForeignKey("commission_payee.id", ondelete="RESTRICT"), nullable=False, index=True)

    total_amount = Column(Numeric(12, 2), default=0)
    total_points = Column(Numeric(12, 4), default=0)
    total_equity = Column(Numeric(18, 6), default=0)
    accrual_count = Column(Integer, default=0)

    status = Column(String(20), default="pending")   # pending | paid | failed
    payment_ref = Column(String(200), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    run = relationship("CommissionPayoutRun", back_populates="items")
    payee = relationship("CommissionPayee", back_populates="payout_items")
    accruals = relationship("CommissionAccrual", back_populates="payout_item")


class CommissionApprovalLog(Base):
    """Lightweight audit trail for commission approvals and state transitions."""
    __tablename__ = "commission_approval_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False)   # accrual | payout_run | payout_item
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    action = Column(String(50), nullable=False)         # approved | reversed | paid | cancelled | disputed
    actor_id = Column(UUID(as_uuid=True), nullable=True)
    notes = Column(Text, nullable=True)
    ts = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_comm_approval_log_entity", "entity_type", "entity_id"),
    )
