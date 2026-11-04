"""Workflow endpoints — Phase 2: collections, tax & compliance, broker management."""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.models.realestate import core as C
from app.models.realestate import receivables as R
from app.services.realestate import commissions as com
from app.services.realestate import payments as pay
from app.services.realestate import tax
from app.services.realestate.common import Ctx, D, audit, get_owned
from .crud import serialize
from .ctx import ctx_dep

router = APIRouter()

view = ctx_dep("realestate.view")
collect = ctx_dep("realestate.collections")
approve_dep = ctx_dep("realestate.approve")
manage = ctx_dep("realestate.manage")


class _Reason(BaseModel):
    reason: str = ""


# ═══ schedule & demands ═════════════════════════════════════════════════════════════════════

class RegenerateIn(BaseModel):
    payment_plan_id: Optional[uuid.UUID] = None


@router.post("/bookings/{booking_id}/schedule/regenerate", summary="Rebuild the instalment schedule from the payment plan")
async def regenerate_schedule(booking_id: uuid.UUID, body: RegenerateIn, ctx: Ctx = Depends(collect)):
    b = await get_owned(ctx.db, C.ReBooking, ctx.vendor_id, booking_id, "booking")
    if b.status not in pay.ACTIVE_BOOKING:
        raise HTTPException(status_code=409, detail=f"Booking is {b.status}")
    if body.payment_plan_id:
        await get_owned(ctx.db, C.RePaymentPlan, ctx.vendor_id, body.payment_plan_id, "payment plan")
    items = await pay.generate_schedule(ctx, b, body.payment_plan_id)
    await ctx.db.commit()
    return {"message": f"Schedule rebuilt with {len(items)} instalment(s)"}


@router.post("/payment-schedule/{item_id}/demand", summary="Raise the demand for an instalment")
async def demand_item(item_id: uuid.UUID, ctx: Ctx = Depends(collect)):
    item = await get_owned(ctx.db, R.ReScheduleItem, ctx.vendor_id, item_id, "instalment")
    b = await get_owned(ctx.db, C.ReBooking, ctx.vendor_id, item.booking_id, "booking")
    d = await pay.create_demand(ctx, b, item)
    await ctx.db.commit()
    return {"message": f"Demand {d.demand_no} issued", "id": str(d.id)}


class GenerateDemandsIn(BaseModel):
    project_id: Optional[uuid.UUID] = None
    as_of: Optional[date] = None
    advance_days: int = Field(0, ge=0, le=90)


@router.post("/collections/generate-demands", summary="Raise demand letters for every instalment that has fallen due")
async def generate_demands(body: GenerateDemandsIn, ctx: Ctx = Depends(collect)):
    if body.project_id:
        await get_owned(ctx.db, C.ReProject, ctx.vendor_id, body.project_id, "project")
    res = await pay.generate_demands(ctx, project_id=body.project_id, as_of=body.as_of, advance_days=body.advance_days)
    await ctx.db.commit()
    return {"message": f"{len(res['created'])} demand(s) issued, {len(res['skipped'])} skipped", **res}


@router.post("/bookings/{booking_id}/raise-demands", summary="Raise due demands for one booking")
async def booking_raise_demands(booking_id: uuid.UUID, ctx: Ctx = Depends(collect)):
    b = await get_owned(ctx.db, C.ReBooking, ctx.vendor_id, booking_id, "booking")
    res = await pay.generate_demands(ctx, booking_id=b.id)
    await ctx.db.commit()
    msg = f"{len(res['created'])} demand(s) issued"
    if res["skipped"]:
        msg += f"; skipped: {res['skipped'][0]['reason']}"
    return {"message": msg, **res}


@router.get("/demands/{demand_id}/letter")
async def demand_letter(demand_id: uuid.UUID, ctx: Ctx = Depends(view)):
    d = await get_owned(ctx.db, R.ReDemand, ctx.vendor_id, demand_id, "demand")
    return {"html": d.letter_html or "<p>No letter generated.</p>", "subject": d.demand_no}


@router.post("/demands/{demand_id}/cancel")
async def cancel_demand(demand_id: uuid.UUID, body: _Reason, ctx: Ctx = Depends(collect)):
    d = await get_owned(ctx.db, R.ReDemand, ctx.vendor_id, demand_id, "demand")
    await pay.cancel_demand(ctx, d, body.reason)
    await ctx.db.commit()
    return {"message": f"Demand {d.demand_no} cancelled"}


class MilestoneIn(BaseModel):
    milestone_name: str = Field(..., min_length=1)


