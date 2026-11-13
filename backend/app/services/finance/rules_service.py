"""
app/services/finance/rules_service.py

Validation rules, substitution rules, and document number ranges.
SAP equivalents: GGB0 / GGB1 / FBN1.
"""
from __future__ import annotations

import ast
import logging
import operator
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import (
    FinDocumentType,
    FinNumberRange,
    FinSubstitutionRule,
    FinValidationRule,
)

log = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Safe expression evaluator — AST-walking, NO eval()
# ─────────────────────────────────────────────────────────────────────────────
# Supports: literals, names from context, arithmetic (+−×÷%), comparisons,
# boolean operators (and/or/not), ternary (x if c else y), None/True/False,
# and a small set of whitelisted calls: abs, bool, float, int, len, max, min,
# round, str.  Attribute access, subscripts and all other node types are blocked.

_ALLOWED_CALLS = {
    "abs": abs,
    "bool": bool,
    "float": float,
    "int": int,
    "len": len,
    "max": max,
    "min": min,
    "round": round,
    "str": str,
}

_BINOP_MAP: dict[type, Any] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.FloorDiv: operator.floordiv,
}

_CMPOP_MAP: dict[type, Any] = {
    ast.Eq: operator.eq,
    ast.NotEq: operator.ne,
    ast.Lt: operator.lt,
    ast.LtE: operator.le,
    ast.Gt: operator.gt,
    ast.GtE: operator.ge,
    ast.Is: operator.is_,
    ast.IsNot: operator.is_not,
    ast.In: lambda a, b: a in b,
    ast.NotIn: lambda a, b: a not in b,
}

_UNARYOP_MAP: dict[type, Any] = {
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
    ast.Not: operator.not_,
}


class _SafeEvalError(Exception):
    pass


def _eval_node(node: ast.AST, ctx: dict[str, Any]) -> Any:
    if isinstance(node, ast.Constant):
        return node.value

    if isinstance(node, ast.Name):
        name = node.id
        if name == "None":
            return None
        if name == "True":
            return True
        if name == "False":
            return False
        if name in ctx:
            return ctx[name]
        raise _SafeEvalError(f"Unknown name: {name!r}")

    if isinstance(node, ast.BinOp):
        op_fn = _BINOP_MAP.get(type(node.op))
        if not op_fn:
            raise _SafeEvalError(f"Unsupported binary operator: {type(node.op).__name__}")
        return op_fn(_eval_node(node.left, ctx), _eval_node(node.right, ctx))

    if isinstance(node, ast.UnaryOp):
        op_fn = _UNARYOP_MAP.get(type(node.op))
        if not op_fn:
            raise _SafeEvalError(f"Unsupported unary operator: {type(node.op).__name__}")
        return op_fn(_eval_node(node.operand, ctx))

    if isinstance(node, ast.Compare):
        left = _eval_node(node.left, ctx)
        for op, comparator in zip(node.ops, node.comparators):
            op_fn = _CMPOP_MAP.get(type(op))
            if not op_fn:
                raise _SafeEvalError(f"Unsupported comparison: {type(op).__name__}")
            right = _eval_node(comparator, ctx)
            if not op_fn(left, right):
                return False
            left = right
        return True

    if isinstance(node, ast.BoolOp):
        if isinstance(node.op, ast.And):
            for v in node.values:
                if not _eval_node(v, ctx):
                    return False
            return True
        if isinstance(node.op, ast.Or):
            for v in node.values:
                if _eval_node(v, ctx):
                    return True
            return False
        raise _SafeEvalError("Unsupported boolean operator")

    if isinstance(node, ast.IfExp):
        test = _eval_node(node.test, ctx)
        return _eval_node(node.body, ctx) if test else _eval_node(node.orelse, ctx)

    if isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name):
            raise _SafeEvalError("Only simple function calls allowed")
        fn_name = node.func.id
        fn = _ALLOWED_CALLS.get(fn_name)
        if not fn:
            raise _SafeEvalError(f"Function not allowed: {fn_name!r}")
        args = [_eval_node(a, ctx) for a in node.args]
        return fn(*args)

    if isinstance(node, ast.Expression):
        return _eval_node(node.body, ctx)

    raise _SafeEvalError(f"Disallowed expression node: {type(node).__name__}")


