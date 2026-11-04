"""Module 12 — subcontracts, running-account (RA) work certificates, retention and contractor payables."""
from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.realestate import contractors as K
from app.models.realestate import core as C
from app.models.realestate import receivables as R
from app.models.realestate import supply as S
from app.models.realestate.admin import ReApprovalRequest

from . import finance_bridge as gl
from .approvals import register_handler, request_approval
from .common import Ctx, D, audit, get_owned, money_q

EPS = Decimal("0.005")
BILLABLE = ("approved", "paid")
OPEN_CERT = ("draft", "pending_approval")


def _f(v: Any) -> float:
    return float(D(v))


# ═══ contractor master ══════════════════════════════════════════════════════════════════════

def default_tds(contractor_type: str) -> Decimal:
    """s.194C: 1% for individuals / HUFs, 2% for everyone else."""
    return Decimal(1) if contractor_type in ("individual", "huf") else Decimal(2)


async def contractor_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    if "tds_percent" not in data:
        data["tds_percent"] = default_tds(data.get("contractor_type", "firm"))
    if data.get("rating") is not None and not 1 <= int(data["rating"]) <= 5:
        raise HTTPException(status_code=422, detail="rating must be between 1 and 5")


# ═══ subcontracts ═══════════════════════════════════════════════════════════════════════════

def contract_ceiling(sc: K.ReSubcontract) -> Decimal:
    return D(sc.contract_value) + D(sc.variation_amount)


async def sc_validate(ctx: Ctx, data: dict[str, Any], obj: Optional[K.ReSubcontract] = None) -> None:
    def val(k: str):
        return data.get(k, getattr(obj, k, None))

    if D(val("contract_value")) <= 0:
        raise HTTPException(status_code=422, detail="contract_value must be greater than zero")
    for k in ("retention_percent", "tds_percent", "gst_percent"):
        if not 0 <= D(val(k)) <= 100:
            raise HTTPException(status_code=422, detail=f"{k} must be between 0 and 100")
    if D(val("advance_amount")) < 0 or D(val("advance_amount")) > D(val("contract_value")):
        raise HTTPException(status_code=422, detail="advance_amount must be between zero and the contract value")
    if val("start_date") and val("end_date") and val("end_date") < val("start_date"):
        raise HTTPException(status_code=422, detail="end_date cannot be before start_date")
    ct = await ctx.db.get(K.ReContractor, val("contractor_id"))
    if ct is None or ct.vendor_id != ctx.vendor_id:
        raise HTTPException(status_code=422, detail="Unknown contractor")
    if ct.status == "blocked":
        raise HTTPException(status_code=409, detail="The contractor is blocked")


async def sc_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    ct = await ctx.db.get(K.ReContractor, data["contractor_id"])
    if ct is not None and "tds_percent" not in data:
        data["tds_percent"] = ct.tds_percent
    await sc_validate(ctx, data)
    data["status"] = "draft"
    data["billed_amount"] = Decimal(0)
    data["advance_recovered"] = Decimal(0)


async def sc_before_update(ctx: Ctx, obj: K.ReSubcontract, data: dict[str, Any]) -> None:
    if obj.status == "draft":
        await sc_validate(ctx, data, obj)
        return
    allowed = {"end_date", "scope", "terms", "variation_amount", "defect_liability_months"}
    bad = set(data) - allowed
    if bad:
        raise HTTPException(status_code=409, detail=f"An active contract only allows changes to: {', '.join(sorted(allowed))}")
    if "variation_amount" in data and D(obj.contract_value) + D(data["variation_amount"]) + EPS < D(obj.billed_amount):
        raise HTTPException(status_code=409, detail="The revised contract value cannot be below the amount already certified")


async def sc_activate(ctx: Ctx, sc: K.ReSubcontract) -> K.ReSubcontract:
    if sc.status != "draft":
        raise HTTPException(status_code=409, detail=f"Subcontract is {sc.status}")
    sc.status = "active"
    await audit(ctx, "subcontract", sc.id, "activate", ref=sc.sc_no)
    return sc


