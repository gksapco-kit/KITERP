"""Software licence pools and seat assignment (IT assets)."""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset_mgmt import AmAsset, AmLicense, AmLicenseSeat
from app.models.hr import EmployeeProfile
from app.services.asset_mgmt.common import (
    actor_id, as_date, as_decimal, as_uuid, check_choice, clean_str, get_asset, get_owned, pick, record_event, to_dict,
)

_TYPES = ("per_seat", "site", "subscription")


async def _payload(data: dict, *, partial: bool) -> dict:
    p = pick(data, ("name", "publisher", "license_type", "license_key", "total_seats", "purchase_date", "expiry_date",
                    "cost", "renewal_alert_days", "notes", "is_active"))
    if "name" in p:
        p["name"] = clean_str(p["name"], 200)
        if not p["name"]:
            raise HTTPException(400, "Licence name is required")
    elif not partial:
        raise HTTPException(400, "Licence name is required")
    if "license_type" in p:
        check_choice(p["license_type"], _TYPES, "license_type")
    if "total_seats" in p:
        n = int(p["total_seats"] or 1)
        if not 1 <= n <= 1_000_000:
            raise HTTPException(400, "total_seats must be at least 1")
        p["total_seats"] = n
    for k in ("purchase_date", "expiry_date"):
        if k in p:
            p[k] = as_date(p[k], k)
    if "cost" in p:
        p["cost"] = as_decimal(p["cost"], "cost")
    if "renewal_alert_days" in p:
        p["renewal_alert_days"] = max(0, min(int(p["renewal_alert_days"] or 30), 365))
    for k, n in (("publisher", 200), ("license_key", None), ("notes", None)):
        if k in p:
            p[k] = clean_str(p[k], n)
    if "is_active" in p:
        p["is_active"] = bool(p["is_active"])
    return p


def _out(lic: AmLicense, used: int, *, reveal_key: bool) -> dict:
    d = to_dict(lic, exclude=() if reveal_key else ("license_key",))
    if not reveal_key:
        d["has_license_key"] = bool(lic.license_key)
    today = date.today()
    d.update({"used_seats": used, "available_seats": max(0, (lic.total_seats or 0) - used),
              "days_left": (lic.expiry_date - today).days if lic.expiry_date else None,
              "is_expired": bool(lic.expiry_date and lic.expiry_date < today)})
    return d


async def _used(db: AsyncSession, license_id: UUID) -> int:
    return int((await db.execute(select(func.count(AmLicenseSeat.id)).where(
        AmLicenseSeat.license_id == license_id, AmLicenseSeat.revoked_at.is_(None)))).scalar_one())


async def create_license(db: AsyncSession, vendor_id: UUID, data: dict) -> AmLicense:
    lic = AmLicense(vendor_id=vendor_id, **(await _payload(data, partial=False)))
    db.add(lic)
    await db.flush()
    return lic


async def update_license(db: AsyncSession, vendor_id: UUID, license_id: Any, data: dict) -> AmLicense:
    lic = await get_owned(db, AmLicense, license_id, vendor_id, "Licence", lock=True)
    p = await _payload(data, partial=True)
    if "total_seats" in p and p["total_seats"] < await _used(db, lic.id):
        raise HTTPException(409, "Cannot reduce seats below the number already assigned. Revoke seats first.")
    for k, v in p.items():
        setattr(lic, k, v)
    if "expiry_date" in p:
        lic.last_alerted_on = None
    await db.flush()
    return lic


async def delete_license(db: AsyncSession, vendor_id: UUID, license_id: Any) -> None:
    lic = await get_owned(db, AmLicense, license_id, vendor_id, "Licence")
    if await _used(db, lic.id):
        raise HTTPException(409, "Revoke all seats before deleting this licence")
    await db.delete(lic)
    await db.flush()


