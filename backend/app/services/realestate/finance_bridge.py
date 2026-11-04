"""Bridge from real-estate documents to the shared finance GL (best effort, never blocks the flow)."""
from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.realestate.admin import ReGlFailure
from app.models.realestate.base import Base, now_utc

from .common import D, jsonable

log = logging.getLogger(__name__)

NOT_CONFIGURED = "General-ledger accounts for this document are not configured (Finance → Accounts / posting rules)"

# Payload keys that must be turned back into typed values before a retry (they are stored as JSON).
_DECIMAL_KEYS = ("total", "cgst", "sgst", "igst", "amount", "subtotal", "tax_amount")
_UUID_KEYS = ("customer_id", "supplier_id", "payee_id")


async def _record_failure(db: AsyncSession, vendor_id: UUID, source_type: str, source_id: UUID, payload: dict, error: str) -> None:
    """Remember a document that could not be posted so Finance can see it and retry. Never raises."""
    try:
        async with db.begin_nested():
            row = (await db.execute(select(ReGlFailure).where(
                ReGlFailure.vendor_id == vendor_id, ReGlFailure.source_type == source_type,
                ReGlFailure.source_id == source_id))).scalar_one_or_none()
            amount = D(payload.get("total", payload.get("amount", 0)))
            if row is None:
                db.add(ReGlFailure(vendor_id=vendor_id, source_type=source_type, source_id=source_id,
                                   reference=str(payload.get("reference") or payload.get("narration") or "")[:255] or None,
                                   amount=amount, error=error[:2000], payload=jsonable(payload), attempts=1, status="open"))
            else:
                row.attempts = int(row.attempts or 0) + 1
                row.error, row.payload, row.amount = error[:2000], jsonable(payload), amount
                row.status, row.resolved_at, row.last_attempt_at = "open", None, now_utc()
    except Exception:  # the log must never break the business flow
        log.exception("Could not record GL posting failure (%s/%s)", source_type, source_id)


async def _post(db: AsyncSession, vendor_id: UUID, source_type: str, source_id: UUID, payload: dict) -> Optional[UUID]:
    """Post through ``finance.posting.post_event`` inside a savepoint; return the journal id or None.

    The business document is never blocked by the ledger, but a failure is logged to ``re_gl_failure`` so it
    shows up in the "GL Posting Issues" list and can be retried once Finance is set up.
    """
    try:
        from app.services.finance.posting import post_event

        async with db.begin_nested():
            je = await post_event(db, vendor_id, source_type, source_id, payload)
    except Exception as exc:  # closed period, bad account mapping, ...
        log.warning("Real-estate GL posting skipped (%s/%s): %s", source_type, source_id, exc)
        await _record_failure(db, vendor_id, source_type, source_id, payload, str(exc) or exc.__class__.__name__)
        return None
    if je is None:
        log.warning("Real-estate GL posting skipped (%s/%s): %s", source_type, source_id, NOT_CONFIGURED)
        await _record_failure(db, vendor_id, source_type, source_id, payload, NOT_CONFIGURED)
        return None
    return je.id


def _revive(payload: dict) -> dict:
    out = dict(payload or {})
    for k in _DECIMAL_KEYS:
        if out.get(k) is not None:
            out[k] = D(out[k])
    for k in _UUID_KEYS:
        if out.get(k):
            out[k] = UUID(str(out[k]))
    if out.get("entry_date"):
        out["entry_date"] = date.fromisoformat(str(out["entry_date"])[:10])
    return out


async def retry_failure(db: AsyncSession, failure: ReGlFailure) -> dict:
    """Try to post a failed document again. Safe to repeat: an already-posted source is never posted twice."""
    from app.models.finance import FinJournalEntry

    failure.last_attempt_at = now_utc()
    existing = (await db.execute(select(FinJournalEntry).where(
        FinJournalEntry.vendor_id == failure.vendor_id, FinJournalEntry.source_type == failure.source_type,
        FinJournalEntry.source_id == failure.source_id, FinJournalEntry.status == "posted",
        FinJournalEntry.reverses_id.is_(None)))).scalars().first()
    journal_id: Optional[UUID] = existing.id if existing is not None else None
    error = ""
    if journal_id is None:
        from app.services.finance.posting import post_event

        try:
            async with db.begin_nested():
                je = await post_event(db, failure.vendor_id, failure.source_type, failure.source_id, _revive(failure.payload or {}))
            journal_id = je.id if je is not None else None
            error = "" if je is not None else NOT_CONFIGURED
        except Exception as exc:
            error = str(exc) or exc.__class__.__name__
    failure.attempts = int(failure.attempts or 0) + 1
    if journal_id is None:
        failure.error = error[:2000]
        return {"status": "open", "error": failure.error}
    failure.status, failure.journal_id, failure.resolved_at, failure.error = "resolved", journal_id, now_utc(), None
    await _link_source(db, failure.source_id, journal_id)
    return {"status": "resolved", "journal_id": str(journal_id)}