async def sc_close(ctx: Ctx, sc: K.ReSubcontract, terminate: bool, reason: str = "") -> K.ReSubcontract:
    if sc.status != "active":
        raise HTTPException(status_code=409, detail=f"Subcontract is {sc.status}")
    open_certs = (await ctx.db.execute(select(func.count()).select_from(K.ReWorkCertificate).where(
        K.ReWorkCertificate.subcontract_id == sc.id, K.ReWorkCertificate.status.in_(OPEN_CERT)))).scalar_one()
    if open_certs:
        raise HTTPException(status_code=409, detail="Approve or cancel the open work certificates first")
    sc.status = "terminated" if terminate else "completed"
    if terminate and reason:
        sc.terms = f"{sc.terms or ''}\nTerminated: {reason}".strip()[:4000]
    await audit(ctx, "subcontract", sc.id, "terminate" if terminate else "complete", ref=sc.sc_no, changes={"reason": reason})
    return sc


# ═══ work certificates ══════════════════════════════════════════════════════════════════════

async def _previous_cumulative(db: AsyncSession, sc_id: UUID, exclude: Optional[UUID] = None) -> Decimal:
    q = select(func.coalesce(func.max(K.ReWorkCertificate.cumulative_work_done), 0)).where(
        K.ReWorkCertificate.subcontract_id == sc_id, K.ReWorkCertificate.status.in_(BILLABLE))
    if exclude:
        q = q.where(K.ReWorkCertificate.id != exclude)
    return D((await db.execute(q)).scalar_one())


async def cert_compute(ctx: Ctx, data: dict[str, Any], obj: Optional[K.ReWorkCertificate] = None) -> None:
    def val(k: str):
        return data.get(k, getattr(obj, k, None))

    sc = await get_owned(ctx.db, K.ReSubcontract, ctx.vendor_id, val("subcontract_id"), "subcontract")
    if sc.status != "active":
        raise HTTPException(status_code=409, detail=f"Subcontract is {sc.status}; bills can be raised only against an active contract")
    others_open = (await ctx.db.execute(select(func.count()).select_from(K.ReWorkCertificate).where(
        K.ReWorkCertificate.subcontract_id == sc.id, K.ReWorkCertificate.status.in_(OPEN_CERT),
        *( [K.ReWorkCertificate.id != obj.id] if obj is not None else [] )))).scalar_one()
    if others_open:
        raise HTTPException(status_code=409, detail="Another bill for this contract is still open; finish it first")
    cumulative = D(val("cumulative_work_done"))
    previous = await _previous_cumulative(ctx.db, sc.id, obj.id if obj else None)
    if cumulative <= previous + EPS:
        raise HTTPException(status_code=422, detail=f"Cumulative work done (₹{cumulative:,.2f}) must exceed the previous bill (₹{previous:,.2f})")
    if cumulative > contract_ceiling(sc) + EPS:
        raise HTTPException(
            status_code=409,
            detail=f"Cumulative work ₹{cumulative:,.2f} exceeds the contract value ₹{contract_ceiling(sc):,.2f}; record a variation first",
        )
    gross = money_q(cumulative - previous)
    retention = money_q(gross * D(sc.retention_percent) / 100)
    adv_available = D(sc.advance_amount) - D(sc.advance_recovered)
    adv = D(val("advance_recovery"))
    if adv < 0 or adv > adv_available + EPS:
        raise HTTPException(status_code=422, detail=f"advance_recovery must be between zero and the unrecovered advance (₹{max(adv_available, Decimal(0)):,.2f})")
    if adv > gross - retention + EPS:
        raise HTTPException(status_code=422, detail="advance_recovery cannot exceed the bill after retention")
    other = D(val("other_deductions"))
    if other < 0:
        raise HTTPException(status_code=422, detail="other_deductions cannot be negative")
    gst = money_q(gross * D(sc.gst_percent) / 100)
    tds = money_q(gross * D(sc.tds_percent) / 100)
    net = gross + gst - retention - adv - other - tds
    if net < 0:
        raise HTTPException(status_code=422, detail="Deductions exceed the bill value")
    seq = obj.bill_seq if obj is not None else 1 + (await ctx.db.execute(select(func.count()).select_from(K.ReWorkCertificate).where(
        K.ReWorkCertificate.subcontract_id == sc.id, K.ReWorkCertificate.status != "cancelled"))).scalar_one()
    data.update({
        "project_id": sc.project_id, "contractor_id": sc.contractor_id, "previous_cumulative": previous, "gross_amount": gross,
        "retention_amount": retention, "gst_amount": gst, "tds_amount": tds, "net_payable": money_q(net), "bill_seq": seq,
    })


