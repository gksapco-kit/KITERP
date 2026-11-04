"""Resource definitions — Phase 4b: procurement (module 10) and material & inventory (module 11)."""
from decimal import Decimal
from typing import Any, Callable

from fastapi import HTTPException
from sqlalchemy import select

from app.models.realestate import supply as S
from app.services.realestate import inventory as inv
from app.services.realestate.common import Ctx, D, get_owned

from .crud import Action, Resource
from .registry import P, add

PROCURE = "realestate.manage"
STORE = "realestate.construction"


# ── generic guards ──────────────────────────────────────────────────────────────────────────

def draft_children(parent_model, fk_name: str, label: str, validate: Callable, recompute: Callable | None = None):
    """Hooks for a line resource: the parent must be a draft; the parent's totals are refreshed afterwards."""

    async def _parent(ctx: Ctx, parent_id):
        return await get_owned(ctx.db, parent_model, ctx.vendor_id, parent_id, label)

    async def before_create(ctx: Ctx, data: dict[str, Any]) -> None:
        await validate(ctx, data)

    async def before_update(ctx: Ctx, obj: Any, data: dict[str, Any]) -> None:
        if fk_name in data and data[fk_name] != getattr(obj, fk_name):
            raise HTTPException(status_code=409, detail=f"A line cannot move to another {label}")
        await validate(ctx, data, obj)

    async def before_delete(ctx: Ctx, obj: Any) -> None:
        parent = await _parent(ctx, getattr(obj, fk_name))
        if parent.status != "draft":
            raise HTTPException(status_code=409, detail=f"The {label} is {parent.status}; lines can no longer change")
        if recompute:
            await recompute(ctx, parent, obj)

    async def after_save(ctx: Ctx, obj: Any, *_: Any) -> None:
        if recompute:
            await recompute(ctx, await _parent(ctx, getattr(obj, fk_name)), None)

    return before_create, before_update, before_delete, after_save


async def _draft(ctx: Ctx, model, parent_id, label: str):
    parent = await get_owned(ctx.db, model, ctx.vendor_id, parent_id, label)
    if parent.status != "draft":
        raise HTTPException(status_code=409, detail=f"The {label} is {parent.status}; lines can no longer change")
    return parent


# ── master data ─────────────────────────────────────────────────────────────────────────────

async def supplier_validate(ctx: Ctx, data: dict[str, Any], obj: Any = None) -> None:
    if data.get("rating") is not None and not 1 <= int(data["rating"]) <= 5:
        raise HTTPException(status_code=422, detail="rating must be between 1 and 5")
    if int(data.get("payment_terms_days", 0) or 0) < 0:
        raise HTTPException(status_code=422, detail="payment_terms_days cannot be negative")


async def material_validate(ctx: Ctx, data: dict[str, Any], obj: Any = None) -> None:
    if "gst_percent" in data and not 0 <= D(data["gst_percent"]) <= 100:
        raise HTTPException(status_code=422, detail="gst_percent must be between 0 and 100")
    for k in ("standard_rate", "reorder_level"):
        if k in data and D(data[k]) < 0:
            raise HTTPException(status_code=422, detail=f"{k} cannot be negative")


async def _sup_create(ctx: Ctx, data):  # noqa: ANN001
    await supplier_validate(ctx, data)


async def _sup_update(ctx: Ctx, obj, data):  # noqa: ANN001
    await supplier_validate(ctx, data, obj)


async def _mat_create(ctx: Ctx, data):  # noqa: ANN001
    await material_validate(ctx, data)


async def _mat_update(ctx: Ctx, obj, data):  # noqa: ANN001
    await material_validate(ctx, data, obj)


