"""Asset register: categories, locations, assets, lookup, timeline, import / export."""
from __future__ import annotations

import csv
import io
from typing import Any, Iterable, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset_mgmt import (
    ASSET_CONDITIONS, ASSET_STATUSES, LOCATION_TYPES, AmAssignment, AmAsset, AmCategory, AmEvent, AmLocation,
)
from app.models.hr import Department, EmployeeProfile
from app.models.store import Store
from app.services.asset_mgmt.common import (
    actor_id, as_date, as_decimal, as_uuid, assert_owned, check_choice, clean_str, get_asset, get_owned,
    jsonable, next_number, pick, record_event, to_dict,
)

QR_PREFIX = "KITAM:"
_CATEGORY_FIELDS = (
    "name", "code", "parent_id", "description", "is_it_asset", "is_capitalizable", "requires_serial",
    "fin_category_id", "default_useful_life_years", "default_depreciation_method", "is_active",
)
_LOCATION_FIELDS = ("name", "code", "parent_id", "location_type", "store_id", "address", "is_active")
_ASSET_FIELDS = (
    "name", "description", "category_id", "parent_asset_id", "condition", "serial_number", "barcode",
    "manufacturer", "model", "image_url", "attributes", "acquisition_date", "acquisition_cost", "salvage_value",
    "supplier_name", "purchase_ref", "vendor_bill_id", "store_id", "location_id", "is_reservable",
    "meter_reading", "meter_unit", "notes",
)
# Statuses an operator may set by hand. The rest are driven by workflows (check-out, transfer, disposal).
_MANUAL_STATUSES = ("in_stock", "under_maintenance", "lost", "retired")


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Categories
# ═════════════════════════════════════════════════════════════════════════════════════════════════
async def _category_payload(db: AsyncSession, vendor_id: UUID, data: dict, *, partial: bool) -> dict:
    p = pick(data, _CATEGORY_FIELDS)
    if "name" in p:
        p["name"] = clean_str(p["name"], 120)
        if not p["name"]:
            raise HTTPException(400, "Category name is required")
    elif not partial:
        raise HTTPException(400, "Category name is required")
    if "code" in p:
        p["code"] = (clean_str(p["code"], 10) or "").upper() or None
    if "parent_id" in p:
        p["parent_id"] = await assert_owned(db, AmCategory, p["parent_id"], vendor_id, "Parent category")
    if "fin_category_id" in p:
        from app.models.finance import FinAssetCategory
        p["fin_category_id"] = await assert_owned(db, FinAssetCategory, p["fin_category_id"], vendor_id, "Finance category")
    if "default_useful_life_years" in p:
        v = p["default_useful_life_years"]
        p["default_useful_life_years"] = int(v) if v not in (None, "") else None
    for k in ("description", "default_depreciation_method"):
        if k in p:
            p[k] = clean_str(p[k])
    for k in ("is_it_asset", "is_capitalizable", "requires_serial", "is_active"):
        if k in p:
            p[k] = bool(p[k])
    return p


async def create_category(db: AsyncSession, vendor_id: UUID, data: dict) -> AmCategory:
    p = await _category_payload(db, vendor_id, data, partial=False)
    dup = (await db.execute(select(AmCategory.id).where(AmCategory.vendor_id == vendor_id, AmCategory.name == p["name"]))).first()
    if dup:
        raise HTTPException(409, "A category with this name already exists")
    cat = AmCategory(vendor_id=vendor_id, **p)
    db.add(cat)
    await db.flush()
    return cat


async def update_category(db: AsyncSession, vendor_id: UUID, category_id: Any, data: dict) -> AmCategory:
    cat = await get_owned(db, AmCategory, category_id, vendor_id, "Category")
    p = await _category_payload(db, vendor_id, data, partial=True)
    if p.get("parent_id") == cat.id:
        raise HTTPException(400, "A category cannot be its own parent")
    if "name" in p and p["name"] != cat.name:
        dup = (await db.execute(select(AmCategory.id).where(
            AmCategory.vendor_id == vendor_id, AmCategory.name == p["name"], AmCategory.id != cat.id))).first()
        if dup:
            raise HTTPException(409, "A category with this name already exists")
    for k, v in p.items():
        setattr(cat, k, v)
    await db.flush()
    return cat