async def cert_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    await cert_compute(ctx, data)
    data["status"] = "draft"


async def cert_before_update(ctx: Ctx, obj: K.ReWorkCertificate, data: dict[str, Any]) -> None:
    if "subcontract_id" in data and data["subcontract_id"] != obj.subcontract_id:
        raise HTTPException(status_code=409, detail="The contract of a bill cannot be changed")
    await cert_compute(ctx, data, obj)


async def cert_submit(ctx: Ctx, cert: K.ReWorkCertificate) -> K.ReWorkCertificate:
    if cert.status != "draft":
        raise HTTPException(status_code=409, detail=f"Bill is {cert.status}")
    sc = await get_owned(ctx.db, K.ReSubcontract, ctx.vendor_id, cert.subcontract_id, "subcontract")
    # recompute against the latest certified position (another bill may have been approved meanwhile)
    data = {"cumulative_work_done": cert.cumulative_work_done, "advance_recovery": cert.advance_recovery,
            "other_deductions": cert.other_deductions, "subcontract_id": sc.id}
    await cert_compute(ctx, data, cert)
    for k, v in data.items():
        setattr(cert, k, v)
    approval = await request_approval(
        ctx, "work_certificate", cert.id, ref=cert.cert_no, value=cert.net_payable, field="amount",
        title=f"Work certificate {cert.cert_no} — {sc.title}", reason=f"Net payable ₹{D(cert.net_payable):,.2f}",
    )
    if approval is not None:
        cert.status = "pending_approval"
        cert.approval_request_id = approval.id
    else:
        await _approve(ctx, cert)
    await audit(ctx, "work_certificate", cert.id, "submit", ref=cert.cert_no, changes={"status": cert.status})
    return cert


async def _approve(ctx: Ctx, cert: K.ReWorkCertificate) -> None:
    sc = await ctx.db.get(K.ReSubcontract, cert.subcontract_id)
    prev = await _previous_cumulative(ctx.db, sc.id, cert.id)
    if D(cert.cumulative_work_done) <= prev + EPS:
        cert.status = "rejected"
        cert.remarks = "Superseded by a later bill"
        return
    cert.status = "approved"
    cert.approved_on = date.today()
    sc.billed_amount = cert.cumulative_work_done
    sc.advance_recovered = D(sc.advance_recovered) + D(cert.advance_recovery)
    if D(cert.retention_amount) > 0:
        ctx.db.add(K.ReRetentionEntry(
            id=uuid.uuid4(), vendor_id=ctx.vendor_id, subcontract_id=sc.id, contractor_id=sc.contractor_id,
            certificate_id=cert.id, kind="held", amount=cert.retention_amount, entry_date=date.today(),
            remarks=f"Retention on {cert.cert_no}"))
    cert.gl_entry_id = await gl.post_vendor_bill(
        ctx.db, ctx.vendor_id, bill_id=cert.id, subtotal=cert.gross_amount, tax=cert.gst_amount,
        total=D(cert.gross_amount) + D(cert.gst_amount), supplier_id=None,
        narration=f"Work certificate {cert.cert_no} · {sc.sc_no}", entry_date=cert.approved_on,
    )
    if cert.is_final and sc.status == "active":
        sc.status = "completed"
    await ctx.db.flush()


