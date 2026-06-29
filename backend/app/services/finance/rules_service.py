"""
app/services/finance/rules_service.py

Validation rules, substitution rules, and document number ranges.
SAP equivalents: GGB0 / GGB1 / FBN1.
"""
from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import FinNumberRange, FinSubstitutionRule, FinValidationRule

log = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Expression evaluation helpers
# ─────────────────────────────────────────────────────────────────────────────

# Allowed builtins for safe expression evaluation
_SAFE_BUILTINS = {
    "abs": abs, "bool": bool, "float": float, "int": int,
    "len": len, "max": max, "min": min, "round": round, "str": str,
    "True": True, "False": False, "None": None,
}


def _eval_expr(expr: str, context: dict[str, Any]) -> Any:
    """Evaluate a simple Python expression in a restricted namespace."""
    try:
        return eval(expr, {"__builtins__": _SAFE_BUILTINS}, context)  # noqa: S307
    except Exception as exc:
        log.warning("Expression eval failed (%s): %s", expr, exc)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Validation Rules
# ─────────────────────────────────────────────────────────────────────────────

async def list_validation_rules(db: AsyncSession, vendor_id: UUID) -> list[FinValidationRule]:
    rows = (await db.execute(
        select(FinValidationRule)
        .where(FinValidationRule.vendor_id == vendor_id)
        .order_by(FinValidationRule.sort_order, FinValidationRule.created_at)
    )).scalars().all()
    return list(rows)


async def create_validation_rule(db: AsyncSession, vendor_id: UUID, **kwargs: Any) -> FinValidationRule:
    rule = FinValidationRule(vendor_id=vendor_id, **kwargs)
    db.add(rule)
    await db.flush()
    return rule


async def update_validation_rule(db: AsyncSession, rule_id: UUID, vendor_id: UUID, **kwargs: Any) -> FinValidationRule:
    rule = (await db.execute(
        select(FinValidationRule).where(
            FinValidationRule.id == rule_id, FinValidationRule.vendor_id == vendor_id
        )
    )).scalar_one_or_none()
    if not rule:
        raise ValueError("Validation rule not found")
    for k, v in kwargs.items():
        if hasattr(rule, k):
            setattr(rule, k, v)
    await db.flush()
    return rule


async def delete_validation_rule(db: AsyncSession, rule_id: UUID, vendor_id: UUID) -> None:
    rule = (await db.execute(
        select(FinValidationRule).where(
            FinValidationRule.id == rule_id, FinValidationRule.vendor_id == vendor_id
        )
    )).scalar_one_or_none()
    if not rule:
        raise ValueError("Validation rule not found")
    await db.delete(rule)
    await db.flush()


async def run_validations(
    db: AsyncSession,
    vendor_id: UUID,
    call_point: str,
    context: dict[str, Any],
) -> None:
    """
    Evaluate all active validation rules for vendor_id at the given call_point.
    Raises ValueError with the rule's error_message if any check fails.
    """
    rules = (await db.execute(
        select(FinValidationRule).where(
            FinValidationRule.vendor_id == vendor_id,
            FinValidationRule.call_point == call_point,
            FinValidationRule.is_active == True,
        ).order_by(FinValidationRule.sort_order)
    )).scalars().all()

    for rule in rules:
        # Skip if prerequisite is defined and not met
        if rule.prerequisite_expr:
            prereq = _eval_expr(rule.prerequisite_expr, context)
            if not prereq:
                continue

        # Run the check
        result = _eval_expr(rule.check_expr, context)
        if not result:
            raise ValueError(f"[Validation: {rule.name}] {rule.error_message}")


# ─────────────────────────────────────────────────────────────────────────────
# Substitution Rules
# ─────────────────────────────────────────────────────────────────────────────

async def list_substitution_rules(db: AsyncSession, vendor_id: UUID) -> list[FinSubstitutionRule]:
    rows = (await db.execute(
        select(FinSubstitutionRule)
        .where(FinSubstitutionRule.vendor_id == vendor_id)
        .order_by(FinSubstitutionRule.sort_order, FinSubstitutionRule.created_at)
    )).scalars().all()
    return list(rows)


async def create_substitution_rule(db: AsyncSession, vendor_id: UUID, **kwargs: Any) -> FinSubstitutionRule:
    rule = FinSubstitutionRule(vendor_id=vendor_id, **kwargs)
    db.add(rule)
    await db.flush()
    return rule


