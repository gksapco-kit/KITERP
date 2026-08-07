"""project_costing.py – Bridge between PM projects and the Controlling (CO) engine.

Enables planning, actuals tracking, and GL settlement on a pm_project by:
  1. Creating a FinProject (WBS GL dimension)
  2. Creating a CoManufacturingOrder of kind='project' linked to that FinProject
  3. Seeding CoOrderCostLine rows from the project's catalog items (once)
  4. Keeping the CO order's title / dates / status in sync with the PM project

Budget hard-stops on postings live in ``controlling.budget_control``.
"""
from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.controlling import CoManufacturingOrder, CoOrderCostLine
from app.models.finance import FinCompany, FinProject
from app.models.project import Project


# ── PM status → CO order status mapping ──────────────────────────────────────

_STATUS_MAP = {
    "planning": "draft",
    "active": "released",
    "on_hold": "in_progress",
    "completed": "completed",
    "cancelled": "cancelled",
}


async def _get_project(db: AsyncSession, vendor_id: UUID, project_id: UUID) -> Project:
    r = await db.execute(
        select(Project).where(Project.id == project_id, Project.vendor_id == vendor_id)
    )
    p = r.scalar_one_or_none()
    if not p:
        raise ValueError("Project not found")
    return p


async def _get_company(db: AsyncSession, vendor_id: UUID, company_id: UUID) -> FinCompany:
    r = await db.execute(
        select(FinCompany).where(FinCompany.id == company_id, FinCompany.vendor_id == vendor_id)
    )
    c = r.scalar_one_or_none()
    if not c:
        raise ValueError("Company not found or does not belong to this vendor")
    return c


async def _resolve_item_uom(
    db: AsyncSession,
    item: dict,
) -> str:
    """Resolve UOM from product variant (preferred) or product master."""
    from app.models.vendor_product import Product, ProductVariant

    variant_id = item.get("variant_id")
    product_id = item.get("id")
    if variant_id:
        try:
            vid = UUID(str(variant_id))
        except (TypeError, ValueError):
            vid = None
        if vid:
            r = await db.execute(select(ProductVariant).where(ProductVariant.id == vid))
            var = r.scalar_one_or_none()
            if var and var.uom:
                return str(var.uom).strip() or "piece"
    if product_id:
        try:
            pid = UUID(str(product_id))
        except (TypeError, ValueError):
            return "piece"
        r = await db.execute(select(Product).where(Product.id == pid))
        prod = r.scalar_one_or_none()
        if prod and prod.uom:
            return str(prod.uom).strip() or "piece"
    return "piece"


async def _seed_cost_lines(
    db: AsyncSession, project: Project, order_id: UUID
) -> list[CoOrderCostLine]:
    """Build CoOrderCostLine rows from project catalog items (one-time seed)."""
    lines = []
    for i, item in enumerate(project.items or []):
        price = Decimal(str(item.get("price") or 0))
        product_id = None
        if item.get("item_type") == "product" and item.get("id"):
            try:
                product_id = UUID(str(item["id"]))
            except (TypeError, ValueError):
                product_id = None
        uom = await _resolve_item_uom(db, item)
        lines.append(
            CoOrderCostLine(
                id=uuid.uuid4(),
                order_id=order_id,
                category="material" if item.get("item_type") == "product" else "other",
                description=item.get("name", ""),
                product_id=product_id,
                uom=uom,
                qty_planned=Decimal("1"),
                qty_actual=Decimal("0"),
                rate_planned=price,
                rate_actual=Decimal("0"),
                amount_planned=price,
                amount_actual=Decimal("0"),
                sequence=i * 10,
            )
        )
    return lines


async def enable_costing(
    db: AsyncSession,
    vendor_id: UUID,
    project_id: UUID,
    company_id: UUID,
) -> Project:
    """
    Link a pm_project to the CO engine.
    Idempotent: calling again on an already-enabled project is a no-op.
    """
    project = await _get_project(db, vendor_id, project_id)
    if project.co_order_id:
        return project  # already enabled

    company = await _get_company(db, vendor_id, company_id)

    # 1. Create FinProject (WBS dimension) using project_number as code.
    fin_proj = FinProject(
        id=uuid.uuid4(),
        vendor_id=vendor_id,
        company_id=company.id,
        code=project.project_number,
        name=project.name,
        description=project.description,
        start_date=project.start_date,
        end_date=project.end_date or project.due_date,
        budget=project.budget or Decimal("0"),
        status="active",
    )
    db.add(fin_proj)
    await db.flush()

    # 2. Create CoManufacturingOrder of kind='project'.
    co_status = _STATUS_MAP.get(project.status or "planning", "draft")
    order = CoManufacturingOrder(
        id=uuid.uuid4(),
        vendor_id=vendor_id,
        company_id=company.id,
        order_no=project.project_number,
        title=project.name,
        order_kind="project",
        status=co_status,
        priority=project.priority or "medium",
        project_id=fin_proj.id,
        ref_doc_type="pm_project",
        ref_doc_id=project.id,
        scheduled_start=project.start_date,
        scheduled_end=project.end_date or project.due_date,
        notes=project.description,
        extra={"pm_project_id": str(project.id)},
    )
    db.add(order)
    await db.flush()

    # 3. Seed planned cost lines from catalog items.
    for line in await _seed_cost_lines(db, project, order.id):
        db.add(line)

    # 4. Write bridge ids back to pm_project.
    project.company_id = company.id
    project.fin_project_id = fin_proj.id
    project.co_order_id = order.id

    await db.commit()
    await db.refresh(project)
    return project


