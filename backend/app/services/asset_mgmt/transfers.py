"""Inter-location / inter-store transfers (request → approve → dispatch → receive) and asset requests."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.asset_mgmt import (
    ASSET_CONDITIONS, AmAsset, AmCategory, AmLocation, AmRequest, AmTransfer, AmTransferLine,
)
from app.models.hr import EmployeeProfile
from app.models.store import Store
from app.services.asset_mgmt import custody
from app.services.asset_mgmt.common import (
    actor_id, as_date, as_uuid, assert_owned, check_choice, clean_str, get_asset, get_owned, is_vendor_admin,
    next_number, record_event, to_dict,
)

_OPEN_TRANSFER = ("requested", "approved", "in_transit")


def _guard_self_approval(requested_by: Optional[UUID], vu: Any) -> None:
    if requested_by and requested_by == actor_id(vu) and not is_vendor_admin(vu):
        raise HTTPException(403, "You cannot approve your own request")


async def _load(db: AsyncSession, vendor_id: UUID, transfer_id: Any, *, lock: bool = False) -> AmTransfer:
    tid = as_uuid(transfer_id, "transfer id")
    q = select(AmTransfer).options(selectinload(AmTransfer.lines)).where(
        AmTransfer.id == tid, AmTransfer.vendor_id == vendor_id)
    if lock:
        q = q.with_for_update(of=AmTransfer)
    t = (await db.execute(q)).scalar_one_or_none()
    if t is None:
        raise HTTPException(404, "Transfer not found")
    return t


async def transfer_out(db: AsyncSession, t: AmTransfer) -> dict:
    ids = [l.asset_id for l in t.lines]
    assets = {a.id: a for a in (await db.execute(select(AmAsset).where(AmAsset.id.in_(ids)))).scalars().all()} if ids else {}
    locs = {i: n for i, n in (await db.execute(select(AmLocation.id, AmLocation.name).where(
        AmLocation.id.in_([x for x in (t.from_location_id, t.to_location_id) if x] or [None])))).all()}
    stores = {i: n for i, n in (await db.execute(select(Store.id, Store.name).where(
        Store.id.in_([x for x in (t.from_store_id, t.to_store_id) if x] or [None])))).all()}
    out = to_dict(t)
    out.update({
        "from_location_name": locs.get(t.from_location_id), "to_location_name": locs.get(t.to_location_id),
        "from_store_name": stores.get(t.from_store_id), "to_store_name": stores.get(t.to_store_id),
        "lines": [{**to_dict(l), "asset_tag": getattr(assets.get(l.asset_id), "asset_tag", None),
                   "asset_name": getattr(assets.get(l.asset_id), "name", None)} for l in t.lines],
    })
    return out


async def create_transfer(db: AsyncSession, vendor_id: UUID, data: dict, vu: Any) -> AmTransfer:
    asset_ids = [as_uuid(x, "asset id") for x in (data.get("asset_ids") or [])]
    asset_ids = list(dict.fromkeys(a for a in asset_ids if a))
    if not asset_ids:
        raise HTTPException(400, "Select at least one asset to transfer")
    if len(asset_ids) > 200:
        raise HTTPException(400, "A transfer can hold at most 200 assets")
    to_loc = await assert_owned(db, AmLocation, data.get("to_location_id"), vendor_id, "Destination location")
    to_store = await assert_owned(db, Store, data.get("to_store_id"), vendor_id, "Destination store")
    if not to_loc and not to_store:
        raise HTTPException(400, "Choose a destination location or store")
    from_loc = await assert_owned(db, AmLocation, data.get("from_location_id"), vendor_id, "Source location")
    from_store = await assert_owned(db, Store, data.get("from_store_id"), vendor_id, "Source store")

    assets = (await db.execute(
        select(AmAsset).where(AmAsset.vendor_id == vendor_id, AmAsset.id.in_(asset_ids)).with_for_update()
    )).scalars().all()
    if len(assets) != len(asset_ids):
        raise HTTPException(404, "One or more assets were not found")
    for a in assets:
        if a.status != "in_stock":
            raise HTTPException(409, f"{a.asset_tag} is {a.status.replace('_', ' ')}. Only assets in stock can be transferred "
                                     "(check assigned assets in first).")
        if (to_loc and a.location_id == to_loc) and not to_store:
            raise HTTPException(409, f"{a.asset_tag} is already at the destination")
    busy = (await db.execute(
        select(AmAsset.asset_tag).join(AmTransferLine, AmTransferLine.asset_id == AmAsset.id)
        .join(AmTransfer, AmTransfer.id == AmTransferLine.transfer_id)
        .where(AmTransfer.vendor_id == vendor_id, AmTransfer.status.in_(_OPEN_TRANSFER), AmAsset.id.in_(asset_ids))
        .limit(1)
    )).scalar_one_or_none()
    if busy:
        raise HTTPException(409, f"{busy} is already on an open transfer")

    submit = bool(data.get("submit", True))
    t = AmTransfer(
        vendor_id=vendor_id, transfer_no=await next_number(db, vendor_id, "transfer", "TRF"),
        status="requested" if submit else "draft",
        from_location_id=from_loc, to_location_id=to_loc, from_store_id=from_store, to_store_id=to_store,
        reason=clean_str(data.get("reason")), requested_by=actor_id(vu),
    )
    t.lines = [AmTransferLine(asset_id=a.id, condition_out=a.condition) for a in assets]
    db.add(t)
    await db.flush()
    return t


async def submit_transfer(db: AsyncSession, vendor_id: UUID, transfer_id: Any, vu: Any) -> AmTransfer:
    t = await _load(db, vendor_id, transfer_id, lock=True)
    if t.status != "draft":
        raise HTTPException(409, f"Only draft transfers can be submitted (this one is {t.status})")
    t.status = "requested"
    await db.flush()
    return t


async def approve_transfer(db: AsyncSession, vendor_id: UUID, transfer_id: Any, vu: Any, notes: Optional[str] = None) -> AmTransfer:
    t = await _load(db, vendor_id, transfer_id, lock=True)
    if t.status != "requested":
        raise HTTPException(409, f"Only requested transfers can be approved (this one is {t.status})")
    _guard_self_approval(t.requested_by, vu)
    t.status, t.approved_by, t.approved_at = "approved", actor_id(vu), datetime.now(timezone.utc)
    t.decision_notes = clean_str(notes)
    await db.flush()
    return t


async def reject_transfer(db: AsyncSession, vendor_id: UUID, transfer_id: Any, vu: Any, notes: Optional[str] = None) -> AmTransfer:
    t = await _load(db, vendor_id, transfer_id, lock=True)
    if t.status != "requested":
        raise HTTPException(409, f"Only requested transfers can be rejected (this one is {t.status})")
    _guard_self_approval(t.requested_by, vu)
    t.status, t.approved_by, t.approved_at = "rejected", actor_id(vu), datetime.now(timezone.utc)
    t.decision_notes = clean_str(notes)
    await db.flush()
    return t


async def cancel_transfer(db: AsyncSession, vendor_id: UUID, transfer_id: Any, vu: Any) -> AmTransfer:
    t = await _load(db, vendor_id, transfer_id, lock=True)
    if t.status not in ("draft", "requested", "approved"):
        raise HTTPException(409, f"A {t.status.replace('_', ' ')} transfer cannot be cancelled")
    t.status = "cancelled"
    await db.flush()
    return t


async def dispatch_transfer(db: AsyncSession, vendor_id: UUID, transfer_id: Any, vu: Any) -> AmTransfer:
    t = await _load(db, vendor_id, transfer_id, lock=True)
    if t.status != "approved":
        raise HTTPException(409, "Only approved transfers can be dispatched")
    ids = [l.asset_id for l in t.lines]
    assets = (await db.execute(select(AmAsset).where(AmAsset.id.in_(ids)).with_for_update())).scalars().all()
    for a in assets:
        if a.status != "in_stock":
            raise HTTPException(409, f"{a.asset_tag} is {a.status.replace('_', ' ')} and can no longer be dispatched")
    for a in assets:
        a.status = "in_transit"
        await record_event(db, vendor_id, a.id, "dispatched", f"Dispatched on {t.transfer_no}",
                           {"transfer_id": str(t.id)}, actor_id(vu))
    t.status, t.dispatched_at = "in_transit", datetime.now(timezone.utc)
    await db.flush()
    return t


async def receive_transfer(db: AsyncSession, vendor_id: UUID, transfer_id: Any, data: dict, vu: Any) -> AmTransfer:
    """Receive some or all lines. ``lines`` = [{line_id, condition_in?, notes?}]; omit to receive everything."""
    t = await _load(db, vendor_id, transfer_id, lock=True)
    if t.status != "in_transit":
        raise HTTPException(409, "Only transfers in transit can be received")
    wanted = {as_uuid(x.get("line_id"), "line id"): x for x in (data.get("lines") or [])}
    pending = [l for l in t.lines if not l.received]
    targets = [l for l in pending if (not wanted or l.id in wanted)]
    if wanted and len(targets) != len(wanted):
        raise HTTPException(400, "One or more lines are not part of this transfer or were already received")
    ids = [l.asset_id for l in targets]
    assets = {a.id: a for a in (await db.execute(select(AmAsset).where(AmAsset.id.in_(ids)).with_for_update())).scalars().all()}
    for l in targets:
        o = wanted.get(l.id) or {}
        cond = check_choice(clean_str(o.get("condition_in")), ASSET_CONDITIONS, "condition_in") or l.condition_out
        a = assets[l.asset_id]
        l.received, l.condition_in, l.notes = True, cond, clean_str(o.get("notes")) or l.notes
        a.status = "in_stock"
        a.condition = cond or a.condition
        if t.to_location_id:
            a.location_id = t.to_location_id
        if t.to_store_id:
            a.store_id = t.to_store_id
        await record_event(db, vendor_id, a.id, "received", f"Received via {t.transfer_no}",
                           {"transfer_id": str(t.id), "condition": cond}, actor_id(vu))
    if all(l.received for l in t.lines):
        t.status, t.received_at, t.received_by = "received", datetime.now(timezone.utc), actor_id(vu)
    await db.flush()
    return t


async def list_transfers(db: AsyncSession, vendor_id: UUID, *, status: Optional[str] = None, page: int = 1,
                         size: int = 50) -> dict:
    conds = [AmTransfer.vendor_id == vendor_id]
    if status:
        conds.append(AmTransfer.status.in_([s for s in status.split(",") if s]))
    total = (await db.execute(select(func.count(AmTransfer.id)).where(*conds))).scalar_one()
    rows = (await db.execute(
        select(AmTransfer).options(selectinload(AmTransfer.lines)).where(*conds)
        .order_by(AmTransfer.created_at.desc()).offset((page - 1) * size).limit(size)
    )).scalars().all()
    return {"items": [await transfer_out(db, t) for t in rows], "total": total, "page": page, "size": size}


async def get_transfer(db: AsyncSession, vendor_id: UUID, transfer_id: Any) -> dict:
    return await transfer_out(db, await _load(db, vendor_id, transfer_id))


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Asset requests
# ═════════════════════════════════════════════════════════════════════════════════════════════════
async def create_request(db: AsyncSession, vendor_id: UUID, data: dict, vu: Any) -> AmRequest:
    title = clean_str(data.get("title"), 200)
    if not title:
        raise HTTPException(400, "Tell us what you need (title)")
    qty = int(data.get("quantity") or 1)
    if qty < 1 or qty > 1000:
        raise HTTPException(400, "Quantity must be between 1 and 1000")
    priority = check_choice(clean_str(data.get("priority")) or "medium", ("low", "medium", "high", "urgent"), "priority")
    emp_id = None
    if data.get("requester_employee_id"):
        emp_id = (await get_owned(db, EmployeeProfile, data["requester_employee_id"], vendor_id, "Employee")).id
    else:
        me = await custody.current_employee_for(db, vendor_id, vu)
        emp_id = me.id if me else None
    row = AmRequest(
        vendor_id=vendor_id, request_no=await next_number(db, vendor_id, "request", "REQ"),
        request_type=check_choice(clean_str(data.get("request_type")) or "new", ("new", "replacement"), "request_type"),
        title=title, justification=clean_str(data.get("justification")),
        category_id=await assert_owned(db, AmCategory, data.get("category_id"), vendor_id, "Category"),
        quantity=qty, priority=priority, needed_by=as_date(data.get("needed_by"), "needed_by"),
        requester_employee_id=emp_id, requester_user_id=actor_id(vu),
    )
    db.add(row)
    await db.flush()
    return row


async def decide_request(db: AsyncSession, vendor_id: UUID, request_id: Any, approve: bool, vu: Any,
                         notes: Optional[str] = None) -> AmRequest:
    row = await get_owned(db, AmRequest, request_id, vendor_id, "Request", lock=True)
    if row.status != "pending":
        raise HTTPException(409, f"Request is already {row.status}")
    _guard_self_approval(row.requester_user_id, vu)
    row.status = "approved" if approve else "rejected"
    row.decided_by, row.decided_at, row.decision_notes = actor_id(vu), datetime.now(timezone.utc), clean_str(notes)
    await db.flush()
    return row


async def fulfill_request(db: AsyncSession, vendor_id: UUID, request_id: Any, data: dict, vu: Any) -> AmRequest:
    """Issue a specific in-stock asset to the requester (check-out) and close the request."""
    row = await get_owned(db, AmRequest, request_id, vendor_id, "Request", lock=True)
    if row.status != "approved":
        raise HTTPException(409, "Only approved requests can be fulfilled")
    if not row.requester_employee_id:
        raise HTTPException(409, "This request has no linked employee. Check the asset out manually.")
    asset = await get_asset(db, vendor_id, data.get("asset_id"))
    await custody.checkout(db, vendor_id, asset.id, {
        "assignee_type": "employee", "employee_id": str(row.requester_employee_id),
        "due_back_on": data.get("due_back_on"), "notes": f"Fulfils {row.request_no}",
    }, vu)
    row.status, row.fulfilled_asset_id, row.fulfilled_at = "fulfilled", asset.id, datetime.now(timezone.utc)
    await db.flush()
    return row


async def cancel_request(db: AsyncSession, vendor_id: UUID, request_id: Any, vu: Any, can_manage: bool) -> AmRequest:
    row = await get_owned(db, AmRequest, request_id, vendor_id, "Request", lock=True)
    if row.requester_user_id != actor_id(vu) and not can_manage:
        raise HTTPException(403, "Only the requester can cancel this request")
    if row.status not in ("pending", "approved"):
        raise HTTPException(409, f"Request is already {row.status}")
    row.status = "cancelled"
    await db.flush()
    return row


async def link_requisition(db: AsyncSession, vendor_id: UUID, request_id: Any, pr_id: Any) -> AmRequest:
    from app.models.procurement_requisition import PurchaseRequisition
    row = await get_owned(db, AmRequest, request_id, vendor_id, "Request", lock=True)
    row.purchase_requisition_id = await assert_owned(db, PurchaseRequisition, pr_id, vendor_id, "Purchase requisition")
    await db.flush()
    return row


async def list_requests(db: AsyncSession, vendor_id: UUID, *, status: Optional[str] = None,
                        mine_user_id: Optional[UUID] = None, page: int = 1, size: int = 50) -> dict:
    conds = [AmRequest.vendor_id == vendor_id]
    if status:
        conds.append(AmRequest.status.in_([s for s in status.split(",") if s]))
    if mine_user_id:
        conds.append(AmRequest.requester_user_id == mine_user_id)
    total = (await db.execute(select(func.count(AmRequest.id)).where(*conds))).scalar_one()
    rows = (await db.execute(
        select(AmRequest, EmployeeProfile.full_name, AmCategory.name)
        .outerjoin(EmployeeProfile, EmployeeProfile.id == AmRequest.requester_employee_id)
        .outerjoin(AmCategory, AmCategory.id == AmRequest.category_id)
        .where(*conds).order_by(AmRequest.created_at.desc()).offset((page - 1) * size).limit(size)
    )).all()
    return {"items": [{**to_dict(r), "requester_name": emp, "category_name": cat} for r, emp, cat in rows],
            "total": total, "page": page, "size": size}
