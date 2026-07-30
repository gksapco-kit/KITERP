"""Pharmaceutical manufacturing module — batch control, QC, eBMR, QMS.

Phase map (live status on GET /vendors/me/pharma/overview):
  0 Foundations — product batch flags, SLoc stock types, batch number sequences
  1 Lot-first stock — BatchTransaction linking GR/GI/production to GoodsBatch
  2 FEFO / quarantine enforcement helpers
  3 MBR / BPR electronic batch records
  4 QC specs, inspection lots, release, CoA
  5 Genealogy / recall (derived from BatchTransaction)
  6 Deviation / CAPA / change control
  7 E-sign & audit — Stage A: credentialed Part 11 e-sign (enforced)
  8 Serialization — Stage B: hierarchy + enforce serial_managed (enforced)
  9 GDP / cold chain — Stage C (enforced lite)
 10 Track & trace (DSCSA/EPCIS) — Stage C (enforced export + verify stub)

Competitive roadmap: docs/PHARMA_ROADMAP.md (MVP → regulated SMB → wholesale).
"""
from __future__ import annotations

from sqlalchemy import (
    Column, String, Text, Boolean, Date, DateTime, ForeignKey,
    Integer, Numeric, Index, UniqueConstraint, text as sa_text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid

from app.database import Base


# ── Phase 0: batch number sequences ───────────────────────────────────────────

class PharmaBatchNumberModel(Base):
    """User-defined batch numbering pattern (one per vendor, keyed by code).

    pattern tokens:
      {PREFIX}  → model.prefix
      {YYYY}    → 4-digit year
      {YY}      → 2-digit year
      {MM}      → 2-digit month
      {DD}      → 2-digit day
      {SEQ}     → zero-padded counter (pad_width)

    Examples:
      "{PREFIX}-{YYYY}{MM}-{SEQ}"   → B-202607-00001
      "{PREFIX}-{YYYYMMDD}-{SEQ}"   → B-20260728-00001
      "{PREFIX}-{SEQ}"              → B-00001
    """
    __tablename__ = "pharma_batch_number_model"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    code = Column(String(40), nullable=False)
    label = Column(String(120), nullable=False)
    pattern = Column(String(120), nullable=False)          # must contain {SEQ}
    prefix = Column(String(40), nullable=False, default="B")
    pad_width = Column(Integer, nullable=False, default=5)
    reset_period = Column(String(10), nullable=False, default="never")   # never|yearly|monthly|daily
    scope = Column(String(10), nullable=False, default="vendor")         # vendor|plant|product
    # applies_to: comma-separated set of: manual, production, receipt, return, serial
    applies_to = Column(String(120), nullable=False, default="manual")
    is_default = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_pharma_bnm_vendor", "vendor_id"),
        UniqueConstraint("vendor_id", "code", name="uq_pharma_bnm_code"),
    )


class PharmaBatchSequence(Base):
    """Per-vendor (optional plant/product) counter for batch number generation."""
    __tablename__ = "pharma_batch_sequence"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    plant_id = Column(UUID(as_uuid=True), ForeignKey("plant.id", ondelete="CASCADE"), nullable=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=True)
    prefix = Column(String(40), nullable=False, default="B")
    # period_key: "" (never), "2026" (yearly), "202607" (monthly), "20260728" (daily)
    period_key = Column(String(10), nullable=False, default="")
    last_number = Column(Integer, nullable=False, default=0)
    pad_width = Column(Integer, nullable=False, default=5)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_pharma_batch_seq_vendor", "vendor_id"),
        UniqueConstraint(
            "vendor_id", "plant_id", "product_id", "prefix", "period_key",
            name="uq_pharma_batch_seq_scope",
        ),
    )


# ── Phase 1: batch transactions (genealogy spine) ─────────────────────────────