def _eval_expr(expr: str, context: dict[str, Any]) -> Any:
    """
    Safely evaluate a simple expression string against a context dict.
    Uses an AST walker — eval() is NOT called.
    Returns None on any error (parse error, unknown name, disallowed node, etc.).
    """
    try:
        tree = ast.parse(expr.strip(), mode="eval")
        return _eval_node(tree, context)
    except _SafeEvalError as exc:
        log.warning("Expression blocked (%r): %s", expr, exc)
        return None
    except SyntaxError as exc:
        log.warning("Expression syntax error (%r): %s", expr, exc)
        return None
    except Exception as exc:
        log.warning("Expression eval failed (%r): %s", expr, exc)
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
# Document Types (SAP OBA7)
# ─────────────────────────────────────────────────────────────────────────────

DEFAULT_DOCUMENT_TYPES = [
    # code  name                        prefix  reverse  sort
    ("SA",  "G/L Account Document",     "JV",   None,    10),
    ("DR",  "Customer Invoice",         "ARJ",  "DG",    20),
    ("DG",  "Customer Credit Memo",     "CNJ",  "DR",    30),
    ("RE",  "Sales Return",             "SRJ",  None,    40),
    ("DZ",  "Customer Payment",         "CRJ",  None,    50),
    ("KR",  "Vendor Invoice",           "APJ",  None,    60),
    ("KZ",  "Vendor Payment",           "VPJ",  None,    70),
    ("AB",  "Accounting Document",      None,   None,    80),
    ("MNL", "Manual Journal",           "MNL",  None,    90),
]


async def seed_default_document_types(
    db: AsyncSession,
    vendor_id: UUID,
) -> list[FinDocumentType]:
    existing = {
        row[0] for row in (await db.execute(
            select(FinDocumentType.code).where(FinDocumentType.vendor_id == vendor_id)
        )).all()
    }
    created: list[FinDocumentType] = []
    for code, name, prefix, reversal, sort_order in DEFAULT_DOCUMENT_TYPES:
        if code in existing:
            continue
        dt = FinDocumentType(
            vendor_id=vendor_id,
            code=code,
            name=name,
            number_range_prefix=prefix,
            reversal_doc_type=reversal,
            sort_order=sort_order,
            is_active=True,
        )
        db.add(dt)
        created.append(dt)
    await db.flush()
    return created


async def list_document_types(
    db: AsyncSession,
    vendor_id: UUID,
    *,
    active_only: bool = False,
) -> list[FinDocumentType]:
    q = select(FinDocumentType).where(FinDocumentType.vendor_id == vendor_id)
    if active_only:
        q = q.where(FinDocumentType.is_active == True)  # noqa: E712
    q = q.order_by(FinDocumentType.sort_order, FinDocumentType.code)
    return list((await db.execute(q)).scalars().all())


async def get_document_type(
    db: AsyncSession, dt_id: UUID, vendor_id: UUID
) -> FinDocumentType | None:
    return (await db.execute(
        select(FinDocumentType).where(
            FinDocumentType.id == dt_id,
            FinDocumentType.vendor_id == vendor_id,
        )
    )).scalar_one_or_none()


async def create_document_type(
    db: AsyncSession,
    vendor_id: UUID,
    *,
    code: str,
    name: str,
    description: str | None = None,
    number_range_prefix: str | None = None,
    reversal_doc_type: str | None = None,
    is_active: bool = True,
    sort_order: int = 10,
) -> FinDocumentType:
    code = (code or "").strip().upper()
    if not code or len(code) > 4:
        raise ValueError("Document type code must be 1–4 characters.")
    dup = (await db.execute(
        select(FinDocumentType.id).where(
            FinDocumentType.vendor_id == vendor_id,
            FinDocumentType.code == code,
        )
    )).scalar_one_or_none()
    if dup:
        raise ValueError(f"Document type '{code}' already exists.")
    dt = FinDocumentType(
        vendor_id=vendor_id,
        code=code,
        name=name.strip(),
        description=description,
        number_range_prefix=(number_range_prefix or None),
        reversal_doc_type=(reversal_doc_type or None),
        is_active=is_active,
        sort_order=sort_order,
    )
    db.add(dt)
    await db.flush()
    return dt


