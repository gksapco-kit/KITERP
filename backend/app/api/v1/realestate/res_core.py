"""Resource definitions — Phase 0 (admin) and Phase 1 (property, sales, booking, customer)."""
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any

from fastapi import HTTPException

from app.models.realestate import admin as A
from app.models.realestate import core as C
from app.services.realestate.common import Ctx, D
from app.services.realestate.pricing import unit_total_price

from .crud import Action, Resource
from .registry import P, add

# ── hooks ───────────────────────────────────────────────────────────────────────────────────

_PRICE_FIELDS = (
    "base_rate", "floor_rise_rate", "plc_amount", "parking_amount", "club_amount", "other_charges",
    "super_area", "built_up_area", "carpet_area",
)
_WORKFLOW_UNIT_STATES = {"blocked", "booked", "sold", "handed_over", "leased"}


def _unit_view(obj: Any, data: dict[str, Any]) -> SimpleNamespace:
    values = {k: getattr(obj, k, None) for k in _PRICE_FIELDS} if obj is not None else {k: None for k in _PRICE_FIELDS}
    values.update({k: v for k, v in data.items() if k in _PRICE_FIELDS})
    return SimpleNamespace(**values)


async def unit_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    if data.get("unit_type_id"):
        ut = await ctx.db.get(C.ReUnitType, data["unit_type_id"])
        if ut:
            for fld in ("carpet_area", "built_up_area", "super_area", "bedrooms", "bathrooms", "base_rate", "category"):
                if data.get(fld) in (None, 0):
                    data[fld] = getattr(ut, fld)
    if data.get("status") in _WORKFLOW_UNIT_STATES:
        raise HTTPException(status_code=409, detail="Unit status is managed by blocking / booking workflows")
    data["total_price"] = unit_total_price(_unit_view(None, data))


async def unit_before_update(ctx: Ctx, obj: Any, data: dict[str, Any]) -> None:
    new_status = data.get("status")
    if new_status and new_status != obj.status and (
        new_status in _WORKFLOW_UNIT_STATES or obj.status in _WORKFLOW_UNIT_STATES
    ):
        raise HTTPException(status_code=409, detail="Unit status is managed by blocking / booking workflows")
    if any(k in data for k in _PRICE_FIELDS):
        data["total_price"] = unit_total_price(_unit_view(obj, data))


async def followup_after_save(ctx: Ctx, obj: Any, *_: Any) -> None:
    from app.services.realestate.sales import refresh_lead_followup

    if obj.lead_id:
        await refresh_lead_followup(ctx.db, obj.lead_id)


async def lead_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    if not data.get("assigned_to_name") and not data.get("assigned_to_user_id"):
        data["assigned_to_user_id"] = ctx.user_id
        data["assigned_to_name"] = ctx.actor_name


async def visit_after_create(ctx: Ctx, obj: Any) -> None:
    if obj.lead_id:
        lead = await ctx.db.get(C.ReLead, obj.lead_id)
        if lead and lead.stage in ("new", "contacted", "qualified"):
            lead.stage = "site_visit_scheduled"


async def quotation_before_create(ctx: Ctx, data: dict[str, Any]) -> None:  # pragma: no cover - create disabled
    return None


# ── Phase 0 / Module 24 ─────────────────────────────────────────────────────────────────────

def _integration_missing(provider: str, config: Any) -> list[str]:
    from .flows_admin import _REQUIRED_CONFIG

    cfg = config or {}
    return [k for k in _REQUIRED_CONFIG.get(provider, []) if not str(cfg.get(k, "")).strip()]


async def _integration_check(ctx: Ctx, data: dict[str, Any]) -> None:
    """An integration cannot be switched on while its required settings are blank."""
    missing = _integration_missing(data.get("provider", "other"), data.get("config"))
    if data.get("is_enabled") and missing:
        raise HTTPException(status_code=422, detail=f"Fill in {', '.join(missing)} before enabling this integration")


async def _integration_update(ctx: Ctx, obj: Any, data: dict[str, Any]) -> None:
    if not data.get("is_enabled", obj.is_enabled):
        return
    config = data["config"] if "config" in data else obj.config
    missing = _integration_missing(data.get("provider", obj.provider), config)
    if missing:
        raise HTTPException(status_code=422, detail=f"Fill in {', '.join(missing)} before enabling this integration")
    if "config" in data or "provider" in data:   # settings changed: the last test no longer applies
        obj.last_status, obj.last_message = None, "Settings changed since the last test"


