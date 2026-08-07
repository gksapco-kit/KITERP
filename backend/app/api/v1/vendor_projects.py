# app/api/v1/vendor_projects.py
from __future__ import annotations

import uuid as _uuid_mod
from datetime import date
from decimal import Decimal
from math import ceil
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, func

from app.api.deps import get_current_active_user, require_permission, require_any_permission
from app.database import get_db
from app.models.controlling import (
    CoManufacturingOrder,
    CoOrderCostLine,
    CoCostBooking,
    CoBudgetLine,
    CoGoodsMovement,
    CoActivityConfirmation,
)
from app.models.customer import Customer
from app.models.finance import FinAuditLog, FinVendorBill
from app.models.user import User
from app.models.vendor_user import VendorUser
from app.schemas.controlling import (
    BudgetLineCreate,
    BudgetLineOut,
    InternalOrderBudgetVsActualOut,
    ManufacturingOrderOut,
    OrderCostLineCreate,
    OrderVarianceOut,
    CoSettlementPostIn,
    GoodsMovementCreate,
    GoodsMovementOut,
    ActivityConfirmationCreate,
    ActivityConfirmationOut,
)
from app.schemas.project import (
    ProjectCostingBudgetLineCreate,
    ProjectCostingStatusResponse,
    ProjectCreate,
    ProjectEnableCostingRequest,
    ProjectListResponse,
    ProjectOverviewResponse,
    ProjectResponse,
    ProjectUpdate,
    TaskCreate,
    TaskReorderRequest,
    TaskResponse,
    TaskUpdate,
)
from app.services.project_costing import (
    enable_costing,
    get_costing_status,
    sync_co_order,
)
from app.models.project import Project as PMProject
from app.services.project_service import ProjectService
from app.services.controlling import settlement as co_settlement
from app.services.controlling.budget_control import (
    BudgetExceededError,
    assert_budget_allows,
)


def _budget_http(exc: BudgetExceededError) -> HTTPException:
    return HTTPException(status_code=409, detail=exc.availability.to_detail())

_MOVEMENT_LABELS = {
    "component_issue": "Goods Issue — Component to Order",
    "component_return": "Goods Issue Return — Component from Order",
    "fg_receipt": "Goods Receipt — FG from Order",
    "fg_receipt_reversal": "Goods Receipt Return — FG to Order",
}

router = APIRouter()


async def _audit(
    db: AsyncSession,
    vendor_id: UUID,
    entity_type: str,
    entity_id: UUID,
    action: str,
    performed_by_id: Optional[UUID],
    diff: Optional[dict] = None,
) -> None:
    """Write a FinAuditLog row (fire-and-forget — does not commit)."""
    log = FinAuditLog(
        id=_uuid_mod.uuid4(),
        vendor_id=vendor_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        performed_by_id=performed_by_id,
        diff_json=diff,
    )
    db.add(log)


async def _validate_customer(
    db: AsyncSession, vendor_id: UUID, customer_id: Optional[UUID],
) -> None:
    if not customer_id:
        return
    r = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.vendor_id == vendor_id)
    )
    if not r.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Invalid customer for this vendor")


@router.get("/overview", response_model=ProjectOverviewResponse)
async def project_overview(
    vu: VendorUser = Depends(require_permission("projects.view")),
    db: AsyncSession = Depends(get_db),
):
    return await ProjectService(db).overview(vu.vendor_id)


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    search: Optional[str] = None,
    store_id: Optional[str] = None,
    sales_area_id: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("projects.view")),
    db: AsyncSession = Depends(get_db),
):
    svc = ProjectService(db)
    items, total = await svc.list_projects(
        vu.vendor_id, page=page, size=size, status_filter=status, search=search,
        store_id=store_id, sales_area_id=sales_area_id,
    )
    return {
        "items": [ProjectResponse.model_validate(i) for i in items],
        "total": total,
        "page": page,
        "size": size,
        "pages": ceil(total / size) if total else 0,
    }


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate,
    current_user: User = Depends(get_current_active_user),
    vu: VendorUser = Depends(require_permission("projects.manage")),
    db: AsyncSession = Depends(get_db),
):
    await _validate_customer(db, vu.vendor_id, data.customer_id)
    result = await ProjectService(db).create_project(
        vu.vendor_id,
        data,
        default_owner_id=current_user.id,
        default_owner_name=current_user.full_name or current_user.email,
    )
    return ProjectResponse.model_validate(result)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    vu: VendorUser = Depends(require_permission("projects.view")),
    db: AsyncSession = Depends(get_db),
):
    result = await ProjectService(db).get_project(vu.vendor_id, project_id)
    return ProjectResponse.model_validate(result)


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    data: ProjectUpdate,
    vu: VendorUser = Depends(require_permission("projects.manage")),
    db: AsyncSession = Depends(get_db),
):
    if data.customer_id is not None:
        await _validate_customer(db, vu.vendor_id, data.customer_id)
    result = await ProjectService(db).update_project(vu.vendor_id, project_id, data)
    # Keep CO order in sync when costing is enabled
    await sync_co_order(db, vu.vendor_id, project_id)
    return ProjectResponse.model_validate(result)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    vu: VendorUser = Depends(require_permission("projects.manage")),
    db: AsyncSession = Depends(get_db),
):
    await ProjectService(db).delete_project(vu.vendor_id, project_id)
    return None