async def list_categories(db: AsyncSession, vendor_id: UUID, include_inactive: bool = True) -> list[dict]:
    q = select(AmCategory).where(AmCategory.vendor_id == vendor_id).order_by(AmCategory.name)
    if not include_inactive:
        q = q.where(AmCategory.is_active.is_(True))
    cats = (await db.execute(q)).scalars().all()
    counts = dict((await db.execute(
        select(AmAsset.category_id, func.count(AmAsset.id))
        .where(AmAsset.vendor_id == vendor_id).group_by(AmAsset.category_id)
    )).all())
    return [{**to_dict(c), "asset_count": int(counts.get(c.id, 0))} for c in cats]


async def delete_category(db: AsyncSession, vendor_id: UUID, category_id: Any) -> None:
    cat = await get_owned(db, AmCategory, category_id, vendor_id, "Category")
    used = (await db.execute(select(func.count(AmAsset.id)).where(
        AmAsset.vendor_id == vendor_id, AmAsset.category_id == cat.id))).scalar_one()
    if used:
        raise HTTPException(409, f"{used} asset(s) use this category. Deactivate it instead.")
    await db.delete(cat)
    await db.flush()


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Locations
# ═════════════════════════════════════════════════════════════════════════════════════════════════
async def _location_payload(db: AsyncSession, vendor_id: UUID, data: dict, *, partial: bool) -> dict:
    p = pick(data, _LOCATION_FIELDS)
    if "name" in p:
        p["name"] = clean_str(p["name"], 150)
        if not p["name"]:
            raise HTTPException(400, "Location name is required")
    elif not partial:
        raise HTTPException(400, "Location name is required")
    if "location_type" in p:
        check_choice(p["location_type"], LOCATION_TYPES, "location_type")
    if "parent_id" in p:
        p["parent_id"] = await assert_owned(db, AmLocation, p["parent_id"], vendor_id, "Parent location")
    if "store_id" in p:
        p["store_id"] = await assert_owned(db, Store, p["store_id"], vendor_id, "Store")
    for k in ("code", "address"):
        if k in p:
            p[k] = clean_str(p[k], 30 if k == "code" else None)
    if "is_active" in p:
        p["is_active"] = bool(p["is_active"])
    return p


async def create_location(db: AsyncSession, vendor_id: UUID, data: dict) -> AmLocation:
    p = await _location_payload(db, vendor_id, data, partial=False)
    loc = AmLocation(vendor_id=vendor_id, **p)
    db.add(loc)
    await db.flush()
    return loc


async def update_location(db: AsyncSession, vendor_id: UUID, location_id: Any, data: dict) -> AmLocation:
    loc = await get_owned(db, AmLocation, location_id, vendor_id, "Location")
    p = await _location_payload(db, vendor_id, data, partial=True)
    if "parent_id" in p and p["parent_id"]:
        # no cycles: walk up from the proposed parent
        cur, seen = p["parent_id"], set()
        while cur and cur not in seen:
            if cur == loc.id:
                raise HTTPException(400, "A location cannot be moved under itself")
            seen.add(cur)
            cur = (await db.execute(select(AmLocation.parent_id).where(AmLocation.id == cur))).scalar_one_or_none()
    for k, v in p.items():
        setattr(loc, k, v)
    await db.flush()
    return loc


async def list_locations(db: AsyncSession, vendor_id: UUID) -> list[dict]:
    locs = (await db.execute(
        select(AmLocation).where(AmLocation.vendor_id == vendor_id).order_by(AmLocation.name)
    )).scalars().all()
    counts = dict((await db.execute(
        select(AmAsset.location_id, func.count(AmAsset.id))
        .where(AmAsset.vendor_id == vendor_id, AmAsset.status.notin_(("disposed", "retired")))
        .group_by(AmAsset.location_id)
    )).all())
    by_id = {l.id: l for l in locs}

    def path(l: AmLocation) -> str:
        parts, cur, seen = [l.name], l.parent_id, {l.id}
        while cur and cur in by_id and cur not in seen:
            seen.add(cur)
            parts.append(by_id[cur].name)
            cur = by_id[cur].parent_id
        return " / ".join(reversed(parts))

    return [{**to_dict(l), "path": path(l), "asset_count": int(counts.get(l.id, 0))} for l in locs]