async def update_document_type(
    db: AsyncSession,
    dt_id: UUID,
    vendor_id: UUID,
    **kwargs: Any,
) -> FinDocumentType:
    dt = await get_document_type(db, dt_id, vendor_id)
    if not dt:
        raise LookupError("Document type not found.")
    if "code" in kwargs and kwargs["code"] is not None:
        new_code = str(kwargs["code"]).strip().upper()
        if not new_code or len(new_code) > 4:
            raise ValueError("Document type code must be 1–4 characters.")
        if new_code != dt.code:
            dup = (await db.execute(
                select(FinDocumentType.id).where(
                    FinDocumentType.vendor_id == vendor_id,
                    FinDocumentType.code == new_code,
                    FinDocumentType.id != dt_id,
                )
            )).scalar_one_or_none()
            if dup:
                raise ValueError(f"Document type '{new_code}' already exists.")
            kwargs["code"] = new_code
    for k, v in kwargs.items():
        if hasattr(dt, k) and k != "id" and k != "vendor_id":
            setattr(dt, k, v)
    await db.flush()
    return dt


async def delete_document_type(
    db: AsyncSession, dt_id: UUID, vendor_id: UUID
) -> None:
    dt = await get_document_type(db, dt_id, vendor_id)
    if not dt:
        raise LookupError("Document type not found.")
    in_use = (await db.execute(
        select(FinNumberRange.id).where(
            FinNumberRange.vendor_id == vendor_id,
            FinNumberRange.document_type == dt.code,
        ).limit(1)
    )).scalar_one_or_none()
    if in_use:
        raise ValueError(
            f"Cannot delete '{dt.code}' — number range(s) still reference it. "
            "Deactivate it instead, or delete the number ranges first."
        )
    await db.delete(dt)
    await db.flush()


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


async def get_number_range(
    db: AsyncSession, nr_id: UUID, vendor_id: UUID
) -> FinNumberRange | None:
    return (await db.execute(
        select(FinNumberRange).where(
            FinNumberRange.id == nr_id,
            FinNumberRange.vendor_id == vendor_id,
        )
    )).scalar_one_or_none()


async def update_number_range(
    db: AsyncSession,
    nr_id: UUID,
    vendor_id: UUID,
    *,
    document_type: str,
    fiscal_year: int,
    number_from: int,
    number_to: int,
    prefix: str | None = None,
    is_external: bool = False,
    current_number: int | None = None,
) -> FinNumberRange:
    nr = await get_number_range(db, nr_id, vendor_id)
    if not nr:
        raise ValueError("Number range not found")
    if number_to <= number_from:
        raise ValueError("number_to must be greater than number_from")

    next_current = current_number if current_number is not None else nr.current_number
    if next_current < number_from or next_current > number_to + 1:
        raise ValueError(
            f"current_number must be between {number_from} and {number_to + 1}"
        )

    # Guard unique (vendor, document_type, fiscal_year) when keys change
    if document_type != nr.document_type or fiscal_year != nr.fiscal_year:
        clash = (await db.execute(
            select(FinNumberRange.id).where(
                FinNumberRange.vendor_id == vendor_id,
                FinNumberRange.document_type == document_type,
                FinNumberRange.fiscal_year == fiscal_year,
                FinNumberRange.id != nr_id,
            )
        )).scalar_one_or_none()
        if clash:
            raise ValueError(
                f"A number range for '{document_type}' FY {fiscal_year} already exists"
            )

    nr.document_type = document_type
    nr.fiscal_year = fiscal_year
    nr.number_from = number_from
    nr.number_to = number_to
    nr.prefix = prefix
    nr.is_external = is_external
    nr.current_number = next_current
    await db.flush()
    return nr


async def delete_number_range(db: AsyncSession, nr_id: UUID, vendor_id: UUID) -> None:
    nr = await get_number_range(db, nr_id, vendor_id)
    if not nr:
        raise ValueError("Number range not found")
    await db.delete(nr)
    await db.flush()
