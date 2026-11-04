"""Modules 10 & 11 — procurement (PR → RFQ → PO), goods receipt and the weighted-average stock engine."""
from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.realestate import supply as S
from app.models.realestate.admin import ReApprovalRequest

from . import finance_bridge as gl
from .approvals import register_handler, request_approval
from .common import Ctx, D, audit, get_owned, jsonable, money_q, next_number, notify

EPS = Decimal("0.0005")
RECEIPT_TOLERANCE_PERCENT = Decimal(5)  # over-delivery allowed against a PO line


def _f(v: Any) -> float:
    return float(D(v))


def _q(v: Any) -> Decimal:
    return D(v).quantize(Decimal("0.001"))


# ═══ stock engine ═══════════════════════════════════════════════════════════════════════════

async def _balance(db: AsyncSession, vendor_id: UUID, store_id: UUID, material_id: UUID) -> S.ReStockBalance:
    """The locked balance row for a store/material pair, created on first use (safe against a concurrent first use)."""
    stmt = (
        select(S.ReStockBalance).where(S.ReStockBalance.store_id == store_id, S.ReStockBalance.material_id == material_id)
        .with_for_update()
    )
    bal = (await db.execute(stmt)).scalar_one_or_none()
    if bal is None:
        try:
            async with db.begin_nested():
                bal = S.ReStockBalance(id=uuid.uuid4(), vendor_id=vendor_id, store_id=store_id, material_id=material_id,
                                       quantity=Decimal(0), avg_rate=Decimal(0), value=Decimal(0))
                db.add(bal)
                await db.flush()
        except IntegrityError:  # another transaction created it first: lock and use theirs
            bal = (await db.execute(stmt)).scalar_one()
    return bal


async def stock_txn(
    ctx: Ctx, *, store_id: UUID, material_id: UUID, quantity: Decimal, txn_type: str, txn_date: date,
    reference_type: str, reference_id: UUID, reference_no: str, rate: Optional[Decimal] = None, remarks: Optional[str] = None,
) -> S.ReStockLedger:
    """Post one stock movement. ``quantity`` is signed (+ in / - out). Outward moves are valued at the moving average."""
    import uuid

    q = _q(quantity)
    if q == 0:
        raise HTTPException(status_code=422, detail="Quantity cannot be zero")
    bal = await _balance(ctx.db, ctx.vendor_id, store_id, material_id)
    if q > 0:
        r = D(rate) if rate is not None else D(bal.avg_rate)
        value = money_q(q * r)
        bal.quantity = D(bal.quantity) + q
        bal.value = D(bal.value) + value
        bal.avg_rate = money_q(D(bal.value) / D(bal.quantity)) if D(bal.quantity) > 0 else Decimal(0)
    else:
        out = -q
        if D(bal.quantity) + EPS < out:
            mat = await ctx.db.get(S.ReMaterial, material_id)
            raise HTTPException(
                status_code=409,
                detail=f"Insufficient stock of {mat.name if mat else 'material'}: {D(bal.quantity):g} available, {out:g} needed",
            )
        r = D(bal.avg_rate)
        value = -money_q(out * r)
        bal.quantity = D(bal.quantity) - out
        bal.value = D(bal.value) + value
        if D(bal.quantity) <= EPS:
            bal.quantity, bal.value = Decimal(0), Decimal(0)
    led = S.ReStockLedger(
        id=uuid.uuid4(), vendor_id=ctx.vendor_id, store_id=store_id, material_id=material_id, txn_date=txn_date,
        txn_type=txn_type, quantity=q, rate=r, value=value, balance_quantity=bal.quantity, balance_value=bal.value,
        reference_type=reference_type, reference_id=reference_id, reference_no=reference_no, remarks=remarks,
    )
    ctx.db.add(led)
    await ctx.db.flush()
    return led