async def delete_location(db: AsyncSession, vendor_id: UUID, location_id: Any) -> None:
    loc = await get_owned(db, AmLocation, location_id, vendor_id, "Location")
    used = (await db.execute(select(func.count(AmAsset.id)).where(
        AmAsset.vendor_id == vendor_id, AmAsset.location_id == loc.id))).scalar_one()
    if used:
        raise HTTPException(409, f"{used} asset(s) are at this location. Move them or deactivate the location.")
    await db.delete(loc)
    await db.flush()


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Display labels
# ═════════════════════════════════════════════════════════════════════════════════════════════════
async def _names(db: AsyncSession, model, ids: Iterable[Optional[UUID]], cols: tuple) -> dict:
    wanted = {i for i in ids if i}
    if not wanted:
        return {}
    rows = (await db.execute(select(model.id, *cols).where(model.id.in_(wanted)))).all()
    return {r[0]: r[1:] for r in rows}


async def label_maps(db: AsyncSession, assets: list[AmAsset]) -> dict[str, dict]:
    cats = await _names(db, AmCategory, (a.category_id for a in assets), (AmCategory.name, AmCategory.is_it_asset))
    locs = await _names(db, AmLocation, (a.location_id for a in assets), (AmLocation.name,))
    emps = await _names(db, EmployeeProfile, (a.current_employee_id for a in assets),
                        (EmployeeProfile.full_name, EmployeeProfile.employee_code))
    deps = await _names(db, Department, (a.current_department_id for a in assets), (Department.name,))
    stores = await _names(db, Store, (a.store_id for a in assets), (Store.name,))
    return {"cat": cats, "loc": locs, "emp": emps, "dep": deps, "store": stores}


def asset_out(a: AmAsset, maps: dict[str, dict]) -> dict:
    out = to_dict(a)
    cat = maps["cat"].get(a.category_id)
    out["category_name"] = cat[0] if cat else None
    out["is_it_asset"] = bool(cat[1]) if cat else False
    loc = maps["loc"].get(a.location_id)
    out["location_name"] = loc[0] if loc else None
    emp = maps["emp"].get(a.current_employee_id)
    out["employee_name"] = (emp[0] or emp[1]) if emp else None
    out["employee_code"] = emp[1] if emp else None
    dep = maps["dep"].get(a.current_department_id)
    out["department_name"] = dep[0] if dep else None
    store = maps["store"].get(a.store_id)
    out["store_name"] = store[0] if store else None
    out["is_capitalized"] = a.fin_asset_id is not None
    return out