@router.post("/projects/{project_id}/trigger-milestone", summary="Construction milestone reached — bill every booking waiting on it")
async def trigger_milestone(project_id: uuid.UUID, body: MilestoneIn, ctx: Ctx = Depends(collect)):
    await get_owned(ctx.db, C.ReProject, ctx.vendor_id, project_id, "project")
    res = await pay.trigger_milestone(ctx, project_id, body.milestone_name)
    await audit(ctx, "project", project_id, "milestone", changes={"milestone": body.milestone_name, **{k: v for k, v in res.items() if k != "skipped"}})
    await ctx.db.commit()
    return {"message": f"{res['instalments_triggered']} instalment(s) triggered, {res['demands_created']} demand(s) issued", **res}


# ═══ receipts ═══════════════════════════════════════════════════════════════════════════════

class ReceiptIn(BaseModel):
    booking_id: uuid.UUID
    amount: Decimal
    mode: str = "neft"
    receipt_date: Optional[date] = None
    reference_no: Optional[str] = None
    bank_name: Optional[str] = None
    instrument_date: Optional[date] = None
    tds_amount: Decimal = Decimal(0)
    remarks: Optional[str] = None


async def _receive(ctx: Ctx, booking, body: ReceiptIn) -> dict:
    receipt, warnings = await pay.record_receipt(
        ctx, booking, amount=body.amount, mode=body.mode, receipt_date=body.receipt_date, reference_no=body.reference_no,
        bank_name=body.bank_name, instrument_date=body.instrument_date, tds_amount=body.tds_amount, remarks=body.remarks,
    )
    await ctx.db.commit()
    await ctx.db.refresh(receipt)
    out = serialize(receipt)
    out["warnings"] = warnings
    out["message"] = f"Receipt {receipt.receipt_no} recorded" + (" — awaiting bank clearance" if receipt.status == "received" else "")
    return out


@router.post("/receipts", status_code=201, summary="Record a payment received from a customer")
async def create_receipt(body: ReceiptIn, ctx: Ctx = Depends(collect)):
    b = await get_owned(ctx.db, C.ReBooking, ctx.vendor_id, body.booking_id, "booking")
    return await _receive(ctx, b, body)


class ReceiveIn(BaseModel):
    amount: Decimal
    mode: str = "neft"
    receipt_date: Optional[date] = None
    reference_no: Optional[str] = None
    bank_name: Optional[str] = None
    instrument_date: Optional[date] = None
    tds_amount: Decimal = Decimal(0)
    remarks: Optional[str] = None


@router.post("/bookings/{booking_id}/receive", status_code=201, summary="Record a payment against a booking")
async def booking_receive(booking_id: uuid.UUID, body: ReceiveIn, ctx: Ctx = Depends(collect)):
    b = await get_owned(ctx.db, C.ReBooking, ctx.vendor_id, booking_id, "booking")
    return await _receive(ctx, b, ReceiptIn(booking_id=b.id, **body.model_dump()))


@router.get("/bookings/{booking_id}/finance", summary="Schedule, demands, receipts and outstanding for one booking")
async def booking_finance(booking_id: uuid.UUID, ctx: Ctx = Depends(view)):
    b = await get_owned(ctx.db, C.ReBooking, ctx.vendor_id, booking_id, "booking")
    return await pay.booking_finance_summary(ctx.db, b)


@router.get("/bookings/{booking_id}/tds-suggestion", summary="TDS u/s 194-IA to deduct on a payment")
async def booking_tds(booking_id: uuid.UUID, amount: Decimal = Query(..., gt=0), ctx: Ctx = Depends(view)):
    b = await get_owned(ctx.db, C.ReBooking, ctx.vendor_id, booking_id, "booking")
    tds = pay.tds_suggestion(b, amount)
    return {
        "agreement_value": float(D(b.agreement_value)), "payment": float(amount), "tds_percent": float(pay.TDS_194IA_RATE),
        "tds_amount": float(tds), "net_to_developer": float(D(amount) - tds),
        "applicable": D(b.agreement_value) >= pay.TDS_194IA_THRESHOLD,
    }


class ClearIn(BaseModel):
    cleared_on: Optional[date] = None


@router.post("/receipts/{receipt_id}/clear")
async def clear_receipt(receipt_id: uuid.UUID, body: ClearIn, ctx: Ctx = Depends(collect)):
    r = await get_owned(ctx.db, R.ReReceipt, ctx.vendor_id, receipt_id, "receipt")
    await pay.clear_receipt(ctx, r, body.cleared_on)
    await ctx.db.commit()
    return {"message": f"Receipt {r.receipt_no} cleared"}


