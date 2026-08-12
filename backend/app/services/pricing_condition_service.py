"""pricing_condition_service.py — Phase-7 order-level pricing adjustments.

Responsibilities:
  apply_header_condition()   Add a header-level discount, surcharge or
                             freight charge to an order.  Recalculates
                             Order.discount_amount / shipping_amount / total.
  remove_header_condition()  Delete a header condition and recalculate totals.
  reprice_order()            Re-run the pricing engine on all order lines
                             (updates net_price, discount, totals).
  recalculate_order_totals() Pure recalculation pass — called after any change.
  condition_to_dict()        Serialise an OrderPricingCondition.

Design notes:
  • Header discount → added to order.discount_amount.
  • Freight condition → added to order.shipping_amount.
  • Surcharge / special → added to (order.total - order.discount_amount).
  • After any change, recalculate_order_totals() rebuilds order.total.
  • The caller commits.
"""
from __future__ import annotations

import logging
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order, OrderLine, OrderPricingCondition

log = logging.getLogger(__name__)

VALID_CONDITION_TYPES = {
    "header_discount", "freight", "surcharge", "special", "tax_override",
}
VALID_CALC_TYPES = {"percent", "fixed"}


# ─── helpers ─────────────────────────────────────────────────────────────────

async def _get_order(db: AsyncSession, vendor_id: UUID, order_id: UUID) -> Order:
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.vendor_id == vendor_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Order not found")
    return order


async def recalculate_order_totals(db: AsyncSession, order: Order) -> None:
    """Rebuild order totals from order_lines + pricing_conditions."""
    # Sum from normalized lines
    lines_result = await db.execute(
        select(OrderLine).where(OrderLine.order_id == order.id)
    )
    lines = lines_result.scalars().all()

    lines_subtotal = sum(float(l.ordered_qty) * float(l.net_price or 0) for l in lines)
    lines_tax = sum(float(l.tax_amount or 0) for l in lines)
    lines_discount = sum(float(l.discount_amount or 0) * float(l.ordered_qty or 1) for l in lines)

    # Header conditions
    cond_result = await db.execute(
        select(OrderPricingCondition).where(
            OrderPricingCondition.order_id == order.id,
        ).order_by(OrderPricingCondition.step_no)
    )
    conditions = cond_result.scalars().all()

    header_discount = Decimal("0")
    header_freight = Decimal("0")
    header_surcharge = Decimal("0")

    subtotal_d = Decimal(str(lines_subtotal))

    for c in conditions:
        base = c.base_amount if c.base_amount is not None else subtotal_d
        if c.calc_type == "percent":
            amount = base * Decimal(str(c.value)) / Decimal("100")
        else:
            amount = Decimal(str(c.value))

        # Store condition_amount for display
        c.condition_amount = amount.quantize(Decimal("0.01"))
        c.base_amount = base.quantize(Decimal("0.01"))

        if c.condition_type == "header_discount":
            header_discount += amount
        elif c.condition_type == "freight":
            header_freight += amount
        elif c.condition_type in ("surcharge", "special"):
            header_surcharge += amount

    # Round
    subtotal = round(lines_subtotal, 2)
    total_discount = round(lines_discount + float(header_discount), 2)
    shipping = round(float(header_freight), 2)
    tax = round(lines_tax, 2)
    grand_total = round(
        subtotal - float(header_discount) + float(header_surcharge) + shipping + tax,
        2,
    )

    order.subtotal = Decimal(str(subtotal))
    order.discount_amount = Decimal(str(total_discount))
    order.shipping_amount = Decimal(str(shipping))
    order.tax_amount = Decimal(str(tax))
    order.total = Decimal(str(grand_total))


# ─── apply / remove conditions ───────────────────────────────────────────────

async def apply_header_condition(
    db: AsyncSession,
    vendor_id: UUID,
    order_id: UUID,
    *,
    condition_type: str,
    description: str,
    calc_type: str = "percent",
    value: float,
    notes: str | None = None,
    applied_by: UUID | None = None,
    step_no: int | None = None,
) -> OrderPricingCondition:
    """Add a header-level pricing condition and recalculate order totals."""
    if condition_type not in VALID_CONDITION_TYPES:
        raise HTTPException(400, f"Invalid condition_type. Valid: {sorted(VALID_CONDITION_TYPES)}")
    if calc_type not in VALID_CALC_TYPES:
        raise HTTPException(400, f"Invalid calc_type. Must be 'percent' or 'fixed'")
    if value < 0:
        raise HTTPException(400, "Value must be >= 0")

    order = await _get_order(db, vendor_id, order_id)

    if step_no is None:
        # Auto-assign next step number
        existing_result = await db.execute(
            select(OrderPricingCondition.step_no).where(
                OrderPricingCondition.order_id == order_id
            ).order_by(OrderPricingCondition.step_no.desc()).limit(1)
        )
        last = existing_result.scalar_one_or_none()
        step_no = (last or 0) + 10  # step in tens to allow insertions

    cond = OrderPricingCondition(
        order_id=order_id,
        vendor_id=vendor_id,
        step_no=step_no,
        condition_type=condition_type,
        description=description,
        calc_type=calc_type,
        value=Decimal(str(value)),
        is_manual=1,
        applied_by=applied_by,
        notes=notes,
    )
    db.add(cond)
    await db.flush()  # get cond.id

    await recalculate_order_totals(db, order)
    return cond