async def stock_balance_report(db: AsyncSession, vendor_id: UUID, *, project_id: Optional[UUID] = None, store_id: Optional[UUID] = None) -> dict:
    q = select(S.ReStockBalance, S.ReMaterial, S.ReSiteStore).join(
        S.ReMaterial, S.ReMaterial.id == S.ReStockBalance.material_id).join(
        S.ReSiteStore, S.ReSiteStore.id == S.ReStockBalance.store_id).where(S.ReStockBalance.vendor_id == vendor_id)
    if project_id:
        q = q.where(S.ReSiteStore.project_id == project_id)
    if store_id:
        q = q.where(S.ReStockBalance.store_id == store_id)
    rows, total, low = [], Decimal(0), 0
    for bal, mat, store in (await db.execute(q.order_by(S.ReSiteStore.name, S.ReMaterial.name))).all():
        is_low = D(mat.reorder_level) > 0 and D(bal.quantity) <= D(mat.reorder_level)
        low += 1 if is_low else 0
        total += D(bal.value)
        rows.append({
            "store_id": str(store.id), "store": store.name, "material_id": str(mat.id), "material": mat.name, "code": mat.code,
            "unit": mat.unit, "quantity": _f(bal.quantity), "avg_rate": _f(bal.avg_rate), "value": _f(bal.value),
            "reorder_level": _f(mat.reorder_level), "low_stock": is_low,
        })
    return {"rows": rows, "total_value": _f(total), "low_stock_count": low}


# ═══ purchase requisition ═══════════════════════════════════════════════════════════════════

async def pr_submit(ctx: Ctx, pr: S.RePurchaseRequisition) -> S.RePurchaseRequisition:
    if pr.status != "draft":
        raise HTTPException(status_code=409, detail=f"Requisition is {pr.status}")
    n = (await ctx.db.execute(select(func.count()).select_from(S.RePrLine).where(S.RePrLine.pr_id == pr.id))).scalar_one()
    if not n:
        raise HTTPException(status_code=409, detail="Add at least one material line before submitting")
    pr.status = "submitted"
    await audit(ctx, "purchase_requisition", pr.id, "submit", ref=pr.pr_no)
    return pr


async def pr_decide(ctx: Ctx, pr: S.RePurchaseRequisition, approve: bool) -> S.RePurchaseRequisition:
    if pr.status != "submitted":
        raise HTTPException(status_code=409, detail=f"Requisition is {pr.status}")
    pr.status = "approved" if approve else "rejected"
    pr.decided_by_name = ctx.actor_name
    await audit(ctx, "purchase_requisition", pr.id, "approve" if approve else "reject", ref=pr.pr_no)
    return pr


# ═══ RFQ ════════════════════════════════════════════════════════════════════════════════════

async def rfq_create(ctx: Ctx, data: dict[str, Any]) -> None:
    pr = await get_owned(ctx.db, S.RePurchaseRequisition, ctx.vendor_id, data["pr_id"], "requisition")
    if pr.status != "approved":
        raise HTTPException(status_code=409, detail=f"An RFQ can be raised only for an approved requisition (this one is {pr.status})")
    data["project_id"] = pr.project_id


async def quote_validate(ctx: Ctx, data: dict[str, Any], obj: Optional[S.ReRfqQuote] = None) -> None:
    def val(k: str):
        return data.get(k, getattr(obj, k, None))

    rfq = await get_owned(ctx.db, S.ReRfq, ctx.vendor_id, val("rfq_id"), "RFQ")
    if rfq.status not in ("draft", "sent"):
        raise HTTPException(status_code=409, detail=f"RFQ is {rfq.status}; quotes can no longer change")
    line = await ctx.db.get(S.RePrLine, val("pr_line_id"))
    if line is None or line.pr_id != rfq.pr_id:
        raise HTTPException(status_code=422, detail="The line does not belong to this RFQ's requisition")
    sup = await ctx.db.get(S.ReSupplier, val("supplier_id"))
    if sup is None or sup.vendor_id != ctx.vendor_id or sup.status == "blocked":
        raise HTTPException(status_code=422, detail="The supplier is blocked or unknown")
    if D(val("rate")) <= 0:
        raise HTTPException(status_code=422, detail="rate must be greater than zero")
    dup = select(func.count()).select_from(S.ReRfqQuote).where(
        S.ReRfqQuote.rfq_id == rfq.id, S.ReRfqQuote.supplier_id == val("supplier_id"), S.ReRfqQuote.pr_line_id == val("pr_line_id"))
    if obj is not None:
        dup = dup.where(S.ReRfqQuote.id != obj.id)
    if (await ctx.db.execute(dup)).scalar_one():
        raise HTTPException(status_code=409, detail="This supplier has already quoted for the line; edit the existing quote")


