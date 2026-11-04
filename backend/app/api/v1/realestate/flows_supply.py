"""Workflow endpoints — Phase 4b: procurement and inventory."""
from __future__ import annotations

import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.models.realestate import supply as S
from app.services.realestate import inventory as inv
from app.services.realestate.common import Ctx, get_owned

from .ctx import ctx_dep

router = APIRouter()

view = ctx_dep("realestate.view")
procure = ctx_dep("realestate.manage")
store = ctx_dep("realestate.construction")
approve = ctx_dep("realestate.approve")


class _Reason(BaseModel):
    reason: str = ""


async def _own(ctx: Ctx, model, id_: uuid.UUID, label: str):
    return await get_owned(ctx.db, model, ctx.vendor_id, id_, label)


# ═══ stock report ═══════════════════════════════════════════════════════════════════════════

@router.get("/inventory/stock-balance", summary="Current stock by store and material")
async def stock_balance(project_id: Optional[uuid.UUID] = None, store_id: Optional[uuid.UUID] = None, ctx: Ctx = Depends(view)):
    return await inv.stock_balance_report(ctx.db, ctx.vendor_id, project_id=project_id, store_id=store_id)


# ═══ requisition ════════════════════════════════════════════════════════════════════════════

@router.post("/purchase-requisitions/{pr_id}/submit")
async def pr_submit(pr_id: uuid.UUID, ctx: Ctx = Depends(procure)):
    pr = await inv.pr_submit(ctx, await _own(ctx, S.RePurchaseRequisition, pr_id, "requisition"))
    await ctx.db.commit()
    return {"message": f"{pr.pr_no} submitted for approval"}


@router.post("/purchase-requisitions/{pr_id}/approve")
async def pr_approve(pr_id: uuid.UUID, ctx: Ctx = Depends(approve)):
    pr = await inv.pr_decide(ctx, await _own(ctx, S.RePurchaseRequisition, pr_id, "requisition"), True)
    await ctx.db.commit()
    return {"message": f"{pr.pr_no} approved"}


@router.post("/purchase-requisitions/{pr_id}/reject")
async def pr_reject(pr_id: uuid.UUID, ctx: Ctx = Depends(approve)):
    pr = await inv.pr_decide(ctx, await _own(ctx, S.RePurchaseRequisition, pr_id, "requisition"), False)
    await ctx.db.commit()
    return {"message": f"{pr.pr_no} rejected"}


# ═══ RFQ ════════════════════════════════════════════════════════════════════════════════════

@router.post("/rfqs/{rfq_id}/send")
async def rfq_send(rfq_id: uuid.UUID, ctx: Ctx = Depends(procure)):
    from fastapi import HTTPException

    rfq = await _own(ctx, S.ReRfq, rfq_id, "RFQ")
    if rfq.status != "draft":
        raise HTTPException(status_code=409, detail=f"RFQ is {rfq.status}")
    rfq.status = "sent"
    await ctx.db.commit()
    return {"message": f"{rfq.rfq_no} marked as sent to suppliers"}


@router.get("/rfqs/{rfq_id}/comparison", summary="Supplier-wise quote comparison")
async def rfq_comparison(rfq_id: uuid.UUID, ctx: Ctx = Depends(view)):
    return await inv.rfq_comparison(ctx, await _own(ctx, S.ReRfq, rfq_id, "RFQ"))


class AwardIn(BaseModel):
    supplier_id: uuid.UUID
    expected_date: Optional[date] = None


@router.post("/rfqs/{rfq_id}/award")
async def rfq_award(rfq_id: uuid.UUID, body: AwardIn, ctx: Ctx = Depends(procure)):
    po = await inv.rfq_award(ctx, await _own(ctx, S.ReRfq, rfq_id, "RFQ"), body.supplier_id, body.expected_date)
    await ctx.db.commit()
    return {"message": f"Draft purchase order {po.po_no} created", "po_id": str(po.id), "po_no": po.po_no, "total_amount": po.total_amount}


@router.post("/rfqs/{rfq_id}/cancel")
async def rfq_cancel(rfq_id: uuid.UUID, ctx: Ctx = Depends(procure)):
    from fastapi import HTTPException

    rfq = await _own(ctx, S.ReRfq, rfq_id, "RFQ")
    if rfq.status not in ("draft", "sent"):
        raise HTTPException(status_code=409, detail=f"RFQ is {rfq.status}")
    rfq.status = "cancelled"
    await ctx.db.commit()
    return {"message": f"{rfq.rfq_no} cancelled"}


# ═══ purchase order ═════════════════════════════════════════════════════════════════════════