add(
    Resource(
        key="suppliers", model=S.ReSupplier, title="Suppliers",
        columns=["code", "name", "status", "contact_person", "phone", "gstin", "payment_terms_days", "rating"],
        search=["code", "name", "gstin", "phone"], filters=["status"], number=("supplier", "code"), write_perm=PROCURE,
        before_create=_sup_create, before_update=_sup_update,
    ),
    Resource(
        key="materials", model=S.ReMaterial, title="Materials",
        columns=["code", "name", "category", "unit", "hsn_code", "gst_percent", "standard_rate", "reorder_level", "is_active"],
        search=["code", "name", "hsn_code"], filters=["category", "is_active"], number=("material", "code"), write_perm=PROCURE,
        before_create=_mat_create, before_update=_mat_update,
    ),
    Resource(
        key="site-stores", model=S.ReSiteStore, title="Site stores",
        columns=["code", "name", "project_id", "in_charge", "location", "is_active"],
        search=["code", "name"], filters=["project_id", "is_active"], number=("site_store", "code"), write_perm=STORE,
    ),
)

# ── requisition ─────────────────────────────────────────────────────────────────────────────

async def pr_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    data.setdefault("requested_by_name", ctx.actor_name)
    data["status"] = "draft"


async def pr_line_validate(ctx: Ctx, data: dict[str, Any], obj: Any = None) -> None:
    pr_id = data.get("pr_id", getattr(obj, "pr_id", None))
    await _draft(ctx, S.RePurchaseRequisition, pr_id, "requisition")
    if D(data.get("quantity", getattr(obj, "quantity", 0))) <= 0:
        raise HTTPException(status_code=422, detail="quantity must be greater than zero")
    mat = data.get("material_id")
    if mat:
        m = await ctx.db.get(S.ReMaterial, mat)
        if m is not None and not m.is_active:
            raise HTTPException(status_code=409, detail=f"{m.name} is inactive")


_pr_hooks = draft_children(S.RePurchaseRequisition, "pr_id", "requisition", pr_line_validate)

add(
    Resource(
        key="purchase-requisitions", model=S.RePurchaseRequisition, title="Purchase requisitions",
        columns=["pr_no", "project_id", "store_id", "required_by", "requested_by_name", "status"],
        search=["pr_no", "requested_by_name"], filters=["project_id", "status"], number=("purchase_requisition", "pr_no"),
        readonly=("status", "decided_by_name"), write_perm=PROCURE, before_create=pr_before_create,
        editable_when={"status": ["draft"]},
        actions=[
            Action("submit", "Submit", "submit", when={"status": ["draft"]}, style="primary"),
            Action("approve", "Approve", "approve", when={"status": ["submitted"]}, style="primary"),
            Action("reject", "Reject", "reject", when={"status": ["submitted"]}, style="danger"),
        ],
    ),
    Resource(
        key="pr-lines", model=S.RePrLine, title="Requisition lines",
        columns=["pr_id", "material_id", "quantity", "ordered_quantity", "remarks"],
        filters=["pr_id", "material_id"], order="created_at", write_perm=PROCURE, readonly=("ordered_quantity",),
        before_create=_pr_hooks[0], before_update=_pr_hooks[1], before_delete=_pr_hooks[2],
    ),
)

# ── RFQ ─────────────────────────────────────────────────────────────────────────────────────

async def rfq_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    await inv.rfq_create(ctx, data)
    data["status"] = "draft"


async def quote_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    await inv.quote_validate(ctx, data)


async def quote_before_update(ctx: Ctx, obj: Any, data: dict[str, Any]) -> None:
    await inv.quote_validate(ctx, data, obj)


async def quote_before_delete(ctx: Ctx, obj: Any) -> None:
    """Quotes that justified an award must survive: they can only be removed while the RFQ is still open."""
    rfq = await get_owned(ctx.db, S.ReRfq, ctx.vendor_id, obj.rfq_id, "RFQ")
    if rfq.status not in ("draft", "sent"):
        raise HTTPException(status_code=409, detail=f"RFQ is {rfq.status}; quotes can no longer be removed")


