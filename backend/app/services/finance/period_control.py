"""
Period close / lock / reopen with pre-close checks and an audit trail.

Closing a period is what makes the books final, so it must not succeed while
documents are half-posted. ``close_checklist`` returns *blockers* (must be fixed)
and *warnings* (informational); ``close_period`` refuses when blockers exist.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import (
    FinFiscalYear, FinJournalEntry, FinPeriod, FinPostingFailure,
)
from app.services.finance.posting import _audit


async def close_checklist(db: AsyncSession, vendor_id: UUID, period: FinPeriod) -> dict:
    from app.services.finance.posting_audit import find_unposted

    blockers: list[dict] = []
    warnings: list[dict] = []

    drafts = (await db.execute(
        select(func.count(FinJournalEntry.id)).where(
            FinJournalEntry.vendor_id == vendor_id,
            FinJournalEntry.status == "draft",
            FinJournalEntry.entry_date >= period.start_date,
            FinJournalEntry.entry_date <= period.end_date,
        )
    )).scalar() or 0
    if drafts:
        blockers.append({
            "code": "draft_journals", "count": int(drafts),
            "message": f"{drafts} draft journal entr{'y' if drafts == 1 else 'ies'} dated in this period must be posted or deleted.",
        })

    unposted = await find_unposted(db, vendor_id, from_date=period.start_date, to_date=period.end_date)
    if unposted["total"]:
        blockers.append({
            "code": "unposted_documents", "count": unposted["total"],
            "message": (f"{unposted['total']} document(s) dated in this period have no ledger entry "
                        "(see Finance > Posting issues and re-post them)."),
        })

    open_failures = (await db.execute(
        select(func.count(FinPostingFailure.id)).where(
            FinPostingFailure.vendor_id == vendor_id, FinPostingFailure.status == "open",
        )
    )).scalar() or 0
    if open_failures:
        warnings.append({
            "code": "open_posting_failures", "count": int(open_failures),
            "message": f"{open_failures} open posting failure(s) exist; some may belong to this period.",
        })

    earlier_open = (await db.execute(
        select(func.count(FinPeriod.id)).where(
            FinPeriod.vendor_id == vendor_id,
            FinPeriod.start_date < period.start_date,
            FinPeriod.status == "open",
        )
    )).scalar() or 0
    if earlier_open:
        warnings.append({
            "code": "earlier_period_open", "count": int(earlier_open),
            "message": f"{earlier_open} earlier period(s) are still open; close them in order.",
        })

    return {"period_id": str(period.id), "can_close": not blockers,
            "blockers": blockers, "warnings": warnings}


async def close_period(db: AsyncSession, vendor_id: UUID, period: FinPeriod,
                       closed_by_id: Optional[UUID]) -> FinPeriod:
    if period.status == "closed":
        raise ValueError("Period is already closed.")
    if period.status == "locked":
        raise ValueError("Period is locked; reopen it before closing.")
    check = await close_checklist(db, vendor_id, period)
    if check["blockers"]:
        raise ValueError("Cannot close period: " + " ".join(b["message"] for b in check["blockers"]))
    period.status = "closed"
    period.closed_at = datetime.now(timezone.utc)
    period.closed_by_id = closed_by_id
    await db.flush()
    await _audit(db, vendor_id, "period", period.id, "closed", performed_by_id=closed_by_id,
                 diff_json={"name": period.name, "warnings": check["warnings"]})
    return period


async def lock_period(db: AsyncSession, vendor_id: UUID, period: FinPeriod,
                      by_id: Optional[UUID]) -> FinPeriod:
    if period.status == "closed":
        raise ValueError("Period is already closed; reopen it first if you need to change status.")
    if period.status == "locked":
        return period
    period.status = "locked"
    await db.flush()
    await _audit(db, vendor_id, "period", period.id, "locked", performed_by_id=by_id,
                 diff_json={"name": period.name})
    return period


async def reopen_period(db: AsyncSession, vendor_id: UUID, period: FinPeriod,
                        by_id: Optional[UUID], reason: str = "") -> FinPeriod:
    if period.status == "open":
        return period
    fy = (await db.execute(
        select(FinFiscalYear).where(FinFiscalYear.id == period.fiscal_year_id)
    )).scalar_one_or_none()
    if fy is not None and fy.status == "closed":
        raise ValueError("The fiscal year is closed; reopen the fiscal year before reopening its periods.")
    previous = period.status
    period.status = "open"
    period.closed_at = None
    period.closed_by_id = None
    await db.flush()
    await _audit(db, vendor_id, "period", period.id, "reopened", performed_by_id=by_id,
                 diff_json={"name": period.name, "from": previous,
                            "reason": (reason or "No reason supplied").strip()[:500]})
    return period