async def assets_out(db: AsyncSession, assets: list[AmAsset]) -> list[dict]:
    maps = await label_maps(db, assets)
    return [asset_out(a, maps) for a in assets]


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Assets
# ═════════════════════════════════════════════════════════════════════════════════════════════════
async def _asset_payload(db: AsyncSession, vendor_id: UUID, data: dict, *, partial: bool) -> dict:
    p = pick(data, _ASSET_FIELDS)
    if "name" in p:
        p["name"] = clean_str(p["name"], 200)
        if not p["name"]:
            raise HTTPException(400, "Asset name is required")
    elif not partial:
        raise HTTPException(400, "Asset name is required")
    if "condition" in p:
        check_choice(p["condition"], ASSET_CONDITIONS, "condition")
    if "category_id" in p:
        p["category_id"] = await assert_owned(db, AmCategory, p["category_id"], vendor_id, "Category")
    if "location_id" in p:
        p["location_id"] = await assert_owned(db, AmLocation, p["location_id"], vendor_id, "Location")
    if "store_id" in p:
        p["store_id"] = await assert_owned(db, Store, p["store_id"], vendor_id, "Store")
    if "parent_asset_id" in p:
        p["parent_asset_id"] = await assert_owned(db, AmAsset, p["parent_asset_id"], vendor_id, "Parent asset")
    if "vendor_bill_id" in p:
        from app.models.finance import FinVendorBill
        p["vendor_bill_id"] = await assert_owned(db, FinVendorBill, p["vendor_bill_id"], vendor_id, "Vendor bill")
    if "acquisition_date" in p:
        p["acquisition_date"] = as_date(p["acquisition_date"], "acquisition_date")
    for k in ("acquisition_cost", "salvage_value"):
        if k in p:
            p[k] = as_decimal(p[k], k) or 0
    if "meter_reading" in p:
        p["meter_reading"] = as_decimal(p["meter_reading"], "meter_reading")
    if "attributes" in p:
        if p["attributes"] is not None and not isinstance(p["attributes"], dict):
            raise HTTPException(400, "attributes must be an object")
        p["attributes"] = p["attributes"] or {}
    if "is_reservable" in p:
        p["is_reservable"] = bool(p["is_reservable"])
    for k, n in (("serial_number", 120), ("barcode", 120), ("manufacturer", 120), ("model", 120),
                 ("image_url", 500), ("supplier_name", 200), ("purchase_ref", 120), ("meter_unit", 20),
                 ("description", None), ("notes", None)):
        if k in p:
            p[k] = clean_str(p[k], n)
    return p


async def _assert_unique_codes(db: AsyncSession, vendor_id: UUID, p: dict, exclude_id: Optional[UUID] = None) -> None:
    for field, label in (("serial_number", "serial number"), ("barcode", "barcode")):
        val = p.get(field)
        if not val:
            continue
        q = select(AmAsset.asset_tag).where(
            AmAsset.vendor_id == vendor_id,
            func.lower(getattr(AmAsset, field)) == val.lower(),
            AmAsset.status.notin_(("disposed", "retired")),
        )
        if exclude_id:
            q = q.where(AmAsset.id != exclude_id)
        other = (await db.execute(q.limit(1))).scalar_one_or_none()
        if other:
            raise HTTPException(409, f"This {label} is already registered to asset {other}")


async def _new_tag(db: AsyncSession, vendor_id: UUID, category: Optional[AmCategory]) -> str:
    prefix = (category.code if category and category.code else "AST").upper()
    for _ in range(25):
        tag = await next_number(db, vendor_id, "asset", prefix)
        exists = (await db.execute(select(AmAsset.id).where(
            AmAsset.vendor_id == vendor_id, func.lower(AmAsset.asset_tag) == tag.lower()))).first()
        if not exists:
            return tag
    raise HTTPException(500, "Could not allocate an asset tag, please retry")


async def create_asset(db: AsyncSession, vendor_id: UUID, data: dict, vu: Any, *, asset_tag: Optional[str] = None,
                       event_type: str = "created", event_summary: Optional[str] = None) -> AmAsset:
    p = await _asset_payload(db, vendor_id, data, partial=False)
    category = await db.get(AmCategory, p["category_id"]) if p.get("category_id") else None
    if category and category.requires_serial and not p.get("serial_number"):
        raise HTTPException(400, f"Category '{category.name}' requires a serial number")
    await _assert_unique_codes(db, vendor_id, p)
    tag = clean_str(asset_tag, 40) or clean_str(data.get("asset_tag"), 40)
    if tag:
        dup = (await db.execute(select(AmAsset.id).where(
            AmAsset.vendor_id == vendor_id, func.lower(AmAsset.asset_tag) == tag.lower()))).first()
        if dup:
            raise HTTPException(409, f"Asset tag {tag} already exists")
    else:
        tag = await _new_tag(db, vendor_id, category)
    p.setdefault("condition", "good")
    asset = AmAsset(vendor_id=vendor_id, asset_tag=tag, status="in_stock", created_by=actor_id(vu), **p)
    db.add(asset)
    await db.flush()
    await record_event(db, vendor_id, asset.id, event_type, event_summary or f"Asset {tag} registered",
                       {"cost": p.get("acquisition_cost")}, actor_id(vu))
    return asset


