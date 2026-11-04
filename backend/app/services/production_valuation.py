"""Stock valuation for Production Orders.

Components are issued at the product's current valuation price and finished
goods are received at the order's actual cost per unit. Both movements go
through ``material_valuation`` (the same table purchase receipts maintain), so a
product's moving-average price reflects what production really cost.

* Issuing a component leaves its moving-average price unchanged (stock and value
  fall by the same unit cost).
* Receiving finished goods at the order's actual unit cost re-averages the price
  for ``moving_average`` products; ``fixed`` / ``standard`` products keep their
  price (only stock/value totals move).
* A reversal replays the same quantity at the same unit cost taken from the
  posting snapshot, which restores the previous average exactly when nothing
  else was priced in between.
"""
from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.procurement_special import MaterialValuation
from app.models.vendor_product import Product

log = logging.getLogger(__name__)

_COST_Q = Decimal("0.0001")
_MONEY_Q = Decimal("0.01")


def dec(value: Any) -> Decimal:
    if value is None:
        return Decimal("0")
    try:
        return Decimal(str(value))
    except Exception:  # noqa: BLE001
        return Decimal("0")


def q_cost(value: Decimal) -> Decimal:
    return value.quantize(_COST_Q)


def q_money(value: Decimal) -> Decimal:
    return value.quantize(_MONEY_Q)


async def resolve_unit_cost(
    db: AsyncSession,
    vendor_id: UUID,
    product_id: UUID,
    plant_id: Optional[UUID],
    fallback: Any = None,
) -> Decimal:
    """Current valuation price of a product (per the product's costing method),
    falling back to its cached cost, then to ``fallback`` (e.g. the cost captured
    when materials were reserved)."""
    from app.services.cost_resolution import resolve_product_cost

    resolved = None
    try:
        resolved = await resolve_product_cost(db, vendor_id, product_id, None, plant_id)
        if resolved is None and plant_id is not None:
            resolved = await resolve_product_cost(db, vendor_id, product_id, None, None)
    except Exception as exc:  # noqa: BLE001 — never block production on a costing lookup
        log.warning("cost resolution failed for product %s: %s", product_id, exc)
    if resolved is not None and resolved.value and resolved.value > 0:
        return q_cost(dec(resolved.value))

    cached = (
        await db.execute(
            select(Product.cost_price).where(Product.id == product_id, Product.vendor_id == vendor_id)
        )
    ).scalar_one_or_none()
    if cached and dec(cached) > 0:
        return q_cost(dec(cached))
    return q_cost(dec(fallback))


async def apply_valuation(
    db: AsyncSession,
    vendor_id: UUID,
    product_id: UUID,
    plant_id: Optional[UUID],
    qty_signed: Decimal,
    unit_cost: Decimal,
) -> None:
    """Move ``qty_signed`` units valued at ``unit_cost`` through material_valuation."""
    qty = dec(qty_signed)
    cost = dec(unit_cost)
    if qty == 0:
        return

    product = (
        await db.execute(select(Product).where(Product.id == product_id, Product.vendor_id == vendor_id))
    ).scalar_one_or_none()
    if product is None:
        return
    method = product.valuation_method or "moving_average"

    mv = (
        await db.execute(
            select(MaterialValuation)
            .where(
                MaterialValuation.vendor_id == vendor_id,
                MaterialValuation.product_id == product_id,
                MaterialValuation.variant_id.is_(None),
                MaterialValuation.plant_id == plant_id if plant_id else MaterialValuation.plant_id.is_(None),
            )
            .limit(1)
        )
    ).scalar_one_or_none()

    if mv is None:
        if qty < 0 or cost <= 0:
            return  # nothing to take from / nothing to record
        mv = MaterialValuation(
            vendor_id=vendor_id,
            product_id=product_id,
            variant_id=None,
            plant_id=plant_id,
            valuation_method=method,
            currency="INR",
            moving_avg_price=q_cost(cost) if method == "moving_average" else Decimal("0"),
            standard_price=Decimal("0"),
            total_stock=qty,
            total_value=q_money(qty * cost),
            last_po_price=Decimal("0"),
        )
        db.add(mv)
        await db.flush()
        return

    cur_stock = dec(mv.total_stock)
    cur_value = dec(mv.total_value)
    new_stock = max(cur_stock + qty, Decimal("0"))
    new_value = max(cur_value + qty * cost, Decimal("0"))
    mv.total_stock = new_stock
    mv.total_value = q_money(new_value)
    mv.valuation_method = method
    if method == "moving_average" and new_stock > 0:
        mv.moving_avg_price = q_cost(new_value / new_stock)
    await db.flush()


async def refresh_cached_cost(db: AsyncSession, vendor_id: UUID, product_id: UUID, plant_id: Optional[UUID]) -> None:
    """Re-resolve ``Product.cost_price`` after its valuation changed."""
    from app.services.cost_resolution import refresh_product_cost

    try:
        await refresh_product_cost(db, vendor_id, product_id, None, plant_id)
    except Exception as exc:  # noqa: BLE001
        log.warning("cost refresh failed for product %s: %s", product_id, exc)