async def rfq_comparison(ctx: Ctx, rfq: S.ReRfq) -> dict:
    lines = (await ctx.db.execute(select(S.RePrLine).where(S.RePrLine.pr_id == rfq.pr_id))).scalars().all()
    quotes = (await ctx.db.execute(select(S.ReRfqQuote).where(S.ReRfqQuote.rfq_id == rfq.id))).scalars().all()
    mats = {m.id: m for m in (await ctx.db.execute(select(S.ReMaterial).where(S.ReMaterial.vendor_id == ctx.vendor_id))).scalars().all()}
    sups = {s.id: s for s in (await ctx.db.execute(select(S.ReSupplier).where(S.ReSupplier.vendor_id == ctx.vendor_id))).scalars().all()}
    by_line: dict[UUID, list[S.ReRfqQuote]] = defaultdict(list)
    for q in quotes:
        by_line[q.pr_line_id].append(q)
    totals: dict[UUID, Decimal] = defaultdict(Decimal)
    covered: dict[UUID, int] = defaultdict(int)
    line_rows = []
    for ln in lines:
        qs = sorted(by_line.get(ln.id, []), key=lambda x: D(x.rate) * (1 + D(x.gst_percent) / 100))
        best = qs[0] if qs else None
        for q in qs:
            totals[q.supplier_id] += D(ln.quantity) * D(q.rate) * (1 + D(q.gst_percent) / 100)
            covered[q.supplier_id] += 1
        line_rows.append({
            "pr_line_id": str(ln.id), "material": mats[ln.material_id].name if ln.material_id in mats else "", "quantity": _f(ln.quantity),
            "quotes": [{"supplier": sups[q.supplier_id].name if q.supplier_id in sups else "", "supplier_id": str(q.supplier_id),
                        "rate": _f(q.rate), "gst_percent": _f(q.gst_percent), "lead_days": q.lead_days, "lowest": q is best} for q in qs],
        })
    suppliers = [
        {"supplier_id": str(sid), "supplier": sups[sid].name if sid in sups else "", "total_with_gst": _f(money_q(t)),
         "lines_quoted": covered[sid], "complete": covered[sid] == len(lines)}
        for sid, t in totals.items()
    ]
    suppliers.sort(key=lambda s: (not s["complete"], s["total_with_gst"]))
    return {"rfq_no": rfq.rfq_no, "status": rfq.status, "lines": line_rows, "suppliers": suppliers,
            "recommended_supplier_id": next((s["supplier_id"] for s in suppliers if s["complete"]), None)}


