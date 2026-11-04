"""Real Estate — Phase 2 models.

Module 6 (payment schedule, demands, receipts), 13/14 (TDS 194-IA, statutory filings, RERA account)
and 16 (commission rules, commissions, incentives, settlements).
"""
from __future__ import annotations

from sqlalchemy import Boolean, Column, Date, DateTime, Integer, Text, UniqueConstraint

from .base import REMixin, Base, UUID, choice, fk, money, pct, txt
from .core import PAYMENT_MODES, TRIGGER_TYPES

SCHEDULE_STATUSES = ["scheduled", "due", "demanded", "partial", "paid", "cancelled"]
DEMAND_STATUSES = ["issued", "partial", "paid", "cancelled"]
RECEIPT_STATUSES = ["received", "cleared", "bounced", "cancelled"]
TDS_STATUSES = ["pending_deposit", "deposited", "certificate_received"]
FILING_TYPES = [
    "gstr1", "gstr3b", "gstr9", "tds_26qb", "tds_24q", "tds_26q", "rera_quarterly", "rera_annual",
    "income_tax", "pf_esi", "other",
]
FILING_STATUSES = ["pending", "filed", "late", "not_applicable"]
RERA_ENTRY_KINDS = ["deposit", "withdrawal"]
RERA_ENTRY_STATUSES = ["requested", "approved", "rejected"]
COMMISSION_BASIS = ["percent_of_agreement", "percent_of_basic", "fixed_per_unit"]
PAYOUT_TRIGGERS = ["on_booking", "on_percent_collected", "on_agreement"]
COMMISSION_KINDS = ["commission", "clawback"]
COMMISSION_STATUSES = ["accrued", "eligible", "settled", "reversed"]
INCENTIVE_STATUSES = ["proposed", "approved", "paid", "rejected"]
SETTLEMENT_STATUSES = ["draft", "pending_approval", "approved", "paid", "cancelled"]


# ═══ Module 6 — Payment & Collections ═════════════════════════════════════════════════════

class ReScheduleItem(REMixin, Base):
    """One instalment of a booking's payment schedule (generated from the payment plan)."""

    __tablename__ = "re_payment_schedule"

    booking_id = fk("re_booking", nullable=False, ondelete="CASCADE")
    seq = Column(Integer, nullable=False, default=1)
    name = txt(160, nullable=False)
    percent = pct(0)
    trigger_type = choice(TRIGGER_TYPES, "on_booking", 30)
    trigger_days = Column(Integer, default=0)
    milestone_name = txt(160)
    due_date = Column(Date)
    amount = money()
    gst_amount = money()
    total_due = money()
    paid_amount = money()
    status = choice(SCHEDULE_STATUSES, "scheduled", 20)
    demand_id = Column(UUID(as_uuid=True))  # plain column: re_demand already references this table
    triggered_on = Column(Date)


class ReDemand(REMixin, Base):
    __tablename__ = "re_demand"
    __table_args__ = (UniqueConstraint("vendor_id", "demand_no", name="uq_re_demand_no"),)

    demand_no = txt(30, nullable=False)
    booking_id = fk("re_booking", nullable=False, ondelete="CASCADE")
    customer_id = fk("re_customer")
    schedule_item_id = fk("re_payment_schedule", ondelete="SET NULL")
    stage_name = txt(160)
    demand_date = Column(Date, nullable=False)
    due_date = Column(Date)
    amount = money()
    gst_amount = money()
    total_amount = money()
    paid_amount = money()
    status = choice(DEMAND_STATUSES, "issued", 20)
    letter_html = Column(Text)
    issued_at = Column(DateTime(timezone=True))
    gl_entry_id = Column(UUID(as_uuid=True))
    remarks = txt(500)


class ReReceipt(REMixin, Base):
    __tablename__ = "re_receipt"
    __table_args__ = (UniqueConstraint("vendor_id", "receipt_no", name="uq_re_receipt_no"),)

    receipt_no = txt(30, nullable=False)
    booking_id = fk("re_booking", nullable=False, ondelete="CASCADE")
    customer_id = fk("re_customer")
    receipt_date = Column(Date, nullable=False)
    amount = money(nullable=False)  # cash / instrument value actually received
    tds_amount = money()  # TDS u/s 194-IA deducted by the buyer (credited to the booking too)
    gross_amount = money()  # amount + tds_amount — what reduces the buyer's dues
    mode = choice(PAYMENT_MODES, "neft", 20)
    reference_no = txt(80)
    bank_name = txt(120)
    instrument_date = Column(Date)
    status = choice(RECEIPT_STATUSES, "received", 20)
    cleared_on = Column(Date)
    allocated_amount = money()
    gl_entry_id = Column(UUID(as_uuid=True))
    remarks = txt(500)


class ReReceiptAllocation(REMixin, Base):
    __tablename__ = "re_receipt_allocation"

    receipt_id = fk("re_receipt", nullable=False, ondelete="CASCADE")
    demand_id = fk("re_demand", nullable=False, ondelete="CASCADE")
    schedule_item_id = fk("re_payment_schedule", ondelete="SET NULL")
    amount = money(nullable=False)
    allocated_on = Column(Date)


# ═══ Module 14 — Tax & Compliance ═════════════════════════════════════════════════════════

