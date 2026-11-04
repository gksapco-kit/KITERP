"""Resource definitions — Phase 2: collections, tax & compliance, broker management."""
from typing import Any

from fastapi import HTTPException

from app.models.realestate import core as C
from app.models.realestate import receivables as R
from app.services.realestate.common import Ctx, D

from .crud import Action, Resource
from .registry import P, add, by_key

COLLECT = "realestate.collections"


# ── hooks ───────────────────────────────────────────────────────────────────────────────────

async def rera_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    if D(data.get("amount")) <= 0:
        raise HTTPException(status_code=422, detail="amount must be greater than zero")
    # Deposits are recorded as facts; withdrawals always go through certified approval.
    data["status"] = "requested" if data.get("kind") == "withdrawal" else "approved"


async def rule_validate(ctx: Ctx, data: dict[str, Any], obj: Any = None) -> None:
    def val(k: str):
        return data.get(k, getattr(obj, k, None))

    if not 0 <= D(val("rate")) <= 100:
        raise HTTPException(status_code=422, detail="rate must be between 0 and 100")
    if val("basis") == "fixed_per_unit" and D(val("fixed_amount")) <= 0:
        raise HTTPException(status_code=422, detail="fixed_amount is required for a fixed-per-unit rule")
    if D(val("slab_max")) and D(val("slab_max")) <= D(val("slab_min")):
        raise HTTPException(status_code=422, detail="slab_max must be greater than slab_min")


async def rule_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    await rule_validate(ctx, data)


async def rule_before_update(ctx: Ctx, obj: Any, data: dict[str, Any]) -> None:
    await rule_validate(ctx, data, obj)


async def incentive_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    if D(data.get("amount")) <= 0:
        raise HTTPException(status_code=422, detail="amount must be greater than zero")
    broker = await ctx.db.get(C.ReBroker, data["broker_id"])
    if "tds_amount" not in data:
        data["tds_amount"] = (D(data["amount"]) * D(broker.tds_percent) / 100).quantize(D("0.01"))
    data["status"] = "proposed"


# ── Module 6 — Payment & Collections ────────────────────────────────────────────────────────

add(
    Resource(
        key="payment-schedule", model=R.ReScheduleItem, title="Installments",
        columns=["booking_id", "seq", "name", "percent", "due_date", "total_due", "paid_amount", "status"],
        search=["name"], filters=["booking_id", "status", "trigger_type"], order="due_date", write_perm=COLLECT,
        allow_create=False, allow_edit=False, allow_delete=False, audit=False,
        actions=[Action("demand", "Raise demand", "demand", when={"status": ["due"]}, style="primary",
                        confirm="Issue the demand letter for this instalment now?")],
    ),
    Resource(
        key="demands", model=R.ReDemand, title="Demand letters",
        columns=["demand_no", "booking_id", "stage_name", "demand_date", "due_date", "total_amount", "paid_amount", "status"],
        search=["demand_no", "stage_name"], filters=["booking_id", "status"], order="-demand_date", write_perm=COLLECT,
        allow_create=False, allow_edit=False, allow_delete=False,
        actions=[
            Action("letter", "View letter", "letter", method="GET", result="html"),
            Action("cancel", "Cancel", "cancel", params=[P("reason", "Reason", "text", required=True)],
                   when={"status": ["issued"]}, style="danger"),
        ],
    ),
    Resource(
        key="receipts", model=R.ReReceipt, title="Receipts",
        columns=["receipt_no", "booking_id", "receipt_date", "amount", "tds_amount", "mode", "reference_no", "status", "allocated_amount"],
        search=["receipt_no", "reference_no"], filters=["booking_id", "status", "mode"], order="-receipt_date",
        write_perm=COLLECT, allow_create=False, allow_edit=False, allow_delete=False,
        create_fields=("booking_id", "receipt_date", "amount", "tds_amount", "mode", "reference_no", "bank_name", "instrument_date", "remarks"),
        actions=[
            Action("letter", "Receipt", "letter", method="GET", result="html"),
            Action("clear", "Mark cleared", "clear", params=[P("cleared_on", "Cleared on", "date")],
                   when={"status": ["received"]}, style="primary"),
            Action("bounce", "Bounced", "bounce", params=[P("reason", "Reason", "text", required=True)],
                   when={"status": ["received"]}, style="danger"),
            Action("cancel", "Cancel", "cancel", params=[P("reason", "Reason", "text", required=True)],
                   when={"status": ["received"]}),
        ],
    ),
)

# ── Module 14 — Tax & Compliance ────────────────────────────────────────────────────────────

add(
    Resource(
        key="tds-entries", model=R.ReTdsEntry, title="TDS 194-IA",
        columns=["booking_id", "deducted_on", "consideration", "tds_percent", "tds_amount", "status", "challan_no", "certificate_no"],
        search=["challan_no", "certificate_no", "buyer_pan"], filters=["booking_id", "status"], order="-deducted_on",
        write_perm=COLLECT, allow_create=False, allow_edit=False, allow_delete=False,
        actions=[
            Action("deposit", "Record Form 26QB", "deposit",
                   params=[P("challan_no", "Challan no.", "text", required=True), P("challan_date", "Challan date", "date"),
                           P("ack_no", "26QB acknowledgement", "text")],
                   when={"status": ["pending_deposit"]}, style="primary"),
            Action("certificate", "Record Form 16B", "certificate",
                   params=[P("certificate_no", "Certificate no.", "text", required=True), P("certificate_date", "Certificate date", "date")],
                   when={"status": ["deposited"]}),
        ],
    ),
    Resource(
        key="tax-filings", model=R.ReTaxFiling, title="Statutory reports",
        columns=["filing_type", "period", "project_id", "due_date", "filed_on", "status", "tax_amount", "ack_no"],
        search=["period", "ack_no"], filters=["filing_type", "status", "project_id"], order="-due_date", write_perm=COLLECT,
    ),
    Resource(
        key="rera-entries", model=R.ReReraEntry, title="RERA account",
        columns=["project_id", "kind", "entry_date", "amount", "status", "certified_completion_percent", "certified_by", "reference_no"],
        search=["reference_no", "certificate_ref", "certified_by"], filters=["project_id", "kind", "status"],
        order="-entry_date", write_perm=COLLECT, readonly=("status",), before_create=rera_before_create,
        editable_when={"status": ["requested"]},
        actions=[
            Action("approve", "Approve", "approve", params=[P("remarks", "Remarks", "text")], when={"status": ["requested"]},
                   style="primary", confirm="Approve this entry? Withdrawals are checked against the certified completion %."),
            Action("reject", "Reject", "reject", params=[P("remarks", "Reason", "text", required=True)],
                   when={"status": ["requested"]}, style="danger"),
        ],
    ),
)

