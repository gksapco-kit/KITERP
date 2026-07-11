# app/services/price_resolver.py
"""
Multi-condition price resolution engine.

Evaluates `ProductPriceRule` rows (party/customer-group, quantity tiers,
sales channel, location, and scheduled pricing) against a sale context
(customer, quantity, channel, ship-to state, point in time) and returns the
effective unit price. Used by POS transactions and online/storefront
checkout so the party-wise (retail / wholesale / distributor / agent / …),
quantity-tier, and channel prices set up on a product actually apply when
something is sold — not just when the rule is created.

Rule matching precedence (when several rule types match at once) is decided
by explicit `priority` first (vendor-set, higher wins), then by rule
specificity: party > quantity > channel > location > scheduled.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from typing import Iterable, Optional
from uuid import UUID

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vendor_product import ProductPriceRule
from app.models.customer import Customer

_SPECIFICITY = {"party": 4, "quantity": 3, "channel": 2, "location": 1, "scheduled": 0}


@dataclass
class PriceContext:
    """Sale-time conditions used to pick the right price rule."""
    quantity: int = 1
    customer_id: Optional[UUID] = None
    customer_group: Optional[str] = None
    channel: Optional[str] = None  # online | pos | wholesale | marketplace | mobile_app | social
    shipping_state: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_pincode: Optional[str] = None
    at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class PriceResolution:
    price: float
    base_price: float
    matched: bool = False
    rule_id: Optional[str] = None
    rule_type: Optional[str] = None
    rule_name: Optional[str] = None


def _rule_matches(rule: ProductPriceRule, variant_id: Optional[UUID], ctx: PriceContext) -> bool:
    if rule.variant_id is not None and variant_id is not None and rule.variant_id != variant_id:
        return False
    if rule.variant_id is not None and variant_id is None:
        return False

    if rule.rule_type == "party":
        if ctx.customer_id and rule.customer_id and rule.customer_id == ctx.customer_id:
            return True
        if ctx.customer_group and rule.customer_group and rule.customer_group.lower() == ctx.customer_group.lower():
            return True
        return False

    if rule.rule_type == "quantity":
        qty = ctx.quantity or 0
        if rule.min_quantity is not None and qty < rule.min_quantity:
            return False
        if rule.max_quantity is not None and qty > rule.max_quantity:
            return False
        return rule.min_quantity is not None or rule.max_quantity is not None

    if rule.rule_type == "channel":
        return bool(ctx.channel and rule.channel and rule.channel.lower() == ctx.channel.lower())

    if rule.rule_type == "location":
        checks = []
        if rule.state:
            checks.append(bool(ctx.shipping_state) and rule.state.lower() == ctx.shipping_state.lower())
        if rule.city:
            checks.append(bool(ctx.shipping_city) and rule.city.lower() == ctx.shipping_city.lower())
        if rule.pincode:
            checks.append(bool(ctx.shipping_pincode) and rule.pincode == ctx.shipping_pincode)
        if not checks:
            return False
        return all(checks)

    if rule.rule_type == "scheduled":
        now = ctx.at
        if rule.start_date and now < rule.start_date:
            return False
        if rule.end_date and now > rule.end_date:
            return False
        return bool(rule.start_date or rule.end_date)

    return False


def _apply_rule(rule: ProductPriceRule, base_price: float) -> float:
    if rule.price is not None:
        return float(rule.price)
    if rule.discount_percentage is not None:
        return round(base_price * (1 - float(rule.discount_percentage) / 100), 2)
    if rule.discount_amount is not None:
        return max(0.0, round(base_price - float(rule.discount_amount), 2))
    return base_price


def _pick_best(rules: Iterable[ProductPriceRule], variant_id: Optional[UUID], ctx: PriceContext) -> Optional[ProductPriceRule]:
    matches = [r for r in rules if r.is_active and _rule_matches(r, variant_id, ctx)]
    if not matches:
        return None
    # Prefer variant-specific rules over product-level ones, then priority, then rule-type specificity.
    matches.sort(
        key=lambda r: (
            1 if r.variant_id is not None else 0,
            r.priority or 0,
            _SPECIFICITY.get(r.rule_type, -1),
        ),
        reverse=True,
    )
    return matches[0]


async def load_rules(db: AsyncSession, vendor_id: UUID, product_ids: Iterable[UUID]) -> dict[UUID, list[ProductPriceRule]]:
    """Fetch all active price rules for the given products, grouped by product_id."""
    ids = list({UUID(str(p)) for p in product_ids if p})
    if not ids:
        return {}
    stmt = select(ProductPriceRule).where(
        and_(
            ProductPriceRule.vendor_id == vendor_id,
            ProductPriceRule.product_id.in_(ids),
            ProductPriceRule.is_active.is_(True),
        )
    )
    rows = (await db.execute(stmt)).scalars().all()
    out: dict[UUID, list[ProductPriceRule]] = {}
    for r in rows:
        out.setdefault(r.product_id, []).append(r)
    return out


def resolve_price(
    rules: list[ProductPriceRule],
    *,
    variant_id: Optional[UUID],
    base_price: float,
    ctx: PriceContext,
) -> PriceResolution:
    """Pure resolution given pre-loaded rules for a single product."""
    best = _pick_best(rules, variant_id, ctx)
    if not best:
        return PriceResolution(price=base_price, base_price=base_price, matched=False)
    return PriceResolution(
        price=_apply_rule(best, base_price),
        base_price=base_price,
        matched=True,
        rule_id=str(best.id),
        rule_type=best.rule_type,
        rule_name=best.name,
    )


async def resolve_price_for_product(
    db: AsyncSession,
    vendor_id: UUID,
    product_id: UUID,
    *,
    variant_id: Optional[UUID] = None,
    base_price: float,
    ctx: PriceContext,
) -> PriceResolution:
    """Convenience single-product lookup (fetches its rules then resolves)."""
    grouped = await load_rules(db, vendor_id, [product_id])
    return resolve_price(grouped.get(UUID(str(product_id)), []), variant_id=variant_id, base_price=base_price, ctx=ctx)


async def build_context_for_customer(
    db: AsyncSession,
    vendor_id: UUID,
    customer_id: Optional[UUID],
    *,
    quantity: int = 1,
    channel: Optional[str] = None,
    shipping_state: Optional[str] = None,
    shipping_city: Optional[str] = None,
    shipping_pincode: Optional[str] = None,
) -> PriceContext:
    """Build a PriceContext, looking up the customer's pricing group when a customer_id is given."""
    customer_group = None
    if customer_id:
        result = await db.execute(
            select(Customer.customer_group).where(
                Customer.id == customer_id, Customer.vendor_id == vendor_id,
            )
        )
        row = result.scalar_one_or_none()
        customer_group = row or None
    return PriceContext(
        quantity=quantity,
        customer_id=customer_id,
        customer_group=customer_group,
        channel=channel,
        shipping_state=shipping_state,
        shipping_city=shipping_city,
        shipping_pincode=shipping_pincode,
    )


