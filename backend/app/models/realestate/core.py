"""Real Estate — Phase 1 models.

Modules 1 (Property), 3 (Sales & CRM), 4 (Booking & Allotment), 5 (Customer) and the
broker / payment-plan masters they reference.
"""
from __future__ import annotations

from sqlalchemy import Boolean, Column, Date, DateTime, Integer, Numeric, Text, UniqueConstraint

from .base import REMixin, Base, JSONB, UUID, choice, fk, jsonb_dict, jsonb_list, money, pct, qty, txt

# ── choice lists (also drive the form dropdowns in the UI) ─────────────────────────────────
PROJECT_TYPES = ["residential", "commercial", "mixed_use", "plotted", "villa", "township"]
PROJECT_STATUSES = ["planning", "pre_launch", "launched", "under_construction", "completed", "on_hold"]
UNIT_CATEGORIES = ["apartment", "villa", "plot", "shop", "office", "penthouse", "studio", "parking"]
UNIT_STATUSES = [
    "available", "blocked", "booked", "sold", "hold", "landowner_share", "mortgaged", "handed_over", "leased",
]
FACINGS = ["north", "south", "east", "west", "north_east", "north_west", "south_east", "south_west", "corner"]
LEAD_SOURCES = [
    "walk_in", "website", "facebook", "instagram", "google_ads", "newspaper", "hoarding", "referral",
    "broker", "portal", "exhibition", "cold_call", "other",
]
PIPELINE_STAGES = [
    "new", "contacted", "qualified", "site_visit_scheduled", "site_visited", "negotiation", "booked", "lost",
]
ENQUIRY_CHANNELS = ["walk_in", "phone", "website", "email", "whatsapp", "portal", "social", "other"]
VISIT_STATUSES = ["scheduled", "completed", "cancelled", "no_show", "rescheduled"]
QUOTATION_STATUSES = ["draft", "sent", "accepted", "rejected", "expired", "converted"]
FOLLOWUP_TYPES = ["call", "whatsapp", "email", "site_visit", "meeting", "payment_reminder", "other"]
FOLLOWUP_STATUSES = ["pending", "done", "missed", "cancelled"]
BOOKING_STATUSES = [
    "draft", "pending_approval", "confirmed", "allotted", "agreement_signed", "registered",
    "handed_over", "cancelled",
]
BLOCK_STATUSES = ["active", "released", "expired", "converted"]
CANCELLATION_STATUSES = ["requested", "approved", "rejected", "refund_pending", "completed"]
REFUND_STATUSES = ["pending", "approved", "paid", "rejected"]
PAYMENT_MODES = ["cheque", "dd", "neft", "rtgs", "imps", "upi", "card", "cash", "online", "home_loan", "adjustment"]
KYC_STATUSES = ["pending", "submitted", "verified", "rejected", "expired"]
CUSTOMER_TYPES = ["individual", "company", "huf", "nri", "partnership", "trust"]
AGREEMENT_TYPES = [
    "booking_form", "agreement_for_sale", "sale_deed", "lease_agreement", "lease_deed", "builder_buyer",
    "conveyance_deed", "power_of_attorney", "nomination", "other",
]
AGREEMENT_STATUSES = ["draft", "sent", "signed", "registered", "cancelled", "expired"]
COMM_CHANNELS = ["email", "sms", "whatsapp", "call", "in_person", "letter", "portal"]
BROKER_TYPES = ["individual", "firm", "company"]
BROKER_STATUSES = ["active", "inactive", "blacklisted", "pending"]
PLAN_TYPES = ["clp", "tlp", "down_payment", "subvention", "flexi", "custom"]
TRIGGER_TYPES = ["on_booking", "days_after_booking", "milestone", "fixed_date", "on_agreement", "on_registration", "on_possession"]


# ═══ Module 1 — Property Management ═══════════════════════════════════════════════════════

class ReProject(REMixin, Base):
    __tablename__ = "re_project"
    __table_args__ = (UniqueConstraint("vendor_id", "code", name="uq_re_project_code"),)

    code = txt(30, nullable=False)
    name = txt(255, nullable=False)
    project_type = choice(PROJECT_TYPES, "residential", 30)
    status = choice(PROJECT_STATUSES, "planning", 30)
    description = Column(Text)
    address = txt(500)
    city = txt(100)
    state = txt(100)
    pincode = txt(12)
    latitude = Column(Numeric(10, 7))
    longitude = Column(Numeric(10, 7))
    rera_number = txt(80)
    rera_valid_till = Column(Date)
    launch_date = Column(Date)
    possession_date = Column(Date)
    land_area_sqft = qty()
    total_units = Column(Integer, default=0)
    developer_entity = txt(255)
    gst_rate = pct(5)
    is_affordable = Column(Boolean, nullable=False, default=False)
    delay_interest_rate = pct(10.5)
    stamp_duty_pct = pct(5)
    registration_fee_pct = pct(1)
    company_id = fk("fin_company")
    store_id = fk("store")
    cover_image_url = txt(1000)
    gallery = jsonb_list()
    amenities = jsonb_list()
    is_active = Column(Boolean, nullable=False, default=True)