add(
    Resource(
        key="number-ranges", model=A.ReNumberRange, title="Number ranges",
        columns=["doc_type", "prefix", "next_number", "padding", "include_year", "reset_yearly"],
        search=["doc_type", "prefix"], write_perm="realestate.admin", order="doc_type",
    ),
    Resource(
        key="documents", model=A.ReDocument, title="Digital documents",
        columns=["title", "doc_type", "entity_type", "version", "issued_on", "expires_on"],
        search=["title", "doc_type", "entity_type"], filters=["doc_type", "entity_type"],
        json_fields=("tags",), write_perm="realestate.manage",
    ),
    Resource(
        key="templates", model=A.ReTemplate, title="Letter & agreement templates",
        columns=["template_type", "name", "is_default", "is_active"],
        search=["name"], filters=["template_type"], write_perm="realestate.admin",
        json_fields=("print_settings",),
        actions=[Action("preview", "Preview", "preview", method="GET")],
    ),
    Resource(
        key="approval-rules", model=A.ReApprovalRule, title="Approval workflows",
        columns=["entity_type", "name", "field", "min_value", "approver_permission", "is_active"],
        search=["name"], filters=["entity_type"], write_perm="realestate.admin",
    ),
    Resource(
        key="approval-requests", model=A.ReApprovalRequest, title="Approval requests",
        columns=["entity_type", "entity_ref", "title", "amount", "status", "requested_by_name", "decided_by_name"],
        search=["entity_ref", "title"], filters=["status", "entity_type"],
        allow_create=False, allow_edit=False, allow_delete=False, audit=False,
        actions=[
            Action("approve", "Approve", "approve", params=[P("comments", "Comments", "textarea")],
                   when={"status": ["pending"]}, style="primary"),
            Action("reject", "Reject", "reject", params=[P("comments", "Reason", "textarea", required=True)],
                   when={"status": ["pending"]}, style="danger"),
        ],
    ),
    Resource(
        key="audit-logs", model=A.ReAuditLog, title="Audit logs",
        columns=["created_at", "entity_type", "entity_ref", "action", "actor_name"],
        search=["entity_ref", "actor_name"], filters=["entity_type", "action"],
        allow_create=False, allow_edit=False, allow_delete=False, audit=False,
        read_perm="realestate.admin",
    ),
    Resource(
        key="integrations", model=A.ReIntegration, title="Integrations",
        columns=["provider", "name", "is_enabled", "last_status", "last_tested_at"],
        search=["name"], filters=["provider"], write_perm="realestate.admin", read_perm="realestate.admin",
        json_fields=("config",), secret_json=("config",),
        actions=[Action("test", "Test configuration", "test")],
        before_create=_integration_check, before_update=_integration_update,
    ),
    Resource(
        key="automation-settings", model=A.ReSetting, title="Automation settings",
        columns=["key", "value", "description"], filters=["key"], write_perm="realestate.admin", read_perm="realestate.admin",
        json_fields=("value",), order="key",
    ),
    Resource(
        key="gl-failures", model=A.ReGlFailure, title="GL posting issues",
        columns=["source_type", "reference", "amount", "status", "attempts", "error", "last_attempt_at"],
        search=["reference", "error"], filters=["status", "source_type"], order="-last_attempt_at",
        allow_create=False, allow_edit=False, allow_delete=False, audit=False,
        write_perm="realestate.admin", read_perm="realestate.admin",
        actions=[Action("retry", "Retry posting", "retry", when={"status": ["open"]}, style="primary")],
    ),
)

# ── Phase 1 / Module 1 — Property ───────────────────────────────────────────────────────────

