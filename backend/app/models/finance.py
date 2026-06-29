# app/models/finance.py
"""
Finance Module Models
Covers: Chart of Accounts, General Ledger, AR/AP, Bank/Cash,
Budgets/Forecasts, Fixed Assets, Tax, Capital, Controls/Audit
"""
import uuid
from sqlalchemy import (
    Column, String, Text, DateTime, ForeignKey, Boolean,
    Numeric, Integer, Date, UniqueConstraint, Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func, false
from app.database import Base


# ─────────────────────────────────────────────────────────────────────────────
# MULTI-COMPANY DIMENSIONS
# ─────────────────────────────────────────────────────────────────────────────

class FinCompany(Base):
    """A posting entity (legal entity / branch) within a vendor tenant."""
    __tablename__ = "fin_company"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(20), nullable=False)          # e.g. "1000", "HQ"
    name = Column(String(200), nullable=False)
    currency = Column(String(3), default="INR")
    country = Column(String(3), default="IN")          # ISO 3166-1 alpha-2
    tax_id = Column(String(50))                        # GSTIN / TRN etc.
    address = Column(JSONB, default={})
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    cost_centers = relationship("FinCostCenter", back_populates="company", cascade="all, delete-orphan")
    projects = relationship("FinProject", back_populates="company", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("vendor_id", "code", name="uq_fin_company_vendor_code"),
    )

    fiscal_year_assignments = relationship(
        "FinFiscalYearCompany", back_populates="company", cascade="all, delete-orphan"
    )