@register_handler("work_certificate")
async def _cert_approval(ctx: Ctx, entity_id: UUID, approved: bool, req: ReApprovalRequest) -> None:
    cert = await ctx.db.get(K.ReWorkCertificate, entity_id)
    if cert is None or cert.vendor_id != ctx.vendor_id or cert.status != "pending_approval":
        return
    if approved:
        await _approve(ctx, cert)
    else:
        cert.status = "rejected"


async def cert_pay(ctx: Ctx, cert: K.ReWorkCertificate, *, mode: str, reference: Optional[str], paid_on: Optional[date]) -> K.ReWorkCertificate:
    if cert.status != "approved":
        raise HTTPException(status_code=409, detail=f"Bill is {cert.status}; only approved bills can be paid")
    if mode not in C.PAYMENT_MODES:
        raise HTTPException(status_code=422, detail=f"mode must be one of {', '.join(C.PAYMENT_MODES)}")
    cert.status, cert.payment_mode, cert.payment_reference = "paid", mode, reference
    cert.paid_on = paid_on or date.today()
    await gl.post_vendor_payment(
        ctx.db, ctx.vendor_id, payment_id=cert.id, amount=cert.net_payable, supplier_id=None,
        narration=f"Payment of {cert.cert_no}", entry_date=cert.paid_on,
    )
    await audit(ctx, "work_certificate", cert.id, "pay", ref=cert.cert_no, changes={"net": cert.net_payable})
    return cert


async def cert_cancel(ctx: Ctx, cert: K.ReWorkCertificate, reason: str) -> K.ReWorkCertificate:
    if cert.status not in ("draft", "pending_approval", "rejected"):
        raise HTTPException(status_code=409, detail=f"A {cert.status} bill cannot be cancelled")
    if cert.status == "pending_approval" and cert.approval_request_id:
        req = await ctx.db.get(ReApprovalRequest, cert.approval_request_id)
        if req is not None and req.status == "pending":
            req.status = "cancelled"
    cert.status = "cancelled"
    cert.remarks = f"Cancelled: {reason}"[:500] if reason else cert.remarks
    await audit(ctx, "work_certificate", cert.id, "cancel", ref=cert.cert_no)
    return cert


# ═══ retention ══════════════════════════════════════════════════════════════════════════════

async def retention_position(db: AsyncSession, sc_id: UUID) -> dict:
    rows = (await db.execute(select(K.ReRetentionEntry).where(K.ReRetentionEntry.subcontract_id == sc_id))).scalars().all()
    held = sum((D(r.amount) for r in rows if r.kind == "held"), Decimal(0))
    released = sum((D(r.amount) for r in rows if r.kind == "released"), Decimal(0))
    return {"held": held, "released": released, "balance": held - released}


async def release_retention(ctx: Ctx, sc: K.ReSubcontract, amount: Decimal, remarks: Optional[str]) -> K.ReRetentionEntry:
    if sc.status != "completed":
        raise HTTPException(status_code=409, detail="Retention is released only after the contract is completed (final bill approved)")
    pos = await retention_position(ctx.db, sc.id)
    amt = money_q(D(amount))
    if amt <= 0:
        raise HTTPException(status_code=422, detail="amount must be greater than zero")
    if amt > pos["balance"] + EPS:
        raise HTTPException(status_code=409, detail=f"Only ₹{pos['balance']:,.2f} of retention is held")
    entry = K.ReRetentionEntry(
        id=uuid.uuid4(), vendor_id=ctx.vendor_id, subcontract_id=sc.id, contractor_id=sc.contractor_id, kind="released",
        amount=amt, entry_date=date.today(), remarks=remarks)
    ctx.db.add(entry)
    await ctx.db.flush()
    await gl.post_vendor_payment(
        ctx.db, ctx.vendor_id, payment_id=entry.id, amount=amt, supplier_id=None,
        narration=f"Retention release · {sc.sc_no}", entry_date=entry.entry_date,
    )
    await audit(ctx, "subcontract", sc.id, "release_retention", ref=sc.sc_no, changes={"amount": amt})
    return entry