add(
    Resource(
        key="rfqs", model=S.ReRfq, title="RFQs",
        columns=["rfq_no", "pr_id", "project_id", "due_date", "status", "awarded_supplier_id", "po_id"],
        search=["rfq_no"], filters=["status", "project_id", "pr_id"], number=("rfq", "rfq_no"), write_perm=PROCURE,
        readonly=("status", "awarded_supplier_id", "po_id", "project_id"), before_create=rfq_before_create,
        editable_when={"status": ["draft"]},
        actions=[
            Action("send", "Mark sent", "send", when={"status": ["draft"]}),
            Action("comparison", "Compare quotes", "comparison", method="GET"),
            Action("award", "Award & create PO", "award",
                   params=[P("supplier_id", "Supplier", "ref", ref="suppliers", required=True), P("expected_date", "Expected delivery", "date")],
                   when={"status": ["draft", "sent"]}, style="primary"),
            Action("cancel", "Cancel", "cancel", when={"status": ["draft", "sent"]}, style="danger"),
        ],
    ),
    Resource(
        key="rfq-quotes", model=S.ReRfqQuote, title="RFQ quotes",
        columns=["rfq_id", "supplier_id", "pr_line_id", "rate", "gst_percent", "lead_days", "remarks"],
        filters=["rfq_id", "supplier_id"], write_perm=PROCURE, order="created_at",
        before_create=quote_before_create, before_update=quote_before_update, before_delete=quote_before_delete,
    ),
)

# ── purchase order ──────────────────────────────────────────────────────────────────────────

async def po_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    sup = await get_owned(ctx.db, S.ReSupplier, ctx.vendor_id, data["supplier_id"], "supplier")
    if sup.status == "blocked":
        raise HTTPException(status_code=409, detail="The supplier is blocked")
    if data.get("store_id"):
        store = await get_owned(ctx.db, S.ReSiteStore, ctx.vendor_id, data["store_id"], "store")
        if store.project_id and store.project_id != data["project_id"]:
            raise HTTPException(status_code=422, detail="The delivery store belongs to a different project")
    if data.get("pr_id"):
        pr = await get_owned(ctx.db, S.RePurchaseRequisition, ctx.vendor_id, data["pr_id"], "requisition")
        if pr.project_id != data["project_id"]:
            raise HTTPException(status_code=422, detail="The requisition belongs to a different project")
        if pr.status not in ("approved", "ordered"):
            raise HTTPException(status_code=409, detail=f"The requisition is {pr.status}; only approved requisitions can be ordered")
    if not data.get("payment_terms"):
        data["payment_terms"] = f"{sup.payment_terms_days} days"
    data["status"] = "draft"
    data["subtotal"] = data["gst_amount"] = data["total_amount"] = Decimal(0)


async def po_line_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    await inv.po_line_validate(ctx, data)
    mat = await get_owned(ctx.db, S.ReMaterial, ctx.vendor_id, data["material_id"], "material")
    if "gst_percent" not in data:
        data["gst_percent"] = mat.gst_percent


async def po_line_after_create(ctx: Ctx, obj: S.RePoLine) -> None:
    po = await ctx.db.get(S.RePurchaseOrder, obj.po_id)
    if obj.pr_line_id:
        pl = await ctx.db.get(S.RePrLine, obj.pr_line_id)
        if pl is not None:
            pl.ordered_quantity = D(pl.ordered_quantity) + D(obj.quantity)
    await inv.recompute_po(ctx.db, po)


async def po_line_before_update(ctx: Ctx, obj: S.RePoLine, data: dict[str, Any]) -> None:
    if "po_id" in data and data["po_id"] != obj.po_id:
        raise HTTPException(status_code=409, detail="A line cannot move to another order")
    await inv.po_line_validate(ctx, data, obj)
    pr_line = data.get("pr_line_id", obj.pr_line_id)
    if pr_line and ("quantity" in data or "pr_line_id" in data):
        old = D(obj.quantity) if obj.pr_line_id == pr_line else Decimal(0)
        pl = await ctx.db.get(S.RePrLine, pr_line)
        if pl is not None:
            pl.ordered_quantity = max(Decimal(0), D(pl.ordered_quantity) - old + D(data.get("quantity", obj.quantity)))


async def po_line_after_update(ctx: Ctx, obj: S.RePoLine, data: dict[str, Any]) -> None:
    await inv.recompute_po(ctx.db, await ctx.db.get(S.RePurchaseOrder, obj.po_id))


async def po_line_before_delete(ctx: Ctx, obj: S.RePoLine) -> None:
    po = await _draft(ctx, S.RePurchaseOrder, obj.po_id, "purchase order")
    if obj.pr_line_id:
        pl = await ctx.db.get(S.RePrLine, obj.pr_line_id)
        if pl is not None:
            pl.ordered_quantity = max(Decimal(0), D(pl.ordered_quantity) - D(obj.quantity))
    await inv.recompute_po(ctx.db, po, exclude_line=obj.id)


