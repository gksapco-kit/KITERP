"""Custody (check-out / check-in / reassign), acknowledgement, overdue returns, reservations, HR offboarding."""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset_mgmt import (
    ASSET_CONDITIONS, ASSIGNEE_TYPES, AmAssignment, AmAsset, AmLicense, AmLicenseSeat, AmLocation, AmReservation,
)
from app.models.hr import Department, EmployeeProfile
from app.models.store import Store
from app.services.asset_mgmt.common import (
    actor_id, as_date, as_datetime, as_uuid, assert_owned, check_choice, clean_str, get_asset, get_owned,
    record_event, to_dict,
)

# Statuses from which an asset may be checked out. Anything else is mid-workflow or out of service.
_CHECKOUT_FROM = ("in_stock",)
# Where an asset may land when it is checked in.
_CHECKIN_TO = ("in_stock", "under_maintenance", "lost", "retired")


async def _employee(db: AsyncSession, vendor_id: UUID, employee_id: Any) -> EmployeeProfile:
    emp = await get_owned(db, EmployeeProfile, employee_id, vendor_id, "Employee")
    if emp.status == "exited" or emp.is_active is False:
        raise HTTPException(409, f"{emp.full_name or emp.employee_code or 'This employee'} has exited and cannot be given assets")
    return emp


async def open_assignment(db: AsyncSession, asset_id: UUID, *, lock: bool = False) -> Optional[AmAssignment]:
    q = select(AmAssignment).where(AmAssignment.asset_id == asset_id, AmAssignment.returned_at.is_(None)) \
        .order_by(AmAssignment.assigned_at.desc()).limit(1)
    if lock:
        q = q.with_for_update()
    return (await db.execute(q)).scalar_one_or_none()


def _assignee_label(a: AmAssignment, emp_name: Optional[str], dep_name: Optional[str]) -> str:
    return emp_name or dep_name or a.assignee_type


async def checkout(db: AsyncSession, vendor_id: UUID, asset_id: Any, data: dict, vu: Any) -> AmAssignment:
    asset = await get_asset(db, vendor_id, asset_id, lock=True)
    if asset.status not in _CHECKOUT_FROM:
        raise HTTPException(409, f"Only assets that are in stock can be checked out (this one is {asset.status.replace('_', ' ')})")
    if await open_assignment(db, asset.id):
        raise HTTPException(409, "Asset already has an open assignment")

    atype = check_choice(clean_str(data.get("assignee_type")) or "employee", ASSIGNEE_TYPES, "assignee_type")
    emp = dep = store = loc = None
    label = ""
    if atype == "employee":
        emp = await _employee(db, vendor_id, data.get("employee_id"))
        label = emp.full_name or emp.employee_code or "employee"
    elif atype == "department":
        dep = await get_owned(db, Department, data.get("department_id"), vendor_id, "Department")
        label = dep.name
    elif atype == "store":
        store = await get_owned(db, Store, data.get("store_id"), vendor_id, "Store")
        label = store.name
    else:
        loc = await get_owned(db, AmLocation, data.get("location_id"), vendor_id, "Location")
        label = loc.name

    due = as_date(data.get("due_back_on"), "due_back_on")
    if due and due < date.today():
        raise HTTPException(400, "Due date cannot be in the past")
    cond = check_choice(clean_str(data.get("condition_out")), ASSET_CONDITIONS, "condition_out") or asset.condition

    row = AmAssignment(
        vendor_id=vendor_id, asset_id=asset.id, assignee_type=atype,
        employee_id=emp.id if emp else None, department_id=dep.id if dep else None,
        store_id=store.id if store else None, location_id=loc.id if loc else None,
        due_back_on=due, condition_out=cond, notes=clean_str(data.get("notes")),
        assigned_by=actor_id(vu),
    )
    db.add(row)
    asset.status = "assigned"
    asset.holder_type = atype
    asset.current_employee_id = emp.id if emp else None
    asset.current_department_id = dep.id if dep else None
    if store:
        asset.store_id = store.id
    if loc:
        asset.location_id = loc.id
    if cond:
        asset.condition = cond
    await db.flush()
    await record_event(db, vendor_id, asset.id, "checked_out", f"Checked out to {label}",
                       {"assignee_type": atype, "assignment_id": str(row.id), "due_back_on": due,
                        "condition": cond}, actor_id(vu))
    return row


