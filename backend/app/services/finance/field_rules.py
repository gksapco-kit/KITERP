"""
Merge field rules (GL default → company → user) and validate journal payloads.
"""
from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.finance.finance_repo import FinCOARepo


async def effective_field_rules(
    db: AsyncSession,
    vendor_id: UUID,
    entity_type: str,
    company_id: Optional[UUID],
    vendor_user_id: Optional[UUID],
) -> dict[str, str]:
    repo = FinCOARepo(db)
    rows = [r for r in await repo.list_field_rules(vendor_id) if r.entity_type == entity_type]
    return merge_effective_rules_flat_rows(rows, entity_type, company_id, vendor_user_id)


def merge_effective_rules_flat_rows(
    rows: list,
    entity_type: str,
    company_id: Optional[UUID],
    vendor_user_id: Optional[UUID],
) -> dict[str, str]:
    rows = [r for r in rows if r.entity_type == entity_type]
    m: dict[str, str] = {}
    for r in rows:
        if r.scope == "gl":
            m[r.field_key] = r.requirement
    for r in rows:
        if r.scope == "company" and company_id and r.company_id == company_id:
            m[r.field_key] = r.requirement
    for r in rows:
        if r.scope == "user" and vendor_user_id and r.vendor_user_id == vendor_user_id:
            m[r.field_key] = r.requirement
    return m


def _val(payload: Any, key: str) -> Any:
    if key == "header.reference":
        return getattr(payload, "reference", None)
    if key == "header.narration":
        return getattr(payload, "narration", None)
    if key == "header.header_text":
        return getattr(payload, "header_text", None)
    if key == "header.document_date":
        return getattr(payload, "document_date", None)
    if key == "header.entry_date":
        return getattr(payload, "entry_date", None)
    return None


def assert_journal_mandatory(
    payload: Any,
    rules: dict[str, str],
) -> None:
    for field_key, req in rules.items():
        if req != "mandatory":
            continue
        v = _val(payload, field_key)
        is_empty = v is None or (isinstance(v, str) and not str(v).strip())
        if is_empty:
            pretty = field_key.replace("header.", "").replace("_", " ")
            raise ValueError(f"Field '{pretty}' is required by your field configuration.")
