# app/utils/procurement_utils.py
"""
Shared helpers used across all procurement modules.

  append_audit_log  – type-safe mutation of JSONB audit trails
  guard_transition  – status-machine guard with informative 400 errors
  next_doc_number   – race-safe per-tenant document numbering via SELECT FOR UPDATE;
                      syncs the counter to existing max doc numbers when known
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4
import re

from fastapi import HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.procurement_sequence import DocumentSequence


# ─────────────────────────────────────────────────────────────────
# Audit log
# ─────────────────────────────────────────────────────────────────

def append_audit_log(
    obj: Any,
    action: str,
    user_id: UUID | str | None = None,
    **extra: Any,
) -> None:
    """Append a timestamped entry to obj.audit_log (JSONB list, mutated in-place).

    SQLAlchemy will not detect mutable-JSONB mutations unless we reassign
    the attribute; this function handles that correctly.
    """
    entry: dict[str, Any] = {
        "action": action,
        "at": datetime.now(timezone.utc).isoformat(),
    }
    if user_id is not None:
        entry["by"] = str(user_id)
    entry.update(extra)

    current = obj.audit_log if isinstance(obj.audit_log, list) else []
    # Reassign so SQLAlchemy JSONB change tracking detects the mutation
    obj.audit_log = current + [entry]


# ─────────────────────────────────────────────────────────────────
# Status transition guard
# ─────────────────────────────────────────────────────────────────

def guard_transition(
    current_status: str,
    allowed_from: tuple[str, ...] | list[str],
    action: str,
) -> None:
    """Raise HTTP 400 when current_status is not in allowed_from.

    Example:
        guard_transition(po.status, ("draft",), "send")
    """
    if current_status not in allowed_from:
        allowed_str = ", ".join(f'"{s}"' for s in allowed_from)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot perform '{action}' when status is '{current_status}'. "
                f"Allowed from: {allowed_str}."
            ),
        )


# ─────────────────────────────────────────────────────────────────
# Race-safe document number generation
# ─────────────────────────────────────────────────────────────────

# When the sequence counter lags behind rows already in these tables
# (e.g. docs created before proc_document_sequence existed, or a reset
# counter), allocating the next number would hit a unique constraint.
# Map prefix → (table, column) so we can floor the counter to MAX(suffix).
_PREFIX_DOC_SOURCES: dict[str, tuple[str, str]] = {
    "PO": ("purchase_order", "po_number"),
    "PR": ("purchase_requisition", "pr_number"),
    "RFQ": ("rfq", "rfq_number"),
    "SQ": ("supplier_quotation", "quotation_number"),
    "GRN": ("grn", "grn_number"),
    "GRNR": ("grn_reversal", "reversal_number"),
    "PRET": ("purchase_return", "return_number"),
}


async def _max_existing_suffix(
    db: AsyncSession,
    vendor_id: UUID,
    prefix: str,
) -> int:
    """Highest numeric suffix already used for prefix-NNNN docs, or 0."""
    source = _PREFIX_DOC_SOURCES.get(prefix)
    if not source:
        return 0
    table, column = source
    # Whitelisted identifiers only — never interpolate user input here.
    bind = db.get_bind()
    if bind.dialect.name == "postgresql":
        result = await db.execute(
            text(
                f"""
                SELECT COALESCE(MAX(
                    CAST(NULLIF(substring({column} from :pat), '') AS INTEGER)
                ), 0)
                FROM {table}
                WHERE vendor_id = :vid
                  AND {column} ~ :regex
                """
            ),
            {
                "vid": str(vendor_id),
                "pat": f"{prefix}-([0-9]+)",
                "regex": f"^{prefix}-[0-9]+$",
            },
        )
        return int(result.scalar() or 0)

    # SQLite / tests: no Postgres regex — scan matching labels in Python.
    result = await db.execute(
        text(
            f"SELECT {column} FROM {table} "
            f"WHERE vendor_id = :vid AND {column} LIKE :pat"
        ),
        {"vid": str(vendor_id), "pat": f"{prefix}-%"},
    )
    best = 0
    rx = re.compile(rf"^{re.escape(prefix)}-(\d+)$")
    for (label,) in result.all():
        m = rx.match(label or "")
        if m:
            best = max(best, int(m.group(1)))
    return best


async def next_doc_number(
    db: AsyncSession,
    vendor_id: UUID,
    prefix: str,
    width: int = 6,
    *,
    floor: int | None = None,
    store_id: UUID | None = None,
) -> str:
    """Return the next formatted document number for (vendor_id, prefix).

    Uses SELECT … FOR UPDATE on the DocumentSequence row so concurrent
    requests block rather than collide. Creates the sequence row on first
    use (INSERT … ON CONFLICT DO NOTHING then re-selects).

    When ``store_id`` is supplied the lookup first tries a business-unit-specific
    row (store_id = given value); if none exists it falls back to the vendor-level
    row (store_id IS NULL).  This allows per-BU number series to coexist with the
    vendor-wide default series.

    Before incrementing, the counter is raised to at least ``floor`` (or the
    max existing document suffix for known prefixes) so a lagging sequence
    cannot re-issue a number that already exists.

    Example return values: "PR-000001", "PO-0001", "RFQ-000001"
    """
    if floor is None and prefix in _PREFIX_DOC_SOURCES:
        floor = await _max_existing_suffix(db, vendor_id, prefix)

    initial = max(0, floor or 0)

    # ── Helper: lock and return a sequence row ────────────────────
    async def _fetch_locked(sid: UUID | None) -> "DocumentSequence | None":
        q = (
            select(DocumentSequence)
            .where(
                DocumentSequence.vendor_id == vendor_id,
                DocumentSequence.prefix == prefix,
            )
            .with_for_update()
        )
        if sid is None:
            q = q.where(DocumentSequence.store_id.is_(None))
        else:
            q = q.where(DocumentSequence.store_id == sid)
        return (await db.execute(q)).scalar_one_or_none()

    # ── 1. Try BU-specific row if store_id given ──────────────────
    seq: "DocumentSequence | None" = None
    if store_id is not None:
        seq = await _fetch_locked(store_id)

    # ── 2. Fall back to vendor-level row ──────────────────────────
    if seq is None:
        seq = await _fetch_locked(None)

    # ── 3. Bootstrap if still not found ──────────────────────────
    if seq is None:
        await db.execute(
            text(
                "INSERT INTO proc_document_sequence "
                "  (id, vendor_id, store_id, prefix, last_value, width) "
                "VALUES (:id, :vid, NULL, :pfx, :lv, :w) "
                "ON CONFLICT (vendor_id, store_scope, prefix) DO NOTHING"
            ),
            {
                "id": str(uuid4()),
                "vid": str(vendor_id),
                "pfx": prefix,
                "lv": initial,
                "w": width,
            },
        )
        seq = await _fetch_locked(None)
        if seq is None:
            raise RuntimeError(
                f"Failed to bootstrap document sequence for vendor={vendor_id} prefix={prefix}"
            )

    # ── 4. Advance the counter ────────────────────────────────────
    if floor is not None and seq.last_value < floor:
        seq.last_value = floor

    # Respect the configured range width when the sequence row has one
    effective_width = seq.width if seq.width else width

    seq.last_value += 1
    await db.flush()  # write within open transaction; caller commits
    return f"{prefix}-{str(seq.last_value).zfill(effective_width)}"
