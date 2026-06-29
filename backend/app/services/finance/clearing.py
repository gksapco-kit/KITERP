"""
GL Open-Item Management & Clearing Service
==========================================
Implements SAP-style open-item management:
  - Lines posted to reconcilable / reconciliation accounts are stamped 'open'.
  - Matching open debit + credit items (netting to zero) can be cleared together.
  - Once cleared, lines are stamped 'cleared' and linked to a FinGlClearingBatch.
"""
from __future__ import annotations

import uuid
import logging
from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.finance import (
    FinAccount,
    FinGlClearingBatch,
    FinJournalLine,
    FinJournalEntry,
)

log = logging.getLogger(__name__)

OPEN_ITEM_STATUSES = {"open", "cleared", "partial"}


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

async def _next_clearing_ref(db: AsyncSession, vendor_id: UUID) -> str:
    r = await db.execute(
        select(func.count()).select_from(FinGlClearingBatch).where(
            FinGlClearingBatch.vendor_id == vendor_id,
        )
    )
    count = r.scalar() or 0
    return f"CLR{str(count + 1).zfill(6)}"


def _is_open_item_account(account: FinAccount) -> bool:
    """Return True if the account should track open items."""
    return bool(account.is_reconcilable or account.is_reconciliation_account)


# ─────────────────────────────────────────────────────────────────────────────
# Mark lines as 'open' when first posted to a tracked account
# ─────────────────────────────────────────────────────────────────────────────

async def stamp_open_items(
    db: AsyncSession,
    vendor_id: UUID,
    lines: list[FinJournalLine],
) -> None:
    """
    Called from the posting engine after journal lines are created.
    For each line whose account is reconcilable / reconciliation, set
    open_item_status = 'open'.
    """
    if not lines:
        return
    account_ids = list({ln.account_id for ln in lines})
    r = await db.execute(
        select(FinAccount).where(
            FinAccount.id.in_(account_ids),
            FinAccount.vendor_id == vendor_id,
        )
    )
    tracked_ids = {
        a.id for a in r.scalars().all() if _is_open_item_account(a)
    }
    for ln in lines:
        if ln.account_id in tracked_ids and ln.open_item_status is None:
            ln.open_item_status = "open"


# ─────────────────────────────────────────────────────────────────────────────
# Fetch open items
# ─────────────────────────────────────────────────────────────────────────────

async def get_open_items(
    db: AsyncSession,
    vendor_id: UUID,
    account_id: UUID,
    party_type: Optional[str] = None,
    party_id: Optional[UUID] = None,
    include_partial: bool = True,
) -> list[dict]:
    """
    Return open (uncleared) GL line items for the given account.
    Optionally filter by party (customer / supplier).
    """
    statuses = ["open", "partial"] if include_partial else ["open"]
    q = (
        select(
            FinJournalLine,
            FinJournalEntry.entry_no,
            FinJournalEntry.entry_date,
            FinJournalEntry.narration.label("je_narration"),
            FinJournalEntry.source_type,
        )
        .join(FinJournalEntry, FinJournalLine.journal_entry_id == FinJournalEntry.id)
        .where(
            FinJournalLine.vendor_id == vendor_id,
            FinJournalLine.account_id == account_id,
            FinJournalLine.open_item_status.in_(statuses),
            FinJournalEntry.status == "posted",
        )
        .order_by(FinJournalEntry.entry_date)
    )
    if party_type:
        q = q.where(FinJournalLine.party_type == party_type)
    if party_id:
        q = q.where(FinJournalLine.party_id == party_id)

    r = await db.execute(q)
    rows = r.all()

    result = []
    for ln, entry_no, entry_date, je_narration, source_type in rows:
        result.append({
            "id": str(ln.id),
            "journal_entry_id": str(ln.journal_entry_id),
            "entry_no": entry_no,
            "entry_date": entry_date.isoformat() if entry_date else None,
            "account_id": str(ln.account_id),
            "party_type": ln.party_type,
            "party_id": str(ln.party_id) if ln.party_id else None,
            "debit": float(ln.debit),
            "credit": float(ln.credit),
            "currency": ln.currency,
            "narration": ln.narration or je_narration or "",
            "ref_doc_type": ln.ref_doc_type,
            "ref_doc_no": ln.ref_doc_no,
            "assignment": ln.assignment,
            "open_item_status": ln.open_item_status,
            "source_type": source_type,
        })
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Clear open items
# ─────────────────────────────────────────────────────────────────────────────

