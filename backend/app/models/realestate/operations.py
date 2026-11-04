"""Real Estate — Phase 6 models: leasing & rentals (7), facility (19), society (20) and asset management (21)."""
from __future__ import annotations

from datetime import date

from sqlalchemy import Boolean, Column, Date, DateTime, Integer, Numeric, Text, UniqueConstraint

from .base import Base, REMixin, choice, fk, money, now_utc, qty, txt

# ── leasing ──────────────────────────────────────────────────────────────────────────────
TENANT_TYPES = ["individual", "company", "partnership", "proprietorship", "trust", "other"]
LEASE_STATUSES = ["draft", "active", "expired", "terminated", "renewed"]
LEASE_USES = ["residential", "commercial", "retail", "office", "industrial", "other"]
DEPOSIT_STATUSES = ["pending", "held", "refunded", "transferred"]
RENT_INVOICE_STATUSES = ["issued", "partial", "paid", "cancelled"]
RENT_PAYMENT_MODES = ["cash", "cheque", "neft", "rtgs", "imps", "upi", "card", "online", "adjustment"]
COMMERCIAL_GST_RATE = 18  # commercial letting attracts GST; residential letting is exempt

# ── facility ─────────────────────────────────────────────────────────────────────────────
FWO_CATEGORIES = ["plumbing", "electrical", "hvac", "lift", "civil", "cleaning", "gardening", "pest_control", "security", "it", "other"]
FWO_PRIORITIES = ["low", "medium", "high", "urgent"]
FWO_STATUSES = ["open", "assigned", "in_progress", "completed", "closed", "cancelled"]
UTILITY_TYPES = ["electricity", "water", "gas", "dg_power", "other"]
HK_STATUSES = ["scheduled", "done", "missed"]
SECURITY_LOG_TYPES = ["patrol", "gate_entry", "incident", "alarm", "key_handover", "other"]

# ── society ──────────────────────────────────────────────────────────────────────────────
RESIDENT_TYPES = ["owner", "tenant", "family", "other"]
RESIDENT_STATUSES = ["active", "moved_out"]
MAINT_BASES = ["per_sqft", "flat"]
MAINT_FREQUENCIES = ["monthly", "quarterly"]
MAINT_BILL_STATUSES = ["issued", "partial", "paid", "cancelled"]
VISITOR_STATUSES = ["expected", "checked_in", "checked_out", "denied"]
NOTICE_CATEGORIES = ["general", "maintenance", "event", "emergency", "rules"]
OCCUPIED_UNIT_STATUSES = ("handed_over", "leased")

# ── assets ───────────────────────────────────────────────────────────────────────────────
ASSET_CATEGORIES = ["lift", "dg_set", "pump", "hvac", "fire_system", "cctv", "electrical", "plumbing", "furniture", "vehicle", "it", "other"]
ASSET_STATUSES = ["active", "under_maintenance", "disposed"]
DEPRECIATION_METHODS = ["straight_line", "wdv"]
ASSET_MAINT_KINDS = ["preventive", "breakdown", "amc", "calibration", "inspection"]
TRANSFER_STATUSES = ["pending", "completed", "cancelled"]
DISPOSAL_METHODS = ["sale", "scrap", "donation", "write_off"]


class ReTenant(REMixin, Base):
    __tablename__ = "re_tenant"

    tenant_code = txt(30, index=True)
    tenant_type = choice(TENANT_TYPES, "individual", 20)
    name = txt(255, nullable=False)
    contact_person = txt(160)
    phone = txt(30, index=True)
    email = txt(255)
    pan = txt(10)
    gstin = txt(15)
    address = txt(500)
    business = txt(160)
    kyc_status = choice(["pending", "submitted", "verified", "rejected"], "pending", 20)
    customer_id = fk("re_customer")
    is_active = Column(Boolean, nullable=False, default=True)
    notes = Column(Text)


