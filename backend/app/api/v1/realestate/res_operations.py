"""Resource definitions — Phase 6: leasing (7), facility (19), society (20) and assets (21)."""
from app.models.realestate import operations as O
from app.services.realestate import assets as asv
from app.services.realestate import facility as fac
from app.services.realestate import leasing as ls
from app.services.realestate import society as soc

from . import res_core  # noqa: F401  (projects / units must be registered first)
from .crud import Action, Resource
from .registry import P, add

MANAGE = "realestate.manage"
MONEY = "realestate.collections"


def _ro(model, *keep: str) -> tuple[str, ...]:
    """Everything except ``keep`` is system-controlled."""
    return tuple(c.key for c in model.__table__.columns if c.key not in keep and c.key not in ("id", "vendor_id", "created_at", "updated_at"))


RECEIVE = [P("amount", "Amount received", "money", required=True), P("paid_on", "Received on", "date"),
           P("mode", "Mode", "select", choices=O.RENT_PAYMENT_MODES, default="neft"), P("reference", "Reference / cheque no.", "text")]

add(
    # ═══ leasing ════════════════════════════════════════════════════════════════════════════
    Resource(
        key="tenants", model=O.ReTenant, title="Tenants",
        columns=["tenant_code", "name", "tenant_type", "phone", "email", "kyc_status", "is_active"],
        search=["name", "tenant_code", "phone", "email", "pan", "business"], filters=["tenant_type", "kyc_status", "is_active"],
        number=("tenant", "tenant_code"), write_perm=MANAGE, before_delete=ls.tenant_before_delete,
    ),
    Resource(
        key="leases", model=O.ReLease, title="Lease agreements",
        columns=["lease_no", "tenant_id", "unit_id", "start_date", "end_date", "rent_amount", "security_deposit", "deposit_status", "status"],
        search=["lease_no"], filters=["status", "project_id", "tenant_id", "unit_id", "use_type", "deposit_status"], number=("lease", "lease_no"),
        readonly=("status", "project_id", "deposit_received", "deposit_deductions", "deposit_refunded", "deposit_status", "renewed_from_id",
                  "activated_on", "terminated_on", "termination_reason"),
        write_perm=MANAGE, order="-start_date", before_create=ls.lease_before_create, before_update=ls.lease_before_update,
        before_delete=ls.lease_before_delete, editable_when={"status": ["draft"]},
        actions=[
            Action("activate", "Activate", "activate", when={"status": ["draft"]}, style="primary",
                   confirm="Activate this lease? The unit is marked as leased and the rent escalation schedule is created."),
            Action("receive_deposit", "Receive deposit", "receive-deposit", when={"status": ["draft", "active"]},
                   params=[P("amount", "Amount received", "money", required=True), P("paid_on", "Received on", "date"),
                           P("mode", "Mode", "select", choices=[m for m in O.RENT_PAYMENT_MODES if m != "adjustment"], default="neft"),
                           P("reference", "Reference", "text")]),
            Action("bill_rent", "Bill rent", "bill-rent", when={"status": ["active", "expired", "terminated", "renewed"]},
                   params=[P("upto", "Bill up to (date)", "date")], style="primary"),
            Action("renew", "Renew", "renew", when={"status": ["active", "expired"]},
                   params=[P("new_end_date", "New end date", "date", required=True),
                           P("rent_increase_percent", "Rent increase %", "number", default=0)]),
            Action("terminate", "Terminate", "terminate", when={"status": ["active"]}, style="danger",
                   params=[P("terminated_on", "Termination date", "date", required=True), P("reason", "Reason", "text", required=True),
                           P("waive_lock_in", "Waive lock-in?", "select", choices=["no", "yes"], default="no")]),
            Action("refund_deposit", "Refund deposit", "refund-deposit", when={"status": ["expired", "terminated", "renewed"], "deposit_status": ["held"]},
                   params=[P("deductions", "Deductions (damages etc.)", "money", default=0), P("reason", "Reason for deductions", "text"),
                           P("adjust_dues", "Adjust unpaid rent from the deposit?", "select", choices=["no", "yes"], default="no")]),
        ],
    ),
    Resource(
        key="lease-escalations", model=O.ReLeaseEscalation, title="Rent escalations",
        columns=["lease_id", "effective_on", "percent", "old_rent", "new_rent", "status"], filters=["lease_id", "status"], order="effective_on",
        allow_create=False, allow_edit=False, allow_delete=False, write_perm=MANAGE,
    ),
    Resource(
        key="rent-invoices", model=O.ReRentInvoice, title="Rent invoices",
        columns=["invoice_no", "lease_id", "tenant_id", "period_start", "period_end", "due_date", "total_amount", "paid_amount", "status"],
        search=["invoice_no"], filters=["status", "lease_id", "tenant_id", "project_id", "unit_id"], order="-period_start",
        number=("rent_invoice", "invoice_no"), allow_create=False, allow_delete=False, write_perm=MONEY,
        readonly=_ro(O.ReRentInvoice, "due_date"), before_update=ls.invoice_before_update, editable_when={"status": ["issued", "partial"]},
        actions=[
            Action("receive", "Receive payment", "receive", when={"status": ["issued", "partial"]}, params=RECEIVE, style="primary"),
            Action("cancel", "Cancel invoice", "cancel", when={"status": ["issued"]}, style="danger", params=[P("reason", "Reason", "text", required=True)]),
        ],
    ),
    Resource(
        key="ops-receipts", model=O.ReOpsReceipt, title="Rent & maintenance receipts",
        columns=["receipt_no", "kind", "rent_invoice_id", "maintenance_bill_id", "amount", "paid_on", "mode", "reference"],
        search=["receipt_no", "reference"], filters=["kind", "mode"], order="-paid_on",
        allow_create=False, allow_edit=False, allow_delete=False, write_perm=MONEY,
    ),
    # ═══ facility ═══════════════════════════════════════════════════════════════════════════
    Resource(
        key="facility-work-orders", model=O.ReFacilityWorkOrder, title="Facility work orders",
        columns=["wo_no", "title", "category", "priority", "project_id", "unit_id", "assigned_to", "due_date", "status", "total_cost"],
        search=["wo_no", "title", "assigned_to", "reported_by"], filters=["status", "priority", "category", "project_id", "unit_id", "asset_id"],
        number=("facility_work_order", "wo_no"), order="-requested_on", write_perm=MANAGE,
        readonly=("status", "started_on", "completed_on", "labour_cost", "material_cost", "total_cost", "resolution", "pm_schedule_id"),
        before_create=fac.fwo_before_create, before_update=fac.fwo_before_update, editable_when={"status": ["open", "assigned", "in_progress"]},
        allow_delete=False,
        actions=[
            Action("assign", "Assign", "assign", when={"status": ["open", "assigned"]},
                   params=[P("assigned_to", "Assign to", "text"), P("contractor_id", "Contractor", "ref", ref="contractors")]),
            Action("start", "Start work", "start", when={"status": ["open", "assigned"]}),
            Action("complete", "Complete", "complete", when={"status": ["open", "assigned", "in_progress"]}, style="primary",
                   params=[P("resolution", "Work done", "text", required=True), P("labour_cost", "Labour cost", "money", default=0),
                           P("material_cost", "Material cost", "money", default=0)]),
            Action("close", "Close", "close", when={"status": ["completed"]}),
            Action("cancel", "Cancel", "cancel", when={"status": ["open", "assigned", "in_progress"]}, style="danger",
                   params=[P("reason", "Reason", "text", required=True)]),
        ],
    ),
    Resource(
        key="pm-schedules", model=O.RePmSchedule, title="Preventive maintenance schedules",
        columns=["name", "category", "asset_id", "unit_id", "frequency_days", "last_done_on", "next_due_on", "assigned_to", "is_active"],
        search=["name", "assigned_to"], filters=["category", "is_active", "project_id", "asset_id"], order="next_due_on",
        readonly=("last_done_on",), write_perm=MANAGE, before_create=fac.pm_before_create, before_update=fac.pm_before_update,
        actions=[Action("generate", "Create work order now", "generate", when={"is_active": [True]}, style="primary")],
    ),
    Resource(
        key="utility-meters", model=O.ReUtilityMeter, title="Utility meters",
        columns=["meter_no", "name", "utility_type", "project_id", "unit_id", "rate_per_unit", "last_reading", "last_reading_on", "is_active"],
        search=["meter_no", "name"], filters=["utility_type", "project_id", "unit_id", "is_active"], number=None,
        readonly=("last_reading", "last_reading_on"), write_perm=MANAGE, before_create=fac.meter_before_create,
        before_update=fac.meter_before_update, before_delete=fac.meter_before_delete,
    ),
    Resource(
        key="meter-readings", model=O.ReMeterReading, title="Meter readings",
        columns=["meter_id", "reading_on", "previous_reading", "reading", "consumption", "amount", "billed", "is_reset"],
        filters=["meter_id", "unit_id", "billed"], order="-reading_on", readonly=("previous_reading", "consumption", "amount", "billed", "billed_bill_id", "unit_id"),
        allow_edit=False, allow_delete=False, write_perm=MANAGE, before_create=fac.reading_before_create, after_create=fac.reading_after_create,
    ),
    Resource(
        key="housekeeping", model=O.ReHousekeepingLog, title="Housekeeping",
        columns=["area", "task", "project_id", "scheduled_on", "assigned_to", "status", "completed_on", "rating"],
        search=["area", "task", "assigned_to"], filters=["status", "project_id"], order="-scheduled_on", write_perm=MANAGE,
        readonly=("status", "completed_on", "checked_by", "rating"), before_create=fac.hk_before_create, editable_when={"status": ["scheduled"]},
        actions=[
            Action("complete", "Mark done", "complete", when={"status": ["scheduled"]}, style="primary",
                   params=[P("checked_by", "Checked by", "text"), P("rating", "Rating (1-5)", "number"), P("remarks", "Remarks", "text")]),
            Action("miss", "Mark missed", "miss", when={"status": ["scheduled"]}, params=[P("reason", "Reason", "text", required=True)]),
        ],
    ),
    Resource(
        key="security-logs", model=O.ReSecurityLog, title="Security log",
        columns=["occurred_at", "log_type", "project_id", "location", "guard_name", "severity", "details", "resolved"],
        search=["details", "guard_name", "location"], filters=["log_type", "severity", "resolved", "project_id"], order="-occurred_at",
        readonly=("action_taken",), write_perm=MANAGE, before_create=fac.security_before_create, allow_delete=False,
        actions=[Action("resolve", "Resolve", "resolve", when={"resolved": [False]}, style="primary",
                        params=[P("action_taken", "Action taken", "text", required=True)])],
    ),
    # ═══ society ════════════════════════════════════════════════════════════════════════════
    Resource(
        key="residents", model=O.ReResident, title="Residents",
        columns=["name", "unit_id", "resident_type", "phone", "is_primary", "moved_in_on", "status"],
        search=["name", "phone", "email", "vehicle_numbers"], filters=["status", "resident_type", "project_id", "unit_id", "is_primary"],
        readonly=("status", "project_id", "moved_out_on"), write_perm=MANAGE, before_create=soc.resident_before_create,
        before_update=soc.resident_before_update, allow_delete=False,
        actions=[Action("move_out", "Move out", "move-out", when={"status": ["active"]}, style="danger",
                        params=[P("moved_out_on", "Moved out on", "date")], confirm="Record this resident as moved out?")],
    ),
    Resource(
        key="maintenance-plans", model=O.ReMaintenancePlan, title="Maintenance charge plans",
        columns=["name", "project_id", "basis", "rate", "sinking_fund_rate", "frequency", "due_day", "gst_rate", "is_active"],
        search=["name"], filters=["project_id", "is_active"], write_perm=MONEY, before_create=soc.plan_before_create,
        before_update=soc.plan_before_update, before_delete=soc.plan_before_delete,
        actions=[Action("generate", "Generate bills", "generate", when={"is_active": [True]}, style="primary",
                        params=[P("month", "Billing month (YYYY-MM-01)", "date", required=True)],
                        confirm="Raise bills for every occupied unit for this period? Units already billed are skipped.")],
    ),
    Resource(
        key="maintenance-bills", model=O.ReMaintenanceBill, title="Maintenance bills",
        columns=["bill_no", "unit_id", "resident_id", "period_start", "due_date", "maintenance_amount", "sinking_fund", "utility_amount", "total_amount", "paid_amount", "status"],
        search=["bill_no"], filters=["status", "project_id", "unit_id", "plan_id"], order="-period_start", number=("maintenance_bill", "bill_no"),
        allow_create=False, allow_delete=False, write_perm=MONEY, readonly=_ro(O.ReMaintenanceBill, "due_date"),
        before_update=soc.bill_before_update, editable_when={"status": ["issued", "partial"]},
        actions=[
            Action("receive", "Receive payment", "receive", when={"status": ["issued", "partial"]}, params=RECEIVE, style="primary"),
            Action("cancel", "Cancel bill", "cancel", when={"status": ["issued"]}, style="danger", params=[P("reason", "Reason", "text", required=True)]),
        ],
    ),
    Resource(
        key="visitors", model=O.ReVisitor, title="Visitors",
        columns=["pass_no", "visitor_name", "unit_id", "purpose", "expected_on", "status", "check_in_at", "check_out_at"],
        search=["pass_no", "visitor_name", "phone", "vehicle_no"], filters=["status", "project_id", "unit_id"], order="-expected_on",
        number=("visitor_pass", "pass_no"), readonly=("status", "project_id", "check_in_at", "check_out_at"), write_perm=MANAGE,
        before_create=soc.visitor_before_create, allow_delete=False, editable_when={"status": ["expected"]},
        actions=[
            Action("check_in", "Check in", "check-in", when={"status": ["expected"]}, style="primary"),
            Action("check_out", "Check out", "check-out", when={"status": ["checked_in"]}),
            Action("deny", "Deny entry", "deny", when={"status": ["expected"]}, style="danger", params=[P("reason", "Reason", "text", required=True)]),
        ],
    ),
    Resource(
        key="notices", model=O.ReNotice, title="Community notices",
        columns=["title", "category", "project_id", "posted_on", "valid_until", "is_published"],
        search=["title", "body"], filters=["category", "project_id", "is_published"], order="-created_at", readonly=("is_published", "posted_on"),
        write_perm=MANAGE, before_create=soc.notice_before_create,
        actions=[
            Action("publish", "Publish", "publish", when={"is_published": [False]}, style="primary"),
            Action("unpublish", "Withdraw", "unpublish", when={"is_published": [True]}),
        ],
    ),
    # ═══ assets ═════════════════════════════════════════════════════════════════════════════
    Resource(
        key="assets", model=O.ReAsset, title="Assets",
        columns=["asset_code", "name", "category", "project_id", "location", "purchase_date", "purchase_cost", "next_maintenance_on", "status"],
        search=["asset_code", "name", "serial_no", "make", "model_no", "location"], filters=["category", "status", "project_id"],
        number=("asset", "asset_code"), readonly=("status", "disposed_on", "last_maintenance_on"), write_perm=MANAGE,
        before_create=asv.asset_before_create, before_update=asv.asset_before_update, before_delete=asv.asset_before_delete,
        editable_when={"status": ["active", "under_maintenance"]},
        actions=[
            Action("book_value", "Book value", "book-value", method="GET"),
            Action("to_maintenance", "Take out of service", "to-maintenance", when={"status": ["active"]}),
            Action("back_in_service", "Back in service", "back-in-service", when={"status": ["under_maintenance"]}, style="primary"),
        ],
    ),
    Resource(
        key="asset-maintenance", model=O.ReAssetMaintenance, title="Asset maintenance",
        columns=["asset_id", "kind", "performed_on", "performed_by", "cost", "next_due_on", "description"],
        search=["description", "performed_by"], filters=["asset_id", "kind"], order="-performed_on", allow_edit=False, allow_delete=False,
        write_perm=MANAGE, before_create=asv.maintenance_before_create, after_create=asv.maintenance_after_create,
    ),
    Resource(
        key="asset-transfers", model=O.ReAssetTransfer, title="Asset transfers",
        columns=["asset_id", "from_project_id", "to_project_id", "from_location", "to_location", "transfer_date", "status"],
        filters=["asset_id", "status"], order="-transfer_date", readonly=("status", "from_project_id", "from_location", "completed_on"),
        write_perm=MANAGE, before_create=asv.transfer_before_create, allow_edit=False, allow_delete=False,
        actions=[
            Action("complete", "Complete transfer", "complete", when={"status": ["pending"]}, style="primary"),
            Action("cancel", "Cancel", "cancel", when={"status": ["pending"]}, style="danger"),
        ],
    ),
    Resource(
        key="asset-disposals", model=O.ReAssetDisposal, title="Asset disposals",
        columns=["asset_id", "disposal_date", "method", "proceeds", "book_value", "gain_loss", "buyer"],
        search=["buyer", "reason"], filters=["asset_id", "method"], order="-disposal_date", readonly=("book_value", "gain_loss"),
        write_perm=MANAGE, before_create=asv.disposal_before_create, after_create=asv.disposal_after_create, allow_edit=False, allow_delete=False,
    ),
)