add(
    Resource(
        key="projects", model=C.ReProject, title="Projects",
        columns=["code", "name", "project_type", "status", "city", "rera_number", "launch_date", "possession_date"],
        search=["code", "name", "city", "rera_number"], filters=["status", "project_type"],
        number=("project", "code"), order="-created_at", json_fields=("amenities",), hide=("company_id", "store_id"),
    ),
    Resource(
        key="phases", model=C.RePhase, title="Phases",
        columns=["project_id", "name", "status", "start_date", "end_date"],
        search=["name"], filters=["project_id", "status"], order="name",
    ),
    Resource(
        key="towers", model=C.ReTower, title="Towers / blocks",
        columns=["project_id", "phase_id", "name", "total_floors", "units_per_floor", "status", "completion_percent"],
        search=["name"], filters=["project_id", "phase_id", "status"], order="name",
        actions=[
            Action(
                "generate_units", "Generate units", "generate-units",
                params=[
                    P("unit_type_id", "Unit type", "ref", ref="unit-types"),
                    P("floors_from", "From floor", "integer", required=True, default=1),
                    P("floors_to", "To floor", "integer", required=True),
                    P("units_per_floor", "Units per floor", "integer", required=True),
                    P("start_index", "First unit index", "integer", default=1),
                ],
                confirm="Generate units for this tower? Existing unit numbers are skipped.",
            )
        ],
    ),
    Resource(
        key="unit-types", model=C.ReUnitType, title="Unit types",
        columns=["project_id", "name", "category", "bedrooms", "carpet_area", "super_area", "base_rate"],
        search=["name"], filters=["project_id", "category"], order="name",
    ),
    Resource(
        key="units", model=C.ReUnit, title="Unit inventory",
        columns=["unit_number", "project_id", "tower_id", "floor_number", "category", "status", "super_area", "total_price"],
        search=["unit_number"], filters=["project_id", "tower_id", "status", "category", "unit_type_id", "floor_number"],
        order="unit_number", readonly=("total_price", "listing_id", "published", "jda_id"),
        before_create=unit_before_create, before_update=unit_before_update,
        actions=[
            Action(
                "block", "Block unit", "block",
                params=[
                    P("lead_id", "Lead", "ref", ref="leads"),
                    P("customer_id", "Customer", "ref", ref="customers"),
                    P("hours", "Hold for (hours)", "integer", default=48),
                    P("token_amount", "Token amount", "money"),
                    P("reason", "Reason", "text"),
                ],
                when={"status": ["available"]},
            ),
            Action("publish", "Publish to website", "publish", when={"status": ["available", "hold"]}),
            Action("unpublish", "Unpublish", "unpublish"),
            Action("cost_sheet", "Cost sheet", "cost-sheet", method="GET",
                   params=[P("discount", "Discount", "money")]),
        ],
    ),
    Resource(
        key="price-lists", model=C.RePriceList, title="Price lists",
        columns=["project_id", "name", "status", "effective_from", "base_rate", "floor_rise_per_floor"],
        search=["name"], filters=["project_id", "status"], json_fields=("plc_by_facing",),
        actions=[Action("apply", "Apply to units", "apply",
                        confirm="Apply this price list to all available units of the project?",
                        when={"status": ["draft", "active"]}, style="primary")],
    ),
    Resource(
        key="valuations", model=C.ReValuation, title="Property valuation",
        columns=["project_id", "unit_id", "valuation_date", "method", "market_value", "circle_rate_value", "rate_per_sqft"],
        search=["valuer_name"], filters=["project_id", "unit_id", "method"], order="-valuation_date",
    ),
)

# ── Brokers & payment plans (masters) ───────────────────────────────────────────────────────

add(
    Resource(
        key="brokers", model=C.ReBroker, title="Channel partners",
        columns=["code", "name", "broker_type", "status", "phone", "rera_number", "kyc_status"],
        search=["code", "name", "phone", "pan"], filters=["status", "broker_type"], number=("broker", "code"),
    ),
    Resource(
        key="payment-plans", model=C.RePaymentPlan, title="Payment plans",
        columns=["project_id", "name", "plan_type", "is_default", "is_active"],
        search=["name"], filters=["project_id", "plan_type"], write_perm="realestate.collections",
    ),
    Resource(
        key="payment-plan-stages", model=C.RePaymentPlanStage, title="Payment plan stages",
        columns=["plan_id", "seq", "name", "percent", "trigger_type", "trigger_days", "milestone_name"],
        search=["name"], filters=["plan_id"], order="seq", write_perm="realestate.collections",
    ),
)

# ── Module 5 — Customers ────────────────────────────────────────────────────────────────────