@router.get("/{project_id}/tasks", response_model=list[TaskResponse])
async def list_tasks(
    project_id: UUID,
    vu: VendorUser = Depends(require_permission("projects.view")),
    db: AsyncSession = Depends(get_db),
):
    items = await ProjectService(db).list_tasks(vu.vendor_id, project_id)
    return [TaskResponse.model_validate(i) for i in items]


@router.post("/{project_id}/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    project_id: UUID,
    data: TaskCreate,
    vu: VendorUser = Depends(require_permission("projects.manage")),
    db: AsyncSession = Depends(get_db),
):
    result = await ProjectService(db).create_task(vu.vendor_id, project_id, data)
    return TaskResponse.model_validate(result)


@router.put("/{project_id}/tasks/reorder", response_model=list[TaskResponse])
async def reorder_tasks(
    project_id: UUID,
    data: TaskReorderRequest,
    vu: VendorUser = Depends(require_permission("projects.manage")),
    db: AsyncSession = Depends(get_db),
):
    items = await ProjectService(db).reorder_tasks(
        vu.vendor_id, project_id, data.items,
    )
    return [TaskResponse.model_validate(i) for i in items]


@router.put("/{project_id}/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    project_id: UUID,
    task_id: UUID,
    data: TaskUpdate,
    vu: VendorUser = Depends(require_permission("projects.manage")),
    db: AsyncSession = Depends(get_db),
):
    result = await ProjectService(db).update_task(
        vu.vendor_id, project_id, task_id, data,
    )
    return TaskResponse.model_validate(result)


@router.delete("/{project_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    project_id: UUID,
    task_id: UUID,
    vu: VendorUser = Depends(require_permission("projects.manage")),
    db: AsyncSession = Depends(get_db),
):
    await ProjectService(db).delete_task(vu.vendor_id, project_id, task_id)
    return None


# ── Costing proxy endpoints ──────────────────────────────────────────────────
# All reads use projects.view; plan edits use projects.manage;
# settlement posting (GL impact) requires finance.edit.

async def _require_co_order(
    db: AsyncSession, vendor_id: UUID, project_id: UUID
) -> CoManufacturingOrder:
    """Return the CO order for a project, or raise 409 if costing not enabled."""
    proj_r = await db.execute(
        select(PMProject).where(PMProject.id == project_id, PMProject.vendor_id == vendor_id)
    )
    project = proj_r.scalar_one_or_none()
    if not project or not project.co_order_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Costing not enabled for this project. Call POST /costing/enable first.",
        )
    r = await db.execute(
        select(CoManufacturingOrder)
        .where(CoManufacturingOrder.id == project.co_order_id)
        .options(
            selectinload(CoManufacturingOrder.cost_lines),
            selectinload(CoManufacturingOrder.cost_bookings),
        )
    )
    order = r.scalar_one_or_none()
    if not order:
        raise HTTPException(409, "CO order record missing — re-enable costing.")
    return order


@router.get("/{project_id}/costing/status", response_model=ProjectCostingStatusResponse)
async def get_project_costing_status(
    project_id: UUID,
    vu: VendorUser = Depends(require_permission("projects.view")),
    db: AsyncSession = Depends(get_db),
):
    result = await get_costing_status(db, vu.vendor_id, project_id)
    return result