async def rfq_award(ctx: Ctx, rfq: S.ReRfq, supplier_id: UUID, expected_date: Optional[date] = None) -> S.RePurchaseOrder:
    import uuid

    if rfq.status not in ("draft", "sent"):
        raise HTTPException(status_code=409, detail=f"RFQ is {rfq.status}")
    pr = await get_owned(ctx.db, S.RePurchaseRequisition, ctx.vendor_id, rfq.pr_id, "requisition")
    sup = await get_owned(ctx.db, S.ReSupplier, ctx.vendor_id, supplier_id, "supplier")
    if sup.status == "blocked":
        raise HTTPException(status_code=409, detail="The supplier is blocked")
    lines = (await ctx.db.execute(select(S.RePrLine).where(S.RePrLine.pr_id == pr.id))).scalars().all()
    quotes = {q.pr_line_id: q for q in (await ctx.db.execute(select(S.ReRfqQuote).where(
        S.ReRfqQuote.rfq_id == rfq.id, S.ReRfqQuote.supplier_id == supplier_id))).scalars().all()}
    open_lines = [ln for ln in lines if D(ln.quantity) - D(ln.ordered_quantity) > EPS]
    missing = [ln for ln in open_lines if ln.id not in quotes]
    if not open_lines:
        raise HTTPException(status_code=409, detail="Every line of the requisition is already ordered")
    if missing:
        raise HTTPException(status_code=409, detail=f"{sup.name} has not quoted {len(missing)} line(s); get complete quotes or award elsewhere")
    po = S.RePurchaseOrder(
        id=uuid.uuid4(), vendor_id=ctx.vendor_id, po_no=await next_number(ctx.db, ctx.vendor_id, "purchase_order"),
        project_id=pr.project_id, supplier_id=sup.id, store_id=pr.store_id, pr_id=pr.id, rfq_id=rfq.id,
        order_date=date.today(), expected_date=expected_date or (date.today() + timedelta(days=max((q.lead_days for q in quotes.values()), default=7))),
        status="draft", payment_terms=f"{sup.payment_terms_days} days", subtotal=0, gst_amount=0, total_amount=0,
    )
    ctx.db.add(po)
    await ctx.db.flush()
    for ln in open_lines:
        q = quotes[ln.id]
        qty = D(ln.quantity) - D(ln.ordered_quantity)
        ctx.db.add(S.RePoLine(
            id=uuid.uuid4(), vendor_id=ctx.vendor_id, po_id=po.id, material_id=ln.material_id, pr_line_id=ln.id, quantity=qty,
            rate=q.rate, gst_percent=q.gst_percent, amount=money_q(qty * D(q.rate)), received_quantity=0))
        ln.ordered_quantity = D(ln.ordered_quantity) + qty
    await ctx.db.flush()
    await recompute_po(ctx.db, po)
    rfq.status = "awarded"
    rfq.awarded_supplier_id = sup.id
    rfq.po_id = po.id
    await _refresh_pr_status(ctx.db, pr)
    await audit(ctx, "rfq", rfq.id, "award", ref=rfq.rfq_no, changes={"supplier": sup.name, "po": po.po_no})
    return po


async def _refresh_pr_status(db: AsyncSession, pr: S.RePurchaseRequisition) -> None:
    lines = (await db.execute(select(S.RePrLine).where(S.RePrLine.pr_id == pr.id))).scalars().all()
    if lines and pr.status == "approved" and all(D(ln.ordered_quantity) + EPS >= D(ln.quantity) for ln in lines):
        pr.status = "ordered"


# ═══ purchase order ═════════════════════════════════════════════════════════════════════════

def line_amount(qty: Any, rate: Any) -> Decimal:
    return money_q(D(qty) * D(rate))


async def recompute_po(db: AsyncSession, po: S.RePurchaseOrder, exclude_line: Optional[UUID] = None) -> None:
    q = select(S.RePoLine).where(S.RePoLine.po_id == po.id)
    if exclude_line:
        q = q.where(S.RePoLine.id != exclude_line)
    sub = gst = Decimal(0)
    for ln in (await db.execute(q)).scalars().all():
        amt = line_amount(ln.quantity, ln.rate)
        sub += amt
        gst += money_q(amt * D(ln.gst_percent) / 100)
    po.subtotal, po.gst_amount, po.total_amount = sub, gst, sub + gst
    await db.flush()


async def po_line_validate(ctx: Ctx, data: dict[str, Any], obj: Optional[S.RePoLine] = None) -> None:
    def val(k: str):
        return data.get(k, getattr(obj, k, None))

    po = await get_owned(ctx.db, S.RePurchaseOrder, ctx.vendor_id, val("po_id"), "purchase order")
    if po.status != "draft":
        raise HTTPException(status_code=409, detail=f"Purchase order is {po.status}; lines can no longer change")
    if D(val("quantity")) <= 0 or D(val("rate")) <= 0:
        raise HTTPException(status_code=422, detail="quantity and rate must be greater than zero")
    if val("pr_line_id"):
        pl = await ctx.db.get(S.RePrLine, val("pr_line_id"))
        if pl is None or pl.pr_id != po.pr_id or pl.material_id != val("material_id"):
            raise HTTPException(status_code=422, detail="The requisition line does not match this order's requisition / material")
    data["amount"] = line_amount(val("quantity"), val("rate"))