# ═══ payables overview ══════════════════════════════════════════════════════════════════════

def _bucket(days: int) -> str:
    return "not_due" if days <= 0 else "d1_30" if days <= 30 else "d31_60" if days <= 60 else "d61_90" if days <= 90 else "d90_plus"


async def payables_summary(db: AsyncSession, vendor_id: UUID) -> dict:
    """Everything the company owes: supplier GRNs, contractor bills and broker settlements."""
    today = date.today()
    items: list[dict[str, Any]] = []
    sup = {s.id: s for s in (await db.execute(select(S.ReSupplier).where(S.ReSupplier.vendor_id == vendor_id))).scalars().all()}
    for g in (await db.execute(select(S.ReGrn).where(S.ReGrn.vendor_id == vendor_id, S.ReGrn.status == "posted",
                                                       S.ReGrn.payment_status == "unpaid"))).scalars().all():
        terms = int(sup[g.supplier_id].payment_terms_days) if g.supplier_id in sup else 30
        from datetime import timedelta
        due = g.received_on + timedelta(days=terms)
        items.append({"kind": "supplier", "id": str(g.id), "ref": g.grn_no, "party": sup[g.supplier_id].name if g.supplier_id in sup else "",
                      "amount": _f(g.payable_amount), "due_date": due.isoformat(), "days_overdue": (today - due).days})
    cons = {c.id: c for c in (await db.execute(select(K.ReContractor).where(K.ReContractor.vendor_id == vendor_id))).scalars().all()}
    for c in (await db.execute(select(K.ReWorkCertificate).where(K.ReWorkCertificate.vendor_id == vendor_id,
                                                                   K.ReWorkCertificate.status == "approved"))).scalars().all():
        from datetime import timedelta
        due = (c.approved_on or c.bill_date) + timedelta(days=30)
        items.append({"kind": "contractor", "id": str(c.id), "ref": c.cert_no, "party": cons[c.contractor_id].name if c.contractor_id in cons else "",
                      "amount": _f(c.net_payable), "due_date": due.isoformat(), "days_overdue": (today - due).days})
    brokers = {b.id: b for b in (await db.execute(select(C.ReBroker).where(C.ReBroker.vendor_id == vendor_id))).scalars().all()}
    for s in (await db.execute(select(R.ReSettlement).where(R.ReSettlement.vendor_id == vendor_id, R.ReSettlement.status == "approved"))).scalars().all():
        items.append({"kind": "broker", "id": str(s.id), "ref": s.settlement_no, "party": brokers[s.broker_id].name if s.broker_id in brokers else "",
                      "amount": _f(s.net_amount), "due_date": s.settlement_date.isoformat(), "days_overdue": (today - s.settlement_date).days})
    buckets: dict[str, float] = defaultdict(float)
    by_kind: dict[str, float] = defaultdict(float)
    for it in items:
        buckets[_bucket(it["days_overdue"])] += it["amount"]
        by_kind[it["kind"]] += it["amount"]
    # retention still held is a liability too, but is not due until the defect-liability period ends
    held = D((await db.execute(select(func.coalesce(func.sum(K.ReRetentionEntry.amount), 0)).where(
        K.ReRetentionEntry.vendor_id == vendor_id, K.ReRetentionEntry.kind == "held"))).scalar_one())
    released = D((await db.execute(select(func.coalesce(func.sum(K.ReRetentionEntry.amount), 0)).where(
        K.ReRetentionEntry.vendor_id == vendor_id, K.ReRetentionEntry.kind == "released"))).scalar_one())
    items.sort(key=lambda x: -x["days_overdue"])
    return {
        "total_payable": round(sum(by_kind.values()), 2), "by_kind": dict(by_kind), "ageing": dict(buckets),
        "retention_held": _f(held - released), "items": items,
    }