async def checkin(db: AsyncSession, vendor_id: UUID, asset_id: Any, data: dict, vu: Any) -> AmAssignment:
    asset = await get_asset(db, vendor_id, asset_id, lock=True)
    row = await open_assignment(db, asset.id, lock=True)
    if row is None:
        raise HTTPException(409, "This asset is not checked out")

    cond = check_choice(clean_str(data.get("condition_in")), ASSET_CONDITIONS, "condition_in") or asset.condition
    next_status = check_choice(clean_str(data.get("next_status")) or "in_stock", _CHECKIN_TO, "next_status")
    if cond == "damaged" and not data.get("next_status"):
        next_status = "under_maintenance"
    row.returned_at = datetime.now(timezone.utc)
    row.condition_in = cond
    row.return_notes = clean_str(data.get("notes"))
    row.received_by = actor_id(vu)

    asset.status = next_status
    asset.condition = cond
    asset.holder_type = None
    asset.current_employee_id = None
    asset.current_department_id = None
    if data.get("location_id"):
        asset.location_id = await assert_owned(db, AmLocation, data["location_id"], vendor_id, "Location")
    await db.flush()
    await record_event(db, vendor_id, asset.id, "checked_in", f"Checked in ({cond})",
                       {"assignment_id": str(row.id), "next_status": next_status, "condition": cond}, actor_id(vu))
    return row


async def reassign(db: AsyncSession, vendor_id: UUID, asset_id: Any, data: dict, vu: Any) -> AmAssignment:
    """Hand an assigned asset straight to someone else in one atomic step (check-in + check-out)."""
    await checkin(db, vendor_id, asset_id, {
        "condition_in": data.get("condition_in"), "notes": data.get("return_notes"), "next_status": "in_stock",
    }, vu)
    return await checkout(db, vendor_id, asset_id, data, vu)


async def acknowledge(db: AsyncSession, vendor_id: UUID, assignment_id: Any, vu: Any) -> AmAssignment:
    row = await get_owned(db, AmAssignment, assignment_id, vendor_id, "Assignment")
    if row.returned_at is not None:
        raise HTTPException(409, "This assignment is already closed")
    if row.acknowledged_at is None:
        row.acknowledged_at = datetime.now(timezone.utc)
        await record_event(db, vendor_id, row.asset_id, "acknowledged", "Custody acknowledged",
                           {"assignment_id": str(row.id)}, actor_id(vu))
    await db.flush()
    return row


async def current_employee_for(db: AsyncSession, vendor_id: UUID, vu: Any) -> Optional[EmployeeProfile]:
    return (await db.execute(select(EmployeeProfile).where(
        EmployeeProfile.vendor_id == vendor_id, EmployeeProfile.vendor_user_id == vu.id))).scalar_one_or_none()


async def list_assignments(db: AsyncSession, vendor_id: UUID, *, asset_id: Any = None, employee_id: Any = None,
                           open_only: bool = False, overdue_only: bool = False, page: int = 1, size: int = 50) -> dict:
    conds = [AmAssignment.vendor_id == vendor_id]
    if asset_id:
        conds.append(AmAssignment.asset_id == as_uuid(asset_id))
    if employee_id:
        conds.append(AmAssignment.employee_id == as_uuid(employee_id))
    if open_only or overdue_only:
        conds.append(AmAssignment.returned_at.is_(None))
    if overdue_only:
        conds.append(AmAssignment.due_back_on.isnot(None))
        conds.append(AmAssignment.due_back_on < date.today())
    total = (await db.execute(select(func.count(AmAssignment.id)).where(*conds))).scalar_one()
    rows = (await db.execute(
        select(AmAssignment, AmAsset.asset_tag, AmAsset.name, EmployeeProfile.full_name, EmployeeProfile.employee_code,
               Department.name)
        .join(AmAsset, AmAsset.id == AmAssignment.asset_id)
        .outerjoin(EmployeeProfile, EmployeeProfile.id == AmAssignment.employee_id)
        .outerjoin(Department, Department.id == AmAssignment.department_id)
        .where(*conds).order_by(AmAssignment.assigned_at.desc()).offset((page - 1) * size).limit(size)
    )).all()
    today = date.today()
    items = []
    for a, tag, name, emp_name, emp_code, dep_name in rows:
        d = to_dict(a)
        d.update({"asset_tag": tag, "asset_name": name, "employee_name": emp_name or emp_code,
                  "department_name": dep_name, "assignee_label": _assignee_label(a, emp_name or emp_code, dep_name),
                  "is_overdue": bool(a.returned_at is None and a.due_back_on and a.due_back_on < today)})
        items.append(d)
    return {"items": items, "total": total, "page": page, "size": size}