class BatchTransaction(Base):
    """Immutable lot movement line — every batch qty change should create one."""
    __tablename__ = "batch_transaction"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)

    # receive | issue | transfer | adjust | produce | reverse
    txn_type = Column(String(30), nullable=False)
    # purchase | production | transfer | sales | qc | recall | manual
    source_type = Column(String(30), nullable=True)
    source_id = Column(UUID(as_uuid=True), nullable=True)
    document_number = Column(String(60), nullable=True)

    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True)

    from_batch_id = Column(UUID(as_uuid=True), ForeignKey("goods_batch.id", ondelete="SET NULL"), nullable=True)
    to_batch_id = Column(UUID(as_uuid=True), ForeignKey("goods_batch.id", ondelete="SET NULL"), nullable=True)

    quantity = Column(Numeric(14, 4), nullable=False)
    uom = Column(String(30), nullable=True)

    plant_id = Column(UUID(as_uuid=True), ForeignKey("plant.id", ondelete="SET NULL"), nullable=True)
    from_storage_location_id = Column(
        UUID(as_uuid=True), ForeignKey("storage_location.id", ondelete="SET NULL"), nullable=True
    )
    to_storage_location_id = Column(
        UUID(as_uuid=True), ForeignKey("storage_location.id", ondelete="SET NULL"), nullable=True
    )

    quality_status = Column(String(30), nullable=True)
    notes = Column(Text, nullable=True)
    meta = Column(JSONB, nullable=False, default=dict)

    performed_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_batch_txn_vendor", "vendor_id"),
        Index("ix_batch_txn_product", "vendor_id", "product_id"),
        Index("ix_batch_txn_from_batch", "from_batch_id"),
        Index("ix_batch_txn_to_batch", "to_batch_id"),
        Index("ix_batch_txn_source", "vendor_id", "source_type", "source_id"),
        Index("ix_batch_txn_created", "vendor_id", "created_at"),
    )


# ── Phase 3: MBR / BPR ────────────────────────────────────────────────────────