async def po_submit(ctx: Ctx, po: S.RePurchaseOrder) -> S.RePurchaseOrder:
    if po.status != "draft":
        raise HTTPException(status_code=409, detail=f"Purchase order is {po.status}")
    n = (await ctx.db.execute(select(func.count()).select_from(S.RePoLine).where(S.RePoLine.po_id == po.id))).scalar_one()
    if not n:
        raise HTTPException(status_code=409, detail="Add at least one line before submitting")
    sup = await ctx.db.get(S.ReSupplier, po.supplier_id)
    if sup is not None and sup.status == "blocked":
        raise HTTPException(status_code=409, detail="The supplier is blocked")
    await recompute_po(ctx.db, po)
    approval = await request_approval(
        ctx, "purchase_order", po.id, ref=po.po_no, value=po.total_amount, field="amount",
        title=f"Purchase order {po.po_no}", reason=f"₹{D(po.total_amount):,.2f}",
    )
    if approval is not None:
        po.status = "pending_approval"
        po.approval_request_id = approval.id
    else:
        po.status = "approved"
    await audit(ctx, "purchase_order", po.id, "submit", ref=po.po_no, changes={"status": po.status})
    return po


@register_handler("purchase_order")
async def _po_approval(ctx: Ctx, entity_id: UUID, approved: bool, req: ReApprovalRequest) -> None:
    po = await ctx.db.get(S.RePurchaseOrder, entity_id)
    if po is None or po.vendor_id != ctx.vendor_id or po.status != "pending_approval":
        return
    po.status = "approved" if approved else "draft"


async def po_cancel(ctx: Ctx, po: S.RePurchaseOrder, reason: str) -> S.RePurchaseOrder:
    if po.status in ("received", "closed", "cancelled"):
        raise HTTPException(status_code=409, detail=f"Purchase order is {po.status}")
    lines = (await ctx.db.execute(select(S.RePoLine).where(S.RePoLine.po_id == po.id))).scalars().all()
    if any(D(ln.received_quantity) > EPS for ln in lines):
        raise HTTPException(status_code=409, detail="Goods have been received against this order; close it instead")
    for ln in lines:
        if ln.pr_line_id:
            pl = await ctx.db.get(S.RePrLine, ln.pr_line_id)
            if pl is not None:
                pl.ordered_quantity = max(Decimal(0), D(pl.ordered_quantity) - D(ln.quantity))
    if po.pr_id:
        pr = await ctx.db.get(S.RePurchaseRequisition, po.pr_id)
        if pr is not None and pr.status == "ordered":
            pr.status = "approved"
    po.status = "cancelled"
    po.terms = f"{po.terms or ''}\nCancelled: {reason}".strip()[:4000]
    await audit(ctx, "purchase_order", po.id, "cancel", ref=po.po_no, changes={"reason": reason})
    return po


async def po_close(ctx: Ctx, po: S.RePurchaseOrder) -> S.RePurchaseOrder:
    if po.status not in ("approved", "partially_received", "received"):
        raise HTTPException(status_code=409, detail=f"Purchase order is {po.status}")
    po.status = "closed"
    await audit(ctx, "purchase_order", po.id, "close", ref=po.po_no)
    return po


# ═══ GRN ════════════════════════════════════════════════════════════════════════════════════

async def grn_create(ctx: Ctx, data: dict[str, Any]) -> None:
    po = await get_owned(ctx.db, S.RePurchaseOrder, ctx.vendor_id, data["po_id"], "purchase order")
    if po.status not in ("approved", "partially_received"):
        raise HTTPException(status_code=409, detail=f"Goods can be received only against an approved order (this one is {po.status})")
    store = await get_owned(ctx.db, S.ReSiteStore, ctx.vendor_id, data["store_id"], "store")
    if not store.is_active:
        raise HTTPException(status_code=409, detail="The store is inactive")
    data["supplier_id"] = po.supplier_id
    data["project_id"] = po.project_id
    data["status"] = "draft"


