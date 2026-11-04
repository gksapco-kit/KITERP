"""Real Estate — Phase 4 models, part 2: procurement (module 10) and material & inventory (module 11)."""
from __future__ import annotations

from sqlalchemy import Boolean, Column, Date, Integer, Text, UniqueConstraint

from .base import REMixin, Base, UUID, choice, fk, money, pct, qty, txt
from .core import PAYMENT_MODES

SUPPLIER_STATUSES = ["active", "pending", "blocked"]
PR_STATUSES = ["draft", "submitted", "approved", "rejected", "ordered", "closed"]
RFQ_STATUSES = ["draft", "sent", "awarded", "cancelled"]
PO_STATUSES = ["draft", "pending_approval", "approved", "partially_received", "received", "closed", "cancelled"]
GRN_STATUSES = ["draft", "posted", "cancelled"]
PAY_STATUSES = ["unpaid", "paid"]
DOC_STATUSES = ["draft", "posted", "cancelled"]
STOCK_TXN_TYPES = ["grn", "issue", "transfer_in", "transfer_out", "wastage", "adjustment", "return"]
MATERIAL_CATEGORIES = [
    "cement", "steel", "aggregates", "bricks_blocks", "sand", "timber", "electrical", "plumbing", "tiles_flooring",
    "paint", "hardware", "consumables", "equipment", "other",
]
WASTAGE_REASONS = ["breakage", "spoilage", "theft", "excess_cutting", "weather", "expired", "other"]


class ReSupplier(REMixin, Base):
    __tablename__ = "re_supplier"

    code = txt(30, index=True)
    name = txt(255, nullable=False)
    status = choice(SUPPLIER_STATUSES, "active", 15)
    contact_person = txt(160)
    phone = txt(30)
    email = txt(255)
    address = txt(500)
    gstin = txt(15)
    pan = txt(10)
    payment_terms_days = Column(Integer, nullable=False, default=30)
    rating = Column(Integer)
    bank_name = txt(120)
    account_number = txt(40)
    ifsc = txt(15)
    categories = txt(255)
    notes = Column(Text)


class ReMaterial(REMixin, Base):
    __tablename__ = "re_material"

    code = txt(30, index=True)
    name = txt(255, nullable=False)
    category = choice(MATERIAL_CATEGORIES, "other", 30)
    unit = txt(20, nullable=False, default="nos")
    hsn_code = txt(10)
    gst_percent = pct(18)
    standard_rate = money(0)
    reorder_level = qty(0)
    is_active = Column(Boolean, nullable=False, default=True)
    description = Column(Text)


class ReSiteStore(REMixin, Base):
    __tablename__ = "re_site_store"

    code = txt(30, index=True)
    name = txt(255, nullable=False)
    project_id = fk("re_project")
    in_charge = txt(160)
    location = txt(255)
    is_active = Column(Boolean, nullable=False, default=True)


# ── requisition → RFQ → PO ──────────────────────────────────────────────────────────────────

class RePurchaseRequisition(REMixin, Base):
    __tablename__ = "re_purchase_requisition"
    __table_args__ = (UniqueConstraint("vendor_id", "pr_no", name="uq_re_pr_no"),)

    pr_no = txt(30, nullable=False)
    project_id = fk("re_project", nullable=False, ondelete="CASCADE")
    store_id = fk("re_site_store")
    requested_by_name = txt(160)
    required_by = Column(Date)
    status = choice(PR_STATUSES, "draft", 15)
    remarks = Column(Text)
    decided_by_name = txt(160)


class RePrLine(REMixin, Base):
    __tablename__ = "re_pr_line"

    pr_id = fk("re_purchase_requisition", nullable=False, ondelete="CASCADE")
    material_id = fk("re_material", nullable=False, ondelete="RESTRICT")
    quantity = qty(0, nullable=False)
    ordered_quantity = qty(0)
    remarks = txt(255)


