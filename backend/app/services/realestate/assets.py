"""Asset management (module 21): register, depreciation, maintenance history, transfers and disposal."""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.realestate import core as C
from app.models.realestate import operations as O

from .common import Ctx, D, audit, get_owned, money_q

EPS = Decimal("0.005")


def _f(v: Any) -> float:
    return float(D(v))


def book_value(a: O.ReAsset, on: Optional[date] = None) -> Decimal:
    """Net book value on a date. Straight line: (cost - salvage) spread over useful life.
    Written-down value: cost reduced by the yearly rate. Never below salvage value."""
    cost, salvage = D(a.purchase_cost), D(a.salvage_value)
    on = on or a.disposed_on or date.today()
    if a.purchase_date is None or on <= a.purchase_date:
        return money_q(cost)
    years = Decimal((on - a.purchase_date).days) / Decimal("365.25")
    if a.depreciation_method == "wdv":
        rate = D(a.depreciation_rate) / 100
        value = cost * ((1 - rate) ** years) if rate > 0 else cost
    else:
        life = Decimal(max(int(a.useful_life_years or 1), 1))
        value = cost - (cost - salvage) * min(years / life, Decimal(1))
    return money_q(max(value, salvage))


def _check_terms(d: dict[str, Any]) -> None:
    cost, salvage = D(d.get("purchase_cost")), D(d.get("salvage_value"))
    if cost < 0 or salvage < 0:
        raise HTTPException(status_code=422, detail="Cost and salvage value cannot be negative")
    if salvage > cost:
        raise HTTPException(status_code=422, detail="Salvage value cannot exceed the purchase cost")
    if int(d.get("useful_life_years", 10)) < 1:
        raise HTTPException(status_code=422, detail="Useful life must be at least one year")
    if d.get("depreciation_method", "straight_line") == "wdv" and not 0 < D(d.get("depreciation_rate")) <= 100:
        raise HTTPException(status_code=422, detail="Set a depreciation rate between 0 and 100% for the written-down-value method")
    pd = d.get("purchase_date")
    if pd and pd > date.today():
        raise HTTPException(status_code=422, detail="The purchase date cannot be in the future")


async def asset_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    _check_terms(data)
    data["status"] = "active"
    data["disposed_on"] = None


async def asset_before_update(ctx: Ctx, obj: O.ReAsset, data: dict[str, Any]) -> None:
    keys = ("purchase_cost", "salvage_value", "useful_life_years", "depreciation_method", "depreciation_rate", "purchase_date")
    _check_terms({k: data.get(k, getattr(obj, k)) for k in keys})


async def asset_before_delete(ctx: Ctx, obj: O.ReAsset) -> None:
    for model, label in ((O.ReAssetMaintenance, "maintenance history"), (O.ReAssetTransfer, "transfers"), (O.ReFacilityWorkOrder, "work orders")):
        n = (await ctx.db.execute(select(func.count()).select_from(model).where(model.asset_id == obj.id))).scalar_one()
        if n:
            raise HTTPException(status_code=409, detail=f"This asset has {label}; dispose of it instead of deleting")


def _live(a: O.ReAsset) -> None:
    if a.status == "disposed":
        raise HTTPException(status_code=409, detail=f"{a.name} has been disposed of")


# ── maintenance ──────────────────────────────────────────────────────────────────────────

async def maintenance_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    a = await get_owned(ctx.db, O.ReAsset, ctx.vendor_id, data["asset_id"], "asset")
    _live(a)
    on = data.get("performed_on") or date.today()
    if on > date.today():
        raise HTTPException(status_code=422, detail="The service date cannot be in the future")
    if D(data.get("cost")) < 0:
        raise HTTPException(status_code=422, detail="Cost cannot be negative")
    if data.get("next_due_on") and data["next_due_on"] <= on:
        raise HTTPException(status_code=422, detail="The next service must be after this one")
    data["performed_on"] = on


async def maintenance_after_create(ctx: Ctx, m: O.ReAssetMaintenance) -> None:
    await record_service(ctx, await ctx.db.get(O.ReAsset, m.asset_id), m.performed_on, m.next_due_on)


async def record_service(ctx: Ctx, a: O.ReAsset, performed_on: date, next_due: Optional[date]) -> None:
    if a.last_maintenance_on is None or performed_on >= a.last_maintenance_on:
        a.last_maintenance_on = performed_on
        a.next_maintenance_on = next_due or a.next_maintenance_on
        if next_due is None and a.next_maintenance_on and a.next_maintenance_on <= performed_on:
            a.next_maintenance_on = None


# ── transfers ────────────────────────────────────────────────────────────────────────────

async def transfer_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    a = await get_owned(ctx.db, O.ReAsset, ctx.vendor_id, data["asset_id"], "asset")
    _live(a)
    if not data.get("to_project_id") and not (data.get("to_location") or "").strip():
        raise HTTPException(status_code=422, detail="Choose where the asset is going")
    to_proj = data.get("to_project_id") or a.project_id
    to_loc = (data.get("to_location") or a.location or "")
    if to_proj == a.project_id and to_loc == (a.location or ""):
        raise HTTPException(status_code=422, detail="The asset is already there")
    pending = (await ctx.db.execute(select(func.count()).select_from(O.ReAssetTransfer).where(
        O.ReAssetTransfer.asset_id == a.id, O.ReAssetTransfer.status == "pending"))).scalar_one()
    if pending:
        raise HTTPException(status_code=409, detail="This asset already has a transfer pending")
    data.update(from_project_id=a.project_id, from_location=a.location, status="pending", completed_on=None)