add(
    Resource(
        key="purchase-orders", model=S.RePurchaseOrder, title="Purchase orders",
        columns=["po_no", "project_id", "supplier_id", "order_date", "expected_date", "total_amount", "status"],
        search=["po_no"], filters=["project_id", "supplier_id", "status"], number=("purchase_order", "po_no"),
        readonly=("status", "subtotal", "gst_amount", "total_amount", "approval_request_id", "rfq_id"), write_perm=PROCURE,
        before_create=po_before_create, editable_when={"status": ["draft"]},
        actions=[
            Action("submit", "Submit for approval", "submit", when={"status": ["draft"]}, style="primary"),
            Action("cancel", "Cancel", "cancel", params=[P("reason", "Reason", "text")],
                   when={"status": ["draft", "pending_approval", "approved"]}, style="danger"),
            Action("close", "Short-close", "close", when={"status": ["approved", "partially_received", "received"]},
                   confirm="Close the order? Nothing further can be received against it."),
        ],
    ),
    Resource(
        key="po-lines", model=S.RePoLine, title="PO lines",
        columns=["po_id", "material_id", "quantity", "rate", "gst_percent", "amount", "received_quantity"],
        filters=["po_id", "material_id"], order="created_at", write_perm=PROCURE, readonly=("amount", "received_quantity"),
        before_create=po_line_before_create, after_create=po_line_after_create, before_update=po_line_before_update,
        after_update=po_line_after_update, before_delete=po_line_before_delete,
    ),
)

# ── GRN ─────────────────────────────────────────────────────────────────────────────────────

async def grn_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    await inv.grn_create(ctx, data)


async def _grn_validate(ctx: Ctx, data: dict[str, Any], obj: Any = None) -> None:
    await inv.grn_line_validate(ctx, data, obj)


_grn_hooks = draft_children(S.ReGrn, "grn_id", "GRN", _grn_validate)

add(
    Resource(
        key="grns", model=S.ReGrn, title="Goods receipts (GRN)",
        columns=["grn_no", "po_id", "supplier_id", "store_id", "received_on", "challan_no", "payable_amount", "status", "payment_status"],
        search=["grn_no", "challan_no", "invoice_no", "vehicle_no"], filters=["status", "po_id", "store_id", "payment_status", "project_id"],
        number=("grn", "grn_no"), write_perm=STORE,
        readonly=("status", "supplier_id", "project_id", "total_value", "gst_amount", "payable_amount", "payment_status", "paid_on",
                  "payment_mode", "payment_reference", "gl_entry_id"),
        before_create=grn_before_create, editable_when={"status": ["draft"]},
        actions=[
            Action("post", "Post to stock", "post", when={"status": ["draft"]}, style="primary",
                   confirm="Post the receipt? Stock increases and the payable is booked."),
            Action("cancel", "Cancel", "cancel", when={"status": ["draft"]}, style="danger"),
            Action("pay", "Mark paid", "pay",
                   params=[P("mode", "Mode", "select", choices=["neft", "rtgs", "cheque", "upi", "cash", "dd", "imps", "online"], default="neft"),
                           P("reference", "Reference", "text"), P("paid_on", "Paid on", "date")],
                   when={"status": ["posted"]}),
        ],
    ),
    Resource(
        key="grn-lines", model=S.ReGrnLine, title="GRN lines",
        columns=["grn_id", "po_line_id", "material_id", "received_quantity", "accepted_quantity", "rejected_quantity", "rate", "amount"],
        filters=["grn_id", "material_id"], order="created_at", write_perm=STORE, readonly=("material_id", "rejected_quantity", "amount"),
        before_create=_grn_hooks[0], before_update=_grn_hooks[1], before_delete=_grn_hooks[2],
    ),
)

# ── stock ledger, issues, transfers, wastage ───────────────────────────────────────────────

