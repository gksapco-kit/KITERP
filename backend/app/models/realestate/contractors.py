"""Real Estate — Phase 4 models, part 3: contractor management (module 12)."""
from __future__ import annotations

from sqlalchemy import Boolean, Column, Date, Integer, Text, UniqueConstraint

from .base import REMixin, Base, UUID, choice, fk, money, pct, txt
from .core import PAYMENT_MODES
from .projects import COST_HEADS

CONTRACTOR_TYPES = ["individual", "huf", "firm", "company"]
CONTRACTOR_STATUSES = ["active", "pending", "blocked"]
SUBCONTRACT_STATUSES = ["draft", "active", "completed", "terminated"]
CERT_STATUSES = ["draft", "pending_approval", "approved", "paid", "rejected", "cancelled"]
RETENTION_KINDS = ["held", "released"]


class ReContractor(REMixin, Base):
    __tablename__ = "re_contractor"

    code = txt(30, index=True)
    name = txt(255, nullable=False)
    contractor_type = choice(CONTRACTOR_TYPES, "firm", 15)
    trade = txt(120)
    status = choice(CONTRACTOR_STATUSES, "active", 15)
    contact_person = txt(160)
    phone = txt(30)
    email = txt(255)
    address = txt(500)
    gstin = txt(15)
    pan = txt(10)
    tds_percent = pct(2)  # s.194C: 1% individual / HUF, 2% others
    bank_name = txt(120)
    account_number = txt(40)
    ifsc = txt(15)
    rating = Column(Integer)
    notes = Column(Text)


class ReSubcontract(REMixin, Base):
    __tablename__ = "re_subcontract"
    __table_args__ = (UniqueConstraint("vendor_id", "sc_no", name="uq_re_subcontract_no"),)

    sc_no = txt(30, nullable=False)
    project_id = fk("re_project", nullable=False, ondelete="CASCADE")
    contractor_id = fk("re_contractor", nullable=False, ondelete="RESTRICT")
    wbs_task_id = fk("re_wbs_task")
    title = txt(255, nullable=False)
    scope = Column(Text)
    cost_head = choice(COST_HEADS, "construction", 30)
    contract_value = money(0, nullable=False)
    variation_amount = money(0)
    retention_percent = pct(5)
    tds_percent = pct(2)
    gst_percent = pct(18)
    advance_amount = money(0)
    advance_recovered = money(0)
    start_date = Column(Date)
    end_date = Column(Date)
    defect_liability_months = Column(Integer, nullable=False, default=12)
    status = choice(SUBCONTRACT_STATUSES, "draft", 15)
    billed_amount = money(0)  # cumulative work certified (approved / paid)
    terms = Column(Text)


class ReWorkCertificate(REMixin, Base):
    """Running-account (RA) bill certified against a subcontract."""

    __tablename__ = "re_work_certificate"
    __table_args__ = (UniqueConstraint("vendor_id", "cert_no", name="uq_re_work_cert_no"),)

    cert_no = txt(30, nullable=False)
    subcontract_id = fk("re_subcontract", nullable=False, ondelete="RESTRICT")
    project_id = fk("re_project")
    contractor_id = fk("re_contractor")
    bill_seq = Column(Integer, nullable=False, default=1)
    bill_date = Column(Date, nullable=False)
    period_to = Column(Date)
    is_final = Column(Boolean, nullable=False, default=False)
    cumulative_work_done = money(0, nullable=False)  # value of work done to date, ex-GST
    previous_cumulative = money(0)
    gross_amount = money(0)  # this bill = cumulative - previous
    retention_amount = money(0)
    advance_recovery = money(0)
    other_deductions = money(0)
    gst_amount = money(0)
    tds_amount = money(0)
    net_payable = money(0)
    status = choice(CERT_STATUSES, "draft", 20)
    approval_request_id = Column(UUID(as_uuid=True), nullable=True)
    approved_on = Column(Date)
    paid_on = Column(Date)
    payment_mode = choice(PAYMENT_MODES, "neft", 20, index=False)
    payment_reference = txt(80)
    gl_entry_id = Column(UUID(as_uuid=True), nullable=True)
    remarks = Column(Text)


class ReRetentionEntry(REMixin, Base):
    __tablename__ = "re_retention_entry"

    subcontract_id = fk("re_subcontract", nullable=False, ondelete="CASCADE")
    contractor_id = fk("re_contractor")
    certificate_id = fk("re_work_certificate")
    kind = choice(RETENTION_KINDS, "held", 15)
    amount = money(0, nullable=False)
    entry_date = Column(Date, nullable=False)
    remarks = txt(500)