class FinFiscalYearCompany(Base):
    """
    Many-to-many: one vendor-level fiscal year / variant (shared calendar) can be
    posted against multiple business units; `is_current` is per business unit.
    """
    __tablename__ = "fin_fiscal_year_company"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    fiscal_year_id = Column(
        UUID(as_uuid=True), ForeignKey("fin_fiscal_year.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_id = Column(
        UUID(as_uuid=True), ForeignKey("fin_company.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    is_current = Column(Boolean, default=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    fiscal_year = relationship("FinFiscalYear", back_populates="assignments")
    company = relationship("FinCompany", back_populates="fiscal_year_assignments")

    __table_args__ = (
        UniqueConstraint("fiscal_year_id", "company_id", name="uq_fin_fy_co_fy_company"),
        Index("ix_fin_fy_co_vendor_company", "vendor_id", "company_id"),
    )


class FinCostCenter(Base):
    """Cost centre / profit centre dimension for GL postings."""
    __tablename__ = "fin_cost_center"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("fin_company.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(20), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    cc_group = Column(String(100), nullable=True)   # e.g. "Operations", "Sales", "Admin"
    parent_id = Column(UUID(as_uuid=True), ForeignKey("fin_cost_center.id", ondelete="SET NULL"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    company = relationship("FinCompany", back_populates="cost_centers")
    children = relationship("FinCostCenter", back_populates="parent", foreign_keys=[parent_id])
    parent = relationship("FinCostCenter", back_populates="children", foreign_keys=[parent_id], remote_side=[id])

    __table_args__ = (
        UniqueConstraint("vendor_id", "company_id", "code", name="uq_fin_cc_vendor_company_code"),
        Index("idx_fin_cc_group", "vendor_id", "cc_group"),
    )


class FinProject(Base):
    """Project / WBS dimension for GL postings."""
    __tablename__ = "fin_project"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("fin_company.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(30), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    start_date = Column(Date)
    end_date = Column(Date)
    budget = Column(Numeric(18, 4), default=0)
    status = Column(String(20), default="active")      # active / completed / on_hold / cancelled
    manager_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("FinCompany", back_populates="projects")

    __table_args__ = (
        UniqueConstraint("vendor_id", "company_id", "code", name="uq_fin_project_vendor_company_code"),
    )


class FinIntercompanyPartner(Base):
    """Defines an intercompany relationship between two FinCompany entities."""
    __tablename__ = "fin_intercompany_partner"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("fin_company.id", ondelete="CASCADE"), nullable=False, index=True)
    partner_company_id = Column(UUID(as_uuid=True), ForeignKey("fin_company.id", ondelete="CASCADE"), nullable=False, index=True)
    default_ar_account_id = Column(UUID(as_uuid=True), ForeignKey("fin_account.id", ondelete="SET NULL"))
    default_ap_account_id = Column(UUID(as_uuid=True), ForeignKey("fin_account.id", ondelete="SET NULL"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("vendor_id", "company_id", "partner_company_id", name="uq_fin_ic_company_pair"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# FOUNDATION
# ─────────────────────────────────────────────────────────────────────────────

class FinAccount(Base):
    """Chart of Accounts node (self-referential hierarchy)."""
    __tablename__ = "fin_account"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("fin_account.id", ondelete="SET NULL"))
    code = Column(String(20), nullable=False)
    name = Column(String(200), nullable=False)
    # Asset / Liability / Equity / Income / Expense
    account_type = Column(String(30), nullable=False)
    # Current Asset / Fixed Asset / Current Liability / Long-term Liability /
    # Owner Equity / Operating Income / Other Income / COGS / Operating Expense / Tax Expense
    account_subtype = Column(String(50))
    currency = Column(String(3), default="INR")
    description = Column(Text)
    is_reconcilable = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True, server_default="true")
    is_system = Column(Boolean, default=False, server_default="false")
    # SAP reconciliation account: true = this GL account is a subledger control account.
    # Direct manual posting is blocked; only auto-posting handlers may write to it.
    is_reconciliation_account = Column(Boolean, default=False, server_default="false")
    # Which subledger owns this account: customer | supplier | asset | bank
    reconciliation_subledger = Column(String(30), nullable=True)
    cost_center_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"))
    # Link to a Field Status Group that governs which line fields are required/optional
    field_status_group_id = Column(UUID(as_uuid=True), ForeignKey("fin_field_status_group.id", ondelete="SET NULL"), nullable=True)
    opening_balance = Column(Numeric(18, 4), default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Self-referential adjacency list
    children = relationship("FinAccount", back_populates="parent", foreign_keys=[parent_id])
    parent = relationship("FinAccount", back_populates="children", foreign_keys=[parent_id], remote_side=[id])
    journal_lines = relationship("FinJournalLine", back_populates="account")
    field_status_group = relationship("FinFieldStatusGroup", back_populates="accounts", foreign_keys=[field_status_group_id])

    __table_args__ = (
        UniqueConstraint("vendor_id", "code", name="uq_fin_account_vendor_code"),
    )


class FinFiscalYear(Base):
    __tablename__ = "fin_fiscal_year"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    # Short label, unique per vendor (e.g. 2026-27, US-GAAP) — one calendar; assign companies via fin_fiscal_year_company
    variant_code = Column(String(40), nullable=False)
    name = Column(String(50), nullable=False)         # "FY 2025-26"
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(String(20), default="open")       # open / closed / locked
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    assignments = relationship("FinFiscalYearCompany", back_populates="fiscal_year", cascade="all, delete-orphan")
    periods = relationship("FinPeriod", back_populates="fiscal_year", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("vendor_id", "variant_code", name="uq_fin_fy_vendor_variant"),
    )


class FinPeriod(Base):
    __tablename__ = "fin_period"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    fiscal_year_id = Column(UUID(as_uuid=True), ForeignKey("fin_fiscal_year.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(30), nullable=False)         # "Apr 2025" / "Audit 1"
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    period_number = Column(Integer)                  # 1-12 (standard) or 13+ (audit)
    period_kind = Column(String(20), default="standard", server_default="standard")  # standard | audit
    status = Column(String(20), default="open")      # open / closed / locked
    closed_at = Column(DateTime(timezone=True))
    closed_by_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"))

    fiscal_year = relationship("FinFiscalYear", back_populates="periods")


class FinFieldRule(Base):
    """
    Per-field display requirement for GL documents (e.g. journal entry).
    scope: gl = tenant default, company = business unit, user = team member.
    """
    __tablename__ = "fin_field_rule"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    scope = Column(String(20), nullable=False)  # gl | company | user
    company_id = Column(UUID(as_uuid=True), ForeignKey("fin_company.id", ondelete="CASCADE"), nullable=True)
    vendor_user_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="CASCADE"), nullable=True)
    entity_type = Column(String(50), nullable=False, index=True)  # e.g. journal_entry
    field_key = Column(String(120), nullable=False)  # e.g. header.reference
    requirement = Column(String(20), nullable=False)  # optional | mandatory | hidden
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        Index("idx_fin_field_rule_lookup", "vendor_id", "entity_type"),
    )


class FinExchangeRate(Base):
    __tablename__ = "fin_exchange_rate"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    from_currency = Column(String(3), nullable=False)
    to_currency = Column(String(3), nullable=False)
    rate = Column(Numeric(18, 8), nullable=False)
    effective_date = Column(Date, nullable=False)
    source = Column(String(30), default="manual")    # manual / rbi / openexchange
    # SAP-style rate type: 'M' (average) | 'B' (buying) | 'S' (selling) | 'P' (planning)
    rate_type = Column(String(2), default="M", server_default="M", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("vendor_id", "from_currency", "to_currency", "effective_date", "rate_type",
                         name="uq_fin_fx_rate"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# GENERAL LEDGER / JOURNAL
# ─────────────────────────────────────────────────────────────────────────────

class FinJournalEntry(Base):
    __tablename__ = "fin_journal_entry"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    # Multi-company: the posting entity (nullable for backcompat; set NOT NULL after migration backfill)
    company_id = Column(UUID(as_uuid=True), ForeignKey("fin_company.id", ondelete="SET NULL"), index=True)
    entry_no = Column(String(30), nullable=False)
    # Posting date = the date the transaction hits the ledger
    entry_date = Column(Date, nullable=False, index=True)
    # Document date = the invoice / receipt date (may differ from posting date)
    document_date = Column(Date)
    # Document type: SA=GL, DR=Debit memo, CR=Credit memo, AB=Accounting doc, ML=Material ledger
    document_type = Column(String(10), default="SA")
    period_id = Column(UUID(as_uuid=True), ForeignKey("fin_period.id", ondelete="SET NULL"))
    fiscal_year_id = Column(UUID(as_uuid=True), ForeignKey("fin_fiscal_year.id", ondelete="SET NULL"))
    # Source that triggered auto-posting
    source_type = Column(String(40))   # invoice/payment/pos/po/payroll/expense/asset/loan/manual/opening/fx
    source_id = Column(UUID(as_uuid=True), index=True)
    status = Column(String(20), default="draft", index=True)   # draft / posted / void / pending_approval
    narration = Column(Text)
    reference = Column(String(100))
    # Header-level text note (separate from line narration)
    header_text = Column(Text)
    currency = Column(String(3), default="INR")
    total_debit = Column(Numeric(18, 4), default=0)
    total_credit = Column(Numeric(18, 4), default=0)
    is_recurring = Column(Boolean, default=False)
    recurring_template_id = Column(UUID(as_uuid=True), ForeignKey("fin_recurring_template.id", ondelete="SET NULL"))
    reversed_by_id = Column(UUID(as_uuid=True), ForeignKey("fin_journal_entry.id", ondelete="SET NULL"))
    reverses_id = Column(UUID(as_uuid=True), ForeignKey("fin_journal_entry.id", ondelete="SET NULL"))
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"))
    posted_by_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"))
    posted_at = Column(DateTime(timezone=True))
    # Approval workflow
    requires_approval = Column(Boolean, default=False)
    approval_request_id = Column(UUID(as_uuid=True), ForeignKey("fin_approval_request.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    lines = relationship("FinJournalLine", back_populates="entry", cascade="all, delete-orphan")
    company = relationship("FinCompany", foreign_keys=[company_id])

    __table_args__ = (
        UniqueConstraint("vendor_id", "entry_no", name="uq_fin_je_vendor_entry_no"),
        Index("ix_fin_je_source", "source_type", "source_id", "vendor_id"),
    )


class FinJournalLine(Base):
    __tablename__ = "fin_journal_line"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    journal_entry_id = Column(UUID(as_uuid=True), ForeignKey("fin_journal_entry.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("fin_account.id", ondelete="RESTRICT"), nullable=False, index=True)
    store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"))
    # Optional party reference (customer / supplier)
    party_type = Column(String(20))   # customer / supplier
    party_id = Column(UUID(as_uuid=True))
    debit = Column(Numeric(18, 4), default=0)
    credit = Column(Numeric(18, 4), default=0)
    currency = Column(String(3), default="INR")
    fx_rate = Column(Numeric(18, 8), default=1)
    base_debit = Column(Numeric(18, 4), default=0)
    base_credit = Column(Numeric(18, 4), default=0)
    narration = Column(Text)
    sequence = Column(Integer, default=0)
    # GL Dimensions
    cost_center_id = Column(UUID(as_uuid=True), ForeignKey("fin_cost_center.id", ondelete="SET NULL"))
    project_id = Column(UUID(as_uuid=True), ForeignKey("fin_project.id", ondelete="SET NULL"))
    intercompany_partner_id = Column(UUID(as_uuid=True), ForeignKey("fin_intercompany_partner.id", ondelete="SET NULL"))
    # Value date: when the cash effect is recognised (may differ from posting date)
    value_date = Column(Date)
    # Reference document linkage
    ref_doc_type = Column(String(40))   # purchase_order / sales_order / invoice / bill / payment / asset / manual
    ref_doc_id = Column(UUID(as_uuid=True))
    ref_doc_no = Column(String(100))    # denormalised display number
    # Tax fields
    tax_code = Column(String(20))
    tax_amount = Column(Numeric(18, 4), default=0)
    # Order / assignment reference (for open-item clearing)
    assignment = Column(String(100))
    # Open-item management (SAP-style)
    # NULL = not tracked; 'open' = not yet cleared; 'cleared' = matched & closed; 'partial' = partially applied
    open_item_status = Column(String(20), nullable=True)
    clearing_batch_id = Column(UUID(as_uuid=True), ForeignKey("fin_gl_clearing_batch.id", ondelete="SET NULL"), nullable=True)
    clearing_date = Column(Date, nullable=True)
    # Profit centre & segment dimensions (Feature 5)
    profit_center_id = Column(UUID(as_uuid=True), ForeignKey("fin_profit_center.id", ondelete="SET NULL"), nullable=True)
    segment_id       = Column(UUID(as_uuid=True), ForeignKey("fin_segment.id", ondelete="SET NULL"), nullable=True)
    # FX columns (Feature 6) — NULL means local-currency posting
    currency      = Column(String(3),       nullable=True)
    amount_fc     = Column(Numeric(18, 4),  nullable=True)
    exchange_rate = Column(Numeric(20, 8),  nullable=True)

    entry = relationship("FinJournalEntry", back_populates="lines")
    account = relationship("FinAccount", back_populates="journal_lines")
    cost_center = relationship("FinCostCenter", foreign_keys=[cost_center_id])
    project = relationship("FinProject", foreign_keys=[project_id])
    profit_center = relationship("FinProfitCenter", foreign_keys=[profit_center_id])
    segment = relationship("FinSegment", foreign_keys=[segment_id])


class FinGlClearingBatch(Base):
    """
    Header record for a GL open-item clearing event.
    One or more journal lines (all on the same account) are selected, validated
    to net to zero, and linked to this batch — marking them as 'cleared'.
    """
    __tablename__ = "fin_gl_clearing_batch"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("fin_account.id", ondelete="RESTRICT"), nullable=False, index=True)
    # Auto-generated sequential ref e.g. CLR000001
    clearing_ref = Column(String(30), nullable=False)
    clearing_date = Column(Date, nullable=False)
    party_type = Column(String(20), nullable=True)
    party_id = Column(UUID(as_uuid=True), nullable=True)
    line_count = Column(Integer, default=0)
    total_debit = Column(Numeric(18, 4), default=0)
    total_credit = Column(Numeric(18, 4), default=0)
    notes = Column(Text, nullable=True)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("vendor_id", "clearing_ref", name="uq_fin_clr_batch_vendor_ref"),
        Index("ix_fin_clr_batch_account", "vendor_id", "account_id"),
        Index("ix_fin_clr_batch_party", "vendor_id", "party_type", "party_id"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# FX EXCHANGE RATES & REVALUATION
# ─────────────────────────────────────────────────────────────────────────────

# FinExchangeRate is already defined above (line ~252).
# The models below use the existing table via the existing class.

class FinFxRevalRun(Base):
    """
    Header record for a foreign-currency revaluation batch.
    Equivalent to SAP F.05 / FAGL_FC_VAL run.
    """
    __tablename__ = "fin_fx_reval_run"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id        = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="CASCADE"), nullable=False)
    run_date         = Column(Date, nullable=False)
    currency         = Column(String(3), nullable=False)
    rate_used        = Column(Numeric(20, 8), nullable=False)
    total_gain       = Column(Numeric(18, 4), default=0, server_default="0")
    total_loss       = Column(Numeric(18, 4), default=0, server_default="0")
    # 'simulated' | 'posted' | 'reversed'
    status           = Column(String(15), default="simulated", server_default="simulated")
    journal_entry_id = Column(UUID(as_uuid=True), ForeignKey("fin_journal_entry.id", ondelete="SET NULL"), nullable=True)
    created_by       = Column(String(120), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    lines = relationship("FinFxRevalLine", back_populates="reval_run", cascade="all, delete-orphan")


class FinFxRevalLine(Base):
    """One adjustment record within a revaluation run."""
    __tablename__ = "fin_fx_reval_line"

    id                 = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reval_run_id       = Column(UUID(as_uuid=True), ForeignKey("fin_fx_reval_run.id", ondelete="CASCADE"), nullable=False)
    journal_line_id    = Column(UUID(as_uuid=True), ForeignKey("fin_journal_line.id", ondelete="CASCADE"), nullable=False)
    original_amount_fc = Column(Numeric(18, 4), nullable=False)
    original_amount_lc = Column(Numeric(18, 4), nullable=False)
    revalued_amount_lc = Column(Numeric(18, 4), nullable=False)
    adjustment         = Column(Numeric(18, 4), nullable=False)

    reval_run = relationship("FinFxRevalRun", back_populates="lines")


class FinBalanceCarryForward(Base):
    """
    Year-end carry-forward log: records the closing balance of each
    balance-sheet account that was carried as the opening balance of the
    next fiscal year.
    Equivalent to SAP F.16 / FAGLGVTR.
    """
    __tablename__ = "fin_balance_carryforward"

    id                 = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id          = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="CASCADE"), nullable=False)
    account_id         = Column(UUID(as_uuid=True), ForeignKey("fin_account.id", ondelete="CASCADE"), nullable=False)
    from_fiscal_year   = Column(Integer, nullable=False)
    to_fiscal_year     = Column(Integer, nullable=False)
    closing_balance    = Column(Numeric(18, 4), nullable=False)
    carried_forward_at = Column(DateTime(timezone=True), server_default=func.now())
    carried_by         = Column(String(120), nullable=True)

    __table_args__ = (
        UniqueConstraint("vendor_id", "account_id", "from_fiscal_year",
                         name="uq_fin_bcf_vendor_acct_fy"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# FINANCIAL STATEMENT VERSIONS (FSV)
# ─────────────────────────────────────────────────────────────────────────────

class FinStatementVersion(Base):
    """
    A configurable financial statement layout (SAP FSV equivalent).
    Allows multiple P&L or Balance Sheet structures e.g. for different
    regulatory frameworks, management reporting, or tax purposes.
    """
    __tablename__ = "fin_statement_version"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    # income_statement | balance_sheet | custom
    statement_type = Column(String(30), nullable=False)
    description = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    nodes = relationship("FinStatementNode", back_populates="version", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("vendor_id", "name", "statement_type", name="uq_fin_fsv_vendor_name_type"),
    )


class FinStatementNode(Base):
    """
    One node in a Financial Statement Version tree.
    node_type:
      group     = section header with optional children
      item      = leaf node — has account assignments
      subtotal  = auto-computed sum of sibling items/groups above it
      separator = visual blank row / horizontal rule
    """
    __tablename__ = "fin_statement_node"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    version_id = Column(UUID(as_uuid=True), ForeignKey("fin_statement_version.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("fin_statement_node.id", ondelete="CASCADE"), nullable=True)
    name = Column(String(200), nullable=False)
    node_type = Column(String(20), default="group", server_default="group")
    sort_order = Column(Integer, default=0, server_default="0")
    sign_flip = Column(Boolean, default=False, server_default="false")  # negate balance for display
    bold = Column(Boolean, default=False, server_default="false")
    indent_level = Column(Integer, default=0, server_default="0")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    version = relationship("FinStatementVersion", back_populates="nodes")
    children = relationship("FinStatementNode", back_populates="parent", foreign_keys=[parent_id])
    parent = relationship("FinStatementNode", back_populates="children", foreign_keys=[parent_id], remote_side=[id])
    account_assignments = relationship("FinStatementNodeAcct", back_populates="node", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_fin_stmt_node_version", "version_id", "sort_order"),
    )


class FinStatementNodeAcct(Base):
    """Assigns GL accounts (individual or code range) to a statement node."""
    __tablename__ = "fin_statement_node_acct"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    node_id = Column(UUID(as_uuid=True), ForeignKey("fin_statement_node.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    # Either a specific account or a code range (from/to).
    # When account_id is set, code_from/to are ignored.
    account_id = Column(UUID(as_uuid=True), ForeignKey("fin_account.id", ondelete="CASCADE"), nullable=True)
    code_from = Column(String(20), nullable=True)
    code_to = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    node = relationship("FinStatementNode", back_populates="account_assignments")


# ─────────────────────────────────────────────────────────────────────────────
# PROFIT CENTERS & SEGMENTS
# ─────────────────────────────────────────────────────────────────────────────

class FinProfitCenter(Base):
    """
    Internal P&L reporting unit — finer grain than a cost centre.
    Equivalent to SAP EC-PCA Profit Center (KE51).
    Can be arranged in a hierarchy via parent_id.
    """
    __tablename__ = "fin_profit_center"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id   = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="CASCADE"), nullable=False)
    code        = Column(String(20),  nullable=False)
    name        = Column(String(120), nullable=False)
    description = Column(Text, nullable=True)
    parent_id   = Column(UUID(as_uuid=True), ForeignKey("fin_profit_center.id", ondelete="SET NULL"), nullable=True)
    manager     = Column(String(120), nullable=True)
    is_active   = Column(Boolean, default=True, server_default="true")
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    children = relationship("FinProfitCenter", back_populates="parent", foreign_keys=[parent_id])
    parent   = relationship("FinProfitCenter", back_populates="children", foreign_keys=[parent_id], remote_side=[id])

    __table_args__ = (
        UniqueConstraint("vendor_id", "code", name="uq_fin_pc_vendor_code"),
    )


class FinSegment(Base):
    """
    Top-level segment dimension for IFRS 8 / management segment reporting.
    Equivalent to SAP's Segment characteristic in New G/L.
    """
    __tablename__ = "fin_segment"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id   = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="CASCADE"), nullable=False)
    code        = Column(String(20),  nullable=False)
    name        = Column(String(120), nullable=False)
    description = Column(Text, nullable=True)
    is_active   = Column(Boolean, default=True, server_default="true")
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("vendor_id", "code", name="uq_fin_seg_vendor_code"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# POSTING KEYS
# ─────────────────────────────────────────────────────────────────────────────

class FinPostingKey(Base):
    """
    SAP-style posting key: defines debit/credit side and field behaviour
    for a journal line.  Codes like '40' (GL debit) and '50' (GL credit)
    are pre-seeded; customers may add custom codes.
    """
    __tablename__ = "fin_posting_key"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id    = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="CASCADE"), nullable=False)
    code         = Column(String(4),   nullable=False)
    name         = Column(String(120), nullable=False)
    # 'debit' or 'credit'
    side         = Column(String(6),   nullable=False)
    # Optional account-type restriction: asset | liability | income | expense | None
    account_type = Column(String(20),  nullable=True)
    # Posting key used when reversing a document that used this key
    reversal_key = Column(String(4),   nullable=True)
    is_active    = Column(Boolean, default=True, server_default="true")
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("vendor_id", "code", name="uq_fin_posting_key_vendor_code"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# FIELD STATUS GROUPS
# ─────────────────────────────────────────────────────────────────────────────

class FinFieldStatusGroup(Base):
    """
    Named template attached to a GL account that controls which line-item
    fields are required / optional / suppressed during posting.
    Equivalent to SAP's Field Status Group on the GL account master.
    """
    __tablename__ = "fin_field_status_group"

    id        = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="CASCADE"), nullable=False)
    code      = Column(String(10),  nullable=False)
    name      = Column(String(120), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    rules = relationship("FinFieldStatusRule", back_populates="group", cascade="all, delete-orphan")
    accounts = relationship("FinAccount", back_populates="field_status_group")

    __table_args__ = (
        UniqueConstraint("vendor_id", "code", name="uq_fin_fsg_vendor_code"),
    )


class FinFieldStatusRule(Base):
    """
    One field-status override within a Field Status Group.
    field_name: cost_center | project | assignment | text | payment_terms | tax_code
    status:     required | optional | suppressed
    """
    __tablename__ = "fin_field_status_rule"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id   = Column(UUID(as_uuid=True), ForeignKey("fin_field_status_group.id", ondelete="CASCADE"), nullable=False)
    field_name = Column(String(40), nullable=False)
    status     = Column(String(15), nullable=False, default="optional")

    group = relationship("FinFieldStatusGroup", back_populates="rules")

    __table_args__ = (
        UniqueConstraint("group_id", "field_name", name="uq_fin_fsr_group_field"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# TOLERANCE GROUPS
# ─────────────────────────────────────────────────────────────────────────────

class FinToleranceGroup(Base):
    """
    Company-wide or per-user limits on posting amounts and payment differences.
    Equivalent to SAP's Tolerance Groups (OBA4 / OBA3).

    A vendor_user may have fin_tolerance_group_id set; if NULL the system
    applies the group whose code == '' (the default group).
    """
    __tablename__ = "fin_tolerance_group"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id           = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="CASCADE"), nullable=False)
    code                = Column(String(10),      nullable=False)
    name                = Column(String(120),     nullable=False)
    max_line_amount     = Column(Numeric(18, 4),  nullable=True)
    max_document_amount = Column(Numeric(18, 4),  nullable=True)
    payment_diff_abs    = Column(Numeric(18, 4),  nullable=True)
    payment_diff_pct    = Column(Numeric(7, 4),   nullable=True)
    currency            = Column(String(3), default="INR", server_default="INR", nullable=False)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("vendor_id", "code", name="uq_fin_tg_vendor_code"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# VALIDATION RULES, SUBSTITUTION RULES, NUMBER RANGES
# ─────────────────────────────────────────────────────────────────────────────

class FinValidationRule(Base):
    """
    Posting-time validation rule.  Evaluated at the 'document' or 'line' call point.
    - prerequisite_expr (optional): Python bool expression; if False the rule is skipped.
    - check_expr: Python bool expression evaluated against a context dict; must be True.
    Equivalent to SAP GGB0 validation.
    """
    __tablename__ = "fin_validation_rule"

    id                 = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id          = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    name               = Column(String(120), nullable=False)
    description        = Column(Text, nullable=True)
    call_point         = Column(String(10), default="document", server_default="document")
    prerequisite_expr  = Column(Text, nullable=True)
    check_expr         = Column(Text, nullable=False)
    error_message      = Column(String(500), nullable=False)
    is_active          = Column(Boolean, default=True, server_default="true")
    sort_order         = Column(Integer, default=10, server_default="10")
    created_at         = Column(DateTime(timezone=True), server_default=func.now())


class FinSubstitutionRule(Base):
    """
    Field-value substitution rule.
    When prerequisite_expr evaluates to True, target_field is overwritten
    with the result of substitution_expr.
    Equivalent to SAP GGB1 substitution.
    """
    __tablename__ = "fin_substitution_rule"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id           = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    name                = Column(String(120), nullable=False)
    description         = Column(Text, nullable=True)
    call_point          = Column(String(10), default="line", server_default="line")
    prerequisite_expr   = Column(Text, nullable=True)
    target_field        = Column(String(60), nullable=False)
    substitution_expr   = Column(Text, nullable=False)
    is_active           = Column(Boolean, default=True, server_default="true")
    sort_order          = Column(Integer, default=10, server_default="10")
    created_at          = Column(DateTime(timezone=True), server_default=func.now())


class FinNumberRange(Base):
    """
    Document number series per document type and fiscal year.
    Equivalent to SAP FBN1 / number range object.
    """
    __tablename__ = "fin_number_range"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id      = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    document_type  = Column(String(4), nullable=False)
    fiscal_year    = Column(Integer, nullable=False)
    number_from    = Column(Integer, nullable=False)
    number_to      = Column(Integer, nullable=False)
    current_number = Column(Integer, nullable=False)
    prefix         = Column(String(10), nullable=True)
    is_external    = Column(Boolean, default=False, server_default="false")
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("vendor_id", "document_type", "fiscal_year",
                         name="uq_fin_nr_vendor_type_fy"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# DOCUMENT SPLITTING
# ─────────────────────────────────────────────────────────────────────────────

class FinSplitRule(Base):
    """
    Configures automatic document splitting for a vendor.
    When active, lines of the configured account types are proportionally
    split across profit centres, segments, or cost centres.
    Equivalent to SAP New G/L document splitting configuration (FAGL_DOC_SPLIT).
    """
    __tablename__ = "fin_split_rule"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id    = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    name         = Column(String(120), nullable=False)
    # 'profit_center' | 'segment' | 'cost_center'
    dimension    = Column(String(30), nullable=False)
    # 'proportional' (weighted by base-line amounts) | 'equal'
    split_method = Column(String(20), default="proportional", server_default="proportional")
    is_active    = Column(Boolean, default=True, server_default="true")
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    base_types = relationship("FinSplitRuleBase", back_populates="rule", cascade="all, delete-orphan")


class FinSplitRuleBase(Base):
    """Account types that act as the allocation basis for a split rule."""
    __tablename__ = "fin_split_rule_base"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_id      = Column(UUID(as_uuid=True), ForeignKey("fin_split_rule.id", ondelete="CASCADE"), nullable=False)
    account_type = Column(String(20), nullable=False)

    rule = relationship("FinSplitRule", back_populates="base_types")


class FinJournalSplitItem(Base):
    """
    One slice of a split journal line — the result of document splitting.
    There will be one FinJournalSplitItem per dimension value per journal line.
    """
    __tablename__ = "fin_journal_split_item"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    journal_line_id  = Column(UUID(as_uuid=True), ForeignKey("fin_journal_line.id", ondelete="CASCADE"), nullable=False)
    profit_center_id = Column(UUID(as_uuid=True), ForeignKey("fin_profit_center.id", ondelete="SET NULL"), nullable=True)
    segment_id       = Column(UUID(as_uuid=True), ForeignKey("fin_segment.id", ondelete="SET NULL"), nullable=True)
    cost_center_id   = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"), nullable=True)
    debit            = Column(Numeric(18, 4), default=0, server_default="0")
    credit           = Column(Numeric(18, 4), default=0, server_default="0")
    split_pct        = Column(Numeric(7, 4), nullable=False)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())


# ─────────────────────────────────────────────────────────────────────────────
# PARALLEL LEDGERS / MULTI-GAAP  (SAP New G/L equivalent)
# ─────────────────────────────────────────────────────────────────────────────

class FinLedger(Base):
    """Named ledger definition — e.g. 'Leading (Local GAAP)', 'IFRS', 'Tax'."""
    __tablename__ = "fin_ledger"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id   = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    code        = Column(String(10), nullable=False)
    name        = Column(String(120), nullable=False)
    description = Column(Text)
    is_leading  = Column(Boolean, default=False, nullable=False)
    currency    = Column(String(3), default="INR")
    is_active   = Column(Boolean, default=True, nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    assignments  = relationship("FinLedgerAssignment", back_populates="ledger", cascade="all, delete-orphan")
    ledger_lines = relationship("FinJournalLineLedger", back_populates="ledger", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("vendor_id", "code", name="uq_fin_ledger_vendor_code"),
    )


class FinLedgerAssignment(Base):
    """Assigns one or more ledgers to a company entity."""
    __tablename__ = "fin_ledger_assignment"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id  = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    ledger_id  = Column(UUID(as_uuid=True), ForeignKey("fin_ledger.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("fin_company.id", ondelete="CASCADE"), nullable=False, index=True)
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ledger  = relationship("FinLedger", back_populates="assignments")
    company = relationship("FinCompany")

    __table_args__ = (
        UniqueConstraint("ledger_id", "company_id", name="uq_fin_ledger_assignment"),
    )


class FinJournalLineLedger(Base):
    """
    Ledger-specific override amounts for a journal line.

    For the *leading* ledger the amounts are always those on FinJournalLine itself.
    For parallel ledgers a row here stores the delta (or full override) amount,
    enabling different valuations — e.g. IFRS depreciation vs. local GAAP.
    """
    __tablename__ = "fin_journal_line_ledger"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    journal_line_id = Column(UUID(as_uuid=True), ForeignKey("fin_journal_line.id", ondelete="CASCADE"), nullable=False, index=True)
    ledger_id       = Column(UUID(as_uuid=True), ForeignKey("fin_ledger.id", ondelete="CASCADE"), nullable=False, index=True)
    debit           = Column(Numeric(18, 4), default=0, server_default="0")
    credit          = Column(Numeric(18, 4), default=0, server_default="0")
    amount_fc       = Column(Numeric(18, 4))
    narration       = Column(Text)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    journal_line = relationship("FinJournalLine")
    ledger       = relationship("FinLedger", back_populates="ledger_lines")

    __table_args__ = (
        UniqueConstraint("journal_line_id", "ledger_id", name="uq_fin_jll_line_ledger"),
    )


class FinRecurringTemplate(Base):
    __tablename__ = "fin_recurring_template"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    frequency = Column(String(20), default="monthly")  # daily / weekly / monthly / quarterly / yearly
    next_run_date = Column(Date)
    end_date = Column(Date)
    is_active = Column(Boolean, default=True)
    template_lines = Column(JSONB, default=[])         # [{account_id, debit/credit, narration}]
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ─────────────────────────────────────────────────────────────────────────────
# ACCOUNTS RECEIVABLE (AR)
# ─────────────────────────────────────────────────────────────────────────────

class FinCustomerPaymentApplication(Base):
    """Links a payment to one or more invoices (many-to-many with amount)."""
    __tablename__ = "fin_customer_payment_application"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    payment_id = Column(UUID(as_uuid=True), ForeignKey("payment.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoice.id", ondelete="CASCADE"), nullable=False, index=True)
    amount_applied = Column(Numeric(18, 4), nullable=False)
    applied_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"))


class FinArAgingSnapshot(Base):
    __tablename__ = "fin_ar_aging_snapshot"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    snapshot_date = Column(Date, nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id", ondelete="CASCADE"), index=True)
    current_amt = Column(Numeric(18, 4), default=0)
    days_1_30 = Column(Numeric(18, 4), default=0)
    days_31_60 = Column(Numeric(18, 4), default=0)
    days_61_90 = Column(Numeric(18, 4), default=0)
    days_90_plus = Column(Numeric(18, 4), default=0)
    total_outstanding = Column(Numeric(18, 4), default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ─────────────────────────────────────────────────────────────────────────────
# ACCOUNTS PAYABLE (AP)
# ─────────────────────────────────────────────────────────────────────────────

class FinVendorBill(Base):
    """Supplier bill / vendor invoice (AP side)."""
    __tablename__ = "fin_vendor_bill"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier.id", ondelete="RESTRICT"), nullable=False, index=True)
    po_id = Column(UUID(as_uuid=True), ForeignKey("purchase_order.id", ondelete="SET NULL"))
    bill_no = Column(String(50), nullable=False)
    bill_date = Column(Date, nullable=False)
    due_date = Column(Date)
    subtotal = Column(Numeric(18, 4), default=0)
    tax_amount = Column(Numeric(18, 4), default=0)
    total = Column(Numeric(18, 4), default=0)
    amount_paid = Column(Numeric(18, 4), default=0)
    balance_due = Column(Numeric(18, 4), default=0)
    status = Column(String(20), default="draft")     # draft / open / partially_paid / paid / void
    notes = Column(Text)
    attachment_url = Column(String(500))
    currency = Column(String(3), default="INR")
    journal_entry_id = Column(UUID(as_uuid=True), ForeignKey("fin_journal_entry.id", ondelete="SET NULL"))
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    lines = relationship("FinVendorBillLine", back_populates="bill", cascade="all, delete-orphan")
    payments = relationship("FinVendorPayment", back_populates="bill")


class FinVendorBillLine(Base):
    __tablename__ = "fin_vendor_bill_line"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bill_id = Column(UUID(as_uuid=True), ForeignKey("fin_vendor_bill.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("fin_account.id", ondelete="RESTRICT"))
    description = Column(String(500))
    quantity = Column(Numeric(12, 4), default=1)
    unit_price = Column(Numeric(18, 4), default=0)
    tax_rate = Column(Numeric(6, 4), default=0)
    tax_amount = Column(Numeric(18, 4), default=0)
    line_total = Column(Numeric(18, 4), default=0)
    hsn_sac = Column(String(20))
    sequence = Column(Integer, default=0)

    bill = relationship("FinVendorBill", back_populates="lines")


class FinVendorPayment(Base):
    __tablename__ = "fin_vendor_payment"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier.id", ondelete="RESTRICT"), nullable=False, index=True)
    bill_id = Column(UUID(as_uuid=True), ForeignKey("fin_vendor_bill.id", ondelete="SET NULL"), index=True)
    payment_run_id = Column(UUID(as_uuid=True), ForeignKey("fin_payment_run.id", ondelete="SET NULL"))
    payment_date = Column(Date, nullable=False)
    amount = Column(Numeric(18, 4), nullable=False)
    payment_method = Column(String(30), default="bank_transfer")  # bank_transfer / cheque / cash / upi
    reference_no = Column(String(100))
    bank_account_id = Column(UUID(as_uuid=True), ForeignKey("fin_bank_account.id", ondelete="SET NULL"))
    journal_entry_id = Column(UUID(as_uuid=True), ForeignKey("fin_journal_entry.id", ondelete="SET NULL"))
    notes = Column(Text)
    status = Column(String(20), default="pending")   # pending / cleared / void
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    bill = relationship("FinVendorBill", back_populates="payments")


class FinPaymentRun(Base):
    """Batch payment run for AP."""
    __tablename__ = "fin_payment_run"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200))
    payment_date = Column(Date, nullable=False)
    bank_account_id = Column(UUID(as_uuid=True), ForeignKey("fin_bank_account.id", ondelete="SET NULL"))
    total_amount = Column(Numeric(18, 4), default=0)
    status = Column(String(20), default="draft")    # draft / confirmed / processed / void
    notes = Column(Text)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    items = relationship("FinPaymentRunItem", back_populates="run", cascade="all, delete-orphan")


class FinPaymentRunItem(Base):
    __tablename__ = "fin_payment_run_item"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("fin_payment_run.id", ondelete="CASCADE"), nullable=False, index=True)
    bill_id = Column(UUID(as_uuid=True), ForeignKey("fin_vendor_bill.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Numeric(18, 4), nullable=False)
    is_included = Column(Boolean, default=True)

    run = relationship("FinPaymentRun", back_populates="items")


class FinApAgingSnapshot(Base):
    __tablename__ = "fin_ap_aging_snapshot"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    snapshot_date = Column(Date, nullable=False)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier.id", ondelete="CASCADE"), index=True)
    current_amt = Column(Numeric(18, 4), default=0)
    days_1_30 = Column(Numeric(18, 4), default=0)
    days_31_60 = Column(Numeric(18, 4), default=0)
    days_61_90 = Column(Numeric(18, 4), default=0)
    days_90_plus = Column(Numeric(18, 4), default=0)
    total_outstanding = Column(Numeric(18, 4), default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ─────────────────────────────────────────────────────────────────────────────
# BANK / CASH
# ─────────────────────────────────────────────────────────────────────────────

class FinBankAccount(Base):
    """Finance bank account linked to a GL cash/bank account."""
    __tablename__ = "fin_bank_account"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    gl_account_id = Column(UUID(as_uuid=True), ForeignKey("fin_account.id", ondelete="RESTRICT"))
    name = Column(String(200), nullable=False)
    account_type = Column(String(20), default="bank")   # bank / cash / credit_card / wallet
    bank_name = Column(String(200))
    account_number = Column(String(50))
    ifsc_code = Column(String(20))
    currency = Column(String(3), default="INR")
    opening_balance = Column(Numeric(18, 4), default=0)
    current_balance = Column(Numeric(18, 4), default=0)
    is_active = Column(Boolean, default=True)
    last_reconciled_date = Column(Date)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    statements = relationship("FinBankStatement", back_populates="bank_account", cascade="all, delete-orphan")


class FinBankStatement(Base):
    __tablename__ = "fin_bank_statement"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    bank_account_id = Column(UUID(as_uuid=True), ForeignKey("fin_bank_account.id", ondelete="CASCADE"), nullable=False, index=True)
    statement_date = Column(Date, nullable=False)
    from_date = Column(Date)
    to_date = Column(Date)
    closing_balance = Column(Numeric(18, 4))
    source = Column(String(20), default="manual")    # manual / csv / ofx
    raw_data = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    bank_account = relationship("FinBankAccount", back_populates="statements")
    lines = relationship("FinBankStatementLine", back_populates="statement", cascade="all, delete-orphan")


class FinBankStatementLine(Base):
    __tablename__ = "fin_bank_statement_line"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    statement_id = Column(UUID(as_uuid=True), ForeignKey("fin_bank_statement.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    transaction_date = Column(Date, nullable=False)
    description = Column(Text)
    reference = Column(String(200))
    debit = Column(Numeric(18, 4), default=0)
    credit = Column(Numeric(18, 4), default=0)
    balance = Column(Numeric(18, 4))
    is_reconciled = Column(Boolean, default=False, server_default=false())
    reconciliation_id = Column(UUID(as_uuid=True), ForeignKey("fin_bank_reconciliation.id", ondelete="SET NULL"))

    statement = relationship("FinBankStatement", back_populates="lines")


class FinBankReconciliation(Base):
    __tablename__ = "fin_bank_reconciliation"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    bank_account_id = Column(UUID(as_uuid=True), ForeignKey("fin_bank_account.id", ondelete="CASCADE"), nullable=False, index=True)
    reconciliation_date = Column(Date, nullable=False)
    statement_balance = Column(Numeric(18, 4))
    book_balance = Column(Numeric(18, 4))
    difference = Column(Numeric(18, 4), default=0)
    status = Column(String(20), default="open")    # open / reconciled
    notes = Column(Text)
    completed_by_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    matches = relationship("FinReconciliationMatch", back_populates="reconciliation", cascade="all, delete-orphan")


class FinReconciliationMatch(Base):
    __tablename__ = "fin_reconciliation_match"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reconciliation_id = Column(UUID(as_uuid=True), ForeignKey("fin_bank_reconciliation.id", ondelete="CASCADE"), nullable=False, index=True)
    statement_line_id = Column(UUID(as_uuid=True), ForeignKey("fin_bank_statement_line.id", ondelete="CASCADE"))
    journal_line_id = Column(UUID(as_uuid=True), ForeignKey("fin_journal_line.id", ondelete="CASCADE"))
    amount = Column(Numeric(18, 4))
    match_type = Column(String(20), default="exact")   # exact / partial / manual

    reconciliation = relationship("FinBankReconciliation", back_populates="matches")


# ─────────────────────────────────────────────────────────────────────────────
# BUDGET & FORECAST
# ─────────────────────────────────────────────────────────────────────────────

class FinBudget(Base):
    __tablename__ = "fin_budget"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    fiscal_year_id = Column(UUID(as_uuid=True), ForeignKey("fin_fiscal_year.id", ondelete="RESTRICT"), nullable=False)
    name = Column(String(200), nullable=False)
    scope = Column(String(20), default="company")    # company / store / department
    scope_id = Column(UUID(as_uuid=True))
    status = Column(String(20), default="draft")    # draft / approved / active / closed
    notes = Column(Text)
    total_income = Column(Numeric(18, 4), default=0)
    total_expense = Column(Numeric(18, 4), default=0)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    lines = relationship("FinBudgetLine", back_populates="budget", cascade="all, delete-orphan")


class FinBudgetLine(Base):
    __tablename__ = "fin_budget_line"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    budget_id = Column(UUID(as_uuid=True), ForeignKey("fin_budget.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("fin_account.id", ondelete="RESTRICT"), nullable=False)
    period_id = Column(UUID(as_uuid=True), ForeignKey("fin_period.id", ondelete="RESTRICT"))
    amount = Column(Numeric(18, 4), nullable=False, default=0)
    notes = Column(Text)

    budget = relationship("FinBudget", back_populates="lines")


class FinForecast(Base):
    __tablename__ = "fin_forecast"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    forecast_type = Column(String(20), default="monthly")   # monthly / quarterly
    base_date = Column(Date, nullable=False)
    months_ahead = Column(Integer, default=12)
    method = Column(String(30), default="manual")           # manual / trend / ai
    status = Column(String(20), default="draft")
    notes = Column(Text)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lines = relationship("FinForecastLine", back_populates="forecast", cascade="all, delete-orphan")


class FinForecastLine(Base):
    __tablename__ = "fin_forecast_line"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    forecast_id = Column(UUID(as_uuid=True), ForeignKey("fin_forecast.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("fin_account.id", ondelete="RESTRICT"), nullable=False)
    period_start = Column(Date, nullable=False)
    amount = Column(Numeric(18, 4), nullable=False, default=0)
    notes = Column(Text)

    forecast = relationship("FinForecast", back_populates="lines")


# ─────────────────────────────────────────────────────────────────────────────
# TAX
# ─────────────────────────────────────────────────────────────────────────────

class FinTaxCode(Base):
    __tablename__ = "fin_tax_code"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(20), nullable=False)        # GST18 / TDS10 / CGST9 etc.
    name = Column(String(100), nullable=False)
    tax_type = Column(String(20), nullable=False)    # CGST / SGST / IGST / TDS / TCS / Income
    rate = Column(Numeric(8, 4), nullable=False)
    gl_account_id = Column(UUID(as_uuid=True), ForeignKey("fin_account.id", ondelete="SET NULL"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class FinTaxReturn(Base):
    __tablename__ = "fin_tax_return"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    return_type = Column(String(20), nullable=False)    # GSTR1 / GSTR3B / TDS / Income
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    status = Column(String(20), default="draft")        # draft / computed / filed / nil
    computed_json = Column(JSONB)
    total_tax_liability = Column(Numeric(18, 4), default=0)
    total_itc = Column(Numeric(18, 4), default=0)
    net_payable = Column(Numeric(18, 4), default=0)
    filing_reference = Column(String(100))
    filed_at = Column(DateTime(timezone=True))
    filed_by_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"))
    due_date = Column(Date)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ─────────────────────────────────────────────────────────────────────────────
# FIXED ASSETS
# ─────────────────────────────────────────────────────────────────────────────

class FinAssetCategory(Base):
    __tablename__ = "fin_asset_category"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    depreciation_method = Column(String(20), default="straight_line")  # straight_line / wdv / units_of_production
    useful_life_years = Column(Integer, default=5)
    salvage_pct = Column(Numeric(6, 4), default=0)     # residual value %
    asset_account_id = Column(UUID(as_uuid=True), ForeignKey("fin_account.id", ondelete="SET NULL"))
    accum_dep_account_id = Column(UUID(as_uuid=True), ForeignKey("fin_account.id", ondelete="SET NULL"))
    dep_expense_account_id = Column(UUID(as_uuid=True), ForeignKey("fin_account.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    assets = relationship("FinAsset", back_populates="category")


class FinAsset(Base):
    __tablename__ = "fin_asset"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("fin_asset_category.id", ondelete="RESTRICT"))
    asset_code = Column(String(30), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    acquisition_date = Column(Date, nullable=False)
    purchase_cost = Column(Numeric(18, 4), nullable=False)
    salvage_value = Column(Numeric(18, 4), default=0)
    useful_life_years = Column(Integer)
    depreciation_method = Column(String(20))           # overrides category if set
    current_value = Column(Numeric(18, 4))
    accumulated_depreciation = Column(Numeric(18, 4), default=0)
    location = Column(String(200))
    store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="SET NULL"))
    serial_number = Column(String(100))
    status = Column(String(20), default="active")      # active / disposed / under_maintenance
    disposal_date = Column(Date)
    disposal_value = Column(Numeric(18, 4))
    notes = Column(Text)
    vendor_bill_id = Column(UUID(as_uuid=True), ForeignKey("fin_vendor_bill.id", ondelete="SET NULL"))
    journal_entry_id = Column(UUID(as_uuid=True), ForeignKey("fin_journal_entry.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    category = relationship("FinAssetCategory", back_populates="assets")
    depreciation_entries = relationship("FinAssetDepreciationEntry", back_populates="asset", cascade="all, delete-orphan")
    maintenance_records = relationship("FinAssetMaintenance", back_populates="asset", cascade="all, delete-orphan")


class FinAssetDepreciationEntry(Base):
    __tablename__ = "fin_asset_depreciation_entry"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("fin_asset.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    period_id = Column(UUID(as_uuid=True), ForeignKey("fin_period.id", ondelete="SET NULL"))
    depreciation_date = Column(Date, nullable=False)
    amount = Column(Numeric(18, 4), nullable=False)
    book_value_after = Column(Numeric(18, 4))
    journal_entry_id = Column(UUID(as_uuid=True), ForeignKey("fin_journal_entry.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    asset = relationship("FinAsset", back_populates="depreciation_entries")


class FinAssetDisposal(Base):
    __tablename__ = "fin_asset_disposal"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("fin_asset.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    disposal_date = Column(Date, nullable=False)
    disposal_method = Column(String(30))               # sold / scrapped / donated
    sale_price = Column(Numeric(18, 4), default=0)
    book_value_at_disposal = Column(Numeric(18, 4))
    gain_loss = Column(Numeric(18, 4), default=0)
    journal_entry_id = Column(UUID(as_uuid=True), ForeignKey("fin_journal_entry.id", ondelete="SET NULL"))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class FinAssetMaintenance(Base):
    __tablename__ = "fin_asset_maintenance"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("fin_asset.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    maintenance_date = Column(Date, nullable=False)
    description = Column(Text)
    cost = Column(Numeric(18, 4), default=0)
    vendor_name = Column(String(200))
    status = Column(String(20), default="scheduled")   # scheduled / completed / cancelled
    journal_entry_id = Column(UUID(as_uuid=True), ForeignKey("fin_journal_entry.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    asset = relationship("FinAsset", back_populates="maintenance_records")


# ─────────────────────────────────────────────────────────────────────────────
# CAPITAL — LOANS & INVESTMENTS
# ─────────────────────────────────────────────────────────────────────────────

class FinLoan(Base):
    __tablename__ = "fin_loan"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    lender_name = Column(String(200))
    loan_type = Column(String(30), default="term")     # term / overdraft / cc / vehicle / property
    principal = Column(Numeric(18, 4), nullable=False)
    outstanding_balance = Column(Numeric(18, 4))
    interest_rate = Column(Numeric(8, 4))              # annual %
    rate_type = Column(String(10), default="fixed")    # fixed / floating
    disbursement_date = Column(Date)
    maturity_date = Column(Date)
    tenure_months = Column(Integer)
    emi_amount = Column(Numeric(18, 4))
    payment_frequency = Column(String(20), default="monthly")  # monthly / quarterly / bullet
    gl_account_id = Column(UUID(as_uuid=True), ForeignKey("fin_account.id", ondelete="SET NULL"))
    status = Column(String(20), default="active")      # active / closed / defaulted
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    schedule_lines = relationship("FinLoanScheduleLine", back_populates="loan", cascade="all, delete-orphan")


class FinLoanScheduleLine(Base):
    __tablename__ = "fin_loan_schedule_line"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loan_id = Column(UUID(as_uuid=True), ForeignKey("fin_loan.id", ondelete="CASCADE"), nullable=False, index=True)
    installment_no = Column(Integer, nullable=False)
    due_date = Column(Date, nullable=False)
    principal_amount = Column(Numeric(18, 4), default=0)
    interest_amount = Column(Numeric(18, 4), default=0)
    total_emi = Column(Numeric(18, 4), default=0)
    outstanding_after = Column(Numeric(18, 4), default=0)
    paid_date = Column(Date)
    paid_amount = Column(Numeric(18, 4), default=0)
    status = Column(String(20), default="pending")     # pending / paid / overdue
    journal_entry_id = Column(UUID(as_uuid=True), ForeignKey("fin_journal_entry.id", ondelete="SET NULL"))

    loan = relationship("FinLoan", back_populates="schedule_lines")


class FinInvestment(Base):
    __tablename__ = "fin_investment"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    investment_type = Column(String(30), default="fd")   # fd / mf / equity / bonds / realty / other
    amount_invested = Column(Numeric(18, 4), nullable=False)
    investment_date = Column(Date, nullable=False)
    expected_return_pct = Column(Numeric(8, 4))
    maturity_date = Column(Date)
    current_value = Column(Numeric(18, 4))
    realized_gain_loss = Column(Numeric(18, 4), default=0)
    status = Column(String(20), default="active")       # active / matured / sold
    notes = Column(Text)
    gl_account_id = Column(UUID(as_uuid=True), ForeignKey("fin_account.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    valuations = relationship("FinInvestmentValuation", back_populates="investment", cascade="all, delete-orphan")


class FinInvestmentValuation(Base):
    __tablename__ = "fin_investment_valuation"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    investment_id = Column(UUID(as_uuid=True), ForeignKey("fin_investment.id", ondelete="CASCADE"), nullable=False, index=True)
    valuation_date = Column(Date, nullable=False)
    market_value = Column(Numeric(18, 4), nullable=False)
    unrealized_gain_loss = Column(Numeric(18, 4), default=0)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    investment = relationship("FinInvestment", back_populates="valuations")


# ─────────────────────────────────────────────────────────────────────────────
# INTERNAL CONTROLS & AUDIT
# ─────────────────────────────────────────────────────────────────────────────

class FinApprovalPolicy(Base):
    __tablename__ = "fin_approval_policy"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_type = Column(String(40), nullable=False)   # journal_entry / vendor_bill / payment_run / budget
    threshold_amount = Column(Numeric(18, 4))          # null = always requires approval
    approver_user_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"))
    approver_role_slug = Column(String(50))            # if no specific user
    levels = Column(Integer, default=1)                # 1 or 2-level approval
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class FinApprovalRequest(Base):
    __tablename__ = "fin_approval_request"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    policy_id = Column(UUID(as_uuid=True), ForeignKey("fin_approval_policy.id", ondelete="SET NULL"))
    entity_type = Column(String(40), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    status = Column(String(20), default="pending")     # pending / approved / rejected / cancelled
    amount = Column(Numeric(18, 4))
    requested_by_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True))

    steps = relationship("FinApprovalStep", back_populates="request", cascade="all, delete-orphan")


class FinApprovalStep(Base):
    __tablename__ = "fin_approval_step"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id = Column(UUID(as_uuid=True), ForeignKey("fin_approval_request.id", ondelete="CASCADE"), nullable=False, index=True)
    step_number = Column(Integer, default=1)
    approver_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"))
    status = Column(String(20), default="pending")     # pending / approved / rejected
    action_at = Column(DateTime(timezone=True))
    comments = Column(Text)

    request = relationship("FinApprovalRequest", back_populates="steps")


class FinAuditLog(Base):
    __tablename__ = "fin_audit_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_type = Column(String(40), nullable=False, index=True)
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    action = Column(String(30), nullable=False)        # create / update / delete / post / void / approve / reject
    diff_json = Column(JSONB)
    performed_by_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), index=True)
    ip_address = Column(String(45))
    user_agent = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


# ─────────────────────────────────────────────────────────────────────────────
# BASIC FINANCE — lightweight transaction ledger for small businesses
# ─────────────────────────────────────────────────────────────────────────────

class FinBasicTransaction(Base):
    """Simple income / expense / salary / transfer entry — no double-entry needed."""
    __tablename__ = "fin_basic_transaction"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False, index=True)
    txn_type = Column(String(20), nullable=False, index=True)   # income | expense | salary | transfer
    category = Column(String(100), nullable=False)
    amount = Column(Numeric(18, 2), nullable=False)
    txn_date = Column(Date, nullable=False, index=True)
    description = Column(Text)
    payment_method = Column(String(50))                          # cash | bank | upi | card | cheque
    reference = Column(String(100))                              # invoice / receipt number
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
