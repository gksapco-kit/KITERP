"""Dashboard KPIs and reports for the Asset Management module."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset_mgmt import (
    AmAsset, AmAssignment, AmAudit, AmCategory, AmCoverage, AmEvent, AmLicense, AmLocation,
    AmMaintenancePlan, AmRequest, AmTransfer, AmWorkOrder,
)
from app.services.asset_mgmt import audits as audits_svc
from app.services.asset_mgmt import finance_bridge
from app.services.asset_mgmt.common import to_dict

_LIVE = ("in_stock", "assigned", "in_transit", "under_maintenance", "reserved", "lost")


async def dashboard(db: AsyncSession, vendor_id: UUID, *, include_finance: bool) -> dict:
    today = date.today()
    now = datetime.now(timezone.utc)

    by_status = dict((await db.execute(
        select(AmAsset.status, func.count(AmAsset.id)).where(AmAsset.vendor_id == vendor_id).group_by(AmAsset.status)
    )).all())
    live_total = sum(n for s, n in by_status.items() if s in _LIVE)
    value = float((await db.execute(
        select(func.coalesce(func.sum(AmAsset.acquisition_cost), 0)).where(AmAsset.vendor_id == vendor_id, AmAsset.status.in_(_LIVE))
    )).scalar_one() or 0)

    by_category = [
        {"name": n or "Uncategorised", "count": int(c), "value": float(v or 0)}
        for n, c, v in (await db.execute(
            select(AmCategory.name, func.count(AmAsset.id), func.coalesce(func.sum(AmAsset.acquisition_cost), 0))
            .select_from(AmAsset).outerjoin(AmCategory, AmCategory.id == AmAsset.category_id)
            .where(AmAsset.vendor_id == vendor_id, AmAsset.status.in_(_LIVE))
            .group_by(AmCategory.name).order_by(func.count(AmAsset.id).desc()).limit(10)
        )).all()
    ]

    overdue_returns = (await db.execute(select(func.count(AmAssignment.id)).where(
        AmAssignment.vendor_id == vendor_id, AmAssignment.returned_at.is_(None),
        AmAssignment.due_back_on.isnot(None), AmAssignment.due_back_on < today))).scalar_one()
    unacknowledged = (await db.execute(select(func.count(AmAssignment.id)).where(
        AmAssignment.vendor_id == vendor_id, AmAssignment.returned_at.is_(None),
        AmAssignment.assignee_type == "employee", AmAssignment.acknowledged_at.is_(None)))).scalar_one()

    plans_due = (await db.execute(select(func.count(AmMaintenancePlan.id)).where(
        AmMaintenancePlan.vendor_id == vendor_id, AmMaintenancePlan.is_active.is_(True),
        AmMaintenancePlan.next_due_on.isnot(None), AmMaintenancePlan.next_due_on <= today + timedelta(days=7)))).scalar_one()
    open_wo = (await db.execute(select(func.count(AmWorkOrder.id)).where(
        AmWorkOrder.vendor_id == vendor_id, AmWorkOrder.status.in_(("open", "in_progress"))))).scalar_one()
    overdue_wo = (await db.execute(select(func.count(AmWorkOrder.id)).where(
        AmWorkOrder.vendor_id == vendor_id, AmWorkOrder.status.in_(("open", "in_progress")),
        AmWorkOrder.scheduled_on.isnot(None), AmWorkOrder.scheduled_on < today))).scalar_one()
    maint_cost_30d = float((await db.execute(select(func.coalesce(func.sum(AmWorkOrder.cost_total), 0)).where(
        AmWorkOrder.vendor_id == vendor_id, AmWorkOrder.status == "completed",
        AmWorkOrder.completed_at >= now - timedelta(days=30)))).scalar_one() or 0)

    expiring_cov = (await db.execute(select(func.count(AmCoverage.id)).where(
        AmCoverage.vendor_id == vendor_id, AmCoverage.is_active.is_(True), AmCoverage.end_date.isnot(None),
        AmCoverage.end_date >= today, AmCoverage.end_date <= today + timedelta(days=30)))).scalar_one()
    expired_cov = (await db.execute(select(func.count(AmCoverage.id)).where(
        AmCoverage.vendor_id == vendor_id, AmCoverage.is_active.is_(True), AmCoverage.end_date.isnot(None),
        AmCoverage.end_date < today))).scalar_one()
    expiring_lic = (await db.execute(select(func.count(AmLicense.id)).where(
        AmLicense.vendor_id == vendor_id, AmLicense.is_active.is_(True), AmLicense.expiry_date.isnot(None),
        AmLicense.expiry_date <= today + timedelta(days=30)))).scalar_one()

    pending_transfers = (await db.execute(select(func.count(AmTransfer.id)).where(
        AmTransfer.vendor_id == vendor_id, AmTransfer.status == "requested"))).scalar_one()
    in_transit = (await db.execute(select(func.count(AmTransfer.id)).where(
        AmTransfer.vendor_id == vendor_id, AmTransfer.status == "in_transit"))).scalar_one()
    pending_requests = (await db.execute(select(func.count(AmRequest.id)).where(
        AmRequest.vendor_id == vendor_id, AmRequest.status == "pending"))).scalar_one()
    approved_requests = (await db.execute(select(func.count(AmRequest.id)).where(
        AmRequest.vendor_id == vendor_id, AmRequest.status == "approved"))).scalar_one()

    # Idle: in stock with no activity for 90 days
    last_event = select(AmEvent.asset_id, func.max(AmEvent.created_at).label("t")).where(
        AmEvent.vendor_id == vendor_id).group_by(AmEvent.asset_id).subquery()
    idle = (await db.execute(
        select(func.count(AmAsset.id)).outerjoin(last_event, last_event.c.asset_id == AmAsset.id)
        .where(AmAsset.vendor_id == vendor_id, AmAsset.status == "in_stock",
               func.coalesce(last_event.c.t, AmAsset.created_at) < now - timedelta(days=90))
    )).scalar_one()

    last_audit = (await db.execute(select(AmAudit).where(
        AmAudit.vendor_id == vendor_id, AmAudit.status == "completed").order_by(AmAudit.completed_at.desc()).limit(1))).scalar_one_or_none()
    audit_summary = None
    if last_audit is not None:
        rep = await audits_svc.audit_report(db, vendor_id, last_audit.id)
        audit_summary = {"id": str(last_audit.id), "audit_no": last_audit.audit_no, "name": last_audit.name,
                         "completed_at": last_audit.completed_at.isoformat() if last_audit.completed_at else None,
                         "accuracy_pct": rep["accuracy_pct"], "variance": rep["variance"], "counts": rep["counts"]}
    open_audits = (await db.execute(select(func.count(AmAudit.id)).where(
        AmAudit.vendor_id == vendor_id, AmAudit.status.in_(("draft", "in_progress"))))).scalar_one()

    recent = (await db.execute(
        select(AmEvent, AmAsset.asset_tag, AmAsset.name).join(AmAsset, AmAsset.id == AmEvent.asset_id)
        .where(AmEvent.vendor_id == vendor_id).order_by(AmEvent.created_at.desc()).limit(12)
    )).all()

    out: dict[str, Any] = {
        "totals": {"assets": live_total, "value": value, "by_status": {k: int(v) for k, v in by_status.items()}},
        "by_category": by_category,
        "attention": {
            "overdue_returns": int(overdue_returns), "unacknowledged": int(unacknowledged),
            "maintenance_plans_due": int(plans_due), "open_work_orders": int(open_wo), "overdue_work_orders": int(overdue_wo),
            "coverage_expiring": int(expiring_cov), "coverage_expired": int(expired_cov),
            "licenses_expiring": int(expiring_lic), "idle_assets": int(idle), "open_audits": int(open_audits),
            "lost_assets": int(by_status.get("lost", 0)),
        },
        "approvals": {"transfers_pending": int(pending_transfers), "transfers_in_transit": int(in_transit),
                      "requests_pending": int(pending_requests), "requests_to_fulfil": int(approved_requests)},
        "maintenance_cost_30d": maint_cost_30d,
        "last_audit": audit_summary,
        "recent_activity": [{**to_dict(e), "asset_tag": tag, "asset_name": name} for e, tag, name in recent],
    }
    if include_finance:
        out["finance"] = await finance_bridge.finance_summary(db, vendor_id)
    return out


async def report_by_location(db: AsyncSession, vendor_id: UUID) -> list[dict]:
    rows = (await db.execute(
        select(AmLocation.name, func.count(AmAsset.id), func.coalesce(func.sum(AmAsset.acquisition_cost), 0))
        .select_from(AmAsset).outerjoin(AmLocation, AmLocation.id == AmAsset.location_id)
        .where(AmAsset.vendor_id == vendor_id, AmAsset.status.in_(_LIVE))
        .group_by(AmLocation.name).order_by(func.count(AmAsset.id).desc())
    )).all()
    return [{"name": n or "No location", "count": int(c), "value": float(v or 0)} for n, c, v in rows]


async def report_maintenance_cost(db: AsyncSession, vendor_id: UUID, months: int = 12) -> list[dict]:
    since = datetime.now(timezone.utc) - timedelta(days=31 * max(1, min(months, 36)))
    rows = (await db.execute(
        select(AmAsset.asset_tag, AmAsset.name, func.count(AmWorkOrder.id), func.coalesce(func.sum(AmWorkOrder.cost_total), 0),
               func.coalesce(func.sum(AmWorkOrder.downtime_hours), 0))
        .join(AmAsset, AmAsset.id == AmWorkOrder.asset_id)
        .where(AmWorkOrder.vendor_id == vendor_id, AmWorkOrder.status == "completed", AmWorkOrder.completed_at >= since)
        .group_by(AmAsset.asset_tag, AmAsset.name).order_by(func.sum(AmWorkOrder.cost_total).desc()).limit(100)
    )).all()
    return [{"asset_tag": t, "name": n, "work_orders": int(c), "cost": float(cost or 0), "downtime_hours": float(d or 0)}
            for t, n, c, cost, d in rows]


async def report_aging(db: AsyncSession, vendor_id: UUID) -> list[dict]:
    """Age buckets by acquisition date (0-1y, 1-3y, 3-5y, 5y+, unknown)."""
    today = date.today()
    buckets = {"Under 1 year": [0, 0.0], "1-3 years": [0, 0.0], "3-5 years": [0, 0.0], "Over 5 years": [0, 0.0], "Unknown": [0, 0.0]}
    for acq, cost in (await db.execute(
        select(AmAsset.acquisition_date, AmAsset.acquisition_cost).where(AmAsset.vendor_id == vendor_id, AmAsset.status.in_(_LIVE))
    )).all():
        if acq is None:
            key = "Unknown"
        else:
            yrs = (today - acq).days / 365.25
            key = "Under 1 year" if yrs < 1 else "1-3 years" if yrs < 3 else "3-5 years" if yrs < 5 else "Over 5 years"
        buckets[key][0] += 1
        buckets[key][1] += float(cost or 0)
    return [{"bucket": k, "count": v[0], "value": v[1]} for k, v in buckets.items()]
