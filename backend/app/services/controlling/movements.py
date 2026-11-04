"""Goods movements and activity confirmations against Controlling orders.

Each document
  * is only accepted in an allowed order state (see ``guards``),
  * gets a gapless document number (movements),
  * updates the order's actual cost lines (components -> material line, confirmations -> activity line)
    and operation progress, and quantity delivered (FG receipts),
  * is optionally journalled in "WIP accumulation mode" (``co_gl_mapping.post_wip_to_gl``),
  * can be reversed by a counter-document / status change that undoes every one of those effects.
"""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.controlling import (
    CoActivityConfirmation,
    CoGoodsMovement,
    CoManufacturingOrder,
    CoOrderCostLine,
    CoOrderOperation,
)
from app.services.controlling.budget_control import assert_budget_allows
from app.services.controlling.guards import (
    StateError,
    assert_order_accepts_actuals,
    assert_order_accepts_receipt,
)
from app.services.controlling.numbering import next_goods_movement_no
from app.services.controlling.settlement import (
    _dec,
    get_gl_mapping,
    load_order_for_settlement,
    order_line_amounts,
    post_event,
    reverse_journal,
)

ZERO = Decimal("0")
Q4 = Decimal("0.0001")
Q6 = Decimal("0.000001")

MOVEMENT_LABELS = {
    "component_issue": "Goods Issue — Component to Order",
    "component_return": "Goods Issue Return — Component from Order",
    "fg_receipt": "Goods Receipt — FG from Order",
    "fg_receipt_reversal": "Goods Receipt Return — FG to Order",
}
REVERSE_MOVEMENT = {
    "component_issue": "component_return",
    "component_return": "component_issue",
    "fg_receipt": "fg_receipt_reversal",
    "fg_receipt_reversal": "fg_receipt",
}


# ── cost-line sync helpers ────────────────────────────────────────────────────

async def _find_line(
    db: AsyncSession, order_id: UUID, category: str, *, product_id: Optional[UUID] = None,
    activity_type_id: Optional[UUID] = None,
) -> Optional[CoOrderCostLine]:
    q = select(CoOrderCostLine).where(CoOrderCostLine.order_id == order_id, CoOrderCostLine.category == category)
    if category == "material":
        q = q.where(CoOrderCostLine.product_id == product_id)
    else:
        q = q.where(CoOrderCostLine.activity_type_id == activity_type_id)
    return (await db.execute(q.order_by(CoOrderCostLine.sequence))).scalars().first()


async def _adjust_actual(
    db: AsyncSession, order_id: UUID, category: str, qty: Decimal, amount: Decimal, *,
    product_id: Optional[UUID] = None, activity_type_id: Optional[UUID] = None,
    description: str = "", uom: str = "EA", create_if_missing: bool = True,
) -> None:
    """Add (or, with negative values, remove) actual qty / amount on the matching cost line."""
    ln = await _find_line(db, order_id, category, product_id=product_id, activity_type_id=activity_type_id)
    if ln is None:
        if qty < 0 or amount < 0:
            raise StateError("No matching cost line to take the reversal from.")
        if not create_if_missing:
            return
        max_seq = (
            await db.execute(select(CoOrderCostLine.sequence).where(CoOrderCostLine.order_id == order_id))
        ).scalars().all()
        ln = CoOrderCostLine(
            order_id=order_id, category=category, description=description or category.title(),
            product_id=product_id, activity_type_id=activity_type_id, uom=uom,
            qty_planned=ZERO, rate_planned=ZERO, amount_planned=ZERO,
            qty_actual=ZERO, rate_actual=ZERO, amount_actual=ZERO,
            sequence=(max(max_seq) + 1) if max_seq else 0,
        )
        db.add(ln)
    ln.qty_actual = max(ZERO, _dec(ln.qty_actual) + qty)
    ln.amount_actual = max(ZERO, _dec(ln.amount_actual) + amount)
    if _dec(ln.qty_actual) > 0:
        ln.rate_actual = (_dec(ln.amount_actual) / _dec(ln.qty_actual)).quantize(Q6)
    else:
        ln.rate_actual = ZERO
    # Qty x rate now equals the amount by construction; keep the invariant explicit.
    order_line_amounts(ln)


# ── WIP journals (optional mode) ─────────────────────────────────────────────

async def _wip_mapping(db: AsyncSession, vendor_id: UUID, company_id: UUID, need: str):
    """Mapping when WIP accumulation mode is on (validated), else None."""
    mapping = await get_gl_mapping(db, vendor_id, company_id)
    if mapping is None or not mapping.post_wip_to_gl:
        return None
    if not mapping.wip_account_id or not getattr(mapping, need):
        raise ValueError(
            f"WIP accumulation mode is on: configure the WIP and "
            f"{'raw material' if need == 'raw_material_account_id' else 'absorption'} accounts in CO GL mapping"
        )
    return mapping


