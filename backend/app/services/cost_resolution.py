"""
cost_resolution.py
==================
Single source of truth for resolving the effective purchase / COGM cost
of a product or service, based on its valuation_method.

Supported methods
-----------------
moving_average
    For products  : reads MaterialValuation.moving_avg_price (per product + plant).
                    Falls back to FifoCostService.get_weighted_average_cost(),
                    then MaterialValuation.last_po_price, then average of recent
                    PO/GRN purchase prices, then None.
    For services  : average unit_cost over the last N service PO lines.

fixed
    For products  : product.cost_price_fixed (or variant.cost_price_fixed).
    For services  : service.purchase_price_fixed.

standard
    For products  : rolled_up_unit_cost from the active CoProductCostVersion
                    valid today (status='active', valid_from<=today<=valid_to or
                    valid_to is NULL).
    For services  : BOM material cost + resource cost (computed on the fly via
                    the same logic used in the /cost-summary endpoint).

Public helpers
--------------
resolve_product_cost(db, vendor_id, product_id, ...)  -> ResolvedCost | None
resolve_service_cost(db, vendor_id, service_id, ...)  -> ResolvedCost | None
refresh_product_cost(db, vendor_id, product_id, ...)  -> None
    Resolves and writes the result into product.cost_price + audit columns.
refresh_service_cost(db, vendor_id, service_id, ...)  -> None
    Resolves and writes the result into service.purchase_price + audit columns.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Return type
# ---------------------------------------------------------------------------

@dataclass
class ResolvedCost:
    value: Decimal
    method: str          # moving_average | fixed | standard
    source: str          # human-readable description of where the value came from
    as_of: datetime


# ---------------------------------------------------------------------------
# Product cost resolution
# ---------------------------------------------------------------------------

async def resolve_product_cost(
    db: AsyncSession,
    vendor_id: UUID,
    product_id: UUID,
    variant_id: Optional[UUID] = None,
    plant_id: Optional[UUID] = None,
) -> Optional[ResolvedCost]:
    """Resolve the effective purchase cost for a product/variant."""
    from app.models.vendor_product import Product, ProductVariant

    # Fetch the entity to read its valuation_method and fixed cost.
    # Variant method overrides product method when explicitly set (non-NULL).
    if variant_id:
        row = (await db.execute(
            select(ProductVariant).where(
                ProductVariant.id == variant_id,
                ProductVariant.product_id == product_id,
            )
        )).scalar_one_or_none()
        # Use variant's own method if set, otherwise inherit from product
        variant_method = getattr(row, "valuation_method", None) if row else None
        if variant_method:
            method = variant_method
        else:
            product_row = (await db.execute(
                select(Product).where(Product.id == product_id)
            )).scalar_one_or_none()
            method = (product_row.valuation_method if product_row else None) or "moving_average"
        fixed_val = getattr(row, "cost_price_fixed", None) if row else None
    else:
        row = (await db.execute(
            select(Product).where(Product.id == product_id, Product.vendor_id == vendor_id)
        )).scalar_one_or_none()
        method = (row.valuation_method if row else None) or "moving_average"
        fixed_val = getattr(row, "cost_price_fixed", None) if row else None

    if method == "fixed":
        return _make_fixed_product(fixed_val)

    if method == "standard":
        return await _standard_product(db, vendor_id, product_id)

    # moving_average (default)
    return await _map_product(db, vendor_id, product_id, variant_id, plant_id)


async def _make_fixed_product(fixed_val) -> Optional[ResolvedCost]:
    if fixed_val is None:
        return None
    return ResolvedCost(
        value=Decimal(str(fixed_val)),
        method="fixed",
        source="manual (cost_price_fixed)",
        as_of=datetime.now(timezone.utc),
    )


async def _standard_product(
    db: AsyncSession, vendor_id: UUID, product_id: UUID
) -> Optional[ResolvedCost]:
    """Return rolled_up_unit_cost from the active cost version valid today."""
    from app.models.controlling import CoProductCostVersion

    today = date.today()
    result = await db.execute(
        select(CoProductCostVersion)
        .where(
            CoProductCostVersion.vendor_id == vendor_id,
            CoProductCostVersion.product_id == product_id,
            CoProductCostVersion.status == "active",
            CoProductCostVersion.valid_from <= today,
            (CoProductCostVersion.valid_to.is_(None) | (CoProductCostVersion.valid_to >= today)),
        )
        .order_by(CoProductCostVersion.valid_from.desc())
        .limit(1)
    )
    ver = result.scalar_one_or_none()
    if ver is None or not ver.rolled_up_unit_cost:
        return None
    return ResolvedCost(
        value=Decimal(str(ver.rolled_up_unit_cost)),
        method="standard",
        source=f"CO cost version {ver.version_code} ({ver.valid_from})",
        as_of=ver.updated_at or datetime.now(timezone.utc),
    )


async def _map_product(
    db: AsyncSession,
    vendor_id: UUID,
    product_id: UUID,
    variant_id: Optional[UUID],
    plant_id: Optional[UUID],
) -> Optional[ResolvedCost]:
    """Return moving average price, falling through to FIFO WAC then PO history."""
    from app.models.procurement_special import MaterialValuation
    from app.models.procurement import PurchaseOrderItem
    from app.services.fifo_cost_service import FifoCostService

    # 1. MaterialValuation MAP
    mv_q = select(MaterialValuation).where(
        MaterialValuation.vendor_id == vendor_id,
        MaterialValuation.product_id == product_id,
        (
            MaterialValuation.variant_id == variant_id
            if variant_id
            else MaterialValuation.variant_id.is_(None)
        ),
    )
    if plant_id:
        mv_q = mv_q.where(MaterialValuation.plant_id == plant_id)
    mv_q = mv_q.limit(1)
    mv = (await db.execute(mv_q)).scalar_one_or_none()
    if mv and mv.moving_avg_price and float(mv.moving_avg_price) > 0:
        return ResolvedCost(
            value=Decimal(str(mv.moving_avg_price)),
            method="moving_average",
            source="material_valuation MAP",
            as_of=mv.updated_at or datetime.now(timezone.utc),
        )

    # 2. FIFO WAC
    try:
        fifo_svc = FifoCostService(db)
        wac = await fifo_svc.get_weighted_average_cost(vendor_id, product_id, variant_id)
        if wac and wac > 0:
            return ResolvedCost(
                value=Decimal(str(round(wac, 6))),
                method="moving_average",
                source="FIFO weighted average cost",
                as_of=datetime.now(timezone.utc),
            )
    except Exception as exc:  # noqa: BLE001
        log.debug("FIFO WAC fallback failed for product %s: %s", product_id, exc)

    # 3. last_po_price from MaterialValuation
    if mv and mv.last_po_price and float(mv.last_po_price) > 0:
        return ResolvedCost(
            value=Decimal(str(mv.last_po_price)),
            method="moving_average",
            source="last PO price (material_valuation)",
            as_of=mv.updated_at or datetime.now(timezone.utc),
        )

    # 4. Average over the last 10 received PO lines
    avg_result = await db.execute(
        select(func.avg(PurchaseOrderItem.unit_cost))
        .where(
            PurchaseOrderItem.product_id == product_id,
            PurchaseOrderItem.quantity_received > 0,
            PurchaseOrderItem.unit_cost > 0,
        )
        .limit(1)
    )
    avg_cost = avg_result.scalar_one_or_none()
    if avg_cost and float(avg_cost) > 0:
        return ResolvedCost(
            value=Decimal(str(round(float(avg_cost), 6))),
            method="moving_average",
            source="average PO received price",
            as_of=datetime.now(timezone.utc),
        )

    return None


# ---------------------------------------------------------------------------
# Service cost resolution
# ---------------------------------------------------------------------------

async def resolve_service_cost(
    db: AsyncSession,
    vendor_id: UUID,
    service_id: UUID,
) -> Optional[ResolvedCost]:
    """Resolve the effective purchase / COGM cost for a service."""
    from app.models.vendor_service import Service

    row = (await db.execute(
        select(Service).where(Service.id == service_id, Service.vendor_id == vendor_id)
    )).scalar_one_or_none()
    if row is None:
        return None

    method = row.valuation_method or "fixed"

    if method == "fixed":
        fixed_val = row.purchase_price_fixed
        if fixed_val is None:
            return None
        return ResolvedCost(
            value=Decimal(str(fixed_val)),
            method="fixed",
            source="manual (purchase_price_fixed)",
            as_of=datetime.now(timezone.utc),
        )

    if method == "standard":
        return await _standard_service(db, service_id)

    # moving_average — use average of service PO line costs
    return await _map_service(db, vendor_id, service_id)


async def _standard_service(
    db: AsyncSession, service_id: UUID
) -> Optional[ResolvedCost]:
    """Compute BOM material + resource cost (same logic as /cost-summary endpoint)."""
    from app.models.vendor_service import ServiceBOMItem, ServiceResource
    from app.models.vendor_product import Product

    # Material cost
    bom_rows = (await db.execute(
        select(ServiceBOMItem).where(ServiceBOMItem.service_id == service_id)
    )).scalars().all()

    material_cost = Decimal("0")
    for item in bom_rows:
        unit_cost = item.unit_cost_override
        if unit_cost is None:
            comp = (await db.execute(
                select(Product).where(Product.id == item.component_id)
            )).scalar_one_or_none()
            unit_cost = Decimal(str(comp.cost_price)) if comp and comp.cost_price else Decimal("0")
        material_cost += Decimal(str(unit_cost)) * Decimal(str(item.qty_per_service))

    # Resource cost
    resource_rows = (await db.execute(
        select(ServiceResource).where(ServiceResource.service_id == service_id)
    )).scalars().all()

    resource_cost = Decimal("0")
    for res in resource_rows:
        rate = Decimal(str(res.cost_rate or 0))
        resource_cost += rate  # hourly rates are per-service-unit already summed

    total = material_cost + resource_cost
    if total <= 0:
        return None

    return ResolvedCost(
        value=total,
        method="standard",
        source="BOM material + resource cost",
        as_of=datetime.now(timezone.utc),
    )


async def _map_service(
    db: AsyncSession,
    vendor_id: UUID,
    service_id: UUID,
) -> Optional[ResolvedCost]:
    """Average of the most recent received service PO lines."""
    from app.models.procurement import PurchaseOrderItem

    avg_result = await db.execute(
        select(func.avg(PurchaseOrderItem.unit_cost))
        .where(
            PurchaseOrderItem.service_id == service_id,
            PurchaseOrderItem.quantity_received > 0,
            PurchaseOrderItem.unit_cost > 0,
        )
    )
    avg_cost = avg_result.scalar_one_or_none()
    if avg_cost and float(avg_cost) > 0:
        return ResolvedCost(
            value=Decimal(str(round(float(avg_cost), 6))),
            method="moving_average",
            source="average service PO received price",
            as_of=datetime.now(timezone.utc),
        )
    return None


# ---------------------------------------------------------------------------
# Cache refresh helpers
# ---------------------------------------------------------------------------

async def refresh_product_cost(
    db: AsyncSession,
    vendor_id: UUID,
    product_id: UUID,
    variant_id: Optional[UUID] = None,
    plant_id: Optional[UUID] = None,
    *,
    flush: bool = True,
) -> None:
    """
    Resolve and write the effective cost into product.cost_price (or variant.cost_price)
    plus the audit columns cost_source and cost_updated_at.
    Caller is responsible for the final db.commit().
    """
    from app.models.vendor_product import Product, ProductVariant

    resolved = await resolve_product_cost(db, vendor_id, product_id, variant_id, plant_id)
    if resolved is None:
        return

    if variant_id:
        entity = (await db.execute(
            select(ProductVariant).where(ProductVariant.id == variant_id)
        )).scalar_one_or_none()
    else:
        entity = (await db.execute(
            select(Product).where(Product.id == product_id, Product.vendor_id == vendor_id)
        )).scalar_one_or_none()

    if entity is None:
        return

    entity.cost_price = resolved.value
    entity.cost_source = resolved.source
    entity.cost_updated_at = resolved.as_of

    if flush:
        await db.flush()


async def refresh_service_cost(
    db: AsyncSession,
    vendor_id: UUID,
    service_id: UUID,
    *,
    flush: bool = True,
) -> None:
    """
    Resolve and write the effective cost into service.purchase_price
    plus the audit columns.
    Caller is responsible for the final db.commit().
    """
    from app.models.vendor_service import Service

    resolved = await resolve_service_cost(db, vendor_id, service_id)
    if resolved is None:
        return

    svc = (await db.execute(
        select(Service).where(Service.id == service_id, Service.vendor_id == vendor_id)
    )).scalar_one_or_none()

    if svc is None:
        return

    svc.purchase_price = resolved.value
    svc.cost_source = resolved.source
    svc.cost_updated_at = resolved.as_of

    if flush:
        await db.flush()