async def grn_line_validate(ctx: Ctx, data: dict[str, Any], obj: Optional[S.ReGrnLine] = None) -> None:
    def val(k: str):
        return data.get(k, getattr(obj, k, None))

    grn = await get_owned(ctx.db, S.ReGrn, ctx.vendor_id, val("grn_id"), "GRN")
    if grn.status != "draft":
        raise HTTPException(status_code=409, detail=f"GRN is {grn.status}; lines can no longer change")
    pl = await ctx.db.get(S.RePoLine, val("po_line_id"))
    if pl is None or pl.po_id != grn.po_id:
        raise HTTPException(status_code=422, detail="The line does not belong to this GRN's purchase order")
    data["material_id"] = pl.material_id
    rec, acc = D(val("received_quantity")), D(val("accepted_quantity"))
    if rec <= 0:
        raise HTTPException(status_code=422, detail="received_quantity must be greater than zero")
    if acc < 0 or acc > rec + EPS:
        raise HTTPException(status_code=422, detail="accepted_quantity must be between zero and the received quantity")
    data["rejected_quantity"] = _q(rec - acc)
    rate = D(val("rate")) or D(pl.rate)
    data["rate"] = rate
    data["amount"] = line_amount(acc, rate)


async def post_grn(ctx: Ctx, grn: S.ReGrn) -> S.ReGrn:
    import uuid

    if grn.status != "draft":
        raise HTTPException(status_code=409, detail=f"GRN is {grn.status}")
    po = await get_owned(ctx.db, S.RePurchaseOrder, ctx.vendor_id, grn.po_id, "purchase order")
    if po.status not in ("approved", "partially_received"):
        raise HTTPException(status_code=409, detail=f"Purchase order is {po.status}")
    lines = (await ctx.db.execute(select(S.ReGrnLine).where(S.ReGrnLine.grn_id == grn.id))).scalars().all()
    if not lines:
        raise HTTPException(status_code=409, detail="Add at least one received line")
    total = gst = Decimal(0)
    pending: dict[UUID, Decimal] = defaultdict(Decimal)
    for ln in lines:
        pl = await ctx.db.get(S.RePoLine, ln.po_line_id)
        pending[pl.id] += D(ln.accepted_quantity)
        limit = D(pl.quantity) * (1 + RECEIPT_TOLERANCE_PERCENT / 100)
        if D(pl.received_quantity) + pending[pl.id] > limit + EPS:
            mat = await ctx.db.get(S.ReMaterial, pl.material_id)
            raise HTTPException(
                status_code=409,
                detail=(f"{mat.name if mat else 'Material'}: receiving {pending[pl.id]:g} would exceed the ordered {D(pl.quantity):g} "
                        f"(+{RECEIPT_TOLERANCE_PERCENT:g}% tolerance); already received {D(pl.received_quantity):g}"),
            )
    for ln in lines:
        pl = await ctx.db.get(S.RePoLine, ln.po_line_id)
        if D(ln.accepted_quantity) > 0:
            await stock_txn(
                ctx, store_id=grn.store_id, material_id=ln.material_id, quantity=D(ln.accepted_quantity), rate=D(ln.rate),
                txn_type="grn", txn_date=grn.received_on, reference_type="grn", reference_id=grn.id, reference_no=grn.grn_no,
            )
        pl.received_quantity = D(pl.received_quantity) + D(ln.accepted_quantity)
        total += D(ln.amount)
        gst += money_q(D(ln.amount) * D(pl.gst_percent) / 100)
    grn.total_value, grn.gst_amount, grn.payable_amount = total, gst, total + gst
    grn.status = "posted"
    await ctx.db.flush()
    all_lines = (await ctx.db.execute(select(S.RePoLine).where(S.RePoLine.po_id == po.id))).scalars().all()
    po.status = "received" if all(D(x.received_quantity) + EPS >= D(x.quantity) for x in all_lines) else "partially_received"
    grn.gl_entry_id = await gl.post_vendor_bill(
        ctx.db, ctx.vendor_id, bill_id=grn.id, subtotal=total, tax=gst, total=total + gst, supplier_id=None,
        narration=f"GRN {grn.grn_no} · PO {po.po_no}", entry_date=grn.received_on,
    )
    await audit(ctx, "grn", grn.id, "post", ref=grn.grn_no, changes={"value": total, "po_status": po.status})
    return grn