class ReLease(REMixin, Base):
    __tablename__ = "re_lease"
    __table_args__ = (UniqueConstraint("vendor_id", "lease_no", name="uq_re_lease_no"),)

    lease_no = txt(30, nullable=False)
    project_id = fk("re_project")
    unit_id = fk("re_unit", nullable=False, ondelete="RESTRICT")
    tenant_id = fk("re_tenant", nullable=False, ondelete="RESTRICT")
    status = choice(LEASE_STATUSES, "draft", 15)
    use_type = choice(LEASE_USES, "residential", 20)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    rent_amount = money(nullable=False)                      # monthly base rent at start
    maintenance_charge = money(default=0)                    # monthly CAM / maintenance billed with the rent
    security_deposit = money(default=0)
    deposit_received = money(default=0)
    deposit_deductions = money(default=0)
    deposit_refunded = money(default=0)
    deposit_status = choice(DEPOSIT_STATUSES, "pending", 15)
    rent_due_day = Column(Integer, nullable=False, default=5)  # rent is due in advance on this day of each month
    escalation_percent = Column(Numeric(6, 2), default=0)
    escalation_every_months = Column(Integer, nullable=False, default=12)
    gst_rate = Column(Numeric(5, 2), default=0)
    lock_in_months = Column(Integer, nullable=False, default=0)
    notice_period_days = Column(Integer, nullable=False, default=30)
    renewed_from_id = fk("re_lease")
    activated_on = Column(Date)
    terminated_on = Column(Date)
    termination_reason = txt(500)
    notes = Column(Text)


class ReLeaseEscalation(REMixin, Base):
    """Rent step-ups scheduled when a lease is activated; ``applied`` flips once an invoice uses the new rent."""

    __tablename__ = "re_lease_escalation"

    lease_id = fk("re_lease", nullable=False, ondelete="CASCADE")
    effective_on = Column(Date, nullable=False)
    percent = Column(Numeric(6, 2), default=0)
    old_rent = money()
    new_rent = money()
    status = choice(["scheduled", "applied", "cancelled"], "scheduled", 15)


class ReRentInvoice(REMixin, Base):
    __tablename__ = "re_rent_invoice"
    __table_args__ = (UniqueConstraint("lease_id", "period_start", name="uq_re_rent_invoice_period"),
                      UniqueConstraint("vendor_id", "invoice_no", name="uq_re_rent_invoice_no"))

    invoice_no = txt(30, nullable=False)
    lease_id = fk("re_lease", nullable=False, ondelete="CASCADE")
    tenant_id = fk("re_tenant", ondelete="RESTRICT")
    unit_id = fk("re_unit")
    project_id = fk("re_project")
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    days_billed = Column(Integer)
    days_in_month = Column(Integer)
    rent_amount = money()
    maintenance_amount = money(default=0)
    gst_amount = money(default=0)
    total_amount = money(nullable=False)
    paid_amount = money(default=0)
    status = choice(RENT_INVOICE_STATUSES, "issued", 15)


class ReOpsReceipt(REMixin, Base):
    """Money received against a rent invoice or a society maintenance bill."""

    __tablename__ = "re_ops_receipt"
    __table_args__ = (UniqueConstraint("vendor_id", "receipt_no", name="uq_re_ops_receipt_no"),)

    receipt_no = txt(30, nullable=False)
    kind = choice(["rent", "maintenance"], "rent", 15)
    rent_invoice_id = fk("re_rent_invoice", ondelete="CASCADE")
    maintenance_bill_id = fk("re_maintenance_bill", ondelete="CASCADE")
    amount = money(nullable=False)
    paid_on = Column(Date, nullable=False, default=date.today)
    mode = choice(RENT_PAYMENT_MODES, "neft", 15)
    reference = txt(120)
    notes = txt(255)


# ── facility ─────────────────────────────────────────────────────────────────────────────

class RePmSchedule(REMixin, Base):
    __tablename__ = "re_pm_schedule"

    name = txt(160, nullable=False)
    project_id = fk("re_project")
    asset_id = fk("re_asset")
    unit_id = fk("re_unit")
    category = choice(FWO_CATEGORIES, "other", 20)
    frequency_days = Column(Integer, nullable=False, default=30)
    next_due_on = Column(Date, nullable=False)
    last_done_on = Column(Date)
    assigned_to = txt(160)
    checklist = Column(Text)
    is_active = Column(Boolean, nullable=False, default=True)


class ReFacilityWorkOrder(REMixin, Base):
    __tablename__ = "re_facility_work_order"
    __table_args__ = (UniqueConstraint("vendor_id", "wo_no", name="uq_re_fwo_no"),)

    wo_no = txt(30, nullable=False)
    project_id = fk("re_project")
    unit_id = fk("re_unit")
    asset_id = fk("re_asset")
    pm_schedule_id = fk("re_pm_schedule")
    category = choice(FWO_CATEGORIES, "other", 20)
    priority = choice(FWO_PRIORITIES, "medium", 10)
    title = txt(255, nullable=False)
    description = Column(Text)
    status = choice(FWO_STATUSES, "open", 15)
    reported_by = txt(160)
    assigned_to = txt(160)
    contractor_id = fk("re_contractor")
    requested_on = Column(Date, nullable=False, default=date.today)
    due_date = Column(Date)
    started_on = Column(Date)
    completed_on = Column(Date)
    labour_cost = money(default=0)
    material_cost = money(default=0)
    total_cost = money(default=0)
    resolution = Column(Text)