class PharmaMbr(Base):
    """Master Batch Record template — versioned recipe + process for a product."""
    __tablename__ = "pharma_mbr"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    code = Column(String(60), nullable=False)
    title = Column(String(255), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    status = Column(String(30), nullable=False, default="draft")  # draft | approved | superseded
    batch_size = Column(Numeric(14, 4), nullable=True)
    batch_size_uom = Column(String(30), nullable=True)
    bom_snapshot = Column(JSONB, nullable=False, default=list)
    operations = Column(JSONB, nullable=False, default=list)
    line_clearance = Column(JSONB, nullable=False, default=list)
    ipc_checks = Column(JSONB, nullable=False, default=list)
    notes = Column(Text, nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    effective_from = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_pharma_mbr_vendor", "vendor_id"),
        Index("ix_pharma_mbr_product", "vendor_id", "product_id"),
        UniqueConstraint("vendor_id", "code", "version", name="uq_pharma_mbr_code_ver"),
    )


class PharmaBpr(Base):
    """Batch Production Record instance for one production order / FG batch."""
    __tablename__ = "pharma_bpr"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    mbr_id = Column(UUID(as_uuid=True), ForeignKey("pharma_mbr.id", ondelete="SET NULL"), nullable=True)
    production_order_id = Column(
        UUID(as_uuid=True), ForeignKey("production_order.id", ondelete="SET NULL"), nullable=True
    )
    goods_batch_id = Column(UUID(as_uuid=True), ForeignKey("goods_batch.id", ondelete="SET NULL"), nullable=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    batch_number = Column(String(80), nullable=False)
    status = Column(String(30), nullable=False, default="open")  # open | in_progress | completed | under_review | closed
    planned_qty = Column(Numeric(14, 4), nullable=True)
    actual_qty = Column(Numeric(14, 4), nullable=True)
    yield_pct = Column(Numeric(8, 2), nullable=True)
    operation_log = Column(JSONB, nullable=False, default=list)
    material_log = Column(JSONB, nullable=False, default=list)
    ipc_results = Column(JSONB, nullable=False, default=list)
    clearance_done = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    pdf_url = Column(String(500), nullable=True)  # archived BPR PDF
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_pharma_bpr_vendor", "vendor_id"),
        Index("ix_pharma_bpr_batch", "vendor_id", "batch_number"),
        Index("ix_pharma_bpr_order", "production_order_id"),
    )


# ── Phase 4: QC ───────────────────────────────────────────────────────────────

class PharmaQcSpec(Base):
    __tablename__ = "pharma_qc_spec"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    code = Column(String(60), nullable=False)
    title = Column(String(255), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    status = Column(String(30), nullable=False, default="draft")  # draft | approved | superseded
    items = Column(JSONB, nullable=False, default=list)  # [{name, method, min, max, uom, required}]
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_pharma_qc_spec_vendor", "vendor_id"),
        UniqueConstraint("vendor_id", "code", "version", name="uq_pharma_qc_spec_code_ver"),
    )


class PharmaInspectionLot(Base):
    __tablename__ = "pharma_inspection_lot"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    goods_batch_id = Column(UUID(as_uuid=True), ForeignKey("goods_batch.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    qc_spec_id = Column(UUID(as_uuid=True), ForeignKey("pharma_qc_spec.id", ondelete="SET NULL"), nullable=True)
    # receipt | production | retest | complaint
    origin = Column(String(30), nullable=False, default="receipt")
    status = Column(String(30), nullable=False, default="open")  # open | testing | pending_release | released | rejected
    sample_qty = Column(Numeric(14, 4), nullable=True)
    results = Column(JSONB, nullable=False, default=list)
    decision = Column(String(30), nullable=True)  # release | reject | retest
    decision_notes = Column(Text, nullable=True)
    decided_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    coa_number = Column(String(60), nullable=True)
    coa_data = Column(JSONB, nullable=False, default=dict)
    # Stage B: OOS investigation
    oos_status = Column(String(20), nullable=True)   # NULL | open | closed
    oos_data = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_pharma_insp_vendor", "vendor_id"),
        Index("ix_pharma_insp_batch", "goods_batch_id"),
        Index("ix_pharma_insp_status", "vendor_id", "status"),
    )


# ── Phase 5: recall ───────────────────────────────────────────────────────────

class PharmaRecall(Base):
    __tablename__ = "pharma_recall"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    goods_batch_id = Column(UUID(as_uuid=True), ForeignKey("goods_batch.id", ondelete="CASCADE"), nullable=False)
    recall_number = Column(String(60), nullable=False)
    reason = Column(Text, nullable=False)
    severity = Column(String(20), nullable=False, default="class_ii")  # class_i | class_ii | class_iii
    status = Column(String(30), nullable=False, default="open")  # open | investigating | notified | closed
    affected_summary = Column(JSONB, nullable=False, default=dict)
    actions = Column(JSONB, nullable=False, default=list)
    created_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_pharma_recall_vendor", "vendor_id"),
        UniqueConstraint("vendor_id", "recall_number", name="uq_pharma_recall_number"),
    )


# ── Phase 6: QMS ──────────────────────────────────────────────────────────────

class PharmaDeviation(Base):
    __tablename__ = "pharma_deviation"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    number = Column(String(60), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, default="open")
    severity = Column(String(20), nullable=False, default="minor")
    goods_batch_id = Column(UUID(as_uuid=True), ForeignKey("goods_batch.id", ondelete="SET NULL"), nullable=True)
    bpr_id = Column(UUID(as_uuid=True), ForeignKey("pharma_bpr.id", ondelete="SET NULL"), nullable=True)
    production_order_id = Column(
        UUID(as_uuid=True), ForeignKey("production_order.id", ondelete="SET NULL"), nullable=True
    )
    linked_capa_id = Column(UUID(as_uuid=True), nullable=True)
    meta = Column(JSONB, nullable=False, default=dict)
    created_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_pharma_dev_vendor", "vendor_id"),
        UniqueConstraint("vendor_id", "number", name="uq_pharma_deviation_number"),
    )