class ReRfq(REMixin, Base):
    __tablename__ = "re_rfq"
    __table_args__ = (UniqueConstraint("vendor_id", "rfq_no", name="uq_re_rfq_no"),)

    rfq_no = txt(30, nullable=False)
    pr_id = fk("re_purchase_requisition", nullable=False, ondelete="CASCADE")
    project_id = fk("re_project")
    due_date = Column(Date)
    status = choice(RFQ_STATUSES, "draft", 15)
    awarded_supplier_id = fk("re_supplier")
    po_id = Column(UUID(as_uuid=True), nullable=True)
    terms = Column(Text)


class ReRfqQuote(REMixin, Base):
    __tablename__ = "re_rfq_quote"
    __table_args__ = (UniqueConstraint("rfq_id", "supplier_id", "pr_line_id", name="uq_re_rfq_quote"),)

    rfq_id = fk("re_rfq", nullable=False, ondelete="CASCADE")
    supplier_id = fk("re_supplier", nullable=False, ondelete="RESTRICT")
    pr_line_id = fk("re_pr_line", nullable=False, ondelete="CASCADE")
    rate = money(0, nullable=False)
    gst_percent = pct(18)
    lead_days = Column(Integer, nullable=False, default=0)
    remarks = txt(255)


class RePurchaseOrder(REMixin, Base):
    __tablename__ = "re_purchase_order"
    __table_args__ = (UniqueConstraint("vendor_id", "po_no", name="uq_re_po_no"),)

    po_no = txt(30, nullable=False)
    project_id = fk("re_project", nullable=False, ondelete="CASCADE")
    supplier_id = fk("re_supplier", nullable=False, ondelete="RESTRICT")
    store_id = fk("re_site_store")
    pr_id = fk("re_purchase_requisition")
    rfq_id = Column(UUID(as_uuid=True), nullable=True)
    order_date = Column(Date, nullable=False)
    expected_date = Column(Date)
    status = choice(PO_STATUSES, "draft", 20)
    subtotal = money(0)
    gst_amount = money(0)
    total_amount = money(0)
    approval_request_id = Column(UUID(as_uuid=True), nullable=True)
    payment_terms = txt(255)
    terms = Column(Text)


class RePoLine(REMixin, Base):
    __tablename__ = "re_po_line"

    po_id = fk("re_purchase_order", nullable=False, ondelete="CASCADE")
    material_id = fk("re_material", nullable=False, ondelete="RESTRICT")
    pr_line_id = Column(UUID(as_uuid=True), nullable=True)
    quantity = qty(0, nullable=False)
    rate = money(0, nullable=False)
    gst_percent = pct(18)
    amount = money(0)  # quantity x rate (before GST)
    received_quantity = qty(0)
    remarks = txt(255)


# ── receipts & stock ────────────────────────────────────────────────────────────────────────

class ReGrn(REMixin, Base):
    __tablename__ = "re_grn"
    __table_args__ = (UniqueConstraint("vendor_id", "grn_no", name="uq_re_grn_no"),)

    grn_no = txt(30, nullable=False)
    po_id = fk("re_purchase_order", nullable=False, ondelete="RESTRICT")
    supplier_id = fk("re_supplier")
    store_id = fk("re_site_store", nullable=False, ondelete="RESTRICT")
    project_id = fk("re_project")
    received_on = Column(Date, nullable=False)
    challan_no = txt(60)
    invoice_no = txt(60)
    vehicle_no = txt(30)
    status = choice(GRN_STATUSES, "draft", 15)
    total_value = money(0)
    gst_amount = money(0)
    payable_amount = money(0)
    payment_status = choice(PAY_STATUSES, "unpaid", 15)
    paid_on = Column(Date)
    payment_mode = choice(PAYMENT_MODES, "neft", 20, index=False)
    payment_reference = txt(80)
    gl_entry_id = Column(UUID(as_uuid=True), nullable=True)
    remarks = Column(Text)


class ReGrnLine(REMixin, Base):
    __tablename__ = "re_grn_line"

    grn_id = fk("re_grn", nullable=False, ondelete="CASCADE")
    po_line_id = fk("re_po_line", nullable=False, ondelete="RESTRICT")
    material_id = fk("re_material", nullable=False, ondelete="RESTRICT")
    received_quantity = qty(0, nullable=False)
    accepted_quantity = qty(0, nullable=False)
    rejected_quantity = qty(0)
    rate = money(0)
    amount = money(0)  # accepted x rate
    remarks = txt(255)