async def create_assets_bulk(db: AsyncSession, vendor_id: UUID, data: dict, vu: Any) -> list[AmAsset]:
    """One call, N physical units: ``quantity`` and/or a ``serial_numbers`` list (one asset per serial)."""
    serials = [s for s in (clean_str(x, 120) for x in (data.get("serial_numbers") or [])) if s]
    if len(set(s.lower() for s in serials)) != len(serials):
        raise HTTPException(400, "Duplicate serial numbers in the list")
    qty = len(serials) if serials else int(data.get("quantity") or 1)
    if qty < 1 or qty > 500:
        raise HTTPException(400, "Quantity must be between 1 and 500")
    out: list[AmAsset] = []
    for i in range(qty):
        row = {k: v for k, v in data.items() if k not in ("serial_numbers", "quantity", "asset_tag")}
        if serials:
            row["serial_number"] = serials[i]
        elif qty > 1:
            row.pop("serial_number", None)   # a single serial cannot apply to several units
        out.append(await create_asset(db, vendor_id, row, vu, asset_tag=data.get("asset_tag") if qty == 1 else None))
    return out


async def update_asset(db: AsyncSession, vendor_id: UUID, asset_id: Any, data: dict, vu: Any) -> AmAsset:
    asset = await get_asset(db, vendor_id, asset_id, lock=True)
    p = await _asset_payload(db, vendor_id, data, partial=True)
    if p.get("parent_asset_id") == asset.id:
        raise HTTPException(400, "An asset cannot be its own parent")
    if asset.status in ("disposed",):
        raise HTTPException(409, "A disposed asset can no longer be edited")
    await _assert_unique_codes(db, vendor_id, p, exclude_id=asset.id)
    changes: dict[str, Any] = {}
    for k, v in p.items():
        if getattr(asset, k) != v:
            changes[k] = {"from": jsonable(getattr(asset, k)), "to": jsonable(v)}
            setattr(asset, k, v)
    if "status" in data and data["status"] != asset.status:
        await change_status(db, vendor_id, asset, data["status"], vu, reason=data.get("status_reason"))
    if changes:
        kind = "moved" if ("location_id" in changes or "store_id" in changes) else "updated"
        await record_event(db, vendor_id, asset.id, kind, "Asset details updated" if kind == "updated" else "Location changed",
                           {"changes": changes}, actor_id(vu))
    await db.flush()
    return asset


async def has_open_assignment(db: AsyncSession, asset_id: UUID) -> bool:
    return (await db.execute(select(AmAssignment.id).where(
        AmAssignment.asset_id == asset_id, AmAssignment.returned_at.is_(None)).limit(1))).first() is not None


async def change_status(db: AsyncSession, vendor_id: UUID, asset: AmAsset, new_status: str, vu: Any,
                        reason: Optional[str] = None) -> None:
    check_choice(new_status, ASSET_STATUSES, "status")
    if new_status == asset.status:
        return
    if new_status not in _MANUAL_STATUSES:
        raise HTTPException(400, "This status is set by its workflow (check-out, transfer or disposal), not manually")
    if asset.status in ("disposed", "in_transit"):
        raise HTTPException(409, f"Cannot change the status of an asset that is {asset.status.replace('_', ' ')}")
    if await has_open_assignment(db, asset.id) and new_status in ("in_stock", "retired"):
        raise HTTPException(409, "Check the asset in before changing its status")
    old = asset.status
    asset.status = new_status
    await record_event(db, vendor_id, asset.id, "status_changed", f"Status {old} → {new_status}",
                       {"from": old, "to": new_status, "reason": reason}, actor_id(vu))