add(
    Resource(
        key="customers", model=C.ReCustomer, title="Customer master",
        columns=["customer_code", "full_name", "phone", "email", "customer_type", "kyc_status", "city"],
        search=["customer_code", "full_name", "phone", "email", "pan"], filters=["kyc_status", "customer_type"],
        number=("customer", "customer_code"), write_perm="realestate.sales",
        readonly=("kyc_status", "crm_customer_id"),
    ),
    Resource(
        key="kyc-documents", model=C.ReKycDocument, title="KYC documents",
        columns=["customer_id", "doc_type", "doc_number", "status", "expires_on", "verified_by_name"],
        search=["doc_number"], filters=["customer_id", "status", "doc_type"], write_perm="realestate.sales",
        readonly=("status", "verified_by_name", "verified_at"),
        actions=[
            Action("verify", "Verify", "verify", when={"status": ["pending", "submitted", "rejected"]}, style="primary"),
            Action("reject", "Reject", "reject", params=[P("remarks", "Reason", "text", required=True)],
                   when={"status": ["pending", "submitted"]}, style="danger"),
        ],
    ),
    Resource(
        key="communications", model=C.ReCommunication, title="Communication log",
        columns=["customer_id", "lead_id", "channel", "direction", "subject", "status", "event", "recipient", "sent_at", "by_name"],
        search=["subject", "body", "recipient"], filters=["customer_id", "lead_id", "channel", "status", "event"],
        write_perm="realestate.sales", order="-created_at",
        readonly=("event", "reference_id", "attempts", "error"), hide=("reference_id", "attempts"),
        actions=[
            Action("requeue", "Retry sending", "requeue", when={"status": ["failed"]}, style="primary"),
        ],
    ),
    Resource(
        key="agreements", model=C.ReAgreement, title="Agreements",
        columns=["agreement_no", "agreement_type", "booking_id", "customer_id", "status", "signed_on", "registration_no"],
        search=["agreement_no", "registration_no"], filters=["agreement_type", "status", "booking_id", "customer_id"],
        number=("agreement", "agreement_no"), write_perm="realestate.legal",
        readonly=("content_html", "lease_id"),
        actions=[
            Action("letter", "View document", "letter", method="GET"),
            Action("sign", "Mark signed", "sign", params=[P("signed_on", "Signed on", "date")],
                   when={"status": ["draft", "sent"]}, style="primary"),
            Action(
                "register", "Register", "register",
                params=[
                    P("registration_no", "Registration no.", "text", required=True),
                    P("registration_date", "Registration date", "date"),
                    P("sub_registrar_office", "Sub-registrar office", "text"),
                    P("stamp_duty_paid", "Stamp duty paid", "money"),
                    P("registration_fee_paid", "Registration fee paid", "money"),
                ],
                when={"status": ["signed"]},
            ),
        ],
    ),
)

# ── Module 3 — Sales & CRM ──────────────────────────────────────────────────────────────────

