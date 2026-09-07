"""
Procurement Analytics Service
All heavy SQL aggregations for the Procurement Report Analytics module.
Kept separate from the router so logic can be tested and reused independently.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, case, cast, extract, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.types import Date as DateType

from app.models.procurement import (
    PurchaseOrder,
    PurchaseOrderApproval,
    PurchaseOrderItem,
    PurchaseOrderReceipt,
    Supplier,
)
from app.models.procurement_grn import GoodsReceiptNote, GRNLine
from app.models.procurement_invoice import (
    VendorInvoice,
    VendorInvoiceItem,
    VendorInvoicePayment,
    VendorInvoiceApproval,
)
from app.models.procurement_quotation import SupplierQuotation, SupplierQuotationItem
from app.models.procurement_requisition import (
    PurchaseRequisition,
    PurchaseRequisitionApproval,
    PurchaseRequisitionItem,
)
from app.models.procurement_return import PurchaseReturn, PurchaseReturnLine
from app.models.procurement_rfq import RequestForQuotation, RequestForQuotationItem, RFQSupplier
from app.models.procurement_sourcing import PurchasingInfoRecord
from app.models.vendor_product import Product


# ── Status groups ────────────────────────────────────────────────────────────

PO_ACTIVE_STATUSES = ("draft", "sent", "partial_received", "received")
PO_FULFILLED_STATUSES = ("received", "closed")
PO_CANCELLED = "cancelled"

INVOICE_OPEN_STATUSES = ("draft", "posted", "matched", "partial_match", "blocked")
INVOICE_PAID_STATUS = "paid"
INVOICE_CANCELLED = "cancelled"

PR_ACTIVE_STATUSES = ("submitted", "open", "approved", "partially_converted")
PR_CANCELLED = "cancelled"


# ── Date helpers ─────────────────────────────────────────────────────────────

def _default_range(date_from: Optional[date], date_to: Optional[date]) -> tuple[date, date]:
    today = date.today()
    return (
        date_from or (today - timedelta(days=29)),
        date_to or today,
    )


def _to_dt(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)


def _date_range_filter(model_col, df: date, dt: date):
    """Inclusive date range: df <= col < dt + 1 day."""
    return and_(
        model_col >= _to_dt(df),
        model_col < _to_dt(dt + timedelta(days=1)),
    )


# ── 1. Overview KPIs ────────────────────────────────────────────────────────

async def get_overview(
    db: AsyncSession,
    vendor_id: UUID,
    date_from: Optional[date],
    date_to: Optional[date],
    branch_id: Optional[UUID] = None,
    supplier_id: Optional[UUID] = None,
) -> dict:
    df, dt = _default_range(date_from, date_to)
    period_days = (dt - df).days + 1

    prev_dt = df - timedelta(days=1)
    prev_df = prev_dt - timedelta(days=period_days - 1)

    def _po_base(df2: date, dt2: date):
        q = (
            select(
                func.count(PurchaseOrder.id).label("cnt"),
                func.coalesce(func.sum(PurchaseOrder.total), 0).label("total"),
            )
            .where(
                PurchaseOrder.vendor_id == vendor_id,
                PurchaseOrder.status != PO_CANCELLED,
                _date_range_filter(PurchaseOrder.created_at, df2, dt2),
            )
        )
        if branch_id:
            q = q.where(PurchaseOrder.branch_id == branch_id)
        if supplier_id:
            q = q.where(PurchaseOrder.supplier_id == supplier_id)
        return q

    cur_po = (await db.execute(_po_base(df, dt))).one()
    prev_po = (await db.execute(_po_base(prev_df, prev_dt))).one()
    cur_po_value = float(cur_po.total or 0)
    prev_po_value = float(prev_po.total or 0)

    def _delta(cur: float, prev: float) -> Optional[float]:
        if prev == 0:
            return None
        return round((cur - prev) / prev * 100, 1)

    # Invoiced vs paid
    inv_q = (
        select(
            func.coalesce(func.sum(VendorInvoice.total), 0).label("invoiced"),
            func.coalesce(func.sum(VendorInvoice.amount_paid), 0).label("paid"),
            func.count(VendorInvoice.id).label("cnt"),
        )
        .where(
            VendorInvoice.vendor_id == vendor_id,
            VendorInvoice.status != INVOICE_CANCELLED,
            _date_range_filter(VendorInvoice.created_at, df, dt),
        )
    )
    if supplier_id:
        inv_q = inv_q.where(VendorInvoice.supplier_id == supplier_id)
    inv_row = (await db.execute(inv_q)).one()
    invoiced_value = float(inv_row.invoiced or 0)
    paid_value = float(inv_row.paid or 0)
    open_ap = invoiced_value - paid_value

    # GRN count + acceptance rate
    grn_q = (
        select(
            func.count(GoodsReceiptNote.id).label("cnt"),
            func.coalesce(func.sum(GoodsReceiptNote.total_accepted_qty), 0).label("accepted"),
            func.coalesce(func.sum(GoodsReceiptNote.total_received_qty), 0).label("received"),
        )
        .where(
            GoodsReceiptNote.vendor_id == vendor_id,
            GoodsReceiptNote.status != "cancelled",
            _date_range_filter(GoodsReceiptNote.created_at, df, dt),
        )
    )
    grn_row = (await db.execute(grn_q)).one()
    grn_count = int(grn_row.cnt or 0)
    total_received = float(grn_row.received or 0)
    total_accepted = float(grn_row.accepted or 0)
    acceptance_rate = round(total_accepted / total_received * 100, 1) if total_received else None

    # Fulfilled PO count
    fulfilled_q = (
        select(func.count(PurchaseOrder.id))
        .where(
            PurchaseOrder.vendor_id == vendor_id,
            PurchaseOrder.status.in_(PO_FULFILLED_STATUSES),
            _date_range_filter(PurchaseOrder.created_at, df, dt),
        )
    )
    fulfilled_cnt = (await db.execute(fulfilled_q)).scalar() or 0
    fulfilment_rate = round(int(fulfilled_cnt) / int(cur_po.cnt) * 100, 1) if cur_po.cnt else None

    # PR count + conversion rate
    pr_q = (
        select(
            func.count(PurchaseRequisition.id).label("total"),
            func.sum(
                case((PurchaseRequisition.status.in_(("converted", "partially_converted")), 1), else_=0)
            ).label("converted"),
        )
        .where(
            PurchaseRequisition.vendor_id == vendor_id,
            PurchaseRequisition.status != PR_CANCELLED,
            _date_range_filter(PurchaseRequisition.created_at, df, dt),
        )
    )
    pr_row = (await db.execute(pr_q)).one()
    pr_total = int(pr_row.total or 0)
    pr_converted = int(pr_row.converted or 0)
    pr_conversion_rate = round(pr_converted / pr_total * 100, 1) if pr_total else None

    # Return value
    ret_q = (
        select(
            func.count(PurchaseReturn.id).label("cnt"),
            func.coalesce(func.sum(PurchaseReturn.total), 0).label("total"),
        )
        .where(
            PurchaseReturn.vendor_id == vendor_id,
            PurchaseReturn.status != "cancelled",
            _date_range_filter(PurchaseReturn.created_at, df, dt),
        )
    )
    if supplier_id:
        ret_q = ret_q.where(PurchaseReturn.supplier_id == supplier_id)
    ret_row = (await db.execute(ret_q)).one()
    return_value = float(ret_row.total or 0)
    return_count = int(ret_row.cnt or 0)
    return_rate = round(return_value / invoiced_value * 100, 2) if invoiced_value else None

    return {
        "period": {"date_from": df.isoformat(), "date_to": dt.isoformat(), "days": period_days},
        "kpis": {
            "po_value": {"value": round(cur_po_value, 2), "prev": round(prev_po_value, 2), "delta_pct": _delta(cur_po_value, prev_po_value)},
            "po_count": int(cur_po.cnt or 0),
            "invoiced_value": round(invoiced_value, 2),
            "paid_value": round(paid_value, 2),
            "open_ap": round(open_ap, 2),
            "grn_count": grn_count,
            "return_value": round(return_value, 2),
            "return_count": return_count,
            "return_rate_pct": return_rate,
            "fulfilment_rate_pct": fulfilment_rate,
            "pr_total": pr_total,
            "pr_conversion_rate_pct": pr_conversion_rate,
            "acceptance_rate_pct": acceptance_rate,
        },
    }


# ── 2. Spend Analysis ───────────────────────────────────────────────────────

async def get_spend(
    db: AsyncSession,
    vendor_id: UUID,
    date_from: Optional[date],
    date_to: Optional[date],
    group_by: str = "supplier",
    branch_id: Optional[UUID] = None,
    plant_id: Optional[UUID] = None,
    supplier_id: Optional[UUID] = None,
    material_type: Optional[str] = None,
    item_category: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    df, dt = _default_range(date_from, date_to)

    # Base join: PO → PO items, filter by date and vendor
    po_filter = and_(
        PurchaseOrder.vendor_id == vendor_id,
        PurchaseOrder.status != PO_CANCELLED,
        _date_range_filter(PurchaseOrder.created_at, df, dt),
    )
    if branch_id:
        po_filter = and_(po_filter, PurchaseOrder.branch_id == branch_id)
    if plant_id:
        po_filter = and_(po_filter, PurchaseOrder.plant_id == plant_id)
    if supplier_id:
        po_filter = and_(po_filter, PurchaseOrder.supplier_id == supplier_id)

    item_filter = and_()
    if material_type:
        item_filter = and_(item_filter, PurchaseOrderItem.material_type == material_type)
    if item_category:
        item_filter = and_(item_filter, PurchaseOrderItem.item_category == item_category)

    # Group-by dimension column
    GROUP_COLS = {
        "supplier": PurchaseOrder.supplier_id,
        "material_type": PurchaseOrderItem.material_type,
        "branch": PurchaseOrder.branch_id,
        "plant": PurchaseOrder.plant_id,
        "item_category": PurchaseOrderItem.item_category,
        "account": PurchaseOrderItem.account_assignment_value,
    }
    dim_col = GROUP_COLS.get(group_by, PurchaseOrder.supplier_id)

    q = (
        select(
            dim_col.label("dim"),
            func.count(PurchaseOrder.id.distinct()).label("po_count"),
            func.coalesce(func.sum(PurchaseOrderItem.total_cost), 0).label("spend"),
        )
        .join(PurchaseOrderItem, PurchaseOrderItem.purchase_order_id == PurchaseOrder.id)
        .where(po_filter, item_filter)
        .group_by(dim_col)
        .order_by(func.coalesce(func.sum(PurchaseOrderItem.total_cost), 0).desc())
    )

    all_rows = (await db.execute(q)).all()
    total_spend = sum(float(r.spend or 0) for r in all_rows)
    paged = all_rows[offset: offset + limit]

    # Resolve supplier names for group_by=supplier
    sup_name_map: dict = {}
    if group_by == "supplier":
        ids = [r.dim for r in paged if r.dim]
        if ids:
            name_rows = (await db.execute(
                select(Supplier.id, Supplier.name).where(Supplier.id.in_(ids))
            )).all()
            sup_name_map = {str(r.id): r.name for r in name_rows}

    running = 0.0
    items = []
    for i, r in enumerate(paged):
        spend = float(r.spend or 0)
        running += spend
        pct = round(spend / total_spend * 100, 2) if total_spend else 0
        cumulative_pct = round(running / total_spend * 100, 2) if total_spend else 0
        abc = "A" if cumulative_pct <= 80 else ("B" if cumulative_pct <= 95 else "C")
        dim_label = (
            sup_name_map.get(str(r.dim), str(r.dim) if r.dim else "Unknown")
            if group_by == "supplier"
            else (str(r.dim) if r.dim else "—")
        )
        items.append({
            "dim": str(r.dim) if r.dim else None,
            "label": dim_label,
            "po_count": int(r.po_count or 0),
            "spend": round(spend, 2),
            "pct_of_total": pct,
            "cumulative_pct": cumulative_pct,
            "abc_class": abc,
        })

    return {
        "items": items,
        "total": len(all_rows),
        "total_spend": round(total_spend, 2),
        "group_by": group_by,
        "date_from": df.isoformat(),
        "date_to": dt.isoformat(),
    }


# ── 3. Spend Trend ──────────────────────────────────────────────────────────

async def get_spend_trend(
    db: AsyncSession,
    vendor_id: UUID,
    date_from: Optional[date],
    date_to: Optional[date],
    bucket: str = "month",
    branch_id: Optional[UUID] = None,
    supplier_id: Optional[UUID] = None,
) -> dict:
    df, dt = _default_range(date_from, date_to)

    TRUNC = {"day": "day", "week": "week", "month": "month"}
    trunc = TRUNC.get(bucket, "month")

    def _po_trend():
        q = (
            select(
                func.date_trunc(trunc, PurchaseOrder.created_at).label("bucket"),
                func.coalesce(func.sum(PurchaseOrder.total), 0).label("committed"),
            )
            .where(
                PurchaseOrder.vendor_id == vendor_id,
                PurchaseOrder.status != PO_CANCELLED,
                _date_range_filter(PurchaseOrder.created_at, df, dt),
            )
            .group_by(text("1"))
            .order_by(text("1"))
        )
        if branch_id:
            q = q.where(PurchaseOrder.branch_id == branch_id)
        if supplier_id:
            q = q.where(PurchaseOrder.supplier_id == supplier_id)
        return q

    def _inv_trend():
        q = (
            select(
                func.date_trunc(trunc, VendorInvoice.created_at).label("bucket"),
                func.coalesce(func.sum(VendorInvoice.total), 0).label("invoiced"),
                func.coalesce(func.sum(VendorInvoice.amount_paid), 0).label("paid"),
            )
            .where(
                VendorInvoice.vendor_id == vendor_id,
                VendorInvoice.status != INVOICE_CANCELLED,
                _date_range_filter(VendorInvoice.created_at, df, dt),
            )
            .group_by(text("1"))
            .order_by(text("1"))
        )
        if supplier_id:
            q = q.where(VendorInvoice.supplier_id == supplier_id)
        return q

    po_rows = (await db.execute(_po_trend())).all()
    inv_rows = (await db.execute(_inv_trend())).all()

    po_map = {r.bucket.date().isoformat() if hasattr(r.bucket, "date") else str(r.bucket): float(r.committed or 0) for r in po_rows}
    inv_map = {}
    paid_map = {}
    for r in inv_rows:
        k = r.bucket.date().isoformat() if hasattr(r.bucket, "date") else str(r.bucket)
        inv_map[k] = float(r.invoiced or 0)
        paid_map[k] = float(r.paid or 0)

    all_keys = sorted(set(po_map) | set(inv_map))
    series = [
        {
            "bucket": k,
            "committed": round(po_map.get(k, 0), 2),
            "invoiced": round(inv_map.get(k, 0), 2),
            "paid": round(paid_map.get(k, 0), 2),
        }
        for k in all_keys
    ]

    return {
        "series": series,
        "bucket": bucket,
        "date_from": df.isoformat(),
        "date_to": dt.isoformat(),
    }


# ── 4. Procure-to-Pay Cycle Time ─────────────────────────────────────────────

async def get_cycle_time(
    db: AsyncSession,
    vendor_id: UUID,
    date_from: Optional[date],
    date_to: Optional[date],
    branch_id: Optional[UUID] = None,
    supplier_id: Optional[UUID] = None,
) -> dict:
    df, dt = _default_range(date_from, date_to)

    # PR approval time: submitted_at → approved_at
    pr_q = (
        select(
            func.avg(
                func.extract("epoch", PurchaseRequisition.approved_at - PurchaseRequisition.submitted_at) / 3600
            ).label("avg_h"),
            func.count(PurchaseRequisition.id).label("cnt"),
        )
        .where(
            PurchaseRequisition.vendor_id == vendor_id,
            PurchaseRequisition.approved_at.isnot(None),
            PurchaseRequisition.submitted_at.isnot(None),
            _date_range_filter(PurchaseRequisition.created_at, df, dt),
        )
    )
    if branch_id:
        pr_q = pr_q.where(PurchaseRequisition.store_id == branch_id)
    pr_row = (await db.execute(pr_q)).one()

    # PO order date → received_at
    po_q = (
        select(
            func.avg(
                func.extract("epoch", PurchaseOrder.received_at - cast(PurchaseOrder.order_date, DateType)) / 86400
            ).label("avg_d"),
            func.count(PurchaseOrder.id).label("cnt"),
        )
        .where(
            PurchaseOrder.vendor_id == vendor_id,
            PurchaseOrder.received_at.isnot(None),
            PurchaseOrder.order_date.isnot(None),
            _date_range_filter(PurchaseOrder.created_at, df, dt),
        )
    )
    if branch_id:
        po_q = po_q.where(PurchaseOrder.branch_id == branch_id)
    if supplier_id:
        po_q = po_q.where(PurchaseOrder.supplier_id == supplier_id)
    po_row = (await db.execute(po_q)).one()

    # GRN posting → invoice date
    gi_q = (
        select(
            func.avg(
                func.extract("epoch", VendorInvoice.created_at - GoodsReceiptNote.created_at) / 86400
            ).label("avg_d"),
            func.count(VendorInvoice.id).label("cnt"),
        )
        .join(GoodsReceiptNote, GoodsReceiptNote.purchase_order_id == VendorInvoice.purchase_order_id)
        .where(
            VendorInvoice.vendor_id == vendor_id,
            VendorInvoice.status != INVOICE_CANCELLED,
            _date_range_filter(VendorInvoice.created_at, df, dt),
        )
    )
    gi_row = (await db.execute(gi_q)).one()

    # Invoice → payment
    ip_q = (
        select(
            func.avg(
                func.extract("epoch", VendorInvoicePayment.created_at - VendorInvoice.created_at) / 86400
            ).label("avg_d"),
            func.count(VendorInvoicePayment.id).label("cnt"),
        )
        .join(VendorInvoice, VendorInvoice.id == VendorInvoicePayment.invoice_id)
        .where(
            VendorInvoice.vendor_id == vendor_id,
            _date_range_filter(VendorInvoicePayment.created_at, df, dt),
        )
    )
    ip_row = (await db.execute(ip_q)).one()

    pr_h = float(pr_row.avg_h or 0)
    po_d = float(po_row.avg_d or 0)
    gi_d = float(gi_row.avg_d or 0)
    ip_d = float(ip_row.avg_d or 0)
    total_d = round(pr_h / 24 + po_d + gi_d + ip_d, 1)

    stages = [
        {"stage": "PR Approval",           "avg_hours": round(pr_h, 1),  "count": int(pr_row.cnt or 0), "unit": "hours"},
        {"stage": "PO to Delivery",         "avg_days":  round(po_d, 1),  "count": int(po_row.cnt or 0), "unit": "days"},
        {"stage": "Receipt to Invoice",     "avg_days":  round(gi_d, 1),  "count": int(gi_row.cnt or 0), "unit": "days"},
        {"stage": "Invoice to Payment",     "avg_days":  round(ip_d, 1),  "count": int(ip_row.cnt or 0), "unit": "days"},
    ]

    return {
        "stages": stages,
        "total_cycle_days": total_d,
        "date_from": df.isoformat(),
        "date_to": dt.isoformat(),
    }


# ── 5. Approval Turnaround ──────────────────────────────────────────────────

async def get_approval_turnaround(
    db: AsyncSession,
    vendor_id: UUID,
    date_from: Optional[date],
    date_to: Optional[date],
    doc_type: Optional[str] = None,
) -> dict:
    df, dt = _default_range(date_from, date_to)

    results: list[dict] = []

    # Union all three approval tables
    for ApprModel, header_model, fk_col, label in [
        (PurchaseOrderApproval,      PurchaseOrder,       PurchaseOrderApproval.purchase_order_id,      "PO"),
        (PurchaseRequisitionApproval, PurchaseRequisition, PurchaseRequisitionApproval.requisition_id,  "PR"),
        (VendorInvoiceApproval,      VendorInvoice,        VendorInvoiceApproval.invoice_id,            "Invoice"),
    ]:
        if doc_type and doc_type != label:
            continue

        q = (
            select(
                ApprModel.level,
                ApprModel.status,
                func.count(ApprModel.id).label("cnt"),
                func.avg(
                    case(
                        (ApprModel.actioned_at.isnot(None),
                         func.extract("epoch", ApprModel.actioned_at - ApprModel.created_at) / 3600),
                        else_=None,
                    )
                ).label("avg_hours"),
            )
            .join(header_model, header_model.id == fk_col)
            .where(
                header_model.vendor_id == vendor_id,
                _date_range_filter(ApprModel.created_at, df, dt),
            )
            .group_by(ApprModel.level, ApprModel.status)
            .order_by(ApprModel.level)
        )

        rows = (await db.execute(q)).all()

        # Aggregate by level
        level_map: dict = {}
        for r in rows:
            lv = int(r.level or 1)
            if lv not in level_map:
                level_map[lv] = {"level": lv, "doc_type": label, "pending": 0, "approved": 0, "rejected": 0, "avg_hours": None, "_hours_sum": 0.0, "_cnt_with_time": 0}
            level_map[lv][r.status] = int(r.cnt or 0)
            if r.avg_hours:
                level_map[lv]["_hours_sum"] += float(r.avg_hours) * int(r.cnt or 0)
                level_map[lv]["_cnt_with_time"] += int(r.cnt or 0)

        for lv_data in level_map.values():
            if lv_data["_cnt_with_time"]:
                lv_data["avg_hours"] = round(lv_data["_hours_sum"] / lv_data["_cnt_with_time"], 1)
            del lv_data["_hours_sum"]
            del lv_data["_cnt_with_time"]
            results.append(lv_data)

    # Pending approvals (aging)
    pending_items = []
    for ApprModel, header_model, fk_col, label in [
        (PurchaseOrderApproval,      PurchaseOrder,        PurchaseOrderApproval.purchase_order_id,     "PO"),
        (PurchaseRequisitionApproval, PurchaseRequisition, PurchaseRequisitionApproval.requisition_id,  "PR"),
        (VendorInvoiceApproval,      VendorInvoice,        VendorInvoiceApproval.invoice_id,            "Invoice"),
    ]:
        if doc_type and doc_type != label:
            continue

        pq = (
            select(
                ApprModel.id,
                ApprModel.level,
                ApprModel.created_at,
            )
            .join(header_model, header_model.id == fk_col)
            .where(
                header_model.vendor_id == vendor_id,
                ApprModel.status == "pending",
            )
        )
        p_rows = (await db.execute(pq)).all()
        now = datetime.now(tz=timezone.utc)
        for r in p_rows:
            created = r.created_at if r.created_at.tzinfo else r.created_at.replace(tzinfo=timezone.utc)
            age_h = (now - created).total_seconds() / 3600
            pending_items.append({
                "doc_type": label,
                "level": int(r.level or 1),
                "age_hours": round(age_h, 1),
            })

    # Summarise pending by age bucket
    buckets: dict[str, int] = {"< 24h": 0, "1–3 days": 0, "3–7 days": 0, "> 7 days": 0}
    for p in pending_items:
        h = p["age_hours"]
        if h < 24:
            buckets["< 24h"] += 1
        elif h < 72:
            buckets["1–3 days"] += 1
        elif h < 168:
            buckets["3–7 days"] += 1
        else:
            buckets["> 7 days"] += 1

    return {
        "turnaround": results,
        "pending_total": len(pending_items),
        "pending_aging": [{"bucket": k, "count": v} for k, v in buckets.items()],
        "date_from": df.isoformat(),
        "date_to": dt.isoformat(),
    }


# ── 6. Supplier Scorecard ───────────────────────────────────────────────────

async def get_supplier_scorecard(
    db: AsyncSession,
    vendor_id: UUID,
    date_from: Optional[date],
    date_to: Optional[date],
    supplier_id: Optional[UUID] = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    df, dt = _default_range(date_from, date_to)

    # PO-level: total/on-time delivery (expected_delivery_date vs received_at)
    po_q = (
        select(
            PurchaseOrder.supplier_id,
            func.count(PurchaseOrder.id).label("po_count"),
            func.sum(
                case(
                    (and_(
                        PurchaseOrder.received_at.isnot(None),
                        PurchaseOrder.expected_delivery_date.isnot(None),
                        PurchaseOrder.received_at <= cast(PurchaseOrder.expected_delivery_date, DateType),
                    ), 1),
                    else_=0,
                )
            ).label("on_time"),
            func.sum(
                case(
                    (PurchaseOrder.status.in_(PO_FULFILLED_STATUSES), 1), else_=0
                )
            ).label("fulfilled"),
        )
        .where(
            PurchaseOrder.vendor_id == vendor_id,
            PurchaseOrder.status != PO_CANCELLED,
            _date_range_filter(PurchaseOrder.created_at, df, dt),
        )
        .group_by(PurchaseOrder.supplier_id)
    )
    if supplier_id:
        po_q = po_q.where(PurchaseOrder.supplier_id == supplier_id)
    po_rows = (await db.execute(po_q)).all()

    # GRN quality: accepted vs received per supplier (via PO)
    grn_q = (
        select(
            PurchaseOrder.supplier_id,
            func.coalesce(func.sum(GoodsReceiptNote.total_received_qty), 0).label("received_qty"),
            func.coalesce(func.sum(GoodsReceiptNote.total_accepted_qty), 0).label("accepted_qty"),
        )
        .join(PurchaseOrder, PurchaseOrder.id == GoodsReceiptNote.purchase_order_id)
        .where(
            GoodsReceiptNote.vendor_id == vendor_id,
            GoodsReceiptNote.status != "cancelled",
            _date_range_filter(GoodsReceiptNote.created_at, df, dt),
        )
        .group_by(PurchaseOrder.supplier_id)
    )
    grn_rows = (await db.execute(grn_q)).all()
    grn_map = {str(r.supplier_id): r for r in grn_rows if r.supplier_id}

    # Invoice: count, match rate
    inv_q = (
        select(
            VendorInvoice.supplier_id,
            func.count(VendorInvoice.id).label("inv_count"),
            func.sum(
                case(
                    (VendorInvoice.match_status == "matched", 1), else_=0
                )
            ).label("matched"),
            func.coalesce(func.sum(VendorInvoice.total), 0).label("inv_value"),
        )
        .where(
            VendorInvoice.vendor_id == vendor_id,
            VendorInvoice.status != INVOICE_CANCELLED,
            _date_range_filter(VendorInvoice.created_at, df, dt),
        )
        .group_by(VendorInvoice.supplier_id)
    )
    inv_rows = (await db.execute(inv_q)).all()
    inv_map = {str(r.supplier_id): r for r in inv_rows if r.supplier_id}

    # Returns per supplier
    ret_q = (
        select(
            PurchaseReturn.supplier_id,
            func.count(PurchaseReturn.id).label("cnt"),
            func.coalesce(func.sum(PurchaseReturn.total), 0).label("total"),
        )
        .where(
            PurchaseReturn.vendor_id == vendor_id,
            PurchaseReturn.status != "cancelled",
            _date_range_filter(PurchaseReturn.created_at, df, dt),
        )
        .group_by(PurchaseReturn.supplier_id)
    )
    ret_rows = (await db.execute(ret_q)).all()
    ret_map = {str(r.supplier_id): r for r in ret_rows if r.supplier_id}

    # Resolve supplier names
    sup_ids = [r.supplier_id for r in po_rows if r.supplier_id]
    name_map: dict = {}
    if sup_ids:
        nr = (await db.execute(
            select(Supplier.id, Supplier.name).where(Supplier.id.in_(sup_ids))
        )).all()
        name_map = {str(r.id): r.name for r in nr}

    all_items = []
    for r in po_rows:
        sid = str(r.supplier_id) if r.supplier_id else None
        pc = int(r.po_count or 0)
        on_time = int(r.on_time or 0)
        on_time_pct = round(on_time / pc * 100, 1) if pc else None

        grn = grn_map.get(sid or "")
        rec = float(grn.received_qty) if grn else 0
        acc = float(grn.accepted_qty) if grn else 0
        quality_pct = round(acc / rec * 100, 1) if rec else None

        inv = inv_map.get(sid or "")
        inv_count = int(inv.inv_count) if inv else 0
        matched = int(inv.matched) if inv else 0
        match_rate = round(matched / inv_count * 100, 1) if inv_count else None
        inv_value = float(inv.inv_value) if inv else 0

        ret = ret_map.get(sid or "")
        ret_cnt = int(ret.cnt) if ret else 0
        ret_val = float(ret.total) if ret else 0
        ret_rate = round(ret_val / inv_value * 100, 2) if inv_value else None

        # Composite score (0–100): avg of available dimensions
        scores = [s for s in [on_time_pct, quality_pct, match_rate] if s is not None]
        composite = round(sum(scores) / len(scores), 1) if scores else None

        all_items.append({
            "supplier_id": sid,
            "name": name_map.get(sid or "", "Unknown"),
            "po_count": pc,
            "on_time_delivery_pct": on_time_pct,
            "quality_acceptance_pct": quality_pct,
            "invoice_match_rate_pct": match_rate,
            "return_rate_pct": ret_rate,
            "return_count": ret_cnt,
            "invoice_value": round(inv_value, 2),
            "composite_score": composite,
        })

    all_items.sort(key=lambda x: (x["composite_score"] is None, -(x["composite_score"] or 0)))
    paged = all_items[offset: offset + limit]

    return {
        "items": paged,
        "total": len(all_items),
        "date_from": df.isoformat(),
        "date_to": dt.isoformat(),
    }


# ── 7. Sourcing Funnel ──────────────────────────────────────────────────────

async def get_sourcing_funnel(
    db: AsyncSession,
    vendor_id: UUID,
    date_from: Optional[date],
    date_to: Optional[date],
) -> dict:
    df, dt = _default_range(date_from, date_to)

    # PR counts by status
    pr_q = (
        select(PurchaseRequisition.status, func.count(PurchaseRequisition.id).label("cnt"))
        .where(
            PurchaseRequisition.vendor_id == vendor_id,
            _date_range_filter(PurchaseRequisition.created_at, df, dt),
        )
        .group_by(PurchaseRequisition.status)
    )
    pr_rows = (await db.execute(pr_q)).all()
    pr_by_status = {r.status: int(r.cnt) for r in pr_rows}
    pr_total = sum(pr_by_status.values())
    pr_converted = pr_by_status.get("converted", 0) + pr_by_status.get("partially_converted", 0)

    # RFQ counts by status
    rfq_q = (
        select(RequestForQuotation.status, func.count(RequestForQuotation.id).label("cnt"))
        .where(
            RequestForQuotation.vendor_id == vendor_id,
            _date_range_filter(RequestForQuotation.created_at, df, dt),
        )
        .group_by(RequestForQuotation.status)
    )
    rfq_rows = (await db.execute(rfq_q)).all()
    rfq_by_status = {r.status: int(r.cnt) for r in rfq_rows}
    rfq_total = sum(rfq_by_status.values())

    # Quotations
    sq_q = (
        select(SupplierQuotation.status, func.count(SupplierQuotation.id).label("cnt"))
        .where(
            SupplierQuotation.vendor_id == vendor_id,
            _date_range_filter(SupplierQuotation.created_at, df, dt),
        )
        .group_by(SupplierQuotation.status)
    )
    sq_rows = (await db.execute(sq_q)).all()
    sq_by_status = {r.status: int(r.cnt) for r in sq_rows}
    sq_total = sum(sq_by_status.values())
    sq_accepted = sq_by_status.get("accepted", 0)

    # PO count
    po_q = (
        select(func.count(PurchaseOrder.id))
        .where(
            PurchaseOrder.vendor_id == vendor_id,
            PurchaseOrder.status != PO_CANCELLED,
            _date_range_filter(PurchaseOrder.created_at, df, dt),
        )
    )
    po_total = (await db.execute(po_q)).scalar() or 0

    # RFQ supplier response rates
    rfq_sup_q = (
        select(
            RFQSupplier.invite_status,
            func.count(RFQSupplier.id).label("cnt"),
        )
        .join(RequestForQuotation, RequestForQuotation.id == RFQSupplier.rfq_id)
        .where(
            RequestForQuotation.vendor_id == vendor_id,
            _date_range_filter(RequestForQuotation.created_at, df, dt),
        )
        .group_by(RFQSupplier.invite_status)
    )
    rfq_sup_rows = (await db.execute(rfq_sup_q)).all()
    rfq_sup_map = {r.invite_status: int(r.cnt) for r in rfq_sup_rows}
    rfq_sup_total = sum(rfq_sup_map.values())
    rfq_responded = rfq_sup_map.get("bid_submitted", 0)
    response_rate = round(rfq_responded / rfq_sup_total * 100, 1) if rfq_sup_total else None

    # Savings: target vs awarded
    # target_price lives on the RFQ line, not the quotation line.
    # Join SupplierQuotationItem → RequestForQuotationItem via rfq_item_id.
    sav_q = (
        select(
            func.coalesce(
                func.sum(RequestForQuotationItem.target_price * SupplierQuotationItem.quantity), 0
            ).label("target"),
            func.coalesce(
                func.sum(SupplierQuotationItem.unit_price * SupplierQuotationItem.quantity), 0
            ).label("awarded"),
        )
        .join(SupplierQuotation, SupplierQuotation.id == SupplierQuotationItem.quotation_id)
        .join(
            RequestForQuotationItem,
            RequestForQuotationItem.id == SupplierQuotationItem.rfq_item_id,
        )
        .where(
            SupplierQuotation.vendor_id == vendor_id,
            SupplierQuotation.status == "accepted",
            SupplierQuotationItem.rfq_item_id.isnot(None),
            RequestForQuotationItem.target_price.isnot(None),
            _date_range_filter(SupplierQuotation.created_at, df, dt),
        )
    )
    sav_row = (await db.execute(sav_q)).one()
    target_val = float(sav_row.target or 0)
    awarded_val = float(sav_row.awarded or 0)
    savings = round(target_val - awarded_val, 2)
    savings_pct = round(savings / target_val * 100, 2) if target_val else None

    funnel = [
        {"stage": "Purchase Requisitions",  "count": pr_total,      "by_status": pr_by_status},
        {"stage": "RFQs Issued",            "count": rfq_total,     "by_status": rfq_by_status},
        {"stage": "Quotations Received",    "count": sq_total,      "by_status": sq_by_status},
        {"stage": "Quotations Accepted",    "count": sq_accepted,   "by_status": {}},
        {"stage": "Purchase Orders",        "count": int(po_total), "by_status": {}},
    ]

    return {
        "funnel": funnel,
        "pr_conversion_rate": round(pr_converted / pr_total * 100, 1) if pr_total else None,
        "rfq_response_rate": response_rate,
        "rfq_supplier_stats": rfq_sup_map,
        "savings": savings,
        "savings_pct": savings_pct,
        "target_value": round(target_val, 2),
        "awarded_value": round(awarded_val, 2),
        "date_from": df.isoformat(),
        "date_to": dt.isoformat(),
    }


# ── 8. Price Purchase Variance (PPV) ────────────────────────────────────────

async def get_price_variance(
    db: AsyncSession,
    vendor_id: UUID,
    date_from: Optional[date],
    date_to: Optional[date],
    supplier_id: Optional[UUID] = None,
    material_type: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    df, dt = _default_range(date_from, date_to)

    # Invoice item price vs PO item price (3-way price variance already on line)
    q = (
        select(
            VendorInvoiceItem.product_id,
            func.count(VendorInvoiceItem.id).label("line_count"),
            func.coalesce(func.sum(func.abs(VendorInvoiceItem.price_variance) * VendorInvoiceItem.invoiced_qty), 0).label("variance_value"),
            func.avg(VendorInvoiceItem.price_variance).label("avg_variance"),
            func.avg(VendorInvoiceItem.po_unit_price).label("avg_po_price"),
            func.avg(VendorInvoiceItem.unit_price).label("avg_inv_price"),
        )
        .join(VendorInvoice, VendorInvoice.id == VendorInvoiceItem.invoice_id)
        .where(
            VendorInvoice.vendor_id == vendor_id,
            VendorInvoice.status != INVOICE_CANCELLED,
            VendorInvoiceItem.price_variance.isnot(None),
            _date_range_filter(VendorInvoice.created_at, df, dt),
        )
        .group_by(VendorInvoiceItem.product_id)
        .order_by(func.coalesce(func.sum(func.abs(VendorInvoiceItem.price_variance) * VendorInvoiceItem.invoiced_qty), 0).desc())
    )
    if supplier_id:
        q = q.where(VendorInvoice.supplier_id == supplier_id)

    all_rows = (await db.execute(q)).all()
    total_variance = sum(float(r.variance_value or 0) for r in all_rows)

    # Resolve product names
    prod_ids = [r.product_id for r in all_rows if r.product_id]
    prod_map: dict = {}
    if prod_ids:
        prows = (await db.execute(
            select(Product.id, Product.name).where(Product.id.in_(prod_ids))
        )).all()
        prod_map = {str(r.id): r.name for r in prows}

    paged = all_rows[offset: offset + limit]
    items = [
        {
            "product_id": str(r.product_id) if r.product_id else None,
            "product_name": prod_map.get(str(r.product_id), "Unknown") if r.product_id else "—",
            "line_count": int(r.line_count or 0),
            "avg_po_price": round(float(r.avg_po_price or 0), 4),
            "avg_inv_price": round(float(r.avg_inv_price or 0), 4),
            "avg_variance": round(float(r.avg_variance or 0), 4),
            "variance_value": round(float(r.variance_value or 0), 2),
        }
        for r in paged
    ]

    return {
        "items": items,
        "total": len(all_rows),
        "total_variance_value": round(total_variance, 2),
        "date_from": df.isoformat(),
        "date_to": dt.isoformat(),
    }


# ── 9. Three-Way Match Exceptions ───────────────────────────────────────────

async def get_match_exceptions(
    db: AsyncSession,
    vendor_id: UUID,
    date_from: Optional[date],
    date_to: Optional[date],
    match_status: Optional[str] = None,
    supplier_id: Optional[UUID] = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    df, dt = _default_range(date_from, date_to)

    q = (
        select(
            VendorInvoice.id,
            VendorInvoice.supplier_id,
            VendorInvoice.match_status,
            VendorInvoice.total,
            VendorInvoice.created_at,
            VendorInvoice.status,
        )
        .where(
            VendorInvoice.vendor_id == vendor_id,
            VendorInvoice.status != INVOICE_CANCELLED,
            VendorInvoice.match_status.in_(["blocked_qty", "blocked_price", "partial"]),
            _date_range_filter(VendorInvoice.created_at, df, dt),
        )
        .order_by(VendorInvoice.created_at.asc())
    )
    if match_status:
        q = q.where(VendorInvoice.match_status == match_status)
    if supplier_id:
        q = q.where(VendorInvoice.supplier_id == supplier_id)

    all_rows = (await db.execute(q)).all()

    # Summary by match status
    summary: dict[str, dict] = {}
    now = datetime.now(tz=timezone.utc)
    for r in all_rows:
        ms = r.match_status or "unknown"
        if ms not in summary:
            summary[ms] = {"count": 0, "value": 0.0}
        summary[ms]["count"] += 1
        summary[ms]["value"] += float(r.total or 0)

    # Supplier names
    sup_ids = list({r.supplier_id for r in all_rows if r.supplier_id})
    sup_map: dict = {}
    if sup_ids:
        nr = (await db.execute(
            select(Supplier.id, Supplier.name).where(Supplier.id.in_(sup_ids))
        )).all()
        sup_map = {str(r.id): r.name for r in nr}

    paged = all_rows[offset: offset + limit]
    items = []
    for r in paged:
        created = r.created_at if r.created_at.tzinfo else r.created_at.replace(tzinfo=timezone.utc)
        age_days = (now - created).days
        items.append({
            "invoice_id": str(r.id),
            "supplier_id": str(r.supplier_id) if r.supplier_id else None,
            "supplier_name": sup_map.get(str(r.supplier_id), "Unknown") if r.supplier_id else "—",
            "match_status": r.match_status,
            "invoice_status": r.status,
            "total": round(float(r.total or 0), 2),
            "age_days": age_days,
        })

    return {
        "items": items,
        "total": len(all_rows),
        "summary": [{"match_status": k, **v} for k, v in summary.items()],
        "date_from": df.isoformat(),
        "date_to": dt.isoformat(),
    }


# ── 10. GST Input Credit ─────────────────────────────────────────────────────

async def get_gst_input_credit(
    db: AsyncSession,
    vendor_id: UUID,
    date_from: Optional[date],
    date_to: Optional[date],
    place_of_supply: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    df, dt = _default_range(date_from, date_to)

    # place_of_supply is on PurchaseOrder, not VendorInvoice — outer-join PO to get it.
    q = (
        select(
            VendorInvoiceItem.hsn_code,
            PurchaseOrder.place_of_supply,
            func.count(VendorInvoiceItem.id).label("line_count"),
            func.coalesce(func.sum(VendorInvoiceItem.cgst_amount), 0).label("cgst"),
            func.coalesce(func.sum(VendorInvoiceItem.sgst_amount), 0).label("sgst"),
            func.coalesce(func.sum(VendorInvoiceItem.igst_amount), 0).label("igst"),
            func.coalesce(func.sum(VendorInvoiceItem.cgst_amount + VendorInvoiceItem.sgst_amount + VendorInvoiceItem.igst_amount), 0).label("total_tax"),
        )
        .join(VendorInvoice, VendorInvoice.id == VendorInvoiceItem.invoice_id)
        .outerjoin(PurchaseOrder, PurchaseOrder.id == VendorInvoice.purchase_order_id)
        .where(
            VendorInvoice.vendor_id == vendor_id,
            VendorInvoice.status != INVOICE_CANCELLED,
            _date_range_filter(VendorInvoice.created_at, df, dt),
        )
        .group_by(VendorInvoiceItem.hsn_code, PurchaseOrder.place_of_supply)
        .order_by(func.coalesce(func.sum(VendorInvoiceItem.cgst_amount + VendorInvoiceItem.sgst_amount + VendorInvoiceItem.igst_amount), 0).desc())
    )
    if place_of_supply:
        q = q.where(PurchaseOrder.place_of_supply == place_of_supply)

    all_rows = (await db.execute(q)).all()
    total_cgst = sum(float(r.cgst or 0) for r in all_rows)
    total_sgst = sum(float(r.sgst or 0) for r in all_rows)
    total_igst = sum(float(r.igst or 0) for r in all_rows)
    total_tax = total_cgst + total_sgst + total_igst

    # Also compare PO GST vs Invoice GST (variance check)
    po_gst_q = (
        select(
            func.coalesce(func.sum(PurchaseOrder.cgst_amount), 0).label("cgst"),
            func.coalesce(func.sum(PurchaseOrder.sgst_amount), 0).label("sgst"),
            func.coalesce(func.sum(PurchaseOrder.igst_amount), 0).label("igst"),
        )
        .where(
            PurchaseOrder.vendor_id == vendor_id,
            PurchaseOrder.status != PO_CANCELLED,
            _date_range_filter(PurchaseOrder.created_at, df, dt),
        )
    )
    if place_of_supply:
        po_gst_q = po_gst_q.where(PurchaseOrder.place_of_supply == place_of_supply)
    po_gst = (await db.execute(po_gst_q)).one()
    po_total_gst = float(po_gst.cgst or 0) + float(po_gst.sgst or 0) + float(po_gst.igst or 0)

    paged = all_rows[offset: offset + limit]
    items = [
        {
            "hsn_code": r.hsn_code or "—",
            "place_of_supply": r.place_of_supply or "—",
            "line_count": int(r.line_count or 0),
            "cgst": round(float(r.cgst or 0), 2),
            "sgst": round(float(r.sgst or 0), 2),
            "igst": round(float(r.igst or 0), 2),
            "total_tax": round(float(r.total_tax or 0), 2),
        }
        for r in paged
    ]

    return {
        "items": items,
        "total": len(all_rows),
        "totals": {
            "cgst": round(total_cgst, 2),
            "sgst": round(total_sgst, 2),
            "igst": round(total_igst, 2),
            "total_tax": round(total_tax, 2),
        },
        "po_gst_total": round(po_total_gst, 2),
        "gst_variance": round(total_tax - po_total_gst, 2),
        "date_from": df.isoformat(),
        "date_to": dt.isoformat(),
    }


# ── 11. Purchase Returns ─────────────────────────────────────────────────────

async def get_returns(
    db: AsyncSession,
    vendor_id: UUID,
    date_from: Optional[date],
    date_to: Optional[date],
    supplier_id: Optional[UUID] = None,
    return_reason: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    df, dt = _default_range(date_from, date_to)

    # Aggregate by reason
    reason_q = (
        select(
            PurchaseReturn.return_reason,
            func.count(PurchaseReturn.id).label("cnt"),
            func.coalesce(func.sum(PurchaseReturn.total), 0).label("total"),
        )
        .where(
            PurchaseReturn.vendor_id == vendor_id,
            PurchaseReturn.status != "cancelled",
            _date_range_filter(PurchaseReturn.created_at, df, dt),
        )
        .group_by(PurchaseReturn.return_reason)
        .order_by(func.coalesce(func.sum(PurchaseReturn.total), 0).desc())
    )
    if supplier_id:
        reason_q = reason_q.where(PurchaseReturn.supplier_id == supplier_id)
    reason_rows = (await db.execute(reason_q)).all()
    by_reason = [
        {"reason": r.return_reason or "other", "count": int(r.cnt), "value": round(float(r.total or 0), 2)}
        for r in reason_rows
    ]

    # Aggregate by supplier
    sup_q = (
        select(
            PurchaseReturn.supplier_id,
            func.count(PurchaseReturn.id).label("cnt"),
            func.coalesce(func.sum(PurchaseReturn.total), 0).label("total"),
        )
        .where(
            PurchaseReturn.vendor_id == vendor_id,
            PurchaseReturn.status != "cancelled",
            _date_range_filter(PurchaseReturn.created_at, df, dt),
        )
        .group_by(PurchaseReturn.supplier_id)
        .order_by(func.coalesce(func.sum(PurchaseReturn.total), 0).desc())
    )
    if return_reason:
        sup_q = sup_q.where(PurchaseReturn.return_reason == return_reason)
    sup_rows = (await db.execute(sup_q)).all()

    sup_ids = [r.supplier_id for r in sup_rows if r.supplier_id]
    name_map: dict = {}
    if sup_ids:
        nr = (await db.execute(
            select(Supplier.id, Supplier.name).where(Supplier.id.in_(sup_ids))
        )).all()
        name_map = {str(r.id): r.name for r in nr}

    by_supplier = [
        {
            "supplier_id": str(r.supplier_id) if r.supplier_id else None,
            "name": name_map.get(str(r.supplier_id), "Unknown") if r.supplier_id else "—",
            "count": int(r.cnt),
            "value": round(float(r.total or 0), 2),
        }
        for r in sup_rows
    ]

    # Individual return list
    list_q = (
        select(
            PurchaseReturn.id,
            PurchaseReturn.supplier_id,
            PurchaseReturn.return_reason,
            PurchaseReturn.status,
            PurchaseReturn.total,
            PurchaseReturn.created_at,
        )
        .where(
            PurchaseReturn.vendor_id == vendor_id,
            PurchaseReturn.status != "cancelled",
            _date_range_filter(PurchaseReturn.created_at, df, dt),
        )
        .order_by(PurchaseReturn.created_at.desc())
    )
    if supplier_id:
        list_q = list_q.where(PurchaseReturn.supplier_id == supplier_id)
    if return_reason:
        list_q = list_q.where(PurchaseReturn.return_reason == return_reason)

    all_list = (await db.execute(list_q)).all()
    total_value = sum(float(r.total or 0) for r in all_list)
    paged = all_list[offset: offset + limit]

    items = [
        {
            "id": str(r.id),
            "supplier_id": str(r.supplier_id) if r.supplier_id else None,
            "supplier_name": name_map.get(str(r.supplier_id), "Unknown") if r.supplier_id else "—",
            "return_reason": r.return_reason or "other",
            "status": r.status,
            "total": round(float(r.total or 0), 2),
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in paged
    ]

    return {
        "items": items,
        "total": len(all_list),
        "total_value": round(total_value, 2),
        "by_reason": by_reason,
        "by_supplier": by_supplier,
        "date_from": df.isoformat(),
        "date_to": dt.isoformat(),
    }
