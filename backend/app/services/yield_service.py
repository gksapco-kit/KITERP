"""Cutting yield: raw stock needed per unit of finished cut, and the end-of-day yield close.

A cut variant's yield_factor is the raw input for 1 unit of output (boneless chicken
1.30 → 1.30 kg raw for 1 kg sold). With the product's shared stock counted in the raw
unit, one sale removes output × factor from that balance via stock_per_sale.

The day close reads the shared-stock movements of one business day:

    opening + purchased − raw cut + returned − wastage ± other = closing (system)
    closing (system) − closing (physical count)                = variance
    raw cut (net of returns) − output sold                      = cutting loss
"""
from __future__ import annotations

import uuid as uuid_mod
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import InventoryMovement
from app.models.order import Order, OrderLine
from app.models.pos import POSTransaction
from app.models.vendor_product import Product, ProductVariant
from app.models.yield_management import YieldDayClose
from app.services.shared_stock import (
    base_per_selling_unit,
    opening_base,
    shared_pool_unit,
    uom_dimension,
    uses_shared_weight_stock,
)

_Q = Decimal("0.0001")
_ZERO = Decimal("0")

PURCHASE_TYPES = frozenset({"purchase", "stock_in", "initial"})
SALE_TYPES = frozenset({"sale"})
RETURN_TYPES = frozenset({"sale_return", "order_cancel"})
WASTAGE_TYPES = frozenset({"write_off", "stock_out"})
CANCELLED_ORDER_STATUSES = ("cancelled", "refunded", "returned")


def _dec(value: Any, default: Decimal = _ZERO) -> Decimal:
    if value is None or value == "":
        return default
    try:
        return Decimal(str(value))
    except Exception:
        return default


def _q(value: Decimal) -> Decimal:
    return value.quantize(_Q, rounding=ROUND_HALF_UP)


def _f(value: Decimal | None, places: int = 4) -> float | None:
    if value is None:
        return None
    return float(round(value, places))


def output_per_sale(pool: str, variant: Any) -> Decimal:
    """Finished output one sale of the variant hands over, in the pool's unit (ignores manual rules)."""
    return base_per_selling_unit(
        pool,
        getattr(variant, "uom", None),
        getattr(variant, "uom_quantity", None),
        getattr(variant, "weight_kg", None),
        None,
    )


def yield_snapshot(product: Any, variant: Any, pool: str, selling_qty: int) -> dict:
    """Yield fields frozen on a shared-stock movement, or {} when the sale is not a yield cut."""
    if variant is None or not getattr(product, "yield_enabled", False):
        return {}
    factor = _dec(getattr(variant, "yield_factor", None))
    if factor <= 0 or uom_dimension(pool) == "count":
        return {}
    each = output_per_sale(pool, variant)
    if each <= 0:
        return {}
    return {
        "yield_cut": getattr(variant, "yield_cut", None) or getattr(variant, "name", None),
        "yield_factor": str(_q(factor)),
        "output_each": str(each),
        "output_total": str(_q(each * Decimal(selling_qty))),
    }


async def apply_yield_rules(db: AsyncSession, product: Product) -> None:
    """Set stock_per_sale = output × yield_factor on every cut variant of a yield product."""
    if not getattr(product, "yield_enabled", False):
        return
    await db.flush()
    variants = list((await db.execute(
        select(ProductVariant).where(ProductVariant.product_id == product.id)
    )).scalars().all())
    pool = shared_pool_unit(variants, getattr(product, "stock_uom", None))
    if uom_dimension(pool) == "count":
        return
    for v in variants:
        factor = _dec(v.yield_factor)
        if factor <= 0:
            continue
        each = output_per_sale(pool, v)
        if each <= 0:
            continue
        v.stock_per_sale = _q(each * factor)


def day_bounds(business_date: date, tz_offset_minutes: int) -> tuple[datetime, datetime]:
    """UTC start/end of a business date in the shop's timezone (minutes east of UTC, IST = 330)."""
    tz = timezone(timedelta(minutes=tz_offset_minutes))
    start = datetime.combine(business_date, time.min, tzinfo=tz)
    return start.astimezone(timezone.utc), (start + timedelta(days=1)).astimezone(timezone.utc)