class RePhase(REMixin, Base):
    __tablename__ = "re_phase"

    project_id = fk("re_project", nullable=False, ondelete="CASCADE")
    name = txt(120, nullable=False)
    status = choice(PROJECT_STATUSES, "planning", 30)
    start_date = Column(Date)
    end_date = Column(Date)
    rera_number = txt(80)


class ReTower(REMixin, Base):
    __tablename__ = "re_tower"

    project_id = fk("re_project", nullable=False, ondelete="CASCADE")
    phase_id = fk("re_phase")
    name = txt(120, nullable=False)
    total_floors = Column(Integer, default=0)
    units_per_floor = Column(Integer, default=0)
    status = choice(PROJECT_STATUSES, "planning", 30)
    completion_percent = pct(0)


class ReUnitType(REMixin, Base):
    """Configuration such as 2BHK-A (areas, default rate) used to bulk-generate units."""

    __tablename__ = "re_unit_type"

    project_id = fk("re_project", nullable=False, ondelete="CASCADE")
    name = txt(120, nullable=False)
    category = choice(UNIT_CATEGORIES, "apartment", 30)
    bedrooms = Column(Integer, default=0)
    bathrooms = Column(Integer, default=0)
    carpet_area = qty()
    built_up_area = qty()
    super_area = qty()
    base_rate = money()
    floor_plan_url = txt(1000)


class ReUnit(REMixin, Base):
    __tablename__ = "re_unit"
    __table_args__ = (UniqueConstraint("project_id", "tower_id", "unit_number", name="uq_re_unit_number"),)

    project_id = fk("re_project", nullable=False, ondelete="CASCADE")
    tower_id = fk("re_tower")
    unit_type_id = fk("re_unit_type")
    jda_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    unit_number = txt(40, nullable=False)
    floor_number = Column(Integer, default=0)
    category = choice(UNIT_CATEGORIES, "apartment", 30)
    status = choice(UNIT_STATUSES, "available", 30)
    facing = txt(30)
    bedrooms = Column(Integer, default=0)
    bathrooms = Column(Integer, default=0)
    carpet_area = qty()
    built_up_area = qty()
    super_area = qty()
    base_rate = money()
    floor_rise_rate = money()
    plc_amount = money()
    parking_amount = money()
    club_amount = money()
    other_charges = money()
    total_price = money()
    is_landowner_share = Column(Boolean, nullable=False, default=False)
    listing_id = Column(UUID(as_uuid=True), nullable=True)
    published = Column(Boolean, nullable=False, default=False)
    notes = Column(Text)


class RePriceList(REMixin, Base):
    """Project price list: components applied to every unit when the list is applied."""

    __tablename__ = "re_price_list"

    project_id = fk("re_project", nullable=False, ondelete="CASCADE")
    name = txt(160, nullable=False)
    effective_from = Column(Date)
    status = choice(["draft", "active", "archived"], "draft", 20)
    base_rate = money()
    floor_rise_per_floor = money()
    floor_rise_from_floor = Column(Integer, default=1)
    parking_amount = money()
    club_amount = money()
    other_charges = money()
    plc_by_facing = jsonb_dict()
    notes = Column(Text)


class ReValuation(REMixin, Base):
    __tablename__ = "re_valuation"

    project_id = fk("re_project", nullable=False, ondelete="CASCADE")
    unit_id = fk("re_unit")
    valuation_date = Column(Date, nullable=False)
    valuer_name = txt(160)
    method = choice(["market_comparison", "cost", "income", "circle_rate", "residual"], "market_comparison", 30)
    market_value = money()
    circle_rate_value = money()
    rate_per_sqft = money()
    report_url = txt(1000)
    notes = Column(Text)


# ═══ Module 16 (master) — Brokers / channel partners ══════════════════════════════════════