add(
    Resource(
        key="leads", model=C.ReLead, title="Leads",
        columns=["lead_no", "full_name", "phone", "source", "stage", "project_id", "budget_max", "assigned_to_name", "next_followup_at"],
        search=["lead_no", "full_name", "phone", "email"], filters=["stage", "source", "project_id", "broker_id"],
        number=("lead", "lead_no"), write_perm="realestate.sales", readonly=("customer_id", "converted_at", "next_followup_at"),
        before_create=lead_before_create,
        actions=[
            Action("stage", "Move stage", "stage",
                   params=[P("stage", "Stage", "select", required=True, choices=C.PIPELINE_STAGES)],
                   when={"stage": [s for s in C.PIPELINE_STAGES if s != "booked"]}),
            Action("convert", "Convert to customer", "convert", when={"customer_id": [None]}),
            Action("lost", "Mark lost", "lost", params=[P("reason", "Reason", "text", required=True)],
                   when={"stage": [s for s in C.PIPELINE_STAGES if s not in ("lost", "booked")]}, style="danger"),
        ],
    ),
    Resource(
        key="enquiries", model=C.ReEnquiry, title="Enquiries",
        columns=["enquiry_no", "full_name", "phone", "channel", "project_id", "status", "created_at"],
        search=["enquiry_no", "full_name", "phone", "email"], filters=["status", "channel", "project_id"],
        number=("enquiry", "enquiry_no"), write_perm="realestate.sales", readonly=("lead_id",),
        actions=[Action("convert", "Convert to lead", "convert", when={"status": ["new", "contacted"]}, style="primary")],
    ),
    Resource(
        key="site-visits", model=C.ReSiteVisit, title="Site visits",
        columns=["lead_id", "project_id", "unit_id", "scheduled_at", "status", "interest_level", "rating"],
        search=["conducted_by_name", "outcome"], filters=["status", "project_id", "lead_id"], order="-scheduled_at",
        write_perm="realestate.sales", after_create=visit_after_create,
        actions=[Action(
            "complete", "Complete visit", "complete",
            params=[
                P("outcome", "Outcome", "text"),
                P("interest_level", "Interest", "select", choices=["hot", "warm", "cold"], default="warm"),
                P("rating", "Rating (1-5)", "integer"),
                P("feedback", "Feedback", "textarea"),
                P("next_followup_at", "Next follow-up", "datetime"),
            ],
            when={"status": ["scheduled", "rescheduled"]}, style="primary",
        )],
    ),
    Resource(
        key="quotations", model=C.ReQuotation, title="Quotations",
        columns=["quote_no", "lead_id", "customer_id", "unit_id", "status", "agreement_value", "total_cost", "valid_until"],
        search=["quote_no"], filters=["status", "project_id", "lead_id", "unit_id"], write_perm="realestate.sales",
        allow_create=False, allow_delete=True, editable_when={"status": ["draft"]},
        create_fields=("unit_id", "lead_id", "customer_id", "payment_plan_id", "discount_amount", "quote_date", "terms"),
        readonly=(
            "basic_amount", "plc_amount", "floor_rise_amount", "parking_amount", "club_amount", "other_charges",
            "agreement_value", "gst_amount", "stamp_duty", "registration_fee", "total_cost", "cost_sheet", "gst_rate",
        ),
        actions=[
            Action("send", "Mark sent", "send", when={"status": ["draft"]}),
            Action("accept", "Accept", "accept", when={"status": ["sent", "draft"]}),
            Action("reject", "Reject", "reject", when={"status": ["sent", "draft"]}, style="danger"),
            Action("sheet", "Cost sheet", "sheet", method="GET"),
            Action(
                "to_booking", "Convert to booking", "to-booking",
                params=[
                    P("customer_id", "Customer", "ref", ref="customers"),
                    P("token_amount", "Token amount", "money"),
                    P("payment_plan_id", "Payment plan", "ref", ref="payment-plans"),
                ],
                when={"status": ["accepted", "sent"]}, style="primary",
            ),
        ],
    ),
    Resource(
        key="followups", model=C.ReFollowup, title="Follow-ups",
        columns=["lead_id", "customer_id", "followup_type", "due_at", "status", "assigned_to_name", "outcome"],
        search=["notes", "assigned_to_name"], filters=["status", "lead_id", "customer_id", "followup_type"],
        order="due_at", write_perm="realestate.sales", readonly=("completed_at",),
        after_create=followup_after_save, after_update=followup_after_save,
        actions=[Action(
            "complete", "Done", "complete",
            params=[P("outcome", "Outcome", "text"), P("next_due_at", "Schedule next", "datetime")],
            when={"status": ["pending", "missed"]}, style="primary",
        )],
    ),
)

# ── Module 4 — Booking & Allotment ──────────────────────────────────────────────────────────