@router.post("/purchase-orders/{po_id}/submit")
async def po_submit(po_id: uuid.UUID, ctx: Ctx = Depends(procure)):
    po = await inv.po_submit(ctx, await _own(ctx, S.RePurchaseOrder, po_id, "purchase order"))
    await ctx.db.commit()
    return {"message": f"{po.po_no} is {po.status.replace('_', ' ')}", "status": po.status}


@router.post("/purchase-orders/{po_id}/cancel")
async def po_cancel(po_id: uuid.UUID, body: _Reason, ctx: Ctx = Depends(procure)):
    po = await inv.po_cancel(ctx, await _own(ctx, S.RePurchaseOrder, po_id, "purchase order"), body.reason)
    await ctx.db.commit()
    return {"message": f"{po.po_no} cancelled"}


@router.post("/purchase-orders/{po_id}/close")
async def po_close(po_id: uuid.UUID, ctx: Ctx = Depends(procure)):
    po = await inv.po_close(ctx, await _own(ctx, S.RePurchaseOrder, po_id, "purchase order"))
    await ctx.db.commit()
    return {"message": f"{po.po_no} closed"}


# ═══ GRN ════════════════════════════════════════════════════════════════════════════════════

@router.post("/grns/{grn_id}/post")
async def grn_post(grn_id: uuid.UUID, ctx: Ctx = Depends(store)):
    grn = await inv.post_grn(ctx, await _own(ctx, S.ReGrn, grn_id, "GRN"))
    await ctx.db.commit()
    return {"message": f"{grn.grn_no} posted — payable ₹{float(grn.payable_amount):,.2f}"}


@router.post("/grns/{grn_id}/cancel")
async def grn_cancel(grn_id: uuid.UUID, ctx: Ctx = Depends(store)):
    grn = await inv.grn_cancel(ctx, await _own(ctx, S.ReGrn, grn_id, "GRN"))
    await ctx.db.commit()
    return {"message": f"{grn.grn_no} cancelled"}


class PayIn(BaseModel):
    mode: str = "neft"
    reference: Optional[str] = None
    paid_on: Optional[date] = None


@router.post("/grns/{grn_id}/pay")
async def grn_pay(grn_id: uuid.UUID, body: PayIn, ctx: Ctx = Depends(procure)):
    grn = await inv.grn_pay(ctx, await _own(ctx, S.ReGrn, grn_id, "GRN"), mode=body.mode, reference=body.reference, paid_on=body.paid_on)
    await ctx.db.commit()
    return {"message": f"{grn.grn_no} marked paid"}


# ═══ issues, transfers, wastage ═════════════════════════════════════════════════════════════

@router.post("/material-issues/{issue_id}/post")
async def issue_post(issue_id: uuid.UUID, ctx: Ctx = Depends(store)):
    iss = await inv.post_issue(ctx, await _own(ctx, S.ReMaterialIssue, issue_id, "issue note"))
    await ctx.db.commit()
    return {"message": f"{iss.issue_no} issued — value ₹{float(iss.total_value):,.2f}"}


@router.post("/material-issues/{issue_id}/cancel")
async def issue_cancel(issue_id: uuid.UUID, ctx: Ctx = Depends(store)):
    iss = await _own(ctx, S.ReMaterialIssue, issue_id, "issue note")
    await inv.cancel_draft(ctx, iss, "material_issue", iss.issue_no)
    await ctx.db.commit()
    return {"message": f"{iss.issue_no} cancelled"}


@router.post("/stock-transfers/{tr_id}/post")
async def transfer_post(tr_id: uuid.UUID, ctx: Ctx = Depends(store)):
    tr = await inv.post_transfer(ctx, await _own(ctx, S.ReStockTransfer, tr_id, "transfer"))
    await ctx.db.commit()
    return {"message": f"{tr.transfer_no} transferred — value ₹{float(tr.total_value):,.2f}"}


@router.post("/stock-transfers/{tr_id}/cancel")
async def transfer_cancel(tr_id: uuid.UUID, ctx: Ctx = Depends(store)):
    tr = await _own(ctx, S.ReStockTransfer, tr_id, "transfer")
    await inv.cancel_draft(ctx, tr, "stock_transfer", tr.transfer_no)
    await ctx.db.commit()
    return {"message": f"{tr.transfer_no} cancelled"}


@router.post("/wastage/{w_id}/reverse")
async def wastage_reverse(w_id: uuid.UUID, ctx: Ctx = Depends(store)):
    await inv.wastage_reverse(ctx, await _own(ctx, S.ReWastage, w_id, "wastage"))
    await ctx.db.commit()
    return {"message": "Wastage reversed; stock restored"}
