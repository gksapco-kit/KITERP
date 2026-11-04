"""Modules 2 & 15 — land bank, acquisition, JDA entitlements and statutory approval tracking."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.realestate import core as C
from app.models.realestate import land as L

from .common import Ctx, D, audit, get_owned, jsonable, money_q
from .pricing import TDS_194IA_RATE, TDS_194IA_THRESHOLD, tds_194ia

EPS = Decimal("0.005")
OPEN_ACQ = ("draft", "negotiating", "agreement_signed", "registered")


def _f(v: Any) -> float:
    return float(D(v))


def area_in_sqft(area: Any, unit: str) -> Decimal:
    return money_q(D(area) * D(str(L.SQFT_PER.get(unit or "sqft", 1.0))))


# ═══ parcels & owners ═══════════════════════════════════════════════════════════════════════

async def landowner_share_total(db: AsyncSession, parcel_id: UUID, exclude_id: Optional[UUID] = None) -> Decimal:
    q = select(func.coalesce(func.sum(L.ReLandowner.share_percent), 0)).where(L.ReLandowner.parcel_id == parcel_id)
    if exclude_id:
        q = q.where(L.ReLandowner.id != exclude_id)
    return D((await db.execute(q)).scalar_one())


async def title_clearance(db: AsyncSession, parcel_id: UUID) -> dict:
    """A parcel can be registered only when the title search is clear and nothing is open or flagged."""
    checks = (await db.execute(select(L.ReTitleCheck).where(L.ReTitleCheck.parcel_id == parcel_id))).scalars().all()
    reasons: list[str] = []
    ok_types = {c.check_type for c in checks if c.status in ("clear", "waived")}
    if "title_search" not in ok_types:
        reasons.append("No clear title search on record")
    for c in checks:
        label = c.check_type.replace("_", " ")
        if c.status == "issues_found":
            reasons.append(f"{label}: issues found")
        elif c.status in ("pending", "in_progress"):
            reasons.append(f"{label}: still {c.status.replace('_', ' ')}")
        elif c.status == "clear" and c.valid_until and c.valid_until < date.today():
            reasons.append(f"{label}: clearance expired on {c.valid_until}")
    return {"clear": not reasons, "reasons": reasons, "checks": len(checks)}


# ═══ acquisition ════════════════════════════════════════════════════════════════════════════

def total_cost_of(a: Any) -> Decimal:
    return money_q(D(a.agreed_price) + D(a.stamp_duty) + D(a.registration_fee) + D(a.other_costs))


async def recompute_acquisition(db: AsyncSession, acq: L.ReAcquisition) -> None:
    paid = D((await db.execute(
        select(func.coalesce(func.sum(L.ReAcquisitionPayment.amount), 0)).where(
            L.ReAcquisitionPayment.acquisition_id == acq.id, L.ReAcquisitionPayment.status == "paid")
    )).scalar_one())
    acq.paid_amount = money_q(paid)
    acq.total_cost = total_cost_of(acq)
    await db.flush()


async def _acq(ctx: Ctx, acq_id: UUID) -> L.ReAcquisition:
    return await get_owned(ctx.db, L.ReAcquisition, ctx.vendor_id, acq_id, "acquisition")


async def _set_parcel(ctx: Ctx, acq: L.ReAcquisition, status: str) -> None:
    parcel = await ctx.db.get(L.ReLandParcel, acq.parcel_id)
    if parcel is not None and parcel.status != status:
        old = parcel.status
        parcel.status = status
        await audit(ctx, "land_parcel", parcel.id, "status", ref=parcel.code, changes={"from": old, "to": status})


async def acquisition_negotiate(ctx: Ctx, acq: L.ReAcquisition) -> L.ReAcquisition:
    if acq.status != "draft":
        raise HTTPException(status_code=409, detail=f"Acquisition is {acq.status}")
    acq.status = "negotiating"
    await _set_parcel(ctx, acq, "under_negotiation")
    await audit(ctx, "acquisition", acq.id, "negotiate", ref=acq.acquisition_no)
    return acq


async def acquisition_sign(ctx: Ctx, acq: L.ReAcquisition, signed_on: Optional[date]) -> L.ReAcquisition:
    if acq.status not in ("draft", "negotiating"):
        raise HTTPException(status_code=409, detail=f"Acquisition is {acq.status}")
    if acq.mode in ("outright_purchase", "auction") and D(acq.agreed_price) <= 0:
        raise HTTPException(status_code=422, detail="Set the agreed price before signing")
    owners = await landowner_share_total(ctx.db, acq.parcel_id)
    if owners == 0:
        raise HTTPException(status_code=409, detail="Add the landowners to the parcel before signing")
    if abs(owners - 100) > Decimal("0.01"):
        raise HTTPException(status_code=409, detail=f"Landowner shares add up to {owners:g}%, they must total 100%")
    acq.status = "agreement_signed"
    acq.agreement_date = signed_on or date.today()
    await _set_parcel(ctx, acq, "title_check")
    await audit(ctx, "acquisition", acq.id, "sign", ref=acq.acquisition_no)
    return acq


async def acquisition_register(
    ctx: Ctx, acq: L.ReAcquisition, *, registration_no: str, registration_date: Optional[date],
    sub_registrar_office: Optional[str], stamp_duty: Optional[Decimal], registration_fee: Optional[Decimal],
) -> L.ReAcquisition:
    if acq.status != "agreement_signed":
        raise HTTPException(status_code=409, detail="Only a signed acquisition agreement can be registered")
    clearance = await title_clearance(ctx.db, acq.parcel_id)
    if not clearance["clear"]:
        raise HTTPException(status_code=409, detail="Title is not clear: " + "; ".join(clearance["reasons"]))
    if acq.mode in ("outright_purchase", "auction"):
        await recompute_acquisition(ctx.db, acq)
        if D(acq.paid_amount) < D(acq.agreed_price) - EPS:
            raise HTTPException(
                status_code=409,
                detail=(f"Pay the agreed price before registration (paid ₹{D(acq.paid_amount):,.2f} of ₹{D(acq.agreed_price):,.2f})"),
            )
    acq.registration_no = registration_no
    acq.registration_date = registration_date or date.today()
    acq.sub_registrar_office = sub_registrar_office
    if stamp_duty is not None:
        acq.stamp_duty = stamp_duty
    if registration_fee is not None:
        acq.registration_fee = registration_fee
    acq.total_cost = total_cost_of(acq)
    acq.status = "registered"
    await audit(ctx, "acquisition", acq.id, "register", ref=acq.acquisition_no, changes={"registration_no": registration_no})
    return acq


async def acquisition_complete(ctx: Ctx, acq: L.ReAcquisition, possession_date: Optional[date]) -> L.ReAcquisition:
    if acq.status != "registered":
        raise HTTPException(status_code=409, detail="Only a registered acquisition can be completed")
    acq.status = "completed"
    acq.possession_date = possession_date or date.today()
    parcel = await ctx.db.get(L.ReLandParcel, acq.parcel_id)
    if parcel is not None:
        if acq.project_id:
            parcel.project_id = acq.project_id
        parcel.status = "under_jda" if acq.mode in ("jda", "joint_venture") else "acquired"
        await audit(ctx, "land_parcel", parcel.id, "acquired", ref=parcel.code)
    await audit(ctx, "acquisition", acq.id, "complete", ref=acq.acquisition_no)
    return acq


async def acquisition_cancel(ctx: Ctx, acq: L.ReAcquisition, reason: str) -> L.ReAcquisition:
    if acq.status in ("completed", "cancelled"):
        raise HTTPException(status_code=409, detail=f"Acquisition is {acq.status}")
    if acq.status == "registered":
        raise HTTPException(status_code=409, detail="A registered acquisition cannot be cancelled; complete or reverse the deed instead")
    await recompute_acquisition(ctx.db, acq)
    if D(acq.paid_amount) > EPS:
        raise HTTPException(status_code=409, detail="Cancel (refund) the payments made to the landowner before cancelling the acquisition")
    acq.status = "cancelled"
    acq.remarks = f"Cancelled: {reason}"[:500] if reason else acq.remarks
    others = (await ctx.db.execute(select(func.count()).select_from(L.ReAcquisition).where(
        L.ReAcquisition.parcel_id == acq.parcel_id, L.ReAcquisition.id != acq.id, L.ReAcquisition.status.in_(OPEN_ACQ)))).scalar_one()
    if not others:
        await _set_parcel(ctx, acq, "identified")
    await audit(ctx, "acquisition", acq.id, "cancel", ref=acq.acquisition_no, changes={"reason": reason})
    return acq


async def acquisition_tds(ctx: Ctx, acq: L.ReAcquisition, amount: Decimal) -> dict:
    parcel = await ctx.db.get(L.ReLandParcel, acq.parcel_id)
    agricultural = bool(parcel and parcel.land_use == "agricultural")
    consideration = D(acq.agreed_price)
    applicable = not agricultural and consideration >= TDS_194IA_THRESHOLD
    tds = tds_194ia(consideration, D(amount)) if applicable else Decimal(0)
    return {
        "consideration": _f(consideration), "payment": _f(amount), "applicable": applicable,
        "tds_percent": _f(TDS_194IA_RATE) if applicable else 0, "tds_amount": _f(tds), "net_payable": _f(D(amount) - tds),
        "note": ("Rural agricultural land is outside s.194-IA" if agricultural else
                 "TDS u/s 194-IA applies when the consideration is ₹50 lakh or more" if not applicable else
                 "Deduct on each payment to the seller and deposit through Form 26QB"),
    }


async def payment_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    acq = await _acq(ctx, data["acquisition_id"])
    if acq.status not in ("negotiating", "agreement_signed", "registered"):
        raise HTTPException(status_code=409, detail=f"Payments cannot be recorded while the acquisition is {acq.status}")
    amount = D(data.get("amount"))
    tds = D(data.get("tds_amount"))
    if amount <= 0:
        raise HTTPException(status_code=422, detail="amount must be greater than zero")
    if tds < 0 or tds > amount:
        raise HTTPException(status_code=422, detail="tds_amount must be between zero and the amount")
    if data.get("landowner_id"):
        owner = await ctx.db.get(L.ReLandowner, data["landowner_id"])
        if owner is None or owner.parcel_id != acq.parcel_id:
            raise HTTPException(status_code=422, detail="The landowner does not belong to this acquisition's parcel")
    await recompute_acquisition(ctx.db, acq)
    cap = total_cost_of(acq)
    if cap > 0 and D(acq.paid_amount) + amount > cap + EPS:
        raise HTTPException(
            status_code=409,
            detail=f"Payment would exceed the acquisition cost (₹{cap:,.2f}); already paid ₹{D(acq.paid_amount):,.2f}",
        )
    data["net_paid"] = money_q(amount - tds)
    data["status"] = "paid"


async def payment_after_create(ctx: Ctx, obj: L.ReAcquisitionPayment) -> None:
    acq = await _acq(ctx, obj.acquisition_id)
    await recompute_acquisition(ctx.db, acq)


async def payment_cancel(ctx: Ctx, pay: L.ReAcquisitionPayment, reason: str) -> L.ReAcquisitionPayment:
    if pay.status != "paid":
        raise HTTPException(status_code=409, detail="Payment is already cancelled")
    acq = await _acq(ctx, pay.acquisition_id)
    if acq.status == "completed":
        raise HTTPException(status_code=409, detail="The acquisition is completed")
    pay.status = "cancelled"
    pay.remarks = f"Cancelled: {reason}"[:500] if reason else pay.remarks
    await recompute_acquisition(ctx.db, acq)
    await audit(ctx, "acquisition_payment", pay.id, "cancel", changes={"amount": pay.amount, "reason": reason})
    return pay


# ═══ JDA ════════════════════════════════════════════════════════════════════════════════════

async def jda_validate(ctx: Ctx, data: dict[str, Any], obj: Optional[L.ReJda] = None) -> None:
    def val(k: str):
        return data.get(k, getattr(obj, k, None))

    model = val("model")
    share = D(val("landowner_share_percent"))
    if not 0 <= share <= 100:
        raise HTTPException(status_code=422, detail="landowner_share_percent must be between 0 and 100")
    if model in ("area_share", "revenue_share", "mixed") and share <= 0 and D(val("landowner_area_sqft")) <= 0:
        raise HTTPException(status_code=422, detail="Give the landowner's share % (or a fixed area entitlement)")
    if model == "fixed_consideration" and D(val("fixed_consideration")) <= 0:
        raise HTTPException(status_code=422, detail="fixed_consideration is required for this JDA model")
    parcel_id = val("parcel_id")
    if parcel_id and share > 0:
        q = select(func.coalesce(func.sum(L.ReJda.landowner_share_percent), 0)).where(
            L.ReJda.parcel_id == parcel_id, L.ReJda.status.in_(("draft", "active")))
        if obj is not None:
            q = q.where(L.ReJda.id != obj.id)
        existing = D((await ctx.db.execute(q)).scalar_one())
        if existing + share > 100 + EPS:
            raise HTTPException(status_code=409, detail=f"Landowner shares on this parcel would reach {existing + share:g}%")
    if val("landowner_id") and parcel_id:
        owner = await ctx.db.get(L.ReLandowner, val("landowner_id"))
        if owner is None or owner.parcel_id != parcel_id:
            raise HTTPException(status_code=422, detail="The landowner does not belong to this parcel")


async def jda_activate(ctx: Ctx, jda: L.ReJda, signing_date: Optional[date]) -> L.ReJda:
    if jda.status != "draft":
        raise HTTPException(status_code=409, detail=f"JDA is {jda.status}")
    jda.status = "active"
    jda.signing_date = signing_date or date.today()
    parcel = await ctx.db.get(L.ReLandParcel, jda.parcel_id)
    if parcel is not None and parcel.status in ("identified", "under_negotiation", "title_check", "acquired"):
        parcel.status = "under_jda"
    await audit(ctx, "jda", jda.id, "activate", ref=jda.jda_no)
    return jda


async def _jda_units(ctx: Ctx, jda: L.ReJda):
    return list((await ctx.db.execute(
        select(C.ReUnit).where(C.ReUnit.vendor_id == ctx.vendor_id, C.ReUnit.jda_id == jda.id).order_by(C.ReUnit.unit_number)
    )).scalars().all())


def _unit_area(u: C.ReUnit) -> Decimal:
    return D(u.super_area) or D(u.built_up_area) or D(u.carpet_area)


async def jda_allocate_units(ctx: Ctx, jda: L.ReJda, unit_numbers: list[str]) -> dict:
    if jda.status != "active":
        raise HTTPException(status_code=409, detail="Units can be allocated only under an active JDA")
    if not jda.project_id:
        raise HTTPException(status_code=409, detail="Link the JDA to a project first")
    wanted = [n.strip() for n in unit_numbers if n.strip()]
    if not wanted:
        raise HTTPException(status_code=422, detail="Give at least one unit number")
    units = (await ctx.db.execute(
        select(C.ReUnit).where(C.ReUnit.vendor_id == ctx.vendor_id, C.ReUnit.project_id == jda.project_id,
                               C.ReUnit.unit_number.in_(wanted))
    )).scalars().all()
    found = {u.unit_number: u for u in units}
    missing = [n for n in wanted if n not in found]
    if missing:
        raise HTTPException(status_code=404, detail=f"Units not found in the project: {', '.join(missing)}")
    done, skipped = [], []
    for n in wanted:
        u = found[n]
        if u.status != "available":
            skipped.append({"unit": n, "reason": f"unit is {u.status}"})
            continue
        u.is_landowner_share = True
        u.jda_id = jda.id
        u.status = "landowner_share"
        done.append(n)
    await ctx.db.flush()
    await audit(ctx, "jda", jda.id, "allocate_units", ref=jda.jda_no, changes={"units": done})
    return {"allocated": done, "skipped": skipped}


async def jda_release_units(ctx: Ctx, jda: L.ReJda, unit_numbers: list[str]) -> dict:
    wanted = [n.strip() for n in unit_numbers if n.strip()]
    released = []
    for u in await _jda_units(ctx, jda):
        if u.unit_number in wanted and u.status == "landowner_share":
            u.is_landowner_share = False
            u.jda_id = None
            u.status = "available"
            released.append(u.unit_number)
    await ctx.db.flush()
    if not released:
        raise HTTPException(status_code=409, detail="None of those units are allocated to the landowner under this JDA")
    await audit(ctx, "jda", jda.id, "release_units", ref=jda.jda_no, changes={"units": released})
    return {"released": released}


async def jda_share_report(ctx: Ctx, jda: L.ReJda) -> dict:
    """Landowner entitlement vs units actually allocated (area share model)."""
    parcel = await ctx.db.get(L.ReLandParcel, jda.parcel_id)
    units: list[C.ReUnit] = []
    project_units: list[C.ReUnit] = []
    if jda.project_id:
        project_units = list((await ctx.db.execute(
            select(C.ReUnit).where(C.ReUnit.vendor_id == ctx.vendor_id, C.ReUnit.project_id == jda.project_id))).scalars().all())
    # units of this JDA, plus every landowner unit in the project for the total picture
    units = [u for u in project_units if u.jda_id == jda.id]
    total_area = sum((_unit_area(u) for u in project_units), Decimal(0))
    if D(jda.landowner_area_sqft) > 0:
        entitlement = D(jda.landowner_area_sqft)
    else:
        entitlement = money_q(total_area * D(jda.landowner_share_percent) / 100)
    allocated = sum((_unit_area(u) for u in units), Decimal(0))
    value = sum((D(u.total_price) for u in units), Decimal(0))
    return {
        "jda_no": jda.jda_no, "model": jda.model, "parcel": parcel.name if parcel else None,
        "landowner_share_percent": _f(jda.landowner_share_percent), "project_total_area_sqft": _f(total_area),
        "entitlement_area_sqft": _f(entitlement), "allocated_area_sqft": _f(allocated),
        "shortfall_sqft": _f(max(Decimal(0), entitlement - allocated)), "excess_sqft": _f(max(Decimal(0), allocated - entitlement)),
        "allocated_value": _f(value),
        "balanced": abs(entitlement - allocated) <= max(D(total_area) * Decimal("0.005"), Decimal(1)),
        "units": [{"unit_number": u.unit_number, "area_sqft": _f(_unit_area(u)), "price": _f(u.total_price), "status": u.status} for u in units],
        "note": "Allocation tolerance is 0.5% of the project's saleable area." if jda.model != "revenue_share"
        else "Revenue-share JDAs settle in cash; allocated units are shown for reference only.",
    }


# ═══ statutory approvals ════════════════════════════════════════════════════════════════════

REQUIRED_FOR_LAUNCH = ("rera_registration", "building_plan", "commencement_certificate")
REQUIRED_BEFORE_HANDOVER = ("occupancy_certificate",)


def approval_state(a: L.ReStatutoryApproval, today: Optional[date] = None) -> str:
    """Effective state: an 'approved' item past its validity is expired; one inside its reminder window is renewal_due."""
    today = today or date.today()
    if a.status == "approved" and a.valid_until:
        if a.valid_until < today:
            return "expired"
        if a.valid_until <= today + timedelta(days=int(a.renewal_reminder_days or 60)):
            return "renewal_due"
    return a.status


async def approval_validate(ctx: Ctx, data: dict[str, Any], obj: Optional[L.ReStatutoryApproval] = None) -> None:
    def val(k: str):
        return data.get(k, getattr(obj, k, None))

    if not val("project_id") and not val("parcel_id"):
        raise HTTPException(status_code=422, detail="Link the approval to a project or a land parcel")
    if val("status") == "approved":
        if not val("approved_on"):
            data["approved_on"] = date.today()
        if val("valid_until") and val("valid_until") < (data.get("approved_on") or val("approved_on")):
            raise HTTPException(status_code=422, detail="valid_until cannot be before the approval date")
    if val("applied_on") and val("approved_on") and val("approved_on") < val("applied_on"):
        raise HTTPException(status_code=422, detail="approved_on cannot be before applied_on")


async def approvals_tracker(db: AsyncSession, vendor_id: UUID, project_id: Optional[UUID] = None) -> dict:
    pq = select(C.ReProject).where(C.ReProject.vendor_id == vendor_id)
    if project_id:
        pq = pq.where(C.ReProject.id == project_id)
    projects = (await db.execute(pq.order_by(C.ReProject.name))).scalars().all()
    rows = []
    for p in projects:
        items = (await db.execute(select(L.ReStatutoryApproval).where(
            L.ReStatutoryApproval.vendor_id == vendor_id, L.ReStatutoryApproval.project_id == p.id))).scalars().all()
        by_type: dict[str, str] = {}
        for a in items:
            st = approval_state(a)
            # the best state per type wins (a renewed approval supersedes an expired one)
            rank = {"approved": 5, "renewal_due": 4, "under_review": 3, "applied": 2, "not_applied": 1, "rejected": 0, "expired": 0}
            if a.approval_type not in by_type or rank.get(st, 0) > rank.get(by_type[a.approval_type], 0):
                by_type[a.approval_type] = st
        launch_ready = all(by_type.get(t) in ("approved", "renewal_due") for t in REQUIRED_FOR_LAUNCH)
        missing = [t for t in REQUIRED_FOR_LAUNCH if by_type.get(t) not in ("approved", "renewal_due")]
        rows.append({
            "project_id": str(p.id), "project": p.name, "approvals": by_type, "launch_ready": launch_ready,
            "missing_for_launch": missing,
            "expiring": sum(1 for s in by_type.values() if s in ("renewal_due", "expired")),
        })
    return {"required_for_launch": list(REQUIRED_FOR_LAUNCH), "projects": rows}


# ═══ dashboard ══════════════════════════════════════════════════════════════════════════════

async def land_summary(db: AsyncSession, vendor_id: UUID) -> dict:
    parcels = (await db.execute(select(L.ReLandParcel).where(L.ReLandParcel.vendor_id == vendor_id))).scalars().all()
    acqs = (await db.execute(select(L.ReAcquisition).where(L.ReAcquisition.vendor_id == vendor_id, L.ReAcquisition.status != "cancelled"))).scalars().all()
    by_status: dict[str, dict[str, Any]] = defaultdict(lambda: {"count": 0, "area_sqft": Decimal(0), "asking_price": Decimal(0)})
    for p in parcels:
        s = by_status[p.status]
        s["count"] += 1
        s["area_sqft"] += D(p.area_sqft)
        s["asking_price"] += D(p.asking_price)
    cost = sum((total_cost_of(a) for a in acqs), Decimal(0))
    paid = sum((D(a.paid_amount) for a in acqs), Decimal(0))
    open_titles = (await db.execute(select(func.count()).select_from(L.ReTitleCheck).where(
        L.ReTitleCheck.vendor_id == vendor_id, L.ReTitleCheck.status.in_(("pending", "in_progress", "issues_found"))))).scalar_one()
    approvals = (await db.execute(select(L.ReStatutoryApproval).where(L.ReStatutoryApproval.vendor_id == vendor_id))).scalars().all()
    states = defaultdict(int)
    for a in approvals:
        states[approval_state(a)] += 1
    return {
        "parcels": len(parcels), "total_area_sqft": _f(sum((D(p.area_sqft) for p in parcels), Decimal(0))),
        "by_status": {k: {"count": v["count"], "area_sqft": _f(v["area_sqft"]), "asking_price": _f(v["asking_price"])} for k, v in by_status.items()},
        "acquisitions": {"count": len(acqs), "total_cost": _f(cost), "paid": _f(paid), "outstanding": _f(max(Decimal(0), cost - paid))},
        "open_title_checks": open_titles, "approvals": dict(states),
    }
