"""Workflow endpoints — Phase 3: land acquisition, JDA, statutory approvals."""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.models.realestate import land as L
from app.services.realestate import land as svc
from app.services.realestate.common import Ctx, audit, get_owned

from .ctx import ctx_dep

router = APIRouter()

view = ctx_dep("realestate.view")
manage = ctx_dep("realestate.manage")
legal = ctx_dep("realestate.legal")


class _Reason(BaseModel):
    reason: str = ""


# ═══ parcels ════════════════════════════════════════════════════════════════════════════════

@router.get("/land-parcels/{parcel_id}/clearance", summary="Is the title clear enough to register the deed?")
async def parcel_clearance(parcel_id: uuid.UUID, ctx: Ctx = Depends(view)):
    await get_owned(ctx.db, L.ReLandParcel, ctx.vendor_id, parcel_id, "parcel")
    return await svc.title_clearance(ctx.db, parcel_id)


@router.post("/land-parcels/{parcel_id}/reject")
async def parcel_reject(parcel_id: uuid.UUID, body: _Reason, ctx: Ctx = Depends(manage)):
    p = await get_owned(ctx.db, L.ReLandParcel, ctx.vendor_id, parcel_id, "parcel")
    if p.status not in ("identified", "under_negotiation", "title_check"):
        raise HTTPException(status_code=409, detail=f"Parcel is {p.status}")
    p.status = "rejected"
    await audit(ctx, "land_parcel", p.id, "reject", ref=p.code, changes={"reason": body.reason})
    await ctx.db.commit()
    return {"message": f"{p.code} rejected"}


@router.post("/land-parcels/{parcel_id}/reopen")
async def parcel_reopen(parcel_id: uuid.UUID, ctx: Ctx = Depends(manage)):
    p = await get_owned(ctx.db, L.ReLandParcel, ctx.vendor_id, parcel_id, "parcel")
    if p.status != "rejected":
        raise HTTPException(status_code=409, detail=f"Parcel is {p.status}")
    p.status = "identified"
    await audit(ctx, "land_parcel", p.id, "reopen", ref=p.code)
    await ctx.db.commit()
    return {"message": f"{p.code} reopened"}


@router.get("/land/summary", summary="Land bank overview")
async def land_summary(ctx: Ctx = Depends(view)):
    return await svc.land_summary(ctx.db, ctx.vendor_id)


# ═══ acquisitions ═══════════════════════════════════════════════════════════════════════════

class SignIn(BaseModel):
    signed_on: Optional[date] = None


class RegisterIn(BaseModel):
    registration_no: str = Field(..., min_length=1)
    registration_date: Optional[date] = None
    sub_registrar_office: Optional[str] = None
    stamp_duty: Optional[Decimal] = None
    registration_fee: Optional[Decimal] = None


class CompleteIn(BaseModel):
    possession_date: Optional[date] = None


async def _acq(ctx: Ctx, acq_id: uuid.UUID) -> L.ReAcquisition:
    return await get_owned(ctx.db, L.ReAcquisition, ctx.vendor_id, acq_id, "acquisition")


@router.post("/acquisitions/{acq_id}/negotiate")
async def acq_negotiate(acq_id: uuid.UUID, ctx: Ctx = Depends(manage)):
    a = await svc.acquisition_negotiate(ctx, await _acq(ctx, acq_id))
    await ctx.db.commit()
    return {"message": f"{a.acquisition_no} is under negotiation"}


@router.post("/acquisitions/{acq_id}/sign")
async def acq_sign(acq_id: uuid.UUID, body: SignIn, ctx: Ctx = Depends(manage)):
    a = await svc.acquisition_sign(ctx, await _acq(ctx, acq_id), body.signed_on)
    await ctx.db.commit()
    return {"message": f"{a.acquisition_no} agreement signed"}


@router.post("/acquisitions/{acq_id}/register")
async def acq_register(acq_id: uuid.UUID, body: RegisterIn, ctx: Ctx = Depends(manage)):
    a = await svc.acquisition_register(
        ctx, await _acq(ctx, acq_id), registration_no=body.registration_no, registration_date=body.registration_date,
        sub_registrar_office=body.sub_registrar_office, stamp_duty=body.stamp_duty, registration_fee=body.registration_fee,
    )
    await ctx.db.commit()
    return {"message": f"{a.acquisition_no} registered as {a.registration_no}"}