class ReStockBalance(REMixin, Base):
    __tablename__ = "re_stock_balance"
    __table_args__ = (UniqueConstraint("store_id", "material_id", name="uq_re_stock_balance"),)

    store_id = fk("re_site_store", nullable=False, ondelete="CASCADE")
    material_id = fk("re_material", nullable=False, ondelete="CASCADE")
    quantity = qty(0, nullable=False)
    avg_rate = money(0)
    value = money(0)


class ReStockLedger(REMixin, Base):
    __tablename__ = "re_stock_ledger"

    store_id = fk("re_site_store", nullable=False, ondelete="CASCADE")
    material_id = fk("re_material", nullable=False, ondelete="CASCADE")
    txn_date = Column(Date, nullable=False)
    txn_type = choice(STOCK_TXN_TYPES, "grn", 20)
    quantity = qty(0, nullable=False)  # signed: + in, - out
    rate = money(0)
    value = money(0)  # signed
    balance_quantity = qty(0)
    balance_value = money(0)
    reference_type = txt(30)
    reference_id = Column(UUID(as_uuid=True), nullable=True)
    reference_no = txt(60)
    remarks = txt(255)


class ReMaterialIssue(REMixin, Base):
    __tablename__ = "re_material_issue"
    __table_args__ = (UniqueConstraint("vendor_id", "issue_no", name="uq_re_issue_no"),)

    issue_no = txt(30, nullable=False)
    project_id = fk("re_project", nullable=False, ondelete="CASCADE")
    store_id = fk("re_site_store", nullable=False, ondelete="RESTRICT")
    issued_on = Column(Date, nullable=False)
    issued_to = txt(160)
    contractor_id = fk("re_contractor")
    wbs_task_id = fk("re_wbs_task")
    boq_item_id = fk("re_boq_item")
    status = choice(DOC_STATUSES, "draft", 15)
    total_value = money(0)
    remarks = Column(Text)


class ReIssueLine(REMixin, Base):
    __tablename__ = "re_issue_line"

    issue_id = fk("re_material_issue", nullable=False, ondelete="CASCADE")
    material_id = fk("re_material", nullable=False, ondelete="RESTRICT")
    quantity = qty(0, nullable=False)
    rate = money(0)
    amount = money(0)
    remarks = txt(255)


class ReStockTransfer(REMixin, Base):
    __tablename__ = "re_stock_transfer"
    __table_args__ = (UniqueConstraint("vendor_id", "transfer_no", name="uq_re_transfer_no"),)

    transfer_no = txt(30, nullable=False)
    from_store_id = fk("re_site_store", nullable=False, ondelete="RESTRICT")
    to_store_id = fk("re_site_store", nullable=False, ondelete="RESTRICT")
    transfer_date = Column(Date, nullable=False)
    status = choice(DOC_STATUSES, "draft", 15)
    total_value = money(0)
    remarks = Column(Text)


class ReTransferLine(REMixin, Base):
    __tablename__ = "re_transfer_line"

    transfer_id = fk("re_stock_transfer", nullable=False, ondelete="CASCADE")
    material_id = fk("re_material", nullable=False, ondelete="RESTRICT")
    quantity = qty(0, nullable=False)
    rate = money(0)
    amount = money(0)


class ReWastage(REMixin, Base):
    __tablename__ = "re_wastage"

    store_id = fk("re_site_store", nullable=False, ondelete="RESTRICT")
    material_id = fk("re_material", nullable=False, ondelete="RESTRICT")
    project_id = fk("re_project")
    wastage_date = Column(Date, nullable=False)
    quantity = qty(0, nullable=False)
    rate = money(0)
    value = money(0)
    reason = choice(WASTAGE_REASONS, "other", 20)
    remarks = txt(500)
    status = choice(["posted", "reversed"], "posted", 15)