async def resolve_items_pricing(
    db: AsyncSession,
    vendor_id: UUID,
    items: list[dict],
    *,
    customer_id: Optional[UUID] = None,
    customer_group: Optional[str] = None,
    channel: Optional[str] = None,
    shipping_state: Optional[str] = None,
    shipping_city: Optional[str] = None,
    shipping_pincode: Optional[str] = None,
) -> list[dict]:
    """
    Return a new list of item dicts with `price` overridden to the resolved
    effective price wherever a rule matches. Adds `list_price` (the original
    price) and `price_rule` metadata whenever a rule was applied. Items
    without a resolvable `product_id`, or of `item_type == "service"`, pass
    through unchanged.
    """
    if not items:
        return []

    product_ids: list[UUID] = []
    for it in items:
        pid = it.get("product_id")
        if pid and it.get("item_type") != "service":
            try:
                product_ids.append(UUID(str(pid)))
            except (ValueError, TypeError):
                pass

    rules_by_product = await load_rules(db, vendor_id, product_ids)

    resolved_group = customer_group
    if customer_id and resolved_group is None:
        result = await db.execute(
            select(Customer.customer_group).where(
                Customer.id == customer_id, Customer.vendor_id == vendor_id,
            )
        )
        resolved_group = result.scalar_one_or_none() or None

    ctx_base = dict(
        customer_id=customer_id,
        customer_group=resolved_group,
        channel=channel,
        shipping_state=shipping_state,
        shipping_city=shipping_city,
        shipping_pincode=shipping_pincode,
    )

    out: list[dict] = []
    for it in items:
        item = dict(it)
        pid = item.get("product_id")
        if not pid or item.get("item_type") == "service":
            out.append(item)
            continue
        try:
            product_uuid = UUID(str(pid))
        except (ValueError, TypeError):
            out.append(item)
            continue

        rules = rules_by_product.get(product_uuid)
        if not rules:
            out.append(item)
            continue

        variant_id = item.get("variant_id")
        try:
            variant_uuid = UUID(str(variant_id)) if variant_id else None
        except (ValueError, TypeError):
            variant_uuid = None

        base_price = float(item.get("price") or 0)
        qty = int(item.get("qty") or item.get("quantity") or 1)
        ctx = PriceContext(quantity=qty, **ctx_base)

        resolution = resolve_price(rules, variant_id=variant_uuid, base_price=base_price, ctx=ctx)
        if resolution.matched and resolution.price != base_price:
            item["list_price"] = base_price
            item["price"] = resolution.price
            item["price_rule"] = {
                "id": resolution.rule_id,
                "type": resolution.rule_type,
                "name": resolution.rule_name,
            }
        out.append(item)

    return out