# ── Reservations (shared, bookable assets) ───────────────────────────────────────────────────────
async def create_reservation(db: AsyncSession, vendor_id: UUID, data: dict, vu: Any) -> AmReservation:
    asset = await get_asset(db, vendor_id, data.get("asset_id"), lock=True)   # lock serialises overlap checks
    if not asset.is_reservable:
        raise HTTPException(409, "This asset is not marked as bookable")
    if asset.status in ("lost", "retired", "disposed", "under_maintenance"):
        raise HTTPException(409, f"Asset is {asset.status.replace('_', ' ')} and cannot be booked")
    start, end = as_datetime(data.get("start_at"), "start_at"), as_datetime(data.get("end_at"), "end_at")
    if not start or not end:
        raise HTTPException(400, "start_at and end_at are required")
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    if end <= start:
        raise HTTPException(400, "End must be after start")
    if end < datetime.now(timezone.utc):
        raise HTTPException(400, "Cannot book in the past")
    clash = (await db.execute(select(AmReservation.id).where(
        AmReservation.asset_id == asset.id, AmReservation.status == "booked",
        AmReservation.start_at < end, AmReservation.end_at > start).limit(1))).first()
    if clash:
        raise HTTPException(409, "This asset is already booked for part of that time")
    emp_id = None
    if data.get("employee_id"):
        emp_id = (await _employee(db, vendor_id, data["employee_id"])).id
    else:
        me = await current_employee_for(db, vendor_id, vu)
        emp_id = me.id if me else None
    row = AmReservation(vendor_id=vendor_id, asset_id=asset.id, employee_id=emp_id, reserved_by=actor_id(vu),
                        start_at=start, end_at=end, purpose=clean_str(data.get("purpose"), 300))
    db.add(row)
    await db.flush()
    await record_event(db, vendor_id, asset.id, "reserved", f"Booked {start:%d %b %H:%M} – {end:%d %b %H:%M}",
                       {"reservation_id": str(row.id)}, actor_id(vu))
    return row


async def cancel_reservation(db: AsyncSession, vendor_id: UUID, reservation_id: Any, vu: Any) -> AmReservation:
    row = await get_owned(db, AmReservation, reservation_id, vendor_id, "Reservation", lock=True)
    if row.status != "booked":
        raise HTTPException(409, f"Reservation is already {row.status}")
    row.status = "cancelled"
    await record_event(db, vendor_id, row.asset_id, "reservation_cancelled", "Booking cancelled",
                       {"reservation_id": str(row.id)}, actor_id(vu))
    await db.flush()
    return row


async def list_reservations(db: AsyncSession, vendor_id: UUID, *, asset_id: Any = None, employee_id: Any = None,
                            date_from: Optional[datetime] = None, date_to: Optional[datetime] = None,
                            include_cancelled: bool = False) -> list[dict]:
    conds = [AmReservation.vendor_id == vendor_id]
    if asset_id:
        conds.append(AmReservation.asset_id == as_uuid(asset_id))
    if employee_id:
        conds.append(AmReservation.employee_id == as_uuid(employee_id))
    if date_from:
        conds.append(AmReservation.end_at >= date_from)
    if date_to:
        conds.append(AmReservation.start_at <= date_to)
    if not include_cancelled:
        conds.append(AmReservation.status != "cancelled")
    rows = (await db.execute(
        select(AmReservation, AmAsset.asset_tag, AmAsset.name, EmployeeProfile.full_name)
        .join(AmAsset, AmAsset.id == AmReservation.asset_id)
        .outerjoin(EmployeeProfile, EmployeeProfile.id == AmReservation.employee_id)
        .where(*conds).order_by(AmReservation.start_at)
    )).all()
    return [{**to_dict(r), "asset_tag": tag, "asset_name": name, "employee_name": emp} for r, tag, name, emp in rows]


