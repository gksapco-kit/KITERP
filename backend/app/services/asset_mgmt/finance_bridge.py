"""The single place where Asset Management touches Finance.

* An ``AmAsset`` may be linked to exactly one ``FinAsset`` (``am_asset.fin_asset_id``).
* Cost capitalisation, depreciation, disposal gain / loss and journal entries remain Finance's job; this module
  only *calls* the existing finance repository / posting services, it never re-implements accounting.
* Every function is tenant-scoped and tolerant of Finance not being fully set up (GL posting failures are
  queued by ``safe_post`` into Finance > Posting failures instead of blocking the physical workflow).
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset_mgmt import AmAsset, AmCategory, AmLocation, AmMaintenancePlan, AmReservation
from app.models.finance import FinAsset, FinAssetCategory, FinAssetDepreciationEntry, FinAssetMaintenance
from app.repositories.finance.finance_repo import FinAssetRepo
from app.services.asset_mgmt.common import (
    actor_id, as_date, as_decimal, as_uuid, assert_owned, check_choice, clean_str, get_owned, jsonable, record_event,
)

log = logging.getLogger(__name__)

_FIN_STATUS_TO_AM = {"active": "in_stock", "disposed": "disposed", "under_maintenance": "under_maintenance"}


# ── Read side ────────────────────────────────────────────────────────────────────────────────────
async def fin_block(db: AsyncSession, vendor_id: UUID, asset: AmAsset) -> Optional[dict]:
    """Financial view of a linked asset (cost, accumulated depreciation, NBV, recent depreciation)."""
    if not asset.fin_asset_id:
        return None
    fa = (await db.execute(select(FinAsset).where(
        FinAsset.id == asset.fin_asset_id, FinAsset.vendor_id == vendor_id))).scalar_one_or_none()
    if fa is None:
        return None
    dep = (await db.execute(
        select(FinAssetDepreciationEntry).where(FinAssetDepreciationEntry.asset_id == fa.id)
        .order_by(FinAssetDepreciationEntry.depreciation_date.desc()).limit(12)
    )).scalars().all()
    cat = await db.get(FinAssetCategory, fa.category_id) if fa.category_id else None
    return jsonable({
        "fin_asset_id": fa.id, "asset_code": fa.asset_code, "status": fa.status,
        "category_name": cat.name if cat else None,
        "purchase_cost": fa.purchase_cost, "salvage_value": fa.salvage_value,
        "accumulated_depreciation": fa.accumulated_depreciation,
        "net_book_value": fa.current_value if fa.current_value is not None else fa.purchase_cost,
        "depreciation_method": fa.depreciation_method or (cat.depreciation_method if cat else None),
        "useful_life_years": fa.useful_life_years or (cat.useful_life_years if cat else None),
        "disposal_date": fa.disposal_date, "disposal_value": fa.disposal_value,
        "depreciation_entries": [
            {"date": e.depreciation_date, "amount": e.amount, "book_value_after": e.book_value_after,
             "journal_entry_id": e.journal_entry_id} for e in dep
        ],
    })


async def finance_summary(db: AsyncSession, vendor_id: UUID) -> dict:
    """Module-level reconciliation numbers shown on the Asset dashboard."""
    total = (await db.execute(select(func.count(AmAsset.id)).where(
        AmAsset.vendor_id == vendor_id, AmAsset.status.notin_(("disposed", "retired"))))).scalar_one()
    linked = (await db.execute(select(func.count(AmAsset.id)).where(
        AmAsset.vendor_id == vendor_id, AmAsset.fin_asset_id.isnot(None),
        AmAsset.status.notin_(("disposed", "retired"))))).scalar_one()
    nbv = (await db.execute(
        select(func.coalesce(func.sum(FinAsset.current_value), 0), func.coalesce(func.sum(FinAsset.purchase_cost), 0),
               func.coalesce(func.sum(FinAsset.accumulated_depreciation), 0))
        .join(AmAsset, AmAsset.fin_asset_id == FinAsset.id)
        .where(AmAsset.vendor_id == vendor_id, FinAsset.status == "active")
    )).one()
    unlinked_fin = (await db.execute(
        select(func.count(FinAsset.id)).where(
            FinAsset.vendor_id == vendor_id, FinAsset.status == "active",
            ~FinAsset.id.in_(select(AmAsset.fin_asset_id).where(AmAsset.fin_asset_id.isnot(None))))
    )).scalar_one()
    return {"active_assets": int(total), "capitalized": int(linked), "not_capitalized": int(total) - int(linked),
            "net_book_value": float(nbv[0] or 0), "total_cost": float(nbv[1] or 0),
            "accumulated_depreciation": float(nbv[2] or 0), "finance_assets_not_in_module": int(unlinked_fin)}


# ── Capitalise / link ────────────────────────────────────────────────────────────────────────────
async def capitalize(db: AsyncSession, vendor_id: UUID, asset: AmAsset, data: dict, vu: Any) -> dict:
    """Create the fixed-asset register entry (and acquisition journal) for a physical asset."""
    if asset.fin_asset_id:
        raise HTTPException(409, "This asset is already capitalised in Finance")
    if asset.status == "disposed":
        raise HTTPException(409, "A disposed asset cannot be capitalised")

    am_cat = await db.get(AmCategory, asset.category_id) if asset.category_id else None
    fin_cat_id = await assert_owned(
        db, FinAssetCategory, data.get("fin_category_id") or (am_cat.fin_category_id if am_cat else None),
        vendor_id, "Finance asset category")
    if not fin_cat_id:
        raise HTTPException(400, "Choose a Finance asset category (it decides the GL accounts and depreciation)")
    fin_cat = await db.get(FinAssetCategory, fin_cat_id)

    cost = as_decimal(data.get("cost"), "cost") or Decimal(str(asset.acquisition_cost or 0))
    if cost <= 0:
        raise HTTPException(400, "Enter the acquisition cost to capitalise this asset")
    method = check_choice(clean_str(data.get("depreciation_method")) or (am_cat.default_depreciation_method if am_cat else None),
                          ("straight_line", "wdv", "units_of_production"), "depreciation_method")
    life = data.get("useful_life_years") or (am_cat.default_useful_life_years if am_cat else None) or fin_cat.useful_life_years
    salvage = as_decimal(data.get("salvage_value"), "salvage_value")
    if salvage is None:
        salvage = Decimal(str(asset.salvage_value or 0))
    if salvage > cost:
        raise HTTPException(400, "Salvage value cannot exceed the cost")
    acq_date = as_date(data.get("acquisition_date"), "acquisition_date") or asset.acquisition_date or date.today()

    loc_name = None
    if asset.location_id:
        loc_name = (await db.execute(select(AmLocation.name).where(AmLocation.id == asset.location_id))).scalar_one_or_none()
    payload = {
        "category_id": fin_cat_id, "asset_code": asset.asset_tag[:30], "name": asset.name, "description": asset.description,
        "acquisition_date": acq_date,
        "capitalization_date": as_date(data.get("capitalization_date"), "capitalization_date") or acq_date,
        "depreciation_start_date": as_date(data.get("depreciation_start_date"), "depreciation_start_date") or acq_date,
        "purchase_cost": float(cost), "salvage_value": float(salvage),
        "useful_life_years": int(life) if life else None, "depreciation_method": method,
        "location": loc_name, "store_id": asset.store_id, "serial_number": asset.serial_number,
        "notes": f"Created from Asset Management ({asset.asset_tag})",
    }
    repo = FinAssetRepo(db)
    gl: dict[str, Any] = {"posted": False}
    bill_line_id = data.get("bill_line_id")
    try:
        if bill_line_id:
            # The vendor bill already booked the cost: register only, never post a second journal.
            fa = await repo.create_asset_from_bill_line(vendor_id, {**payload, "bill_line_id": bill_line_id})
            gl = {"posted": False, "reason": "Cost was already posted by the vendor bill"}
        else:
            fa = await repo.create_asset(vendor_id, payload)
            if data.get("post_gl", True):
                from app.services.finance.safe_posting import safe_post
                accounts = await repo.get_category_accounts(fa)
                je = await safe_post(db, vendor_id, "asset", fa.id, {
                    "cost": cost, "narration": f"Asset Acquisition: {asset.name} ({asset.asset_tag})",
                    "store_id": fa.store_id, **accounts}, created_by_id=actor_id(vu))
                gl = {"posted": je is not None, "journal_entry_id": str(je.id) if je else None}
                if je is None:
                    gl["warning"] = "Asset registered but the GL entry is pending. See Finance > Posting failures."
            else:
                gl = {"posted": False, "reason": "GL posting skipped"}
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    asset.fin_asset_id = fa.id
    asset.acquisition_cost, asset.salvage_value, asset.acquisition_date = cost, salvage, acq_date
    await db.flush()
    await record_event(db, vendor_id, asset.id, "capitalized", f"Capitalised in Finance ({fa.asset_code})",
                       {"fin_asset_id": str(fa.id), "cost": cost, "gl": gl}, actor_id(vu))
    return {"fin_asset_id": str(fa.id), "gl": gl}


async def link_existing(db: AsyncSession, vendor_id: UUID, asset: AmAsset, fin_asset_id: Any, vu: Any) -> dict:
    if asset.fin_asset_id:
        raise HTTPException(409, "This asset is already linked to a Finance asset")
    fa = await get_owned(db, FinAsset, fin_asset_id, vendor_id, "Finance asset")
    taken = (await db.execute(select(AmAsset.asset_tag).where(AmAsset.fin_asset_id == fa.id))).scalar_one_or_none()
    if taken:
        raise HTTPException(409, f"That Finance asset is already linked to {taken}")
    asset.fin_asset_id = fa.id
    if not asset.acquisition_cost:
        asset.acquisition_cost = fa.purchase_cost
    if not asset.acquisition_date:
        asset.acquisition_date = fa.acquisition_date
    if asset.salvage_value in (None, 0):
        asset.salvage_value = fa.salvage_value or 0
    await db.flush()
    await record_event(db, vendor_id, asset.id, "fin_linked", f"Linked to Finance asset {fa.asset_code}",
                       {"fin_asset_id": str(fa.id)}, actor_id(vu))
    return {"fin_asset_id": str(fa.id)}


async def unlink(db: AsyncSession, vendor_id: UUID, asset: AmAsset, vu: Any) -> None:
    if not asset.fin_asset_id:
        raise HTTPException(409, "This asset is not linked to Finance")
    fa = await db.get(FinAsset, asset.fin_asset_id)
    if fa is not None and fa.vendor_id == vendor_id and fa.status == "active":
        dep = (await db.execute(select(func.count(FinAssetDepreciationEntry.id)).where(
            FinAssetDepreciationEntry.asset_id == fa.id))).scalar_one()
        if dep:
            raise HTTPException(409, "This asset already has depreciation posted. Dispose it instead of unlinking.")
    old = asset.fin_asset_id
    asset.fin_asset_id = None
    await db.flush()
    await record_event(db, vendor_id, asset.id, "fin_unlinked", "Unlinked from Finance", {"fin_asset_id": str(old)}, actor_id(vu))


# ── Disposal ─────────────────────────────────────────────────────────────────────────────────────
async def dispose(db: AsyncSession, vendor_id: UUID, asset: AmAsset, data: dict, vu: Any) -> dict:
    """Retire an asset for good. When linked to Finance, also runs the finance disposal (gain / loss journal)."""
    if asset.status == "disposed":
        raise HTTPException(409, "Asset is already disposed")
    if asset.status == "in_transit":
        raise HTTPException(409, "Receive the transfer before disposing of this asset")
    from app.services.asset_mgmt.assets import has_open_assignment
    if await has_open_assignment(db, asset.id):
        raise HTTPException(409, "Check the asset in before disposing of it")
    method = check_choice(clean_str(data.get("disposal_method")) or "scrapped", ("sold", "scrapped", "donated", "written_off"),
                          "disposal_method")
    sale_price = as_decimal(data.get("sale_price"), "sale_price") or Decimal(0)
    when = as_date(data.get("disposal_date"), "disposal_date") or date.today()

    gl: dict[str, Any] = {"posted": False}
    if asset.fin_asset_id:
        repo = FinAssetRepo(db)
        fa = await repo.get_asset(asset.fin_asset_id, vendor_id)
        if fa is not None and fa.status == "active":
            from app.services.finance.posting import post_event
            accounts = await repo.get_category_accounts(fa)
            try:
                je = await post_event(db, vendor_id, "disposal", fa.id, {
                    "purchase_cost": Decimal(str(fa.purchase_cost or 0)),
                    "accum_dep": Decimal(str(fa.accumulated_depreciation or 0)),
                    "sale_price": sale_price,
                    "narration": f"Asset Disposal ({method}): {asset.name} ({asset.asset_tag})", **accounts,
                }, created_by_id=actor_id(vu))
            except HTTPException:
                raise
            except Exception as exc:
                log.warning("Asset disposal GL posting failed for %s: %s", asset.asset_tag, exc)
                raise HTTPException(400, f"Finance could not post the disposal: {exc}") from exc
            disposal = await repo.dispose_asset(vendor_id, fa, {
                "disposal_method": method if method in ("sold", "scrapped", "donated") else "scrapped",
                "sale_price": sale_price, "disposal_date": when, "notes": clean_str(data.get("notes")),
            }, je_id=je.id if je else None)
            gl = {"posted": je is not None, "journal_entry_id": str(je.id) if je else None,
                  "gain_loss": float(disposal.gain_loss or 0)}
            if je is None:
                gl["warning"] = "Disposal recorded but no GL entry was created (GL accounts not configured)."

    asset.status, asset.disposed_on = "disposed", when
    asset.disposal_reason = clean_str(data.get("notes")) or method
    asset.holder_type = asset.current_employee_id = asset.current_department_id = None
    now = datetime.now(timezone.utc)
    for r in (await db.execute(select(AmReservation).where(
            AmReservation.asset_id == asset.id, AmReservation.status == "booked", AmReservation.end_at >= now))).scalars().all():
        r.status = "cancelled"
    for p in (await db.execute(select(AmMaintenancePlan).where(AmMaintenancePlan.asset_id == asset.id))).scalars().all():
        p.is_active = False
    await db.flush()
    await record_event(db, vendor_id, asset.id, "disposed", f"Disposed ({method})",
                       {"sale_price": sale_price, "gl": gl}, actor_id(vu))
    return {"status": "disposed", "gl": gl}


# ── Maintenance cost ─────────────────────────────────────────────────────────────────────────────
async def post_maintenance_cost(db: AsyncSession, vendor_id: UUID, asset: AmAsset, wo: Any, vu: Any) -> dict:
    """Book a completed work order's cost: expense it, or (``wo.capitalize``) add it to the asset's book value."""
    from app.services.finance.safe_posting import safe_post
    cost = Decimal(str(wo.cost_total or 0))
    if cost <= 0:
        return {"posted": False}
    repo = FinAssetRepo(db)
    fa = await repo.get_asset(asset.fin_asset_id, vendor_id) if asset.fin_asset_id else None
    narration = f"Asset Maintenance: {asset.name} ({wo.wo_no})"
    source_id = wo.id
    fin_m = None
    if fa is not None:
        fin_m = await repo.create_maintenance(vendor_id, {
            "asset_id": fa.id, "maintenance_date": date.today(), "description": f"{wo.wo_no} {wo.title}",
            "cost": float(cost), "vendor_name": wo.service_provider, "status": "completed"})
        source_id = fin_m.id
    if wo.capitalize and fa is not None:
        accounts = await repo.get_category_accounts(fa)
        je = await safe_post(db, vendor_id, "asset", source_id, {
            "cost": cost, "narration": f"Capitalized {narration}", **accounts}, created_by_id=actor_id(vu))
        if je:   # grow the register only when the ledger actually took the cost
            fa.purchase_cost = Decimal(str(fa.purchase_cost or 0)) + cost
            fa.current_value = Decimal(str(fa.current_value or 0)) + cost
            asset.acquisition_cost = Decimal(str(asset.acquisition_cost or 0)) + cost
    else:
        je = await safe_post(db, vendor_id, "expense", source_id, {"amount": cost, "narration": narration},
                             created_by_id=actor_id(vu))
    if je:
        wo.journal_entry_id = je.id
        if fin_m is not None:
            fin_m.journal_entry_id = je.id
    out: dict[str, Any] = {"posted": je is not None, "journal_entry_id": str(je.id) if je else None,
                           "capitalized": bool(wo.capitalize and fa is not None and je)}
    if je is None:
        out["warning"] = "Cost saved but the GL entry is pending. See Finance > Posting failures."
    return out


# ── Import existing Finance assets ───────────────────────────────────────────────────────────────
async def import_from_finance(db: AsyncSession, vendor_id: UUID, vu: Any) -> dict:
    """Create an AmAsset for every Finance fixed asset that has none. Idempotent and tenant-scoped."""
    from app.services.asset_mgmt import assets as assets_svc

    linked_ids = set((await db.execute(select(AmAsset.fin_asset_id).where(
        AmAsset.vendor_id == vendor_id, AmAsset.fin_asset_id.isnot(None)))).scalars().all())
    fin_assets = [fa for fa in (await db.execute(
        select(FinAsset).where(FinAsset.vendor_id == vendor_id).order_by(FinAsset.asset_code))).scalars().all()
        if fa.id not in linked_ids]

    cats = {c.name.lower(): c for c in (await db.execute(select(AmCategory).where(AmCategory.vendor_id == vendor_id))).scalars().all()}
    fin_cats = {c.id: c for c in (await db.execute(select(FinAssetCategory).where(FinAssetCategory.vendor_id == vendor_id))).scalars().all()}
    locs = {l.name.lower(): l for l in (await db.execute(select(AmLocation).where(AmLocation.vendor_id == vendor_id))).scalars().all()}

    created, skipped = 0, []
    for fa in fin_assets:
        try:
            async with db.begin_nested():
                am_cat = None
                fc = fin_cats.get(fa.category_id)
                if fc is not None:
                    am_cat = cats.get(fc.name.lower())
                    if am_cat is None:
                        am_cat = AmCategory(vendor_id=vendor_id, name=fc.name, fin_category_id=fc.id,
                                            default_useful_life_years=fc.useful_life_years,
                                            default_depreciation_method=fc.depreciation_method)
                        db.add(am_cat)
                        await db.flush()
                        cats[fc.name.lower()] = am_cat
                    elif am_cat.fin_category_id is None:
                        am_cat.fin_category_id = fc.id
                loc = None
                loc_name = clean_str(fa.location, 150)
                if loc_name:
                    loc = locs.get(loc_name.lower())
                    if loc is None:
                        loc = AmLocation(vendor_id=vendor_id, name=loc_name, store_id=fa.store_id)
                        db.add(loc)
                        await db.flush()
                        locs[loc_name.lower()] = loc
                code = (fa.asset_code or "").strip()
                tag_taken = bool(code) and (await db.execute(select(AmAsset.id).where(
                    AmAsset.vendor_id == vendor_id, func.lower(AmAsset.asset_tag) == code.lower()))).first()
                a = AmAsset(
                    vendor_id=vendor_id, name=fa.name, description=fa.description,
                    asset_tag=code if code and not tag_taken else await assets_svc._new_tag(db, vendor_id, am_cat),
                    category_id=am_cat.id if am_cat else None, status=_FIN_STATUS_TO_AM.get(fa.status, "in_stock"),
                    condition="good", serial_number=clean_str(fa.serial_number, 120), acquisition_date=fa.acquisition_date,
                    acquisition_cost=fa.purchase_cost or 0, salvage_value=fa.salvage_value or 0,
                    store_id=fa.store_id, location_id=loc.id if loc else None, fin_asset_id=fa.id,
                    vendor_bill_id=fa.vendor_bill_id, disposed_on=fa.disposal_date, notes=fa.notes,
                    created_by=actor_id(vu),
                )
                db.add(a)
                await db.flush()
                await record_event(db, vendor_id, a.id, "imported", f"Imported from Finance asset {fa.asset_code}",
                                   {"fin_asset_id": str(fa.id)}, actor_id(vu))
                created += 1
        except Exception as exc:   # one bad row must not abort the whole import
            log.warning("Finance asset import skipped %s: %s", fa.asset_code, exc)
            # the savepoint rolled back: rebuild the lookup caches so they never point at vanished rows
            cats = {c.name.lower(): c for c in (await db.execute(
                select(AmCategory).where(AmCategory.vendor_id == vendor_id))).scalars().all()}
            locs = {l.name.lower(): l for l in (await db.execute(
                select(AmLocation).where(AmLocation.vendor_id == vendor_id))).scalars().all()}
            skipped.append({"asset_code": fa.asset_code, "error": str(exc)[:200]})
    return {"created": created, "skipped": skipped, "total_candidates": len(fin_assets)}
