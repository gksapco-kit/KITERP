"""Look up a vendor document by its human-readable number (PO / PR / invoice)."""
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


async def lookup_id_by_number(
    db: AsyncSession,
    model,
    number_col,
    vendor_id: UUID,
    number: str,
    extra_filters: list | None = None,
) -> tuple[UUID | None, str]:
    """Return (id, status) where status is exact | partial | missing | ambiguous | empty."""
    needle = (number or "").strip()
    if not needle:
        return None, "empty"
    filters = [model.vendor_id == vendor_id, *(extra_filters or [])]
    exact = await db.execute(
        select(model.id).where(*filters, func.lower(number_col) == needle.lower()).limit(3)
    )
    ids = [row[0] for row in exact.all()]
    if len(ids) == 1:
        return ids[0], "exact"
    if len(ids) > 1:
        return None, "ambiguous"
    like = await db.execute(
        select(model.id).where(*filters, number_col.ilike(f"%{needle}%")).limit(5)
    )
    ids = [row[0] for row in like.all()]
    if len(ids) == 1:
        return ids[0], "partial"
    if len(ids) > 1:
        return None, "ambiguous"
    return None, "missing"


def lookup_http_error(status: str, doc_label: str) -> HTTPException:
    if status == "empty":
        return HTTPException(status_code=400, detail=f"Enter a {doc_label} number")
    if status == "ambiguous":
        return HTTPException(
            status_code=400,
            detail=f"Multiple {doc_label}s match that number — enter the full number",
        )
    return HTTPException(status_code=404, detail=f"{doc_label} not found")