class PharmaCapa(Base):
    __tablename__ = "pharma_capa"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    number = Column(String(60), nullable=False)
    title = Column(String(255), nullable=False)
    root_cause = Column(Text, nullable=True)
    corrective_actions = Column(JSONB, nullable=False, default=list)
    preventive_actions = Column(JSONB, nullable=False, default=list)
    status = Column(String(30), nullable=False, default="open")
    due_date = Column(Date, nullable=True)
    effectiveness_due_date = Column(Date, nullable=True)
    effectiveness_check = Column(Text, nullable=True)
    deviation_id = Column(UUID(as_uuid=True), ForeignKey("pharma_deviation.id", ondelete="SET NULL"), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_pharma_capa_vendor", "vendor_id"),
        UniqueConstraint("vendor_id", "number", name="uq_pharma_capa_number"),
    )


class PharmaChangeControl(Base):
    __tablename__ = "pharma_change_control"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    number = Column(String(60), nullable=False)
    title = Column(String(255), nullable=False)
    change_type = Column(String(40), nullable=False, default="other")  # bom | mbr | spec | process | other
    description = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, default="draft")  # draft | in_review | approved | rejected | implemented
    impact_assessment = Column(Text, nullable=True)
    target_ref = Column(JSONB, nullable=False, default=dict)
    approvals = Column(JSONB, nullable=False, default=list)
    required_approvals = Column(Integer, nullable=False, default=1)
    created_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_pharma_cc_vendor", "vendor_id"),
        UniqueConstraint("vendor_id", "number", name="uq_pharma_cc_number"),
    )


# ── Phase 7a: per-org Track & Trace region overrides ─────────────────────────

TRACK_TRACE_REGIONS = ("none", "us", "eu")


class PharmaOrgRegion(Base):
    """Per-BU / branch / plant Track & Trace region override.

    Resolution order (most-specific wins):
      plant  >  store (branch > BU — whichever is set)  >  vendor default

    Only one of store_id or plant_id should be set per row.
    """
    __tablename__ = "pharma_org_region"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"),
                       nullable=False, index=True)
    store_id = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="CASCADE"),
                      nullable=True)
    plant_id = Column(UUID(as_uuid=True), ForeignKey("plant.id", ondelete="CASCADE"),
                      nullable=True)
    # none | us | eu
    track_trace_region = Column(String(10), nullable=False, default="none")

    __table_args__ = (
        Index("ix_pharma_org_region_vendor", "vendor_id"),
        Index("ix_pharma_org_region_store", "vendor_id", "store_id",
              unique=True, postgresql_where=sa_text("store_id IS NOT NULL")),
        Index("ix_pharma_org_region_plant", "vendor_id", "plant_id",
              unique=True, postgresql_where=sa_text("plant_id IS NOT NULL")),
    )


# ── Phase 7b: scoped approval rules ──────────────────────────────────────────

PHARMA_ACTIONS = (
    "batch_release", "bpr_complete", "capa_close", "cc_approve",
    "deviation_close", "oos_close", "mbr_approve", "qc_result_approve",
)


class PharmaSignerGroup(Base):
    """Named panel of approvers reusable across rules (e.g. 'QA Release Board — Plant 1')."""
    __tablename__ = "pharma_signer_group"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"),
                       nullable=False, index=True)
    code = Column(String(40), nullable=False)
    name = Column(String(120), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("vendor_id", "code", name="uq_pharma_sg_code"),
    )


class PharmaSignerGroupMember(Base):
    """Membership of a VendorUser in a PharmaSignerGroup."""
    __tablename__ = "pharma_signer_group_member"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), ForeignKey("pharma_signer_group.id", ondelete="CASCADE"),
                      nullable=False, index=True)
    vendor_user_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="CASCADE"),
                            nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("group_id", "vendor_user_id", name="uq_pharma_sg_member"),
    )