async def issue_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    store = await get_owned(ctx.db, S.ReSiteStore, ctx.vendor_id, data["store_id"], "store")
    if store.project_id and store.project_id != data["project_id"]:
        raise HTTPException(status_code=422, detail="The store belongs to a different project")
    data["status"] = "draft"
    data["total_value"] = Decimal(0)


async def transfer_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    if data["from_store_id"] == data["to_store_id"]:
        raise HTTPException(status_code=422, detail="Source and destination stores must differ")
    for k in ("from_store_id", "to_store_id"):
        await get_owned(ctx.db, S.ReSiteStore, ctx.vendor_id, data[k], "store")
    data["status"] = "draft"
    data["total_value"] = Decimal(0)


_issue_hooks = draft_children(S.ReMaterialIssue, "issue_id", "issue note", inv.issue_line_validate)
_transfer_hooks = draft_children(S.ReStockTransfer, "transfer_id", "transfer", inv.transfer_line_validate)

add(
    Resource(
        key="stock-ledger", model=S.ReStockLedger, title="Stock ledger",
        columns=["txn_date", "store_id", "material_id", "txn_type", "quantity", "rate", "value", "balance_quantity", "reference_no"],
        search=["reference_no"], filters=["store_id", "material_id", "txn_type"], order="-created_at", write_perm=STORE,
        allow_create=False, allow_edit=False, allow_delete=False, audit=False,
    ),
    Resource(
        key="material-issues", model=S.ReMaterialIssue, title="Material issues",
        columns=["issue_no", "project_id", "store_id", "issued_on", "issued_to", "total_value", "status"],
        search=["issue_no", "issued_to"], filters=["project_id", "store_id", "status"], number=("material_issue", "issue_no"),
        readonly=("status", "total_value"), write_perm=STORE, before_create=issue_before_create,
        editable_when={"status": ["draft"]},
        actions=[
            Action("post", "Issue stock", "post", when={"status": ["draft"]}, style="primary"),
            Action("cancel", "Cancel", "cancel", when={"status": ["draft"]}, style="danger"),
        ],
    ),
    Resource(
        key="issue-lines", model=S.ReIssueLine, title="Issue lines",
        columns=["issue_id", "material_id", "quantity", "rate", "amount"], filters=["issue_id", "material_id"],
        order="created_at", write_perm=STORE, readonly=("rate", "amount"),
        before_create=_issue_hooks[0], before_update=_issue_hooks[1], before_delete=_issue_hooks[2],
    ),
    Resource(
        key="stock-transfers", model=S.ReStockTransfer, title="Stock transfers",
        columns=["transfer_no", "from_store_id", "to_store_id", "transfer_date", "total_value", "status"],
        search=["transfer_no"], filters=["from_store_id", "to_store_id", "status"], number=("stock_transfer", "transfer_no"),
        readonly=("status", "total_value"), write_perm=STORE, before_create=transfer_before_create,
        editable_when={"status": ["draft"]},
        actions=[
            Action("post", "Transfer stock", "post", when={"status": ["draft"]}, style="primary"),
            Action("cancel", "Cancel", "cancel", when={"status": ["draft"]}, style="danger"),
        ],
    ),
    Resource(
        key="transfer-lines", model=S.ReTransferLine, title="Transfer lines",
        columns=["transfer_id", "material_id", "quantity", "rate", "amount"], filters=["transfer_id", "material_id"],
        order="created_at", write_perm=STORE, readonly=("rate", "amount"),
        before_create=_transfer_hooks[0], before_update=_transfer_hooks[1], before_delete=_transfer_hooks[2],
    ),
    Resource(
        key="wastage", model=S.ReWastage, title="Wastage",
        columns=["wastage_date", "store_id", "material_id", "quantity", "value", "reason", "status"],
        search=["remarks"], filters=["store_id", "material_id", "reason", "status", "project_id"], order="-wastage_date",
        readonly=("status", "rate", "value"), write_perm=STORE, allow_edit=False, allow_delete=False,
        before_create=inv.wastage_before_create, after_create=inv.wastage_after_create,
        actions=[Action("reverse", "Reverse", "reverse", when={"status": ["posted"]}, style="danger",
                        confirm="Return the written-off quantity to stock?")],
    ),
)