async def get_asset_detail(db: AsyncSession, vendor_id: UUID, asset_id: Any) -> dict:
    asset = await get_asset(db, vendor_id, asset_id)
    out = (await assets_out(db, [asset]))[0]
    if asset.parent_asset_id:
        parent = (await db.execute(select(AmAsset.asset_tag, AmAsset.name).where(AmAsset.id == asset.parent_asset_id))).first()
        out["parent"] = {"asset_tag": parent[0], "name": parent[1]} if parent else None
    kids = (await db.execute(select(AmAsset).where(
        AmAsset.vendor_id == vendor_id, AmAsset.parent_asset_id == asset.id).order_by(AmAsset.asset_tag))).scalars().all()
    out["components"] = [{"id": str(k.id), "asset_tag": k.asset_tag, "name": k.name, "status": k.status} for k in kids]
    return out


def _filters(vendor_id: UUID, *, status=None, category_id=None, location_id=None, store_id=None,
             employee_id=None, department_id=None, condition=None, q=None, unassigned=False,
             fin_linked=None, include_closed=True):
    conds = [AmAsset.vendor_id == vendor_id]
    if status:
        conds.append(AmAsset.status.in_([s for s in str(status).split(",") if s]))
    elif not include_closed:
        conds.append(AmAsset.status.notin_(("disposed", "retired")))
    if category_id:
        conds.append(AmAsset.category_id == category_id)
    if location_id:
        conds.append(AmAsset.location_id == location_id)
    if store_id:
        conds.append(AmAsset.store_id == store_id)
    if employee_id:
        conds.append(AmAsset.current_employee_id == employee_id)
    if department_id:
        conds.append(AmAsset.current_department_id == department_id)
    if condition:
        conds.append(AmAsset.condition == condition)
    if unassigned:
        conds.append(AmAsset.status == "in_stock")
    if fin_linked is True:
        conds.append(AmAsset.fin_asset_id.isnot(None))
    elif fin_linked is False:
        conds.append(AmAsset.fin_asset_id.is_(None))
    if q:
        like = f"%{q.strip()}%"
        conds.append(or_(AmAsset.asset_tag.ilike(like), AmAsset.name.ilike(like), AmAsset.serial_number.ilike(like),
                         AmAsset.barcode.ilike(like), AmAsset.model.ilike(like), AmAsset.manufacturer.ilike(like)))
    return conds


async def list_assets(db: AsyncSession, vendor_id: UUID, *, page: int = 1, size: int = 50, **filters) -> dict:
    conds = _filters(vendor_id, **filters)
    total = (await db.execute(select(func.count(AmAsset.id)).where(*conds))).scalar_one()
    rows = (await db.execute(
        select(AmAsset).where(*conds).order_by(AmAsset.created_at.desc(), AmAsset.asset_tag)
        .offset((page - 1) * size).limit(size)
    )).scalars().all()
    return {"items": await assets_out(db, list(rows)), "total": total, "page": page, "size": size}


async def lookup_asset(db: AsyncSession, vendor_id: UUID, code: str) -> AmAsset:
    """Resolve a scanned QR / barcode / typed value to an asset (tag, barcode or serial; case-insensitive)."""
    c = (code or "").strip()
    if c.upper().startswith(QR_PREFIX):
        c = c[len(QR_PREFIX):]
    if not c:
        raise HTTPException(400, "Nothing to look up")
    low = c.lower()
    for col in (AmAsset.asset_tag, AmAsset.barcode, AmAsset.serial_number):
        rows = (await db.execute(select(AmAsset).where(
            AmAsset.vendor_id == vendor_id, func.lower(col) == low).limit(2))).scalars().all()
        if len(rows) == 1:
            return rows[0]
        if len(rows) > 1:
            raise HTTPException(409, "More than one asset matches this code. Scan the asset tag instead.")
    raise HTTPException(404, f"No asset found for '{c}'")


async def timeline(db: AsyncSession, vendor_id: UUID, asset_id: Any, limit: int = 200) -> list[dict]:
    asset = await get_asset(db, vendor_id, asset_id)
    rows = (await db.execute(
        select(AmEvent).where(AmEvent.vendor_id == vendor_id, AmEvent.asset_id == asset.id)
        .order_by(AmEvent.created_at.desc()).limit(min(max(limit, 1), 500))
    )).scalars().all()
    return [to_dict(r) for r in rows]