async def grn_cancel(ctx: Ctx, grn: S.ReGrn) -> S.ReGrn:
    if grn.status != "draft":
        raise HTTPException(status_code=409, detail="A posted GRN cannot be cancelled; raise a stock adjustment / return instead")
    grn.status = "cancelled"
    await audit(ctx, "grn", grn.id, "cancel", ref=grn.grn_no)
    return grn


async def grn_pay(ctx: Ctx, grn: S.ReGrn, *, mode: str, reference: Optional[str], paid_on: Optional[date]) -> S.ReGrn:
    from app.models.realestate.core import PAYMENT_MODES

    if grn.status != "posted":
        raise HTTPException(status_code=409, detail="Only posted GRNs can be paid")
    if grn.payment_status == "paid":
        raise HTTPException(status_code=409, detail="Already paid")
    if mode not in PAYMENT_MODES:
        raise HTTPException(status_code=422, detail=f"mode must be one of {', '.join(PAYMENT_MODES)}")
    grn.payment_status, grn.payment_mode, grn.payment_reference = "paid", mode, reference
    grn.paid_on = paid_on or date.today()
    await gl.post_vendor_payment(
        ctx.db, ctx.vendor_id, payment_id=grn.id, amount=grn.payable_amount, supplier_id=None,
        narration=f"Payment for GRN {grn.grn_no}", entry_date=grn.paid_on,
    )
    await audit(ctx, "grn", grn.id, "pay", ref=grn.grn_no, changes={"amount": grn.payable_amount})
    return grn


# ═══ issue / transfer / wastage ═════════════════════════════════════════════════════════════

async def _draft_parent(ctx: Ctx, model, parent_id: UUID, label: str):
    parent = await get_owned(ctx.db, model, ctx.vendor_id, parent_id, label)
    if parent.status != "draft":
        raise HTTPException(status_code=409, detail=f"The {label} is {parent.status}; lines can no longer change")
    return parent


async def issue_line_validate(ctx: Ctx, data: dict[str, Any], obj: Optional[S.ReIssueLine] = None) -> None:
    await _draft_parent(ctx, S.ReMaterialIssue, data.get("issue_id", getattr(obj, "issue_id", None)), "issue note")
    if D(data.get("quantity", getattr(obj, "quantity", 0))) <= 0:
        raise HTTPException(status_code=422, detail="quantity must be greater than zero")


async def transfer_line_validate(ctx: Ctx, data: dict[str, Any], obj: Optional[S.ReTransferLine] = None) -> None:
    await _draft_parent(ctx, S.ReStockTransfer, data.get("transfer_id", getattr(obj, "transfer_id", None)), "transfer")
    if D(data.get("quantity", getattr(obj, "quantity", 0))) <= 0:
        raise HTTPException(status_code=422, detail="quantity must be greater than zero")


async def post_issue(ctx: Ctx, issue: S.ReMaterialIssue) -> S.ReMaterialIssue:
    if issue.status != "draft":
        raise HTTPException(status_code=409, detail=f"Issue note is {issue.status}")
    lines = (await ctx.db.execute(select(S.ReIssueLine).where(S.ReIssueLine.issue_id == issue.id))).scalars().all()
    if not lines:
        raise HTTPException(status_code=409, detail="Add at least one line")
    total = Decimal(0)
    for ln in lines:
        led = await stock_txn(
            ctx, store_id=issue.store_id, material_id=ln.material_id, quantity=-D(ln.quantity), txn_type="issue",
            txn_date=issue.issued_on, reference_type="issue", reference_id=issue.id, reference_no=issue.issue_no,
            remarks=issue.issued_to,
        )
        ln.rate = led.rate
        ln.amount = -led.value
        total += D(ln.amount)
    issue.total_value = total
    issue.status = "posted"
    await audit(ctx, "material_issue", issue.id, "post", ref=issue.issue_no, changes={"value": total})
    return issue