add(
    Resource(
        key="unit-blocks", model=C.ReUnitBlock, title="Unit blocking",
        columns=["unit_id", "lead_id", "customer_id", "status", "blocked_at", "expires_at", "token_amount", "blocked_by_name"],
        search=["reason", "blocked_by_name"], filters=["status", "unit_id", "lead_id"], order="-blocked_at",
        write_perm="realestate.booking", allow_create=False, allow_edit=False, allow_delete=False,
        actions=[Action("release", "Release", "release", when={"status": ["active"]}, style="danger",
                        confirm="Release this block and make the unit available?")],
    ),
    Resource(
        key="bookings", model=C.ReBooking, title="Booking forms",
        columns=["booking_no", "booking_date", "project_id", "unit_id", "customer_id", "status", "agreement_value", "paid_amount"],
        search=["booking_no"], filters=["status", "project_id", "unit_id", "customer_id", "broker_id"],
        order="-booking_date", write_perm="realestate.booking", allow_create=False, allow_delete=False,
        create_fields=(
            "unit_id", "customer_id", "booking_date", "payment_plan_id", "broker_id", "lead_id", "quotation_id",
            "discount_amount", "token_amount", "funding", "loan_amount", "bank_name", "nominee_name",
            "sales_executive_name", "remarks",
        ),
        editable_when={"status": ["draft", "confirmed"]},
        readonly=(
            "booking_no", "project_id", "unit_id", "customer_id", "basic_amount", "plc_amount", "floor_rise_amount",
            "parking_amount", "club_amount", "other_charges", "discount_amount", "agreement_value", "gst_rate",
            "gst_amount", "stamp_duty", "registration_fee", "total_consideration", "paid_amount", "status",
            "approval_request_id", "allotment_date", "agreement_date", "cancelled_at",
        ),
        actions=[
            Action("allot", "Issue allotment letter", "allot", when={"status": ["confirmed"]}, style="primary",
                   confirm="Issue the allotment letter for this booking?"),
            Action(
                "agreement", "Draft agreement", "agreement",
                params=[P("agreement_type", "Agreement type", "select", choices=["agreement_for_sale", "sale_deed", "builder_buyer"],
                          default="agreement_for_sale")],
                when={"status": ["allotted", "agreement_signed", "registered"]},
            ),
            Action(
                "cancel_request", "Request cancellation", "cancel-request",
                params=[
                    P("reason", "Reason", "text", required=True),
                    P("forfeiture_percent", "Forfeiture % of agreement value", "number", default=10),
                    P("gst_adjustment", "GST adjustment", "money"),
                    P("other_deductions", "Other deductions", "money"),
                ],
                when={"status": ["confirmed", "allotted", "agreement_signed"]}, style="danger",
            ),
        ],
    ),
    Resource(
        key="booking-applicants", model=C.ReBookingApplicant, title="Co-applicants",
        columns=["booking_id", "full_name", "relation", "pan", "phone", "is_primary", "share_percent"],
        search=["full_name", "pan"], filters=["booking_id"], write_perm="realestate.booking",
    ),
    Resource(
        key="allotments", model=C.ReAllotment, title="Allotment letters",
        columns=["allotment_no", "booking_id", "allotment_date", "status", "issued_at", "acknowledged_at"],
        search=["allotment_no"], filters=["status", "booking_id"], write_perm="realestate.booking",
        allow_create=False, allow_delete=False, readonly=("letter_html", "issued_at", "acknowledged_at", "status"),
        actions=[
            Action("letter", "View letter", "letter", method="GET"),
            Action("acknowledge", "Mark acknowledged", "acknowledge", when={"status": ["issued"]}),
        ],
    ),
    Resource(
        key="cancellations", model=C.ReCancellation, title="Cancellations",
        columns=["cancellation_no", "booking_id", "requested_on", "status", "total_paid", "forfeiture_amount", "refundable_amount"],
        search=["cancellation_no", "reason"], filters=["status", "booking_id"], write_perm="realestate.booking",
        allow_create=False, allow_delete=False, allow_edit=False,
        actions=[
            Action("approve", "Approve", "approve", when={"status": ["requested"]}, style="primary",
                   confirm="Approve cancellation? The unit will be released and a refund created."),
            Action("reject", "Reject", "reject", params=[P("remarks", "Reason", "text", required=True)],
                   when={"status": ["requested"]}, style="danger"),
            Action("letter", "Cancellation letter", "letter", method="GET"),
        ],
    ),
    Resource(
        key="refunds", model=C.ReRefund, title="Refunds",
        columns=["refund_no", "booking_id", "customer_id", "amount", "mode", "status", "paid_on", "reference_no"],
        search=["refund_no", "reference_no"], filters=["status", "booking_id"], write_perm="realestate.booking",
        allow_create=False, allow_delete=False, readonly=("status", "paid_on", "gl_entry_id", "amount"),
        actions=[Action(
            "pay", "Mark paid", "pay",
            params=[
                P("mode", "Mode", "select", choices=C.PAYMENT_MODES, default="neft"),
                P("reference_no", "Reference no.", "text", required=True),
                P("paid_on", "Paid on", "date"),
            ],
            when={"status": ["pending", "approved"]}, style="primary",
        )],
    ),
)
