"""General-ledger posting and Controlling bridge for completed Production Orders.

Relationship between Production and Controlling
-----------------------------------------------
* The Production module is the system of record for *execution*: orders,
  routings, stock movements and the actual cost of a completed order.
* Controlling (``co_*``) is the system of record for *cost accounting* reports
  (WIP, variances, COGS settlement). When a production order is completed, a
  linked Controlling order (``ref_doc_type='production_order'``) is created with
  the actual cost lines and a ``production_completion`` booking. Controlling then
  settles COGS from it exactly as for any other order, and cannot post the
  completion a second time (``production_completion_journal_id`` is set).
* Re-opening the order removes the linked Controlling order and reverses the
  journal, unless COGS has already been settled against it.

Journal on completion (one balanced entry per order, idempotent by source id):

    Dr Finished goods              total actual cost
        Cr Raw materials           material cost issued
        Cr Work in process         conversion (labor) cost absorbed

When no finance company / GL mapping is configured the stock side still posts
and the result is recorded as ``skipped`` (with the reason) on the order so it
can be fixed and re-posted; a closed period or unbalanced entry fails the
completion instead.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.controlling import CoCostBooking, CoManufacturingOrder, CoOrderCostLine
from app.models.finance import FinJournalEntry
from app.models.production import ProductionOrder
from app.services.controlling.settlement import get_gl_mapping
from app.services.finance.posting import _resolve_default_company, _supersede_entry, post_event
from app.services.production_valuation import dec

SOURCE_TYPE = "co_cost_booking"
_NS = uuid.UUID("6f1c3a2e-5d7b-4c1a-9e0f-2b8d4a6c8e10")


def event_id(order_id: UUID) -> uuid.UUID:
    """Stable id of the completion event — doubles as the Controlling booking id."""
    return uuid.uuid5(_NS, f"production-completion:{order_id}")


def _skipped(reason: str) -> dict[str, Any]:
    return {"status": "skipped", "reason": reason}


async def _live_journal(db: AsyncSession, vendor_id: UUID, source_id: UUID) -> Optional[FinJournalEntry]:
    return (
        await db.execute(
            select(FinJournalEntry).where(
                FinJournalEntry.vendor_id == vendor_id,
                FinJournalEntry.source_type == SOURCE_TYPE,
                FinJournalEntry.source_id == source_id,
                FinJournalEntry.status == "posted",
                FinJournalEntry.reverses_id.is_(None),
                FinJournalEntry.reversed_by_id.is_(None),
            )
        )
    ).scalars().first()


async def _find_mirror(db: AsyncSession, vendor_id: UUID, order_id: UUID) -> Optional[CoManufacturingOrder]:
    return (
        await db.execute(
            select(CoManufacturingOrder).where(
                CoManufacturingOrder.vendor_id == vendor_id,
                CoManufacturingOrder.ref_doc_type == "production_order",
                CoManufacturingOrder.ref_doc_id == order_id,
            )
        )
    ).scalars().first()


async def _unique_order_no(db: AsyncSession, vendor_id: UUID, ref: str) -> str:
    candidate = ref
    n = 1
    while (
        await db.execute(
            select(CoManufacturingOrder.id).where(
                CoManufacturingOrder.vendor_id == vendor_id, CoManufacturingOrder.order_no == candidate
            )
        )
    ).first():
        n += 1
        candidate = f"{ref}-{n}"
    return candidate[:40]


async def _create_mirror(
    db: AsyncSession,
    vendor_id: UUID,
    company_id: UUID,
    order: ProductionOrder,
    posting: dict[str, Any],
) -> CoManufacturingOrder:
    costing = posting.get("costing") or {}
    goods = [g for g in (posting.get("goods") or []) if not g.get("byproduct")]
    total_qty = sum(int(g.get("qty") or 0) for g in goods)
    first_product = None
    if goods:
        try:
            first_product = UUID(str(goods[0]["product_id"]))
        except (KeyError, ValueError, TypeError):
            first_product = None

    snapshot = {str(c.get("component_id")): c for c in (order.material_requirements or [])}
    co = CoManufacturingOrder(
        id=uuid.uuid4(),
        vendor_id=vendor_id,
        company_id=company_id,
        order_no=await _unique_order_no(db, vendor_id, order.ref),
        title=f"Production order {order.ref}",
        order_kind="assembly",
        status="completed",
        priority=order.priority if order.priority in ("low", "medium", "high", "urgent") else "medium",
        product_id=first_product,
        qty_planned=Decimal(total_qty),
        qty_delivered=Decimal("0"),  # COGS is settled later, as stock is delivered
        ref_doc_type="production_order",
        ref_doc_id=order.id,
        scheduled_end=order.target_date,
        completed_at=datetime.now(timezone.utc),
        notes=f"Created from production order {order.ref}",
        extra={"source": "production_order", "production_order_id": str(order.id)},
        settlement_status="none",
    )
    db.add(co)
    await db.flush()

    seq = 0
    for comp in posting.get("components") or []:
        snap = snapshot.get(str(comp.get("component_id")), {})
        qty = dec(comp.get("qty"))
        planned_qty = dec(snap.get("required_qty") if snap.get("required_qty") is not None else qty)
        planned_rate = dec(snap.get("cost_price"))
        actual_rate = dec(comp.get("unit_cost"))
        db.add(CoOrderCostLine(
            id=uuid.uuid4(), order_id=co.id, category="material", description=comp.get("name"),
            product_id=_uuid(comp.get("component_id")), uom="EA", sequence=seq,
            qty_planned=planned_qty, qty_actual=qty, rate_planned=planned_rate, rate_actual=actual_rate,
            amount_planned=(planned_qty * planned_rate).quantize(Decimal("0.0001")),
            amount_actual=dec(comp.get("amount")),
        ))
        seq += 1

    labor = dec(costing.get("labor"))
    planned_labor = dec(order.planned_labor_cost)
    if labor > 0 or planned_labor > 0:
        db.add(CoOrderCostLine(
            id=uuid.uuid4(), order_id=co.id, category="activity", description="Labor / work-centre time",
            uom="EA", sequence=seq,
            qty_planned=Decimal("1"), qty_actual=Decimal("1"),
            rate_planned=planned_labor, rate_actual=labor,
            amount_planned=planned_labor, amount_actual=labor,
        ))
    await db.flush()
    return co


def _uuid(v: Any) -> Optional[UUID]:
    try:
        return UUID(str(v)) if v else None
    except (ValueError, TypeError):
        return None


async def post_completion_accounting(
    db: AsyncSession,
    vendor_id: UUID,
    order: ProductionOrder,
    posting: dict[str, Any],
    actor_id: Optional[UUID] = None,
) -> dict[str, Any]:
    """Post the completion journal and create/refresh the Controlling order.

    Returns the accounting result stored on the posting snapshot."""
    costing = posting.get("costing") or {}
    material = dec(costing.get("material"))
    labor = dec(costing.get("labor"))
    total = material + labor
    if total <= 0:
        return _skipped("The order has no cost to post (no component costs or labor).")

    company_id = await _resolve_default_company(db, vendor_id)
    if not company_id:
        return _skipped("No default finance company is configured.")

    mapping = await get_gl_mapping(db, vendor_id, company_id)
    if not mapping or not mapping.finished_goods_account_id:
        return _skipped("Configure the finished goods account in the Controlling GL mapping.")
    if material > 0 and not mapping.raw_material_account_id:
        return _skipped("Configure the raw material account in the Controlling GL mapping.")
    if labor > 0 and not mapping.wip_account_id:
        return _skipped("Configure the work-in-process account in the Controlling GL mapping.")

    today = date.today()
    sid = event_id(order.id)
    lines = [{
        "account_id": str(mapping.finished_goods_account_id),
        "debit": str(total), "credit": "0",
        "narration": f"Finished goods from production order {order.ref}",
    }]
    if material > 0:
        lines.append({
            "account_id": str(mapping.raw_material_account_id),
            "debit": "0", "credit": str(material),
            "narration": f"Materials issued to production order {order.ref}",
        })
    if labor > 0:
        lines.append({
            "account_id": str(mapping.wip_account_id),
            "debit": "0", "credit": str(labor),
            "narration": f"Conversion cost absorbed by production order {order.ref}",
        })
    payload = {
        "company_id": company_id,
        "entry_date": today.isoformat(),
        "document_type": "CO",
        "narration": f"Production completion — {order.ref}",
        "reference": order.ref,
        "ref_doc_type": "production_order",
        "ref_doc_id": str(order.id),
        "lines": lines,
    }
    je = await post_event(db, vendor_id, SOURCE_TYPE, sid, payload, created_by_id=actor_id)
    if je is None:
        raise ValueError("Journal posting failed — check the GL accounts in the Controlling GL mapping.")

    # Controlling bridge: linked order + the completion booking pointing at the same journal.
    co = await _find_mirror(db, vendor_id, order.id)
    if co is None:
        co = await _create_mirror(db, vendor_id, company_id, order, posting)
    total_qty = sum(int(g.get("qty") or 0) for g in posting.get("goods") or [] if not g.get("byproduct"))
    db.add(CoCostBooking(
        id=sid, vendor_id=vendor_id, company_id=company_id, order_id=co.id,
        booking_type="production_completion", amount=total,
        qty_basis=Decimal(total_qty) if total_qty else None,
        unit_cost=(total / total_qty).quantize(Decimal("0.000001")) if total_qty else None,
        journal_entry_id=je.id, entry_date=today,
        narration=f"Production completion — {order.ref}",
        extra={"source": "production_order", "production_order_id": str(order.id)},
    ))
    co.production_completion_journal_id = je.id
    co.settlement_status = "production_posted"
    await db.flush()

    return {
        "status": "posted",
        "journal_entry_id": str(je.id),
        "entry_no": je.entry_no,
        "company_id": str(company_id),
        "controlling_order_id": str(co.id),
        "amount": str(total),
    }


async def reverse_completion_accounting(
    db: AsyncSession,
    vendor_id: UUID,
    order: ProductionOrder,
    actor_id: Optional[UUID] = None,
) -> None:
    """Undo the completion journal and remove the linked Controlling order.

    Raises ValueError when COGS (or other Controlling postings) were already
    settled against the order, because re-opening would corrupt those entries."""
    co = await _find_mirror(db, vendor_id, order.id)
    if co is not None:
        extra_bookings = (
            await db.execute(
                select(CoCostBooking.id).where(
                    CoCostBooking.order_id == co.id, CoCostBooking.booking_type != "production_completion"
                )
            )
        ).first()
        if co.cogs_issue_journal_id or extra_bookings or (co.settlement_status or "none").startswith("cogs"):
            raise ValueError(
                "Cannot re-open: cost of goods sold has already been settled for this order in Controlling. "
                "Reverse that settlement first."
            )

    sid = event_id(order.id)
    je_ids: set[UUID] = {sid}
    if co is not None:
        # A completion booked from the Controlling screen has its own booking id as journal source.
        booking_ids = (
            await db.execute(select(CoCostBooking.id).where(CoCostBooking.order_id == co.id))
        ).scalars().all()
        je_ids.update(booking_ids)
    for source_id in je_ids:
        live = await _live_journal(db, vendor_id, source_id)
        if live is not None:
            await _supersede_entry(db, vendor_id, live, actor_id)

    if co is not None:
        await db.execute(delete(CoCostBooking).where(CoCostBooking.order_id == co.id))
        await db.execute(delete(CoOrderCostLine).where(CoOrderCostLine.order_id == co.id))
        await db.execute(delete(CoManufacturingOrder).where(CoManufacturingOrder.id == co.id))
        await db.flush()