class PharmaApprovalRule(Base):
    """Scoped approver policy for a GxP action.

    Scope columns are all nullable — NULL means "applies to any value of that dimension".
    A row with all scope columns NULL and is_default=True is the tenant-wide floor.

    Resolution mode is always "strictest-wins": when multiple rules match, the engine
    takes max(required_approvers) and unions mandatory steps across all matching rules.

    overrides_default=True excludes all other matching rules (use for genuine
    downward exceptions backed by a change control reference).
    """
    __tablename__ = "pharma_approval_rule"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"),
                       nullable=False, index=True)

    # batch_release | bpr_complete | capa_close | cc_approve |
    # deviation_close | oos_close | mbr_approve | qc_result_approve
    action = Column(String(40), nullable=False, index=True)

    # ── Scope (NULL = applies to any value of that dimension) ─────────
    product_id       = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="CASCADE"),
                              nullable=True, index=True)
    product_group_id = Column(UUID(as_uuid=True), ForeignKey("product_group.id", ondelete="CASCADE"),
                              nullable=True, index=True)
    plant_id         = Column(UUID(as_uuid=True), ForeignKey("plant.id", ondelete="CASCADE"),
                              nullable=True, index=True)
    store_id         = Column(UUID(as_uuid=True), ForeignKey("store.id", ondelete="CASCADE"),
                              nullable=True, index=True)
    # Track & trace region scope: us | eu | none | NULL (any region)
    region           = Column(String(10), nullable=True, index=True)

    # ── Outcome ───────────────────────────────────────────────────────
    # Total number of distinct signers required (reviewer in slot 1, approvers in 2+)
    required_approvers       = Column(Integer, nullable=False, default=2)
    # True = levels must be completed in order; False = all open in parallel
    sequential               = Column(Boolean, nullable=False, default=False)
    # Initiator (batch creator / deviation opener) may not also sign
    forbid_initiator         = Column(Boolean, nullable=False, default=True)
    # When True, only rules with this flag are considered (bypasses the floor)
    overrides_default        = Column(Boolean, nullable=False, default=False)

    # ── Governance ────────────────────────────────────────────────────
    is_default  = Column(Boolean, nullable=False, default=False)
    is_active   = Column(Boolean, nullable=False, default=True)
    valid_from  = Column(Date, nullable=True)
    valid_to    = Column(Date, nullable=True)
    priority    = Column(Integer, nullable=False, default=100)
    version     = Column(Integer, nullable=False, default=1)
    notes       = Column(Text, nullable=True)
    created_by  = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"),
                         nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_pharma_appr_rule_lookup", "vendor_id", "action", "is_active"),
    )


class PharmaApprovalRuleStep(Base):
    """Defines who may sign at a given level for a PharmaApprovalRule.

    signer_type values:
      user        — a specific VendorUser (vendor_user_id must be set)
      role        — any user with role_slug (e.g. 'qa_manager')
      permission  — any user whose effective permissions include 'permission' string
      signer_group— any member of the referenced PharmaSignerGroup

    min_signatures: quorum within the step (e.g. "any 2 of 5 QA board members").
    level 1 = reviewer/author slot; level >= 2 = approver slots.
    """
    __tablename__ = "pharma_approval_rule_step"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_id = Column(UUID(as_uuid=True), ForeignKey("pharma_approval_rule.id", ondelete="CASCADE"),
                     nullable=False, index=True)
    level = Column(Integer, nullable=False, default=1)

    # user | role | permission | signer_group
    signer_type     = Column(String(20), nullable=False)
    vendor_user_id  = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="CASCADE"),
                             nullable=True)
    role_slug       = Column(String(50), nullable=True)
    permission      = Column(String(80), nullable=True)
    signer_group_id = Column(UUID(as_uuid=True), ForeignKey("pharma_signer_group.id", ondelete="CASCADE"),
                             nullable=True)

    # author | reviewer | approver
    meaning         = Column(String(20), nullable=False, default="approver")
    min_signatures  = Column(Integer, nullable=False, default=1)
    is_mandatory    = Column(Boolean, nullable=False, default=True)

    __table_args__ = (
        Index("ix_pharma_appr_step_rule", "rule_id", "level"),
    )


# ── Phase 7: e-sign / audit ───────────────────────────────────────────────────