class ReUtilityMeter(REMixin, Base):
    __tablename__ = "re_utility_meter"
    __table_args__ = (UniqueConstraint("vendor_id", "meter_no", name="uq_re_meter_no"),)

    meter_no = txt(40, nullable=False)
    project_id = fk("re_project")
    unit_id = fk("re_unit")
    utility_type = choice(UTILITY_TYPES, "electricity", 20)
    name = txt(160)
    unit_of_measure = txt(15, default="kWh")
    rate_per_unit = money(default=0)
    multiplier = Column(Numeric(10, 3), nullable=False, default=1)
    opening_reading = qty(default=0)
    last_reading = qty(default=0)
    last_reading_on = Column(Date)
    is_active = Column(Boolean, nullable=False, default=True)


class ReMeterReading(REMixin, Base):
    __tablename__ = "re_meter_reading"
    __table_args__ = (UniqueConstraint("meter_id", "reading_on", name="uq_re_meter_reading_day"),)

    meter_id = fk("re_utility_meter", nullable=False, ondelete="CASCADE")
    unit_id = fk("re_unit")
    reading_on = Column(Date, nullable=False)
    reading = qty(nullable=False)
    previous_reading = qty(default=0)
    is_reset = Column(Boolean, nullable=False, default=False)  # meter replaced / rolled over: consumption counts from zero
    consumption = qty(default=0)
    amount = money(default=0)
    billed = Column(Boolean, nullable=False, default=False)
    billed_bill_id = fk("re_maintenance_bill")
    read_by = txt(160)


class ReHousekeepingLog(REMixin, Base):
    __tablename__ = "re_housekeeping_log"

    project_id = fk("re_project")
    area = txt(160, nullable=False)
    task = txt(255, nullable=False)
    scheduled_on = Column(Date, nullable=False, default=date.today)
    status = choice(HK_STATUSES, "scheduled", 15)
    assigned_to = txt(160)
    completed_on = Column(Date)
    checked_by = txt(160)
    rating = Column(Integer)
    remarks = txt(500)


class ReSecurityLog(REMixin, Base):
    __tablename__ = "re_security_log"

    project_id = fk("re_project")
    log_type = choice(SECURITY_LOG_TYPES, "patrol", 20)
    occurred_at = Column(DateTime(timezone=True), nullable=False, default=now_utc)
    guard_name = txt(160)
    location = txt(160)
    details = Column(Text, nullable=False)
    severity = choice(["info", "warning", "critical"], "info", 10)
    resolved = Column(Boolean, nullable=False, default=True)
    action_taken = txt(500)


# ── society ──────────────────────────────────────────────────────────────────────────────

class ReResident(REMixin, Base):
    __tablename__ = "re_resident"

    project_id = fk("re_project")
    unit_id = fk("re_unit", nullable=False, ondelete="RESTRICT")
    name = txt(255, nullable=False)
    resident_type = choice(RESIDENT_TYPES, "owner", 15)
    phone = txt(30, index=True)
    email = txt(255)
    is_primary = Column(Boolean, nullable=False, default=False)
    customer_id = fk("re_customer")
    tenant_id = fk("re_tenant")
    moved_in_on = Column(Date)
    moved_out_on = Column(Date)
    status = choice(RESIDENT_STATUSES, "active", 15)
    vehicle_numbers = txt(255)
    emergency_contact = txt(255)


class ReMaintenancePlan(REMixin, Base):
    __tablename__ = "re_maintenance_plan"

    project_id = fk("re_project", nullable=False, ondelete="CASCADE")
    name = txt(160, nullable=False)
    basis = choice(MAINT_BASES, "per_sqft", 15)
    rate = money(nullable=False)                            # per sq ft per month, or flat per unit per month
    sinking_fund_rate = money(default=0)                    # same basis as `rate`
    frequency = choice(MAINT_FREQUENCIES, "monthly", 15)
    due_day = Column(Integer, nullable=False, default=10)
    gst_rate = Column(Numeric(5, 2), default=0)
    effective_from = Column(Date)
    is_active = Column(Boolean, nullable=False, default=True)


