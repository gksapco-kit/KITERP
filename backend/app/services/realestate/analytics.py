"""Reports & analytics (module 23): MIS reports returned in the generic KPI + table layout the UI renders."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.realestate import core as C
from app.models.realestate import operations as O
from app.models.realestate import receivables as R
from app.models.realestate import supply as S

from .common import D
from .leasing import _age_bucket
from .postsales import add_months
from .projectmgmt import project_costing

LIVE_BOOKING = ("confirmed", "allotted", "agreement_signed", "registered", "handed_over")
SOLD_UNIT = ("booked", "sold", "handed_over")
UNSOLD_UNIT = ("available", "blocked", "hold")


def _f(v: Any) -> float:
    return float(D(v))


def kpi(label: str, value: Any, fmt: str = "number", tone: Optional[str] = None) -> dict:
    return {"label": label, "value": value, "format": fmt, "tone": tone}


def col(key: str, label: str, fmt: str = "text") -> dict:
    return {"key": key, "label": label, "format": fmt}


def _pct(a: Any, b: Any) -> Optional[float]:
    return round(float(D(a) / D(b) * 100), 1) if D(b) else None


def _window(from_date: Optional[date], to_date: Optional[date]) -> tuple[date, date]:
    to = to_date or date.today()
    return from_date or add_months(to.replace(day=1), -5), to


def _month(d: date) -> str:
    return d.strftime("%Y-%m")


async def _projects(db: AsyncSession, vendor_id: UUID, project_id: Optional[UUID] = None) -> dict[UUID, C.ReProject]:
    q = select(C.ReProject).where(C.ReProject.vendor_id == vendor_id)
    if project_id:
        q = q.where(C.ReProject.id == project_id)
    return {p.id: p for p in (await db.execute(q.order_by(C.ReProject.name))).scalars().all()}


def _pname(projects: dict, pid: Any) -> str:
    return projects[pid].name if pid in projects else "—"


# ═══ sales MIS ══════════════════════════════════════════════════════════════════════════════

async def sales_mis(db: AsyncSession, vendor_id: UUID, from_date: Optional[date], to_date: Optional[date], project_id: Optional[UUID]) -> dict:
    start, end = _window(from_date, to_date)
    projects = await _projects(db, vendor_id, project_id)
    bq = select(C.ReBooking).where(C.ReBooking.vendor_id == vendor_id, C.ReBooking.booking_date >= start, C.ReBooking.booking_date <= end)
    lq = select(C.ReLead).where(C.ReLead.vendor_id == vendor_id, C.ReLead.created_at >= _dt(start), C.ReLead.created_at < _dt(end + timedelta(days=1)))
    if project_id:
        bq, lq = bq.where(C.ReBooking.project_id == project_id), lq.where(C.ReLead.project_id == project_id)
    bookings = (await db.execute(bq)).scalars().all()
    leads = (await db.execute(lq)).scalars().all()
    live = [b for b in bookings if b.status in LIVE_BOOKING]
    cancelled = [b for b in bookings if b.status == "cancelled"]
    value = sum((D(b.agreement_value) for b in live), Decimal(0))
    collected = sum((D(b.paid_amount) for b in live), Decimal(0))
    discount = sum((D(b.discount_amount) for b in live), Decimal(0))
    gross = value + discount
    booked_leads = [l for l in leads if l.stage == "booked"]

    by_project: dict[Any, dict] = defaultdict(lambda: {"bookings": 0, "value": Decimal(0), "collected": Decimal(0), "discount": Decimal(0)})
    by_exec: dict[str, dict] = defaultdict(lambda: {"bookings": 0, "value": Decimal(0)})
    by_month: dict[str, dict] = defaultdict(lambda: {"bookings": 0, "value": Decimal(0)})
    for b in live:
        p = by_project[b.project_id]
        p["bookings"] += 1
        p["value"] += D(b.agreement_value)
        p["collected"] += D(b.paid_amount)
        p["discount"] += D(b.discount_amount)
        e = by_exec[(b.sales_executive_name or "Unassigned")]
        e["bookings"] += 1
        e["value"] += D(b.agreement_value)
        m = by_month[_month(b.booking_date)]
        m["bookings"] += 1
        m["value"] += D(b.agreement_value)
    stages: dict[str, int] = defaultdict(int)
    sources: dict[str, dict] = defaultdict(lambda: {"leads": 0, "booked": 0})
    for l in leads:
        stages[l.stage] += 1
        sources[l.source]["leads"] += 1
        sources[l.source]["booked"] += 1 if l.stage == "booked" else 0
    return {
        "title": "Sales MIS", "period": f"{start.isoformat()} to {end.isoformat()}",
        "kpis": [kpi("Bookings", len(live)), kpi("Sales value", _f(value), "money"), kpi("Average booking", _f(value / len(live)) if live else 0, "money"),
                 kpi("Collected on these", _f(collected), "money"), kpi("Collection", _pct(collected, value) if value else "—", "percent" if value else "text"),
                 kpi("Average discount", _pct(discount, gross) if gross else "—", "percent" if gross else "text"),
                 kpi("Cancelled", len(cancelled), "number", "bad" if cancelled else None), kpi("New leads", len(leads)),
                 kpi("Lead → booking", _pct(len(booked_leads), len(leads)) if leads else "—", "percent" if leads else "text")],
        "tables": [
            {"title": "By project", "columns": [col("project", "Project"), col("bookings", "Bookings", "number"), col("value", "Sales value", "money"),
                                                  col("collected", "Collected", "money"), col("discount_pct", "Discount", "percent")],
             "rows": [{"project": _pname(projects, pid), "bookings": v["bookings"], "value": _f(v["value"]), "collected": _f(v["collected"]),
                       "discount_pct": _pct(v["discount"], v["value"] + v["discount"]) or 0} for pid, v in by_project.items()]},
            {"title": "By month", "columns": [col("month", "Month"), col("bookings", "Bookings", "number"), col("value", "Sales value", "money")],
             "rows": [{"month": k, **{"bookings": v["bookings"], "value": _f(v["value"])}} for k, v in sorted(by_month.items())]},
            {"title": "Sales executives", "columns": [col("executive", "Executive"), col("bookings", "Bookings", "number"), col("value", "Sales value", "money")],
             "rows": [{"executive": k, "bookings": v["bookings"], "value": _f(v["value"])} for k, v in sorted(by_exec.items(), key=lambda kv: -kv[1]["value"])]},
            {"title": "Lead funnel", "columns": [col("stage", "Stage", "badge"), col("leads", "Leads", "number")],
             "rows": [{"stage": s, "leads": n} for s, n in sorted(stages.items(), key=lambda kv: C.PIPELINE_STAGES.index(kv[0]) if kv[0] in C.PIPELINE_STAGES else 99)]},
            {"title": "Lead sources", "columns": [col("source", "Source", "badge"), col("leads", "Leads", "number"), col("booked", "Booked", "number"),
                                                   col("rate", "Conversion", "percent")],
             "rows": [{"source": k, **v, "rate": _pct(v["booked"], v["leads"]) or 0} for k, v in sorted(sources.items(), key=lambda kv: -kv[1]["leads"])]},
        ],
    }


def _dt(d: date):
    from datetime import datetime, timezone

    return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)


# ═══ collections ════════════════════════════════════════════════════════════════════════════

async def collections(db: AsyncSession, vendor_id: UUID, from_date: Optional[date], to_date: Optional[date], project_id: Optional[UUID]) -> dict:
    start, end = _window(from_date, to_date)
    today = date.today()
    bq = select(C.ReBooking).where(C.ReBooking.vendor_id == vendor_id)
    if project_id:
        bq = bq.where(C.ReBooking.project_id == project_id)
    bookings = {b.id: b for b in (await db.execute(bq)).scalars().all()}
    demands = [d for d in (await db.execute(select(R.ReDemand).where(R.ReDemand.vendor_id == vendor_id, R.ReDemand.status != "cancelled"))).scalars().all()
               if d.booking_id in bookings]
    receipts = [r for r in (await db.execute(select(R.ReReceipt).where(R.ReReceipt.vendor_id == vendor_id))).scalars().all() if r.booking_id in bookings]
    customers = {c.id: c.full_name for c in (await db.execute(select(C.ReCustomer).where(C.ReCustomer.vendor_id == vendor_id))).scalars().all()}

    raised = [d for d in demands if start <= d.demand_date <= end]
    got = [r for r in receipts if start <= r.receipt_date <= end and r.status in ("received", "cleared")]
    pending_clear = [r for r in receipts if r.status == "received" and r.mode in ("cheque", "dd")]
    open_ = [d for d in demands if d.status in ("issued", "partial")]
    buckets = {"current": Decimal(0), "1-30": Decimal(0), "31-60": Decimal(0), "61-90": Decimal(0), "90+": Decimal(0)}
    by_cust: dict[Any, dict] = {}
    for d in open_:
        out = D(d.total_amount) - D(d.paid_amount)
        late = (today - d.due_date).days if d.due_date else 0
        buckets[_age_bucket(late)] += out
        if late > 0:
            c = by_cust.setdefault(d.customer_id, {"customer": customers.get(d.customer_id, "—"), "overdue": Decimal(0), "oldest_days": 0})
            c["overdue"] += out
            c["oldest_days"] = max(c["oldest_days"], late)
    months: dict[str, dict] = defaultdict(lambda: {"demanded": Decimal(0), "received": Decimal(0)})
    for d in raised:
        months[_month(d.demand_date)]["demanded"] += D(d.total_amount)
    for r in got:
        months[_month(r.receipt_date)]["received"] += D(r.gross_amount) or D(r.amount)
    modes: dict[str, dict] = defaultdict(lambda: {"count": 0, "amount": Decimal(0)})
    for r in got:
        modes[r.mode]["count"] += 1
        modes[r.mode]["amount"] += D(r.amount)
    demanded = sum((D(d.total_amount) for d in raised), Decimal(0))
    received = sum((D(r.gross_amount) or D(r.amount) for r in got), Decimal(0))
    overdue = sum((v for k, v in buckets.items() if k != "current"), Decimal(0))
    return {
        "title": "Collection report", "period": f"{start.isoformat()} to {end.isoformat()}",
        "kpis": [kpi("Demands raised", _f(demanded), "money"), kpi("Received", _f(received), "money"),
                 kpi("Collection vs demand", _pct(received, demanded) if demanded else "—", "percent" if demanded else "text"),
                 kpi("Outstanding today", _f(sum((D(d.total_amount) - D(d.paid_amount) for d in open_), Decimal(0))), "money"),
                 kpi("Overdue", _f(overdue), "money", "bad" if overdue else None),
                 kpi("Cheques awaiting clearance", len(pending_clear), "number", "warn" if pending_clear else None)],
        "tables": [
            {"title": "Month by month", "columns": [col("month", "Month"), col("demanded", "Demanded", "money"), col("received", "Received", "money")],
             "rows": [{"month": k, "demanded": _f(v["demanded"]), "received": _f(v["received"])} for k, v in sorted(months.items())]},
            {"title": "Overdue aging", "columns": [col("bucket", "Days overdue"), col("amount", "Outstanding", "money")],
             "rows": [{"bucket": k, "amount": _f(v)} for k, v in buckets.items()]},
            {"title": "Largest overdue accounts", "columns": [col("customer", "Customer"), col("overdue", "Overdue", "money"), col("oldest_days", "Oldest (days)", "number")],
             "rows": [{**v, "overdue": _f(v["overdue"])} for v in sorted(by_cust.values(), key=lambda x: -x["overdue"])[:15]]},
            {"title": "Receipts by mode", "columns": [col("mode", "Mode", "badge"), col("count", "Receipts", "number"), col("amount", "Amount", "money")],
             "rows": [{"mode": k, "count": v["count"], "amount": _f(v["amount"])} for k, v in sorted(modes.items(), key=lambda kv: -kv[1]["amount"])]},
        ],
    }


# ═══ project costing & profitability ════════════════════════════════════════════════════════

async def costing_report(db: AsyncSession, vendor_id: UUID, project_id: Optional[UUID]) -> dict:
    projects = await _projects(db, vendor_id, project_id)
    rows, over = [], []
    t = defaultdict(Decimal)
    for pid in projects:
        c = await project_costing(db, vendor_id, pid)
        tot = c["totals"]
        rows.append({"project": c["project"], "budget": tot["budget"], "committed": tot["committed"], "actual": tot["actual"], "forecast": tot["forecast"],
                     "variance": tot["variance"], "used_pct": _pct(tot["actual"], tot["budget"]) or 0, "over_heads": len(c["over_budget_heads"])})
        for k in ("budget", "committed", "actual", "forecast"):
            t[k] += D(tot[k])
        over += [{"project": c["project"], **r} for r in c["rows"] if r["over_budget"]]
    return {
        "title": "Project costing",
        "kpis": [kpi("Budget", _f(t["budget"]), "money"), kpi("Spent (actual)", _f(t["actual"]), "money"), kpi("Committed", _f(t["committed"]), "money"),
                 kpi("Forecast cost", _f(t["forecast"]), "money"), kpi("Budget left after forecast", _f(t["budget"] - t["forecast"]), "money",
                                                                        "bad" if t["budget"] and t["forecast"] > t["budget"] else None),
                 kpi("Heads over budget", len(over), "number", "bad" if over else None)],
        "tables": [
            {"title": "By project", "columns": [col("project", "Project"), col("budget", "Budget", "money"), col("committed", "Committed", "money"),
                                                  col("actual", "Actual", "money"), col("forecast", "Forecast", "money"), col("variance", "Variance", "money"),
                                                  col("used_pct", "Spent", "percent")], "rows": rows},
            {"title": "Over-budget cost heads", "columns": [col("project", "Project"), col("cost_head", "Cost head", "badge"), col("budget", "Budget", "money"),
                                                             col("forecast", "Forecast", "money"), col("variance", "Variance", "money")], "rows": over},
        ],
    }


async def profitability(db: AsyncSession, vendor_id: UUID, project_id: Optional[UUID]) -> dict:
    projects = await _projects(db, vendor_id, project_id)
    units = (await db.execute(select(C.ReUnit).where(C.ReUnit.vendor_id == vendor_id, C.ReUnit.status.in_(UNSOLD_UNIT)))).scalars().all()
    rows = []
    tot = defaultdict(Decimal)
    for pid in projects:
        c = await project_costing(db, vendor_id, pid)
        sales, collected = D(c["revenue"]["sales_value"]), D(c["revenue"]["collected"])
        forecast, actual = D(c["totals"]["forecast"]), D(c["totals"]["actual"])
        unsold = sum((D(u.total_price) for u in units if u.project_id == pid), Decimal(0))
        margin = sales - forecast
        potential = sales + unsold - forecast
        rows.append({"project": c["project"], "sales_value": _f(sales), "collected": _f(collected), "actual_cost": _f(actual), "forecast_cost": _f(forecast),
                     "margin": _f(margin), "margin_pct": _pct(margin, sales) if sales else None, "unsold_value": _f(unsold), "potential_margin": _f(potential)})
        for k, v in (("sales", sales), ("collected", collected), ("actual", actual), ("forecast", forecast), ("unsold", unsold), ("potential", potential)):
            tot[k] += v
    rent = sum((D(r.amount) for r in (await db.execute(select(O.ReOpsReceipt).where(
        O.ReOpsReceipt.vendor_id == vendor_id, O.ReOpsReceipt.kind == "rent", O.ReOpsReceipt.mode != "adjustment"))).scalars().all()), Decimal(0))
    return {
        "title": "Profitability",
        "kpis": [kpi("Sales value", _f(tot["sales"]), "money"), kpi("Collected", _f(tot["collected"]), "money"), kpi("Cost spent", _f(tot["actual"]), "money"),
                 kpi("Cash margin (collected − spent)", _f(tot["collected"] - tot["actual"]), "money", "bad" if tot["collected"] < tot["actual"] else "good"),
                 kpi("Projected margin on sold units", _f(tot["sales"] - tot["forecast"]), "money"),
                 kpi("Unsold inventory value", _f(tot["unsold"]), "money"), kpi("Margin if all units sell", _f(tot["potential"]), "money"),
                 kpi("Rent collected to date", _f(rent), "money")],
        "tables": [{"title": "By project", "columns": [col("project", "Project"), col("sales_value", "Sales value", "money"), col("collected", "Collected", "money"),
                                                         col("actual_cost", "Cost spent", "money"), col("forecast_cost", "Forecast cost", "money"),
                                                         col("margin", "Margin on sold", "money"), col("margin_pct", "Margin %", "percent"),
                                                         col("unsold_value", "Unsold value", "money"), col("potential_margin", "Margin if all sold", "money")],
                    "rows": rows}],
    }


# ═══ occupancy ══════════════════════════════════════════════════════════════════════════════

async def occupancy(db: AsyncSession, vendor_id: UUID, project_id: Optional[UUID]) -> dict:
    projects = await _projects(db, vendor_id, project_id)
    units = (await db.execute(select(C.ReUnit).where(C.ReUnit.vendor_id == vendor_id))).scalars().all()
    residents = (await db.execute(select(O.ReResident.unit_id).where(O.ReResident.vendor_id == vendor_id, O.ReResident.status == "active"))).scalars().all()
    resident_units = set(residents)
    leases = (await db.execute(select(O.ReLease).where(O.ReLease.vendor_id == vendor_id, O.ReLease.status == "active"))).scalars().all()
    rows, t = [], defaultdict(int)
    for pid, p in projects.items():
        us = [u for u in units if u.project_id == pid]
        by = defaultdict(int)
        for u in us:
            by[u.status] += 1
        saleable = len(us) - by["landowner_share"]
        sold = sum(by[s] for s in SOLD_UNIT)
        handed = by["handed_over"]
        occupied = sum(1 for u in us if u.status == "handed_over" and u.id in resident_units)
        row = {"project": p.name, "units": len(us), "available": by["available"], "held": by["blocked"] + by["hold"], "sold": sold, "handed_over": handed,
               "leased": by["leased"], "sold_pct": _pct(sold, saleable) if saleable else None, "occupied_homes": occupied,
               "occupancy_pct": _pct(occupied, handed) if handed else None}
        rows.append(row)
        for k in ("units", "available", "sold", "handed_over", "leased", "occupied_homes"):
            t[k] += row[k]
    return {
        "title": "Occupancy",
        "kpis": [kpi("Units", t["units"]), kpi("Available", t["available"]), kpi("Sold / booked", t["sold"]), kpi("Handed over", t["handed_over"]),
                 kpi("Homes with residents", t["occupied_homes"]), kpi("Leased units", t["leased"]), kpi("Active leases", len(leases))],
        "tables": [{"title": "By project", "columns": [col("project", "Project"), col("units", "Units", "number"), col("available", "Available", "number"),
                                                         col("held", "Held / blocked", "number"), col("sold", "Sold", "number"), col("sold_pct", "Sold %", "percent"),
                                                         col("handed_over", "Handed over", "number"), col("occupied_homes", "With residents", "number"),
                                                         col("occupancy_pct", "Occupied %", "percent"), col("leased", "Leased", "number")], "rows": rows}],
    }


# ═══ stock ageing ═══════════════════════════════════════════════════════════════════════════

BANDS = [("0-30 days", 30), ("31-90 days", 90), ("91-180 days", 180), ("181-365 days", 365), ("Over a year", 10 ** 6)]


def _band(days: int) -> str:
    for name, limit in BANDS:
        if days <= limit:
            return name
    return BANDS[-1][0]


async def inventory_ageing(db: AsyncSession, vendor_id: UUID, project_id: Optional[UUID]) -> dict:
    today = date.today()
    stores = {s.id: s for s in (await db.execute(select(S.ReSiteStore).where(S.ReSiteStore.vendor_id == vendor_id))).scalars().all()}
    materials = {m.id: m for m in (await db.execute(select(S.ReMaterial).where(S.ReMaterial.vendor_id == vendor_id))).scalars().all()}
    bals = (await db.execute(select(S.ReStockBalance).where(S.ReStockBalance.vendor_id == vendor_id, S.ReStockBalance.quantity > 0))).scalars().all()
    ledger = (await db.execute(select(S.ReStockLedger.store_id, S.ReStockLedger.material_id, S.ReStockLedger.txn_date).where(
        S.ReStockLedger.vendor_id == vendor_id))).all()
    last: dict[tuple, date] = {}
    for sid, mid, d in ledger:
        if (sid, mid) not in last or d > last[(sid, mid)]:
            last[(sid, mid)] = d
    bands: dict[str, dict] = {name: {"band": name, "lines": 0, "value": Decimal(0)} for name, _ in BANDS}
    rows = []
    for b in bals:
        store = stores.get(b.store_id)
        if project_id and (store is None or store.project_id != project_id):
            continue
        d = last.get((b.store_id, b.material_id), today)
        days = (today - d).days
        band = _band(days)
        bands[band]["lines"] += 1
        bands[band]["value"] += D(b.value)
        m = materials.get(b.material_id)
        rows.append({"material": m.name if m else "—", "store": store.name if store else "—", "quantity": _f(b.quantity), "unit": m.unit if m else "",
                     "value": _f(b.value), "last_movement": d.isoformat(), "idle_days": days, "band": band})
    rows.sort(key=lambda r: -r["idle_days"])
    total = sum((v["value"] for v in bands.values()), Decimal(0))
    slow = sum((v["value"] for k, v in bands.items() if k in ("181-365 days", "Over a year")), Decimal(0))
    return {
        "title": "Inventory ageing",
        "kpis": [kpi("Stock value", _f(total), "money"), kpi("Stock lines", len(rows)),
                 kpi("Idle over 6 months", _f(slow), "money", "warn" if slow else None), kpi("Share idle over 6 months", _pct(slow, total) if total else "—", "percent" if total else "text")],
        "tables": [
            {"title": "By age", "columns": [col("band", "Idle for"), col("lines", "Lines", "number"), col("value", "Value", "money")],
             "rows": [{**v, "value": _f(v["value"])} for v in bands.values()]},
            {"title": "Slowest-moving stock", "columns": [col("material", "Material"), col("store", "Store"), col("quantity", "Quantity", "number"), col("unit", "Unit"),
                                                           col("value", "Value", "money"), col("last_movement", "Last movement", "date"), col("idle_days", "Idle days", "number"),
                                                           col("band", "Band")], "rows": rows[:30]},
        ],
    }
