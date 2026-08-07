"""delivery_service.py — Phase-4 outbound delivery document management.

Responsibilities:
  create_delivery()    Build a delivery document from a sales order, checking
                       that the requested quantities do not exceed what is still
                       open on each order line.
  update_picked_qty()  Record how many units were physically picked per line.
  post_goods_issue()   Finalise the delivery: mark as goods-issued, push
                       shipped quantities back to order lines / schedules and
                       update the order's fulfillment_status / shipped_at.

Design notes:
  • Stock was already deducted at order confirmation/payment, so GI does NOT
    call InventoryService.deduct_for_sale a second time.
  • GI consumes (status → consumed) the matching StockReservation rows that
    were created during Phase-3 ATP.
  • The caller is responsible for committing the session.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mrp import StockReservation
from app.models.order import (
    Order, OrderLine, OrderLineSchedule, OrderDelivery, DeliveryLine
)

log = logging.getLogger(__name__)


# ─── helpers ─────────────────────────────────────────────────────────────────

async def _get_order_for_vendor(
    db: AsyncSession, vendor_id: UUID, order_id: UUID
) -> Order:
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.vendor_id == vendor_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Order not found")
    return order


async def _get_delivery_for_vendor(
    db: AsyncSession, vendor_id: UUID, delivery_id: UUID
) -> OrderDelivery:
    result = await db.execute(
        select(OrderDelivery).where(
            OrderDelivery.id == delivery_id,
            OrderDelivery.vendor_id == vendor_id,
        )
    )
    d = result.scalar_one_or_none()
    if not d:
        raise HTTPException(404, "Delivery not found")
    return d


async def _sum_already_delivered(
    db: AsyncSession, order_line_id: UUID
) -> Decimal:
    """Sum of issued_qty across all non-cancelled deliveries for this line."""
    result = await db.execute(
        select(func.coalesce(func.sum(DeliveryLine.issued_qty), 0)).where(
            DeliveryLine.order_line_id == order_line_id,
            DeliveryLine.status != "cancelled",
        )
    )
    return result.scalar() or Decimal("0")


# ─── create ──────────────────────────────────────────────────────────────────

async def create_delivery(
    db: AsyncSession,
    vendor_id: UUID,
    order_id: UUID,
    items: list[dict],  # [{order_line_id, planned_qty, batch_number?, serial_number?, notes?}]
    planned_gi_date: date | None = None,
    shipping_address: dict | None = None,
    carrier: str | None = None,
    tracking_number: str | None = None,
    notes: str | None = None,
    created_by: UUID | None = None,
) -> OrderDelivery:
    """
    Create an outbound delivery document for *items* from the given order.

    Raises HTTP 400 if:
      - The order has a fulfillment_block set.
      - Any requested qty exceeds the open (undelivered) qty on that line.
    """
    order = await _get_order_for_vendor(db, vendor_id, order_id)

    if order.fulfillment_block:
        raise HTTPException(400, f"Order is blocked for fulfillment: {order.fulfillment_block}")

    terminal_statuses = {"cancelled", "refunded", "returned"}
    if order.status in terminal_statuses:
        raise HTTPException(400, f"Cannot create delivery for order in '{order.status}' status")

    # Build delivery header (delivery_number comes from DB default)
    delivery = OrderDelivery(
        order_id=order_id,
        vendor_id=vendor_id,
        store_id=order.store_id,
        delivery_type="standard",
        status="draft",
        planned_gi_date=planned_gi_date,
        shipping_address=shipping_address or order.shipping_address,
        carrier=carrier,
        tracking_number=tracking_number,
        notes=notes,
        created_by=created_by,
    )
    db.add(delivery)
    await db.flush()  # get delivery.id

    # Build delivery lines
    line_no = 1
    for item in items:
        ol_id_raw = item.get("order_line_id")
        planned_qty = Decimal(str(item.get("planned_qty", 0)))
        if planned_qty <= 0:
            continue

        if ol_id_raw:
            ol_id = UUID(str(ol_id_raw))
            result = await db.execute(
                select(OrderLine).where(
                    OrderLine.id == ol_id,
                    OrderLine.order_id == order_id,
                )
            )
            ol = result.scalar_one_or_none()
            if not ol:
                raise HTTPException(400, f"Order line {ol_id} not found on this order")

            already_issued = await _sum_already_delivered(db, ol_id)
            open_qty = Decimal(str(ol.ordered_qty)) - already_issued
            if planned_qty > open_qty:
                raise HTTPException(
                    400,
                    f"Line {ol.line_no}: requested {planned_qty} but only {open_qty} open.",
                )

            dl = DeliveryLine(
                delivery_id=delivery.id,
                order_id=order_id,
                order_line_id=ol_id,
                vendor_id=vendor_id,
                line_no=line_no,
                product_id=ol.product_id,
                variant_id=ol.variant_id,
                product_name=ol.product_name,
                sku=ol.sku,
                unit=ol.unit or "pcs",
                planned_qty=planned_qty,
                picked_qty=Decimal("0"),
                packed_qty=Decimal("0"),
                issued_qty=Decimal("0"),
                status="open",
                batch_number=item.get("batch_number"),
                serial_number=item.get("serial_number"),
                notes=item.get("notes"),
            )
        else:
            # Free-form line not tied to an order line
            dl = DeliveryLine(
                delivery_id=delivery.id,
                order_id=order_id,
                order_line_id=None,
                vendor_id=vendor_id,
                line_no=line_no,
                product_name=item.get("product_name"),
                sku=item.get("sku"),
                unit=item.get("unit", "pcs"),
                planned_qty=planned_qty,
                picked_qty=Decimal("0"),
                packed_qty=Decimal("0"),
                issued_qty=Decimal("0"),
                status="open",
                notes=item.get("notes"),
            )

        db.add(dl)
        line_no += 1

    return delivery


# ─── update picked qty ───────────────────────────────────────────────────────

async def update_delivery_lines(
    db: AsyncSession,
    vendor_id: UUID,
    delivery_id: UUID,
    line_updates: list[dict],  # [{delivery_line_id, picked_qty?, packed_qty?, batch_number?, serial_number?}]
) -> OrderDelivery:
    """Update picked/packed quantities on delivery lines (warehouse scanning step)."""
    delivery = await _get_delivery_for_vendor(db, vendor_id, delivery_id)

    if delivery.status in ("goods_issued", "cancelled"):
        raise HTTPException(400, f"Cannot update lines on a '{delivery.status}' delivery")

    for upd in line_updates:
        dl_id = UUID(str(upd["delivery_line_id"]))
        result = await db.execute(
            select(DeliveryLine).where(
                DeliveryLine.id == dl_id,
                DeliveryLine.delivery_id == delivery_id,
            )
        )
        dl = result.scalar_one_or_none()
        if not dl:
            continue

        if "picked_qty" in upd:
            dl.picked_qty = Decimal(str(upd["picked_qty"]))
        if "packed_qty" in upd:
            dl.packed_qty = Decimal(str(upd["packed_qty"]))
        if "batch_number" in upd:
            dl.batch_number = upd["batch_number"]
        if "serial_number" in upd:
            dl.serial_number = upd["serial_number"]
        if "notes" in upd:
            dl.notes = upd["notes"]

        # Auto-advance status
        if dl.packed_qty >= dl.planned_qty:
            dl.status = "packed"
        elif dl.picked_qty >= dl.planned_qty:
            dl.status = "picked"
        elif dl.picked_qty > 0:
            dl.status = "picking"

    # Advance delivery header status if all lines packed
    lines_result = await db.execute(
        select(DeliveryLine).where(DeliveryLine.delivery_id == delivery_id)
    )
    all_lines = lines_result.scalars().all()
    if all_lines and all(dl.status == "packed" for dl in all_lines):
        delivery.status = "packed"
    elif any(dl.status in ("picking", "picked", "packed") for dl in all_lines):
        delivery.status = "picking"

    return delivery


# ─── goods issue ─────────────────────────────────────────────────────────────

async def post_goods_issue(
    db: AsyncSession,
    vendor_id: UUID,
    delivery_id: UUID,
    actual_gi_date: date | None = None,
) -> OrderDelivery:
    """
    Post goods issue for a delivery.

    This finalises the delivery and propagates shipped quantities back to:
      • delivery_line.issued_qty / status
      • order_line.shipped_qty
      • order_line_schedule.shipped_qty / status
      • StockReservation → status consumed
      • Order.fulfillment_status, Order.shipped_at, Order.status
    """
    delivery = await _get_delivery_for_vendor(db, vendor_id, delivery_id)

    if delivery.status == "goods_issued":
        raise HTTPException(400, "Goods issue already posted for this delivery")
    if delivery.status == "cancelled":
        raise HTTPException(400, "Cannot post GI on a cancelled delivery")

    gi_date = actual_gi_date or date.today()
    delivery.actual_gi_date = gi_date
    delivery.status = "goods_issued"

    order = await db.get(Order, delivery.order_id)

    # Process each line
    lines_result = await db.execute(
        select(DeliveryLine).where(DeliveryLine.delivery_id == delivery_id)
    )
    dl_rows = lines_result.scalars().all()

    for dl in dl_rows:
        # Use picked_qty if available; otherwise use planned_qty
        issue_qty = dl.picked_qty if dl.picked_qty > 0 else dl.planned_qty
        dl.issued_qty = issue_qty
        dl.status = "issued"

        if not dl.order_line_id:
            continue

        # Push back to order_line
        result = await db.execute(
            select(OrderLine).where(OrderLine.id == dl.order_line_id)
        )
        ol = result.scalar_one_or_none()
        if ol:
            ol.shipped_qty = (ol.shipped_qty or Decimal("0")) + issue_qty

            # Push to schedule lines — fill the earliest committed schedule first
            sched_result = await db.execute(
                select(OrderLineSchedule).where(
                    OrderLineSchedule.order_line_id == ol.id,
                    OrderLineSchedule.status.in_(["committed", "partial", "open"]),
                ).order_by(OrderLineSchedule.schedule_no)
            )
            schedules = sched_result.scalars().all()
            remaining = issue_qty
            for s in schedules:
                if remaining <= 0:
                    break
                fillable = s.confirmed_qty - (s.shipped_qty or Decimal("0"))
                if fillable <= 0:
                    fillable = s.requested_qty - (s.shipped_qty or Decimal("0"))
                fill = min(remaining, fillable if fillable > 0 else remaining)
                s.shipped_qty = (s.shipped_qty or Decimal("0")) + Decimal(str(fill))
                remaining -= fill
                if s.shipped_qty >= s.confirmed_qty and s.confirmed_qty > 0:
                    s.status = "shipped"
                elif s.shipped_qty > 0:
                    s.status = "partial"

        # Consume matching StockReservation
        resv_result = await db.execute(
            select(StockReservation).where(
                StockReservation.vendor_id == vendor_id,
                StockReservation.order_type == "sales_order",
                StockReservation.order_id == str(delivery.order_id),
                StockReservation.product_id == dl.product_id,
                StockReservation.status == "active",
            ).limit(1)
        )
        resv = resv_result.scalar_one_or_none()
        if resv:
            resv.status = "consumed"
            resv.consumed_at = datetime.now(timezone.utc)

    # ── Recalculate order fulfillment_status ────────────────────────────────
    if order:
        await _refresh_order_fulfillment(db, order, vendor_id)

    return delivery


async def _refresh_order_fulfillment(
    db: AsyncSession, order: Order, vendor_id: UUID
) -> None:
    """Recompute Order.fulfillment_status and Order.shipped_at from order_lines."""
    lines_result = await db.execute(
        select(OrderLine).where(OrderLine.order_id == order.id)
    )
    lines = lines_result.scalars().all()

    if not lines:
        return

    total_ordered = sum(float(l.ordered_qty) for l in lines)
    total_shipped = sum(float(l.shipped_qty or 0) for l in lines)

    if total_shipped <= 0:
        order.fulfillment_status = "open"
    elif total_shipped >= total_ordered:
        order.fulfillment_status = "complete"
        if not order.shipped_at:
            order.shipped_at = datetime.now(timezone.utc)
        # Advance order status to "shipped" if not already beyond that
        if order.status in ("confirmed", "processing"):
            order.status = "shipped"
    else:
        order.fulfillment_status = "partial"
        if order.status in ("confirmed", "processing"):
            order.status = "processing"


# ─── cancel delivery ─────────────────────────────────────────────────────────

async def cancel_delivery(
    db: AsyncSession,
    vendor_id: UUID,
    delivery_id: UUID,
    reason: str | None = None,
) -> OrderDelivery:
    """Cancel a delivery that has not yet been goods-issued."""
    delivery = await _get_delivery_for_vendor(db, vendor_id, delivery_id)
    if delivery.status == "goods_issued":
        raise HTTPException(400, "Cannot cancel a delivery after goods issue")
    delivery.status = "cancelled"
    if reason:
        delivery.notes = (delivery.notes or "") + f"\nCancelled: {reason}"
    return delivery