async def delete_substitution_rule(db: AsyncSession, rule_id: UUID, vendor_id: UUID) -> None:
    rule = (await db.execute(
        select(FinSubstitutionRule).where(
            FinSubstitutionRule.id == rule_id, FinSubstitutionRule.vendor_id == vendor_id
        )
    )).scalar_one_or_none()
    if not rule:
        raise ValueError("Substitution rule not found")
    await db.delete(rule)
    await db.flush()


async def apply_substitutions(
    db: AsyncSession,
    vendor_id: UUID,
    call_point: str,
    line_data: dict[str, Any],
) -> dict[str, Any]:
    """
    Apply active substitution rules to line_data.
    Returns a (potentially modified) copy of line_data.
    Modifies in-place when prerequisite is True.
    """
    rules = (await db.execute(
        select(FinSubstitutionRule).where(
            FinSubstitutionRule.vendor_id == vendor_id,
            FinSubstitutionRule.call_point == call_point,
            FinSubstitutionRule.is_active == True,
        ).order_by(FinSubstitutionRule.sort_order)
    )).scalars().all()

    result = dict(line_data)
    context = dict(result)

    for rule in rules:
        # Check prerequisite
        if rule.prerequisite_expr:
            prereq = _eval_expr(rule.prerequisite_expr, context)
            if not prereq:
                continue

        new_val = _eval_expr(rule.substitution_expr, context)
        result[rule.target_field] = new_val
        context[rule.target_field] = new_val

    return result


# ─────────────────────────────────────────────────────────────────────────────
# Number Ranges
# ─────────────────────────────────────────────────────────────────────────────

DEFAULT_NUMBER_RANGES = [
    # doc_type  from       to         prefix
    ("SA",      1000000,   1999999,   ""),    # GL document
    ("DR",      2000000,   2999999,   ""),    # Customer invoice
    ("KR",      3000000,   3999999,   ""),    # Vendor invoice
    ("AB",      4000000,   4999999,   ""),    # Accounting document
    ("DZ",      5000000,   5999999,   ""),    # Customer payment
    ("KZ",      6000000,   6999999,   ""),    # Vendor payment
]


async def seed_default_number_ranges(
    db: AsyncSession,
    vendor_id: UUID,
    fiscal_year: int,
) -> list[FinNumberRange]:
    existing = {
        row[0] for row in (await db.execute(
            select(FinNumberRange.document_type).where(
                FinNumberRange.vendor_id == vendor_id,
                FinNumberRange.fiscal_year == fiscal_year,
            )
        )).all()
    }
    created = []
    for doc_type, from_no, to_no, prefix in DEFAULT_NUMBER_RANGES:
        if doc_type in existing:
            continue
        nr = FinNumberRange(
            vendor_id=vendor_id,
            document_type=doc_type,
            fiscal_year=fiscal_year,
            number_from=from_no,
            number_to=to_no,
            current_number=from_no,
            prefix=prefix or None,
        )
        db.add(nr)
        created.append(nr)
    await db.flush()
    return created


async def next_document_number(
    db: AsyncSession,
    vendor_id: UUID,
    document_type: str,
    fiscal_year: int,
) -> str:
    """
    Atomically increment current_number and return the formatted document number.
    Raises ValueError when the range is exhausted.
    """
    nr = (await db.execute(
        select(FinNumberRange).where(
            FinNumberRange.vendor_id == vendor_id,
            FinNumberRange.document_type == document_type,
            FinNumberRange.fiscal_year == fiscal_year,
        ).with_for_update()
    )).scalar_one_or_none()

    if not nr:
        raise ValueError(
            f"No number range configured for document type '{document_type}' FY {fiscal_year}."
        )
    if nr.current_number > nr.number_to:
        raise ValueError(
            f"Number range for '{document_type}' FY {fiscal_year} is exhausted "
            f"(max {nr.number_to})."
        )

    doc_no = nr.current_number
    nr.current_number += 1
    await db.flush()

    prefix = nr.prefix or ""
    return f"{prefix}{doc_no}"


async def list_number_ranges(db: AsyncSession, vendor_id: UUID) -> list[FinNumberRange]:
    rows = (await db.execute(
        select(FinNumberRange).where(FinNumberRange.vendor_id == vendor_id)
        .order_by(FinNumberRange.document_type, FinNumberRange.fiscal_year)
    )).scalars().all()
    return list(rows)