async def _post_doc_journal(
    db: AsyncSession, vendor_id: UUID, order: CoManufacturingOrder, doc_id: UUID, doc_date: date,
    debit_acc: UUID, credit_acc: UUID, amount: Decimal, narration: str, actor_id: Optional[UUID],
) -> Optional[UUID]:
    cc = str(order.cost_center_id) if order.cost_center_id else None
    pj = str(order.project_id) if order.project_id else None
    payload = {
        "company_id": order.company_id,
        "entry_date": doc_date.isoformat(),
        "document_type": "CO",
        "narration": narration,
        "reference": order.order_no,
        "ref_doc_type": "co_manufacturing_order",
        "ref_doc_id": str(order.id),
        "lines": [
            {"account_id": str(debit_acc), "debit": str(amount), "credit": "0",
             "narration": narration, "cost_center_id": cc, "project_id": pj},
            {"account_id": str(credit_acc), "debit": "0", "credit": str(amount),
             "narration": narration, "cost_center_id": cc, "project_id": pj},
        ],
    }
    je = await post_event(db, vendor_id, "co_cost_booking", doc_id, payload, created_by_id=actor_id)
    if not je:
        raise ValueError("Journal posting failed — check GL accounts and period")
    return je.id


# ── goods movements ──────────────────────────────────────────────────────────

async def create_goods_movement(
    db: AsyncSession,
    vendor_id: UUID,
    *,
    order_id: UUID,
    movement_type: str,
    posting_date: date,
    product_id: Optional[UUID],
    qty: Decimal,
    unit_cost: Decimal,
    actor_id: Optional[UUID],
    description: Optional[str] = None,
    uom: str = "EA",
    cost_center_id: Optional[UUID] = None,
    storage_location: Optional[str] = None,
    batch_no: Optional[str] = None,
    extra: Optional[dict[str, Any]] = None,
    reverses: Optional[CoGoodsMovement] = None,
) -> CoGoodsMovement:
    if movement_type not in MOVEMENT_LABELS:
        raise ValueError(f"Invalid movement_type. Use: {list(MOVEMENT_LABELS)}")
    order = await load_order_for_settlement(db, vendor_id, order_id)
    if not order:
        raise ValueError("Order not found")
    qty = _dec(qty)
    unit_cost = _dec(unit_cost)
    if qty <= 0:
        raise ValueError("qty must be greater than zero")
    is_component = movement_type in ("component_issue", "component_return")
    if is_component and not product_id:
        raise ValueError("product_id is required for component issue / return")
    total = (qty * unit_cost).quantize(Q4)

    if is_component:
        await assert_order_accepts_actuals(db, order)
        if movement_type == "component_issue" and total > 0:
            await assert_budget_allows(db, order.id, "material", total)
    else:
        await assert_order_accepts_receipt(db, order)

    gm = CoGoodsMovement(
        id=uuid.uuid4(),
        vendor_id=vendor_id,
        company_id=order.company_id,
        order_id=order.id,
        movement_type=movement_type,
        posting_date=posting_date,
        document_no=await next_goods_movement_no(db, vendor_id),
        product_id=product_id,
        description=description or MOVEMENT_LABELS[movement_type],
        uom=uom,
        qty=qty,
        unit_cost=unit_cost,
        total_cost=total,
        cost_center_id=cost_center_id,
        storage_location=storage_location,
        batch_no=batch_no,
        status="posted",
        extra=extra or {},
    )
    db.add(gm)

    if is_component:
        sign = Decimal("1") if movement_type == "component_issue" else Decimal("-1")
        await _adjust_actual(
            db, order.id, "material", sign * qty, sign * total, product_id=product_id,
            description="Component issued", uom=uom,
            create_if_missing=movement_type == "component_issue",
        )
        mapping = await _wip_mapping(db, vendor_id, order.company_id, "raw_material_account_id")
        if mapping is not None and total > 0:
            wip, rm = mapping.wip_account_id, mapping.raw_material_account_id
            dr, cr = (wip, rm) if movement_type == "component_issue" else (rm, wip)
            gm.journal_entry_id = await _post_doc_journal(
                db, vendor_id, order, gm.id, posting_date, dr, cr, total,
                f"{gm.document_no} {movement_type} {order.order_no}", actor_id,
            )
    else:
        delivered = _dec(order.qty_delivered)
        if movement_type == "fg_receipt":
            order.qty_delivered = delivered + qty
        else:
            new = delivered - qty
            if new < 0:
                raise ValueError("Receipt return exceeds the quantity delivered")
            if new < _dec(order.qty_cogs_posted):
                raise StateError("COGS is already posted for this quantity — reverse the COGS posting first")
            order.qty_delivered = new
    await db.flush()
    return gm


