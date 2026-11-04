"""Real Estate — Phase 3 models: land bank & acquisition (module 2) and legal / statutory (module 15)."""
from __future__ import annotations

from sqlalchemy import Boolean, Column, Date, Integer, Text, UniqueConstraint

from .base import REMixin, Base, UUID, choice, fk, jsonb_list, money, pct, txt
from .core import PAYMENT_MODES

AREA_UNITS = ["sqft", "sqm", "acre", "hectare", "guntha", "cent"]
LAND_USES = ["agricultural", "residential", "commercial", "industrial", "mixed", "recreational", "barren"]
PARCEL_STATUSES = ["identified", "under_negotiation", "title_check", "acquired", "under_jda", "rejected", "developed"]
OWNER_TYPES = ["individual", "company", "huf", "trust", "partnership", "government", "poa_holder"]
TITLE_CHECK_TYPES = [
    "title_search", "encumbrance_certificate", "revenue_records", "mutation", "litigation_search",
    "zoning_check", "survey_demarcation", "legal_opinion", "other",
]
TITLE_STATUSES = ["pending", "in_progress", "clear", "issues_found", "waived"]
ACQUISITION_MODES = ["outright_purchase", "jda", "joint_venture", "lease", "auction", "government_allotment"]
ACQUISITION_STATUSES = ["draft", "negotiating", "agreement_signed", "registered", "completed", "cancelled"]
ACQ_PAYMENT_PURPOSES = ["token", "instalment", "balance", "stamp_duty", "registration", "brokerage", "other"]
ACQ_PAYMENT_STATUSES = ["paid", "cancelled"]
JDA_MODELS = ["area_share", "revenue_share", "mixed", "fixed_consideration"]
JDA_STATUSES = ["draft", "active", "completed", "terminated"]
APPROVAL_TYPES = [
    "rera_registration", "layout_approval", "building_plan", "commencement_certificate", "environmental_clearance",
    "fire_noc", "airport_noc", "water_noc", "na_conversion", "occupancy_certificate", "completion_certificate", "other",
]
APPROVAL_STATUSES_RE = ["not_applied", "applied", "under_review", "approved", "rejected", "expired"]

SQFT_PER = {"sqft": 1.0, "sqm": 10.7639, "acre": 43560.0, "hectare": 107639.1, "guntha": 1089.0, "cent": 435.6}


class ReLandParcel(REMixin, Base):
    __tablename__ = "re_land_parcel"
    __table_args__ = (UniqueConstraint("vendor_id", "code", name="uq_re_land_parcel_code"),)

    code = txt(30, nullable=False)
    name = txt(255, nullable=False)
    survey_number = txt(120, index=True)
    village = txt(120)
    taluka = txt(120)
    district = txt(120)
    state = txt(80)
    pincode = txt(10)
    address = txt(500)
    latitude = txt(30)
    longitude = txt(30)
    area = money(0, nullable=False)  # as measured, in ``area_unit``
    area_unit = choice(AREA_UNITS, "sqft", 12)
    area_sqft = money(0)
    land_use = choice(LAND_USES, "residential", 20)
    zoning = txt(120)
    status = choice(PARCEL_STATUSES, "identified", 20)
    asking_price = money(0)
    market_value = money(0)
    boundaries = Column(Text)
    project_id = fk("re_project")
    notes = Column(Text)


class ReLandowner(REMixin, Base):
    __tablename__ = "re_landowner"

    parcel_id = fk("re_land_parcel", nullable=False, ondelete="CASCADE")
    name = txt(255, nullable=False)
    owner_type = choice(OWNER_TYPES, "individual", 20)
    share_percent = pct(100)
    phone = txt(30)
    email = txt(255)
    pan = txt(10)
    aadhaar_last4 = txt(4)
    address = txt(500)
    bank_name = txt(120)
    account_number = txt(40)
    ifsc = txt(15)
    poa_holder_name = txt(255)
    is_primary = Column(Boolean, nullable=False, default=False)
    notes = Column(Text)


