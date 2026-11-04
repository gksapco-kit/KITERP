"""Resource definitions — Phase 5: handover & possession (module 17) and customer care (module 18)."""
from app.models.realestate import postsales as S
from app.services.realestate import postsales as ps

from . import res_core  # noqa: F401  (the customers resource must be registered before we extend it)
from .crud import Action, Resource
from .registry import P, add, by_key

HANDOVER = "realestate.booking"
CARE = "realestate.manage"
PRIORITY_DEFAULT = "medium"

add(
    Resource(
        key="handovers", model=S.ReHandover, title="Handovers",
        columns=["handover_no", "booking_id", "customer_id", "scheduled_on", "inspection_on", "offered_on", "handed_over_on", "status"],
        search=["handover_no", "received_by_name"], filters=["status", "project_id", "customer_id"], number=("handover", "handover_no"),
        readonly=("status", "project_id", "unit_id", "customer_id", "offered_on", "handed_over_on", "oc_waived", "dues_waived",
                  "waiver_reason", "customer_acknowledged", "handed_over_by_name", "received_by_name"),
        json_fields=("checklist",), write_perm=HANDOVER, before_create=ps.handover_before_create,
        before_update=ps.handover_before_update, editable_when={"status": ["scheduled", "inspection", "ready"]},
        actions=[
            Action("readiness", "Readiness check", "readiness", method="GET"),
            Action("inspect", "Start inspection", "inspect", params=[P("inspection_on", "Inspection date", "date")],
                   when={"status": ["scheduled"]}, style="primary"),
            Action("offer", "Offer possession", "offer",
                   params=[P("waive_oc", "Waive missing occupancy certificate?", "select", choices=["no", "yes"], default="no"),
                           P("reason", "Reason (only if waiving)", "text")],
                   when={"status": ["inspection"]}, style="primary",
                   confirm="Offer possession? The final (on-possession) instalment is demanded now."),
            Action("complete", "Hand over possession", "complete",
                   params=[P("received_by_name", "Received by", "text", required=True), P("keys_count", "Keys handed over", "number"),
                           P("electricity_meter_reading", "Electricity meter reading", "text"), P("water_meter_reading", "Water meter reading", "text"),
                           P("waive_dues", "Hand over with dues outstanding?", "select", choices=["no", "yes"], default="no"),
                           P("reason", "Reason (only if waiving)", "text")],
                   when={"status": ["ready"]}, style="primary"),
            Action("cancel", "Cancel", "cancel", params=[P("reason", "Reason", "text", required=True)],
                   when={"status": ["scheduled", "inspection", "ready"]}, style="danger"),
        ],
    ),
    Resource(
        key="snags", model=S.ReSnag, title="Snag list",
        columns=["unit_id", "handover_id", "category", "location", "severity", "status", "due_date", "assigned_to"],
        search=["description", "location", "assigned_to"], filters=["status", "severity", "category", "handover_id", "project_id"],
        readonly=("status", "project_id", "unit_id", "customer_id", "rectified_on", "verified_on", "resolution"),
        write_perm=CARE, before_create=ps.snag_before_create, before_update=ps.snag_before_update,
        editable_when={"status": ["open", "in_progress", "rectified"]},
        actions=[
            Action("assign", "Assign", "assign",
                   params=[P("assigned_to", "Assign to", "text"), P("contractor_id", "Contractor", "ref", ref="contractors"),
                           P("due_date", "Due date", "date")], when={"status": ["open", "in_progress"]}, style="primary"),
            Action("rectify", "Mark rectified", "rectify", params=[P("resolution", "Work done", "text", required=True)],
                   when={"status": ["open", "in_progress"]}),
            Action("verify", "Verify (customer OK)", "verify", when={"status": ["rectified"]}, style="primary"),
            Action("reopen", "Reopen", "reopen", params=[P("reason", "Reason", "text", required=True)],
                   when={"status": ["rectified", "verified", "waived"]}, style="danger"),
            Action("waive", "Accept as is", "waive", params=[P("reason", "Reason", "text", required=True)],
                   when={"status": ["open", "in_progress"]}),
        ],
    ),
    Resource(
        key="warranties", model=S.ReWarranty, title="Defect liability & warranty",
        columns=["unit_id", "customer_id", "coverage", "starts_on", "ends_on", "months", "statutory", "status"],
        search=["terms"], filters=["status", "coverage", "project_id", "customer_id", "booking_id"], order="ends_on",
        readonly=("status", "project_id", "unit_id", "customer_id"), write_perm=CARE,
        before_create=ps.warranty_before_create, before_update=ps.warranty_before_update,
        actions=[
            Action("claim", "Raise claim", "claim",
                   params=[P("subject", "Defect", "text", required=True), P("description", "Details", "text"),
                           P("priority", "Priority", "select", choices=S.TICKET_PRIORITIES, default=PRIORITY_DEFAULT)],
                   when={"status": ["active"]}, style="primary"),
            Action("void", "Void", "void", params=[P("reason", "Reason", "text", required=True)],
                   when={"status": ["active"]}, style="danger"),
        ],
    ),
    Resource(
        key="tickets", model=S.ReTicket, title="Complaints & requests",
        columns=["ticket_no", "customer_id", "subject", "category", "priority", "status", "assigned_to_name", "due_at"],
        search=["ticket_no", "subject", "description", "assigned_to_name"],
        filters=["status", "priority", "category", "project_id", "customer_id", "booking_id"], number=("ticket", "ticket_no"),
        readonly=("status", "project_id", "unit_id", "warranty_id", "sla_hours", "due_at", "first_response_at", "resolved_at", "closed_at",
                  "resolution", "reopen_count", "sla_breached"),
        write_perm=CARE, before_create=ps.ticket_before_create, after_create=ps.ticket_after_create,
        before_update=ps.ticket_before_update, allow_delete=False,
        editable_when={"status": ["open", "in_progress", "waiting_customer", "resolved"]},
        actions=[
            Action("assign", "Assign", "assign", params=[P("assignee", "Assign to", "text", required=True)],
                   when={"status": ["open", "in_progress", "waiting_customer"]}, style="primary"),
            Action("wait", "Waiting on customer", "wait", when={"status": ["open", "in_progress"]}),
            Action("resolve", "Resolve", "resolve", params=[P("resolution", "Resolution", "text", required=True)],
                   when={"status": ["open", "in_progress", "waiting_customer"]}, style="primary"),
            Action("close", "Close", "close", when={"status": ["resolved"]}),
            Action("reopen", "Reopen", "reopen", params=[P("reason", "Reason", "text", required=True)],
                   when={"status": ["resolved", "closed"]}, style="danger"),
        ],
    ),
    Resource(
        key="ticket-comments", model=S.ReTicketComment, title="Ticket conversation",
        columns=["ticket_id", "author_type", "author_name", "body", "is_internal", "created_at"],
        search=["body"], filters=["ticket_id", "author_type", "is_internal"], order="created_at", readonly=("author_type", "author_name"),
        write_perm=CARE, allow_edit=False, allow_delete=False, before_create=ps.comment_before_create, after_create=ps.comment_after_create,
    ),
    Resource(
        key="feedback", model=S.ReFeedback, title="Customer feedback",
        columns=["customer_id", "kind", "rating", "nps", "comments", "submitted_via", "created_at"],
        search=["comments"], filters=["kind", "rating", "project_id", "customer_id"], readonly=("submitted_via", "project_id"),
        write_perm=CARE, allow_edit=False, before_create=ps.feedback_before_create,
    ),
)

_res = by_key()
_res["customers"].readonly = tuple(_res["customers"].readonly) + ("portal_enabled",)
_res["customers"].actions += [
    Action("portal_link", "Customer portal link", "portal-link", result="html",
           params=[P("days", "Valid for (days)", "number", default=30)],
           confirm="Create a new private portal link? Any earlier link for this customer stops working."),
    Action("portal_revoke", "Revoke portal access", "portal-revoke", style="danger", when=None,
           confirm="Revoke this customer's portal access?"),
]
_res["bookings"].actions += [
    Action("schedule_handover", "Schedule handover", "schedule-handover", params=[P("scheduled_on", "Scheduled for", "date")],
           when={"status": ["registered"]}),
]