async def reverse_goods_movement(
    db: AsyncSession,
    vendor_id: UUID,
    gm: CoGoodsMovement,
    reason: str,
    actor_id: Optional[UUID],
) -> CoGoodsMovement:
    """Reverse ``gm`` with a counter-document (new number) and undo its cost / quantity / GL effects."""
    if gm.status == "reversed":
        raise StateError("This goods movement has already been reversed")
    if (gm.extra or {}).get("reverses_id"):
        raise StateError("Cannot reverse a reversal document")
    rev_type = REVERSE_MOVEMENT.get(gm.movement_type)
    if not rev_type:
        raise ValueError(f"Cannot reverse movement_type '{gm.movement_type}'")

    rev = await create_goods_movement(
        db, vendor_id,
        order_id=gm.order_id, movement_type=rev_type, posting_date=date.today(),
        product_id=gm.product_id, qty=_dec(gm.qty), unit_cost=_dec(gm.unit_cost), actor_id=actor_id,
        description=f"Reversal of {gm.document_no or gm.id}" + (f" — {reason}" if reason else ""),
        uom=gm.uom or "EA", cost_center_id=gm.cost_center_id, storage_location=gm.storage_location,
        batch_no=gm.batch_no,
        extra={"reverses_id": str(gm.id), "reverses_document_no": gm.document_no, "reversal_reason": reason},
    )
    rev.reversal_reason = reason
    # The counter-document already booked the opposite GL effect when WIP mode is on; the
    # original journal is retired so the pair does not net to a visible double entry.
    if gm.journal_entry_id:
        await reverse_journal(db, vendor_id, gm.journal_entry_id, actor_id)
        if rev.journal_entry_id:
            await reverse_journal(db, vendor_id, rev.journal_entry_id, actor_id)
            rev.journal_entry_id = None
    gm.status = "reversed"
    gm.reversal_reason = reason
    gm.extra = {**(gm.extra or {}), "reversed_by_id": str(rev.id), "reversed_by_document_no": rev.document_no}
    await db.flush()
    return rev


# ── activity confirmations ───────────────────────────────────────────────────

def _refresh_operation_status(op: CoOrderOperation) -> None:
    planned = _dec(op.planned_qty)
    confirmed = _dec(op.confirmed_qty)
    if planned > 0 and confirmed >= planned:
        op.status = "completed"
    elif confirmed > 0 or _dec(op.actual_hours) > 0:
        op.status = "in_progress"
    elif op.status in ("completed", "in_progress"):
        op.status = "released"


async def _get_operation(db: AsyncSession, order_id: UUID, operation_id: Optional[UUID]) -> Optional[CoOrderOperation]:
    if not operation_id:
        return None
    return (
        await db.execute(
            select(CoOrderOperation).where(
                CoOrderOperation.id == operation_id, CoOrderOperation.order_id == order_id
            )
        )
    ).scalar_one_or_none()


def _apply_to_operation(op: Optional[CoOrderOperation], hours: Decimal, qty: Decimal, scrap: Decimal = ZERO) -> None:
    if op is None:
        return
    op.actual_hours = max(ZERO, _dec(op.actual_hours) + hours)
    op.confirmed_qty = max(ZERO, _dec(op.confirmed_qty) + qty)
    op.scrap_qty = max(ZERO, _dec(op.scrap_qty) + scrap)
    _refresh_operation_status(op)