async def sync_co_order(
    db: AsyncSession,
    vendor_id: UUID,
    project_id: UUID,
) -> None:
    """
    Push name / status / dates from pm_project → CoManufacturingOrder and FinProject.
    Called automatically after a project update when co_order_id is set.
    """
    project = await _get_project(db, vendor_id, project_id)
    if not project.co_order_id:
        return

    r = await db.execute(
        select(CoManufacturingOrder).where(CoManufacturingOrder.id == project.co_order_id)
    )
    order: Optional[CoManufacturingOrder] = r.scalar_one_or_none()
    if order:
        order.title = project.name
        order.status = _STATUS_MAP.get(project.status or "planning", order.status)
        order.priority = project.priority or order.priority
        order.scheduled_start = project.start_date or order.scheduled_start
        order.scheduled_end = project.end_date or project.due_date or order.scheduled_end
        order.notes = project.description or order.notes

    # Keep the GL WBS dimension in sync too.
    if project.fin_project_id:
        rp = await db.execute(
            select(FinProject).where(FinProject.id == project.fin_project_id)
        )
        fin_proj: Optional[FinProject] = rp.scalar_one_or_none()
        if fin_proj:
            fin_proj.name = project.name
            fin_proj.description = project.description or fin_proj.description
            fin_proj.start_date = project.start_date or fin_proj.start_date
            fin_proj.end_date = project.end_date or project.due_date or fin_proj.end_date
            if project.budget is not None:
                fin_proj.budget = project.budget

    await db.commit()


async def resync_cost_lines(
    db: AsyncSession,
    project: "Project",  # type: ignore[name-defined]
) -> None:
    """
    Reconcile CoOrderCostLine rows with the current project.items list.

    - Adds lines for items that have no corresponding cost line.
    - Never deletes lines that already have amount_actual > 0 (posted actuals).
    - Lines for removed items with amount_actual == 0 are deleted.
    """
    if not project.co_order_id:
        return

    existing_rows = (
        await db.execute(
            select(CoOrderCostLine).where(CoOrderCostLine.order_id == project.co_order_id)
        )
    ).scalars().all()

    # Build a lookup of existing lines by item name + category to avoid
    # duplicating lines that were already seeded.
    existing_by_key: dict[tuple[str, str], CoOrderCostLine] = {}
    for line in existing_rows:
        key = (line.description or "", line.category or "other")
        existing_by_key[key] = line

    current_items = project.items or []
    current_keys: set[tuple[str, str]] = set()
    max_seq = max((ln.sequence or 0 for ln in existing_rows), default=-10) + 10

    for i, item in enumerate(current_items):
        category = "material" if item.get("item_type") == "product" else "other"
        key = (item.get("name", ""), category)
        current_keys.add(key)
        if key not in existing_by_key:
            price = Decimal(str(item.get("price") or 0))
            product_id = None
            if category == "material" and item.get("id"):
                try:
                    product_id = UUID(str(item["id"]))
                except (TypeError, ValueError):
                    pass
            uom = await _resolve_item_uom(db, item)
            new_line = CoOrderCostLine(
                id=uuid.uuid4(),
                order_id=project.co_order_id,
                category=category,
                description=item.get("name", ""),
                product_id=product_id,
                uom=uom,
                qty_planned=Decimal("1"),
                qty_actual=Decimal("0"),
                rate_planned=price,
                rate_actual=Decimal("0"),
                amount_planned=price,
                amount_actual=Decimal("0"),
                sequence=max_seq + i * 10,
            )
            db.add(new_line)

    # Remove lines whose item was removed, but only if nothing was ever posted.
    for key, line in existing_by_key.items():
        if key not in current_keys and (line.amount_actual or Decimal("0")) == Decimal("0"):
            await db.delete(line)


async def get_costing_status(
    db: AsyncSession,
    vendor_id: UUID,
    project_id: UUID,
) -> dict:
    """Return costing metadata for the project detail view."""
    project = await _get_project(db, vendor_id, project_id)
    if not project.co_order_id:
        return {
            "project_id": str(project.id),
            "company_id": None,
            "fin_project_id": None,
            "co_order_id": None,
            "costing_enabled": False,
            "settlement_status": None,
            "order_no": None,
        }

    r = await db.execute(
        select(CoManufacturingOrder).where(CoManufacturingOrder.id == project.co_order_id)
    )
    order: Optional[CoManufacturingOrder] = r.scalar_one_or_none()
    return {
        "project_id": str(project.id),
        "company_id": str(project.company_id) if project.company_id else None,
        "fin_project_id": str(project.fin_project_id) if project.fin_project_id else None,
        "co_order_id": str(project.co_order_id),
        "costing_enabled": True,
        "settlement_status": order.settlement_status if order else None,
        "order_no": order.order_no if order else None,
    }