def _movement_delta(m: InventoryMovement) -> Decimal | None:
    extra = m.extra_data or {}
    if not extra.get("shared_stock") or extra.get("base_kg_delta") is None:
        return None
    return _dec(extra.get("base_kg_delta"))


async def _sales_by_variant(
    db: AsyncSession, vendor_id: UUID, product_id: UUID, start: datetime, end: datetime,
) -> dict[str, Decimal]:
    """Sales value (before tax) per variant id ("" = no variant) from POS and online orders."""
    totals: dict[str, Decimal] = {}
    pid = str(product_id)

    txns = (await db.execute(
        select(POSTransaction).where(and_(
            POSTransaction.vendor_id == vendor_id,
            POSTransaction.created_at >= start,
            POSTransaction.created_at < end,
            POSTransaction.status != "voided",
        ))
    )).scalars().all()
    for t in txns:
        ttype = t.transaction_type or "sale"
        if ttype in ("sale", "debit_memo"):
            sign = Decimal("1")
        elif ttype in ("return", "credit_memo"):
            sign = Decimal("-1")
        else:
            continue
        for item in t.items or []:
            if str(item.get("product_id") or "") != pid:
                continue
            value = item.get("taxable")
            if value is None:
                value = _dec(item.get("qty")) * _dec(item.get("price")) - _dec(item.get("discount"))
            key = str(item.get("variant_id") or "")
            totals[key] = totals.get(key, _ZERO) + sign * _dec(value)

    rows = (await db.execute(
        select(OrderLine.variant_id, OrderLine.line_total)
        .join(Order, Order.id == OrderLine.order_id)
        .where(and_(
            Order.vendor_id == vendor_id,
            Order.created_at >= start,
            Order.created_at < end,
            Order.status.notin_(CANCELLED_ORDER_STATUSES),
            OrderLine.product_id == product_id,
            OrderLine.line_type == "standard",
        ))
    )).all()
    for variant_id, line_total in rows:
        key = str(variant_id or "")
        totals[key] = totals.get(key, _ZERO) + _dec(line_total)
    return totals


