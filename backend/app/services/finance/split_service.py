"""
app/services/finance/split_service.py

Automatic document splitting for the GL — equivalent to SAP New G/L FAGL_DOC_SPLIT.

Algorithm (proportional mode):
  1. Collect all "base" lines (lines whose account_type is in rule.base_types).
  2. For each base line, note its dimension value (profit_center_id / segment_id / cost_center_id).
  3. Build a weight map:  {dimension_value: abs(amount)}.
  4. For every non-base line (clearing line), create FinJournalSplitItem slices
     one per dimension value, proportional to the weights.
  5. Each slice carries a split_pct and its pro-rated debit/credit.
"""
from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.finance import (
    FinAccount,
    FinJournalEntry,
    FinJournalLine,
    FinJournalSplitItem,
    FinSplitRule,
    FinSplitRuleBase,
)

log = logging.getLogger(__name__)

CENT = Decimal("0.01")


# ─────────────────────────────────────────────────────────────────────────────
# Split Rule CRUD
# ─────────────────────────────────────────────────────────────────────────────

async def list_split_rules(db: AsyncSession, vendor_id: UUID) -> list[FinSplitRule]:
    rows = (await db.execute(
        select(FinSplitRule).where(FinSplitRule.vendor_id == vendor_id)
        .options(selectinload(FinSplitRule.base_types))
        .order_by(FinSplitRule.created_at)
    )).scalars().all()
    return list(rows)


async def create_split_rule(
    db: AsyncSession,
    vendor_id: UUID,
    name: str,
    dimension: str,
    base_account_types: list[str],
    split_method: str = "proportional",
) -> FinSplitRule:
    rule = FinSplitRule(
        vendor_id=vendor_id, name=name,
        dimension=dimension, split_method=split_method,
    )
    db.add(rule)
    await db.flush()
    for acct_type in base_account_types:
        db.add(FinSplitRuleBase(rule_id=rule.id, account_type=acct_type))
    await db.flush()
    return rule


async def delete_split_rule(db: AsyncSession, rule_id: UUID, vendor_id: UUID) -> None:
    rule = (await db.execute(
        select(FinSplitRule).where(
            FinSplitRule.id == rule_id, FinSplitRule.vendor_id == vendor_id
        )
    )).scalar_one_or_none()
    if not rule:
        raise ValueError("Split rule not found")
    await db.delete(rule)
    await db.flush()


# ─────────────────────────────────────────────────────────────────────────────
# Splitting Engine
# ─────────────────────────────────────────────────────────────────────────────

def _dim_value(line: FinJournalLine, dimension: str) -> Any:
    """Return the dimension key for the given line."""
    if dimension == "profit_center":
        return line.profit_center_id
    if dimension == "segment":
        return line.segment_id
    if dimension == "cost_center":
        return line.cost_center_id
    return None


def _proportional_weights(
    base_lines: list[FinJournalLine],
    dimension: str,
) -> dict[Any, Decimal]:
    """Build {dim_value: weight} from base lines."""
    weights: dict[Any, Decimal] = {}
    for line in base_lines:
        dim_val = _dim_value(line, dimension)
        amount = abs(Decimal(str(line.debit or 0)) - Decimal(str(line.credit or 0)))
        weights[dim_val] = weights.get(dim_val, Decimal(0)) + amount
    return weights


def _allocate(
    total: Decimal,
    weights: dict[Any, Decimal],
) -> dict[Any, Decimal]:
    """Allocate `total` across dimension values proportional to `weights`.
    Uses the largest-remainder method to ensure exact sum."""
    total_weight = sum(weights.values())
    if total_weight == 0:
        # Equal split as fallback
        n = len(weights)
        each = (total / n).quantize(CENT, rounding=ROUND_HALF_UP) if n else Decimal(0)
        return {k: each for k in weights}

    raw: dict[Any, Decimal] = {}
    for k, w in weights.items():
        raw[k] = (total * w / total_weight).quantize(CENT, rounding=ROUND_HALF_UP)

    # Fix rounding remainder
    diff = total - sum(raw.values())
    if diff != 0:
        # Apply remainder to the key with the largest absolute weight
        largest = max(weights, key=lambda k: weights[k])
        raw[largest] += diff

    return raw


async def apply_document_splitting(
    db: AsyncSession,
    vendor_id: UUID,
    journal_entry_id: UUID,
) -> list[FinJournalSplitItem]:
    """
    Apply all active split rules to the journal entry.
    Returns a list of FinJournalSplitItem records created.
    """
    rules = (await db.execute(
        select(FinSplitRule).where(
            FinSplitRule.vendor_id == vendor_id,
            FinSplitRule.is_active == True,
        ).options(selectinload(FinSplitRule.base_types))
    )).scalars().all()

    if not rules:
        return []

    # Load all lines for this JE
    lines = (await db.execute(
        select(FinJournalLine)
        .where(FinJournalLine.journal_entry_id == journal_entry_id)
    )).scalars().all()

    created_items: list[FinJournalSplitItem] = []

    for rule in rules:
        base_types = {rb.account_type for rb in rule.base_types}

        # Classify lines
        base_lines: list[FinJournalLine] = []
        clearing_lines: list[FinJournalLine] = []

        for line in lines:
            acc = (await db.execute(
                select(FinAccount).where(FinAccount.id == line.account_id)
            )).scalar_one_or_none()
            if acc and acc.account_type in base_types:
                base_lines.append(line)
            else:
                clearing_lines.append(line)

        if not base_lines or not clearing_lines:
            continue

        weights = _proportional_weights(base_lines, rule.dimension)
        if not weights:
            continue
        total_weight = sum(weights.values())

        # For each clearing line, create split items
        for cl in clearing_lines:
            cl_debit  = Decimal(str(cl.debit  or 0))
            cl_credit = Decimal(str(cl.credit or 0))

            debit_alloc  = _allocate(cl_debit,  weights)
            credit_alloc = _allocate(cl_credit, weights)

            for dim_val, w in weights.items():
                pct = ((w / total_weight) * 100).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

                kwargs: dict[str, Any] = {
                    "journal_line_id": cl.id,
                    "debit":  debit_alloc.get(dim_val, Decimal(0)),
                    "credit": credit_alloc.get(dim_val, Decimal(0)),
                    "split_pct": pct,
                }
                if rule.dimension == "profit_center":
                    kwargs["profit_center_id"] = dim_val
                elif rule.dimension == "segment":
                    kwargs["segment_id"] = dim_val
                elif rule.dimension == "cost_center":
                    kwargs["cost_center_id"] = dim_val

                item = FinJournalSplitItem(**kwargs)
                db.add(item)
                created_items.append(item)

    await db.flush()
    return created_items


async def get_split_items(
    db: AsyncSession,
    journal_entry_id: UUID,
) -> list[FinJournalSplitItem]:
    """Return all split items for a journal entry."""
    line_ids = (await db.execute(
        select(FinJournalLine.id).where(
            FinJournalLine.journal_entry_id == journal_entry_id
        )
    )).scalars().all()

    if not line_ids:
        return []

    items = (await db.execute(
        select(FinJournalSplitItem).where(
            FinJournalSplitItem.journal_line_id.in_(line_ids)
        ).order_by(FinJournalSplitItem.created_at)
    )).scalars().all()
    return list(items)
