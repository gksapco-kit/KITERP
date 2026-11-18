"""Physical verification audits: plan, scan, variance report, resolve."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset_mgmt import (
    ASSET_CONDITIONS, AUDIT_RESULTS, AmAsset, AmAudit, AmAuditLine, AmCategory, AmLocation,
)
from app.models.store import Store
from app.services.asset_mgmt.assets import lookup_asset
from app.services.asset_mgmt.common import (
    actor_id, as_date, as_uuid, assert_owned, check_choice, clean_str, get_owned, next_number, record_event, to_dict,
)

# Retired / disposed assets are no longer expected to be physically present.
_AUDITABLE = ("in_stock", "assigned", "in_transit", "under_maintenance", "reserved", "lost")


async def create_audit(db: AsyncSession, vendor_id: UUID, data: dict, vu: Any) -> AmAudit:
    name = clean_str(data.get("name"), 200)
    if not name:
        raise HTTPException(400, "Give the audit a name")
    loc = await assert_owned(db, AmLocation, data.get("scope_location_id"), vendor_id, "Location")
    cat = await assert_owned(db, AmCategory, data.get("scope_category_id"), vendor_id, "Category")
    store = await assert_owned(db, Store, data.get("scope_store_id"), vendor_id, "Store")

    conds = [AmAsset.vendor_id == vendor_id, AmAsset.status.in_(_AUDITABLE)]
    if loc:
        # include everything under the chosen location
        ids, frontier = {loc}, [loc]
        while frontier:
            kids = (await db.execute(select(AmLocation.id).where(
                AmLocation.vendor_id == vendor_id, AmLocation.parent_id.in_(frontier)))).scalars().all()
            frontier = [k for k in kids if k not in ids]
            ids.update(frontier)
        conds.append(AmAsset.location_id.in_(ids))
    if cat:
        conds.append(AmAsset.category_id == cat)
    if store:
        conds.append(AmAsset.store_id == store)
    assets = (await db.execute(select(AmAsset.id, AmAsset.location_id).where(*conds))).all()
    if not assets:
        raise HTTPException(400, "No assets match this scope, so there is nothing to audit")
    if len(assets) > 20000:
        raise HTTPException(400, "Scope is too large (over 20,000 assets). Narrow it by location or category.")

    audit = AmAudit(
        vendor_id=vendor_id, audit_no=await next_number(db, vendor_id, "audit", "AUD"), name=name,
        status="draft", scope_location_id=loc, scope_category_id=cat, scope_store_id=store,
        planned_date=as_date(data.get("planned_date"), "planned_date"), notes=clean_str(data.get("notes")),
        created_by=actor_id(vu),
    )
    audit.lines = [AmAuditLine(asset_id=aid, expected_location_id=lid) for aid, lid in assets]
    db.add(audit)
    await db.flush()
    return audit


async def _get(db: AsyncSession, vendor_id: UUID, audit_id: Any, *, lock: bool = False) -> AmAudit:
    return await get_owned(db, AmAudit, audit_id, vendor_id, "Audit", lock=lock)


async def start_audit(db: AsyncSession, vendor_id: UUID, audit_id: Any, vu: Any) -> AmAudit:
    a = await _get(db, vendor_id, audit_id, lock=True)
    if a.status != "draft":
        raise HTTPException(409, f"Audit is already {a.status.replace('_', ' ')}")
    a.status, a.started_at = "in_progress", datetime.now(timezone.utc)
    await db.flush()
    return a


async def _line_for(db: AsyncSession, audit: AmAudit, asset: AmAsset) -> AmAuditLine:
    line = (await db.execute(select(AmAuditLine).where(
        AmAuditLine.audit_id == audit.id, AmAuditLine.asset_id == asset.id).with_for_update())).scalar_one_or_none()
    if line is None:   # scanned although it was not expected in this audit's scope
        line = AmAuditLine(audit_id=audit.id, asset_id=asset.id, expected_location_id=asset.location_id, unexpected=True)
        db.add(line)
        await db.flush()
    return line


async def scan(db: AsyncSession, vendor_id: UUID, audit_id: Any, data: dict, vu: Any) -> dict:
    audit = await _get(db, vendor_id, audit_id)
    if audit.status != "in_progress":
        raise HTTPException(409, "Start the audit before scanning assets")
    asset = await lookup_asset(db, vendor_id, data.get("code") or "")
    line = await _line_for(db, audit, asset)

    cond = check_choice(clean_str(data.get("condition_observed")), ASSET_CONDITIONS, "condition_observed")
    found_loc = await assert_owned(db, AmLocation, data.get("found_location_id"), vendor_id, "Location")
    explicit = check_choice(clean_str(data.get("result")), AUDIT_RESULTS, "result")
    if explicit == "pending":
        raise HTTPException(400, "A scan must record a result other than pending")
    if explicit:
        result = explicit
    elif cond in ("damaged",):
        result = "damaged"
    elif found_loc and line.expected_location_id and found_loc != line.expected_location_id:
        result = "wrong_location"
    else:
        result = "found"
    already = line.result != "pending"
    line.result, line.found_location_id, line.condition_observed = result, found_loc or line.found_location_id, cond
    line.scanned_at, line.scanned_by, line.notes = datetime.now(timezone.utc), actor_id(vu), clean_str(data.get("notes")) or line.notes
    await db.flush()
    await record_event(db, vendor_id, asset.id, "audited", f"Audit {audit.audit_no}: {result.replace('_', ' ')}",
                       {"audit_id": str(audit.id), "result": result}, actor_id(vu))
    return {"asset_id": str(asset.id), "asset_tag": asset.asset_tag, "name": asset.name, "result": result,
            "unexpected": bool(line.unexpected), "already_scanned": already}


async def mark_line(db: AsyncSession, vendor_id: UUID, audit_id: Any, line_id: Any, data: dict, vu: Any) -> AmAuditLine:
    audit = await _get(db, vendor_id, audit_id)
    if audit.status not in ("in_progress", "completed"):
        raise HTTPException(409, "Start the audit first")
    line = (await db.execute(select(AmAuditLine).where(
        AmAuditLine.id == as_uuid(line_id, "line id"), AmAuditLine.audit_id == audit.id))).scalar_one_or_none()
    if line is None:
        raise HTTPException(404, "Audit line not found")
    result = check_choice(clean_str(data.get("result")), AUDIT_RESULTS, "result")
    if not result:
        raise HTTPException(400, "result is required")
    line.result = result
    line.condition_observed = check_choice(clean_str(data.get("condition_observed")), ASSET_CONDITIONS, "condition_observed") or line.condition_observed
    line.found_location_id = await assert_owned(db, AmLocation, data.get("found_location_id"), vendor_id, "Location") or line.found_location_id
    line.notes = clean_str(data.get("notes")) or line.notes
    line.scanned_at, line.scanned_by = datetime.now(timezone.utc), actor_id(vu)
    await db.flush()
    return line


async def complete_audit(db: AsyncSession, vendor_id: UUID, audit_id: Any, data: dict, vu: Any) -> AmAudit:
    a = await _get(db, vendor_id, audit_id, lock=True)
    if a.status != "in_progress":
        raise HTTPException(409, "Only an audit in progress can be completed")
    pending = (await db.execute(select(func.count(AmAuditLine.id)).where(
        AmAuditLine.audit_id == a.id, AmAuditLine.result == "pending"))).scalar_one()
    if pending and not data.get("mark_pending_missing"):
        raise HTTPException(409, f"{pending} asset(s) were not scanned. Confirm to mark them missing.")
    if pending:
        await db.execute(
            AmAuditLine.__table__.update().where(AmAuditLine.audit_id == a.id, AmAuditLine.result == "pending")
            .values(result="missing", scanned_at=datetime.now(timezone.utc), scanned_by=actor_id(vu)))
    a.status, a.completed_at = "completed", datetime.now(timezone.utc)
    await db.flush()
    return a


async def cancel_audit(db: AsyncSession, vendor_id: UUID, audit_id: Any, vu: Any) -> AmAudit:
    a = await _get(db, vendor_id, audit_id, lock=True)
    if a.status in ("completed", "cancelled"):
        raise HTTPException(409, f"Audit is already {a.status}")
    a.status = "cancelled"
    await db.flush()
    return a


async def resolve_line(db: AsyncSession, vendor_id: UUID, audit_id: Any, line_id: Any, action: str, vu: Any) -> AmAuditLine:
    """Action a variance: mark_lost | update_location | send_to_maintenance | accept."""
    audit = await _get(db, vendor_id, audit_id)
    if audit.status != "completed":
        raise HTTPException(409, "Complete the audit before resolving variances")
    line = (await db.execute(select(AmAuditLine).where(
        AmAuditLine.id == as_uuid(line_id, "line id"), AmAuditLine.audit_id == audit.id))).scalar_one_or_none()
    if line is None:
        raise HTTPException(404, "Audit line not found")
    if line.result in ("pending", "found") and not line.unexpected:
        raise HTTPException(409, "This line has no variance to resolve")
    asset = (await db.execute(select(AmAsset).where(AmAsset.id == line.asset_id, AmAsset.vendor_id == vendor_id).with_for_update())).scalar_one()
    if action == "mark_lost":
        if asset.status in ("assigned", "in_transit"):
            raise HTTPException(409, "Check the asset in (or receive the transfer) before marking it lost")
        asset.status = "lost"
        await record_event(db, vendor_id, asset.id, "status_changed", "Marked lost after audit", {"audit_id": str(audit.id)}, actor_id(vu))
    elif action == "update_location":
        if not line.found_location_id:
            raise HTTPException(409, "No found location was recorded for this line")
        asset.location_id = line.found_location_id
        await record_event(db, vendor_id, asset.id, "moved", "Location corrected after audit", {"audit_id": str(audit.id)}, actor_id(vu))
    elif action == "send_to_maintenance":
        if asset.status not in ("in_stock", "assigned"):
            raise HTTPException(409, f"Asset is {asset.status.replace('_', ' ')}")
        asset.status = "under_maintenance"
        asset.condition = line.condition_observed or "damaged"
        await record_event(db, vendor_id, asset.id, "status_changed", "Sent to maintenance after audit", {"audit_id": str(audit.id)}, actor_id(vu))
    elif action == "found_again":
        if asset.status == "lost":
            asset.status = "in_stock"
            await record_event(db, vendor_id, asset.id, "status_changed", "Recovered after audit", {"audit_id": str(audit.id)}, actor_id(vu))
    elif action != "accept":
        raise HTTPException(400, "Unknown action")
    line.resolved = True
    await db.flush()
    return line


async def audit_report(db: AsyncSession, vendor_id: UUID, audit_id: Any) -> dict:
    audit = await _get(db, vendor_id, audit_id)
    rows = (await db.execute(
        select(AmAuditLine, AmAsset.asset_tag, AmAsset.name, AmAsset.status, AmAsset.current_employee_id)
        .join(AmAsset, AmAsset.id == AmAuditLine.asset_id).where(AmAuditLine.audit_id == audit.id)
        .order_by(AmAsset.asset_tag)
    )).all()
    loc_ids = {x for l, *_ in rows for x in (l.expected_location_id, l.found_location_id) if x}
    locs = dict((await db.execute(select(AmLocation.id, AmLocation.name).where(AmLocation.id.in_(loc_ids or [None])))).all())
    counts = {r: 0 for r in AUDIT_RESULTS}
    lines = []
    for l, tag, name, status, _emp in rows:
        counts[l.result] = counts.get(l.result, 0) + 1
        lines.append({**to_dict(l), "asset_tag": tag, "asset_name": name, "asset_status": status,
                      "expected_location_name": locs.get(l.expected_location_id),
                      "found_location_name": locs.get(l.found_location_id)})
    total = len(rows)
    expected = sum(1 for l, *_ in rows if not l.unexpected)
    scanned = sum(1 for l, *_ in rows if l.result != "pending")
    unexpected = sum(1 for l, *_ in rows if l.unexpected)
    variance = counts["missing"] + counts["damaged"] + counts["wrong_location"] + unexpected
    return {
        "audit": to_dict(audit), "counts": counts, "total": total, "expected": expected, "scanned": scanned,
        "unexpected": unexpected, "variance": variance,
        "accuracy_pct": round(100 * counts["found"] / expected, 1) if expected else 0.0,
        "progress_pct": round(100 * scanned / total, 1) if total else 0.0,
        "lines": lines,
    }


async def list_audits(db: AsyncSession, vendor_id: UUID) -> list[dict]:
    audits = (await db.execute(select(AmAudit).where(AmAudit.vendor_id == vendor_id).order_by(AmAudit.created_at.desc()))).scalars().all()
    agg = {}
    for aid, result, n in (await db.execute(
        select(AmAuditLine.audit_id, AmAuditLine.result, func.count(AmAuditLine.id))
        .join(AmAudit, AmAudit.id == AmAuditLine.audit_id).where(AmAudit.vendor_id == vendor_id)
        .group_by(AmAuditLine.audit_id, AmAuditLine.result)
    )).all():
        agg.setdefault(aid, {})[result] = n
    out = []
    for a in audits:
        c = agg.get(a.id, {})
        total = sum(c.values())
        out.append({**to_dict(a), "total": total, "scanned": total - c.get("pending", 0),
                    "found": c.get("found", 0), "missing": c.get("missing", 0),
                    "damaged": c.get("damaged", 0), "wrong_location": c.get("wrong_location", 0)})
    return out
