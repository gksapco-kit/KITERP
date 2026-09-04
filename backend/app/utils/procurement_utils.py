# app/utils/procurement_utils.py
"""
Shared helpers used across all procurement modules.

  append_audit_log  – type-safe mutation of JSONB audit trails
  guard_transition  – status-machine guard with informative 400 errors
  next_doc_number   – race-safe per-tenant document numbering via SELECT FOR UPDATE
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

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

async def next_doc_number(
    db: AsyncSession,
    vendor_id: UUID,
    prefix: str,
    width: int = 6,
) -> str:
    """Return the next formatted document number for (vendor_id, prefix).

    Uses SELECT … FOR UPDATE on the DocumentSequence row so concurrent
    requests block rather than collide. Creates the sequence row on first
    use (INSERT … ON CONFLICT DO NOTHING then re-selects).

    Example return values: "PR-000001", "PO-0001", "RFQ-000001"
    """
    # Try to fetch and lock the existing row
    result = await db.execute(
        select(DocumentSequence)
        .where(
            DocumentSequence.vendor_id == vendor_id,
            DocumentSequence.prefix == prefix,
        )
        .with_for_update()
    )
    seq: DocumentSequence | None = result.scalar_one_or_none()

    if seq is None:
        # First use – bootstrap the row.  Use raw INSERT … ON CONFLICT so
        # two simultaneous "first" requests don't both try to INSERT.
        # Must supply `id` explicitly because the Python-side default=uuid.uuid4
        # is not applied by the database engine for raw SQL statements.
        await db.execute(
            text(
                "INSERT INTO proc_document_sequence (id, vendor_id, prefix, last_value, width) "
                "VALUES (:id, :vid, :pfx, 0, :w) "
                "ON CONFLICT (vendor_id, prefix) DO NOTHING"
            ),
            {"id": str(uuid4()), "vid": str(vendor_id), "pfx": prefix, "w": width},
        )
        result = await db.execute(
            select(DocumentSequence)
            .where(
                DocumentSequence.vendor_id == vendor_id,
                DocumentSequence.prefix == prefix,
            )
            .with_for_update()
        )
        seq = result.scalar_one()

    seq.last_value += 1
    await db.flush()  # write within open transaction; caller commits
    return f"{prefix}-{str(seq.last_value).zfill(width)}"