async def _link_source(db: AsyncSession, source_id: UUID, journal_id: UUID) -> None:
    """Point the source document's ``gl_entry_id`` at the journal that was finally posted."""
    for table in Base.metadata.sorted_tables:
        if table.name.startswith("re_") and "gl_entry_id" in table.c and table.name != ReGlFailure.__tablename__:
            await db.execute(table.update().where(table.c.id == source_id, table.c.gl_entry_id.is_(None)).values(gl_entry_id=journal_id))


async def post_demand(
    db: AsyncSession, vendor_id: UUID, *, demand_id: UUID, total: Decimal, gst: Decimal,
    customer_id: Optional[UUID], narration: str, entry_date: Optional[date] = None,
) -> Optional[UUID]:
    """Demand / rent / maintenance invoice: Dr AR, Cr Revenue + GST output."""
    half = D(gst) / 2
    return await _post(db, vendor_id, "invoice", demand_id, {
        "total": D(total), "cgst": half, "sgst": half, "igst": Decimal(0),
        "customer_id": customer_id, "narration": narration, "entry_date": entry_date or date.today(),
        "reference": narration,
    })


async def post_receipt(
    db: AsyncSession, vendor_id: UUID, *, receipt_id: UUID, amount: Decimal,
    customer_id: Optional[UUID], narration: str, entry_date: Optional[date] = None,
) -> Optional[UUID]:
    """Customer receipt: Dr Bank, Cr AR."""
    return await _post(db, vendor_id, "payment", receipt_id, {
        "amount": D(amount), "customer_id": customer_id, "narration": narration,
        "entry_date": entry_date or date.today(), "reference": narration,
    })


async def post_vendor_bill(
    db: AsyncSession, vendor_id: UUID, *, bill_id: UUID, subtotal: Decimal, tax: Decimal,
    total: Decimal, supplier_id: Optional[UUID], narration: str,
    entry_date: Optional[date] = None,
) -> Optional[UUID]:
    """Contractor / supplier bill: Dr Expense + GST input, Cr AP."""
    return await _post(db, vendor_id, "vendor_bill", bill_id, {
        "subtotal": D(subtotal), "tax_amount": D(tax), "total": D(total),
        "supplier_id": supplier_id, "narration": narration,
        "entry_date": entry_date or date.today(), "reference": narration,
    })


async def post_vendor_payment(
    db: AsyncSession, vendor_id: UUID, *, payment_id: UUID, amount: Decimal,
    supplier_id: Optional[UUID], narration: str, entry_date: Optional[date] = None,
) -> Optional[UUID]:
    """Payment to contractor / broker: Dr AP, Cr Bank."""
    return await _post(db, vendor_id, "vendor_payment", payment_id, {
        "amount": D(amount), "supplier_id": supplier_id, "narration": narration,
        "entry_date": entry_date or date.today(), "reference": narration,
    })


async def post_commission_accrual(
    db: AsyncSession, vendor_id: UUID, *, commission_id: UUID, amount: Decimal, broker_id: Optional[UUID],
    narration: str, entry_date: Optional[date] = None,
) -> Optional[UUID]:
    """Broker commission: Dr Commission Expense, Cr Commission Payable (uses the shared commission accounts)."""
    return await _post(db, vendor_id, "commission_accrual", commission_id, {
        "amount": D(amount), "payee_id": broker_id, "narration": narration,
        "entry_date": entry_date or date.today(), "reference": narration,
    })


async def post_commission_payment(
    db: AsyncSession, vendor_id: UUID, *, settlement_id: UUID, amount: Decimal, broker_id: Optional[UUID],
    narration: str, entry_date: Optional[date] = None,
) -> Optional[UUID]:
    """Settlement paid to a broker: Dr Commission Payable, Cr Bank."""
    return await _post(db, vendor_id, "commission_payment", settlement_id, {
        "amount": D(amount), "payee_id": broker_id, "narration": narration,
        "entry_date": entry_date or date.today(), "reference": narration,
    })


async def void_posted(db: AsyncSession, vendor_id: UUID, source_type: str, source_id: UUID) -> bool:
    """Void the posted journal for a source document (cancelled demand / receipt). Best effort."""
    try:
        from sqlalchemy import select

        from app.models.finance import FinJournalEntry

        async with db.begin_nested():
            rows = (
                await db.execute(
                    select(FinJournalEntry).where(
                        FinJournalEntry.vendor_id == vendor_id,
                        FinJournalEntry.source_type == source_type,
                        FinJournalEntry.source_id == source_id,
                        FinJournalEntry.status == "posted",
                    )
                )
            ).scalars().all()
            for je in rows:
                je.status = "void"
        return bool(rows)
    except Exception as exc:
        log.warning("Real-estate GL void skipped (%s/%s): %s", source_type, source_id, exc)
        return False