class ReBroker(REMixin, Base):
    __tablename__ = "re_broker"

    code = txt(30, index=True)
    name = txt(255, nullable=False)
    broker_type = choice(BROKER_TYPES, "individual", 20)
    status = choice(BROKER_STATUSES, "active", 20)
    contact_person = txt(160)
    phone = txt(30)
    email = txt(255)
    pan = txt(10)
    gstin = txt(15)
    rera_number = txt(80)
    address = txt(500)
    bank_name = txt(120)
    account_number = txt(40)
    ifsc = txt(15)
    agreement_date = Column(Date)
    tds_percent = pct(2)  # s.194H brokerage rate (reduced from 5% to 2% w.e.f. 1 Oct 2024)
    kyc_status = choice(KYC_STATUSES, "pending", 20)
    notes = Column(Text)


# ═══ Module 6 (master) — Payment plans ════════════════════════════════════════════════════

class RePaymentPlan(REMixin, Base):
    __tablename__ = "re_payment_plan"

    project_id = fk("re_project", ondelete="CASCADE")
    name = txt(160, nullable=False)
    plan_type = choice(PLAN_TYPES, "clp", 30)
    description = Column(Text)
    is_default = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)


class RePaymentPlanStage(REMixin, Base):
    __tablename__ = "re_payment_plan_stage"

    plan_id = fk("re_payment_plan", nullable=False, ondelete="CASCADE")
    seq = Column(Integer, nullable=False, default=1)
    name = txt(160, nullable=False)
    percent = pct(0, nullable=False)
    trigger_type = choice(TRIGGER_TYPES, "on_booking", 30)
    trigger_days = Column(Integer, default=0)
    milestone_name = txt(160)


# ═══ Module 5 — Customer Management ═══════════════════════════════════════════════════════

class ReCustomer(REMixin, Base):
    __tablename__ = "re_customer"

    customer_code = txt(30, index=True)
    customer_type = choice(CUSTOMER_TYPES, "individual", 20)
    full_name = txt(255, nullable=False)
    phone = txt(30, index=True)
    alt_phone = txt(30)
    email = txt(255)
    dob = Column(Date)
    gender = txt(15)
    occupation = txt(120)
    company_name = txt(255)
    pan = txt(10)
    aadhaar_last4 = txt(4)
    gstin = txt(15)
    nationality = txt(60, default="Indian")
    address = txt(500)
    city = txt(100)
    state = txt(100)
    pincode = txt(12)
    kyc_status = choice(KYC_STATUSES, "pending", 20)
    portal_enabled = Column(Boolean, nullable=False, default=False)
    crm_customer_id = Column(UUID(as_uuid=True), nullable=True)
    notes = Column(Text)
    is_active = Column(Boolean, nullable=False, default=True)


class ReKycDocument(REMixin, Base):
    __tablename__ = "re_kyc_document"

    customer_id = fk("re_customer", nullable=False, ondelete="CASCADE")
    doc_type = choice(
        ["pan", "aadhaar", "passport", "voter_id", "driving_license", "photo", "address_proof",
         "gst_certificate", "incorporation", "poa", "form_60", "other"],
        "pan", 30,
    )
    doc_number = txt(80)
    file_url = txt(1000)
    status = choice(KYC_STATUSES, "pending", 20)
    expires_on = Column(Date)
    verified_by_name = txt(160)
    verified_at = Column(DateTime(timezone=True))
    remarks = txt(500)


class ReCommunication(REMixin, Base):
    __tablename__ = "re_communication"

    customer_id = fk("re_customer", ondelete="CASCADE")
    lead_id = fk("re_lead", ondelete="CASCADE")
    booking_id = fk("re_booking", ondelete="SET NULL")
    channel = choice(COMM_CHANNELS, "call", 20)
    direction = choice(["outbound", "inbound"], "outbound", 20)
    subject = txt(255)
    body = Column(Text)
    status = choice(["logged", "queued", "sent", "delivered", "failed"], "logged", 20)
    sent_at = Column(DateTime(timezone=True))
    by_name = txt(160)
    # Outbound email / SMS is queued here first and delivered by a background job (never inside a request).
    recipient = txt(255)
    event = txt(60, index=True)  # e.g. demand_issued, receipt_cleared, overdue_reminder
    reference_id = Column(UUID(as_uuid=True), index=True)  # the demand / receipt the message is about
    attempts = Column(Integer, nullable=False, default=0)
    error = txt(500)


# ═══ Module 3 — Sales & CRM ═══════════════════════════════════════════════════════════════