async def compute_day(
    db: AsyncSession,
    vendor_id: UUID,
    product: Product,
    business_date: date,
    tz_offset_minutes: int = 330,
    raw_cost_per_unit: Any = None,
) -> dict:
    """Live end-of-day yield figures for one product (nothing is saved)."""
    variants = list((await db.execute(
        select(ProductVariant).where(ProductVariant.product_id == product.id)
    )).scalars().all())
    by_id = {str(v.id): v for v in variants}
    shared = uses_shared_weight_stock(getattr(product, "shared_stock", None), variants)
    pool = shared_pool_unit(variants, getattr(product, "stock_uom", None))
    start, end = day_bounds(business_date, tz_offset_minutes)

    base_filter = and_(
        InventoryMovement.vendor_id == vendor_id,
        InventoryMovement.product_id == product.id,
    )
    day_moves = (await db.execute(
        select(InventoryMovement)
        .where(base_filter, InventoryMovement.created_at >= start, InventoryMovement.created_at < end)
        .order_by(InventoryMovement.created_at, InventoryMovement.id)
    )).scalars().all()
    day_moves = [m for m in day_moves if _movement_delta(m) is not None]

    prev = (await db.execute(
        select(InventoryMovement)
        .where(base_filter, InventoryMovement.created_at < start)
        .order_by(InventoryMovement.created_at.desc())
        .limit(50)
    )).scalars().all()
    prev_shared = next((m for m in prev if _movement_delta(m) is not None), None)

    if prev_shared is not None:
        opening = _dec((prev_shared.extra_data or {}).get("base_kg_after"))
    elif day_moves:
        opening = _dec((day_moves[0].extra_data or {}).get("base_kg_before"))
    else:
        later = (await db.execute(
            select(InventoryMovement)
            .where(base_filter, InventoryMovement.created_at >= end)
            .order_by(InventoryMovement.created_at)
            .limit(50)
        )).scalars().all()
        later_shared = next((m for m in later if _movement_delta(m) is not None), None)
        if later_shared is not None:
            opening = _dec((later_shared.extra_data or {}).get("base_kg_before"))
        elif product.base_quantity is not None:
            opening = _dec(product.base_quantity)
        else:
            opening = opening_base(variants, pool) if shared else _ZERO

    closing_system = _dec((day_moves[-1].extra_data or {}).get("base_kg_after")) if day_moves else opening

    purchased = raw_cut = returned = wastage = _ZERO
    cuts: dict[str, dict] = {}

    def _cut_row(variant_id: str, extra: dict) -> dict:
        v = by_id.get(variant_id)
        if variant_id not in cuts:
            cuts[variant_id] = {
                "variant_id": variant_id or None,
                "name": (v.name if v else None) or extra.get("yield_cut") or product.name,
                "cut": (v.yield_cut if v else None) or extra.get("yield_cut"),
                "units_sold": 0,
                "units_returned": 0,
                "output_qty": _ZERO,
                "raw_qty": _ZERO,
                "set_factor": _dec(v.yield_factor) if v and v.yield_factor else None,
            }
        return cuts[variant_id]

    for m in day_moves:
        delta = _movement_delta(m) or _ZERO
        extra = m.extra_data or {}
        mtype = m.movement_type
        if mtype in PURCHASE_TYPES:
            purchased += delta
        elif mtype in SALE_TYPES or mtype in RETURN_TYPES:
            is_sale = mtype in SALE_TYPES
            if is_sale:
                raw_cut += -delta
            else:
                returned += delta
            vid = str(m.variant_id or "")
            row = _cut_row(vid, extra)
            units = int(extra.get("selling_qty") or abs(m.quantity or 0))
            if extra.get("output_total") is not None:
                output = _dec(extra.get("output_total"))
            else:
                v = by_id.get(vid)
                output = output_per_sale(pool, v) * Decimal(units) if v else abs(delta)
            sign = Decimal("1") if is_sale else Decimal("-1")
            row["units_sold" if is_sale else "units_returned"] += units
            row["output_qty"] += sign * output
            row["raw_qty"] += -delta
        elif mtype in WASTAGE_TYPES:
            wastage += -delta

    other = closing_system - opening - purchased + raw_cut - returned + wastage
    raw_net = raw_cut - returned
    output_sold = sum((r["output_qty"] for r in cuts.values()), _ZERO)

    sales = await _sales_by_variant(db, vendor_id, product.id, start, end)
    cut_list = []
    for vid, r in cuts.items():
        amount = sales.pop(vid, _ZERO)
        actual = (r["raw_qty"] / r["output_qty"]) if r["output_qty"] > 0 else None
        cut_list.append({
            "variant_id": r["variant_id"],
            "name": r["name"],
            "cut": r["cut"],
            "units_sold": r["units_sold"],
            "units_returned": r["units_returned"],
            "output_qty": _f(r["output_qty"]),
            "raw_qty": _f(r["raw_qty"]),
            "set_factor": _f(r["set_factor"]),
            "effective_factor": _f(actual),
            "sales_amount": _f(amount, 2),
        })
    for vid, amount in sales.items():
        if amount == 0:
            continue
        v = by_id.get(vid)
        cut_list.append({
            "variant_id": vid or None,
            "name": (v.name if v else None) or product.name,
            "cut": v.yield_cut if v else None,
            "units_sold": 0, "units_returned": 0,
            "output_qty": 0.0, "raw_qty": 0.0,
            "set_factor": _f(_dec(v.yield_factor)) if v and v.yield_factor else None,
            "effective_factor": None,
            "sales_amount": _f(amount, 2),
        })
    cut_list.sort(key=lambda c: c["name"] or "")
    sales_amount = sum((_dec(c["sales_amount"]) for c in cut_list), _ZERO)

    cost = _dec(raw_cost_per_unit) if raw_cost_per_unit not in (None, "") else _dec(product.cost_price)
    cogs = raw_net * cost if cost > 0 else _ZERO

    return {
        "product_id": str(product.id),
        "product_name": product.name,
        "category": product.category,
        "business_date": business_date.isoformat(),
        "pool_uom": pool,
        "shared_stock": shared,
        "yield_enabled": bool(getattr(product, "yield_enabled", False)),
        "opening_qty": _f(opening),
        "purchased_qty": _f(purchased),
        "raw_cut_qty": _f(raw_cut),
        "returned_qty": _f(returned),
        "wastage_qty": _f(wastage),
        "other_qty": _f(other),
        "closing_system_qty": _f(closing_system),
        "output_sold_qty": _f(output_sold),
        "cutting_loss_qty": _f(raw_net - output_sold),
        "sales_amount": _f(sales_amount, 2),
        "raw_cost_per_unit": _f(cost) if cost > 0 else None,
        "cogs_amount": _f(cogs, 2),
        "gross_margin": _f(sales_amount - cogs, 2),
        "cuts": cut_list,
        "closed": False,
        "closing_physical_qty": None,
        "variance_qty": None,
    }