async def remove_header_condition(
    db: AsyncSession,
    vendor_id: UUID,
    order_id: UUID,
    condition_id: UUID,
) -> None:
    """Remove a header condition and recalculate totals."""
    result = await db.execute(
        select(OrderPricingCondition).where(
            OrderPricingCondition.id == condition_id,
            OrderPricingCondition.order_id == order_id,
            OrderPricingCondition.vendor_id == vendor_id,
        )
    )
    cond = result.scalar_one_or_none()
    if not cond:
        raise HTTPException(404, "Pricing condition not found")
    await db.delete(cond)
    await db.flush()

    order = await _get_order(db, vendor_id, order_id)
    await recalculate_order_totals(db, order)


# ─── reprice ─────────────────────────────────────────────────────────────────

async def reprice_order(
    db: AsyncSession,
    vendor_id: UUID,
    order_id: UUID,
) -> Order:
    """Re-run the pricing engine on all order lines and recalculate totals.

    Uses the order's pricing_date (or today) as the context date.
    Customer group is resolved from the buyer partner or the order's customer.
    """
    from datetime import datetime, timezone
    from app.services.price_resolver import load_rules, resolve_price, PriceContext

    order = await _get_order(db, vendor_id, order_id)

    lines_result = await db.execute(
        select(OrderLine).where(OrderLine.order_id == order_id)
    )
    lines = lines_result.scalars().all()
    if not lines:
        raise HTTPException(400, "Order has no lines to reprice")

    # Build context
    from app.models.customer import Customer
    customer_group = None
    if order.customer_id:
        cg_result = await db.execute(
            select(Customer.customer_group).where(Customer.id == order.customer_id)
        )
        customer_group = cg_result.scalar_one_or_none()

    pricing_date = (
        datetime.combine(order.pricing_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        if order.pricing_date else datetime.now(timezone.utc)
    )

    ctx = PriceContext(
        customer_id=order.customer_id,
        customer_group=customer_group,
        at=pricing_date,
    )

    # Load rules for all products in this order
    product_ids = [l.product_id for l in lines if l.product_id]
    from uuid import UUID as _UUID
    rules_by_product = await load_rules(db, vendor_id, product_ids)

    for line in lines:
        if not line.product_id:
            continue
        rules = rules_by_product.get(line.product_id, [])
        list_price = float(line.list_price or line.net_price or 0)
        resolution = resolve_price(
            rules,
            variant_id=line.variant_id,
            base_price=list_price,
            ctx=ctx,
        )
        effective_price = resolution.price
        discount_pct = round((1 - effective_price / list_price) * 100, 4) if list_price > 0 else 0
        discount_amount_per_unit = round(list_price - effective_price, 2)
        tax_rate = float(line.tax_rate or 0)
        qty = float(line.ordered_qty or 1)
        net = effective_price * qty
        tax_amount = round(net * tax_rate / 100, 2)

        line.net_price = Decimal(str(effective_price))
        line.discount_pct = Decimal(str(discount_pct))
        line.discount_amount = Decimal(str(discount_amount_per_unit))
        line.tax_amount = Decimal(str(tax_amount))
        line.line_total = Decimal(str(round(net, 2)))
        if resolution.matched:
            line.price_rule_id = _UUID(resolution.rule_id) if resolution.rule_id else None
            line.price_rule_type = resolution.rule_type

    await recalculate_order_totals(db, order)
    return order


# ─── serialise ───────────────────────────────────────────────────────────────

def condition_to_dict(c: OrderPricingCondition) -> dict:
    return {
        "id": str(c.id),
        "step_no": c.step_no,
        "condition_type": c.condition_type,
        "description": c.description,
        "calc_type": c.calc_type,
        "value": float(c.value),
        "base_amount": float(c.base_amount) if c.base_amount is not None else None,
        "condition_amount": float(c.condition_amount),
        "is_manual": bool(c.is_manual),
        "notes": c.notes,
        "created_at": str(c.created_at) if c.created_at else None,
    }