@router.post("/acquisitions/{acq_id}/complete")
async def acq_complete(acq_id: uuid.UUID, body: CompleteIn, ctx: Ctx = Depends(manage)):
    a = await svc.acquisition_complete(ctx, await _acq(ctx, acq_id), body.possession_date)
    await ctx.db.commit()
    return {"message": f"{a.acquisition_no} completed — land is in the bank"}


@router.post("/acquisitions/{acq_id}/cancel")
async def acq_cancel(acq_id: uuid.UUID, body: _Reason, ctx: Ctx = Depends(manage)):
    a = await svc.acquisition_cancel(ctx, await _acq(ctx, acq_id), body.reason)
    await ctx.db.commit()
    return {"message": f"{a.acquisition_no} cancelled"}


@router.get("/acquisitions/{acq_id}/tds-suggestion")
async def acq_tds(acq_id: uuid.UUID, amount: Decimal = Query(..., gt=0), ctx: Ctx = Depends(view)):
    return await svc.acquisition_tds(ctx, await _acq(ctx, acq_id), amount)


@router.get("/acquisitions/{acq_id}/clearance")
async def acq_clearance(acq_id: uuid.UUID, ctx: Ctx = Depends(view)):
    a = await _acq(ctx, acq_id)
    return await svc.title_clearance(ctx.db, a.parcel_id)


@router.post("/acquisition-payments/{pay_id}/cancel")
async def acq_payment_cancel(pay_id: uuid.UUID, body: _Reason, ctx: Ctx = Depends(manage)):
    p = await get_owned(ctx.db, L.ReAcquisitionPayment, ctx.vendor_id, pay_id, "payment")
    await svc.payment_cancel(ctx, p, body.reason)
    await ctx.db.commit()
    return {"message": "Payment cancelled"}


# ═══ JDA ════════════════════════════════════════════════════════════════════════════════════

class ActivateIn(BaseModel):
    signing_date: Optional[date] = None


class UnitsIn(BaseModel):
    unit_numbers: str = Field(..., min_length=1)


async def _jda(ctx: Ctx, jda_id: uuid.UUID) -> L.ReJda:
    return await get_owned(ctx.db, L.ReJda, ctx.vendor_id, jda_id, "JDA")


@router.post("/jdas/{jda_id}/activate")
async def jda_activate(jda_id: uuid.UUID, body: ActivateIn, ctx: Ctx = Depends(manage)):
    j = await svc.jda_activate(ctx, await _jda(ctx, jda_id), body.signing_date)
    await ctx.db.commit()
    return {"message": f"{j.jda_no} is active"}


@router.post("/jdas/{jda_id}/allocate-units")
async def jda_allocate(jda_id: uuid.UUID, body: UnitsIn, ctx: Ctx = Depends(manage)):
    res = await svc.jda_allocate_units(ctx, await _jda(ctx, jda_id), body.unit_numbers.split(","))
    await ctx.db.commit()
    msg = f"{len(res['allocated'])} unit(s) allocated to the landowner"
    if res["skipped"]:
        msg += f"; skipped {len(res['skipped'])}: {res['skipped'][0]['reason']}"
    return {"message": msg, **res}


@router.post("/jdas/{jda_id}/release-units")
async def jda_release(jda_id: uuid.UUID, body: UnitsIn, ctx: Ctx = Depends(manage)):
    res = await svc.jda_release_units(ctx, await _jda(ctx, jda_id), body.unit_numbers.split(","))
    await ctx.db.commit()
    return {"message": f"{len(res['released'])} unit(s) released to inventory", **res}


@router.get("/jdas/{jda_id}/share-report")
async def jda_share_report(jda_id: uuid.UUID, ctx: Ctx = Depends(view)):
    return await svc.jda_share_report(ctx, await _jda(ctx, jda_id))