class PharmaAuditEvent(Base):
    """Append-only GxP audit trail (no updates/deletes in application layer)."""
    __tablename__ = "pharma_audit_event"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    entity_type = Column(String(60), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    action = Column(String(60), nullable=False)
    # Part 11 meaning-of-signature: author | reviewer | approver (or free-text legacy)
    meaning = Column(String(120), nullable=True)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    actor_name = Column(String(255), nullable=True)
    old_value = Column(JSONB, nullable=True)
    new_value = Column(JSONB, nullable=True)
    signature_hash = Column(String(128), nullable=True)
    ip_address = Column(String(64), nullable=True)
    # True when password (and TOTP if enabled) were verified at sign time
    esign_verified = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_pharma_audit_vendor", "vendor_id"),
        Index("ix_pharma_audit_entity", "vendor_id", "entity_type", "entity_id"),
        Index("ix_pharma_audit_created", "vendor_id", "created_at"),
    )


# ── Phase 8: serialization ────────────────────────────────────────────────────

class PharmaSerialUnit(Base):
    __tablename__ = "pharma_serial_unit"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    goods_batch_id = Column(UUID(as_uuid=True), ForeignKey("goods_batch.id", ondelete="CASCADE"), nullable=False)
    serial_number = Column(String(120), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("pharma_serial_unit.id", ondelete="SET NULL"), nullable=True)
    # unit | pack | case | pallet
    level = Column(String(20), nullable=False, default="unit")
    status = Column(String(30), nullable=False, default="active")  # active | shipped | recalled | destroyed
    meta = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_pharma_serial_vendor", "vendor_id"),
        Index("ix_pharma_serial_batch", "goods_batch_id"),
        UniqueConstraint("vendor_id", "serial_number", name="uq_pharma_serial_number"),
    )


# ── Phase 9: GDP / cold chain ─────────────────────────────────────────────────

class PharmaTempExcursion(Base):
    """Manual (or later sensor) temperature excursion against a SLoc and/or lot."""
    __tablename__ = "pharma_temp_excursion"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    storage_location_id = Column(
        UUID(as_uuid=True), ForeignKey("storage_location.id", ondelete="SET NULL"), nullable=True
    )
    goods_batch_id = Column(
        UUID(as_uuid=True), ForeignKey("goods_batch.id", ondelete="SET NULL"), nullable=True
    )
    recorded_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    temp_c = Column(Numeric(6, 2), nullable=False)
    duration_minutes = Column(Integer, nullable=True)
    # open | investigating | closed
    status = Column(String(30), nullable=False, default="open")
    # minor | major | critical
    severity = Column(String(20), nullable=False, default="minor")
    notes = Column(Text, nullable=True)
    actions = Column(JSONB, nullable=False, default=list)
    created_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    closed_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_pharma_excursion_vendor", "vendor_id"),
        Index("ix_pharma_excursion_batch", "goods_batch_id"),
    )


# ── Phase 10: EPCIS / track & trace ───────────────────────────────────────────

class PharmaEpcisEvent(Base):
    """Simplified EPCIS event store for export (JSON) — not a full GS1 network node."""
    __tablename__ = "pharma_epcis_event"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    # ObjectEvent | AggregationEvent | TransactionEvent
    event_type = Column(String(40), nullable=False, default="ObjectEvent")
    # ADD | OBSERVE | DELETE
    action = Column(String(20), nullable=False, default="ADD")
    # commissioning | packing | shipping | receiving | destroying | recalling
    biz_step = Column(String(40), nullable=False)
    disposition = Column(String(40), nullable=True)  # active | in_transit | destroyed | recalled
    event_time = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    epc_list = Column(JSONB, nullable=False, default=list)  # list of EPC / serial URNs or plain SNs
    parent_epc = Column(String(200), nullable=True)
    child_epcs = Column(JSONB, nullable=False, default=list)
    biz_location = Column(String(120), nullable=True)
    read_point = Column(String(120), nullable=True)
    goods_batch_id = Column(
        UUID(as_uuid=True), ForeignKey("goods_batch.id", ondelete="SET NULL"), nullable=True
    )
    product_id = Column(UUID(as_uuid=True), ForeignKey("product.id", ondelete="SET NULL"), nullable=True)
    gtin = Column(String(14), nullable=True)
    lot_number = Column(String(50), nullable=True)
    source_type = Column(String(40), nullable=True)
    source_id = Column(UUID(as_uuid=True), nullable=True)
    partner_id = Column(
        UUID(as_uuid=True), ForeignKey("pharma_trading_partner.id", ondelete="SET NULL"), nullable=True
    )
    meta = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_pharma_epcis_vendor", "vendor_id"),
        Index("ix_pharma_epcis_time", "vendor_id", "event_time"),
        Index("ix_pharma_epcis_batch", "goods_batch_id"),
    )