# ── HR integration ───────────────────────────────────────────────────────────────────────────────
async def employee_summary(db: AsyncSession, vendor_id: UUID, employee_id: Any) -> dict:
    """Everything an employee currently holds: assets, licence seats, upcoming bookings, history count."""
    emp = await get_owned(db, EmployeeProfile, employee_id, vendor_id, "Employee")
    today = date.today()
    held = (await db.execute(
        select(AmAssignment, AmAsset)
        .join(AmAsset, AmAsset.id == AmAssignment.asset_id)
        .where(AmAssignment.vendor_id == vendor_id, AmAssignment.employee_id == emp.id,
               AmAssignment.returned_at.is_(None))
        .order_by(AmAssignment.assigned_at.desc())
    )).all()
    assets = [{
        "assignment_id": str(a.id), "asset_id": str(s.id), "asset_tag": s.asset_tag, "name": s.name,
        "serial_number": s.serial_number, "condition": s.condition, "assigned_at": a.assigned_at.isoformat() if a.assigned_at else None,
        "due_back_on": a.due_back_on.isoformat() if a.due_back_on else None,
        "acknowledged": a.acknowledged_at is not None,
        "is_overdue": bool(a.due_back_on and a.due_back_on < today),
        "acquisition_cost": float(s.acquisition_cost or 0),
    } for a, s in held]
    seats = (await db.execute(
        select(AmLicenseSeat, AmLicense.name)
        .join(AmLicense, AmLicense.id == AmLicenseSeat.license_id)
        .where(AmLicenseSeat.vendor_id == vendor_id, AmLicenseSeat.employee_id == emp.id,
               AmLicenseSeat.revoked_at.is_(None))
    )).all()
    licenses = [{"seat_id": str(s.id), "license_id": str(s.license_id), "name": n} for s, n in seats]
    history = (await db.execute(select(func.count(AmAssignment.id)).where(
        AmAssignment.vendor_id == vendor_id, AmAssignment.employee_id == emp.id))).scalar_one()
    return {
        "employee_id": str(emp.id), "employee_name": emp.full_name or emp.employee_code,
        "employee_status": emp.status, "assets": assets, "licenses": licenses,
        "total_value": sum(x["acquisition_cost"] for x in assets), "history_count": int(history),
        "outstanding": len(assets) + len(licenses),
    }


async def outstanding_for_employee(db: AsyncSession, vendor_id: UUID, employee_id: UUID) -> int:
    """Quick count used by HR to gate an exit; cheap enough to run on every employee status change."""
    n_assets = (await db.execute(select(func.count(AmAssignment.id)).where(
        AmAssignment.vendor_id == vendor_id, AmAssignment.employee_id == employee_id,
        AmAssignment.returned_at.is_(None)))).scalar_one()
    n_seats = (await db.execute(select(func.count(AmLicenseSeat.id)).where(
        AmLicenseSeat.vendor_id == vendor_id, AmLicenseSeat.employee_id == employee_id,
        AmLicenseSeat.revoked_at.is_(None)))).scalar_one()
    return int(n_assets) + int(n_seats)


async def offboard_employee(db: AsyncSession, vendor_id: UUID, employee_id: Any, data: dict, vu: Any) -> dict:
    """Recover everything an employee holds. ``condition`` defaults to the asset's current condition;
    ``per_asset`` can override condition / next_status per assignment id. Licence seats are revoked and
    future bookings cancelled."""
    emp = await get_owned(db, EmployeeProfile, employee_id, vendor_id, "Employee")
    per_asset = data.get("per_asset") or {}
    open_rows = (await db.execute(select(AmAssignment).where(
        AmAssignment.vendor_id == vendor_id, AmAssignment.employee_id == emp.id,
        AmAssignment.returned_at.is_(None)))).scalars().all()
    returned = 0
    for a in open_rows:
        o = per_asset.get(str(a.id)) or {}
        await checkin(db, vendor_id, a.asset_id, {
            "condition_in": o.get("condition_in") or data.get("condition_in"),
            "next_status": o.get("next_status") or data.get("next_status"),
            "notes": o.get("notes") or "Recovered on employee exit",
            "location_id": data.get("location_id"),
        }, vu)
        returned += 1
    now = datetime.now(timezone.utc)
    seats = (await db.execute(select(AmLicenseSeat).where(
        AmLicenseSeat.vendor_id == vendor_id, AmLicenseSeat.employee_id == emp.id,
        AmLicenseSeat.revoked_at.is_(None)))).scalars().all()
    for s in seats:
        s.revoked_at = now
    res = (await db.execute(select(AmReservation).where(
        AmReservation.vendor_id == vendor_id, AmReservation.employee_id == emp.id,
        AmReservation.status == "booked", AmReservation.end_at >= now))).scalars().all()
    for r in res:
        r.status = "cancelled"
    # Record the asset clearance on the HR exit checklist, the same JSON the HR screen already uses.
    clearance = dict(emp.exit_clearance or {})
    clearance["assets"] = True
    emp.exit_clearance = clearance
    await db.flush()
    return {"assets_returned": returned, "licenses_revoked": len(seats), "reservations_cancelled": len(res)}
