"""Workflow endpoints — Phase 4c: contractors, RA bills, retention and payables."""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.models.realestate import contractors as K
from app.services.realestate import contracting as ct
from app.services.realestate.common import Ctx, get_owned, jsonable

from .ctx import ctx_dep

router = APIRouter()

view = ctx_dep("realestate.view")
build = ctx_dep("realestate.construction")


class _Reason(BaseModel):
    reason: str = ""


async def _sc(ctx: Ctx, sc_id: uuid.UUID) -> K.ReSubcontract:
    return await get_owned(ctx.db, K.ReSubcontract, ctx.vendor_id, sc_id, "subcontract")


async def _cert(ctx: Ctx, cert_id: uuid.UUID) -> K.ReWorkCertificate:
    return await get_owned(ctx.db, K.ReWorkCertificate, ctx.vendor_id, cert_id, "work certificate")


@router.get("/payables/summary", summary="Everything owed to suppliers, contractors and brokers")
async def payables(ctx: Ctx = Depends(view)):
    return await ct.payables_summary(ctx.db, ctx.vendor_id)


@router.post("/subcontracts/{sc_id}/activate")
async def sc_activate(sc_id: uuid.UUID, ctx: Ctx = Depends(build)):
    sc = await ct.sc_activate(ctx, await _sc(ctx, sc_id))
    await ctx.db.commit()
    return {"message": f"{sc.sc_no} is active"}


@router.post("/subcontracts/{sc_id}/complete")
async def sc_complete(sc_id: uuid.UUID, ctx: Ctx = Depends(build)):
    sc = await ct.sc_close(ctx, await _sc(ctx, sc_id), False)
    await ctx.db.commit()
    return {"message": f"{sc.sc_no} completed — retention can now be released"}


@router.post("/subcontracts/{sc_id}/terminate")
async def sc_terminate(sc_id: uuid.UUID, body: _Reason, ctx: Ctx = Depends(build)):
    sc = await ct.sc_close(ctx, await _sc(ctx, sc_id), True, body.reason)
    await ctx.db.commit()
    return {"message": f"{sc.sc_no} terminated"}


@router.get("/subcontracts/{sc_id}/retention")
async def sc_retention(sc_id: uuid.UUID, ctx: Ctx = Depends(view)):
    sc = await _sc(ctx, sc_id)
    pos = await ct.retention_position(ctx.db, sc.id)
    return jsonable({"subcontract": sc.sc_no, "retention_percent": sc.retention_percent, **pos})


class ReleaseIn(BaseModel):
    amount: Decimal = Field(..., gt=0)
    remarks: Optional[str] = None


@router.post("/subcontracts/{sc_id}/release-retention")
async def sc_release(sc_id: uuid.UUID, body: ReleaseIn, ctx: Ctx = Depends(build)):
    sc = await _sc(ctx, sc_id)
    entry = await ct.release_retention(ctx, sc, body.amount, body.remarks)
    await ctx.db.commit()
    return {"message": f"₹{float(entry.amount):,.2f} retention released", "entry_id": str(entry.id)}


@router.post("/work-certificates/{cert_id}/submit")
async def cert_submit(cert_id: uuid.UUID, ctx: Ctx = Depends(build)):
    cert = await ct.cert_submit(ctx, await _cert(ctx, cert_id))
    await ctx.db.commit()
    return {"message": f"{cert.cert_no} is {cert.status.replace('_', ' ')}", "status": cert.status}


class PayIn(BaseModel):
    mode: str = "neft"
    reference: Optional[str] = None
    paid_on: Optional[date] = None


@router.post("/work-certificates/{cert_id}/pay")
async def cert_pay(cert_id: uuid.UUID, body: PayIn, ctx: Ctx = Depends(build)):
    cert = await ct.cert_pay(ctx, await _cert(ctx, cert_id), mode=body.mode, reference=body.reference, paid_on=body.paid_on)
    await ctx.db.commit()
    return {"message": f"{cert.cert_no} marked paid"}


@router.post("/work-certificates/{cert_id}/cancel")
async def cert_cancel(cert_id: uuid.UUID, body: _Reason, ctx: Ctx = Depends(build)):
    cert = await ct.cert_cancel(ctx, await _cert(ctx, cert_id), body.reason)
    await ctx.db.commit()
    return {"message": f"{cert.cert_no} cancelled"}