async def create_confirmation(
    db: AsyncSession,
    vendor_id: UUID,
    *,
    order_id: UUID,
    operation_id: Optional[UUID],
    activity_type_id: Optional[UUID],
    cost_center_id: Optional[UUID],
    confirmation_date: date,
    confirmation_type: str,
    qty_confirmed: Decimal,
    hours_confirmed: Decimal,
    rate_per_hour: Decimal,
    scrap_qty: Decimal,
    yield_pct: Decimal,
    narration: Optional[str],
    extra: Optional[dict[str, Any]],
    actor_id: Optional[UUID],
) -> CoActivityConfirmation:
    order = await load_order_for_settlement(db, vendor_id, order_id)
    if not order:
        raise ValueError("Order not found")
    await assert_order_accepts_actuals(db, order)
    hours, rate = _dec(hours_confirmed), _dec(rate_per_hour)
    total = (hours * rate).quantize(Q4)
    if total > 0:
        await assert_budget_allows(db, order.id, "labor", total)

    op = await _get_operation(db, order.id, operation_id)
    conf = CoActivityConfirmation(
        id=uuid.uuid4(),
        vendor_id=vendor_id,
        company_id=order.company_id,
        order_id=order.id,
        operation_id=operation_id,
        activity_type_id=activity_type_id,
        cost_center_id=cost_center_id,
        confirmation_date=confirmation_date,
        confirmation_type=confirmation_type,
        qty_confirmed=qty_confirmed,
        hours_confirmed=hours,
        rate_per_hour=rate,
        total_cost=total,
        scrap_qty=scrap_qty,
        yield_pct=yield_pct,
        status="posted",
        narration=narration,
        extra=extra or {},
    )
    db.add(conf)
    _apply_to_operation(op, hours, _dec(qty_confirmed), _dec(scrap_qty))
    if op is not None and rate > 0:
        op.actual_rate = rate
    if hours > 0 or total > 0:
        await _adjust_actual(
            db, order.id, "activity", hours, total, activity_type_id=activity_type_id,
            description=f"{confirmation_type.title()} confirmed", uom="H",
        )

    mapping = await _wip_mapping(db, vendor_id, order.company_id, "absorption_account_id")
    if mapping is not None and total > 0:
        conf.journal_entry_id = await _post_doc_journal(
            db, vendor_id, order, conf.id, confirmation_date,
            mapping.wip_account_id, mapping.absorption_account_id, total,
            f"Activity confirmation {order.order_no}", actor_id,
        )
    await db.flush()
    return conf


async def _undo_confirmation_effects(
    db: AsyncSession, order: CoManufacturingOrder, conf: CoActivityConfirmation
) -> None:
    hours, total = _dec(conf.hours_confirmed), _dec(conf.total_cost)
    op = await _get_operation(db, order.id, conf.operation_id)
    _apply_to_operation(op, -hours, -_dec(conf.qty_confirmed), -_dec(conf.scrap_qty))
    if hours > 0 or total > 0:
        await _adjust_actual(
            db, order.id, "activity", -hours, -total, activity_type_id=conf.activity_type_id,
            create_if_missing=False,
        )


async def update_confirmation(
    db: AsyncSession,
    vendor_id: UUID,
    conf: CoActivityConfirmation,
    changes: dict[str, Any],
    actor_id: Optional[UUID],
) -> CoActivityConfirmation:
    """Edit a not-yet-journalled confirmation; operation progress and cost lines follow the delta."""
    if conf.status == "reversed":
        raise StateError("A reversed confirmation cannot be edited")
    if conf.journal_entry_id and set(changes) - {"narration"}:
        raise StateError("This confirmation is journalled — reverse it and enter a new one")
    order = await load_order_for_settlement(db, vendor_id, conf.order_id)
    if not order:
        raise ValueError("Order not found")
    cost_fields = {"hours_confirmed", "rate_per_hour", "qty_confirmed", "scrap_qty", "confirmation_type"}
    if cost_fields & set(changes):
        await assert_order_accepts_actuals(db, order)
        await _undo_confirmation_effects(db, order, conf)
    for field, val in changes.items():
        setattr(conf, field, val)
    if cost_fields & set(changes):
        hours, rate = _dec(conf.hours_confirmed), _dec(conf.rate_per_hour)
        conf.total_cost = (hours * rate).quantize(Q4)
        if conf.total_cost > 0:
            await assert_budget_allows(db, order.id, "labor", conf.total_cost)
        op = await _get_operation(db, order.id, conf.operation_id)
        _apply_to_operation(op, hours, _dec(conf.qty_confirmed), _dec(conf.scrap_qty))
        if hours > 0 or conf.total_cost > 0:
            await _adjust_actual(
                db, order.id, "activity", hours, conf.total_cost, activity_type_id=conf.activity_type_id,
                description=f"{(conf.confirmation_type or 'labor').title()} confirmed", uom="H",
            )
    await db.flush()
    return conf


async def reverse_confirmation(
    db: AsyncSession, vendor_id: UUID, conf: CoActivityConfirmation, actor_id: Optional[UUID], reason: str = ""
) -> bool:
    """Undo a confirmation. Returns True when the row was deleted, False when kept as ``reversed``."""
    if conf.status == "reversed":
        raise StateError("Confirmation is already reversed")
    order = await load_order_for_settlement(db, vendor_id, conf.order_id)
    if not order:
        raise ValueError("Order not found")
    await assert_order_accepts_actuals(db, order)
    await _undo_confirmation_effects(db, order, conf)
    if conf.journal_entry_id:
        await reverse_journal(db, vendor_id, conf.journal_entry_id, actor_id)
        conf.status = "reversed"
        conf.extra = {**(conf.extra or {}), "reversal_reason": reason}
        await db.flush()
        return False
    await db.delete(conf)
    await db.flush()
    return True
