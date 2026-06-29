"""
app/services/finance/parallel_ledger_service.py

Parallel ledger management — SAP New G/L equivalent (transaction FINSC_LEDGER / FAGL_MIG_LEDGER).

Concepts:
  - Each vendor can define multiple named ledgers (Leading, IFRS, Tax, …).
  - Exactly one ledger per vendor should be flagged `is_leading=True`.
  - A `FinLedgerAssignment` ties a ledger to a company entity.
  - `FinJournalLineLedger` rows hold ledger-specific debit/credit overrides for a
    given journal line; the leading ledger's amounts live on FinJournalLine itself.
  - Per-ledger trial balance aggregates the override amounts.
"""
from __future__ import annotations

import logging
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import (
    FinAccount,
    FinJournalEntry,
    FinJournalLine,
    FinJournalLineLedger,
    FinLedger,
    FinLedgerAssignment,
)

log = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Ledger CRUD
# ─────────────────────────────────────────────────────────────────────────────

async def list_ledgers(db: AsyncSession, vendor_id: UUID) -> list[FinLedger]:
    rows = (await db.execute(
        select(FinLedger)
        .where(FinLedger.vendor_id == vendor_id)
        .order_by(FinLedger.is_leading.desc(), FinLedger.code)
    )).scalars().all()
    return list(rows)


async def create_ledger(
    db: AsyncSession,
    vendor_id: UUID,
    code: str,
    name: str,
    *,
    description: str | None = None,
    is_leading: bool = False,
    currency: str = "INR",
) -> FinLedger:
    if is_leading:
        # Demote any existing leading ledger
        existing_leading = (await db.execute(
            select(FinLedger).where(
                FinLedger.vendor_id == vendor_id,
                FinLedger.is_leading == True,
            )
        )).scalars().all()
        for el in existing_leading:
            el.is_leading = False

    ledger = FinLedger(
        vendor_id=vendor_id,
        code=code,
        name=name,
        description=description,
        is_leading=is_leading,
        currency=currency,
    )
    db.add(ledger)
    await db.flush()
    return ledger


async def update_ledger(
    db: AsyncSession,
    ledger_id: UUID,
    vendor_id: UUID,
    **kwargs,
) -> FinLedger:
    ledger = (await db.execute(
        select(FinLedger).where(
            FinLedger.id == ledger_id,
            FinLedger.vendor_id == vendor_id,
        )
    )).scalar_one_or_none()
    if not ledger:
        raise ValueError("Ledger not found")
    for k, v in kwargs.items():
        if hasattr(ledger, k):
            setattr(ledger, k, v)
    await db.flush()
    return ledger


async def delete_ledger(db: AsyncSession, ledger_id: UUID, vendor_id: UUID) -> None:
    ledger = (await db.execute(
        select(FinLedger).where(
            FinLedger.id == ledger_id,
            FinLedger.vendor_id == vendor_id,
        )
    )).scalar_one_or_none()
    if not ledger:
        raise ValueError("Ledger not found")
    if ledger.is_leading:
        raise ValueError("Cannot delete the leading ledger")
    await db.delete(ledger)
    await db.flush()


# ─────────────────────────────────────────────────────────────────────────────
# Ledger Assignment CRUD
# ─────────────────────────────────────────────────────────────────────────────

async def list_assignments(
    db: AsyncSession,
    vendor_id: UUID,
    *,
    company_id: UUID | None = None,
    ledger_id: UUID | None = None,
) -> list[FinLedgerAssignment]:
    stmt = select(FinLedgerAssignment).where(FinLedgerAssignment.vendor_id == vendor_id)
    if company_id:
        stmt = stmt.where(FinLedgerAssignment.company_id == company_id)
    if ledger_id:
        stmt = stmt.where(FinLedgerAssignment.ledger_id == ledger_id)
    rows = (await db.execute(stmt)).scalars().all()
    return list(rows)


async def assign_ledger(
    db: AsyncSession,
    vendor_id: UUID,
    ledger_id: UUID,
    company_id: UUID,
) -> FinLedgerAssignment:
    existing = (await db.execute(
        select(FinLedgerAssignment).where(
            FinLedgerAssignment.ledger_id == ledger_id,
            FinLedgerAssignment.company_id == company_id,
        )
    )).scalar_one_or_none()
    if existing:
        existing.is_active = True
        await db.flush()
        return existing

    asgn = FinLedgerAssignment(
        vendor_id=vendor_id,
        ledger_id=ledger_id,
        company_id=company_id,
    )
    db.add(asgn)
    await db.flush()
    return asgn


async def remove_assignment(
    db: AsyncSession,
    assignment_id: UUID,
    vendor_id: UUID,
) -> None:
    asgn = (await db.execute(
        select(FinLedgerAssignment).where(
            FinLedgerAssignment.id == assignment_id,
            FinLedgerAssignment.vendor_id == vendor_id,
        )
    )).scalar_one_or_none()
    if not asgn:
        raise ValueError("Assignment not found")
    await db.delete(asgn)
    await db.flush()


# ─────────────────────────────────────────────────────────────────────────────
# Ledger-specific line posting
# ─────────────────────────────────────────────────────────────────────────────