async def clear_open_items(
    db: AsyncSession,
    vendor_id: UUID,
    line_ids: list[UUID],
    clearing_date: date,
    actor_id: Optional[UUID] = None,
    notes: Optional[str] = None,
) -> FinGlClearingBatch:
    """
    Clear a set of open GL line items:
      1. All lines must belong to the same vendor and the same account.
      2. The account must be reconcilable (open-item tracking enabled).
      3. Sum of debits must equal sum of credits (net = 0).
      4. All lines must currently be in status 'open' or 'partial'.

    On success:
      - Creates a FinGlClearingBatch record.
      - Stamps each line: open_item_status='cleared', clearing_batch_id, clearing_date.

    Returns the new FinGlClearingBatch.
    Raises ValueError on any validation failure.
    """
    if not line_ids:
        raise ValueError("At least two journal lines must be selected for clearing.")

    # Fetch lines with their account
    r = await db.execute(
        select(FinJournalLine)
        .where(
            FinJournalLine.id.in_(line_ids),
            FinJournalLine.vendor_id == vendor_id,
        )
    )
    lines = r.scalars().all()

    if len(lines) != len(line_ids):
        raise ValueError("One or more journal lines were not found for this vendor.")

    # All on the same account
    account_ids = {ln.account_id for ln in lines}
    if len(account_ids) != 1:
        raise ValueError(
            "All selected lines must be on the same GL account. "
            f"Found {len(account_ids)} different accounts."
        )

    account_id = next(iter(account_ids))
    r2 = await db.execute(
        select(FinAccount).where(
            FinAccount.id == account_id,
            FinAccount.vendor_id == vendor_id,
        )
    )
    account = r2.scalar_one_or_none()
    if account is None:
        raise ValueError("Account not found.")
    if not _is_open_item_account(account):
        raise ValueError(
            f"Account '{account.code} – {account.name}' does not have open-item tracking enabled. "
            "Enable 'Reconcilable' on the account to allow GL clearing."
        )

    # All lines must be in clearable status
    bad_status = [ln for ln in lines if ln.open_item_status not in ("open", "partial")]
    if bad_status:
        bad_nos = ", ".join(str(ln.id) for ln in bad_status[:3])
        raise ValueError(
            f"Some selected lines are not in 'open' or 'partial' status: {bad_nos}"
        )

    # Must balance to zero
    total_debit = sum(ln.debit for ln in lines)
    total_credit = sum(ln.credit for ln in lines)
    if total_debit != total_credit:
        raise ValueError(
            f"Selected items do not balance: total debit {total_debit} ≠ total credit {total_credit}. "
            "Add or remove lines until debits equal credits before clearing."
        )

    # Infer party (optional — must all agree if present)
    party_types = {ln.party_type for ln in lines if ln.party_type}
    party_ids   = {ln.party_id   for ln in lines if ln.party_id}
    party_type = next(iter(party_types)) if len(party_types) == 1 else None
    party_id   = next(iter(party_ids))   if len(party_ids)   == 1 else None

    clearing_ref = await _next_clearing_ref(db, vendor_id)

    batch = FinGlClearingBatch(
        id=uuid.uuid4(),
        vendor_id=vendor_id,
        account_id=account_id,
        clearing_ref=clearing_ref,
        clearing_date=clearing_date,
        party_type=party_type,
        party_id=party_id,
        line_count=len(lines),
        total_debit=total_debit,
        total_credit=total_credit,
        notes=notes,
        created_by_id=actor_id,
    )
    db.add(batch)
    await db.flush()

    for ln in lines:
        ln.open_item_status = "cleared"
        ln.clearing_batch_id = batch.id
        ln.clearing_date = clearing_date

    await db.flush()
    log.info(
        "GL clearing %s: cleared %d lines on account %s (dr=%s cr=%s)",
        clearing_ref, len(lines), account.code, total_debit, total_credit,
    )
    return batch


# ─────────────────────────────────────────────────────────────────────────────
# Reset clearing (undo)
# ─────────────────────────────────────────────────────────────────────────────

async def reset_clearing(
    db: AsyncSession,
    vendor_id: UUID,
    batch_id: UUID,
    actor_id: Optional[UUID] = None,
) -> None:
    """
    Reverse a clearing batch: restore all cleared lines to 'open'.
    Does not delete the batch record (audit trail).
    Raises ValueError if batch not found.
    """
    r = await db.execute(
        select(FinGlClearingBatch).where(
            FinGlClearingBatch.id == batch_id,
            FinGlClearingBatch.vendor_id == vendor_id,
        )
    )
    batch = r.scalar_one_or_none()
    if not batch:
        raise ValueError("Clearing batch not found.")

    r2 = await db.execute(
        select(FinJournalLine).where(
            FinJournalLine.clearing_batch_id == batch_id,
            FinJournalLine.vendor_id == vendor_id,
        )
    )
    lines = r2.scalars().all()
    for ln in lines:
        ln.open_item_status = "open"
        ln.clearing_batch_id = None
        ln.clearing_date = None

    await db.flush()
    log.info(
        "GL clearing %s reset: %d lines restored to open by actor=%s",
        batch.clearing_ref, len(lines), actor_id,
    )
