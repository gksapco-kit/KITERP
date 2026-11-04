"""Resource definitions — Phase 7: HR & workforce (module 22)."""
from app.models.realestate import operations as O
from app.models.realestate import workforce as W
from app.services.realestate import workforce as wf

from . import res_core  # noqa: F401  (projects must be registered before we extend it)
from .crud import Action, Resource
from .registry import P, add, by_key

MANAGE = "realestate.manage"
PAY = "realestate.construction"


def _ro(model, *keep: str) -> tuple[str, ...]:
    return tuple(c.key for c in model.__table__.columns if c.key not in keep and c.key not in ("id", "vendor_id", "created_at", "updated_at"))


add(
    Resource(
        key="site-assignments", model=W.ReSiteAssignment, title="Employees on site",
        columns=["employee_name", "employee_code", "designation", "project_id", "site_role", "from_date", "to_date", "status"],
        search=["employee_name", "employee_code", "designation", "site_role"], filters=["project_id", "status", "employee_id"], order="-from_date",
        readonly=("status",), write_perm=MANAGE, before_create=wf.assignment_before_create, before_update=wf.assignment_before_update,
        editable_when={"status": ["active"]},
        actions=[Action("end", "End assignment", "end", when={"status": ["active"]}, params=[P("to_date", "Last day on site", "date")], style="danger")],
    ),
    Resource(
        key="labour", model=W.ReLabour, title="Site labour",
        columns=["labour_code", "name", "trade", "skill_level", "project_id", "contractor_id", "daily_wage", "status"],
        search=["name", "labour_code", "phone"], filters=["trade", "skill_level", "project_id", "contractor_id", "status"], number=("labour", "labour_code"),
        readonly=("status", "left_on"), write_perm=MANAGE, before_create=wf.labour_before_create, before_update=wf.labour_before_update,
        before_delete=wf.labour_before_delete,
        actions=[Action("release", "Mark as left", "release", when={"status": ["active"]}, params=[P("left_on", "Last working day", "date")], style="danger")],
    ),
    Resource(
        key="labour-attendance", model=W.ReLabourAttendance, title="Labour attendance",
        columns=["work_date", "labour_id", "project_id", "status", "overtime_hours", "locked"],
        filters=["labour_id", "project_id", "status", "work_date", "locked"], order="-work_date", readonly=("locked", "wage_sheet_id"),
        write_perm=MANAGE, before_create=wf.attendance_before_create, before_update=wf.attendance_before_update,
        editable_when={"locked": [False]},
    ),
    Resource(
        key="wage-sheets", model=W.ReWageSheet, title="Wage sheets",
        columns=["sheet_no", "project_id", "contractor_id", "period_from", "period_to", "workers", "total_gross", "total_deductions", "total_net", "status"],
        search=["sheet_no"], filters=["project_id", "contractor_id", "status"], order="-period_to", number=("wage_sheet", "sheet_no"),
        allow_create=False, allow_edit=False, allow_delete=False, write_perm=PAY,
        actions=[
            Action("approve", "Approve", "approve", when={"status": ["draft"]}, style="primary",
                   confirm="Approve this wage sheet? Deductions can no longer change."),
            Action("pay", "Mark paid", "pay", when={"status": ["approved"]}, style="primary",
                   params=[P("mode", "Mode", "select", choices=[m for m in O.RENT_PAYMENT_MODES if m != "adjustment"], default="neft"),
                           P("paid_on", "Paid on", "date"), P("reference", "Reference", "text")]),
            Action("cancel", "Cancel", "cancel", when={"status": ["draft", "approved"]}, style="danger",
                   params=[P("reason", "Reason", "text", required=True)],
                   confirm="Cancel this wage sheet? The attendance in it becomes payable again."),
        ],
    ),
    Resource(
        key="wage-lines", model=W.ReWageLine, title="Wage sheet lines",
        columns=["sheet_id", "labour_id", "days_worked", "overtime_hours", "daily_wage", "gross_amount", "advance_recovery", "other_deduction", "net_amount"],
        filters=["sheet_id", "labour_id"], order="created_at", readonly=_ro(W.ReWageLine, "advance_recovery", "other_deduction"),
        allow_create=False, allow_delete=False, write_perm=PAY, before_update=wf.line_before_update, after_update=wf.line_after_update,
    ),
)

_res = by_key()
_res["projects"].actions += [
    Action("generate_wages", "Generate wage sheet", "generate-wages",
           params=[P("period_from", "From", "date", required=True), P("period_to", "To", "date", required=True),
                   P("contractor_id", "Contractor (blank = direct labour)", "ref", ref="contractors")],
           confirm="Calculate wages from unpaid attendance for this period?"),
    Action("mark_present", "Mark site labour present", "mark-present",
           params=[P("work_date", "Date (blank = today)", "date")],
           confirm="Mark every active worker of this project present for the day, unless already recorded? Fix exceptions afterwards."),
]
