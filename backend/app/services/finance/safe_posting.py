"""
Best-effort GL posting for operational modules, without silent failures.

Operational flows (sales, POS, payroll, procurement …) must not be blocked by the
ledger, but the old pattern (``try: post_event() except: log``) left documents
without a journal entry and nobody knew. ``safe_post`` keeps the flow
non-blocking and records every failed / skipped posting in ``fin_posting_failure``
so Finance can fix the cause (missing account, closed period) and retry.

Also provides a *readiness dry-run*: run every posting handler against a sample
payload to show, per source type, whether the tenant's chart of accounts can post it.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import FinJournalEntry, FinPostingFailure

log = logging.getLogger(__name__)

NOT_CONFIGURED = (
    "Required GL accounts are not configured for this document type "
    "(Finance → Setup → Posting readiness)."
)


# ── JSON round-trip that preserves Decimal / UUID / date ─────────────────────

def _enc(v: Any) -> Any:
    if isinstance(v, Decimal):
        return {"__dec__": str(v)}
    if isinstance(v, UUID):
        return {"__uuid__": str(v)}
    if isinstance(v, datetime):
        return {"__dt__": v.isoformat()}
    if isinstance(v, date):
        return {"__date__": v.isoformat()}
    if isinstance(v, dict):
        return {str(k): _enc(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_enc(x) for x in v]
    if v is None or isinstance(v, (str, int, float, bool)):
        return v
    return str(v)


def _dec(v: Any) -> Any:
    if isinstance(v, dict):
        if "__dec__" in v:
            return Decimal(v["__dec__"])
        if "__uuid__" in v:
            return UUID(v["__uuid__"])
        if "__dt__" in v:
            return datetime.fromisoformat(v["__dt__"])
        if "__date__" in v:
            return date.fromisoformat(v["__date__"])
        return {k: _dec(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_dec(x) for x in v]
    return v


def _amount(payload: dict) -> Decimal:
    for k in ("total", "amount", "gross_total", "cogs_amount", "adjustment_amount", "cash_total"):
        if payload.get(k) not in (None, ""):
            try:
                return Decimal(str(payload[k]))
            except Exception:
                return Decimal("0")
    return Decimal("0")


async def _live_entry(db: AsyncSession, vendor_id: UUID, source_type: str, source_id: UUID):
    return (await db.execute(
        select(FinJournalEntry).where(
            FinJournalEntry.vendor_id == vendor_id,
            FinJournalEntry.source_type == source_type,
            FinJournalEntry.source_id == source_id,
            FinJournalEntry.status == "posted",
            FinJournalEntry.reverses_id.is_(None),
            FinJournalEntry.reversed_by_id.is_(None),
        ).order_by(FinJournalEntry.created_at.desc())
    )).scalars().first()


async def _record_failure(db, vendor_id, source_type, source_id, payload, error) -> None:
    """Upsert an open failure row. Never raises."""
    try:
        async with db.begin_nested():
            row = (await db.execute(select(FinPostingFailure).where(
                FinPostingFailure.vendor_id == vendor_id,
                FinPostingFailure.source_type == source_type,
                FinPostingFailure.source_id == source_id,
            ))).scalar_one_or_none()
            ref = str(payload.get("narration") or payload.get("reference") or "")[:255] or None
            if row is None:
                db.add(FinPostingFailure(
                    vendor_id=vendor_id, source_type=source_type, source_id=source_id,
                    reference=ref, amount=_amount(payload), error=(error or "")[:2000],
                    payload=_enc(payload), attempts=1, status="open",
                    last_attempt_at=datetime.now(timezone.utc),
                ))
            else:
                row.attempts = int(row.attempts or 0) + 1
                row.error = (error or "")[:2000]
                row.payload = _enc(payload)
                row.amount = _amount(payload)
                row.status, row.resolved_at = "open", None
                row.last_attempt_at = datetime.now(timezone.utc)
    except Exception:
        log.exception("Could not record GL posting failure (%s/%s)", source_type, source_id)


async def _resolve_failure(db, vendor_id, source_type, source_id, je_id) -> None:
    try:
        row = (await db.execute(select(FinPostingFailure).where(
            FinPostingFailure.vendor_id == vendor_id,
            FinPostingFailure.source_type == source_type,
            FinPostingFailure.source_id == source_id,
            FinPostingFailure.status == "open",
        ))).scalar_one_or_none()
        if row is not None:
            row.status, row.journal_entry_id = "resolved", je_id
            row.resolved_at = datetime.now(timezone.utc)
            row.error = None
    except Exception:
        log.exception("Could not resolve GL posting failure (%s/%s)", source_type, source_id)


async def safe_post(
    db: AsyncSession,
    vendor_id: UUID,
    source_type: str,
    source_id: UUID,
    payload: dict,
    *,
    created_by_id: Optional[UUID] = None,
) -> Optional[FinJournalEntry]:
    """
    Post inside a savepoint. Returns the journal entry, or ``None`` after recording the
    reason in ``fin_posting_failure``. Never raises; the caller must still commit.
    """
    from app.services.finance.posting import post_event

    try:
        async with db.begin_nested():
            je = await post_event(db, vendor_id, source_type, source_id, payload,
                                  created_by_id=created_by_id)
    except Exception as exc:
        log.warning("GL posting failed (%s/%s): %s", source_type, source_id, exc)
        await _record_failure(db, vendor_id, source_type, source_id, payload,
                              str(exc) or exc.__class__.__name__)
        return None
    if je is None:
        await _record_failure(db, vendor_id, source_type, source_id, payload, NOT_CONFIGURED)
        return None
    await _resolve_failure(db, vendor_id, source_type, source_id, je.id)
    return je


async def retry_failure(db: AsyncSession, failure: FinPostingFailure,
                        created_by_id: Optional[UUID] = None) -> dict:
    """Retry one failed posting. Idempotent: an already-posted source is never posted twice."""
    existing = await _live_entry(db, failure.vendor_id, failure.source_type, failure.source_id)
    if existing is not None:
        failure.status, failure.journal_entry_id = "resolved", existing.id
        failure.resolved_at, failure.error = datetime.now(timezone.utc), None
        return {"status": "resolved", "journal_entry_id": str(existing.id), "already_posted": True}
    payload = _dec(failure.payload or {})
    je = await safe_post(db, failure.vendor_id, failure.source_type, failure.source_id,
                         payload, created_by_id=created_by_id)
    await db.flush()   # persist the status change safe_post made on this same row
    if je is None:
        return {"status": "open", "error": failure.error}
    return {"status": "resolved", "journal_entry_id": str(je.id)}


# ── Readiness dry-run ────────────────────────────────────────────────────────

SAMPLE_PAYLOADS: dict[str, dict] = {
    "invoice": {"total": 118, "cgst": 9, "sgst": 9},
    "credit_note": {"total": 118, "cgst": 9, "sgst": 9},
    "sales_return": {"total": 118, "cgst": 9, "sgst": 9, "cogs_amount": 60},
    "payment": {"amount": 118},
    "pos": {"cash_total": 118, "tax_total": 18},
    "vendor_bill": {"subtotal": 100, "tax_amount": 18, "total": 118},
    "vendor_payment": {"amount": 118},
    "payroll": {
        "gross_total": 100000, "net_total": 75000, "tds_total": 10000,
        "pf_employee": 5000, "pf_employer": 5000, "esi_employee": 2500,
        "esi_employer": 2500, "professional_tax": 200,
    },
    "expense": {"amount": 50},
    "depreciation": {"amount": 25},
    "cogs": {"cogs_amount": 60},
    "inventory_adjustment": {"adjustment_amount": -40},
}


async def posting_readiness(db: AsyncSession, vendor_id: UUID) -> list[dict]:
    """
    Dry-run each handler with a sample payload (nothing is written) and report whether
    the tenant's chart of accounts can post that document type and balance.
    """
    from app.services.finance.posting import _handler_map

    handlers = _handler_map()
    out = []
    for source_type, payload in SAMPLE_PAYLOADS.items():
        item = {"source_type": source_type, "ready": False, "detail": ""}
        try:
            lines = await handlers[source_type](db, vendor_id, dict(payload))
            if not lines:
                item["detail"] = NOT_CONFIGURED
            else:
                dr = sum(Decimal(str(ln.debit or 0)) for ln in lines)
                cr = sum(Decimal(str(ln.credit or 0)) for ln in lines)
                if abs(dr - cr) > Decimal("0.01"):
                    item["detail"] = f"Sample entry does not balance (Dr {dr} / Cr {cr}); a mapped account is missing."
                else:
                    item["ready"], item["detail"] = True, "OK"
        except Exception as exc:
            item["detail"] = str(exc) or exc.__class__.__name__
        out.append(item)
    return out