class ReLead(REMixin, Base):
    __tablename__ = "re_lead"

    lead_no = txt(30, index=True)
    full_name = txt(255, nullable=False)
    phone = txt(30, index=True)
    email = txt(255)
    source = choice(LEAD_SOURCES, "walk_in", 30)
    campaign = txt(120)
    stage = choice(PIPELINE_STAGES, "new", 30)
    project_id = fk("re_project")
    unit_type_id = fk("re_unit_type")
    interested_unit_id = fk("re_unit")
    budget_min = money()
    budget_max = money()
    purpose = choice(["self_use", "investment", "both"], "self_use", 20)
    funding = choice(["self", "home_loan", "mixed"], "self", 20)
    score = Column(Integer, default=0)
    assigned_to_user_id = Column(UUID(as_uuid=True))
    assigned_to_name = txt(160)
    broker_id = fk("re_broker")
    broker_registered_until = Column(Date)
    customer_id = fk("re_customer")
    next_followup_at = Column(DateTime(timezone=True))
    lost_reason = txt(255)
    converted_at = Column(DateTime(timezone=True))
    notes = Column(Text)


class ReEnquiry(REMixin, Base):
    __tablename__ = "re_enquiry"

    enquiry_no = txt(30, index=True)
    channel = choice(ENQUIRY_CHANNELS, "website", 30)
    full_name = txt(255, nullable=False)
    phone = txt(30)
    email = txt(255)
    project_id = fk("re_project")
    message = Column(Text)
    status = choice(["new", "contacted", "converted", "closed", "spam"], "new", 20)
    lead_id = fk("re_lead")
    handled_by_name = txt(160)


class ReSiteVisit(REMixin, Base):
    __tablename__ = "re_site_visit"

    lead_id = fk("re_lead", ondelete="CASCADE")
    project_id = fk("re_project")
    unit_id = fk("re_unit")
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    status = choice(VISIT_STATUSES, "scheduled", 20)
    visitors_count = Column(Integer, default=1)
    pickup_required = Column(Boolean, nullable=False, default=False)
    conducted_by_name = txt(160)
    outcome = txt(120)
    interest_level = choice(["hot", "warm", "cold"], "warm", 10)
    feedback = Column(Text)
    rating = Column(Integer)


class ReQuotation(REMixin, Base):
    __tablename__ = "re_quotation"

    quote_no = txt(30, index=True)
    lead_id = fk("re_lead")
    customer_id = fk("re_customer")
    project_id = fk("re_project", nullable=False)
    unit_id = fk("re_unit", nullable=False)
    status = choice(QUOTATION_STATUSES, "draft", 20)
    quote_date = Column(Date)
    valid_until = Column(Date)
    payment_plan_id = fk("re_payment_plan")
    basic_amount = money()
    plc_amount = money()
    floor_rise_amount = money()
    parking_amount = money()
    club_amount = money()
    other_charges = money()
    discount_amount = money()
    agreement_value = money()
    gst_rate = pct(0)
    gst_amount = money()
    stamp_duty = money()
    registration_fee = money()
    total_cost = money()
    cost_sheet = jsonb_list()
    terms = Column(Text)
    prepared_by_name = txt(160)


class ReFollowup(REMixin, Base):
    __tablename__ = "re_followup"

    lead_id = fk("re_lead", ondelete="CASCADE")
    customer_id = fk("re_customer", ondelete="CASCADE")
    booking_id = fk("re_booking", ondelete="CASCADE")
    followup_type = choice(FOLLOWUP_TYPES, "call", 30)
    due_at = Column(DateTime(timezone=True), nullable=False, index=True)
    status = choice(FOLLOWUP_STATUSES, "pending", 20)
    assigned_to_name = txt(160)
    assigned_to_user_id = Column(UUID(as_uuid=True))
    notes = Column(Text)
    outcome = txt(255)
    completed_at = Column(DateTime(timezone=True))


# ═══ Module 4 — Booking & Allotment ═══════════════════════════════════════════════════════

class ReUnitBlock(REMixin, Base):
    __tablename__ = "re_unit_block"

    unit_id = fk("re_unit", nullable=False, ondelete="CASCADE")
    lead_id = fk("re_lead")
    customer_id = fk("re_customer")
    status = choice(BLOCK_STATUSES, "active", 20)
    blocked_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True), index=True)
    released_at = Column(DateTime(timezone=True))
    blocked_by_name = txt(160)
    reason = txt(255)
    token_amount = money()