async def post_transfer(ctx: Ctx, tr: S.ReStockTransfer) -> S.ReStockTransfer:
    if tr.status != "draft":
        raise HTTPException(status_code=409, detail=f"Transfer is {tr.status}")
    if tr.from_store_id == tr.to_store_id:
        raise HTTPException(status_code=422, detail="Source and destination stores must differ")
    lines = (await ctx.db.execute(select(S.ReTransferLine).where(S.ReTransferLine.transfer_id == tr.id))).scalars().all()
    if not lines:
        raise HTTPException(status_code=409, detail="Add at least one line")
    total = Decimal(0)
    for ln in lines:
        out = await stock_txn(
            ctx, store_id=tr.from_store_id, material_id=ln.material_id, quantity=-D(ln.quantity), txn_type="transfer_out",
            txn_date=tr.transfer_date, reference_type="transfer", reference_id=tr.id, reference_no=tr.transfer_no,
        )
        await stock_txn(
            ctx, store_id=tr.to_store_id, material_id=ln.material_id, quantity=D(ln.quantity), rate=out.rate, txn_type="transfer_in",
            txn_date=tr.transfer_date, reference_type="transfer", reference_id=tr.id, reference_no=tr.transfer_no,
        )
        ln.rate, ln.amount = out.rate, -out.value
        total += D(ln.amount)
    tr.total_value = total
    tr.status = "posted"
    await audit(ctx, "stock_transfer", tr.id, "post", ref=tr.transfer_no, changes={"value": total})
    return tr


async def cancel_draft(ctx: Ctx, doc: Any, kind: str, ref: str) -> Any:
    if doc.status != "draft":
        raise HTTPException(status_code=409, detail=f"Only draft documents can be cancelled; this one is {doc.status}")
    doc.status = "cancelled"
    await audit(ctx, kind, doc.id, "cancel", ref=ref)
    return doc


async def wastage_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    if D(data.get("quantity")) <= 0:
        raise HTTPException(status_code=422, detail="quantity must be greater than zero")
    bal = await _balance(ctx.db, ctx.vendor_id, data["store_id"], data["material_id"])
    if D(bal.quantity) + EPS < D(data["quantity"]):
        raise HTTPException(status_code=409, detail=f"Only {D(bal.quantity):g} in stock; cannot write off {D(data['quantity']):g}")
    store = await ctx.db.get(S.ReSiteStore, data["store_id"])
    if store is not None and store.project_id and not data.get("project_id"):
        data["project_id"] = store.project_id
    data["status"] = "posted"


async def wastage_after_create(ctx: Ctx, w: S.ReWastage) -> None:
    led = await stock_txn(
        ctx, store_id=w.store_id, material_id=w.material_id, quantity=-D(w.quantity), txn_type="wastage",
        txn_date=w.wastage_date, reference_type="wastage", reference_id=w.id, reference_no=w.reason, remarks=w.remarks,
    )
    w.rate, w.value = led.rate, -led.value


async def wastage_reverse(ctx: Ctx, w: S.ReWastage) -> S.ReWastage:
    if w.status != "posted":
        raise HTTPException(status_code=409, detail="Already reversed")
    await stock_txn(
        ctx, store_id=w.store_id, material_id=w.material_id, quantity=D(w.quantity), rate=D(w.rate), txn_type="adjustment",
        txn_date=date.today(), reference_type="wastage", reference_id=w.id, reference_no="reversal", remarks="Wastage reversed",
    )
    w.status = "reversed"
    await audit(ctx, "wastage", w.id, "reverse", changes={"quantity": w.quantity})
    return w
