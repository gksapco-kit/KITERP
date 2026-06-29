"""
app/services/finance/posting_controls.py

Handles:
  - Tolerance Group enforcement (max line/document amount)
  - Field Status Group validation (required / suppressed fields)
  - Posting Key seed & lookup helpers
"""
from __future__ import annotations

import logging
from decimal import Decimal
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import (
    FinFieldStatusGroup,
    FinFieldStatusRule,
    FinPostingKey,
    FinToleranceGroup,
)

if TYPE_CHECKING:
    pass

log = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# DEFAULT SEED DATA
# ─────────────────────────────────────────────────────────────────────────────

DEFAULT_POSTING_KEYS = [
    # code  name                              side      account_type  reversal
    ("40",  "GL Debit",                       "debit",   None,         "50"),
    ("50",  "GL Credit",                      "credit",  None,         "40"),
    ("01",  "Customer Invoice",               "debit",   None,         "12"),
    ("11",  "Customer Credit Memo",           "credit",  None,         "01"),
    ("12",  "Customer Reverse Invoice",       "credit",  None,         "01"),
    ("15",  "Customer Incoming Payment",      "credit",  None,         "05"),
    ("05",  "Customer Outgoing Payment",      "debit",   None,         "15"),
    ("31",  "Vendor Invoice",                 "credit",  None,         "32"),
    ("32",  "Vendor Reverse Invoice",         "debit",   None,         "31"),
    ("21",  "Vendor Credit Memo",             "debit",   None,         "31"),
    ("25",  "Vendor Outgoing Payment",        "debit",   None,         "35"),
    ("35",  "Vendor Incoming Payment",        "credit",  None,         "25"),
    ("70",  "Asset Debit",                    "debit",   "asset",      "75"),
    ("75",  "Asset Credit",                   "credit",  "asset",      "70"),
]

DEFAULT_FIELD_STATUS_GROUPS = [
    # code   name                            rules: {field: status}
    ("G001", "General (all optional)",       {}),
    ("G002", "Cost center required",         {"cost_center": "required"}),
    ("G003", "Project required",             {"project": "required"}),
    ("G004", "Text required",                {"text": "required"}),
    ("G005", "Suppress cost center",         {"cost_center": "suppressed"}),
    ("G006", "P&L account (CC + text req)",  {"cost_center": "required", "text": "required"}),
]

DEFAULT_TOLERANCE_GROUP = {
    "code": "",
    "name": "Default Tolerance Group",
    "max_line_amount": None,      # unlimited
    "max_document_amount": None,  # unlimited
    "payment_diff_abs": Decimal("5.00"),
    "payment_diff_pct": Decimal("1.0000"),
    "currency": "INR",
}


async def seed_default_posting_keys(db: AsyncSession, vendor_id: UUID) -> None:
    """Create the standard posting keys for vendor_id if they don't exist."""
    existing = (await db.execute(
        select(FinPostingKey.code).where(FinPostingKey.vendor_id == vendor_id)
    )).scalars().all()
    existing_set = set(existing)

    for code, name, side, acct_type, reversal in DEFAULT_POSTING_KEYS:
        if code in existing_set:
            continue
        db.add(FinPostingKey(
            vendor_id=vendor_id,
            code=code,
            name=name,
            side=side,
            account_type=acct_type,
            reversal_key=reversal,
        ))
    await db.flush()


async def seed_default_field_status_groups(db: AsyncSession, vendor_id: UUID) -> dict[str, UUID]:
    """Create the default Field Status Groups; return {code: id} mapping."""
    existing_rows = (await db.execute(
        select(FinFieldStatusGroup.code, FinFieldStatusGroup.id)
        .where(FinFieldStatusGroup.vendor_id == vendor_id)
    )).all()
    existing = {row[0]: row[1] for row in existing_rows}
    result: dict[str, UUID] = dict(existing)

    for code, name, rules in DEFAULT_FIELD_STATUS_GROUPS:
        if code in existing:
            continue
        fsg = FinFieldStatusGroup(vendor_id=vendor_id, code=code, name=name)
        db.add(fsg)
        await db.flush()
        for field_name, status in rules.items():
            db.add(FinFieldStatusRule(group_id=fsg.id, field_name=field_name, status=status))
        result[code] = fsg.id

    await db.flush()
    return result