@router.post("/receipts/{receipt_id}/bounce")
async def bounce_receipt(receipt_id: uuid.UUID, body: _Reason, ctx: Ctx = Depends(collect)):
    if not body.reason.strip():
        raise HTTPException(status_code=422, detail="reason is required")
    r = await get_owned(ctx.db, R.ReReceipt, ctx.vendor_id, receipt_id, "receipt")
    await pay.bounce_receipt(ctx, r, body.reason.strip())
    await ctx.db.commit()
    return {"message": f"Receipt {r.receipt_no} marked bounced"}


@router.post("/receipts/{receipt_id}/cancel")
async def cancel_receipt(receipt_id: uuid.UUID, body: _Reason, ctx: Ctx = Depends(collect)):
    r = await get_owned(ctx.db, R.ReReceipt, ctx.vendor_id, receipt_id, "receipt")
    await pay.cancel_receipt(ctx, r, body.reason.strip())
    await ctx.db.commit()
    return {"message": f"Receipt {r.receipt_no} cancelled"}


@router.get("/receipts/{receipt_id}/letter")
async def receipt_letter(receipt_id: uuid.UUID, ctx: Ctx = Depends(view)):
    r = await get_owned(ctx.db, R.ReReceipt, ctx.vendor_id, receipt_id, "receipt")
    return await pay.receipt_letter(ctx.db, ctx.vendor_id, r)


# ═══ collection reports ═════════════════════════════════════════════════════════════════════

@router.get("/collections/overdue", summary="Overdue demands with ageing buckets and delay interest")
async def overdue(project_id: Optional[uuid.UUID] = None, as_of: Optional[date] = None, ctx: Ctx = Depends(view)):
    return await pay.overdue_report(ctx.db, ctx.vendor_id, project_id=project_id, as_of=as_of)


@router.get("/collections/summary", summary="Collection performance per project and month")
async def collections_summary(project_id: Optional[uuid.UUID] = None, ctx: Ctx = Depends(view)):
    return await pay.collection_summary(ctx.db, ctx.vendor_id, project_id=project_id)


@router.get("/collections/receivables-ageing", summary="Receivables ageing by customer")
async def receivables(as_of: Optional[date] = None, ctx: Ctx = Depends(view)):
    return await pay.receivables_ageing(ctx.db, ctx.vendor_id, as_of=as_of)


# ═══ tax & compliance ═══════════════════════════════════════════════════════════════════════

@router.get("/tax/gst-summary")
async def gst_summary(date_from: Optional[date] = None, date_to: Optional[date] = None,
                      project_id: Optional[uuid.UUID] = None, ctx: Ctx = Depends(view)):
    return await tax.gst_summary(ctx.db, ctx.vendor_id, date_from=date_from, date_to=date_to, project_id=project_id)


@router.get("/tax/reconciliation")
async def reconciliation(date_from: Optional[date] = None, date_to: Optional[date] = None, ctx: Ctx = Depends(view)):
    return await tax.tax_reconciliation(ctx.db, ctx.vendor_id, date_from=date_from, date_to=date_to)


@router.get("/tax/rera-account")
async def rera_account(project_id: Optional[uuid.UUID] = None, ctx: Ctx = Depends(view)):
    return await tax.rera_account(ctx.db, ctx.vendor_id, project_id)


class DepositIn(BaseModel):
    challan_no: str = Field(..., min_length=1)
    challan_date: Optional[date] = None
    ack_no: Optional[str] = None


@router.post("/tds-entries/{entry_id}/deposit")
async def tds_deposit(entry_id: uuid.UUID, body: DepositIn, ctx: Ctx = Depends(collect)):
    e = await get_owned(ctx.db, R.ReTdsEntry, ctx.vendor_id, entry_id, "TDS entry")
    await tax.mark_tds_deposited(ctx, e, challan_no=body.challan_no, challan_date=body.challan_date, ack_no=body.ack_no)
    await ctx.db.commit()
    return {"message": "TDS deposit recorded"}


class CertificateIn(BaseModel):
    certificate_no: str = Field(..., min_length=1)
    certificate_date: Optional[date] = None


@router.post("/tds-entries/{entry_id}/certificate")
async def tds_certificate(entry_id: uuid.UUID, body: CertificateIn, ctx: Ctx = Depends(collect)):
    e = await get_owned(ctx.db, R.ReTdsEntry, ctx.vendor_id, entry_id, "TDS entry")
    await tax.mark_tds_certificate(ctx, e, certificate_no=body.certificate_no, certificate_date=body.certificate_date)
    await ctx.db.commit()
    return {"message": "Form 16B recorded"}


class RemarksIn(BaseModel):
    remarks: Optional[str] = None