class ReBooking(REMixin, Base):
    __tablename__ = "re_booking"
    __table_args__ = (UniqueConstraint("vendor_id", "booking_no", name="uq_re_booking_no"),)

    booking_no = txt(30, nullable=False)
    project_id = fk("re_project", nullable=False)
    unit_id = fk("re_unit", nullable=False)
    customer_id = fk("re_customer", nullable=False)
    lead_id = fk("re_lead")
    broker_id = fk("re_broker")
    quotation_id = fk("re_quotation")
    payment_plan_id = fk("re_payment_plan")
    booking_date = Column(Date, nullable=False)
    status = choice(BOOKING_STATUSES, "draft", 30)
    sales_executive_name = txt(160)
    sales_executive_user_id = Column(UUID(as_uuid=True))
    # commercial terms
    basic_amount = money()
    plc_amount = money()
    floor_rise_amount = money()
    parking_amount = money()
    club_amount = money()
    other_charges = money()
    discount_amount = money()
    agreement_value = money()
    gst_rate = pct(0)
    gst_amount = money()
    stamp_duty = money()
    registration_fee = money()
    total_consideration = money()
    token_amount = money()
    paid_amount = money()
    loan_amount = money()
    bank_name = txt(120)
    funding = choice(["self", "home_loan", "mixed"], "self", 20)
    nominee_name = txt(160)
    approval_request_id = Column(UUID(as_uuid=True))
    allotment_date = Column(Date)
    agreement_date = Column(Date)
    possession_due_date = Column(Date)
    cancelled_at = Column(DateTime(timezone=True))
    remarks = Column(Text)


class ReBookingApplicant(REMixin, Base):
    __tablename__ = "re_booking_applicant"

    booking_id = fk("re_booking", nullable=False, ondelete="CASCADE")
    customer_id = fk("re_customer")
    full_name = txt(255, nullable=False)
    relation = txt(60)
    pan = txt(10)
    aadhaar_last4 = txt(4)
    phone = txt(30)
    email = txt(255)
    is_primary = Column(Boolean, nullable=False, default=False)
    share_percent = pct(0)


class ReAllotment(REMixin, Base):
    __tablename__ = "re_allotment"

    allotment_no = txt(30, index=True)
    booking_id = fk("re_booking", nullable=False, ondelete="CASCADE")
    allotment_date = Column(Date, nullable=False)
    status = choice(["draft", "issued", "acknowledged", "cancelled"], "draft", 20)
    letter_html = Column(Text)
    issued_at = Column(DateTime(timezone=True))
    acknowledged_at = Column(DateTime(timezone=True))
    terms = Column(Text)


class ReCancellation(REMixin, Base):
    __tablename__ = "re_cancellation"

    cancellation_no = txt(30, index=True)
    booking_id = fk("re_booking", nullable=False, ondelete="CASCADE")
    requested_on = Column(Date, nullable=False)
    reason = txt(500)
    status = choice(CANCELLATION_STATUSES, "requested", 30)
    total_paid = money()
    forfeiture_percent = pct(0)
    forfeiture_amount = money()
    brokerage_recovery = money()
    gst_adjustment = money()
    other_deductions = money()
    refundable_amount = money()
    approval_request_id = Column(UUID(as_uuid=True))
    approved_by_name = txt(160)
    approved_at = Column(DateTime(timezone=True))
    remarks = Column(Text)


class ReRefund(REMixin, Base):
    __tablename__ = "re_refund"

    refund_no = txt(30, index=True)
    cancellation_id = fk("re_cancellation")
    booking_id = fk("re_booking", nullable=False)
    customer_id = fk("re_customer")
    amount = money(nullable=False)
    mode = choice(PAYMENT_MODES, "neft", 20)
    status = choice(REFUND_STATUSES, "pending", 20)
    paid_on = Column(Date)
    reference_no = txt(80)
    bank_name = txt(120)
    gl_entry_id = Column(UUID(as_uuid=True))
    remarks = txt(500)


# ═══ Module 5/15 — Agreements (agreement for sale, sale deed, lease deed, ...) ═════════════

class ReAgreement(REMixin, Base):
    __tablename__ = "re_agreement"

    agreement_no = txt(40, index=True)
    agreement_type = choice(AGREEMENT_TYPES, "agreement_for_sale", 30)
    booking_id = fk("re_booking")
    lease_id = Column(UUID(as_uuid=True), nullable=True)
    customer_id = fk("re_customer")
    unit_id = fk("re_unit")
    project_id = fk("re_project")
    status = choice(AGREEMENT_STATUSES, "draft", 20)
    drafted_on = Column(Date)
    signed_on = Column(Date)
    registration_date = Column(Date)
    registration_no = txt(80)
    sub_registrar_office = txt(160)
    stamp_duty_paid = money()
    registration_fee_paid = money()
    document_url = txt(1000)
    content_html = Column(Text)
    witnesses = jsonb_list()
    notes = Column(Text)