async def export_csv(db: AsyncSession, vendor_id: UUID, **filters) -> str:
    conds = _filters(vendor_id, **filters)
    rows = (await db.execute(select(AmAsset).where(*conds).order_by(AmAsset.asset_tag))).scalars().all()
    items = await assets_out(db, list(rows))
    cols = ["asset_tag", "name", "category_name", "status", "condition", "serial_number", "barcode", "manufacturer",
            "model", "location_name", "store_name", "employee_name", "department_name", "acquisition_date",
            "acquisition_cost", "supplier_name", "purchase_ref", "is_capitalized"]
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(cols)
    for it in items:
        w.writerow([_csv_safe(it.get(c)) for c in cols])
    return buf.getvalue()


def _csv_safe(v: Any) -> Any:
    """Neutralise spreadsheet formula injection in exported text."""
    if isinstance(v, str) and v[:1] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + v
    return "" if v is None else v


async def import_rows(db: AsyncSession, vendor_id: UUID, rows: list[dict], vu: Any, *, dry_run: bool = True) -> dict:
    """Bulk create assets from parsed CSV rows. Categories / locations are matched by name (and created on commit)."""
    if len(rows) > 2000:
        raise HTTPException(400, "Import at most 2000 rows at a time")
    cat_by_name = {c.name.lower(): c for c in (await db.execute(
        select(AmCategory).where(AmCategory.vendor_id == vendor_id))).scalars().all()}
    loc_by_name = {l.name.lower(): l for l in (await db.execute(
        select(AmLocation).where(AmLocation.vendor_id == vendor_id))).scalars().all()}
    results, created = [], 0
    for idx, raw in enumerate(rows, start=1):
        new_cats: list[str] = []   # names created inside this row's savepoint (dropped from the cache on failure)
        new_locs: list[str] = []
        try:
            async with db.begin_nested():
                row = {k: (v if v != "" else None) for k, v in raw.items()}
                cname, lname = clean_str(row.pop("category_name", None) or row.pop("category", None), 120), \
                    clean_str(row.pop("location_name", None) or row.pop("location", None), 150)
                if not clean_str(row.get("name")):
                    raise HTTPException(400, "name is required")
                if cname:
                    cat = cat_by_name.get(cname.lower())
                    if cat is None and not dry_run:
                        cat = await create_category(db, vendor_id, {"name": cname})
                        cat_by_name[cname.lower()] = cat
                        new_cats.append(cname.lower())
                    row["category_id"] = str(cat.id) if cat else None
                if lname:
                    loc = loc_by_name.get(lname.lower())
                    if loc is None and not dry_run:
                        loc = await create_location(db, vendor_id, {"name": lname})
                        loc_by_name[lname.lower()] = loc
                        new_locs.append(lname.lower())
                    row["location_id"] = str(loc.id) if loc else None
                if dry_run:
                    await _asset_payload(db, vendor_id, row, partial=False)
                    await _assert_unique_codes(db, vendor_id, pick(row, ("serial_number", "barcode")))
                    tag = clean_str(row.get("asset_tag"), 40)
                    results.append({"row": idx, "ok": True, "asset_tag": tag})
                else:
                    a = await create_asset(db, vendor_id, row, vu, asset_tag=row.get("asset_tag"),
                                           event_type="imported", event_summary="Imported from file")
                    created += 1
                    results.append({"row": idx, "ok": True, "asset_tag": a.asset_tag})
        except (HTTPException, ValueError, TypeError) as exc:
            for k in new_cats:
                cat_by_name.pop(k, None)
            for k in new_locs:
                loc_by_name.pop(k, None)
            msg = exc.detail if isinstance(exc, HTTPException) else str(exc)
            results.append({"row": idx, "ok": False, "error": msg})
    return {"dry_run": dry_run, "total": len(rows), "created": created,
            "errors": sum(1 for r in results if not r["ok"]), "rows": results}
