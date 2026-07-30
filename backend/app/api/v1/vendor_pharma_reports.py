"""
Pharma Reporting Manager — date-range-aware analytics for the Pharmaceutical module.

Primary endpoint: GET /overview
  Returns one rich payload covering 6 report groups (lots, manufacturing, QC, QMS,
  GDP, serialization) powering the entire Pharma Reporting Manager dashboard.

Detail endpoint: GET /detail/{report_id}
  Returns paginated, sortable rows for the drill-down modal; keeps the overview
  lightweight by only returning top-N series there.

Filters (all optional):
  date_from / date_to  — ISO date, inclusive. Defaults to last 30 days.
  plant_id             — Scope to one plant.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy import and_, cast, Date, extract, func as sqlfunc, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_active_user, require_permission
from app.models.user import User
from app.models.procurement_goods import GoodsBatch
from app.models.pharma import (
    BatchTransaction,
    PharmaBpr,
    PharmaMbr,
    PharmaQcSpec,
    PharmaInspectionLot,
    PharmaRecall,
    PharmaDeviation,
    PharmaCapa,
    PharmaChangeControl,
    PharmaComplaint,
    PharmaTempExcursion,
    PharmaSerialUnit,
    PharmaAuditEvent,
    PharmaEpcisEvent,
    PharmaTradingPartner,
)
from app.services.vendor_service import VendorService

router = APIRouter(dependencies=[Depends(require_permission("pharma.view"))])


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _vendor_id(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> UUID:
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(404, "No vendor found")
    return vendor.id


def _plant_uuid(plant_id: str | None) -> UUID | None:
    if not plant_id:
        return None
    try:
        return UUID(plant_id)
    except ValueError:
        raise HTTPException(400, "Invalid plant_id")


def _parse_range(date_from: str | None, date_to: str | None) -> tuple[date, date]:
    today = date.today()
    try:
        df = date.fromisoformat(date_from) if date_from else (today - timedelta(days=29))
        dt = date.fromisoformat(date_to) if date_to else today
    except ValueError:
        raise HTTPException(400, "Invalid date_from / date_to (use YYYY-MM-DD)")
    if df > dt:
        df, dt = dt, df
    return df, dt


def _pct(curr: float, prev: float) -> float | None:
    if prev == 0:
        return None if curr == 0 else 100.0
    return round((curr - prev) / prev * 100.0, 1)


def _kpi(curr: float, prev: float) -> dict:
    return {
        "value": round(float(curr), 2),
        "prev": round(float(prev), 2),
        "delta_pct": _pct(float(curr), float(prev)),
    }


async def _scalar(db: AsyncSession, stmt) -> float:
    return (await db.execute(stmt)).scalar_one() or 0


# ── Overview endpoint ─────────────────────────────────────────────────────────

@router.get("/overview")
async def pharma_reports_overview(
    date_from: str | None = Query(None, description="ISO date (inclusive). Default: 30 days ago"),
    date_to: str | None = Query(None, description="ISO date (inclusive). Default: today"),
    plant_id: str | None = Query(None, description="Scope to a specific plant"),
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    df, dt = _parse_range(date_from, date_to)
    pid = _plant_uuid(plant_id)
    days = (dt - df).days + 1
    prev_to = df - timedelta(days=1)
    prev_from = prev_to - timedelta(days=days - 1)
    today = date.today()

    # ── Shared batch filter helper ─────────────────────────────────────────────
    def batch_base(*extra):
        conds = [GoodsBatch.vendor_id == vid, GoodsBatch.is_active.is_(True), *extra]
        if pid:
            conds.append(GoodsBatch.plant_id == pid)
        return and_(*conds)

    def batch_created(start: date, end: date, *extra):
        conds = [
            GoodsBatch.vendor_id == vid,
            cast(GoodsBatch.created_at, Date) >= start,
            cast(GoodsBatch.created_at, Date) <= end,
            *extra,
        ]
        if pid:
            conds.append(GoodsBatch.plant_id == pid)
        return and_(*conds)

    def txn_in_period(start: date, end: date, *extra):
        conds = [
            BatchTransaction.vendor_id == vid,
            cast(BatchTransaction.created_at, Date) >= start,
            cast(BatchTransaction.created_at, Date) <= end,
            *extra,
        ]
        if pid:
            conds.append(BatchTransaction.plant_id == pid)
        return and_(*conds)

    def insp_created(start: date, end: date, *extra):
        conds = [
            PharmaInspectionLot.vendor_id == vid,
            cast(PharmaInspectionLot.created_at, Date) >= start,
            cast(PharmaInspectionLot.created_at, Date) <= end,
            *extra,
        ]
        return and_(*conds)

    def bpr_created(start: date, end: date, *extra):
        conds = [
            PharmaBpr.vendor_id == vid,
            cast(PharmaBpr.created_at, Date) >= start,
            cast(PharmaBpr.created_at, Date) <= end,
            *extra,
        ]
        if pid:
            pass  # PharmaBpr has no plant_id column; skip plant filter
        return and_(*conds)

    def deviation_in(start: date, end: date, *extra):
        conds = [
            PharmaDeviation.vendor_id == vid,
            cast(PharmaDeviation.created_at, Date) >= start,
            cast(PharmaDeviation.created_at, Date) <= end,
            *extra,
        ]
        return and_(*conds)

    def capa_in(start: date, end: date, *extra):
        conds = [
            PharmaCapa.vendor_id == vid,
            cast(PharmaCapa.created_at, Date) >= start,
            cast(PharmaCapa.created_at, Date) <= end,
            *extra,
        ]
        return and_(*conds)

    def complaint_in(start: date, end: date, *extra):
        conds = [
            PharmaComplaint.vendor_id == vid,
            cast(PharmaComplaint.created_at, Date) >= start,
            cast(PharmaComplaint.created_at, Date) <= end,
            *extra,
        ]
        return and_(*conds)

    def excursion_in(start: date, end: date, *extra):
        conds = [
            PharmaTempExcursion.vendor_id == vid,
            cast(PharmaTempExcursion.created_at, Date) >= start,
            cast(PharmaTempExcursion.created_at, Date) <= end,
            *extra,
        ]
        if pid:
            pass  # excursions link to storage_location, not plant directly
        return and_(*conds)

    # ── KPIs — current period vs previous period (created/received counts) ─────

    # Lots received in period
    lots_rcv_cur = await _scalar(
        db, select(sqlfunc.count(BatchTransaction.id)).where(
            txn_in_period(df, dt, BatchTransaction.txn_type == "receive")
        )
    )
    lots_rcv_prev = await _scalar(
        db, select(sqlfunc.count(BatchTransaction.id)).where(
            txn_in_period(prev_from, prev_to, BatchTransaction.txn_type == "receive")
        )
    )

    # Currently in QI (point-in-time)
    qi_cur = await _scalar(
        db, select(sqlfunc.count(GoodsBatch.id)).where(
            batch_base(GoodsBatch.quality_status == "quality_inspection")
        )
    )
    # For QI prev: count batches that entered QI in previous period (created with QI status)
    qi_prev = await _scalar(
        db, select(sqlfunc.count(BatchTransaction.id)).where(
            txn_in_period(prev_from, prev_to, BatchTransaction.quality_status == "quality_inspection")
        )
    )

    # Inspections opened in period
    insp_cur = await _scalar(
        db, select(sqlfunc.count(PharmaInspectionLot.id)).where(insp_created(df, dt))
    )
    insp_prev = await _scalar(
        db, select(sqlfunc.count(PharmaInspectionLot.id)).where(insp_created(prev_from, prev_to))
    )

    # BPRs completed in period & avg yield
    bpr_comp_cur = await _scalar(
        db, select(sqlfunc.count(PharmaBpr.id)).where(
            bpr_created(df, dt, PharmaBpr.status == "completed")
        )
    )
    bpr_comp_prev = await _scalar(
        db, select(sqlfunc.count(PharmaBpr.id)).where(
            bpr_created(prev_from, prev_to, PharmaBpr.status == "completed")
        )
    )
    avg_yield_cur = await _scalar(
        db, select(sqlfunc.coalesce(sqlfunc.avg(PharmaBpr.yield_pct), 0)).where(
            bpr_created(df, dt, PharmaBpr.status == "completed")
        )
    )
    avg_yield_prev = await _scalar(
        db, select(sqlfunc.coalesce(sqlfunc.avg(PharmaBpr.yield_pct), 0)).where(
            bpr_created(prev_from, prev_to, PharmaBpr.status == "completed")
        )
    )

    # Deviations opened in period
    dev_cur = await _scalar(
        db, select(sqlfunc.count(PharmaDeviation.id)).where(deviation_in(df, dt))
    )
    dev_prev = await _scalar(
        db, select(sqlfunc.count(PharmaDeviation.id)).where(deviation_in(prev_from, prev_to))
    )

    # CAPA overdue now (point-in-time)
    capa_overdue_cur = await _scalar(
        db, select(sqlfunc.count(PharmaCapa.id)).where(and_(
            PharmaCapa.vendor_id == vid,
            PharmaCapa.status != "closed",
            PharmaCapa.due_date < today,
        ))
    )
    capa_overdue_prev = await _scalar(
        db, select(sqlfunc.count(PharmaCapa.id)).where(and_(
            PharmaCapa.vendor_id == vid,
            PharmaCapa.status != "closed",
            PharmaCapa.due_date < prev_to,
        ))
    )

    # Complaints opened in period
    comp_cur = await _scalar(
        db, select(sqlfunc.count(PharmaComplaint.id)).where(complaint_in(df, dt))
    )
    comp_prev = await _scalar(
        db, select(sqlfunc.count(PharmaComplaint.id)).where(complaint_in(prev_from, prev_to))
    )

    # Temperature excursions in period
    excur_cur = await _scalar(
        db, select(sqlfunc.count(PharmaTempExcursion.id)).where(excursion_in(df, dt))
    )
    excur_prev = await _scalar(
        db, select(sqlfunc.count(PharmaTempExcursion.id)).where(excursion_in(prev_from, prev_to))
    )

    # Open recalls (point-in-time)
    recall_open = await _scalar(
        db, select(sqlfunc.count(PharmaRecall.id)).where(and_(
            PharmaRecall.vendor_id == vid,
            PharmaRecall.status.in_(["open", "investigating", "notified"]),
        ))
    )
    recall_prev_period = await _scalar(
        db, select(sqlfunc.count(PharmaRecall.id)).where(and_(
            PharmaRecall.vendor_id == vid,
            cast(PharmaRecall.created_at, Date) >= prev_from,
            cast(PharmaRecall.created_at, Date) <= prev_to,
        ))
    )

    kpis = {
        "lots_received": _kpi(lots_rcv_cur, lots_rcv_prev),
        "qi_batches": _kpi(qi_cur, qi_prev),
        "inspections_opened": _kpi(insp_cur, insp_prev),
        "bpr_completed": _kpi(bpr_comp_cur, bpr_comp_prev),
        "avg_yield_pct": _kpi(float(avg_yield_cur), float(avg_yield_prev)),
        "deviations_opened": _kpi(dev_cur, dev_prev),
        "capa_overdue": _kpi(capa_overdue_cur, capa_overdue_prev),
        "complaints_opened": _kpi(comp_cur, comp_prev),
        "excursions": _kpi(excur_cur, excur_prev),
        "open_recalls": _kpi(recall_open, recall_prev_period),
    }

    # ════════════════════════════════════════════════════════════════════════════
    # GROUP A — LOT CONTROL
    # ════════════════════════════════════════════════════════════════════════════

    # Batch status distribution (point-in-time)
    status_rows = (await db.execute(
        select(GoodsBatch.quality_status, sqlfunc.count(GoodsBatch.id).label("cnt"))
        .where(batch_base())
        .group_by(GoodsBatch.quality_status)
    )).all()
    batch_status_dist = [
        {"label": r.quality_status or "unrestricted", "value": int(r.cnt)}
        for r in status_rows
    ]

    # Expiry buckets (active batches with expiry_date set)
    exp_rows = (await db.execute(
        select(GoodsBatch.expiry_date, GoodsBatch.quantity_available)
        .where(batch_base(GoodsBatch.expiry_date.isnot(None)))
    )).all()
    buckets: dict[str, int] = {
        "Expired": 0, "0–30d": 0, "31–60d": 0, "61–90d": 0, "91–180d": 0, ">180d": 0
    }
    for r in exp_rows:
        d = (r.expiry_date - today).days
        if d < 0:
            buckets["Expired"] += 1
        elif d <= 30:
            buckets["0–30d"] += 1
        elif d <= 60:
            buckets["31–60d"] += 1
        elif d <= 90:
            buckets["61–90d"] += 1
        elif d <= 180:
            buckets["91–180d"] += 1
        else:
            buckets[">180d"] += 1
    expiry_buckets = [{"label": k, "value": v} for k, v in buckets.items()]

    # Transaction trend in period (daily)
    txn_trend_rows = (await db.execute(
        select(
            cast(BatchTransaction.created_at, Date).label("day"),
            sqlfunc.count(BatchTransaction.id).label("cnt"),
        )
        .where(txn_in_period(df, dt))
        .group_by(cast(BatchTransaction.created_at, Date))
        .order_by(cast(BatchTransaction.created_at, Date))
    )).all()
    txn_day_map = {str(r.day): int(r.cnt) for r in txn_trend_rows}
    txn_trend = []
    cursor = df
    while cursor <= dt:
        k = str(cursor)
        txn_trend.append({"date": k, "value": txn_day_map.get(k, 0)})
        cursor += timedelta(days=1)

    # Transactions by type in period
    txn_type_rows = (await db.execute(
        select(BatchTransaction.txn_type, sqlfunc.count(BatchTransaction.id).label("cnt"))
        .where(txn_in_period(df, dt))
        .group_by(BatchTransaction.txn_type)
        .order_by(sqlfunc.count(BatchTransaction.id).desc())
    )).all()
    txn_by_type = [{"label": r.txn_type or "manual", "value": int(r.cnt)} for r in txn_type_rows]

    # Top 10 lots expiring soonest (within 90 days)
    top_expiring_rows = (await db.execute(
        select(
            GoodsBatch.batch_number,
            GoodsBatch.expiry_date,
            GoodsBatch.quantity_available,
            GoodsBatch.quality_status,
        )
        .where(batch_base(
            GoodsBatch.expiry_date.isnot(None),
            GoodsBatch.expiry_date <= today + timedelta(days=90),
            GoodsBatch.quantity_available > 0,
        ))
        .order_by(GoodsBatch.expiry_date)
        .limit(10)
    )).all()
    top_expiring = [
        {
            "label": f"{r.batch_number} (exp {r.expiry_date})",
            "value": int((r.expiry_date - today).days),
            "qty": float(r.quantity_available or 0),
            "status": r.quality_status,
        }
        for r in top_expiring_rows
    ]

    lots = {
        "status_dist": batch_status_dist,
        "expiry_buckets": expiry_buckets,
        "txn_trend": txn_trend,
        "txn_by_type": txn_by_type,
        "top_expiring": top_expiring,
    }

    # ════════════════════════════════════════════════════════════════════════════
    # GROUP B — MANUFACTURING (MBR / BPR)
    # ════════════════════════════════════════════════════════════════════════════

    # BPR status distribution in period
    bpr_status_rows = (await db.execute(
        select(PharmaBpr.status, sqlfunc.count(PharmaBpr.id).label("cnt"))
        .where(bpr_created(df, dt))
        .group_by(PharmaBpr.status)
    )).all()
    bpr_status_dist = [{"label": r.status or "open", "value": int(r.cnt)} for r in bpr_status_rows]

    # BPR yield trend (daily avg yield for completed BPRs)
    yield_rows = (await db.execute(
        select(
            cast(PharmaBpr.completed_at, Date).label("day"),
            sqlfunc.avg(PharmaBpr.yield_pct).label("avg_yield"),
            sqlfunc.count(PharmaBpr.id).label("cnt"),
        )
        .where(and_(
            PharmaBpr.vendor_id == vid,
            PharmaBpr.status == "completed",
            cast(PharmaBpr.completed_at, Date) >= df,
            cast(PharmaBpr.completed_at, Date) <= dt,
            PharmaBpr.yield_pct.isnot(None),
        ))
        .group_by(cast(PharmaBpr.completed_at, Date))
        .order_by(cast(PharmaBpr.completed_at, Date))
    )).all()
    yield_trend = [
        {"date": str(r.day), "value": round(float(r.avg_yield or 0), 2), "count": int(r.cnt)}
        for r in yield_rows
    ]

    # MBR status (point-in-time — not date filtered)
    mbr_rows = (await db.execute(
        select(PharmaMbr.status, sqlfunc.count(PharmaMbr.id).label("cnt"))
        .where(PharmaMbr.vendor_id == vid)
        .group_by(PharmaMbr.status)
    )).all()
    mbr_status = [{"label": r.status or "draft", "value": int(r.cnt)} for r in mbr_rows]

    manufacturing = {
        "bpr_status_dist": bpr_status_dist,
        "yield_trend": yield_trend,
        "mbr_status": mbr_status,
    }

    # ════════════════════════════════════════════════════════════════════════════
    # GROUP C — QUALITY CONTROL
    # ════════════════════════════════════════════════════════════════════════════

    # Inspection decision breakdown in period
    decision_rows = (await db.execute(
        select(
            PharmaInspectionLot.decision,
            PharmaInspectionLot.status,
            sqlfunc.count(PharmaInspectionLot.id).label("cnt"),
        )
        .where(insp_created(df, dt))
        .group_by(PharmaInspectionLot.decision, PharmaInspectionLot.status)
    )).all()
    dec_map: dict[str, int] = {}
    for r in decision_rows:
        key = r.decision if r.decision else r.status
        dec_map[key] = dec_map.get(key, 0) + int(r.cnt)
    inspection_decision = [{"label": k, "value": v} for k, v in dec_map.items()]

    # Inspection by origin in period
    origin_rows = (await db.execute(
        select(PharmaInspectionLot.origin, sqlfunc.count(PharmaInspectionLot.id).label("cnt"))
        .where(insp_created(df, dt))
        .group_by(PharmaInspectionLot.origin)
    )).all()
    inspection_origin = [{"label": r.origin or "receipt", "value": int(r.cnt)} for r in origin_rows]

    # Inspection daily trend
    insp_trend_rows = (await db.execute(
        select(
            cast(PharmaInspectionLot.created_at, Date).label("day"),
            sqlfunc.count(PharmaInspectionLot.id).label("cnt"),
        )
        .where(insp_created(df, dt))
        .group_by(cast(PharmaInspectionLot.created_at, Date))
        .order_by(cast(PharmaInspectionLot.created_at, Date))
    )).all()
    insp_day_map = {str(r.day): int(r.cnt) for r in insp_trend_rows}
    inspection_trend = []
    cursor = df
    while cursor <= dt:
        k = str(cursor)
        inspection_trend.append({"date": k, "value": insp_day_map.get(k, 0)})
        cursor += timedelta(days=1)

    # OOS status distribution (point-in-time)
    oos_rows = (await db.execute(
        select(PharmaInspectionLot.oos_status, sqlfunc.count(PharmaInspectionLot.id).label("cnt"))
        .where(and_(
            PharmaInspectionLot.vendor_id == vid,
            PharmaInspectionLot.oos_status.isnot(None),
        ))
        .group_by(PharmaInspectionLot.oos_status)
    )).all()
    oos_status = [{"label": r.oos_status, "value": int(r.cnt)} for r in oos_rows]

    qc = {
        "inspection_decision": inspection_decision,
        "inspection_origin": inspection_origin,
        "inspection_trend": inspection_trend,
        "oos_status": oos_status,
    }

    # ════════════════════════════════════════════════════════════════════════════
    # GROUP D — QMS (Deviations / CAPA / Change Control / Recalls / Complaints)
    # ════════════════════════════════════════════════════════════════════════════

    # Deviation severity in period
    dev_sev_rows = (await db.execute(
        select(PharmaDeviation.severity, sqlfunc.count(PharmaDeviation.id).label("cnt"))
        .where(deviation_in(df, dt))
        .group_by(PharmaDeviation.severity)
    )).all()
    deviation_severity = [{"label": r.severity or "minor", "value": int(r.cnt)} for r in dev_sev_rows]

    # Deviation daily trend
    dev_trend_rows = (await db.execute(
        select(
            cast(PharmaDeviation.created_at, Date).label("day"),
            sqlfunc.count(PharmaDeviation.id).label("cnt"),
        )
        .where(deviation_in(df, dt))
        .group_by(cast(PharmaDeviation.created_at, Date))
        .order_by(cast(PharmaDeviation.created_at, Date))
    )).all()
    dev_day_map = {str(r.day): int(r.cnt) for r in dev_trend_rows}
    deviation_trend = []
    cursor = df
    while cursor <= dt:
        k = str(cursor)
        deviation_trend.append({"date": k, "value": dev_day_map.get(k, 0)})
        cursor += timedelta(days=1)

    # CAPA status (all open/in-progress — point-in-time)
    capa_status_rows = (await db.execute(
        select(PharmaCapa.status, sqlfunc.count(PharmaCapa.id).label("cnt"))
        .where(PharmaCapa.vendor_id == vid)
        .group_by(PharmaCapa.status)
    )).all()
    # Add overdue flag
    overdue_cnt = int(capa_overdue_cur)
    capa_map = {r.status: int(r.cnt) for r in capa_status_rows}
    capa_status = [
        {"label": k, "value": v} for k, v in capa_map.items()
    ]
    capa_status.append({"label": "overdue", "value": overdue_cnt})

    # Recall status (point-in-time)
    recall_rows = (await db.execute(
        select(PharmaRecall.status, sqlfunc.count(PharmaRecall.id).label("cnt"))
        .where(PharmaRecall.vendor_id == vid)
        .group_by(PharmaRecall.status)
    )).all()
    recall_status = [{"label": r.status, "value": int(r.cnt)} for r in recall_rows]

    # Complaint type in period
    comp_type_rows = (await db.execute(
        select(PharmaComplaint.complaint_type, sqlfunc.count(PharmaComplaint.id).label("cnt"))
        .where(complaint_in(df, dt))
        .group_by(PharmaComplaint.complaint_type)
    )).all()
    complaint_by_type = [{"label": r.complaint_type or "customer", "value": int(r.cnt)} for r in comp_type_rows]

    # Change control status (point-in-time)
    cc_rows = (await db.execute(
        select(PharmaChangeControl.status, sqlfunc.count(PharmaChangeControl.id).label("cnt"))
        .where(PharmaChangeControl.vendor_id == vid)
        .group_by(PharmaChangeControl.status)
    )).all()
    cc_status = [{"label": r.status, "value": int(r.cnt)} for r in cc_rows]

    qms = {
        "deviation_severity": deviation_severity,
        "deviation_trend": deviation_trend,
        "capa_status": capa_status,
        "recall_status": recall_status,
        "complaint_by_type": complaint_by_type,
        "cc_status": cc_status,
    }

    # ════════════════════════════════════════════════════════════════════════════
    # GROUP E — GDP / COLD CHAIN
    # ════════════════════════════════════════════════════════════════════════════

    # Excursion severity in period
    excur_sev_rows = (await db.execute(
        select(PharmaTempExcursion.severity, sqlfunc.count(PharmaTempExcursion.id).label("cnt"))
        .where(excursion_in(df, dt))
        .group_by(PharmaTempExcursion.severity)
    )).all()
    excursion_severity = [{"label": r.severity or "minor", "value": int(r.cnt)} for r in excur_sev_rows]

    # Excursion daily trend
    exc_trend_rows = (await db.execute(
        select(
            cast(PharmaTempExcursion.created_at, Date).label("day"),
            sqlfunc.count(PharmaTempExcursion.id).label("cnt"),
        )
        .where(excursion_in(df, dt))
        .group_by(cast(PharmaTempExcursion.created_at, Date))
        .order_by(cast(PharmaTempExcursion.created_at, Date))
    )).all()
    exc_day_map = {str(r.day): int(r.cnt) for r in exc_trend_rows}
    excursion_trend = []
    cursor = df
    while cursor <= dt:
        k = str(cursor)
        excursion_trend.append({"date": k, "value": exc_day_map.get(k, 0)})
        cursor += timedelta(days=1)

    # Excursion status breakdown
    exc_status_rows = (await db.execute(
        select(PharmaTempExcursion.status, sqlfunc.count(PharmaTempExcursion.id).label("cnt"))
        .where(PharmaTempExcursion.vendor_id == vid)
        .group_by(PharmaTempExcursion.status)
    )).all()
    excursion_status = [{"label": r.status, "value": int(r.cnt)} for r in exc_status_rows]

    gdp = {
        "excursion_severity": excursion_severity,
        "excursion_trend": excursion_trend,
        "excursion_status": excursion_status,
    }

    # ════════════════════════════════════════════════════════════════════════════
    # GROUP F — SERIALIZATION
    # ════════════════════════════════════════════════════════════════════════════

    serial_status_rows = (await db.execute(
        select(PharmaSerialUnit.status, sqlfunc.count(PharmaSerialUnit.id).label("cnt"))
        .where(PharmaSerialUnit.vendor_id == vid)
        .group_by(PharmaSerialUnit.status)
    )).all()
    serial_status = [{"label": r.status, "value": int(r.cnt)} for r in serial_status_rows]

    serial_level_rows = (await db.execute(
        select(PharmaSerialUnit.level, sqlfunc.count(PharmaSerialUnit.id).label("cnt"))
        .where(PharmaSerialUnit.vendor_id == vid)
        .group_by(PharmaSerialUnit.level)
    )).all()
    serial_by_level = [{"label": r.level, "value": int(r.cnt)} for r in serial_level_rows]

    # Serials commissioned in period
    serial_trend_rows = (await db.execute(
        select(
            cast(PharmaSerialUnit.created_at, Date).label("day"),
            sqlfunc.count(PharmaSerialUnit.id).label("cnt"),
        )
        .where(and_(
            PharmaSerialUnit.vendor_id == vid,
            cast(PharmaSerialUnit.created_at, Date) >= df,
            cast(PharmaSerialUnit.created_at, Date) <= dt,
        ))
        .group_by(cast(PharmaSerialUnit.created_at, Date))
        .order_by(cast(PharmaSerialUnit.created_at, Date))
    )).all()
    serial_day_map = {str(r.day): int(r.cnt) for r in serial_trend_rows}
    serial_trend = []
    cursor = df
    while cursor <= dt:
        k = str(cursor)
        serial_trend.append({"date": k, "value": serial_day_map.get(k, 0)})
        cursor += timedelta(days=1)

    serialization = {
        "serial_status": serial_status,
        "serial_by_level": serial_by_level,
        "serial_trend": serial_trend,
    }

    return JSONResponse(content={
        "range": {
            "from": str(df),
            "to": str(dt),
            "days": days,
            "prev_from": str(prev_from),
            "prev_to": str(prev_to),
        },
        "generated_at": datetime.utcnow().isoformat(),
        "kpis": kpis,
        "lots": lots,
        "manufacturing": manufacturing,
        "qc": qc,
        "qms": qms,
        "gdp": gdp,
        "serialization": serialization,
    })


# ── Detail endpoint ───────────────────────────────────────────────────────────

DETAIL_REPORTS = {
    "batch_register", "expiry_register", "txn_log", "batch_by_status",
    "bpr_list", "bpr_yield", "mbr_list",
    "inspection_list", "inspection_oos",
    "deviation_list", "capa_list", "recall_list", "complaint_list", "cc_list",
    "excursion_list",
    "serial_list",
    "audit_trail",
}


@router.get("/detail/{report_id}")
async def pharma_report_detail(
    report_id: str,
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    plant_id: str | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    vid: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    if report_id not in DETAIL_REPORTS:
        raise HTTPException(404, f"Unknown report_id '{report_id}'")

    df, dt = _parse_range(date_from, date_to)
    pid = _plant_uuid(plant_id)
    offset = (page - 1) * size

    rows: list[dict] = []
    total = 0

    # ── batch_register ────────────────────────────────────────────────────────
    if report_id == "batch_register":
        base_where = and_(
            GoodsBatch.vendor_id == vid,
            GoodsBatch.is_active.is_(True),
            cast(GoodsBatch.created_at, Date) >= df,
            cast(GoodsBatch.created_at, Date) <= dt,
            *([GoodsBatch.plant_id == pid] if pid else []),
            *([GoodsBatch.batch_number.ilike(f"%{search}%")] if search else []),
        )
        total = int(await _scalar(db, select(sqlfunc.count(GoodsBatch.id)).where(base_where)))
        res = (await db.execute(
            select(GoodsBatch)
            .where(base_where)
            .order_by(GoodsBatch.created_at.desc())
            .offset(offset).limit(size)
        )).scalars().all()
        today = date.today()
        rows = [
            {
                "batch_number": r.batch_number,
                "quality_status": r.quality_status,
                "source_type": r.source_type or "—",
                "manufacturing_date": str(r.manufacturing_date) if r.manufacturing_date else "—",
                "expiry_date": str(r.expiry_date) if r.expiry_date else "—",
                "days_to_expiry": (r.expiry_date - today).days if r.expiry_date else None,
                "qty_available": float(r.quantity_available or 0),
                "storage_condition": r.storage_condition or "—",
                "created_at": r.created_at.date().isoformat() if r.created_at else "—",
            }
            for r in res
        ]

    # ── expiry_register ───────────────────────────────────────────────────────
    elif report_id == "expiry_register":
        today = date.today()
        base_where = and_(
            GoodsBatch.vendor_id == vid,
            GoodsBatch.is_active.is_(True),
            GoodsBatch.expiry_date.isnot(None),
            GoodsBatch.quantity_available > 0,
            *([GoodsBatch.plant_id == pid] if pid else []),
            *([GoodsBatch.batch_number.ilike(f"%{search}%")] if search else []),
        )
        total = int(await _scalar(db, select(sqlfunc.count(GoodsBatch.id)).where(base_where)))
        res = (await db.execute(
            select(GoodsBatch)
            .where(base_where)
            .order_by(GoodsBatch.expiry_date)
            .offset(offset).limit(size)
        )).scalars().all()
        rows = [
            {
                "batch_number": r.batch_number,
                "expiry_date": str(r.expiry_date),
                "days_to_expiry": (r.expiry_date - today).days,
                "quality_status": r.quality_status,
                "qty_available": float(r.quantity_available or 0),
                "storage_condition": r.storage_condition or "—",
            }
            for r in res
        ]

    # ── txn_log ───────────────────────────────────────────────────────────────
    elif report_id == "txn_log":
        base_where = and_(
            BatchTransaction.vendor_id == vid,
            cast(BatchTransaction.created_at, Date) >= df,
            cast(BatchTransaction.created_at, Date) <= dt,
            *([BatchTransaction.plant_id == pid] if pid else []),
        )
        total = int(await _scalar(db, select(sqlfunc.count(BatchTransaction.id)).where(base_where)))
        res = (await db.execute(
            select(BatchTransaction)
            .where(base_where)
            .order_by(BatchTransaction.created_at.desc())
            .offset(offset).limit(size)
        )).scalars().all()
        rows = [
            {
                "txn_type": r.txn_type,
                "source_type": r.source_type or "—",
                "document_number": r.document_number or "—",
                "quantity": float(r.quantity or 0),
                "uom": r.uom or "—",
                "quality_status": r.quality_status or "—",
                "created_at": r.created_at.date().isoformat() if r.created_at else "—",
            }
            for r in res
        ]

    # ── bpr_list ───────────────────────────────────────────────────────────────
    elif report_id == "bpr_list":
        base_where = and_(
            PharmaBpr.vendor_id == vid,
            cast(PharmaBpr.created_at, Date) >= df,
            cast(PharmaBpr.created_at, Date) <= dt,
            *([PharmaBpr.batch_number.ilike(f"%{search}%")] if search else []),
        )
        total = int(await _scalar(db, select(sqlfunc.count(PharmaBpr.id)).where(base_where)))
        res = (await db.execute(
            select(PharmaBpr)
            .where(base_where)
            .order_by(PharmaBpr.created_at.desc())
            .offset(offset).limit(size)
        )).scalars().all()
        rows = [
            {
                "batch_number": r.batch_number,
                "status": r.status,
                "planned_qty": float(r.planned_qty or 0),
                "actual_qty": float(r.actual_qty or 0),
                "yield_pct": float(r.yield_pct or 0),
                "clearance_done": r.clearance_done,
                "started_at": r.started_at.date().isoformat() if r.started_at else "—",
                "completed_at": r.completed_at.date().isoformat() if r.completed_at else "—",
            }
            for r in res
        ]

    # ── mbr_list ───────────────────────────────────────────────────────────────
    elif report_id == "mbr_list":
        base_where = and_(
            PharmaMbr.vendor_id == vid,
            *([PharmaMbr.title.ilike(f"%{search}%")] if search else []),
        )
        total = int(await _scalar(db, select(sqlfunc.count(PharmaMbr.id)).where(base_where)))
        res = (await db.execute(
            select(PharmaMbr)
            .where(base_where)
            .order_by(PharmaMbr.created_at.desc())
            .offset(offset).limit(size)
        )).scalars().all()
        rows = [
            {
                "code": r.code,
                "title": r.title,
                "version": r.version,
                "status": r.status,
                "batch_size": f"{float(r.batch_size or 0)} {r.batch_size_uom or ''}".strip(),
                "effective_from": str(r.effective_from) if r.effective_from else "—",
                "approved_at": r.approved_at.date().isoformat() if r.approved_at else "—",
            }
            for r in res
        ]

    # ── inspection_list ────────────────────────────────────────────────────────
    elif report_id == "inspection_list":
        base_where = and_(
            PharmaInspectionLot.vendor_id == vid,
            cast(PharmaInspectionLot.created_at, Date) >= df,
            cast(PharmaInspectionLot.created_at, Date) <= dt,
        )
        total = int(await _scalar(db, select(sqlfunc.count(PharmaInspectionLot.id)).where(base_where)))
        res = (await db.execute(
            select(PharmaInspectionLot)
            .where(base_where)
            .order_by(PharmaInspectionLot.created_at.desc())
            .offset(offset).limit(size)
        )).scalars().all()
        rows = [
            {
                "origin": r.origin,
                "status": r.status,
                "sample_qty": float(r.sample_qty or 0),
                "decision": r.decision or "pending",
                "coa_number": r.coa_number or "—",
                "oos_status": r.oos_status or "—",
                "decided_at": r.decided_at.date().isoformat() if r.decided_at else "—",
                "created_at": r.created_at.date().isoformat() if r.created_at else "—",
            }
            for r in res
        ]

    # ── inspection_oos ─────────────────────────────────────────────────────────
    elif report_id == "inspection_oos":
        base_where = and_(
            PharmaInspectionLot.vendor_id == vid,
            PharmaInspectionLot.oos_status.isnot(None),
        )
        total = int(await _scalar(db, select(sqlfunc.count(PharmaInspectionLot.id)).where(base_where)))
        res = (await db.execute(
            select(PharmaInspectionLot)
            .where(base_where)
            .order_by(PharmaInspectionLot.created_at.desc())
            .offset(offset).limit(size)
        )).scalars().all()
        rows = [
            {
                "origin": r.origin,
                "oos_status": r.oos_status,
                "decision": r.decision or "—",
                "coa_number": r.coa_number or "—",
                "created_at": r.created_at.date().isoformat() if r.created_at else "—",
            }
            for r in res
        ]

    # ── deviation_list ─────────────────────────────────────────────────────────
    elif report_id == "deviation_list":
        base_where = and_(
            PharmaDeviation.vendor_id == vid,
            cast(PharmaDeviation.created_at, Date) >= df,
            cast(PharmaDeviation.created_at, Date) <= dt,
            *([PharmaDeviation.number.ilike(f"%{search}%")] if search else []),
        )
        total = int(await _scalar(db, select(sqlfunc.count(PharmaDeviation.id)).where(base_where)))
        res = (await db.execute(
            select(PharmaDeviation)
            .where(base_where)
            .order_by(PharmaDeviation.created_at.desc())
            .offset(offset).limit(size)
        )).scalars().all()
        rows = [
            {
                "number": r.number,
                "title": r.title,
                "severity": r.severity,
                "status": r.status,
                "has_capa": r.linked_capa_id is not None,
                "created_at": r.created_at.date().isoformat() if r.created_at else "—",
            }
            for r in res
        ]

    # ── capa_list ──────────────────────────────────────────────────────────────
    elif report_id == "capa_list":
        today = date.today()
        base_where = and_(
            PharmaCapa.vendor_id == vid,
            cast(PharmaCapa.created_at, Date) >= df,
            cast(PharmaCapa.created_at, Date) <= dt,
            *([PharmaCapa.number.ilike(f"%{search}%")] if search else []),
        )
        total = int(await _scalar(db, select(sqlfunc.count(PharmaCapa.id)).where(base_where)))
        res = (await db.execute(
            select(PharmaCapa)
            .where(base_where)
            .order_by(PharmaCapa.created_at.desc())
            .offset(offset).limit(size)
        )).scalars().all()
        rows = [
            {
                "number": r.number,
                "title": r.title,
                "status": r.status,
                "due_date": str(r.due_date) if r.due_date else "—",
                "is_overdue": r.status != "closed" and r.due_date is not None and r.due_date < today,
                "effectiveness_due_date": str(r.effectiveness_due_date) if r.effectiveness_due_date else "—",
                "closed_at": r.closed_at.date().isoformat() if r.closed_at else "—",
                "created_at": r.created_at.date().isoformat() if r.created_at else "—",
            }
            for r in res
        ]

    # ── recall_list ────────────────────────────────────────────────────────────
    elif report_id == "recall_list":
        base_where = and_(
            PharmaRecall.vendor_id == vid,
            *([PharmaRecall.recall_number.ilike(f"%{search}%")] if search else []),
        )
        total = int(await _scalar(db, select(sqlfunc.count(PharmaRecall.id)).where(base_where)))
        res = (await db.execute(
            select(PharmaRecall)
            .where(base_where)
            .order_by(PharmaRecall.created_at.desc())
            .offset(offset).limit(size)
        )).scalars().all()
        rows = [
            {
                "recall_number": r.recall_number,
                "severity": r.severity,
                "status": r.status,
                "reason": (r.reason or "")[:100],
                "created_at": r.created_at.date().isoformat() if r.created_at else "—",
                "closed_at": r.closed_at.date().isoformat() if r.closed_at else "—",
            }
            for r in res
        ]

    # ── complaint_list ─────────────────────────────────────────────────────────
    elif report_id == "complaint_list":
        base_where = and_(
            PharmaComplaint.vendor_id == vid,
            cast(PharmaComplaint.created_at, Date) >= df,
            cast(PharmaComplaint.created_at, Date) <= dt,
            *([PharmaComplaint.number.ilike(f"%{search}%")] if search else []),
        )
        total = int(await _scalar(db, select(sqlfunc.count(PharmaComplaint.id)).where(base_where)))
        res = (await db.execute(
            select(PharmaComplaint)
            .where(base_where)
            .order_by(PharmaComplaint.created_at.desc())
            .offset(offset).limit(size)
        )).scalars().all()
        rows = [
            {
                "number": r.number,
                "complaint_type": r.complaint_type,
                "severity": r.severity,
                "title": r.title,
                "status": r.status,
                "reported_by": r.reported_by or "—",
                "created_at": r.created_at.date().isoformat() if r.created_at else "—",
            }
            for r in res
        ]

    # ── cc_list ────────────────────────────────────────────────────────────────
    elif report_id == "cc_list":
        base_where = and_(
            PharmaChangeControl.vendor_id == vid,
            cast(PharmaChangeControl.created_at, Date) >= df,
            cast(PharmaChangeControl.created_at, Date) <= dt,
            *([PharmaChangeControl.number.ilike(f"%{search}%")] if search else []),
        )
        total = int(await _scalar(db, select(sqlfunc.count(PharmaChangeControl.id)).where(base_where)))
        res = (await db.execute(
            select(PharmaChangeControl)
            .where(base_where)
            .order_by(PharmaChangeControl.created_at.desc())
            .offset(offset).limit(size)
        )).scalars().all()
        rows = [
            {
                "number": r.number,
                "title": r.title,
                "change_type": r.change_type,
                "status": r.status,
                "approvals_done": len(r.approvals) if r.approvals else 0,
                "required_approvals": r.required_approvals,
                "created_at": r.created_at.date().isoformat() if r.created_at else "—",
            }
            for r in res
        ]

    # ── excursion_list ─────────────────────────────────────────────────────────
    elif report_id == "excursion_list":
        base_where = and_(
            PharmaTempExcursion.vendor_id == vid,
            cast(PharmaTempExcursion.created_at, Date) >= df,
            cast(PharmaTempExcursion.created_at, Date) <= dt,
        )
        total = int(await _scalar(db, select(sqlfunc.count(PharmaTempExcursion.id)).where(base_where)))
        res = (await db.execute(
            select(PharmaTempExcursion)
            .where(base_where)
            .order_by(PharmaTempExcursion.created_at.desc())
            .offset(offset).limit(size)
        )).scalars().all()
        rows = [
            {
                "severity": r.severity,
                "status": r.status,
                "temp_c": float(r.temp_c or 0),
                "duration_minutes": r.duration_minutes or 0,
                "recorded_at": r.recorded_at.date().isoformat() if r.recorded_at else "—",
                "closed_at": r.closed_at.date().isoformat() if r.closed_at else "—",
            }
            for r in res
        ]

    # ── serial_list ────────────────────────────────────────────────────────────
    elif report_id == "serial_list":
        base_where = and_(
            PharmaSerialUnit.vendor_id == vid,
            cast(PharmaSerialUnit.created_at, Date) >= df,
            cast(PharmaSerialUnit.created_at, Date) <= dt,
            *([PharmaSerialUnit.serial_number.ilike(f"%{search}%")] if search else []),
        )
        total = int(await _scalar(db, select(sqlfunc.count(PharmaSerialUnit.id)).where(base_where)))
        res = (await db.execute(
            select(PharmaSerialUnit)
            .where(base_where)
            .order_by(PharmaSerialUnit.created_at.desc())
            .offset(offset).limit(size)
        )).scalars().all()
        rows = [
            {
                "serial_number": r.serial_number,
                "level": r.level,
                "status": r.status,
                "has_parent": r.parent_id is not None,
                "created_at": r.created_at.date().isoformat() if r.created_at else "—",
            }
            for r in res
        ]

    # ── audit_trail (requires pharma.audit permission — checked at router level) ─
    elif report_id == "audit_trail":
        base_where = and_(
            PharmaAuditEvent.vendor_id == vid,
            cast(PharmaAuditEvent.created_at, Date) >= df,
            cast(PharmaAuditEvent.created_at, Date) <= dt,
            *([PharmaAuditEvent.actor_name.ilike(f"%{search}%")] if search else []),
        )
        total = int(await _scalar(db, select(sqlfunc.count(PharmaAuditEvent.id)).where(base_where)))
        res = (await db.execute(
            select(PharmaAuditEvent)
            .where(base_where)
            .order_by(PharmaAuditEvent.created_at.desc())
            .offset(offset).limit(size)
        )).scalars().all()
        rows = [
            {
                "entity_type": r.entity_type,
                "action": r.action,
                "meaning": r.meaning or "—",
                "actor_name": r.actor_name or "—",
                "esign_verified": r.esign_verified,
                "ip_address": r.ip_address or "—",
                "created_at": r.created_at.date().isoformat() if r.created_at else "—",
            }
            for r in res
        ]

    return JSONResponse(content={
        "report_id": report_id,
        "total": total,
        "page": page,
        "size": size,
        "pages": max(1, -(-total // size)),
        "rows": rows,
    })