@router.post("/rera-entries/{entry_id}/approve")
async def rera_approve(entry_id: uuid.UUID, body: RemarksIn, ctx: Ctx = Depends(approve_dep)):
    e = await get_owned(ctx.db, R.ReReraEntry, ctx.vendor_id, entry_id, "RERA entry")
    await tax.decide_rera_entry(ctx, e, True, body.remarks)
    await ctx.db.commit()
    return {"message": "RERA entry approved"}


@router.post("/rera-entries/{entry_id}/reject")
async def rera_reject(entry_id: uuid.UUID, body: RemarksIn, ctx: Ctx = Depends(approve_dep)):
    e = await get_owned(ctx.db, R.ReReraEntry, ctx.vendor_id, entry_id, "RERA entry")
    await tax.decide_rera_entry(ctx, e, False, body.remarks)
    await ctx.db.commit()
    return {"message": "RERA entry rejected"}


# ═══ brokers ════════════════════════════════════════════════════════════════════════════════

@router.get("/brokers/{broker_id}/statement", summary="Commission statement")
async def broker_statement(broker_id: uuid.UUID, ctx: Ctx = Depends(view)):
    b = await get_owned(ctx.db, C.ReBroker, ctx.vendor_id, broker_id, "broker")
    return await com.broker_statement(ctx.db, ctx.vendor_id, b)


class SettleIn(BaseModel):
    commission_ids: Optional[list[uuid.UUID]] = None
    include_incentives: bool = True
    mode: str = "neft"
    remarks: Optional[str] = None
    settlement_date: Optional[date] = None


@router.post("/brokers/{broker_id}/settle", status_code=201, summary="Settle eligible commission and incentives")
async def broker_settle(broker_id: uuid.UUID, body: SettleIn, ctx: Ctx = Depends(collect)):
    if body.mode not in C.PAYMENT_MODES:
        raise HTTPException(status_code=422, detail=f"mode must be one of {', '.join(C.PAYMENT_MODES)}")
    s = await com.create_settlement(
        ctx, broker_id, commission_ids=body.commission_ids, include_incentives=body.include_incentives,
        mode=body.mode, remarks=body.remarks, settlement_date=body.settlement_date,
    )
    await ctx.db.commit()
    await ctx.db.refresh(s)
    out = serialize(s)
    out["message"] = f"Settlement {s.settlement_no} created" + (" — awaiting approval" if s.status == "pending_approval" else "")
    return out


class PayIn(BaseModel):
    mode: str = "neft"
    reference_no: Optional[str] = None
    paid_on: Optional[date] = None


@router.post("/settlements/{settlement_id}/pay")
async def settlement_pay(settlement_id: uuid.UUID, body: PayIn, ctx: Ctx = Depends(collect)):
    s = await get_owned(ctx.db, R.ReSettlement, ctx.vendor_id, settlement_id, "settlement")
    await com.pay_settlement(ctx, s, mode=body.mode, reference_no=body.reference_no, paid_on=body.paid_on)
    await ctx.db.commit()
    return {"message": f"Settlement {s.settlement_no} paid"}


@router.post("/settlements/{settlement_id}/cancel")
async def settlement_cancel(settlement_id: uuid.UUID, body: _Reason, ctx: Ctx = Depends(collect)):
    s = await get_owned(ctx.db, R.ReSettlement, ctx.vendor_id, settlement_id, "settlement")
    await com.cancel_settlement(ctx, s, body.reason)
    await ctx.db.commit()
    return {"message": f"Settlement {s.settlement_no} cancelled"}


@router.post("/incentives/{incentive_id}/approve")
async def incentive_approve(incentive_id: uuid.UUID, ctx: Ctx = Depends(approve_dep)):
    i = await get_owned(ctx.db, R.ReIncentive, ctx.vendor_id, incentive_id, "incentive")
    if i.status != "proposed":
        raise HTTPException(status_code=409, detail=f"Incentive is {i.status}")
    i.status = "approved"
    await audit(ctx, "incentive", i.id, "approve", ref=i.scheme_name)
    await ctx.db.commit()
    return {"message": "Incentive approved"}


@router.post("/incentives/{incentive_id}/reject")
async def incentive_reject(incentive_id: uuid.UUID, ctx: Ctx = Depends(approve_dep)):
    i = await get_owned(ctx.db, R.ReIncentive, ctx.vendor_id, incentive_id, "incentive")
    if i.status != "proposed":
        raise HTTPException(status_code=409, detail=f"Incentive is {i.status}")
    i.status = "rejected"
    await audit(ctx, "incentive", i.id, "reject", ref=i.scheme_name)
    await ctx.db.commit()
    return {"message": "Incentive rejected"}