class ReTdsEntry(REMixin, Base):
    """TDS u/s 194-IA deducted by the buyer on a payment (Form 26QB / Form 16B tracking)."""

    __tablename__ = "re_tds_entry"

    booking_id = fk("re_booking", nullable=False, ondelete="CASCADE")
    customer_id = fk("re_customer")
    receipt_id = fk("re_receipt", ondelete="SET NULL")
    buyer_pan = txt(10)
    consideration = money()
    tds_percent = pct(1)
    tds_amount = money()
    deducted_on = Column(Date)
    status = choice(TDS_STATUSES, "pending_deposit", 30)
    challan_no = txt(40)
    challan_date = Column(Date)
    ack_no_26qb = txt(40)
    certificate_no = txt(40)
    certificate_date = Column(Date)
    remarks = txt(500)


class ReTaxFiling(REMixin, Base):
    __tablename__ = "re_tax_filing"

    filing_type = choice(FILING_TYPES, "gstr3b", 30)
    period = txt(30, nullable=False)  # e.g. 2026-04 or Q1 FY26-27
    project_id = fk("re_project")
    due_date = Column(Date)
    filed_on = Column(Date)
    status = choice(FILING_STATUSES, "pending", 20)
    ack_no = txt(60)
    tax_amount = money()
    interest_penalty = money()
    notes = txt(500)


class ReReraEntry(REMixin, Base):
    """RERA designated-account ledger: 70% deposits and certified withdrawals (RERA s.4(2)(l)(D))."""

    __tablename__ = "re_rera_entry"

    project_id = fk("re_project", nullable=False, ondelete="CASCADE")
    kind = choice(RERA_ENTRY_KINDS, "deposit", 20)
    entry_date = Column(Date, nullable=False)
    amount = money(nullable=False)
    status = choice(RERA_ENTRY_STATUSES, "approved", 20)
    bank_name = txt(120)
    reference_no = txt(80)
    certified_completion_percent = pct(0)
    certified_by = txt(160)
    certificate_ref = txt(120)
    remarks = txt(500)


# ═══ Module 16 — Broker management ════════════════════════════════════════════════════════

class ReCommissionRule(REMixin, Base):
    __tablename__ = "re_commission_rule"

    name = txt(160, nullable=False)
    broker_id = fk("re_broker")  # empty = applies to every broker
    project_id = fk("re_project")  # empty = applies to every project
    basis = choice(COMMISSION_BASIS, "percent_of_agreement", 30)
    rate = pct(2)
    fixed_amount = money()
    slab_min = money()  # agreement value >= slab_min
    slab_max = money()  # agreement value < slab_max (0 = unlimited)
    payout_trigger = choice(PAYOUT_TRIGGERS, "on_percent_collected", 30)
    trigger_percent = pct(20)
    gst_percent = pct(18)  # charged only when the broker has a GSTIN
    effective_from = Column(Date)
    effective_to = Column(Date)
    is_active = Column(Boolean, nullable=False, default=True)


class ReCommission(REMixin, Base):
    __tablename__ = "re_commission"

    booking_id = fk("re_booking", nullable=False, ondelete="CASCADE")
    broker_id = fk("re_broker", nullable=False, ondelete="CASCADE")
    rule_id = fk("re_commission_rule")
    kind = choice(COMMISSION_KINDS, "commission", 20)
    basis_amount = money()
    rate = pct(0)
    gross_amount = money()
    gst_amount = money()
    tds_percent = pct(0)
    tds_amount = money()
    net_amount = money()
    status = choice(COMMISSION_STATUSES, "accrued", 20)
    accrued_on = Column(Date)
    eligible_on = Column(Date)
    settlement_id = fk("re_settlement", ondelete="SET NULL")
    gl_entry_id = Column(UUID(as_uuid=True))
    remarks = txt(500)


class ReIncentive(REMixin, Base):
    __tablename__ = "re_incentive"

    broker_id = fk("re_broker", nullable=False, ondelete="CASCADE")
    scheme_name = txt(160, nullable=False)
    period_from = Column(Date)
    period_to = Column(Date)
    target_value = money()
    achieved_value = money()
    amount = money(nullable=False)
    tds_amount = money()
    status = choice(INCENTIVE_STATUSES, "proposed", 20)
    settlement_id = fk("re_settlement", ondelete="SET NULL")
    remarks = txt(500)


class ReSettlement(REMixin, Base):
    __tablename__ = "re_settlement"
    __table_args__ = (UniqueConstraint("vendor_id", "settlement_no", name="uq_re_settlement_no"),)

    settlement_no = txt(30, nullable=False)
    broker_id = fk("re_broker", nullable=False, ondelete="CASCADE")
    settlement_date = Column(Date, nullable=False)
    gross_amount = money()
    gst_amount = money()
    tds_amount = money()
    clawback_amount = money()
    net_amount = money()
    mode = choice(PAYMENT_MODES, "neft", 20)
    reference_no = txt(80)
    paid_on = Column(Date)
    status = choice(SETTLEMENT_STATUSES, "draft", 30)
    approval_request_id = Column(UUID(as_uuid=True))
    gl_entry_id = Column(UUID(as_uuid=True))
    remarks = txt(500)