@router.post("/jdas/{jda_id}/complete")
async def jda_complete(jda_id: uuid.UUID, ctx: Ctx = Depends(manage)):
    j = await _jda(ctx, jda_id)
    if j.status != "active":
        raise HTTPException(status_code=409, detail=f"JDA is {j.status}")
    report = await svc.jda_share_report(ctx, j)
    if j.model in ("area_share", "mixed") and not report["balanced"]:
        raise HTTPException(
            status_code=409,
            detail=(f"Landowner entitlement {report['entitlement_area_sqft']:,.0f} sq.ft vs allocated "
                    f"{report['allocated_area_sqft']:,.0f} sq.ft — settle the difference before completing"),
        )
    j.status = "completed"
    await audit(ctx, "jda", j.id, "complete", ref=j.jda_no)
    await ctx.db.commit()
    return {"message": f"{j.jda_no} completed"}


@router.post("/jdas/{jda_id}/terminate")
async def jda_terminate(jda_id: uuid.UUID, body: _Reason, ctx: Ctx = Depends(manage)):
    j = await _jda(ctx, jda_id)
    if j.status not in ("draft", "active"):
        raise HTTPException(status_code=409, detail=f"JDA is {j.status}")
    units = await svc._jda_units(ctx, j)
    if any(u.status != "landowner_share" for u in units):
        raise HTTPException(status_code=409, detail="Some landowner units are already sold or booked; resolve them first")
    for u in units:
        u.status, u.is_landowner_share, u.jda_id = "available", False, None
    j.status = "terminated"
    j.terms = f"{j.terms or ''}\nTerminated: {body.reason}".strip()[:4000]
    await audit(ctx, "jda", j.id, "terminate", ref=j.jda_no, changes={"reason": body.reason})
    await ctx.db.commit()
    return {"message": f"{j.jda_no} terminated; {len(units)} unit(s) returned to inventory"}


# ═══ statutory approvals ════════════════════════════════════════════════════════════════════

class ApproveIn(BaseModel):
    approved_on: Optional[date] = None
    valid_until: Optional[date] = None
    reference_no: Optional[str] = None


class RenewIn(BaseModel):
    valid_until: date
    reference_no: Optional[str] = None


@router.post("/statutory-approvals/{approval_id}/approve")
async def approval_approve(approval_id: uuid.UUID, body: ApproveIn, ctx: Ctx = Depends(legal)):
    a = await get_owned(ctx.db, L.ReStatutoryApproval, ctx.vendor_id, approval_id, "approval")
    if a.status == "approved" and svc.approval_state(a) == "approved":
        raise HTTPException(status_code=409, detail="Already approved")
    approved_on = body.approved_on or date.today()
    if body.valid_until and body.valid_until < approved_on:
        raise HTTPException(status_code=422, detail="valid_until cannot be before the approval date")
    a.status = "approved"
    a.approved_on = approved_on
    if body.valid_until:
        a.valid_until = body.valid_until
    if body.reference_no:
        a.reference_no = body.reference_no
    await audit(ctx, "statutory_approval", a.id, "approve", ref=a.approval_type)
    await ctx.db.commit()
    return {"message": f"{a.approval_type.replace('_', ' ').title()} approved"}


@router.post("/statutory-approvals/{approval_id}/renew")
async def approval_renew(approval_id: uuid.UUID, body: RenewIn, ctx: Ctx = Depends(legal)):
    a = await get_owned(ctx.db, L.ReStatutoryApproval, ctx.vendor_id, approval_id, "approval")
    if a.status not in ("approved", "expired"):
        raise HTTPException(status_code=409, detail=f"Approval is {a.status}")
    if body.valid_until <= (a.valid_until or date.min):
        raise HTTPException(status_code=422, detail="The new validity must be later than the current one")
    old = a.valid_until
    a.status = "approved"
    a.valid_until = body.valid_until
    if body.reference_no:
        a.reference_no = body.reference_no
    await audit(ctx, "statutory_approval", a.id, "renew", ref=a.approval_type, changes={"from": old, "to": body.valid_until})
    await ctx.db.commit()
    return {"message": f"Renewed until {body.valid_until:%d %b %Y}"}


@router.get("/statutory-approvals/tracker", summary="Approval readiness per project")
async def approvals_tracker(project_id: Optional[uuid.UUID] = None, ctx: Ctx = Depends(view)):
    return await svc.approvals_tracker(ctx.db, ctx.vendor_id, project_id)