class ReTitleCheck(REMixin, Base):
    __tablename__ = "re_title_check"

    parcel_id = fk("re_land_parcel", nullable=False, ondelete="CASCADE")
    check_type = choice(TITLE_CHECK_TYPES, "title_search", 30)
    status = choice(TITLE_STATUSES, "pending", 20)
    advocate_name = txt(255)
    requested_on = Column(Date)
    report_date = Column(Date)
    valid_until = Column(Date)
    findings = Column(Text)
    risk_level = choice(["low", "medium", "high"], "low", 10, index=False)
    document_url = txt(1000)


class ReAcquisition(REMixin, Base):
    __tablename__ = "re_acquisition"
    __table_args__ = (UniqueConstraint("vendor_id", "acquisition_no", name="uq_re_acquisition_no"),)

    acquisition_no = txt(30, nullable=False)
    parcel_id = fk("re_land_parcel", nullable=False, ondelete="RESTRICT")
    project_id = fk("re_project")
    mode = choice(ACQUISITION_MODES, "outright_purchase", 30)
    status = choice(ACQUISITION_STATUSES, "draft", 20)
    agreed_price = money(0)
    stamp_duty = money(0)
    registration_fee = money(0)
    other_costs = money(0)
    total_cost = money(0)
    paid_amount = money(0)
    agreement_date = Column(Date)
    registration_date = Column(Date)
    registration_no = txt(80)
    sub_registrar_office = txt(160)
    possession_date = Column(Date)
    remarks = Column(Text)


class ReAcquisitionPayment(REMixin, Base):
    __tablename__ = "re_acquisition_payment"

    acquisition_id = fk("re_acquisition", nullable=False, ondelete="CASCADE")
    landowner_id = fk("re_landowner")
    payment_date = Column(Date, nullable=False)
    purpose = choice(ACQ_PAYMENT_PURPOSES, "instalment", 20)
    amount = money(0, nullable=False)
    tds_amount = money(0)  # s.194-IA withheld from the seller
    net_paid = money(0)
    mode = choice(PAYMENT_MODES, "neft", 20)
    reference_no = txt(80)
    status = choice(ACQ_PAYMENT_STATUSES, "paid", 20)
    remarks = txt(500)


class ReJda(REMixin, Base):
    __tablename__ = "re_jda"
    __table_args__ = (UniqueConstraint("vendor_id", "jda_no", name="uq_re_jda_no"),)

    jda_no = txt(30, nullable=False)
    parcel_id = fk("re_land_parcel", nullable=False, ondelete="RESTRICT")
    acquisition_id = fk("re_acquisition")
    project_id = fk("re_project")
    landowner_id = fk("re_landowner")
    model = choice(JDA_MODELS, "area_share", 20)
    landowner_share_percent = pct(0)  # of saleable area (area share) or revenue (revenue share)
    landowner_area_sqft = money(0)  # entitlement when fixed
    refundable_deposit = money(0)
    fixed_consideration = money(0)
    status = choice(JDA_STATUSES, "draft", 20)
    signing_date = Column(Date)
    registration_no = txt(80)
    terms = Column(Text)


class ReStatutoryApproval(REMixin, Base):
    __tablename__ = "re_statutory_approval"

    project_id = fk("re_project")
    parcel_id = fk("re_land_parcel")
    approval_type = choice(APPROVAL_TYPES, "other", 30)
    authority = txt(160)
    reference_no = txt(80)
    status = choice(APPROVAL_STATUSES_RE, "not_applied", 20)
    applied_on = Column(Date)
    approved_on = Column(Date)
    valid_until = Column(Date)
    renewal_reminder_days = Column(Integer, nullable=False, default=60)
    fee_paid = money(0)
    document_url = txt(1000)
    conditions = Column(Text)
    tags = jsonb_list()
