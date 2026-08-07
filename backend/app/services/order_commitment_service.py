"""order_commitment_service.py — Phase-3 ATP check and schedule line creation.

For each OrderLine on a newly created order this service:
  1. Checks on-hand stock at the order's business unit (StoreInventory).
  2. Subtracts existing active StockReservation rows for the same product/store.
  3. Commits as much as possible:
       - available >= ordered → one "committed" schedule line, confirmed_date = today
       - 0 < available < ordered → one committed + one open schedule line
       - available <= 0 → one "open" schedule line (no commitment yet)
  4. Writes a StockReservation record for every unit committed (status "active").
  5. Updates OrderLine.committed_qty.

Services (item_type == "service") are treated as always available because they
are capacity-based, not inventory-based.  Products with track_inventory=False
are also always committed immediately.

The caller is responsible for committing the transaction.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mrp import StockReservation
from app.models.order import Order, OrderLine, OrderLineSchedule
from app.models.store import StoreInventory
from app.models.vendor_product import Product

log = logging.getLogger(__name__)

# When confirming from stock the committed date is today + this safety buffer.
IN_STOCK_LEAD_DAYS = 0


async def _get_available_qty(
    db: AsyncSession,
    vendor_id: UUID,
    store_id: UUID | None,
    product_id: UUID,
    variant_id: UUID | None,
) -> int:
    """Return net available qty = on-hand - active reservations for this product/store."""
    # On-hand stock
    q = select(func.coalesce(func.sum(StoreInventory.quantity), 0)).where(
        StoreInventory.vendor_id == vendor_id,
        StoreInventory.product_id == product_id,
    )
    if store_id:
        q = q.where(StoreInventory.store_id == store_id)
    if variant_id:
        q = q.where(StoreInventory.variant_id == variant_id)
    else:
        q = q.where(StoreInventory.variant_id.is_(None))

    on_hand: int = (await db.execute(q)).scalar() or 0

    # Subtract active reservations
    rq = select(func.coalesce(func.sum(StockReservation.reserved_qty), 0)).where(
        StockReservation.vendor_id == vendor_id,
        StockReservation.product_id == product_id,
        StockReservation.status == "active",
    )
    if store_id:
        rq = rq.where(StockReservation.store_id == store_id)
    if variant_id:
        rq = rq.where(StockReservation.variant_id == variant_id)
    else:
        rq = rq.where(StockReservation.variant_id.is_(None))

    reserved: Decimal = (await db.execute(rq)).scalar() or Decimal("0")

    return max(0, on_hand - int(reserved.to_integral_value()))


async def _is_tracked(db: AsyncSession, product_id: UUID) -> bool:
    """Return True if the product has track_inventory enabled."""
    row = await db.execute(
        select(Product.track_inventory).where(Product.id == product_id)
    )
    val = row.scalars().first()
    return bool(val) if val is not None else True


async def commit_order_lines(
    db: AsyncSession,
    order: Order,
    lines: list[OrderLine],
) -> None:
    """Create OrderLineSchedule rows and StockReservation records for *lines*.

    Called immediately after the order lines have been flushed (so their ids
    are available) but before the transaction is committed.
    """
    today = date.today()
    requested_date: date | None = getattr(order, "requested_delivery_date", None)

    for line in lines:
        ordered = float(line.ordered_qty)
        if ordered <= 0:
            continue

        req_date = requested_date  # header-level; Phase-3 uses header date

        # ── Services and non-tracked products → always commit fully ──────────
        if line.item_type == "service" or line.product_id is None:
            _add_schedule(
                db, line, order,
                schedule_no=1,
                requested_qty=ordered,
                confirmed_qty=ordered,
                requested_date=req_date,
                confirmed_date=today,
                status="committed",
                commitment_source="manual",
            )
            line.committed_qty = Decimal(str(ordered))
            continue

        tracked = await _is_tracked(db, line.product_id)
        if not tracked:
            _add_schedule(
                db, line, order,
                schedule_no=1,
                requested_qty=ordered,
                confirmed_qty=ordered,
                requested_date=req_date,
                confirmed_date=today + timedelta(days=IN_STOCK_LEAD_DAYS),
                status="committed",
                commitment_source="in_stock",
            )
            line.committed_qty = Decimal(str(ordered))
            continue

        # ── ATP check ────────────────────────────────────────────────────────
        try:
            available = await _get_available_qty(
                db,
                vendor_id=order.vendor_id,
                store_id=order.store_id,
                product_id=line.product_id,
                variant_id=line.variant_id,
            )
        except Exception as exc:
            log.warning(
                "ATP check failed for line %s (product %s): %s — treating as open",
                line.id, line.product_id, exc,
            )
            available = 0

        committed = min(ordered, float(available))
        open_qty = ordered - committed

        schedule_no = 1
        if committed > 0:
            _add_schedule(
                db, line, order,
                schedule_no=schedule_no,
                requested_qty=committed,
                confirmed_qty=committed,
                requested_date=req_date,
                confirmed_date=today + timedelta(days=IN_STOCK_LEAD_DAYS),
                status="committed",
                commitment_source="in_stock",
            )
            # Reserve this stock so it isn't double-committed
            db.add(StockReservation(
                vendor_id=order.vendor_id,
                order_type="sales_order",
                order_id=str(order.id),
                store_id=order.store_id,
                product_id=line.product_id,
                variant_id=line.variant_id,
                reserved_qty=Decimal(str(committed)),
                status="active",
                notes=f"Order {order.order_number} line {line.line_no}",
            ))
            line.committed_qty = Decimal(str(committed))
            schedule_no += 1

        if open_qty > 0:
            _add_schedule(
                db, line, order,
                schedule_no=schedule_no,
                requested_qty=open_qty,
                confirmed_qty=0,
                requested_date=req_date,
                confirmed_date=None,
                status="open",
                commitment_source="none",
                notes="Insufficient stock at time of order — commitment pending",
            )


def _add_schedule(
    db: AsyncSession,
    line: OrderLine,
    order: Order,
    *,
    schedule_no: int,
    requested_qty: float,
    confirmed_qty: float,
    requested_date: date | None,
    confirmed_date: date | None,
    status: str,
    commitment_source: str,
    notes: str | None = None,
) -> OrderLineSchedule:
    s = OrderLineSchedule(
        order_line_id=line.id,
        order_id=order.id,
        vendor_id=order.vendor_id,
        schedule_no=schedule_no,
        requested_date=requested_date,
        confirmed_date=confirmed_date,
        requested_qty=Decimal(str(requested_qty)),
        confirmed_qty=Decimal(str(confirmed_qty)),
        shipped_qty=Decimal("0"),
        status=status,
        commitment_source=commitment_source,
        notes=notes,
    )
    db.add(s)
    return s