async def list_licenses(db: AsyncSession, vendor_id: UUID, *, reveal_key: bool) -> list[dict]:
    lics = (await db.execute(select(AmLicense).where(AmLicense.vendor_id == vendor_id).order_by(AmLicense.name))).scalars().all()
    used = dict((await db.execute(
        select(AmLicenseSeat.license_id, func.count(AmLicenseSeat.id))
        .where(AmLicenseSeat.vendor_id == vendor_id, AmLicenseSeat.revoked_at.is_(None))
        .group_by(AmLicenseSeat.license_id))).all())
    return [_out(l, int(used.get(l.id, 0)), reveal_key=reveal_key) for l in lics]


async def get_license(db: AsyncSession, vendor_id: UUID, license_id: Any, *, reveal_key: bool) -> dict:
    lic = await get_owned(db, AmLicense, license_id, vendor_id, "Licence")
    seats = (await db.execute(
        select(AmLicenseSeat, EmployeeProfile.full_name, EmployeeProfile.employee_code, AmAsset.asset_tag)
        .outerjoin(EmployeeProfile, EmployeeProfile.id == AmLicenseSeat.employee_id)
        .outerjoin(AmAsset, AmAsset.id == AmLicenseSeat.asset_id)
        .where(AmLicenseSeat.license_id == lic.id, AmLicenseSeat.revoked_at.is_(None))
        .order_by(AmLicenseSeat.assigned_at.desc())
    )).all()
    out = _out(lic, len(seats), reveal_key=reveal_key)
    out["seats"] = [{**to_dict(s), "employee_name": n or c, "asset_tag": tag} for s, n, c, tag in seats]
    return out


async def assign_seat(db: AsyncSession, vendor_id: UUID, license_id: Any, data: dict, vu: Any) -> AmLicenseSeat:
    lic = await get_owned(db, AmLicense, license_id, vendor_id, "Licence", lock=True)   # lock serialises the seat count
    if not lic.is_active:
        raise HTTPException(409, "This licence is inactive")
    if lic.expiry_date and lic.expiry_date < date.today():
        raise HTTPException(409, "This licence has expired")
    emp_id, asset_id = data.get("employee_id"), data.get("asset_id")
    if bool(emp_id) == bool(asset_id):
        raise HTTPException(400, "Assign a seat to either an employee or an asset")
    emp = asset = None
    if emp_id:
        emp = await get_owned(db, EmployeeProfile, emp_id, vendor_id, "Employee")
        if emp.status == "exited":
            raise HTTPException(409, "This employee has exited")
        dup = (await db.execute(select(AmLicenseSeat.id).where(
            AmLicenseSeat.license_id == lic.id, AmLicenseSeat.employee_id == emp.id,
            AmLicenseSeat.revoked_at.is_(None)))).first()
    else:
        asset = await get_asset(db, vendor_id, asset_id)
        dup = (await db.execute(select(AmLicenseSeat.id).where(
            AmLicenseSeat.license_id == lic.id, AmLicenseSeat.asset_id == asset.id,
            AmLicenseSeat.revoked_at.is_(None)))).first()
    if dup:
        raise HTTPException(409, "This licence is already assigned there")
    if await _used(db, lic.id) >= (lic.total_seats or 0):
        raise HTTPException(409, "No seats left on this licence")
    seat = AmLicenseSeat(license_id=lic.id, vendor_id=vendor_id, employee_id=emp.id if emp else None,
                         asset_id=asset.id if asset else None)
    db.add(seat)
    await db.flush()
    if asset:
        await record_event(db, vendor_id, asset.id, "license_assigned", f"Licence assigned: {lic.name}",
                           {"license_id": str(lic.id)}, actor_id(vu))
    return seat


async def revoke_seat(db: AsyncSession, vendor_id: UUID, seat_id: Any, vu: Any) -> AmLicenseSeat:
    seat = await get_owned(db, AmLicenseSeat, seat_id, vendor_id, "Seat", lock=True)
    if seat.revoked_at is not None:
        raise HTTPException(409, "Seat is already revoked")
    seat.revoked_at = datetime.now(timezone.utc)
    if seat.asset_id:
        await record_event(db, vendor_id, seat.asset_id, "license_revoked", "Licence revoked",
                           {"license_id": str(seat.license_id)}, actor_id(vu))
    await db.flush()
    return seat