async def seed_default_tolerance_group(db: AsyncSession, vendor_id: UUID) -> UUID:
    """Create the default (empty-code) tolerance group if it doesn't exist; return its id."""
    existing = (await db.execute(
        select(FinToleranceGroup).where(
            FinToleranceGroup.vendor_id == vendor_id,
            FinToleranceGroup.code == "",
        )
    )).scalar_one_or_none()
    if existing:
        return existing.id

    tg = FinToleranceGroup(vendor_id=vendor_id, **DEFAULT_TOLERANCE_GROUP)
    db.add(tg)
    await db.flush()
    return tg.id


# ─────────────────────────────────────────────────────────────────────────────
# ENFORCEMENT
# ─────────────────────────────────────────────────────────────────────────────

async def get_effective_tolerance(
    db: AsyncSession,
    vendor_id: UUID,
    user_tolerance_group_id: UUID | None,
) -> FinToleranceGroup | None:
    """Return the tolerance group for the given user (falls back to default group)."""
    if user_tolerance_group_id:
        tg = (await db.execute(
            select(FinToleranceGroup).where(FinToleranceGroup.id == user_tolerance_group_id)
        )).scalar_one_or_none()
        if tg:
            return tg

    return (await db.execute(
        select(FinToleranceGroup).where(
            FinToleranceGroup.vendor_id == vendor_id,
            FinToleranceGroup.code == "",
        )
    )).scalar_one_or_none()


async def enforce_tolerance(
    db: AsyncSession,
    vendor_id: UUID,
    lines: list[dict[str, Any]],
    user_tolerance_group_id: UUID | None = None,
) -> None:
    """
    Raise ValueError if any line or the whole document exceeds the configured limits.
    `lines` is a list of dicts with keys: amount (Decimal), debit (bool).
    """
    tg = await get_effective_tolerance(db, vendor_id, user_tolerance_group_id)
    if tg is None:
        return  # no limits configured

    total = Decimal(0)
    for line in lines:
        amt = Decimal(str(line.get("amount", 0)))
        if tg.max_line_amount is not None and amt > tg.max_line_amount:
            raise ValueError(
                f"Line amount {amt} exceeds the tolerance limit of {tg.max_line_amount} {tg.currency}."
            )
        total += amt

    if tg.max_document_amount is not None and total > tg.max_document_amount:
        raise ValueError(
            f"Document total {total} exceeds the tolerance limit of {tg.max_document_amount} {tg.currency}."
        )


async def get_field_status_rules(
    db: AsyncSession,
    group_id: UUID,
) -> dict[str, str]:
    """Return {field_name: status} for the given Field Status Group."""
    rows = (await db.execute(
        select(FinFieldStatusRule.field_name, FinFieldStatusRule.status)
        .where(FinFieldStatusRule.group_id == group_id)
    )).all()
    return {row[0]: row[1] for row in rows}


async def enforce_field_status(
    db: AsyncSession,
    account_field_status_group_id: UUID | None,
    line_data: dict[str, Any],
) -> None:
    """
    Raise ValueError when a required field is missing or a suppressed field is provided.
    line_data keys checked: cost_center_id, project_id, assignment, text, payment_terms, tax_code.
    """
    if account_field_status_group_id is None:
        return  # no FSG configured → all optional

    rules = await get_field_status_rules(db, account_field_status_group_id)
    field_map = {
        "cost_center":    line_data.get("cost_center_id"),
        "project":        line_data.get("project_id"),
        "assignment":     line_data.get("assignment"),
        "text":           line_data.get("text"),
        "payment_terms":  line_data.get("payment_terms"),
        "tax_code":       line_data.get("tax_code"),
    }

    for field_name, status in rules.items():
        value = field_map.get(field_name)
        if status == "required" and not value:
            raise ValueError(
                f"Field '{field_name}' is required by the account's Field Status Group."
            )
        if status == "suppressed" and value:
            raise ValueError(
                f"Field '{field_name}' is suppressed by the account's Field Status Group "
                "and must not be provided."
            )
