"""Reject cart and checkout quantities outside each variant's per-order limits."""

from __future__ import annotations

from collections import defaultdict
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vendor_product import Product, ProductVariant


def _uuid(value) -> UUID | None:
    if not value:
        return None
    try:
        return value if isinstance(value, UUID) else UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        return None


def quantity_limit_error(
    *,
    name: str,
    qty: int,
    minimum: int | None,
    maximum: int | None,
) -> str | None:
    """Return a customer-facing error when qty is outside the saved limits."""
    if qty <= 0:
        return None
    if minimum and int(minimum) > 1 and qty < int(minimum):
        return f"Minimum {int(minimum)} of {name} required per order."
    if maximum and int(maximum) > 0 and qty > int(maximum):
        return f"Maximum {int(maximum)} of {name} allowed per order."
    return None


async def assert_order_quantity_limits(
    db: AsyncSession,
    vendor_id: UUID,
    items: list,
) -> None:
    """Raise 422 when a product line is below its minimum or above its maximum."""
    groups: dict[tuple[str, str], dict] = {}
    for raw in items or []:
        item = raw if isinstance(raw, dict) else {}
        if item.get("item_type") == "service":
            continue
        if item.get("service_id") and not item.get("product_id"):
            continue
        product_id = _uuid(item.get("product_id"))
        if not product_id:
            continue
        variant_id = _uuid(item.get("variant_id"))
        key = (str(product_id), str(variant_id) if variant_id else "")
        bucket = groups.setdefault(
            key,
            {
                "qty": 0,
                "name": item.get("name") or "This item",
                "product_id": product_id,
                "variant_id": variant_id,
            },
        )
        try:
            bucket["qty"] += int(item.get("qty") or 0)
        except (TypeError, ValueError):
            continue
        if item.get("name"):
            bucket["name"] = item["name"]

    if not groups:
        return

    product_ids = {bucket["product_id"] for bucket in groups.values()}
    result = await db.execute(
        select(ProductVariant)
        .join(Product, Product.id == ProductVariant.product_id)
        .where(
            Product.vendor_id == vendor_id,
            ProductVariant.product_id.in_(product_ids),
        )
    )
    variants = list(result.scalars().all())
    by_id = {variant.id: variant for variant in variants}
    by_product: dict[UUID, list[ProductVariant]] = defaultdict(list)
    for variant in variants:
        if variant.is_active is False:
            continue
        by_product[variant.product_id].append(variant)

    for bucket in groups.values():
        variant = by_id.get(bucket["variant_id"]) if bucket["variant_id"] else None
        minimum = variant.min_quantity_per_order if variant is not None else None
        maximum = variant.max_quantity_per_order if variant is not None else None
        if variant is None:
            owned = by_product.get(bucket["product_id"]) or []
            if len(owned) == 1:
                minimum = owned[0].min_quantity_per_order
                maximum = owned[0].max_quantity_per_order
            else:
                mins = {v.min_quantity_per_order for v in owned if v.min_quantity_per_order}
                maxes = {v.max_quantity_per_order for v in owned if v.max_quantity_per_order}
                minimum = next(iter(mins)) if len(mins) == 1 else None
                maximum = next(iter(maxes)) if len(maxes) == 1 else None
        message = quantity_limit_error(
            name=str(bucket["name"]),
            qty=int(bucket["qty"]),
            minimum=minimum,
            maximum=maximum,
        )
        if message:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=message,
            )
