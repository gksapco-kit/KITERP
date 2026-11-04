"""Checks that stop other modules from pulling products out from under Production."""
from __future__ import annotations

from typing import List
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mrp import ProductBOMItem
from app.models.production import ProductionOrder
from app.models.vendor_product import Product

_OPEN_STATUSES = ("draft", "confirmed", "in_production", "qc", "on_hold")


async def product_production_blockers(db: AsyncSession, vendor_id: UUID, product_id: UUID) -> List[str]:
    """Human-readable reasons a product cannot be deleted: it is a component of another
    product's BOM, or it is on an open production order."""
    reasons: List[str] = []
    pid = str(product_id)

    parents = (await db.execute(
        select(Product.name)
        .join(ProductBOMItem, ProductBOMItem.product_id == Product.id)
        .where(
            ProductBOMItem.vendor_id == vendor_id,
            ProductBOMItem.component_id == product_id,
            Product.deleted_at.is_(None),
        )
        .distinct()
        .limit(6)
    )).scalars().all()
    if parents:
        shown = ", ".join(parents[:5]) + ("…" if len(parents) > 5 else "")
        reasons.append(f"it is a component in the BOM of {shown}")

    refs = []
    rows = (await db.execute(
        select(ProductionOrder.ref, ProductionOrder.items, ProductionOrder.material_requirements).where(
            ProductionOrder.vendor_id == vendor_id,
            ProductionOrder.status.in_(_OPEN_STATUSES),
        )
    )).all()
    for ref, items, reqs in rows:
        in_items = any(isinstance(i, dict) and str(i.get("product_id")) == pid for i in (items or []))
        in_reqs = any(isinstance(r, dict) and str(r.get("component_id")) == pid for r in (reqs or []))
        if in_items or in_reqs:
            refs.append(ref)
    if refs:
        shown = ", ".join(refs[:5]) + ("…" if len(refs) > 5 else "")
        reasons.append(f"it is used by open production orders ({shown})")
    return reasons