async def transfer_complete(ctx: Ctx, t: O.ReAssetTransfer) -> O.ReAssetTransfer:
    if t.status != "pending":
        raise HTTPException(status_code=409, detail=f"Transfer is {t.status}")
    a = await get_owned(ctx.db, O.ReAsset, ctx.vendor_id, t.asset_id, "asset")
    _live(a)
    if t.to_project_id:
        a.project_id = t.to_project_id
    if t.to_location:
        a.location = t.to_location
    t.status, t.completed_on = "completed", date.today()
    await audit(ctx, "asset", a.id, "transfer", ref=a.asset_code, changes={"to_project": t.to_project_id, "to_location": t.to_location})
    return t


async def transfer_cancel(ctx: Ctx, t: O.ReAssetTransfer) -> O.ReAssetTransfer:
    if t.status != "pending":
        raise HTTPException(status_code=409, detail=f"Transfer is {t.status}")
    t.status = "cancelled"
    await audit(ctx, "asset_transfer", t.id, "cancel")
    return t


# ── disposal ─────────────────────────────────────────────────────────────────────────────

async def disposal_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    a = await get_owned(ctx.db, O.ReAsset, ctx.vendor_id, data["asset_id"], "asset")
    _live(a)
    on = data.get("disposal_date") or date.today()
    if on > date.today():
        raise HTTPException(status_code=422, detail="The disposal date cannot be in the future")
    if a.purchase_date and on < a.purchase_date:
        raise HTTPException(status_code=422, detail="Disposal cannot be before the purchase date")
    proceeds = D(data.get("proceeds"))
    if proceeds < 0:
        raise HTTPException(status_code=422, detail="Proceeds cannot be negative")
    if data.get("method") in ("donation", "write_off") and proceeds > 0:
        raise HTTPException(status_code=422, detail="A donation or write-off carries no sale proceeds")
    pending = (await ctx.db.execute(select(func.count()).select_from(O.ReAssetTransfer).where(
        O.ReAssetTransfer.asset_id == a.id, O.ReAssetTransfer.status == "pending"))).scalar_one()
    if pending:
        raise HTTPException(status_code=409, detail="Complete or cancel the pending transfer first")
    bv = book_value(a, on)
    data.update(disposal_date=on, book_value=bv, gain_loss=money_q(proceeds - bv))


async def disposal_after_create(ctx: Ctx, d: O.ReAssetDisposal) -> None:
    a = await ctx.db.get(O.ReAsset, d.asset_id)
    a.status, a.disposed_on = "disposed", d.disposal_date
    for s in (await ctx.db.execute(select(O.RePmSchedule).where(O.RePmSchedule.asset_id == a.id, O.RePmSchedule.is_active.is_(True)))).scalars().all():
        s.is_active = False  # nothing left to maintain
    await audit(ctx, "asset", a.id, "dispose", ref=a.asset_code, changes={"method": d.method, "book_value": d.book_value, "gain_loss": d.gain_loss})


# ── register ─────────────────────────────────────────────────────────────────────────────

async def register(db: AsyncSession, vendor_id: UUID) -> dict:
    today = date.today()
    assets = (await db.execute(select(O.ReAsset).where(O.ReAsset.vendor_id == vendor_id).order_by(O.ReAsset.asset_code))).scalars().all()
    projects = {p.id: p.name for p in (await db.execute(select(C.ReProject).where(C.ReProject.vendor_id == vendor_id))).scalars().all()}
    live = [a for a in assets if a.status != "disposed"]
    by_cat: dict[str, dict] = {}
    rows = []
    for a in live:
        bv = book_value(a)
        c = by_cat.setdefault(a.category, {"category": a.category, "count": 0, "cost": Decimal(0), "book_value": Decimal(0)})
        c["count"] += 1
        c["cost"] += D(a.purchase_cost)
        c["book_value"] += bv
        flags = []
        if a.next_maintenance_on and a.next_maintenance_on < today:
            flags.append("service overdue")
        if a.amc_until and a.amc_until < today:
            flags.append("AMC expired")
        elif a.amc_until and (a.amc_until - today).days <= 30:
            flags.append("AMC ending")
        if a.warranty_until and 0 <= (a.warranty_until - today).days <= 30:
            flags.append("warranty ending")
        rows.append({"id": str(a.id), "asset_code": a.asset_code, "name": a.name, "category": a.category,
                     "project": projects.get(a.project_id, ""), "location": a.location, "status": a.status,
                     "purchase_cost": _f(a.purchase_cost), "book_value": _f(bv), "next_maintenance_on": a.next_maintenance_on.isoformat() if a.next_maintenance_on else None,
                     "flags": ", ".join(flags)})
    spend = (await db.execute(select(func.coalesce(func.sum(O.ReAssetMaintenance.cost), 0)).where(
        O.ReAssetMaintenance.vendor_id == vendor_id, O.ReAssetMaintenance.performed_on >= date(today.year, 1, 1)))).scalar_one()
    return {
        "assets": len(live), "disposed": len(assets) - len(live), "under_maintenance": len([a for a in live if a.status == "under_maintenance"]),
        "total_cost": _f(sum(D(a.purchase_cost) for a in live)), "total_book_value": _f(sum(book_value(a) for a in live)),
        "maintenance_spend_ytd": _f(spend),
        "by_category": [{**c, "cost": _f(c["cost"]), "book_value": _f(c["book_value"])} for c in sorted(by_cat.values(), key=lambda x: -x["cost"])],
        "attention": [r for r in rows if r["flags"]], "rows": rows,
    }