async def post_ledger_line(
    db: AsyncSession,
    journal_line_id: UUID,
    ledger_id: UUID,
    debit: Decimal,
    credit: Decimal,
    *,
    amount_fc: Decimal | None = None,
    narration: str | None = None,
) -> FinJournalLineLedger:
    """
    Create or update a parallel-ledger line for an existing journal line.
    Call this after the main posting is complete for each non-leading ledger.
    """
    existing = (await db.execute(
        select(FinJournalLineLedger).where(
            FinJournalLineLedger.journal_line_id == journal_line_id,
            FinJournalLineLedger.ledger_id == ledger_id,
        )
    )).scalar_one_or_none()

    if existing:
        existing.debit = debit
        existing.credit = credit
        if amount_fc is not None:
            existing.amount_fc = amount_fc
        if narration is not None:
            existing.narration = narration
        await db.flush()
        return existing

    row = FinJournalLineLedger(
        journal_line_id=journal_line_id,
        ledger_id=ledger_id,
        debit=debit,
        credit=credit,
        amount_fc=amount_fc,
        narration=narration,
    )
    db.add(row)
    await db.flush()
    return row


async def get_ledger_lines(
    db: AsyncSession,
    journal_entry_id: UUID,
    ledger_id: UUID,
) -> list[FinJournalLineLedger]:
    """Fetch all parallel-ledger lines for a JE + ledger combination."""
    line_ids = (await db.execute(
        select(FinJournalLine.id).where(
            FinJournalLine.journal_entry_id == journal_entry_id
        )
    )).scalars().all()

    if not line_ids:
        return []

    rows = (await db.execute(
        select(FinJournalLineLedger).where(
            FinJournalLineLedger.journal_line_id.in_(line_ids),
            FinJournalLineLedger.ledger_id == ledger_id,
        )
    )).scalars().all()
    return list(rows)


# ─────────────────────────────────────────────────────────────────────────────
# Per-ledger Trial Balance
# ─────────────────────────────────────────────────────────────────────────────

async def ledger_trial_balance(
    db: AsyncSession,
    vendor_id: UUID,
    ledger_id: UUID,
    *,
    fiscal_year_id: UUID | None = None,
) -> list[dict]:
    """
    Compute a trial balance for a specific parallel ledger.

    For the leading ledger, uses FinJournalLine amounts directly.
    For non-leading ledgers, uses FinJournalLineLedger override amounts.

    Returns list of dicts: {account_id, account_code, account_name, debit, credit, net}.
    """
    # Verify ledger belongs to vendor
    ledger = (await db.execute(
        select(FinLedger).where(
            FinLedger.id == ledger_id,
            FinLedger.vendor_id == vendor_id,
        )
    )).scalar_one_or_none()
    if not ledger:
        raise ValueError("Ledger not found")

    # Build JE filter
    je_stmt = select(FinJournalEntry.id).where(
        FinJournalEntry.vendor_id == vendor_id,
        FinJournalEntry.status == "posted",
    )
    if fiscal_year_id:
        je_stmt = je_stmt.where(FinJournalEntry.fiscal_year_id == fiscal_year_id)
    je_ids = (await db.execute(je_stmt)).scalars().all()

    if not je_ids:
        return []

    if ledger.is_leading:
        # Aggregate from FinJournalLine
        rows = (await db.execute(
            select(
                FinJournalLine.account_id,
                func.sum(FinJournalLine.debit).label("debit"),
                func.sum(FinJournalLine.credit).label("credit"),
            )
            .where(FinJournalLine.journal_entry_id.in_(je_ids))
            .group_by(FinJournalLine.account_id)
        )).all()
    else:
        # Aggregate from FinJournalLineLedger
        line_ids = (await db.execute(
            select(FinJournalLine.id, FinJournalLine.account_id).where(
                FinJournalLine.journal_entry_id.in_(je_ids)
            )
        )).all()

        line_to_acct: dict[UUID, UUID] = {r.id: r.account_id for r in line_ids}
        if not line_to_acct:
            return []

        ledger_rows = (await db.execute(
            select(
                FinJournalLineLedger.journal_line_id,
                func.sum(FinJournalLineLedger.debit).label("debit"),
                func.sum(FinJournalLineLedger.credit).label("credit"),
            )
            .where(
                FinJournalLineLedger.journal_line_id.in_(list(line_to_acct.keys())),
                FinJournalLineLedger.ledger_id == ledger_id,
            )
            .group_by(FinJournalLineLedger.journal_line_id)
        )).all()

        # Roll up per account
        acct_totals: dict[UUID, dict] = {}
        for lr in ledger_rows:
            acct_id = line_to_acct[lr.journal_line_id]
            if acct_id not in acct_totals:
                acct_totals[acct_id] = {"debit": Decimal(0), "credit": Decimal(0)}
            acct_totals[acct_id]["debit"]  += Decimal(str(lr.debit  or 0))
            acct_totals[acct_id]["credit"] += Decimal(str(lr.credit or 0))

        # Build rows-like list
        rows = [
            type("Row", (), {"account_id": k, "debit": v["debit"], "credit": v["credit"]})()
            for k, v in acct_totals.items()
        ]

    # Enrich with account codes/names
    result = []
    for row in rows:
        acct = (await db.execute(
            select(FinAccount).where(FinAccount.id == row.account_id)
        )).scalar_one_or_none()
        if not acct:
            continue
        debit  = Decimal(str(row.debit  or 0))
        credit = Decimal(str(row.credit or 0))
        result.append({
            "account_id":   str(row.account_id),
            "account_code": acct.code,
            "account_name": acct.name,
            "account_type": acct.account_type,
            "debit":        debit,
            "credit":       credit,
            "net":          debit - credit,
        })

    result.sort(key=lambda r: r["account_code"])
    return result