class ReMaintenanceBill(REMixin, Base):
    __tablename__ = "re_maintenance_bill"
    __table_args__ = (UniqueConstraint("plan_id", "unit_id", "period_start", name="uq_re_maint_bill_period"),
                      UniqueConstraint("vendor_id", "bill_no", name="uq_re_maint_bill_no"))

    bill_no = txt(30, nullable=False)
    plan_id = fk("re_maintenance_plan", nullable=False, ondelete="CASCADE")
    project_id = fk("re_project")
    unit_id = fk("re_unit", nullable=False, ondelete="RESTRICT")
    resident_id = fk("re_resident")
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    area = qty(default=0)
    maintenance_amount = money(default=0)
    sinking_fund = money(default=0)
    utility_amount = money(default=0)
    gst_amount = money(default=0)
    total_amount = money(nullable=False)
    paid_amount = money(default=0)
    status = choice(MAINT_BILL_STATUSES, "issued", 15)


class ReVisitor(REMixin, Base):
    __tablename__ = "re_visitor"
    __table_args__ = (UniqueConstraint("vendor_id", "pass_no", name="uq_re_visitor_pass"),)

    pass_no = txt(30, nullable=False)
    project_id = fk("re_project")
    unit_id = fk("re_unit")
    resident_id = fk("re_resident")
    visitor_name = txt(160, nullable=False)
    phone = txt(30)
    purpose = txt(160)
    vehicle_no = txt(30)
    expected_on = Column(Date, nullable=False, default=date.today)
    status = choice(VISITOR_STATUSES, "expected", 15)
    check_in_at = Column(DateTime(timezone=True))
    check_out_at = Column(DateTime(timezone=True))
    remarks = txt(255)


class ReNotice(REMixin, Base):
    __tablename__ = "re_notice"

    project_id = fk("re_project")
    title = txt(255, nullable=False)
    body = Column(Text, nullable=False)
    category = choice(NOTICE_CATEGORIES, "general", 15)
    posted_on = Column(Date)
    valid_until = Column(Date)
    is_published = Column(Boolean, nullable=False, default=False)


# ── assets ───────────────────────────────────────────────────────────────────────────────

class ReAsset(REMixin, Base):
    __tablename__ = "re_asset"
    __table_args__ = (UniqueConstraint("vendor_id", "asset_code", name="uq_re_asset_code"),)

    asset_code = txt(30, nullable=False)
    name = txt(255, nullable=False)
    category = choice(ASSET_CATEGORIES, "other", 20)
    project_id = fk("re_project")
    location = txt(160)
    make = txt(120)
    model_no = txt(120)
    serial_no = txt(120)
    purchase_date = Column(Date)
    purchase_cost = money(default=0)
    warranty_until = Column(Date)
    useful_life_years = Column(Integer, nullable=False, default=10)
    salvage_value = money(default=0)
    depreciation_method = choice(DEPRECIATION_METHODS, "straight_line", 20)
    depreciation_rate = Column(Numeric(6, 2), default=0)       # % per year, written-down-value method
    status = choice(ASSET_STATUSES, "active", 20)
    amc_vendor = txt(160)
    amc_until = Column(Date)
    last_maintenance_on = Column(Date)
    next_maintenance_on = Column(Date)
    disposed_on = Column(Date)


class ReAssetMaintenance(REMixin, Base):
    __tablename__ = "re_asset_maintenance"

    asset_id = fk("re_asset", nullable=False, ondelete="CASCADE")
    kind = choice(ASSET_MAINT_KINDS, "preventive", 20)
    performed_on = Column(Date, nullable=False, default=date.today)
    performed_by = txt(160)
    cost = money(default=0)
    description = Column(Text)
    next_due_on = Column(Date)


class ReAssetTransfer(REMixin, Base):
    __tablename__ = "re_asset_transfer"

    asset_id = fk("re_asset", nullable=False, ondelete="CASCADE")
    from_project_id = fk("re_project")
    to_project_id = fk("re_project")
    from_location = txt(160)
    to_location = txt(160)
    transfer_date = Column(Date, nullable=False, default=date.today)
    reason = txt(255)
    status = choice(TRANSFER_STATUSES, "pending", 15)
    completed_on = Column(Date)


class ReAssetDisposal(REMixin, Base):
    __tablename__ = "re_asset_disposal"

    asset_id = fk("re_asset", nullable=False, ondelete="CASCADE")
    disposal_date = Column(Date, nullable=False, default=date.today)
    method = choice(DISPOSAL_METHODS, "sale", 15)
    proceeds = money(default=0)
    book_value = money(default=0)
    gain_loss = money(default=0)
    buyer = txt(160)
    reason = txt(255)