# ── Module 16 — Broker Management ───────────────────────────────────────────────────────────

add(
    Resource(
        key="commission-rules", model=R.ReCommissionRule, title="Commission rules",
        columns=["name", "broker_id", "project_id", "basis", "rate", "fixed_amount", "slab_min", "slab_max", "payout_trigger", "trigger_percent", "is_active"],
        search=["name"], filters=["broker_id", "project_id", "basis", "is_active"], order="name", write_perm="realestate.manage",
        before_create=rule_before_create, before_update=rule_before_update,
    ),
    Resource(
        key="commissions", model=R.ReCommission, title="Commissions",
        columns=["booking_id", "broker_id", "kind", "basis_amount", "rate", "gross_amount", "tds_amount", "net_amount", "status"],
        filters=["broker_id", "booking_id", "status", "kind"], order="-created_at", write_perm=COLLECT,
        allow_create=False, allow_edit=False, allow_delete=False, audit=False,
    ),
    Resource(
        key="incentives", model=R.ReIncentive, title="Incentives",
        columns=["broker_id", "scheme_name", "period_from", "period_to", "target_value", "achieved_value", "amount", "tds_amount", "status"],
        search=["scheme_name"], filters=["broker_id", "status"], order="-created_at", write_perm=COLLECT,
        readonly=("status", "settlement_id"), before_create=incentive_before_create, editable_when={"status": ["proposed"]},
        actions=[
            Action("approve", "Approve", "approve", when={"status": ["proposed"]}, style="primary"),
            Action("reject", "Reject", "reject", when={"status": ["proposed"]}, style="danger"),
        ],
    ),
    Resource(
        key="settlements", model=R.ReSettlement, title="Broker settlements",
        columns=["settlement_no", "broker_id", "settlement_date", "gross_amount", "gst_amount", "tds_amount", "clawback_amount", "net_amount", "status"],
        search=["settlement_no"], filters=["broker_id", "status"], order="-settlement_date", write_perm=COLLECT,
        allow_create=False, allow_edit=False, allow_delete=False,
        actions=[
            Action("pay", "Mark paid", "pay",
                   params=[P("mode", "Mode", "select", choices=C.PAYMENT_MODES, default="neft"), P("reference_no", "Reference", "text"),
                           P("paid_on", "Paid on", "date")],
                   when={"status": ["approved"]}, style="primary"),
            Action("cancel", "Cancel", "cancel", params=[P("reason", "Reason", "text")],
                   when={"status": ["draft", "pending_approval", "approved"]}, style="danger"),
        ],
    ),
)

# ── actions added to Phase 1 resources ──────────────────────────────────────────────────────

_res = by_key()
_res["bookings"].actions += [
    Action("finance", "Payment summary", "finance", method="GET"),
    Action("receive", "Record payment", "receive",
           params=[P("amount", "Amount received", "money", required=True), P("tds_amount", "TDS deducted by buyer (194-IA)", "money"),
                   P("mode", "Mode", "select", choices=C.PAYMENT_MODES, default="neft", required=True),
                   P("reference_no", "Cheque / UTR no.", "text"), P("bank_name", "Bank", "text"),
                   P("receipt_date", "Receipt date", "date"), P("instrument_date", "Cheque date", "date")],
           when={"status": ["confirmed", "allotted", "agreement_signed", "registered", "handed_over"]}, style="primary"),
    Action("tds_suggestion", "TDS 194-IA calculator", "tds-suggestion", method="GET",
           params=[P("amount", "Payment amount", "money", required=True)]),
    Action("raise_demands", "Raise due demands", "raise-demands",
           when={"status": ["confirmed", "allotted", "agreement_signed", "registered", "handed_over"]}),
    Action("regenerate_schedule", "Regenerate schedule", "schedule/regenerate",
           params=[P("payment_plan_id", "Payment plan", "ref", ref="payment-plans")],
           when={"status": ["confirmed", "allotted", "agreement_signed", "registered"]},
           confirm="Rebuild the instalments from the payment plan? Only possible before any demand or payment."),
]
_res["projects"].actions += [
    Action("trigger_milestone", "Milestone completed", "trigger-milestone",
           params=[P("milestone_name", "Milestone (as named in the payment plan)", "text", required=True)],
           confirm="Mark this milestone complete? Every booking waiting on it receives its demand letter."),
]
_res["brokers"].actions += [
    Action("statement", "Statement", "statement", method="GET"),
    Action("settle", "Create settlement", "settle",
           params=[P("mode", "Payment mode", "select", choices=C.PAYMENT_MODES, default="neft"), P("remarks", "Remarks", "text")],
           confirm="Settle every eligible commission and approved incentive for this broker?", style="primary"),
]