@router.post("/{project_id}/costing/enable", response_model=ProjectCostingStatusResponse)
async def enable_project_costing(
    project_id: UUID,
    body: ProjectEnableCostingRequest,
    vu: VendorUser = Depends(require_permission("projects.manage")),
    db: AsyncSession = Depends(get_db),
):
    try:
        await enable_costing(db, vu.vendor_id, project_id, body.company_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await _audit(db, vu.vendor_id, "pm_project", project_id, "post",
                 vu.id, {"event": "costing_enabled", "company_id": str(body.company_id)})
    return await get_costing_status(db, vu.vendor_id, project_id)


# ── Budget lines (plan) ──────────────────────────────────────────────────────

@router.get("/{project_id}/costing/budget-lines", response_model=List[BudgetLineOut])
async def list_project_budget_lines(
    project_id: UUID,
    vu: VendorUser = Depends(require_permission("projects.view")),
    db: AsyncSession = Depends(get_db),
):
    order = await _require_co_order(db, vu.vendor_id, project_id)
    r = await db.execute(
        select(CoBudgetLine).where(CoBudgetLine.order_id == order.id).order_by(CoBudgetLine.created_at)
    )
    return [BudgetLineOut.model_validate(bl) for bl in r.scalars().all()]


@router.post("/{project_id}/costing/budget-lines", response_model=BudgetLineOut, status_code=201)
async def create_project_budget_line(
    project_id: UUID,
    body: ProjectCostingBudgetLineCreate,
    vu: VendorUser = Depends(require_permission("projects.manage")),
    db: AsyncSession = Depends(get_db),
):
    proj_r = await db.execute(
        select(PMProject).where(PMProject.id == project_id, PMProject.vendor_id == vu.vendor_id)
    )
    project = proj_r.scalar_one_or_none()
    if not project or not project.co_order_id:
        raise HTTPException(409, "Costing not enabled for this project.")
    bl = CoBudgetLine(
        id=_uuid_mod.uuid4(),
        vendor_id=vu.vendor_id,
        company_id=project.company_id,
        order_id=project.co_order_id,
        budget_type=body.budget_type,
        category=body.category,
        description=body.description,
        fiscal_year=body.fiscal_year,
        period_month=body.period_month,
        amount_budgeted=body.amount_budgeted,
        currency="INR",
    )
    db.add(bl)
    await _audit(db, vu.vendor_id, "co_budget_line", bl.id, "create", vu.id,
                 {"project_id": str(project_id), "category": body.category,
                  "amount_budgeted": str(body.amount_budgeted)})
    await db.commit()
    await db.refresh(bl)
    return BudgetLineOut.model_validate(bl)


@router.delete("/{project_id}/costing/budget-lines/{bl_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_budget_line(
    project_id: UUID,
    bl_id: UUID,
    vu: VendorUser = Depends(require_permission("projects.manage")),
    db: AsyncSession = Depends(get_db),
):
    order = await _require_co_order(db, vu.vendor_id, project_id)
    r = await db.execute(
        select(CoBudgetLine).where(CoBudgetLine.id == bl_id, CoBudgetLine.order_id == order.id)
    )
    bl = r.scalar_one_or_none()
    if not bl:
        raise HTTPException(404, "Budget line not found")
    await _audit(db, vu.vendor_id, "co_budget_line", bl_id, "delete", vu.id,
                 {"project_id": str(project_id), "category": bl.category,
                  "amount_budgeted": str(bl.amount_budgeted)})
    await db.delete(bl)
    await db.commit()
    return None


# ── Budget vs actual summary ─────────────────────────────────────────────────

@router.get("/{project_id}/costing/budget-vs-actual")
async def get_project_budget_vs_actual(
    project_id: UUID,
    vu: VendorUser = Depends(require_permission("projects.view")),
    db: AsyncSession = Depends(get_db),
) -> Any:
    from decimal import Decimal as D
    order = await _require_co_order(db, vu.vendor_id, project_id)
    bl_r = await db.execute(
        select(CoBudgetLine).where(CoBudgetLine.order_id == order.id, CoBudgetLine.vendor_id == vu.vendor_id)
    )
    budget_lines = bl_r.scalars().all()
    total_budgeted = sum(D(str(b.amount_budgeted or 0)) for b in budget_lines)
    total_planned = total_actual = D("0")
    for ln in order.cost_lines:
        total_planned += D(str(ln.amount_planned or 0))
        total_actual += D(str(ln.amount_actual or 0))
    return {
        "order_id": str(order.id),
        "order_no": order.order_no,
        "title": order.title,
        "order_kind": order.order_kind,
        "total_budgeted": str(total_budgeted),
        "total_planned": str(total_planned),
        "total_actual": str(total_actual),
        "total_variance": str(total_planned - total_actual),
        "budget_lines": [BudgetLineOut.model_validate(bl) for bl in budget_lines],
    }


# ── Cost lines (plan & actual per item) ──────────────────────────────────────

@router.get("/{project_id}/costing/cost-lines")
async def list_project_cost_lines(
    project_id: UUID,
    vu: VendorUser = Depends(require_permission("projects.view")),
    db: AsyncSession = Depends(get_db),
) -> Any:
    from app.schemas.controlling import OrderCostLineOut
    order = await _require_co_order(db, vu.vendor_id, project_id)
    return [OrderCostLineOut.model_validate(cl) for cl in order.cost_lines]


@router.post("/{project_id}/costing/cost-lines", status_code=201)
async def add_project_cost_line(
    project_id: UUID,
    body: OrderCostLineCreate,
    vu: VendorUser = Depends(require_permission("projects.manage")),
    db: AsyncSession = Depends(get_db),
) -> Any:
    from app.schemas.controlling import OrderCostLineOut
    order = await _require_co_order(db, vu.vendor_id, project_id)
    cl = CoOrderCostLine(
        id=_uuid_mod.uuid4(),
        order_id=order.id,
        **body.model_dump(),
    )
    db.add(cl)
    await _audit(db, vu.vendor_id, "co_order_cost_line", cl.id, "create", vu.id,
                 {"project_id": str(project_id), "category": body.category,
                  "amount_planned": str(body.amount_planned)})
    await db.commit()
    await db.refresh(cl)
    return OrderCostLineOut.model_validate(cl)


@router.patch("/{project_id}/costing/cost-lines/{line_id}", status_code=200)
async def patch_project_cost_line(
    project_id: UUID,
    line_id: UUID,
    body: dict = Body(...),
    vu: VendorUser = Depends(require_permission("projects.manage")),
    db: AsyncSession = Depends(get_db),
) -> Any:
    from app.schemas.controlling import OrderCostLineOut
    order = await _require_co_order(db, vu.vendor_id, project_id)
    r = await db.execute(
        select(CoOrderCostLine).where(CoOrderCostLine.id == line_id, CoOrderCostLine.order_id == order.id)
    )
    cl = r.scalar_one_or_none()
    if not cl:
        raise HTTPException(404, "Cost line not found")
    allowed = {"description", "category", "qty_planned", "qty_actual", "rate_planned", "rate_actual", "amount_planned", "amount_actual", "uom"}
    before = {k: str(getattr(cl, k, None)) for k in allowed if k in body}
    for k, v in body.items():
        if k in allowed:
            setattr(cl, k, v)
    after = {k: str(body[k]) for k in allowed if k in body}
    await _audit(db, vu.vendor_id, "co_order_cost_line", line_id, "update", vu.id,
                 {"project_id": str(project_id), "before": before, "after": after})
    await db.commit()
    await db.refresh(cl)
    return OrderCostLineOut.model_validate(cl)


# ── Variance ─────────────────────────────────────────────────────────────────

@router.get("/{project_id}/costing/variance")
async def get_project_variance(
    project_id: UUID,
    vu: VendorUser = Depends(require_permission("projects.view")),
    db: AsyncSession = Depends(get_db),
) -> Any:
    from decimal import Decimal as D
    order = await _require_co_order(db, vu.vendor_id, project_id)
    by_cat: dict[str, dict[str, D]] = {}
    planned_total = actual_total = D("0")
    for ln in order.cost_lines:
        cat = ln.category or "other"
        if cat not in by_cat:
            by_cat[cat] = {"planned": D("0"), "actual": D("0")}
        ap = D(str(ln.amount_planned or 0))
        aa = D(str(ln.amount_actual or 0))
        by_cat[cat]["planned"] += ap
        by_cat[cat]["actual"] += aa
        planned_total += ap
        actual_total += aa
    return {
        "order_id": str(order.id),
        "order_no": order.order_no,
        "planned_total": str(planned_total),
        "actual_total": str(actual_total),
        "total_variance": str(planned_total - actual_total),
        "by_category": {c: {k: str(v) for k, v in vals.items()} for c, vals in by_cat.items()},
        "settlement_status": order.settlement_status or "none",
    }


# ── Settlement (GL posting) – requires finance.edit ──────────────────────────

def _settle_err(exc: ValueError) -> HTTPException:
    msg = str(exc)
    if "GL mapping" in msg or "account" in msg.lower():
        return HTTPException(422, f"GL mapping incomplete: {msg}")
    return HTTPException(400, msg)


@router.post("/{project_id}/costing/post-completion")
async def post_project_completion(
    project_id: UUID,
    payload: CoSettlementPostIn | None = Body(None),
    vu: VendorUser = Depends(require_any_permission("finance.edit", "projects.costing.post")),
    db: AsyncSession = Depends(get_db),
) -> Any:
    order = await _require_co_order(db, vu.vendor_id, project_id)
    p = payload or CoSettlementPostIn()
    try:
        await co_settlement.post_production_completion(db, vu.vendor_id, order.id, vu.id, p.entry_date)
    except ValueError as e:
        raise _settle_err(e) from e
    await _audit(db, vu.vendor_id, "co_manufacturing_order", order.id, "post", vu.id,
                 {"event": "production_completion", "project_id": str(project_id),
                  "entry_date": str(p.entry_date or date.today())})
    await db.commit()
    return {"detail": "Production completion posted"}


@router.post("/{project_id}/costing/post-settlement")
async def post_project_settlement(
    project_id: UUID,
    payload: CoSettlementPostIn | None = Body(None),
    vu: VendorUser = Depends(require_any_permission("finance.edit", "projects.costing.post")),
    db: AsyncSession = Depends(get_db),
) -> Any:
    order = await _require_co_order(db, vu.vendor_id, project_id)
    p = payload or CoSettlementPostIn()
    try:
        await co_settlement.post_cogs_issue(db, vu.vendor_id, order.id, vu.id, p.entry_date)
    except ValueError as e:
        raise _settle_err(e) from e
    await _audit(db, vu.vendor_id, "co_manufacturing_order", order.id, "post", vu.id,
                 {"event": "cogs_settlement", "project_id": str(project_id),
                  "entry_date": str(p.entry_date or date.today())})
    await db.commit()
    return {"detail": "Settlement posted"}


# ── Document-driven actual proxy endpoints ────────────────────────────────────
# Goods movements (material issues) and activity confirmations (labour/time)
# are the source-of-truth for actuals.  These endpoints scope existing CO
# controlling documents to a specific project order.

@router.get("/{project_id}/costing/goods-movements", response_model=List[GoodsMovementOut])
async def list_project_goods_movements(
    project_id: UUID,
    movement_type: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    vu: VendorUser = Depends(require_permission("projects.view")),
    db: AsyncSession = Depends(get_db),
):
    order = await _require_co_order(db, vu.vendor_id, project_id)
    q = select(CoGoodsMovement).where(CoGoodsMovement.order_id == order.id)
    if movement_type:
        q = q.where(CoGoodsMovement.movement_type == movement_type)
    if from_date:
        q = q.where(CoGoodsMovement.posting_date >= from_date)
    if to_date:
        q = q.where(CoGoodsMovement.posting_date <= to_date)
    q = q.order_by(CoGoodsMovement.posting_date.desc())
    rows = (await db.execute(q)).scalars().all()
    return [GoodsMovementOut.model_validate(r) for r in rows]


@router.post("/{project_id}/costing/goods-movements", response_model=GoodsMovementOut, status_code=201)
async def post_project_goods_movement(
    project_id: UUID,
    body: GoodsMovementCreate,
    vu: VendorUser = Depends(require_any_permission("finance.edit", "projects.costing.post")),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Post a material goods issue / receipt against this project's CO order."""
    order = await _require_co_order(db, vu.vendor_id, project_id)
    if body.movement_type not in _MOVEMENT_LABELS:
        raise HTTPException(422, f"Invalid movement_type. Use: {list(_MOVEMENT_LABELS)}")
    if body.order_id != order.id:
        raise HTTPException(422, "order_id in body must match this project's CO order.")
    if body.movement_type in ("component_issue", "component_return") and not body.product_id:
        raise HTTPException(422, "product_id is required for material issue / return.")

    qty = Decimal(str(body.qty))
    uc = Decimal(str(body.unit_cost))
    total = (qty * uc).quantize(Decimal("0.0001"))
    if qty <= 0:
        raise HTTPException(422, "qty must be greater than zero.")

    # Hard-stop when material budget lines exist and this issue would overspend.
    if body.movement_type == "component_issue" and total > 0:
        try:
            await assert_budget_allows(db, order.id, "material", total)
        except BudgetExceededError as exc:
            raise _budget_http(exc) from exc

    # UOM always comes from product master when a product is selected
    resolved_uom = body.uom or "piece"
    material_label: Optional[str] = None
    if body.product_id:
        from app.models.vendor_product import Product
        prod_r = await db.execute(select(Product).where(Product.id == body.product_id))
        prod = prod_r.scalar_one_or_none()
        if not prod:
            raise HTTPException(422, "product_id not found")
        if prod.uom:
            resolved_uom = str(prod.uom).strip() or "piece"
        # Prefer short material code for audit / display (MAT-00001), then SKU, then name
        material_label = (
            (str(prod.material_code).strip() if prod.material_code else None)
            or (str(prod.sku).strip() if prod.sku else None)
            or (str(prod.name).strip() if prod.name else None)
        )

    count_r = await db.execute(
        select(func.count()).select_from(CoGoodsMovement).where(CoGoodsMovement.vendor_id == vu.vendor_id)
    )
    doc_no = f"GM{(count_r.scalar() or 0) + 1:06d}"

    gm = CoGoodsMovement(
        id=_uuid_mod.uuid4(),
        vendor_id=vu.vendor_id,
        company_id=body.company_id,
        order_id=order.id,
        movement_type=body.movement_type,
        posting_date=body.posting_date,
        document_no=doc_no,
        product_id=body.product_id,
        description=body.description or _MOVEMENT_LABELS[body.movement_type],
        uom=resolved_uom,
        qty=qty,
        unit_cost=uc,
        total_cost=total,
        cost_center_id=body.cost_center_id,
        storage_location=body.storage_location,
        batch_no=body.batch_no,
        extra=body.extra or {},
    )
    db.add(gm)

    # Roll up onto matching material cost line (by product_id, else first material line)
    if body.movement_type in ("component_issue", "component_return") and total > 0:
        ocl = None
        if body.product_id:
            ocl_r = await db.execute(
                select(CoOrderCostLine).where(
                    CoOrderCostLine.order_id == order.id,
                    CoOrderCostLine.category == "material",
                    CoOrderCostLine.product_id == body.product_id,
                )
            )
            ocl = ocl_r.scalars().first()
        if not ocl:
            ocl_r = await db.execute(
                select(CoOrderCostLine).where(
                    CoOrderCostLine.order_id == order.id,
                    CoOrderCostLine.category == "material",
                ).order_by(CoOrderCostLine.sequence)
            )
            ocl = ocl_r.scalars().first()
        if ocl:
            sign = Decimal("1") if body.movement_type == "component_issue" else Decimal("-1")
            ocl.qty_actual = max(Decimal("0"), Decimal(str(ocl.qty_actual or 0)) + sign * qty)
            ocl.amount_actual = max(Decimal("0"), Decimal(str(ocl.amount_actual or 0)) + sign * total)
            if ocl.qty_actual > 0:
                ocl.rate_actual = (Decimal(str(ocl.amount_actual)) / Decimal(str(ocl.qty_actual))).quantize(Decimal("0.000001"))
            # Stamp product_id on the cost line if it was blank
            if body.product_id and not ocl.product_id:
                ocl.product_id = body.product_id

    await _audit(db, vu.vendor_id, "co_goods_movement", gm.id, "create", vu.id,
                 {"project_id": str(project_id), "movement_type": body.movement_type,
                  "doc_no": doc_no, "total_cost": str(total),
                  "material": material_label})
    await db.commit()
    await db.refresh(gm)
    return GoodsMovementOut.model_validate(gm)


_REVERSE_MOVEMENT = {
    "component_issue": "component_return",
    "component_return": "component_issue",
    "fg_receipt": "fg_receipt_reversal",
    "fg_receipt_reversal": "fg_receipt",
}


@router.post("/{project_id}/costing/goods-movements/{gm_id}/reverse", response_model=GoodsMovementOut)
async def reverse_project_goods_movement(
    project_id: UUID,
    gm_id: UUID,
    reason: str = Body(..., embed=True),
    vu: VendorUser = Depends(require_any_permission("finance.edit", "projects.costing.post")),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Reverse a goods movement by posting a counter-document with a new document number."""
    order = await _require_co_order(db, vu.vendor_id, project_id)
    r = await db.execute(
        select(CoGoodsMovement).where(
            CoGoodsMovement.id == gm_id,
            CoGoodsMovement.order_id == order.id,
        )
    )
    gm = r.scalar_one_or_none()
    if not gm:
        raise HTTPException(404, "Goods movement not found for this project")
    if gm.status == "reversed":
        raise HTTPException(409, "This goods movement has already been reversed")
    if (gm.extra or {}).get("reverses_id"):
        raise HTTPException(409, "Cannot reverse a reversal document")

    reverse_type = _REVERSE_MOVEMENT.get(gm.movement_type)
    if not reverse_type:
        raise HTTPException(422, f"Cannot reverse movement_type '{gm.movement_type}'")

    count_r = await db.execute(
        select(func.count()).select_from(CoGoodsMovement).where(CoGoodsMovement.vendor_id == vu.vendor_id)
    )
    rev_doc_no = f"GM{(count_r.scalar() or 0) + 1:06d}"
    qty = Decimal(str(gm.qty or 0))
    total = Decimal(str(gm.total_cost or 0))

    rev = CoGoodsMovement(
        id=_uuid_mod.uuid4(),
        vendor_id=vu.vendor_id,
        company_id=gm.company_id,
        order_id=order.id,
        movement_type=reverse_type,
        posting_date=date.today(),
        document_no=rev_doc_no,
        product_id=gm.product_id,
        description=f"Reversal of {gm.document_no or gm.id}" + (f" — {reason}" if reason else ""),
        uom=gm.uom,
        qty=qty,
        unit_cost=gm.unit_cost,
        total_cost=total,
        cost_center_id=gm.cost_center_id,
        storage_location=gm.storage_location,
        batch_no=gm.batch_no,
        status="posted",
        reversal_reason=reason,
        extra={
            "reverses_id": str(gm.id),
            "reverses_document_no": gm.document_no,
            "reversal_reason": reason,
        },
    )
    db.add(rev)

    # Mark original as reversed and link to the counter-document
    gm.status = "reversed"
    gm.reversal_reason = reason
    gm.extra = {
        **(gm.extra or {}),
        "reversed_by_id": str(rev.id),
        "reversed_by_document_no": rev_doc_no,
    }

    # Roll back / adjust material cost-line actuals
    if reverse_type in ("component_issue", "component_return") and gm.product_id and total > 0:
        ocl_r = await db.execute(
            select(CoOrderCostLine).where(
                CoOrderCostLine.order_id == order.id,
                CoOrderCostLine.category == "material",
                CoOrderCostLine.product_id == gm.product_id,
            )
        )
        ocl = ocl_r.scalars().first()
        if ocl:
            sign = Decimal("1") if reverse_type == "component_issue" else Decimal("-1")
            ocl.qty_actual = max(Decimal("0"), Decimal(str(ocl.qty_actual or 0)) + sign * qty)
            ocl.amount_actual = max(Decimal("0"), Decimal(str(ocl.amount_actual or 0)) + sign * total)
            if ocl.qty_actual > 0:
                ocl.rate_actual = (
                    Decimal(str(ocl.amount_actual)) / Decimal(str(ocl.qty_actual))
                ).quantize(Decimal("0.000001"))

    material_label = None
    if gm.product_id:
        from app.models.vendor_product import Product
        prod = (
            await db.execute(select(Product).where(Product.id == gm.product_id))
        ).scalar_one_or_none()
        if prod:
            material_label = (
                (str(prod.material_code).strip() if prod.material_code else None)
                or (str(prod.sku).strip() if prod.sku else None)
                or (str(prod.name).strip() if prod.name else None)
            )

    await _audit(
        db, vu.vendor_id, "co_goods_movement", rev.id, "create", vu.id,
        {
            "project_id": str(project_id),
            "movement_type": reverse_type,
            "doc_no": rev_doc_no,
            "total_cost": str(total),
            "material": material_label,
            "reverses": gm.document_no,
            "reason": reason,
        },
    )
    await db.commit()
    await db.refresh(rev)
    return GoodsMovementOut.model_validate(rev)


@router.get("/{project_id}/costing/activity-confirmations", response_model=List[ActivityConfirmationOut])
async def list_project_activity_confirmations(
    project_id: UUID,
    confirmation_type: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    vu: VendorUser = Depends(require_permission("projects.view")),
    db: AsyncSession = Depends(get_db),
):
    order = await _require_co_order(db, vu.vendor_id, project_id)
    q = select(CoActivityConfirmation).where(CoActivityConfirmation.order_id == order.id)
    if confirmation_type:
        q = q.where(CoActivityConfirmation.confirmation_type == confirmation_type)
    if from_date:
        q = q.where(CoActivityConfirmation.confirmation_date >= from_date)
    if to_date:
        q = q.where(CoActivityConfirmation.confirmation_date <= to_date)
    q = q.order_by(CoActivityConfirmation.confirmation_date.desc())
    rows = (await db.execute(q)).scalars().all()
    return [ActivityConfirmationOut.model_validate(r) for r in rows]


@router.post("/{project_id}/costing/activity-confirmations", response_model=ActivityConfirmationOut, status_code=201)
async def post_project_activity_confirmation(
    project_id: UUID,
    body: ActivityConfirmationCreate,
    vu: VendorUser = Depends(require_any_permission("finance.edit", "projects.costing.post")),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Confirm actual labour / machine hours against this project's CO order."""
    order = await _require_co_order(db, vu.vendor_id, project_id)
    if body.order_id != order.id:
        raise HTTPException(422, "order_id in body must match this project's CO order.")

    hours = Decimal(str(body.hours_confirmed))
    rate = Decimal(str(body.rate_per_hour))
    total = (hours * rate).quantize(Decimal("0.0001"))

    if total > 0:
        try:
            await assert_budget_allows(db, order.id, "labor", total)
        except BudgetExceededError as exc:
            raise _budget_http(exc) from exc

    conf = CoActivityConfirmation(
        id=_uuid_mod.uuid4(),
        vendor_id=vu.vendor_id,
        company_id=body.company_id,
        order_id=order.id,
        operation_id=body.operation_id,
        activity_type_id=body.activity_type_id,
        cost_center_id=body.cost_center_id,
        confirmation_date=body.confirmation_date,
        confirmation_type=body.confirmation_type,
        qty_confirmed=body.qty_confirmed,
        hours_confirmed=hours,
        rate_per_hour=rate,
        total_cost=total,
        scrap_qty=body.scrap_qty,
        yield_pct=body.yield_pct,
        narration=body.narration,
        extra=body.extra or {},
    )
    db.add(conf)

    # Roll up onto matching activity cost line
    ocl_r = await db.execute(
        select(CoOrderCostLine).where(
            CoOrderCostLine.order_id == order.id,
            CoOrderCostLine.category == "activity",
            CoOrderCostLine.activity_type_id == body.activity_type_id,
        )
    )
    ocl = ocl_r.scalars().first()
    if ocl and total > 0:
        ocl.qty_actual = Decimal(str(ocl.qty_actual or 0)) + hours
        ocl.amount_actual = Decimal(str(ocl.amount_actual or 0)) + total
        if ocl.qty_actual > 0:
            ocl.rate_actual = (Decimal(str(ocl.amount_actual)) / Decimal(str(ocl.qty_actual))).quantize(Decimal("0.000001"))

    await _audit(db, vu.vendor_id, "co_activity_confirmation", conf.id, "create", vu.id,
                 {"project_id": str(project_id), "confirmation_type": body.confirmation_type,
                  "hours": str(hours), "total_cost": str(total)})
    await db.commit()
    await db.refresh(conf)
    return ActivityConfirmationOut.model_validate(conf)


# ── Audit log reader ──────────────────────────────────────────────────────────

@router.get("/{project_id}/costing/audit-log")
async def get_project_costing_audit_log(
    project_id: UUID,
    limit: int = Query(50, ge=1, le=200),
    vu: VendorUser = Depends(require_permission("projects.view")),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Return recent audit log entries for this project's costing activity."""
    r = await db.execute(
        select(FinAuditLog)
        .where(
            FinAuditLog.vendor_id == vu.vendor_id,
            FinAuditLog.diff_json["project_id"].as_string() == str(project_id),
        )
        .order_by(FinAuditLog.created_at.desc())
        .limit(limit)
    )
    rows = r.scalars().all()

    # Resolve performer display names (VendorUser → User.full_name)
    performers: dict = {}
    performer_ids = {row.performed_by_id for row in rows if row.performed_by_id}
    if performer_ids:
        vu_rows = (
            await db.execute(select(VendorUser).where(VendorUser.id.in_(performer_ids)))
        ).scalars().all()
        user_ids = {v.user_id for v in vu_rows if v.user_id}
        user_map: dict = {}
        if user_ids:
            users = (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
            user_map = {u.id: (u.full_name or u.email or "") for u in users}
        performers = {v.id: user_map.get(v.user_id, "") for v in vu_rows}

    # Resolve legacy product_id UUIDs in diffs → short material code
    from app.models.vendor_product import Product
    product_ids: set[UUID] = set()
    for row in rows:
        diff = row.diff_json or {}
        pid = diff.get("product_id")
        if isinstance(pid, str) and len(pid) == 36:
            try:
                product_ids.add(UUID(pid))
            except ValueError:
                pass
    material_by_id: dict[UUID, str] = {}
    if product_ids:
        prods = (await db.execute(select(Product).where(Product.id.in_(product_ids)))).scalars().all()
        for p in prods:
            label = (
                (str(p.material_code).strip() if p.material_code else None)
                or (str(p.sku).strip() if p.sku else None)
                or (str(p.name).strip() if p.name else None)
                or str(p.id)
            )
            material_by_id[p.id] = label

    def _display_diff(diff: Optional[dict]) -> Optional[dict]:
        if not diff:
            return diff
        out = dict(diff)
        pid = out.pop("product_id", None)
        if pid and "material" not in out:
            try:
                out["material"] = material_by_id.get(UUID(str(pid)), str(pid))
            except ValueError:
                out["material"] = str(pid)
        return out

    return [
        {
            "id": str(row.id),
            "entity_type": row.entity_type,
            "entity_id": str(row.entity_id),
            "action": row.action,
            "performed_by_id": str(row.performed_by_id) if row.performed_by_id else None,
            "performed_by_name": performers.get(row.performed_by_id) or None,
            "diff": _display_diff(row.diff_json),
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]


# ── Vendor bills linked to this project ──────────────────────────────────────

@router.get("/{project_id}/costing/vendor-bills")
async def list_project_vendor_bills(
    project_id: UUID,
    vu: VendorUser = Depends(require_permission("projects.view")),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Return all vendor bills tagged with this project (header-level tag)."""
    # Confirm project belongs to vendor.
    from app.models.project import Project as _Project
    proj = (
        await db.execute(
            select(_Project).where(
                _Project.id == project_id, _Project.vendor_id == vu.vendor_id
            )
        )
    ).scalar_one_or_none()
    if not proj:
        raise HTTPException(404, "Project not found")

    bills = (
        await db.execute(
            select(FinVendorBill)
            .where(
                FinVendorBill.pm_project_id == project_id,
                FinVendorBill.vendor_id == vu.vendor_id,
            )
            .order_by(FinVendorBill.bill_date.desc())
        )
    ).scalars().all()

    return [
        {
            "id": str(b.id),
            "bill_no": b.bill_no,
            "bill_date": b.bill_date.isoformat() if b.bill_date else None,
            "supplier_id": str(b.supplier_id) if b.supplier_id else None,
            "subtotal": str(b.subtotal or 0),
            "tax_amount": str(b.tax_amount or 0),
            "total": str(b.total or 0),
            "status": b.status,
            "currency": b.currency,
        }
        for b in bills
    ]