def close_to_dict(c: YieldDayClose, product: Product | None = None) -> dict:
    sales = _dec(c.sales_amount)
    cogs = _dec(c.cogs_amount)
    return {
        "id": str(c.id),
        "product_id": str(c.product_id),
        "product_name": product.name if product else None,
        "category": product.category if product else None,
        "business_date": c.business_date.isoformat(),
        "pool_uom": c.pool_uom,
        "shared_stock": True,
        "yield_enabled": bool(getattr(product, "yield_enabled", False)) if product else True,
        "opening_qty": _f(_dec(c.opening_qty)),
        "purchased_qty": _f(_dec(c.purchased_qty)),
        "raw_cut_qty": _f(_dec(c.raw_cut_qty)),
        "returned_qty": _f(_dec(c.returned_qty)),
        "wastage_qty": _f(_dec(c.wastage_qty)),
        "other_qty": _f(_dec(c.other_qty)),
        "closing_system_qty": _f(_dec(c.closing_system_qty)),
        "closing_physical_qty": _f(_dec(c.closing_physical_qty)),
        "variance_qty": _f(_dec(c.variance_qty)),
        "output_sold_qty": _f(_dec(c.output_sold_qty)),
        "cutting_loss_qty": _f(_dec(c.cutting_loss_qty)),
        "sales_amount": _f(sales, 2),
        "raw_cost_per_unit": _f(_dec(c.raw_cost_per_unit)) if c.raw_cost_per_unit is not None else None,
        "cogs_amount": _f(cogs, 2),
        "gross_margin": _f(sales - cogs, 2),
        "cuts": c.cuts or [],
        "notes": c.notes,
        "closed": True,
        "closed_by": str(c.closed_by) if c.closed_by else None,
        "closed_at": c.closed_at.isoformat() if c.closed_at else None,
    }


async def post_count_adjustment(
    db: AsyncSession,
    vendor_id: UUID,
    product_id: UUID,
    delta: Decimal,
    business_date: date,
    performed_by: UUID | None,
) -> None:
    """Move the shared balance by the counted variance so tomorrow opens at the physical count."""
    if delta == 0:
        return
    locked = (await db.execute(
        select(Product).where(Product.id == product_id).with_for_update()
    )).scalar_one()
    variants = list((await db.execute(
        select(ProductVariant).where(ProductVariant.product_id == product_id)
    )).scalars().all())
    pool = shared_pool_unit(variants, getattr(locked, "stock_uom", None))
    before = _dec(locked.base_quantity) if locked.base_quantity is not None else opening_base(variants, pool)
    after = _q(before + delta)
    if after < 0:
        after = _ZERO
    locked.base_quantity = after
    locked.quantity = int(after.to_integral_value(rounding=ROUND_HALF_UP))
    db.add(InventoryMovement(
        id=uuid_mod.uuid4(),
        vendor_id=vendor_id,
        product_id=product_id,
        movement_type="stock_count",
        quantity=int(delta.to_integral_value(rounding=ROUND_HALF_UP)),
        quantity_before=int(before.to_integral_value(rounding=ROUND_HALF_UP)),
        quantity_after=locked.quantity,
        reason=f"Day close {business_date.isoformat()}: physical count {'+' if delta > 0 else ''}{_q(delta)} {pool}",
        reference_type="yield_day_close",
        performed_by=performed_by,
        extra_data={
            "shared_stock": True,
            "base_uom": pool,
            "base_kg_before": str(_q(before)),
            "base_kg_delta": str(_q(after - before)),
            "base_kg_after": str(after),
            "business_date": business_date.isoformat(),
        },
    ))
