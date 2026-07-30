"""Production analytics — KPIs, cost roll-up, throughput and work-center utilization (Phase 6).

Mounted at a distinct path (`/production/analytics`, not nested under
`/production-orders/...`) so it never collides with the `{order_id}` path
parameter on the CRUD routes in vendor_production.py.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_vendor_id, require_permission
from app.models.production import ProductionOrder
from app.models.production_routing import ProductionOperation, WorkCenter
from app.models.store import Store

router = APIRouter(dependencies=[Depends(require_permission("production.view"))])


def _f(v) -> float:
    return float(v) if v is not None else 0.0


@router.get("/production/analytics")
async def production_analytics(
    store_id: Optional[UUID] = Query(None),
    date_from: Optional[date] = Query(None, description="Filter by order created_at (inclusive)"),
    date_to: Optional[date] = Query(None, description="Filter by order created_at (inclusive)"),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    date_to = date_to or datetime.now(timezone.utc).date()
    date_from = date_from or (date_to - timedelta(days=29))

    q = select(ProductionOrder).where(
        ProductionOrder.vendor_id == vendor_id,
        ProductionOrder.created_at >= datetime.combine(date_from, datetime.min.time()),
        ProductionOrder.created_at < datetime.combine(date_to + timedelta(days=1), datetime.min.time()),
    )
    if store_id:
        q = q.where(ProductionOrder.store_id == store_id)
    orders = (await db.execute(q)).scalars().all()

    total = len(orders)
    by_status: dict[str, int] = defaultdict(int)
    by_type: dict[str, int] = defaultdict(int)
    completed_count = 0
    on_time = 0
    late = 0
    cycle_days_sum = 0.0
    cycle_days_n = 0
    trend: dict[str, dict[str, int]] = defaultdict(lambda: {"created": 0, "completed": 0})
    cost = {"planned_material": Decimal("0"), "actual_material": Decimal("0"),
            "planned_labor": Decimal("0"), "actual_labor": Decimal("0")}
    delayed: list[dict] = []
    store_stats: dict[str, dict] = defaultdict(lambda: {"orders": 0, "completed": 0})

    for o in orders:
        by_status[o.status] += 1
        by_type[o.type] += 1
        trend[o.created_at.date().isoformat()]["created"] += 1

        cost["planned_material"] += Decimal(str(o.planned_material_cost or 0))
        cost["actual_material"] += Decimal(str(o.actual_material_cost or 0))
        cost["planned_labor"] += Decimal(str(o.planned_labor_cost or 0))
        cost["actual_labor"] += Decimal(str(o.actual_labor_cost or 0))

        store_key = str(o.store_id) if o.store_id else "unassigned"
        store_stats[store_key]["orders"] += 1

        # inventory_posted_at is set exactly once, atomically with status='completed'
        # (see app.services.production_inventory.post_production_completion), so it
        # doubles as a reliable "completed at" timestamp without a dedicated column.
        if o.status == "completed" and o.inventory_posted_at:
            completed_count += 1
            completed_date = o.inventory_posted_at.date()
            trend[completed_date.isoformat()]["completed"] += 1
            store_stats[store_key]["completed"] += 1
            cycle_days_sum += (o.inventory_posted_at - o.created_at).total_seconds() / 86400
            cycle_days_n += 1
            if o.target_date:
                if completed_date <= o.target_date:
                    on_time += 1
                else:
                    late += 1
                    delayed.append({
                        "id": str(o.id), "ref": o.ref, "target_date": o.target_date.isoformat(),
                        "completed_date": completed_date.isoformat(),
                        "days_late": (completed_date - o.target_date).days,
                    })

    delayed.sort(key=lambda d: d["days_late"], reverse=True)

    order_ids = [o.id for o in orders]
    wc_stats: dict[str, dict] = {}
    if order_ids:
        rows = (await db.execute(
            select(ProductionOperation, WorkCenter)
            .outerjoin(WorkCenter, ProductionOperation.work_center_id == WorkCenter.id)
            .where(
                ProductionOperation.production_order_id.in_(order_ids),
                ProductionOperation.vendor_id == vendor_id,
            )
        )).all()
        for op, wc in rows:
            key = str(wc.id) if wc else "unassigned"
            entry = wc_stats.setdefault(key, {
                "work_center_id": key if wc else None,
                "name": wc.name if wc else "Unassigned",
                "planned_hours": 0.0,
                "actual_hours": 0.0,
                "capacity_per_day": _f(wc.capacity_per_day) if wc else None,
            })
            entry["planned_hours"] += _f(op.planned_hours)
            entry["actual_hours"] += _f(op.actual_hours)

    store_ids = [UUID(k) for k in store_stats if k != "unassigned"]
    store_names: dict[str, str] = {}
    if store_ids:
        srows = (await db.execute(select(Store.id, Store.name).where(Store.id.in_(store_ids)))).all()
        store_names = {str(sid): name for sid, name in srows}

    planned_total = cost["planned_material"] + cost["planned_labor"]
    actual_total = cost["actual_material"] + cost["actual_labor"]
    variance = actual_total - planned_total

    return {
        "range": {"from": date_from.isoformat(), "to": date_to.isoformat()},
        "totals": {
            "orders": total,
            "completed": completed_count,
            "cancelled": by_status.get("cancelled", 0),
            "in_progress": max(total - completed_count - by_status.get("cancelled", 0), 0),
            "on_time": on_time,
            "late": late,
            "on_time_rate": round(on_time / (on_time + late) * 100, 1) if (on_time + late) else None,
            "avg_cycle_days": round(cycle_days_sum / cycle_days_n, 2) if cycle_days_n else None,
        },
        "by_status": [{"status": k, "count": v} for k, v in sorted(by_status.items())],
        "by_type": [{"type": k, "count": v} for k, v in sorted(by_type.items())],
        "cost": {
            "planned_material": float(cost["planned_material"]),
            "actual_material": float(cost["actual_material"]),
            "planned_labor": float(cost["planned_labor"]),
            "actual_labor": float(cost["actual_labor"]),
            "planned_total": float(planned_total),
            "actual_total": float(actual_total),
            "variance": float(variance),
            "variance_pct": round(float(variance / planned_total * 100), 1) if planned_total else None,
        },
        "trend": [{"date": d, **v} for d, v in sorted(trend.items())],
        "top_delayed": delayed[:10],
        "work_center_utilization": sorted(wc_stats.values(), key=lambda x: x["actual_hours"], reverse=True),
        "by_store": [
            {"store_id": None if k == "unassigned" else k, "store_name": store_names.get(k, "Unassigned"), **v}
            for k, v in sorted(store_stats.items(), key=lambda kv: kv[1]["orders"], reverse=True)
        ],
    }
