"""Resource definitions — Phase 4c: contractor management (module 12)."""
from typing import Any

from fastapi import HTTPException

from app.models.realestate import contractors as K
from app.services.realestate import contracting as ct
from app.services.realestate.common import Ctx

from .crud import Action, Resource
from .registry import P, add

CONSTRUCTION = "realestate.construction"
PAY_MODES = ["neft", "rtgs", "cheque", "upi", "cash", "dd", "imps", "online"]


async def contractor_before_update(ctx: Ctx, obj: K.ReContractor, data: dict[str, Any]) -> None:
    if data.get("rating") is not None and not 1 <= int(data["rating"]) <= 5:
        raise HTTPException(status_code=422, detail="rating must be between 1 and 5")
    if "tds_percent" in data and not 0 <= data["tds_percent"] <= 100:
        raise HTTPException(status_code=422, detail="tds_percent must be between 0 and 100")


async def sc_before_delete(ctx: Ctx, obj: K.ReSubcontract) -> None:
    if obj.status != "draft":
        raise HTTPException(status_code=409, detail="Only a draft subcontract can be deleted")


add(
    Resource(
        key="contractors", model=K.ReContractor, title="Contractors",
        columns=["code", "name", "contractor_type", "trade", "status", "phone", "gstin", "pan", "tds_percent", "rating"],
        search=["code", "name", "pan", "gstin", "trade"], filters=["status", "contractor_type", "trade"],
        number=("contractor", "code"), write_perm=CONSTRUCTION,
        before_create=ct.contractor_before_create, before_update=contractor_before_update,
    ),
    Resource(
        key="subcontracts", model=K.ReSubcontract, title="Subcontracts",
        columns=["sc_no", "title", "project_id", "contractor_id", "contract_value", "variation_amount", "billed_amount", "status"],
        search=["sc_no", "title"], filters=["project_id", "contractor_id", "status", "cost_head"],
        number=("subcontract", "sc_no"), write_perm=CONSTRUCTION,
        readonly=("status", "billed_amount", "advance_recovered"),
        before_create=ct.sc_before_create, before_update=ct.sc_before_update, before_delete=sc_before_delete,
        actions=[
            Action("activate", "Activate", "activate", when={"status": ["draft"]}, style="primary"),
            Action("complete", "Complete", "complete", when={"status": ["active"]}),
            Action("terminate", "Terminate", "terminate", params=[P("reason", "Reason", "text", required=True)],
                   when={"status": ["active"]}, style="danger"),
            Action("retention", "Retention position", "retention", method="GET"),
            Action("release_retention", "Release retention", "release-retention",
                   params=[P("amount", "Amount", "number", required=True), P("remarks", "Remarks", "text")],
                   when={"status": ["completed"]}),
        ],
    ),
    Resource(
        key="work-certificates", model=K.ReWorkCertificate, title="Work certificates (RA bills)",
        columns=["cert_no", "subcontract_id", "bill_seq", "bill_date", "cumulative_work_done", "gross_amount", "net_payable", "status"],
        search=["cert_no"], filters=["subcontract_id", "project_id", "contractor_id", "status", "is_final"],
        number=("work_certificate", "cert_no"), write_perm=CONSTRUCTION,
        readonly=("status", "bill_seq", "project_id", "contractor_id", "previous_cumulative", "gross_amount", "retention_amount",
                  "gst_amount", "tds_amount", "net_payable", "approval_request_id", "approved_on", "paid_on", "payment_mode",
                  "payment_reference", "gl_entry_id"),
        before_create=ct.cert_before_create, before_update=ct.cert_before_update, editable_when={"status": ["draft"]},
        actions=[
            Action("submit", "Submit", "submit", when={"status": ["draft"]}, style="primary"),
            Action("pay", "Mark paid", "pay",
                   params=[P("mode", "Mode", "select", choices=PAY_MODES, default="neft"), P("reference", "Reference", "text"),
                           P("paid_on", "Paid on", "date")],
                   when={"status": ["approved"]}),
            Action("cancel", "Cancel", "cancel", params=[P("reason", "Reason", "text")],
                   when={"status": ["draft", "pending_approval", "rejected"]}, style="danger"),
        ],
    ),
    Resource(
        key="retention-ledger", model=K.ReRetentionEntry, title="Retention ledger",
        columns=["entry_date", "subcontract_id", "contractor_id", "kind", "amount", "remarks"],
        filters=["subcontract_id", "contractor_id", "kind"], order="-entry_date", write_perm=CONSTRUCTION,
        allow_create=False, allow_edit=False, allow_delete=False,
    ),
)
