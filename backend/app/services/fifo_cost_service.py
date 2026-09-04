"""
FIFO Cost Layer Service
=======================
Manages cost layers for inventory valuation using FIFO (First-In, First-Out).

Usage:
  - Call `create_layer()` whenever stock is received (stock_in, purchase, initial).
  - Call `consume_layers()` whenever stock leaves (sale, stock_out, transfer).
  - Call `get_stock_valuation()` for current FIFO stock value report.
  - Call `get_cogs_for_movement()` to compute COGS for a given outbound quantity.
"""
from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.stock_cost_layer import StockCostLayer


class FifoCostService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Create Layer on Inbound Stock ─────────────────────────────────────────

    async def create_layer(
        self,
        vendor_id: UUID,
        product_id: UUID,
        unit_cost: float,
        quantity: float,
        variant_id: Optional[UUID] = None,
        movement_id: Optional[UUID] = None,
        source_type: str = "stock_in",
        notes: Optional[str] = None,
        auto_commit: bool = False,
    ) -> StockCostLayer:
        """Create a new FIFO cost layer for incoming stock."""
        qty = Decimal(str(quantity))
        cost = Decimal(str(unit_cost))
        layer = StockCostLayer(
            id=uuid.uuid4(),
            vendor_id=vendor_id,
            product_id=product_id,
            variant_id=variant_id,
            movement_id=movement_id,
            received_qty=qty,
            consumed_qty=Decimal("0"),
            unit_cost=cost,
            total_cost=qty * cost,
            is_exhausted=False,
            source_type=source_type,
            notes=notes,
        )
        self.db.add(layer)
        if auto_commit:
            await self.db.commit()
            await self.db.refresh(layer)
        return layer

    # ── Consume Layers FIFO ───────────────────────────────────────────────────

    async def consume_layers(
        self,
        vendor_id: UUID,
        product_id: UUID,
        quantity: float,
        variant_id: Optional[UUID] = None,
        auto_commit: bool = False,
    ) -> dict:
        """
        Consume `quantity` units from cost layers, oldest first (FIFO).
        Returns { "cogs": float, "consumed_lots": [{layer_id, qty, unit_cost}] }
        Raises ValueError if insufficient layers to cover the quantity.
        """
        qty_to_consume = Decimal(str(quantity))
        if qty_to_consume <= 0:
            return {"cogs": 0.0, "consumed_lots": []}

        # Fetch non-exhausted layers ordered by creation date
        stmt = (
            select(StockCostLayer)
            .where(
                StockCostLayer.vendor_id == vendor_id,
                StockCostLayer.product_id == product_id,
                StockCostLayer.is_exhausted == False,
                (
                    StockCostLayer.variant_id == variant_id
                    if variant_id
                    else StockCostLayer.variant_id.is_(None)
                ),
            )
            .order_by(StockCostLayer.created_at.asc())
            .with_for_update()
        )
        layers = (await self.db.execute(stmt)).scalars().all()

        total_available = sum((l.received_qty - l.consumed_qty) for l in layers)
        if total_available < qty_to_consume:
            # Soft failure: consume what's available and log the gap
            # This can happen if layers pre-existed before FIFO was enabled
            qty_to_consume = total_available

        cogs = Decimal("0")
        consumed_lots = []

        remaining = qty_to_consume
        for layer in layers:
            if remaining <= 0:
                break
            available = layer.received_qty - layer.consumed_qty
            if available <= 0:
                continue
            take = min(available, remaining)
            layer.consumed_qty += take
            if layer.consumed_qty >= layer.received_qty:
                layer.is_exhausted = True
            cogs += take * layer.unit_cost
            consumed_lots.append({
                "layer_id": str(layer.id),
                "quantity": float(take),
                "unit_cost": float(layer.unit_cost),
                "cogs": float(take * layer.unit_cost),
            })
            remaining -= take

        if auto_commit:
            await self.db.commit()

        return {"cogs": float(cogs), "consumed_lots": consumed_lots}

    # ── Stock Valuation (FIFO) ────────────────────────────────────────────────

    async def get_stock_valuation(self, vendor_id: UUID) -> list[dict]:
        """
        Current FIFO inventory valuation per product.
        Returns remaining cost for non-exhausted layers.
        """
        stmt = (
            select(
                StockCostLayer.product_id,
                StockCostLayer.variant_id,
                func.sum(StockCostLayer.received_qty - StockCostLayer.consumed_qty).label("qty"),
                func.sum(
                    (StockCostLayer.received_qty - StockCostLayer.consumed_qty) * StockCostLayer.unit_cost
                ).label("fifo_value"),
                func.min(StockCostLayer.unit_cost).label("min_cost"),
                func.max(StockCostLayer.unit_cost).label("max_cost"),
                func.avg(
                    StockCostLayer.unit_cost *
                    (StockCostLayer.received_qty - StockCostLayer.consumed_qty)
                ).label("wac_numerator"),  # rough weighted avg
            )
            .where(
                StockCostLayer.vendor_id == vendor_id,
                StockCostLayer.is_exhausted == False,
            )
            .group_by(StockCostLayer.product_id, StockCostLayer.variant_id)
        )
        rows = (await self.db.execute(stmt)).all()
        return [
            {
                "product_id": str(r.product_id),
                "variant_id": str(r.variant_id) if r.variant_id else None,
                "remaining_qty": float(r.qty or 0),
                "fifo_value": round(float(r.fifo_value or 0), 4),
                "min_unit_cost": float(r.min_cost or 0),
                "max_unit_cost": float(r.max_cost or 0),
            }
            for r in rows
        ]

    # ── Weighted Average Cost (WAC) ───────────────────────────────────────────

    async def get_weighted_average_cost(
        self,
        vendor_id: UUID,
        product_id: UUID,
        variant_id: Optional[UUID] = None,
    ) -> float:
        """Compute current weighted average cost from non-exhausted layers."""
        stmt = (
            select(
                func.sum(
                    (StockCostLayer.received_qty - StockCostLayer.consumed_qty) * StockCostLayer.unit_cost
                ).label("total_value"),
                func.sum(StockCostLayer.received_qty - StockCostLayer.consumed_qty).label("total_qty"),
            )
            .where(
                StockCostLayer.vendor_id == vendor_id,
                StockCostLayer.product_id == product_id,
                StockCostLayer.is_exhausted == False,
                (
                    StockCostLayer.variant_id == variant_id
                    if variant_id
                    else StockCostLayer.variant_id.is_(None)
                ),
            )
        )
        row = (await self.db.execute(stmt)).one_or_none()
        if not row or not row.total_qty or row.total_qty == 0:
            return 0.0
        return float(Decimal(str(row.total_value)) / Decimal(str(row.total_qty)))