class PharmaTradingPartner(Base):
    """Lite trading-partner master for DSCSA verification stubs / license checks."""
    __tablename__ = "pharma_trading_partner"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=False)
    partner_type = Column(String(40), nullable=False, default="wholesaler")  # wholesaler|dispenser|manufacturer
    gln = Column(String(20), nullable=True)
    license_number = Column(String(80), nullable=True)
    license_expires = Column(Date, nullable=True)
    verification_endpoint = Column(String(500), nullable=True)  # optional external URL
    is_active = Column(Boolean, nullable=False, default=True)
    meta = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_pharma_partner_vendor", "vendor_id"),
    )


class PharmaWholesaleLicenseHistory(Base):
    """Audit trail for customer wholesale license changes and checks."""
    __tablename__ = "pharma_wholesale_license_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id", ondelete="CASCADE"), nullable=False)
    # set | updated | cleared | checked
    action = Column(String(30), nullable=False)
    license_number = Column(String(80), nullable=True)
    license_expires = Column(Date, nullable=True)
    previous_license_number = Column(String(80), nullable=True)
    previous_license_expires = Column(Date, nullable=True)
    check_ok = Column(Boolean, nullable=True)
    detail = Column(String(500), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_pharma_wlic_hist_vendor", "vendor_id"),
        Index("ix_pharma_wlic_hist_customer", "vendor_id", "customer_id"),
    )


class PharmaWholesaleLicenseDocument(Base):
    """File attachments for a customer's wholesale license (certificates, scans, etc.)."""
    __tablename__ = "pharma_wholesale_license_document"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id", ondelete="CASCADE"), nullable=False)
    file_url = Column(String(1000), nullable=False)
    filename = Column(String(255), nullable=False)
    content_type = Column(String(120), nullable=True)
    size_bytes = Column(Integer, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_pharma_wlic_doc_vendor", "vendor_id"),
        Index("ix_pharma_wlic_doc_customer", "vendor_id", "customer_id"),
    )


# ── Stage B: complaints ───────────────────────────────────────────────────────

class PharmaComplaint(Base):
    """Customer / adverse-event complaint lifecycle.

    complaint_type: customer | adverse_event | product_defect | packaging
    severity:       minor | major | critical
    status:         open | investigating | closed
    """
    __tablename__ = "pharma_complaint"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False)
    number = Column(String(60), nullable=False)  # e.g. COMP-20260001
    complaint_type = Column(String(30), nullable=False, default="customer")
    severity = Column(String(20), nullable=False, default="minor")
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    goods_batch_id = Column(UUID(as_uuid=True), ForeignKey("goods_batch.id", ondelete="SET NULL"), nullable=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customer.id", ondelete="SET NULL"), nullable=True)
    reported_by = Column(String(255), nullable=True)
    status = Column(String(30), nullable=False, default="open")
    investigation_notes = Column(Text, nullable=True)
    disposition = Column(String(255), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("vendor_user.id", ondelete="SET NULL"), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_pharma_complaint_vendor", "vendor_id"),
        Index("ix_pharma_complaint_status", "vendor_id", "status"),
        Index("ix_pharma_complaint_customer", "customer_id"),
        UniqueConstraint("vendor_id", "number", name="uq_pharma_complaint_number"),
    )
