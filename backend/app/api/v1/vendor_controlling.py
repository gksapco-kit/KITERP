# app/api/v1/vendor_controlling.py
"""Controlling (CO) API — cost planning, orders, variance, WIP."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Iterable, List, Optional, Set
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import select, func, delete, or_, case, and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_db, require_permission
from app.models.vendor_user import VendorUser
from app.models.vendor_product import Product
from app.models.finance import FinAccount, FinCompany, FinCostCenter, FinProject
from app.models.mrp import ProductBOMItem
from app.models.controlling import (
    CoActivityType,
    CoOverheadPool,
    CoOverheadRate,
    CoProductCostVersion,
    CoProductCostLine,
    CoManufacturingOrder,
    CoOrderCostLine,
    CoOrderOperation,
    CoGlMapping,
    CoCostBooking,
    CoActivityConfirmation,
    CoGoodsMovement,
    CoCostAllocation,
    CoBudgetLine,
    CoVarianceRun,
    CoWorkCenter,
    CoRouting,
    CoRoutingOperation,
    CoVarianceRunOrder,
)
from app.schemas.controlling import (
    ActivityTypeCreate,
    ActivityTypeUpdate,
    ActivityTypeOut,
    OverheadPoolCreate,
    OverheadPoolUpdate,
    OverheadPoolOut,
    OverheadRateCreate,
    OverheadRateOut,
    ProductCostVersionCreate,
    ProductCostVersionUpdate,
    ProductCostVersionOut,
    ProductCostLineCreate,
    ProductCostLineOut,
    ManufacturingOrderCreate,
    ManufacturingOrderUpdate,
    ManufacturingOrderOut,
    OrderCostLineCreate,
    OrderCostLineOut,
    OrderVarianceOut,
    WipSummaryOut,
    OrderOperationCreate,
    OrderOperationUpdate,
    OrderOperationOut,
    OrderCostLinePatch,
    OrderVarianceDetailedOut,
    VarianceLineDetail,
    WipReportOut,
    CoGlMappingOut,
    CoGlMappingUpsert,
    CoCostBookingOut,
    CoSettlementPostIn,
    CoSettlementReverseIn,
    ActivityConfirmationCreate,
    ActivityConfirmationUpdate,
    ActivityConfirmationOut,
    GoodsMovementCreate,
    GoodsMovementOut,
    CostAllocationCreate,
    CostAllocationOut,
    CostAllocationPostIn,
    BudgetLineCreate,
    BudgetLineUpdate,
    BudgetLineOut,
    InternalOrderBudgetVsActualOut,
    VarianceRunCreate,
    VarianceRunOut,
    VarianceRunPostIn,
    OrderStatusTransitionIn,
    PeriodEndReportOut,
    CostVersionRoutingIn,
    ApplyOverheadIn,
    WorkCenterCreate,
    WorkCenterUpdate,
    RoutingCreate,
    RoutingUpdate,
    RoutingOperationCreate,
    RoutingOperationUpdate,
)
from app.services.controlling.settlement import (
    get_gl_mapping,
    upsert_gl_mapping,
    post_production_completion,
    post_cogs_issue,
    reverse_cogs_issue,
    reverse_production_completion_posting,
    reverse_journal,
    order_line_amounts as _order_line_amounts,
    sum_order_planned_actual as _sum_order_planned_actual,
    check_period_open,
)
from app.services.controlling.budget_control import (
    BudgetExceededError,
    assert_budget_allows,
)
from app.services.controlling import movements as co_movements
from app.services.controlling.guards import (
    StateError,
    assert_order_editable,
    assert_version_editable,
)
from app.services.controlling.numbering import next_order_no

router = APIRouter(dependencies=[Depends(require_permission("controlling.view"))])


def _d(obj) -> dict:
    if obj is None:
        return {}
    data: dict = {}
    for col in obj.__table__.columns:
        v = getattr(obj, col.name)
        if hasattr(v, "isoformat"):
            v = v.isoformat()
        elif hasattr(v, "__str__") and not isinstance(v, (str, int, float, bool, dict, list, type(None))):
            v = str(v)
        data[col.name] = v
    return data


async def _require_company(db: AsyncSession, vendor_id: UUID, company_id: UUID) -> FinCompany:
    r = await db.execute(
        select(FinCompany).where(FinCompany.id == company_id, FinCompany.vendor_id == vendor_id)
    )
    co = r.scalar_one_or_none()
    if not co:
        raise HTTPException(status_code=404, detail="Business unit not found")
    return co


async def _assert_owned(
    db: AsyncSession, vendor_id: UUID, model: Any, ids: Iterable[Optional[UUID]], label: str
) -> None:
    """404 unless every non-null id is a row of ``model`` owned by this vendor (blocks cross-tenant references)."""
    wanted = {i for i in ids if i}
    if not wanted:
        return
    found = set(
        (
            await db.execute(select(model.id).where(model.id.in_(wanted), model.vendor_id == vendor_id))
        ).scalars().all()
    )
    if wanted - found:
        raise HTTPException(status_code=404, detail=f"{label} not found")


async def _assert_line_refs(
    db: AsyncSession,
    vendor_id: UUID,
    *,
    products: Iterable[Optional[UUID]] = (),
    activity_types: Iterable[Optional[UUID]] = (),
    pools: Iterable[Optional[UUID]] = (),
) -> None:
    """Validate the optional master-data references carried by cost lines."""
    await _assert_owned(db, vendor_id, Product, products, "Product")
    await _assert_owned(db, vendor_id, CoActivityType, activity_types, "Activity type")
    await _assert_owned(db, vendor_id, CoOverheadPool, pools, "Overhead pool")


async def _assert_order_refs(
    db: AsyncSession, vendor_id: UUID, data: dict[str, Any], company_id: Optional[UUID] = None
) -> None:
    """Validate the master-data references of an order payload (create / update)."""
    await _assert_owned(db, vendor_id, FinCostCenter, [data.get("cost_center_id")], "Cost center")
    await _assert_owned(db, vendor_id, FinProject, [data.get("project_id")], "Project")
    await _assert_owned(db, vendor_id, Product, [data.get("product_id")], "Product")
    ver_id = data.get("standard_cost_version_id")
    if ver_id:
        ver = (
            await db.execute(
                select(CoProductCostVersion).where(
                    CoProductCostVersion.id == ver_id, CoProductCostVersion.vendor_id == vendor_id
                )
            )
        ).scalar_one_or_none()
        if not ver:
            raise HTTPException(status_code=404, detail="Cost version not found")
        if company_id and ver.company_id != company_id:
            raise HTTPException(status_code=400, detail="Cost version belongs to a different business unit")


async def _commit(db: AsyncSession) -> None:
    """Commit; turn constraint violations (duplicate code / order no, bad reference) into a 409."""
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Conflict: a record with the same code / number already exists, or a referenced record is invalid.",
        ) from exc


async def _get_owned_order(
    db: AsyncSession, vendor_id: UUID, order_id: UUID, company_id: Optional[UUID] = None
) -> CoManufacturingOrder:
    order = (
        await db.execute(
            select(CoManufacturingOrder).where(
                CoManufacturingOrder.id == order_id, CoManufacturingOrder.vendor_id == vendor_id
            )
        )
    ).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if company_id and order.company_id != company_id:
        raise HTTPException(status_code=400, detail="Order belongs to a different business unit")
    return order


def _line_amount(qty: Decimal, rate: Decimal) -> Decimal:
    return (qty * rate).quantize(Decimal("0.0001"))


def _recalc_product_cost_line_amount(line: CoProductCostLine) -> None:
    line.amount_planned = _line_amount(
        Decimal(str(line.qty_per_output_unit or 0)),
        Decimal(str(line.unit_rate_planned or 0)),
    )


def _rollup_version_totals(ver: CoProductCostVersion) -> None:
    """Recompute all planned totals of a cost version from its lines.

    line_type values: material | activity | overhead | direct_overhead | indirect_overhead
    (anything else, e.g. scrap / other, counts towards the rolled-up unit cost only).
    """
    mat = act = ovh = dovh = iovh = other = Decimal("0")
    for ln in ver.lines:
        _recalc_product_cost_line_amount(ln)
        amt = Decimal(str(ln.amount_planned or 0))
        lt = (ln.line_type or "").lower()
        if lt == "material":
            mat += amt
        elif lt == "activity":
            act += amt
        elif lt == "overhead":
            ovh += amt
        elif lt == "direct_overhead":
            dovh += amt
        elif lt == "indirect_overhead":
            iovh += amt
        else:
            other += amt
    ver.material_total_planned = mat
    ver.activity_total_planned = act
    ver.direct_overhead_total_planned = dovh
    ver.indirect_overhead_total_planned = iovh
    ver.overhead_total_planned = ovh + dovh + iovh
    ver.rolled_up_unit_cost = mat + act + ovh + dovh + iovh + other


def _co_error(exc: Exception) -> HTTPException:
    """Map service-layer errors to HTTP: state -> 409, budget -> 409, missing -> 404, other -> 422."""
    if isinstance(exc, BudgetExceededError):
        return HTTPException(status_code=409, detail=exc.availability.to_detail())
    msg = str(exc)
    if isinstance(exc, StateError) or "already" in msg.lower():
        return HTTPException(status_code=409, detail=msg)
    if "not found" in msg.lower():
        return HTTPException(status_code=404, detail=msg)
    return HTTPException(status_code=422, detail=msg)


async def _load_order_for_edit(
    db: AsyncSession, vendor_id: UUID, order_id: UUID, what: str = "order", *, check: bool = True
) -> CoManufacturingOrder:
    """Load an order (row-locked) with its children and, unless ``check`` is False, require it to be editable."""
    order = (
        await db.execute(
            select(CoManufacturingOrder)
            .options(*_mo_load_options())
            .where(CoManufacturingOrder.id == order_id, CoManufacturingOrder.vendor_id == vendor_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Not found")
    if check:
        try:
            await assert_order_editable(db, order, what)
        except StateError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
    return order


def _mo_load_options():
    return (
        selectinload(CoManufacturingOrder.cost_lines),
        selectinload(CoManufacturingOrder.operations),
        selectinload(CoManufacturingOrder.cost_bookings),
    )


def _operation_to_out(op: CoOrderOperation) -> OrderOperationOut:
    return OrderOperationOut(
        id=op.id,
        order_id=op.order_id,
        sequence=op.sequence or 0,
        operation_code=op.operation_code,
        name=op.name or "Operation",
        activity_type_id=op.activity_type_id,
        work_center_id=op.work_center_id,
        planned_qty=Decimal(str(op.planned_qty or 0)),
        confirmed_qty=Decimal(str(op.confirmed_qty or 0)),
        scrap_qty=Decimal(str(op.scrap_qty or 0)),
        planned_hours=Decimal(str(op.planned_hours or 0)),
        actual_hours=Decimal(str(op.actual_hours or 0)),
        planned_rate=Decimal(str(op.planned_rate or 0)),
        actual_rate=Decimal(str(op.actual_rate or 0)),
        status=op.status or "pending",
        source=op.source or "manual",
        notes=op.notes,
        created_at=op.created_at,
        updated_at=op.updated_at,
    )


def _variance_line_detail(ln: CoOrderCostLine) -> VarianceLineDetail:
    _order_line_amounts(ln)
    qp = Decimal(str(ln.qty_planned or 0))
    qa = Decimal(str(ln.qty_actual or 0))
    rp = Decimal(str(ln.rate_planned or 0))
    ra = Decimal(str(ln.rate_actual or 0))
    ap = Decimal(str(ln.amount_planned or 0))
    aa = Decimal(str(ln.amount_actual or 0))
    price_v = (ra - rp) * qa
    usage_v = (qa - qp) * rp
    total_v = aa - ap
    return VarianceLineDetail(
        line_id=ln.id,
        category=ln.category or "other",
        description=ln.description,
        qty_planned=qp,
        qty_actual=qa,
        rate_planned=rp,
        rate_actual=ra,
        amount_planned=ap,
        amount_actual=aa,
        price_variance=price_v,
        usage_variance=usage_v,
        total_variance=total_v,
    )


async def _rate_for_pool_on_date(
    db: AsyncSession, pool_id: UUID, on_date: date
) -> Decimal:
    r = await db.execute(
        select(CoOverheadRate)
        .where(
            CoOverheadRate.pool_id == pool_id,
            CoOverheadRate.effective_from <= on_date,
            or_(CoOverheadRate.effective_to.is_(None), CoOverheadRate.effective_to >= on_date),
        )
        .order_by(CoOverheadRate.effective_from.desc())
        .limit(1)
    )
    row = r.scalar_one_or_none()
    if not row:
        return Decimal("0")
    return Decimal(str(row.rate_per_unit or 0))


async def _active_unit_cost(
    db: AsyncSession, vendor_id: UUID, company_id: UUID, product_id: UUID
) -> Decimal:
    r = await db.execute(
        select(CoProductCostVersion)
        .where(
            CoProductCostVersion.vendor_id == vendor_id,
            CoProductCostVersion.company_id == company_id,
            CoProductCostVersion.product_id == product_id,
            CoProductCostVersion.status == "active",
        )
        .order_by(CoProductCostVersion.valid_from.desc())
        .limit(1)
    )
    v = r.scalar_one_or_none()
    if not v:
        return Decimal("0")
    return Decimal(str(v.rolled_up_unit_cost or 0))


async def _rollup_unit_cost_recursive(
    db: AsyncSession,
    vendor_id: UUID,
    company_id: UUID,
    product_id: UUID,
    visited: Set[str],
    memo: Optional[dict[str, Decimal]] = None,
) -> Decimal:
    key = str(product_id)
    if memo is None:
        memo = {}
    if key in memo:
        return memo[key]
    if key in visited:
        raise HTTPException(
            status_code=422,
            detail="Circular BOM detected — a component (directly or indirectly) contains the product being costed.",
        )
    visited.add(key)
    r = await db.execute(
        select(ProductBOMItem).where(
            ProductBOMItem.vendor_id == vendor_id,
            ProductBOMItem.product_id == product_id,
        )
    )
    bom_items = r.scalars().all()
    if not bom_items:
        cost = await _active_unit_cost(db, vendor_id, company_id, product_id)
        visited.remove(key)
        memo[key] = cost
        return cost
    total = Decimal("0")
    for bi in bom_items:
        comp_cost = await _rollup_unit_cost_recursive(db, vendor_id, company_id, bi.component_id, visited, memo)
        total += Decimal(str(bi.qty_per_unit)) * comp_cost
    visited.remove(key)
    memo[key] = total
    return total


def _version_to_out(ver: CoProductCostVersion) -> ProductCostVersionOut:
    _rollup_version_totals(ver)
    lines = [
        ProductCostLineOut(
            id=ln.id,
            version_id=ln.version_id,
            line_type=ln.line_type,
            description=ln.description,
            component_product_id=ln.component_product_id,
            activity_type_id=ln.activity_type_id,
            overhead_pool_id=ln.overhead_pool_id,
            qty_per_output_unit=Decimal(str(ln.qty_per_output_unit or 0)),
            unit_rate_planned=Decimal(str(ln.unit_rate_planned or 0)),
            amount_planned=Decimal(str(ln.amount_planned or 0)),
            sequence=ln.sequence or 0,
            category=ln.line_type,
            qty_planned=Decimal(str(ln.qty_per_output_unit or 0)),
            rate_planned=Decimal(str(ln.unit_rate_planned or 0)),
        )
        for ln in ver.lines
    ]
    return ProductCostVersionOut(
        id=ver.id,
        vendor_id=ver.vendor_id,
        company_id=ver.company_id,
        product_id=ver.product_id,
        version_code=ver.version_code,
        valid_from=ver.valid_from,
        valid_to=ver.valid_to,
        status=ver.status or "draft",
        material_total_planned=Decimal(str(ver.material_total_planned or 0)),
        activity_total_planned=Decimal(str(ver.activity_total_planned or 0)),
        overhead_total_planned=Decimal(str(ver.overhead_total_planned or 0)),
        direct_overhead_total_planned=Decimal(str(ver.direct_overhead_total_planned or 0)),
        indirect_overhead_total_planned=Decimal(str(ver.indirect_overhead_total_planned or 0)),
        routing_id=ver.routing_id,
        rolled_up_unit_cost=Decimal(str(ver.rolled_up_unit_cost or 0)),
        notes=ver.notes,
        extra=ver.extra or {},
        created_at=ver.created_at,
        updated_at=ver.updated_at,
        lines=lines,
    )


def _order_to_out(order: CoManufacturingOrder) -> ManufacturingOrderOut:
    lines = [
        OrderCostLineOut(
            id=ln.id,
            order_id=ln.order_id,
            category=ln.category,
            description=ln.description,
            product_id=ln.product_id,
            activity_type_id=ln.activity_type_id,
            overhead_pool_id=ln.overhead_pool_id,
            uom=ln.uom or "EA",
            qty_planned=Decimal(str(ln.qty_planned or 0)),
            qty_actual=Decimal(str(ln.qty_actual or 0)),
            rate_planned=Decimal(str(ln.rate_planned or 0)),
            rate_actual=Decimal(str(ln.rate_actual or 0)),
            amount_planned=Decimal(str(ln.amount_planned or 0)),
            amount_actual=Decimal(str(ln.amount_actual or 0)),
            sequence=ln.sequence or 0,
        )
        for ln in order.cost_lines
    ]
    ops = [_operation_to_out(o) for o in (order.operations or [])]
    bookings = [
        CoCostBookingOut.model_validate(_d(b)) for b in (order.cost_bookings or [])
    ]
    return ManufacturingOrderOut(
        id=order.id,
        vendor_id=order.vendor_id,
        company_id=order.company_id,
        order_no=order.order_no,
        title=order.title,
        order_kind=order.order_kind,
        status=order.status,
        priority=order.priority,
        product_id=order.product_id,
        qty_planned=Decimal(str(order.qty_planned or 0)),
        qty_delivered=Decimal(str(order.qty_delivered or 0)),
        cost_center_id=order.cost_center_id,
        project_id=order.project_id,
        ref_doc_type=order.ref_doc_type,
        ref_doc_id=order.ref_doc_id,
        standard_cost_version_id=order.standard_cost_version_id,
        scheduled_start=order.scheduled_start,
        scheduled_end=order.scheduled_end,
        released_at=order.released_at,
        completed_at=order.completed_at,
        notes=order.notes,
        extra=order.extra or {},
        created_at=order.created_at,
        updated_at=order.updated_at,
        cost_lines=lines,
        operations=ops,
        production_completion_journal_id=order.production_completion_journal_id,
        cogs_issue_journal_id=order.cogs_issue_journal_id,
        settlement_status=order.settlement_status or "none",
        qty_cogs_posted=order.qty_cogs_posted or Decimal("0"),
        cost_bookings=bookings,
    )


# ═══════════════════════════════════════════════════════════════════════════
# Activity types
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/activity-types", response_model=List[ActivityTypeOut])
async def list_activity_types(
    company_id: Optional[UUID] = Query(None),
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    q = select(CoActivityType).where(CoActivityType.vendor_id == vu.vendor_id)
    if company_id:
        q = q.where(CoActivityType.company_id == company_id)
    r = await db.execute(q.order_by(CoActivityType.code))
    return [ActivityTypeOut.model_validate(_d(x)) for x in r.scalars().all()]


@router.post("/activity-types", response_model=ActivityTypeOut, status_code=201)
async def create_activity_type(
    body: ActivityTypeCreate,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    await _require_company(db, vu.vendor_id, body.company_id)
    await _assert_owned(db, vu.vendor_id, FinCostCenter, [body.default_cost_center_id], "Cost center")
    row = CoActivityType(
        vendor_id=vu.vendor_id,
        company_id=body.company_id,
        code=body.code.strip(),
        name=body.name.strip(),
        description=body.description,
        uom=body.uom or "H",
        default_cost_center_id=body.default_cost_center_id,
        is_active=body.is_active,
    )
    db.add(row)
    await _commit(db)
    await db.refresh(row)
    return ActivityTypeOut.model_validate(_d(row))


@router.patch("/activity-types/{row_id}", response_model=ActivityTypeOut)
async def update_activity_type(
    row_id: UUID,
    body: ActivityTypeUpdate,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(CoActivityType).where(
            CoActivityType.id == row_id, CoActivityType.vendor_id == vu.vendor_id
        )
    )
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    data = body.model_dump(exclude_unset=True)
    await _assert_owned(db, vu.vendor_id, FinCostCenter, [data.get("default_cost_center_id")], "Cost center")
    for k, v in data.items():
        setattr(row, k, v)
    await _commit(db)
    await db.refresh(row)
    return ActivityTypeOut.model_validate(_d(row))


# ═══════════════════════════════════════════════════════════════════════════
# Overhead pools & rates
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/overhead-pools", response_model=List[OverheadPoolOut])
async def list_overhead_pools(
    company_id: Optional[UUID] = Query(None),
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    q = select(CoOverheadPool).where(CoOverheadPool.vendor_id == vu.vendor_id)
    if company_id:
        q = q.where(CoOverheadPool.company_id == company_id)
    r = await db.execute(q.order_by(CoOverheadPool.code))
    return [OverheadPoolOut.model_validate(_d(x)) for x in r.scalars().all()]


@router.post("/overhead-pools", response_model=OverheadPoolOut, status_code=201)
async def create_overhead_pool(
    body: OverheadPoolCreate,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    await _require_company(db, vu.vendor_id, body.company_id)
    row = CoOverheadPool(
        vendor_id=vu.vendor_id,
        company_id=body.company_id,
        code=body.code.strip(),
        name=body.name.strip(),
        description=body.description,
        allocation_base=body.allocation_base,
        overhead_type=body.overhead_type,
        formula_type=body.formula_type,
        formula_value=body.formula_value,
        is_active=body.is_active,
    )
    db.add(row)
    await _commit(db)
    await db.refresh(row)
    return OverheadPoolOut.model_validate(_d(row))


@router.patch("/overhead-pools/{pool_id}", response_model=OverheadPoolOut)
async def update_overhead_pool(
    pool_id: UUID,
    body: OverheadPoolUpdate,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(CoOverheadPool).where(
            CoOverheadPool.id == pool_id, CoOverheadPool.vendor_id == vu.vendor_id
        )
    )
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    await _commit(db)
    await db.refresh(row)
    return OverheadPoolOut.model_validate(_d(row))


@router.get("/overhead-pools/{pool_id}/rates", response_model=List[OverheadRateOut])
async def list_overhead_rates(
    pool_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    r0 = await db.execute(
        select(CoOverheadPool).where(
            CoOverheadPool.id == pool_id, CoOverheadPool.vendor_id == vu.vendor_id
        )
    )
    if not r0.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Pool not found")
    r = await db.execute(
        select(CoOverheadRate)
        .where(CoOverheadRate.pool_id == pool_id)
        .order_by(CoOverheadRate.effective_from.desc())
    )
    return [OverheadRateOut.model_validate(_d(x)) for x in r.scalars().all()]


@router.post("/overhead-pools/{pool_id}/rates", response_model=OverheadRateOut, status_code=201)
async def create_overhead_rate(
    pool_id: UUID,
    body: OverheadRateCreate,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    r0 = await db.execute(
        select(CoOverheadPool).where(
            CoOverheadPool.id == pool_id, CoOverheadPool.vendor_id == vu.vendor_id
        )
    )
    if not r0.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Pool not found")
    row = CoOverheadRate(
        pool_id=pool_id,
        effective_from=body.effective_from,
        effective_to=body.effective_to,
        rate_per_unit=body.rate_per_unit,
        notes=body.notes,
    )
    db.add(row)
    await _commit(db)
    await db.refresh(row)
    return OverheadRateOut.model_validate(_d(row))


# ═══════════════════════════════════════════════════════════════════════════
# Product cost versions
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/product-costs", response_model=List[ProductCostVersionOut])
async def list_product_costs(
    company_id: Optional[UUID] = Query(None),
    product_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    q = select(CoProductCostVersion).options(selectinload(CoProductCostVersion.lines))
    q = q.where(CoProductCostVersion.vendor_id == vu.vendor_id)
    if company_id:
        q = q.where(CoProductCostVersion.company_id == company_id)
    if product_id:
        q = q.where(CoProductCostVersion.product_id == product_id)
    if status:
        q = q.where(CoProductCostVersion.status == status)
    r = await db.execute(q.order_by(CoProductCostVersion.valid_from.desc()))
    return [_version_to_out(v) for v in r.scalars().unique().all()]


@router.get("/product-costs/{version_id}", response_model=ProductCostVersionOut)
async def get_product_cost(
    version_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(CoProductCostVersion)
        .options(selectinload(CoProductCostVersion.lines))
        .where(
            CoProductCostVersion.id == version_id,
            CoProductCostVersion.vendor_id == vu.vendor_id,
        )
    )
    ver = r.scalar_one_or_none()
    if not ver:
        raise HTTPException(status_code=404, detail="Not found")
    return _version_to_out(ver)


@router.post("/product-costs", response_model=ProductCostVersionOut, status_code=201)
async def create_product_cost(
    body: ProductCostVersionCreate,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    await _require_company(db, vu.vendor_id, body.company_id)
    await _assert_line_refs(
        db, vu.vendor_id,
        products=[body.product_id, *(ln.component_product_id for ln in body.lines)],
        activity_types=[ln.activity_type_id for ln in body.lines],
        pools=[ln.overhead_pool_id for ln in body.lines],
    )
    ver = CoProductCostVersion(
        vendor_id=vu.vendor_id,
        company_id=body.company_id,
        product_id=body.product_id,
        version_code=body.version_code.strip(),
        valid_from=body.valid_from,
        valid_to=body.valid_to,
        status=body.status,
        notes=body.notes,
        extra=body.extra,
    )
    for i, ln in enumerate(body.lines):
        row = CoProductCostLine(
            line_type=ln.line_type,
            description=ln.description,
            component_product_id=ln.component_product_id,
            activity_type_id=ln.activity_type_id,
            overhead_pool_id=ln.overhead_pool_id,
            qty_per_output_unit=ln.qty_per_output_unit,
            unit_rate_planned=ln.unit_rate_planned,
            sequence=ln.sequence if ln.sequence else i,
        )
        _recalc_product_cost_line_amount(row)
        ver.lines.append(row)
    _rollup_version_totals(ver)
    if body.status == "active":
        await _activate_cost_version(db, vu.vendor_id, ver)
    db.add(ver)
    await _commit(db)
    r = await db.execute(
        select(CoProductCostVersion)
        .options(selectinload(CoProductCostVersion.lines))
        .where(CoProductCostVersion.id == ver.id)
    )
    return _version_to_out(r.scalar_one())


_VERSION_TRANSITIONS: dict[str, Set[str]] = {
    "draft": {"active", "archived"},
    "active": {"archived"},
    "archived": set(),
}


async def _activate_cost_version(db: AsyncSession, vendor_id: UUID, ver: CoProductCostVersion) -> None:
    """Make ``ver`` the one active standard of its product / company: it needs lines, the others are archived."""
    if not ver.lines:
        raise HTTPException(status_code=422, detail="Add cost lines before activating a cost version")
    others = (
        await db.execute(
            select(CoProductCostVersion).where(
                CoProductCostVersion.vendor_id == vendor_id,
                CoProductCostVersion.company_id == ver.company_id,
                CoProductCostVersion.product_id == ver.product_id,
                CoProductCostVersion.status == "active",
                CoProductCostVersion.id != ver.id,
            )
        )
    ).scalars().all()
    for o in others:
        o.status = "archived"


@router.patch("/product-costs/{version_id}", response_model=ProductCostVersionOut)
async def update_product_cost(
    version_id: UUID,
    body: ProductCostVersionUpdate,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    ver = await _load_cost_version(db, vu.vendor_id, version_id, editable=False)
    changes = body.model_dump(exclude_unset=True)
    if (ver.status or "draft") != "draft" and set(changes) - {"status", "notes", "valid_to", "extra"}:
        raise HTTPException(
            status_code=409,
            detail=f"Cost version is {ver.status}; only its status, validity end and notes can change. "
            "Create a new version to revise the standard.",
        )
    new_status = changes.get("status")
    if new_status and new_status != ver.status:
        if new_status not in _VERSION_TRANSITIONS.get(ver.status or "draft", set()):
            raise HTTPException(
                status_code=422,
                detail=f"Cannot change a {ver.status} cost version to {new_status}",
            )
        if new_status == "active":
            await _activate_cost_version(db, vu.vendor_id, ver)
    for k, v in changes.items():
        setattr(ver, k, v)
    _rollup_version_totals(ver)
    await _commit(db)
    await db.refresh(ver)
    r2 = await db.execute(
        select(CoProductCostVersion)
        .options(selectinload(CoProductCostVersion.lines))
        .where(CoProductCostVersion.id == version_id)
    )
    return _version_to_out(r2.scalar_one())


@router.post("/product-costs/{version_id}/lines", response_model=ProductCostVersionOut)
async def add_product_cost_line(
    version_id: UUID,
    body: ProductCostLineCreate,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    ver = await _load_cost_version(db, vu.vendor_id, version_id, editable=True)
    await _assert_line_refs(
        db, vu.vendor_id,
        products=[body.component_product_id],
        activity_types=[body.activity_type_id],
        pools=[body.overhead_pool_id],
    )
    row = CoProductCostLine(
        line_type=body.line_type,
        description=body.description,
        component_product_id=body.component_product_id,
        activity_type_id=body.activity_type_id,
        overhead_pool_id=body.overhead_pool_id,
        qty_per_output_unit=body.qty_per_output_unit,
        unit_rate_planned=body.unit_rate_planned,
        sequence=body.sequence,
    )
    _recalc_product_cost_line_amount(row)
    ver.lines.append(row)
    _rollup_version_totals(ver)
    await _commit(db)
    r2 = await db.execute(
        select(CoProductCostVersion)
        .options(selectinload(CoProductCostVersion.lines))
        .where(CoProductCostVersion.id == version_id)
    )
    return _version_to_out(r2.scalar_one())


@router.delete("/product-costs/{version_id}/lines/{line_id}", response_model=ProductCostVersionOut)
async def delete_product_cost_line(
    version_id: UUID,
    line_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    ver = await _load_cost_version(db, vu.vendor_id, version_id, editable=True)
    target = next((ln for ln in ver.lines if ln.id == line_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Cost line not found")
    ver.lines.remove(target)  # delete-orphan removes the row; only lines of this version are reachable
    _rollup_version_totals(ver)
    await _commit(db)
    r2 = await db.execute(
        select(CoProductCostVersion)
        .options(selectinload(CoProductCostVersion.lines))
        .where(CoProductCostVersion.id == version_id)
    )
    return _version_to_out(r2.scalar_one())


@router.post("/product-costs/{version_id}/roll-up-bom", response_model=ProductCostVersionOut)
async def roll_up_bom_into_product_cost(
    version_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    ver = await _load_cost_version(db, vu.vendor_id, version_id, editable=True)
    await db.execute(
        delete(CoProductCostLine).where(
            CoProductCostLine.version_id == version_id,
            CoProductCostLine.line_type == "material",
        )
    )
    await db.flush()
    r_reload = await db.execute(
        select(CoProductCostVersion)
        .options(selectinload(CoProductCostVersion.lines))
        .where(
            CoProductCostVersion.id == version_id,
            CoProductCostVersion.vendor_id == vu.vendor_id,
        )
    )
    ver = r_reload.scalar_one()

    r2 = await db.execute(
        select(ProductBOMItem).where(
            ProductBOMItem.vendor_id == vu.vendor_id,
            ProductBOMItem.product_id == ver.product_id,
        )
    )
    bom_items = r2.scalars().all()
    seq = max((ln.sequence or 0 for ln in ver.lines), default=-1) + 1
    for bi in bom_items:
        unit_cost = await _rollup_unit_cost_recursive(
            db, vu.vendor_id, ver.company_id, bi.component_id, set()
        )
        qty = Decimal(str(bi.qty_per_unit))
        row = CoProductCostLine(
            line_type="material",
            description=f"BOM component {bi.component_id}",
            component_product_id=bi.component_id,
            qty_per_output_unit=qty,
            unit_rate_planned=unit_cost,
            sequence=seq,
        )
        _recalc_product_cost_line_amount(row)
        ver.lines.append(row)
        seq += 1
    _rollup_version_totals(ver)
    await _commit(db)
    r3 = await db.execute(
        select(CoProductCostVersion)
        .options(selectinload(CoProductCostVersion.lines))
        .where(CoProductCostVersion.id == version_id)
    )
    return _version_to_out(r3.scalar_one())


# ═══════════════════════════════════════════════════════════════════════════
# Manufacturing orders
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/manufacturing-orders", response_model=List[ManufacturingOrderOut])
async def list_manufacturing_orders(
    company_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    order_kind: Optional[str] = Query(None),
    project_id: Optional[UUID] = Query(None),
    limit: int = Query(500, ge=1, le=2000, description="Max rows returned"),
    offset: int = Query(0, ge=0),
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    q = select(CoManufacturingOrder).options(*_mo_load_options())
    q = q.where(CoManufacturingOrder.vendor_id == vu.vendor_id)
    if company_id:
        q = q.where(CoManufacturingOrder.company_id == company_id)
    if status:
        q = q.where(CoManufacturingOrder.status == status)
    if order_kind:
        q = q.where(CoManufacturingOrder.order_kind == order_kind)
    if project_id:
        q = q.where(CoManufacturingOrder.project_id == project_id)
    q = q.order_by(CoManufacturingOrder.created_at.desc(), CoManufacturingOrder.id).limit(limit).offset(offset)
    r = await db.execute(q)
    return [_order_to_out(o) for o in r.scalars().unique().all()]


@router.get("/manufacturing-orders/{order_id}", response_model=ManufacturingOrderOut)
async def get_manufacturing_order(
    order_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(CoManufacturingOrder)
        .options(*_mo_load_options())
        .where(
            CoManufacturingOrder.id == order_id,
            CoManufacturingOrder.vendor_id == vu.vendor_id,
        )
    )
    order = r.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Not found")
    return _order_to_out(order)


def _co_settle_http_err(exc: ValueError) -> HTTPException:
    msg = str(exc)
    low = msg.lower()
    if "already posted" in low or "release the order" in low or "is closed" in low or "is locked" in low:
        return HTTPException(status_code=409, detail=msg)
    if "not found" in low:
        return HTTPException(status_code=404, detail=msg)
    return HTTPException(status_code=400, detail=msg)


@router.get("/co-gl-mapping", response_model=CoGlMappingOut | None)
async def get_co_gl_mapping(
    company_id: UUID = Query(...),
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    await _require_company(db, vu.vendor_id, company_id)
    row = await get_gl_mapping(db, vu.vendor_id, company_id)
    if not row:
        return None
    return CoGlMappingOut.model_validate(_d(row))


@router.put("/co-gl-mapping", response_model=CoGlMappingOut)
async def put_co_gl_mapping(
    body: CoGlMappingUpsert,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    await _require_company(db, vu.vendor_id, body.company_id)
    payload = body.model_dump(exclude_unset=True)
    payload.pop("company_id", None)
    account_ids = [v for k, v in payload.items() if k.endswith("_account_id")]
    await _assert_owned(db, vu.vendor_id, FinAccount, account_ids, "GL account")
    row = await upsert_gl_mapping(db, vu.vendor_id, body.company_id, **payload)
    await _commit(db)
    r = await db.execute(select(CoGlMapping).where(CoGlMapping.id == row.id))
    fresh = r.scalar_one()
    return CoGlMappingOut.model_validate(_d(fresh))


@router.post(
    "/manufacturing-orders/{order_id}/post-production-completion",
    response_model=ManufacturingOrderOut,
)
async def post_mo_production_completion(
    order_id: UUID,
    payload: CoSettlementPostIn | None = Body(None),
    vu: VendorUser = Depends(require_permission("finance.journal.post")),
    db: AsyncSession = Depends(get_db),
):
    p = payload or CoSettlementPostIn()
    try:
        await post_production_completion(db, vu.vendor_id, order_id, vu.id, p.entry_date)
    except ValueError as e:
        await db.rollback()
        raise _co_settle_http_err(e) from e
    await _commit(db)
    r = await db.execute(
        select(CoManufacturingOrder)
        .options(*_mo_load_options())
        .where(
            CoManufacturingOrder.id == order_id,
            CoManufacturingOrder.vendor_id == vu.vendor_id,
        )
    )
    order = r.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Not found")
    return _order_to_out(order)


@router.post(
    "/manufacturing-orders/{order_id}/post-cogs-issue",
    response_model=ManufacturingOrderOut,
)
async def post_mo_cogs_issue(
    order_id: UUID,
    payload: CoSettlementPostIn | None = Body(None),
    vu: VendorUser = Depends(require_permission("finance.journal.post")),
    db: AsyncSession = Depends(get_db),
):
    p = payload or CoSettlementPostIn()
    try:
        await post_cogs_issue(db, vu.vendor_id, order_id, vu.id, p.entry_date)
    except ValueError as e:
        await db.rollback()
        raise _co_settle_http_err(e) from e
    await _commit(db)
    r = await db.execute(
        select(CoManufacturingOrder)
        .options(*_mo_load_options())
        .where(
            CoManufacturingOrder.id == order_id,
            CoManufacturingOrder.vendor_id == vu.vendor_id,
        )
    )
    order = r.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Not found")
    return _order_to_out(order)


async def _reverse_settlement(
    db: AsyncSession, vu: VendorUser, order_id: UUID, body: CoSettlementReverseIn, kind: str
) -> ManufacturingOrderOut:
    try:
        if kind == "cogs":
            await reverse_cogs_issue(db, vu.vendor_id, order_id, vu.id, body.reason)
        else:
            await reverse_production_completion_posting(db, vu.vendor_id, order_id, vu.id, body.reason)
    except ValueError as e:
        await db.rollback()
        msg = str(e).lower()
        if "not found" in msg:
            raise HTTPException(status_code=404, detail=str(e)) from e
        raise HTTPException(status_code=409, detail=str(e)) from e
    await _commit(db)
    order = (
        await db.execute(
            select(CoManufacturingOrder)
            .options(*_mo_load_options())
            .where(CoManufacturingOrder.id == order_id, CoManufacturingOrder.vendor_id == vu.vendor_id)
            .execution_options(populate_existing=True)
        )
    ).scalar_one()
    return _order_to_out(order)


@router.post("/manufacturing-orders/{order_id}/reverse-cogs-issue", response_model=ManufacturingOrderOut)
async def reverse_mo_cogs_issue(
    order_id: UUID,
    body: CoSettlementReverseIn,
    vu: VendorUser = Depends(require_permission("finance.journal.post")),
    db: AsyncSession = Depends(get_db),
):
    """Reverse the most recent COGS posting (voids / reverses its journal and releases the quantity)."""
    return await _reverse_settlement(db, vu, order_id, body, "cogs")


@router.post("/manufacturing-orders/{order_id}/reverse-production-completion", response_model=ManufacturingOrderOut)
async def reverse_mo_production_completion(
    order_id: UUID,
    body: CoSettlementReverseIn,
    vu: VendorUser = Depends(require_permission("finance.journal.post")),
    db: AsyncSession = Depends(get_db),
):
    """Reverse the FG-receipt / WIP-relief journal so actuals can be corrected and re-posted."""
    return await _reverse_settlement(db, vu, order_id, body, "completion")


@router.post("/manufacturing-orders", response_model=ManufacturingOrderOut, status_code=201)
async def create_manufacturing_order(
    body: ManufacturingOrderCreate,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    await _require_company(db, vu.vendor_id, body.company_id)
    await _assert_order_refs(db, vu.vendor_id, body.model_dump(), company_id=body.company_id)
    await _assert_line_refs(
        db, vu.vendor_id,
        products=[cl.product_id for cl in body.cost_lines],
        activity_types=[cl.activity_type_id for cl in body.cost_lines],
        pools=[cl.overhead_pool_id for cl in body.cost_lines],
    )
    order_no = (body.order_no or "").strip() or await next_order_no(db, vu.vendor_id)
    order = CoManufacturingOrder(
        vendor_id=vu.vendor_id,
        company_id=body.company_id,
        order_no=order_no,
        title=body.title,
        order_kind=body.order_kind,
        status=body.status,
        priority=body.priority,
        product_id=body.product_id,
        qty_planned=body.qty_planned,
        qty_delivered=body.qty_delivered,
        cost_center_id=body.cost_center_id,
        project_id=body.project_id,
        ref_doc_type=body.ref_doc_type,
        ref_doc_id=body.ref_doc_id,
        standard_cost_version_id=body.standard_cost_version_id,
        scheduled_start=body.scheduled_start,
        scheduled_end=body.scheduled_end,
        notes=body.notes,
        extra=body.extra,
    )
    for i, cl in enumerate(body.cost_lines):
        ln = CoOrderCostLine(
            category=cl.category,
            description=cl.description,
            product_id=cl.product_id,
            activity_type_id=cl.activity_type_id,
            overhead_pool_id=cl.overhead_pool_id,
            uom=cl.uom,
            qty_planned=cl.qty_planned,
            qty_actual=cl.qty_actual,
            rate_planned=cl.rate_planned,
            rate_actual=cl.rate_actual,
            amount_planned=cl.amount_planned,
            amount_actual=cl.amount_actual,
            sequence=cl.sequence if cl.sequence else i,
        )
        _order_line_amounts(ln)
        order.cost_lines.append(ln)
    if body.status in ("released", "in_progress"):
        order.released_at = datetime.now(timezone.utc)
    db.add(order)
    await _commit(db)
    r = await db.execute(
        select(CoManufacturingOrder)
        .options(*_mo_load_options())
        .where(CoManufacturingOrder.id == order.id)
    )
    return _order_to_out(r.scalar_one())


@router.patch("/manufacturing-orders/{order_id}", response_model=ManufacturingOrderOut)
async def update_manufacturing_order(
    order_id: UUID,
    body: ManufacturingOrderUpdate,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    order = await _load_order_for_edit(db, vu.vendor_id, order_id, "header")
    changes = body.model_dump(exclude_unset=True)
    await _assert_order_refs(db, vu.vendor_id, changes, company_id=order.company_id)
    for k, v in changes.items():
        setattr(order, k, v)
    for ln in order.cost_lines:
        _order_line_amounts(ln)
    await _commit(db)
    r2 = await db.execute(
        select(CoManufacturingOrder)
        .options(*_mo_load_options())
        .where(CoManufacturingOrder.id == order_id)
    )
    return _order_to_out(r2.scalar_one())


@router.post("/manufacturing-orders/{order_id}/cost-lines", response_model=ManufacturingOrderOut)
async def add_order_cost_line(
    order_id: UUID,
    body: OrderCostLineCreate,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    order = await _load_order_for_edit(db, vu.vendor_id, order_id, "cost lines")
    await _assert_line_refs(
        db, vu.vendor_id,
        products=[body.product_id],
        activity_types=[body.activity_type_id],
        pools=[body.overhead_pool_id],
    )
    ln = CoOrderCostLine(
        category=body.category,
        description=body.description,
        product_id=body.product_id,
        activity_type_id=body.activity_type_id,
        overhead_pool_id=body.overhead_pool_id,
        uom=body.uom,
        qty_planned=body.qty_planned,
        qty_actual=body.qty_actual,
        rate_planned=body.rate_planned,
        rate_actual=body.rate_actual,
        amount_planned=body.amount_planned,
        amount_actual=body.amount_actual,
        sequence=body.sequence,
    )
    _order_line_amounts(ln)
    order.cost_lines.append(ln)
    await _commit(db)
    r2 = await db.execute(
        select(CoManufacturingOrder)
        .options(*_mo_load_options())
        .where(CoManufacturingOrder.id == order_id)
    )
    return _order_to_out(r2.scalar_one())


@router.post("/manufacturing-orders/{order_id}/refresh-planned-from-standard", response_model=ManufacturingOrderOut)
async def refresh_order_planned_from_standard(
    order_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    order = await _load_order_for_edit(db, vu.vendor_id, order_id, "planned costs")
    if not order.product_id:
        raise HTTPException(status_code=400, detail="Order has no product_id")
    q_planned = Decimal(str(order.qty_planned or 0))
    r2 = await db.execute(
        select(CoProductCostVersion)
        .options(selectinload(CoProductCostVersion.lines))
        .where(
            CoProductCostVersion.vendor_id == vu.vendor_id,
            CoProductCostVersion.company_id == order.company_id,
            CoProductCostVersion.product_id == order.product_id,
            CoProductCostVersion.status == "active",
        )
        .order_by(CoProductCostVersion.valid_from.desc())
        .limit(1)
    )
    ver = r2.scalar_one_or_none()
    if not ver:
        raise HTTPException(status_code=400, detail="No active product cost version for this product")

    await db.execute(delete(CoOrderCostLine).where(CoOrderCostLine.order_id == order_id))
    order.cost_lines.clear()
    await db.flush()
    order.standard_cost_version_id = ver.id

    seq = 0
    for pl in ver.lines:
        qty_p = Decimal(str(pl.qty_per_output_unit or 0)) * q_planned
        rate_p = Decimal(str(pl.unit_rate_planned or 0))
        cat = (pl.line_type or "other").lower()
        if cat in ("direct_overhead", "indirect_overhead"):
            cat = "overhead"
        if cat not in ("material", "activity", "overhead"):
            cat = "other"
        ln = CoOrderCostLine(
            category=cat,
            description=pl.description or f"{pl.line_type} from standard",
            product_id=pl.component_product_id,
            activity_type_id=pl.activity_type_id,
            overhead_pool_id=pl.overhead_pool_id,
            uom="EA" if cat == "material" else "H",
            qty_planned=qty_p,
            qty_actual=Decimal("0"),
            rate_planned=rate_p,
            rate_actual=Decimal("0"),
            amount_planned=_line_amount(qty_p, rate_p),
            amount_actual=Decimal("0"),
            sequence=seq,
        )
        order.cost_lines.append(ln)
        seq += 1
    await _commit(db)
    r3 = await db.execute(
        select(CoManufacturingOrder)
        .options(*_mo_load_options())
        .where(CoManufacturingOrder.id == order_id)
    )
    return _order_to_out(r3.scalar_one())


@router.get("/manufacturing-orders/{order_id}/variance", response_model=OrderVarianceOut)
async def get_order_variance(
    order_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(CoManufacturingOrder)
        .options(selectinload(CoManufacturingOrder.cost_lines))
        .where(
            CoManufacturingOrder.id == order_id,
            CoManufacturingOrder.vendor_id == vu.vendor_id,
        )
    )
    order = r.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Not found")
    by_cat: dict[str, dict[str, Decimal]] = {}
    planned_total = actual_total = Decimal("0")
    for ln in order.cost_lines:
        _order_line_amounts(ln)
        cat = ln.category or "other"
        if cat not in by_cat:
            by_cat[cat] = {"planned": Decimal("0"), "actual": Decimal("0")}
        ap = Decimal(str(ln.amount_planned or 0))
        aa = Decimal(str(ln.amount_actual or 0))
        by_cat[cat]["planned"] += ap
        by_cat[cat]["actual"] += aa
        planned_total += ap
        actual_total += aa
    return OrderVarianceOut(
        order_id=order.id,
        order_no=order.order_no,
        planned_total=planned_total,
        actual_total=actual_total,
        variance=actual_total - planned_total,
        by_category=by_cat,
    )


@router.get("/manufacturing-orders/{order_id}/variance-detailed", response_model=OrderVarianceDetailedOut)
async def get_order_variance_detailed(
    order_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(CoManufacturingOrder)
        .options(selectinload(CoManufacturingOrder.cost_lines))
        .where(
            CoManufacturingOrder.id == order_id,
            CoManufacturingOrder.vendor_id == vu.vendor_id,
        )
    )
    order = r.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Not found")
    by_cat: dict[str, dict[str, Decimal]] = {}
    planned_total = actual_total = Decimal("0")
    line_details: List[VarianceLineDetail] = []
    price_tot = usage_tot = Decimal("0")
    for ln in order.cost_lines:
        vd = _variance_line_detail(ln)
        line_details.append(vd)
        price_tot += vd.price_variance
        usage_tot += vd.usage_variance
        cat = ln.category or "other"
        if cat not in by_cat:
            by_cat[cat] = {"planned": Decimal("0"), "actual": Decimal("0")}
        by_cat[cat]["planned"] += vd.amount_planned
        by_cat[cat]["actual"] += vd.amount_actual
        planned_total += vd.amount_planned
        actual_total += vd.amount_actual
    return OrderVarianceDetailedOut(
        order_id=order.id,
        order_no=order.order_no,
        planned_total=planned_total,
        actual_total=actual_total,
        variance=actual_total - planned_total,
        by_category=by_cat,
        price_variance_total=price_tot,
        usage_variance_total=usage_tot,
        lines=line_details,
    )


@router.patch("/manufacturing-orders/{order_id}/cost-lines/{line_id}", response_model=ManufacturingOrderOut)
async def patch_order_cost_line(
    order_id: UUID,
    line_id: UUID,
    body: OrderCostLinePatch,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    order = await _load_order_for_edit(db, vu.vendor_id, order_id, "cost lines")
    ln = next((x for x in order.cost_lines if x.id == line_id), None)
    if not ln:
        raise HTTPException(status_code=404, detail="Cost line not found")
    changes = body.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(ln, k, v)
    # An amount typed without qty / rate becomes qty 1 x rate = amount, so the stored qty x rate
    # (which is authoritative whenever both are set) cannot silently override what the user entered.
    if "amount_planned" in changes and not ({"qty_planned", "rate_planned"} & set(changes)):
        ln.qty_planned, ln.rate_planned = Decimal("1"), Decimal(str(changes["amount_planned"] or 0))
    if "amount_actual" in changes and not ({"qty_actual", "rate_actual"} & set(changes)):
        ln.qty_actual, ln.rate_actual = Decimal("1"), Decimal(str(changes["amount_actual"] or 0))
    _order_line_amounts(ln)
    await _commit(db)
    r2 = await db.execute(
        select(CoManufacturingOrder)
        .options(*_mo_load_options())
        .where(CoManufacturingOrder.id == order_id)
    )
    return _order_to_out(r2.scalar_one())


@router.post("/manufacturing-orders/{order_id}/operations", response_model=ManufacturingOrderOut, status_code=201)
async def create_order_operation(
    order_id: UUID,
    body: OrderOperationCreate,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    await _load_order_for_edit(db, vu.vendor_id, order_id, "operations")
    await _assert_owned(db, vu.vendor_id, CoActivityType, [body.activity_type_id], "Activity type")
    await _assert_owned(db, vu.vendor_id, CoWorkCenter, [body.work_center_id], "Work center")
    op = CoOrderOperation(
        order_id=order_id,
        sequence=body.sequence,
        operation_code=body.operation_code,
        name=body.name,
        activity_type_id=body.activity_type_id,
        work_center_id=body.work_center_id,
        planned_qty=body.planned_qty,
        confirmed_qty=body.confirmed_qty,
        scrap_qty=body.scrap_qty,
        planned_hours=body.planned_hours,
        actual_hours=body.actual_hours,
        planned_rate=body.planned_rate,
        actual_rate=body.actual_rate,
        status=body.status,
        source=body.source,
        notes=body.notes,
    )
    db.add(op)
    await _commit(db)
    r2 = await db.execute(
        select(CoManufacturingOrder)
        .options(*_mo_load_options())
        .where(CoManufacturingOrder.id == order_id)
    )
    return _order_to_out(r2.scalar_one())


@router.patch("/manufacturing-orders/{order_id}/operations/{op_id}", response_model=ManufacturingOrderOut)
async def update_order_operation(
    order_id: UUID,
    op_id: UUID,
    body: OrderOperationUpdate,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    await _load_order_for_edit(db, vu.vendor_id, order_id, "operations")
    r = await db.execute(
        select(CoOrderOperation)
        .join(CoManufacturingOrder, CoOrderOperation.order_id == CoManufacturingOrder.id)
        .where(
            CoOrderOperation.id == op_id,
            CoOrderOperation.order_id == order_id,
            CoManufacturingOrder.vendor_id == vu.vendor_id,
        )
    )
    op = r.scalar_one_or_none()
    if not op:
        raise HTTPException(status_code=404, detail="Operation not found")
    changes = body.model_dump(exclude_unset=True)
    await _assert_owned(db, vu.vendor_id, CoActivityType, [changes.get("activity_type_id")], "Activity type")
    await _assert_owned(db, vu.vendor_id, CoWorkCenter, [changes.get("work_center_id")], "Work center")
    for k, v in changes.items():
        setattr(op, k, v)
    await _commit(db)
    r2 = await db.execute(
        select(CoManufacturingOrder)
        .options(*_mo_load_options())
        .where(CoManufacturingOrder.id == order_id)
    )
    return _order_to_out(r2.scalar_one())


@router.delete("/manufacturing-orders/{order_id}/operations/{op_id}", response_model=ManufacturingOrderOut)
async def delete_order_operation(
    order_id: UUID,
    op_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    await _load_order_for_edit(db, vu.vendor_id, order_id, "operations")
    r = await db.execute(
        select(CoOrderOperation)
        .join(CoManufacturingOrder, CoOrderOperation.order_id == CoManufacturingOrder.id)
        .where(
            CoOrderOperation.id == op_id,
            CoOrderOperation.order_id == order_id,
            CoManufacturingOrder.vendor_id == vu.vendor_id,
        )
    )
    op = r.scalar_one_or_none()
    if not op:
        raise HTTPException(status_code=404, detail="Operation not found")
    await db.execute(delete(CoOrderOperation).where(CoOrderOperation.id == op_id))
    await _commit(db)
    r2 = await db.execute(
        select(CoManufacturingOrder)
        .options(*_mo_load_options())
        .where(CoManufacturingOrder.id == order_id)
    )
    return _order_to_out(r2.scalar_one())


@router.post("/manufacturing-orders/{order_id}/operations/generate-from-standard", response_model=ManufacturingOrderOut)
async def generate_operations_from_standard(
    order_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    order = await _load_order_for_edit(db, vu.vendor_id, order_id, "operations")
    if not order.product_id:
        raise HTTPException(status_code=400, detail="Order has no product_id")
    q_ord = Decimal(str(order.qty_planned or 0))
    ver_id = order.standard_cost_version_id
    if ver_id:
        r2 = await db.execute(
            select(CoProductCostVersion)
            .options(selectinload(CoProductCostVersion.lines))
            .where(
                CoProductCostVersion.id == ver_id,
                CoProductCostVersion.vendor_id == vu.vendor_id,
            )
        )
    else:
        r2 = await db.execute(
            select(CoProductCostVersion)
            .options(selectinload(CoProductCostVersion.lines))
            .where(
                CoProductCostVersion.vendor_id == vu.vendor_id,
                CoProductCostVersion.company_id == order.company_id,
                CoProductCostVersion.product_id == order.product_id,
                CoProductCostVersion.status == "active",
            )
            .order_by(CoProductCostVersion.valid_from.desc())
            .limit(1)
        )
    ver = r2.scalar_one_or_none()
    if not ver:
        raise HTTPException(status_code=400, detail="No product cost version (set standard on order or activate one)")

    await db.execute(
        delete(CoOrderOperation).where(
            CoOrderOperation.order_id == order_id,
            CoOrderOperation.source == "from_standard",
        )
    )
    await db.flush()

    seq = 0
    for pl in sorted(ver.lines, key=lambda x: x.sequence or 0):
        if (pl.line_type or "").lower() != "activity" or not pl.activity_type_id:
            continue
        ph = Decimal(str(pl.qty_per_output_unit or 0)) * q_ord
        pr = Decimal(str(pl.unit_rate_planned or 0))
        op = CoOrderOperation(
            order_id=order_id,
            sequence=seq,
            name=pl.description or "Activity",
            activity_type_id=pl.activity_type_id,
            work_center_id=None,
            planned_qty=q_ord,
            planned_hours=ph,
            planned_rate=pr,
            actual_rate=pr,
            status="pending",
            source="from_standard",
        )
        db.add(op)
        seq += 1
    await _commit(db)
    r3 = await db.execute(
        select(CoManufacturingOrder)
        .options(*_mo_load_options())
        .where(CoManufacturingOrder.id == order_id)
    )
    return _order_to_out(r3.scalar_one())


@router.post("/manufacturing-orders/{order_id}/sync-activity-actuals-from-operations", response_model=ManufacturingOrderOut)
async def sync_activity_actuals_from_operations(
    order_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    order = await _load_order_for_edit(db, vu.vendor_id, order_id, "actuals")

    used_line_ids: Set[str] = set()
    for op in sorted(order.operations or [], key=lambda x: x.sequence or 0):
        if not op.activity_type_id:
            continue
        ah = Decimal(str(op.actual_hours or 0))
        ar = Decimal(str(op.actual_rate or 0)) or Decimal(str(op.planned_rate or 0))
        for ln in order.cost_lines:
            if (ln.category or "").lower() != "activity":
                continue
            if ln.activity_type_id != op.activity_type_id:
                continue
            sid = str(ln.id)
            if sid in used_line_ids:
                continue
            used_line_ids.add(sid)
            ln.qty_actual = ah
            ln.rate_actual = ar
            ln.amount_actual = _line_amount(ah, ar)
            break

    await _commit(db)
    r2 = await db.execute(
        select(CoManufacturingOrder)
        .options(*_mo_load_options())
        .where(CoManufacturingOrder.id == order_id)
    )
    return _order_to_out(r2.scalar_one())


@router.post("/manufacturing-orders/{order_id}/recalculate-overhead-actual", response_model=ManufacturingOrderOut)
async def recalculate_overhead_actual(
    order_id: UUID,
    as_of: Optional[date] = Query(None),
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    order = await _load_order_for_edit(db, vu.vendor_id, order_id, "actuals")
    d = as_of or date.today()

    mat_actual = mat_planned = Decimal("0")
    act_hours_actual = act_hours_planned = Decimal("0")
    dl_actual = dl_planned = Decimal("0")
    units = Decimal(str(order.qty_delivered or 0)) or Decimal(str(order.qty_planned or 0))

    for ln in order.cost_lines:
        _order_line_amounts(ln)
        cat = (ln.category or "").lower()
        if cat == "material":
            mat_actual += Decimal(str(ln.amount_actual or 0))
            mat_planned += Decimal(str(ln.amount_planned or 0))
        elif cat == "activity":
            act_hours_actual += Decimal(str(ln.qty_actual or 0))
            act_hours_planned += Decimal(str(ln.qty_planned or 0))
            dl_actual += Decimal(str(ln.amount_actual or 0))
            dl_planned += Decimal(str(ln.amount_planned or 0))

    pool_ids = {
        ln.overhead_pool_id
        for ln in order.cost_lines
        if (ln.category or "").lower() == "overhead" and ln.overhead_pool_id
    }
    pools_by_id: dict = {}
    if pool_ids:
        pools_by_id = {
            pl.id: pl
            for pl in (
                await db.execute(
                    select(CoOverheadPool).where(
                        CoOverheadPool.id.in_(pool_ids), CoOverheadPool.vendor_id == vu.vendor_id
                    )
                )
            ).scalars().all()
        }
    rate_cache: dict = {}

    for ln in order.cost_lines:
        if (ln.category or "").lower() != "overhead" or not ln.overhead_pool_id:
            continue
        pool = pools_by_id.get(ln.overhead_pool_id)
        if not pool:
            continue
        base = (pool.allocation_base or "labor_hours").lower()
        if base == "labor_hours":
            driver = act_hours_actual if act_hours_actual != 0 else act_hours_planned
        elif base == "machine_hours":
            driver = act_hours_actual if act_hours_actual != 0 else act_hours_planned
        elif base == "material_cost":
            driver = mat_actual if mat_actual != 0 else mat_planned
        elif base == "units_produced":
            driver = units
        elif base == "direct_labor_cost":
            driver = dl_actual if dl_actual != 0 else dl_planned
        else:
            driver = act_hours_actual if act_hours_actual != 0 else act_hours_planned
        if pool.id not in rate_cache:
            rate_cache[pool.id] = await _rate_for_pool_on_date(db, pool.id, d)
        rate = rate_cache[pool.id]
        ln.qty_actual = driver
        ln.rate_actual = rate
        ln.amount_actual = _line_amount(driver, rate)

    await _commit(db)
    r2 = await db.execute(
        select(CoManufacturingOrder)
        .options(*_mo_load_options())
        .where(CoManufacturingOrder.id == order_id)
    )
    return _order_to_out(r2.scalar_one())


@router.get("/wip-report", response_model=WipReportOut)
async def wip_report(
    company_id: Optional[UUID] = Query(None),
    group_by: str = Query("project", description="project | order_kind | status"),
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    open_statuses = ("draft", "released", "in_progress")
    q = (
        select(CoManufacturingOrder)
        .options(selectinload(CoManufacturingOrder.cost_lines))
        .where(
            CoManufacturingOrder.vendor_id == vu.vendor_id,
            CoManufacturingOrder.status.in_(open_statuses),
        )
    )
    if company_id:
        q = q.where(CoManufacturingOrder.company_id == company_id)
    r = await db.execute(q)
    orders = r.scalars().unique().all()

    groups_map: dict[str, dict[str, Any]] = {}

    def _key(o: CoManufacturingOrder) -> tuple[str, str]:
        if group_by == "order_kind":
            k = o.order_kind or "unknown"
            return k, k.replace("_", " ").title()
        if group_by == "status":
            k = o.status or "unknown"
            return k, k.replace("_", " ").title()
        # project
        if o.project_id:
            return str(o.project_id), f"Project {str(o.project_id)[:8]}…"
        return "_none", "No project / internal"

    for o in orders:
        p, a = _sum_order_planned_actual(o)
        gk, glabel = _key(o)
        if gk not in groups_map:
            groups_map[gk] = {
                "key": gk,
                "label": glabel,
                "open_orders": 0,
                "wip_planned": Decimal("0"),
                "wip_actual": Decimal("0"),
                "orders": [],
            }
        g = groups_map[gk]
        g["open_orders"] += 1
        g["wip_planned"] += p
        g["wip_actual"] += a
        g["orders"].append(
            {
                "order_id": str(o.id),
                "order_no": o.order_no,
                "title": o.title,
                "order_kind": o.order_kind,
                "status": o.status,
                "project_id": str(o.project_id) if o.project_id else None,
                "planned": str(p),
                "actual": str(a),
                "variance": str(a - p),
            }
        )

    groups = list(groups_map.values())
    for g in groups:
        g["wip_planned"] = str(g["wip_planned"])
        g["wip_actual"] = str(g["wip_actual"])

    return WipReportOut(company_id=company_id, group_by=group_by, groups=groups)


async def _build_wip_summary(
    db: AsyncSession, vendor_id: UUID, company_id: Optional[UUID]
) -> WipSummaryOut:
    open_statuses = ("draft", "released", "in_progress")
    q = (
        select(CoManufacturingOrder)
        .options(selectinload(CoManufacturingOrder.cost_lines))
        .where(
            CoManufacturingOrder.vendor_id == vendor_id,
            CoManufacturingOrder.status.in_(open_statuses),
        )
    )
    if company_id:
        q = q.where(CoManufacturingOrder.company_id == company_id)
    r = await db.execute(q)
    orders = r.scalars().unique().all()
    wip_planned = wip_actual = Decimal("0")
    detail: List[dict[str, Any]] = []
    for o in orders:
        p, a = _sum_order_planned_actual(o)
        wip_planned += p
        wip_actual += a
        detail.append(
            {
                "order_id": str(o.id),
                "order_no": o.order_no,
                "status": o.status,
                "order_kind": o.order_kind,
                "planned": str(p),
                "actual": str(a),
                "variance": str(a - p),
            }
        )
    return WipSummaryOut(
        company_id=company_id,
        open_orders=len(orders),
        wip_planned_value=wip_planned,
        wip_actual_cost=wip_actual,
        orders=detail,
    )


async def _wip_totals(
    db: AsyncSession, vendor_id: UUID, company_id: Optional[UUID]
) -> tuple[int, Decimal, Decimal]:
    """Open-order count and planned/actual WIP value via SQL aggregates (no per-order loading).

    Mirrors ``order_line_amounts``: a line with both qty and rate is valued at qty x rate,
    otherwise at its explicit amount.
    """
    open_statuses = ("draft", "released", "in_progress")

    def _value(qty, rate, amount):
        return case((and_(qty != 0, rate != 0), func.round(qty * rate, 4)), else_=amount)

    lines_q = (
        select(
            func.coalesce(func.sum(_value(CoOrderCostLine.qty_planned, CoOrderCostLine.rate_planned, CoOrderCostLine.amount_planned)), 0),
            func.coalesce(func.sum(_value(CoOrderCostLine.qty_actual, CoOrderCostLine.rate_actual, CoOrderCostLine.amount_actual)), 0),
        )
        .join(CoManufacturingOrder, CoManufacturingOrder.id == CoOrderCostLine.order_id)
        .where(CoManufacturingOrder.vendor_id == vendor_id, CoManufacturingOrder.status.in_(open_statuses))
    )
    count_q = select(func.count()).select_from(CoManufacturingOrder).where(
        CoManufacturingOrder.vendor_id == vendor_id, CoManufacturingOrder.status.in_(open_statuses)
    )
    if company_id:
        lines_q = lines_q.where(CoManufacturingOrder.company_id == company_id)
        count_q = count_q.where(CoManufacturingOrder.company_id == company_id)
    planned, actual = (await db.execute(lines_q)).one()
    open_count = (await db.execute(count_q)).scalar() or 0
    return int(open_count), Decimal(str(planned or 0)), Decimal(str(actual or 0))


@router.get("/wip-summary", response_model=WipSummaryOut)
async def wip_summary(
    company_id: Optional[UUID] = Query(None),
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    return await _build_wip_summary(db, vu.vendor_id, company_id)


@router.get("/dashboard", response_model=dict)
async def controlling_dashboard(
    company_id: Optional[UUID] = Query(None),
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    """Aggregate counts for controlling home."""
    qv = select(func.count()).select_from(CoProductCostVersion).where(
        CoProductCostVersion.vendor_id == vu.vendor_id,
        CoProductCostVersion.status == "active",
    )
    qo = select(func.count()).select_from(CoManufacturingOrder).where(
        CoManufacturingOrder.vendor_id == vu.vendor_id,
    )
    if company_id:
        qv = qv.where(CoProductCostVersion.company_id == company_id)
        qo = qo.where(CoManufacturingOrder.company_id == company_id)
    active_costs = (await db.execute(qv)).scalar() or 0
    total_orders = (await db.execute(qo)).scalar() or 0
    wip_open, wip_planned, wip_actual = await _wip_totals(db, vu.vendor_id, company_id)
    return {
        "active_standard_costs": active_costs,
        "manufacturing_orders": total_orders,
        "wip_open_orders": wip_open,
        "wip_planned_value": str(wip_planned),
        "wip_actual_cost": str(wip_actual),
    }


# ── Order status transitions ──────────────────────────────────────────────────

_VALID_TRANSITIONS: dict[str, Set[str]] = {
    "draft": {"released", "cancelled"},
    "released": {"in_progress", "cancelled"},
    "in_progress": {"completed", "cancelled"},
    "completed": {"closed"},
    "closed": set(),
    "cancelled": set(),
}


@router.post("/manufacturing-orders/{order_id}/transition", response_model=ManufacturingOrderOut)
async def transition_order_status(
    order_id: UUID,
    body: OrderStatusTransitionIn,
    vu: VendorUser = Depends(require_permission("finance.edit")),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(CoManufacturingOrder)
        .options(
            selectinload(CoManufacturingOrder.cost_lines),
            selectinload(CoManufacturingOrder.operations),
            selectinload(CoManufacturingOrder.cost_bookings),
        )
        .where(CoManufacturingOrder.id == order_id, CoManufacturingOrder.vendor_id == vu.vendor_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    order = r.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    current = order.status or "draft"
    if (order.ref_doc_type or "") == "production_order":
        raise HTTPException(
            status_code=409,
            detail="This order mirrors a Production order; its status is managed by the Production module.",
        )
    allowed = _VALID_TRANSITIONS.get(current, set())
    if body.status not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"Cannot transition from '{current}' to '{body.status}'. Allowed: {sorted(allowed)}",
        )
    if body.status == "cancelled":
        has_live_docs = (
            order.production_completion_journal_id is not None
            or any((b.status or "posted") == "posted" for b in order.cost_bookings)
            or (
                await db.execute(
                    select(CoGoodsMovement.id).where(
                        CoGoodsMovement.order_id == order.id, CoGoodsMovement.status == "posted"
                    ).limit(1)
                )
            ).first()
            is not None
            or (
                await db.execute(
                    select(CoActivityConfirmation.id).where(
                        CoActivityConfirmation.order_id == order.id, CoActivityConfirmation.status == "posted"
                    ).limit(1)
                )
            ).first()
            is not None
        )
        if has_live_docs:
            raise HTTPException(
                status_code=409,
                detail="Order has posted goods movements, confirmations or settlements. Reverse them before cancelling.",
            )

    order.status = body.status
    if body.notes:
        order.notes = (order.notes or "") + f"\n[{body.status.upper()}] {body.notes}"
    if body.status == "released":
        order.released_at = datetime.now(timezone.utc)
    elif body.status == "completed":
        order.completed_at = datetime.now(timezone.utc)
    await _commit(db)
    r2 = await db.execute(
        select(CoManufacturingOrder)
        .options(*_mo_load_options())
        .where(CoManufacturingOrder.id == order_id)
        .execution_options(populate_existing=True)
    )
    return _order_to_out(r2.scalar_one())


# ── Activity Confirmations ────────────────────────────────────────────────────

@router.get("/activity-confirmations", response_model=List[ActivityConfirmationOut])
async def list_activity_confirmations(
    company_id: Optional[UUID] = Query(None),
    order_id: Optional[UUID] = Query(None),
    confirmation_type: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    limit: int = Query(500, ge=1, le=2000, description="Max rows returned"),
    offset: int = Query(0, ge=0),
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    q = select(CoActivityConfirmation).where(CoActivityConfirmation.vendor_id == vu.vendor_id)
    if company_id:
        q = q.where(CoActivityConfirmation.company_id == company_id)
    if order_id:
        q = q.where(CoActivityConfirmation.order_id == order_id)
    if confirmation_type:
        q = q.where(CoActivityConfirmation.confirmation_type == confirmation_type)
    if from_date:
        q = q.where(CoActivityConfirmation.confirmation_date >= from_date)
    if to_date:
        q = q.where(CoActivityConfirmation.confirmation_date <= to_date)
    q = q.order_by(CoActivityConfirmation.confirmation_date.desc(), CoActivityConfirmation.id).limit(limit).offset(offset)
    rows = (await db.execute(q)).scalars().all()
    return [ActivityConfirmationOut.model_validate(r) for r in rows]


@router.post("/activity-confirmations", response_model=ActivityConfirmationOut)
async def create_activity_confirmation(
    body: ActivityConfirmationCreate,
    vu: VendorUser = Depends(require_permission("finance.edit")),
    db: AsyncSession = Depends(get_db),
):
    await _require_company(db, vu.vendor_id, body.company_id)
    await _get_owned_order(db, vu.vendor_id, body.order_id, body.company_id)
    await _assert_owned(db, vu.vendor_id, CoActivityType, [body.activity_type_id], "Activity type")
    await _assert_owned(db, vu.vendor_id, FinCostCenter, [body.cost_center_id], "Cost center")
    if body.operation_id:
        op_ok = (
            await db.execute(
                select(CoOrderOperation.id).where(
                    CoOrderOperation.id == body.operation_id, CoOrderOperation.order_id == body.order_id
                )
            )
        ).first()
        if not op_ok:
            raise HTTPException(status_code=404, detail="Operation not found on this order")
    try:
        conf = await co_movements.create_confirmation(
            db, vu.vendor_id,
            order_id=body.order_id, operation_id=body.operation_id,
            activity_type_id=body.activity_type_id, cost_center_id=body.cost_center_id,
            confirmation_date=body.confirmation_date, confirmation_type=body.confirmation_type,
            qty_confirmed=body.qty_confirmed, hours_confirmed=body.hours_confirmed,
            rate_per_hour=body.rate_per_hour, scrap_qty=body.scrap_qty, yield_pct=body.yield_pct,
            narration=body.narration, extra=body.extra, actor_id=vu.id,
        )
    except (ValueError, BudgetExceededError) as exc:
        await db.rollback()
        raise _co_error(exc) from exc
    await _commit(db)
    await db.refresh(conf)
    return ActivityConfirmationOut.model_validate(conf)


async def _get_owned_confirmation(db: AsyncSession, vendor_id: UUID, conf_id: UUID) -> CoActivityConfirmation:
    conf = (
        await db.execute(
            select(CoActivityConfirmation).where(
                CoActivityConfirmation.id == conf_id, CoActivityConfirmation.vendor_id == vendor_id
            )
        )
    ).scalar_one_or_none()
    if not conf:
        raise HTTPException(status_code=404, detail="Confirmation not found")
    return conf


@router.patch("/activity-confirmations/{conf_id}", response_model=ActivityConfirmationOut)
async def update_activity_confirmation(
    conf_id: UUID,
    body: ActivityConfirmationUpdate,
    vu: VendorUser = Depends(require_permission("finance.edit")),
    db: AsyncSession = Depends(get_db),
):
    conf = await _get_owned_confirmation(db, vu.vendor_id, conf_id)
    changes = body.model_dump(exclude_unset=True)
    new_status = changes.pop("status", None)
    try:
        if new_status == "posted" and conf.status != "posted":
            raise StateError("A reversed confirmation cannot be re-posted — enter a new one")
        if changes:
            await co_movements.update_confirmation(db, vu.vendor_id, conf, changes, vu.id)
        if new_status == "reversed" and conf.status != "reversed":
            await co_movements.reverse_confirmation(db, vu.vendor_id, conf, vu.id, "reversed via update")
    except (ValueError, BudgetExceededError) as exc:
        await db.rollback()
        raise _co_error(exc) from exc
    await _commit(db)
    await db.refresh(conf)
    return ActivityConfirmationOut.model_validate(conf)


@router.delete("/activity-confirmations/{conf_id}", status_code=204)
async def delete_activity_confirmation(
    conf_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.edit")),
    db: AsyncSession = Depends(get_db),
):
    """Undo a confirmation: hours, quantity and cost are taken back off the operation / cost line.

    A confirmation that was journalled is kept (status ``reversed``) so the audit trail survives;
    an un-journalled one is deleted."""
    conf = await _get_owned_confirmation(db, vu.vendor_id, conf_id)
    try:
        await co_movements.reverse_confirmation(db, vu.vendor_id, conf, vu.id, "deleted")
    except (ValueError, BudgetExceededError) as exc:
        await db.rollback()
        raise _co_error(exc) from exc
    await _commit(db)


# ── Goods Movements ───────────────────────────────────────────────────────────

_MOVEMENT_LABELS = co_movements.MOVEMENT_LABELS


@router.get("/goods-movements", response_model=List[GoodsMovementOut])
async def list_goods_movements(
    company_id: Optional[UUID] = Query(None),
    order_id: Optional[UUID] = Query(None),
    movement_type: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    limit: int = Query(500, ge=1, le=2000, description="Max rows returned"),
    offset: int = Query(0, ge=0),
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    q = select(CoGoodsMovement).where(CoGoodsMovement.vendor_id == vu.vendor_id)
    if company_id:
        q = q.where(CoGoodsMovement.company_id == company_id)
    if order_id:
        q = q.where(CoGoodsMovement.order_id == order_id)
    if movement_type:
        q = q.where(CoGoodsMovement.movement_type == movement_type)
    if from_date:
        q = q.where(CoGoodsMovement.posting_date >= from_date)
    if to_date:
        q = q.where(CoGoodsMovement.posting_date <= to_date)
    q = q.order_by(CoGoodsMovement.posting_date.desc(), CoGoodsMovement.document_no.desc(), CoGoodsMovement.id)
    q = q.limit(limit).offset(offset)
    rows = (await db.execute(q)).scalars().all()
    return [GoodsMovementOut.model_validate(r) for r in rows]


@router.post("/goods-movements", response_model=GoodsMovementOut)
async def create_goods_movement(
    body: GoodsMovementCreate,
    vu: VendorUser = Depends(require_permission("finance.edit")),
    db: AsyncSession = Depends(get_db),
):
    await _require_company(db, vu.vendor_id, body.company_id)
    await _get_owned_order(db, vu.vendor_id, body.order_id, body.company_id)
    await _assert_owned(db, vu.vendor_id, Product, [body.product_id], "Product")
    await _assert_owned(db, vu.vendor_id, FinCostCenter, [body.cost_center_id], "Cost center")
    try:
        gm = await co_movements.create_goods_movement(
            db, vu.vendor_id,
            order_id=body.order_id, movement_type=body.movement_type, posting_date=body.posting_date,
            product_id=body.product_id, qty=body.qty, unit_cost=body.unit_cost, actor_id=vu.id,
            description=body.description, uom=body.uom, cost_center_id=body.cost_center_id,
            storage_location=body.storage_location, batch_no=body.batch_no, extra=body.extra,
        )
    except (ValueError, BudgetExceededError) as exc:
        await db.rollback()
        raise _co_error(exc) from exc
    await _commit(db)
    await db.refresh(gm)
    return GoodsMovementOut.model_validate(gm)


@router.post("/goods-movements/{gm_id}/reverse", response_model=GoodsMovementOut)
async def reverse_goods_movement(
    gm_id: UUID,
    reason: str = Body(..., embed=True),
    vu: VendorUser = Depends(require_permission("finance.edit")),
    db: AsyncSession = Depends(get_db),
):
    """Reverse a movement with a counter-document; returns the original (now ``reversed``)."""
    r = await db.execute(
        select(CoGoodsMovement).where(
            CoGoodsMovement.id == gm_id,
            CoGoodsMovement.vendor_id == vu.vendor_id,
        )
    )
    gm = r.scalar_one_or_none()
    if not gm:
        raise HTTPException(status_code=404, detail="Goods movement not found")
    try:
        await co_movements.reverse_goods_movement(db, vu.vendor_id, gm, reason, vu.id)
    except (ValueError, BudgetExceededError) as exc:
        await db.rollback()
        raise _co_error(exc) from exc
    await _commit(db)
    await db.refresh(gm)
    return GoodsMovementOut.model_validate(gm)


# ── Cost Allocations ──────────────────────────────────────────────────────────

@router.get("/cost-allocations", response_model=List[CostAllocationOut])
async def list_cost_allocations(
    company_id: Optional[UUID] = Query(None),
    period_year: Optional[int] = Query(None),
    period_month: Optional[int] = Query(None),
    allocation_cycle: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(500, ge=1, le=2000, description="Max rows returned"),
    offset: int = Query(0, ge=0),
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    q = select(CoCostAllocation).where(CoCostAllocation.vendor_id == vu.vendor_id)
    if company_id:
        q = q.where(CoCostAllocation.company_id == company_id)
    if period_year:
        q = q.where(CoCostAllocation.period_year == period_year)
    if period_month:
        q = q.where(CoCostAllocation.period_month == period_month)
    if allocation_cycle:
        q = q.where(CoCostAllocation.allocation_cycle == allocation_cycle)
    if status:
        q = q.where(CoCostAllocation.status == status)
    q = q.order_by(CoCostAllocation.period_year.desc(), CoCostAllocation.period_month.desc(), CoCostAllocation.id)
    q = q.limit(limit).offset(offset)
    rows = (await db.execute(q)).scalars().all()
    return [CostAllocationOut.model_validate(r) for r in rows]


@router.post("/cost-allocations", response_model=CostAllocationOut)
async def create_cost_allocation(
    body: CostAllocationCreate,
    vu: VendorUser = Depends(require_permission("finance.edit")),
    db: AsyncSession = Depends(get_db),
):
    await _require_company(db, vu.vendor_id, body.company_id)
    await _assert_owned(
        db, vu.vendor_id, FinCostCenter,
        [body.sender_cost_center_id, body.receiver_cost_center_id], "Cost center",
    )
    await _assert_owned(
        db, vu.vendor_id, FinAccount, [body.sender_account_id, body.receiver_account_id], "GL account",
    )
    if body.receiver_order_id:
        await _get_owned_order(db, vu.vendor_id, body.receiver_order_id, body.company_id)
    alloc = CoCostAllocation(
        id=uuid.uuid4(),
        vendor_id=vu.vendor_id,
        company_id=body.company_id,
        period_year=body.period_year,
        period_month=body.period_month,
        allocation_cycle=body.allocation_cycle,
        sender_cost_center_id=body.sender_cost_center_id,
        receiver_cost_center_id=body.receiver_cost_center_id,
        receiver_order_id=body.receiver_order_id,
        sender_account_id=body.sender_account_id,
        receiver_account_id=body.receiver_account_id,
        allocation_method=body.allocation_method,
        allocation_value=body.allocation_value,
        allocated_amount=body.allocated_amount,
        narration=body.narration,
        extra=body.extra or {},
    )
    db.add(alloc)
    await _commit(db)
    await db.refresh(alloc)
    return CostAllocationOut.model_validate(alloc)


@router.post("/cost-allocations/{alloc_id}/post", response_model=CostAllocationOut)
async def post_cost_allocation(
    alloc_id: UUID,
    body: CostAllocationPostIn,
    vu: VendorUser = Depends(require_permission("finance.journal.post")),
    db: AsyncSession = Depends(get_db),
):
    alloc = (
        await db.execute(
            select(CoCostAllocation)
            .where(CoCostAllocation.id == alloc_id, CoCostAllocation.vendor_id == vu.vendor_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if not alloc:
        raise HTTPException(status_code=404, detail="Cost allocation not found")
    if alloc.status == "posted":
        raise HTTPException(status_code=409, detail="Already posted")
    if alloc.status == "reversed":
        raise HTTPException(status_code=409, detail="A reversed allocation cannot be re-posted — create a new one")

    amount = Decimal(str(alloc.allocated_amount or 0)).quantize(Decimal("0.0001"))
    if amount <= 0:
        raise HTTPException(status_code=422, detail="Allocated amount must be greater than zero")
    if not alloc.sender_account_id or not alloc.receiver_account_id:
        raise HTTPException(
            status_code=422,
            detail="Select the sender and receiver GL accounts before posting the allocation",
        )
    entry_date = body.entry_date or date.today()
    try:
        await check_period_open(db, vu.vendor_id, entry_date, alloc.company_id)
        from app.services.finance.posting import post_event

        receiver_order = None
        if alloc.receiver_order_id:
            receiver_order = await _get_owned_order(db, vu.vendor_id, alloc.receiver_order_id)
            if (receiver_order.status or "draft") in ("closed", "cancelled"):
                raise StateError(f"Receiver order {receiver_order.order_no} is {receiver_order.status}")
        label = f"Cost allocation {alloc.allocation_cycle or ''} {alloc.period_year}/{alloc.period_month:02d}".strip()
        je = await post_event(
            db, vu.vendor_id, "co_cost_booking", alloc.id,
            {
                "company_id": alloc.company_id,
                "entry_date": entry_date.isoformat(),
                "document_type": "CO",
                "narration": alloc.narration or label,
                "reference": f"ALLOC-{alloc.id}",
                "ref_doc_type": "co_cost_allocation",
                "ref_doc_id": str(alloc.id),
                "lines": [
                    {
                        "account_id": str(alloc.receiver_account_id), "debit": str(amount), "credit": "0",
                        "narration": f"{label} - receiver",
                        "cost_center_id": str(alloc.receiver_cost_center_id) if alloc.receiver_cost_center_id else None,
                        "project_id": str(receiver_order.project_id) if receiver_order and receiver_order.project_id else None,
                    },
                    {
                        "account_id": str(alloc.sender_account_id), "debit": "0", "credit": str(amount),
                        "narration": f"{label} - sender",
                        "cost_center_id": str(alloc.sender_cost_center_id) if alloc.sender_cost_center_id else None,
                    },
                ],
            },
            created_by_id=vu.id,
        )
        if not je:
            raise ValueError("Journal posting failed — check the GL accounts and period")
    except (ValueError, StateError) as exc:
        await db.rollback()
        raise _co_error(exc) from exc

    alloc.journal_entry_id = je.id
    alloc.status = "posted"
    alloc.posting_date = entry_date
    await _commit(db)
    await db.refresh(alloc)
    return CostAllocationOut.model_validate(alloc)


@router.post("/cost-allocations/{alloc_id}/reverse", response_model=CostAllocationOut)
async def reverse_cost_allocation(
    alloc_id: UUID,
    body: CoSettlementReverseIn,
    vu: VendorUser = Depends(require_permission("finance.journal.post")),
    db: AsyncSession = Depends(get_db),
):
    """Reverse a posted allocation: its journal is voided / reversed and the allocation marked reversed."""
    alloc = (
        await db.execute(
            select(CoCostAllocation)
            .where(CoCostAllocation.id == alloc_id, CoCostAllocation.vendor_id == vu.vendor_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if not alloc:
        raise HTTPException(status_code=404, detail="Cost allocation not found")
    if alloc.status != "posted":
        raise HTTPException(status_code=409, detail=f"Only posted allocations can be reversed (status: {alloc.status})")
    try:
        await check_period_open(db, vu.vendor_id, date.today(), alloc.company_id)
        await reverse_journal(db, vu.vendor_id, alloc.journal_entry_id, vu.id)
    except ValueError as exc:
        await db.rollback()
        raise _co_error(exc) from exc
    alloc.status = "reversed"
    alloc.extra = {**(alloc.extra or {}), "reversal_reason": body.reason}
    await _commit(db)
    await db.refresh(alloc)
    return CostAllocationOut.model_validate(alloc)


@router.delete("/cost-allocations/{alloc_id}", status_code=204)
async def delete_cost_allocation(
    alloc_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.edit")),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(CoCostAllocation).where(
            CoCostAllocation.id == alloc_id,
            CoCostAllocation.vendor_id == vu.vendor_id,
        )
    )
    alloc = r.scalar_one_or_none()
    if not alloc:
        raise HTTPException(status_code=404, detail="Cost allocation not found")
    if alloc.status == "posted":
        raise HTTPException(status_code=409, detail="Cannot delete a posted allocation; reverse it instead")
    await db.delete(alloc)
    await _commit(db)


# ── Budget Lines ──────────────────────────────────────────────────────────────

async def _assert_budget_editable(db: AsyncSession, vendor_id: UUID, order_id: UUID) -> CoManufacturingOrder:
    """Budgets may be revised while an order runs; not once it is closed / cancelled or mirrors Production."""
    order = await _get_owned_order(db, vendor_id, order_id)
    if (order.ref_doc_type or "") == "production_order" or (order.status or "draft") in ("closed", "cancelled"):
        raise HTTPException(
            status_code=409,
            detail=f"Order {order.order_no} is {order.status}"
            + (" and mirrors a Production order" if (order.ref_doc_type or "") == "production_order" else "")
            + "; its budget can no longer be changed.",
        )
    return order


@router.get("/manufacturing-orders/{order_id}/budget-lines", response_model=List[BudgetLineOut])
async def list_budget_lines(
    order_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    q = select(CoBudgetLine).where(
        CoBudgetLine.order_id == order_id,
        CoBudgetLine.vendor_id == vu.vendor_id,
    ).order_by(CoBudgetLine.category)
    rows = (await db.execute(q)).scalars().all()
    return [BudgetLineOut.model_validate(r) for r in rows]


@router.post("/manufacturing-orders/{order_id}/budget-lines", response_model=BudgetLineOut)
async def create_budget_line(
    order_id: UUID,
    body: BudgetLineCreate,
    vu: VendorUser = Depends(require_permission("finance.edit")),
    db: AsyncSession = Depends(get_db),
):
    order = await _assert_budget_editable(db, vu.vendor_id, order_id)
    if order.company_id != body.company_id:
        raise HTTPException(status_code=400, detail="Order belongs to a different business unit")

    bl = CoBudgetLine(
        id=uuid.uuid4(),
        vendor_id=vu.vendor_id,
        company_id=order.company_id,
        order_id=order_id,
        budget_type=body.budget_type,
        category=body.category,
        description=body.description,
        fiscal_year=body.fiscal_year,
        period_month=body.period_month,
        amount_budgeted=body.amount_budgeted,
        currency=body.currency,
        notes=body.notes,
    )
    db.add(bl)
    await _commit(db)
    await db.refresh(bl)
    return BudgetLineOut.model_validate(bl)


@router.patch("/manufacturing-orders/{order_id}/budget-lines/{bl_id}", response_model=BudgetLineOut)
async def update_budget_line(
    order_id: UUID,
    bl_id: UUID,
    body: BudgetLineUpdate,
    vu: VendorUser = Depends(require_permission("finance.edit")),
    db: AsyncSession = Depends(get_db),
):
    await _assert_budget_editable(db, vu.vendor_id, order_id)
    r = await db.execute(
        select(CoBudgetLine).where(
            CoBudgetLine.id == bl_id,
            CoBudgetLine.order_id == order_id,
            CoBudgetLine.vendor_id == vu.vendor_id,
        )
    )
    bl = r.scalar_one_or_none()
    if not bl:
        raise HTTPException(status_code=404, detail="Budget line not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(bl, field, val)
    await _commit(db)
    await db.refresh(bl)
    return BudgetLineOut.model_validate(bl)


@router.delete("/manufacturing-orders/{order_id}/budget-lines/{bl_id}", status_code=204)
async def delete_budget_line(
    order_id: UUID,
    bl_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.edit")),
    db: AsyncSession = Depends(get_db),
):
    await _assert_budget_editable(db, vu.vendor_id, order_id)
    r = await db.execute(
        select(CoBudgetLine).where(
            CoBudgetLine.id == bl_id,
            CoBudgetLine.order_id == order_id,
            CoBudgetLine.vendor_id == vu.vendor_id,
        )
    )
    bl = r.scalar_one_or_none()
    if not bl:
        raise HTTPException(status_code=404, detail="Budget line not found")
    await db.delete(bl)
    await _commit(db)


@router.get("/manufacturing-orders/{order_id}/budget-vs-actual", response_model=InternalOrderBudgetVsActualOut)
async def budget_vs_actual(
    order_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(CoManufacturingOrder)
        .options(selectinload(CoManufacturingOrder.cost_lines))
        .where(
            CoManufacturingOrder.id == order_id,
            CoManufacturingOrder.vendor_id == vu.vendor_id,
        )
    )
    order = r.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    bl_r = await db.execute(
        select(CoBudgetLine).where(CoBudgetLine.order_id == order_id, CoBudgetLine.vendor_id == vu.vendor_id)
    )
    budget_lines = bl_r.scalars().all()

    total_budgeted = sum(Decimal(str(b.amount_budgeted or 0)) for b in budget_lines)
    _, total_actual = _sum_order_planned_actual(order)

    by_category: dict[str, dict[str, Decimal]] = {}
    for bl in budget_lines:
        cat = bl.category
        if cat not in by_category:
            by_category[cat] = {"budgeted": Decimal("0"), "actual": Decimal("0"), "variance": Decimal("0")}
        by_category[cat]["budgeted"] += Decimal(str(bl.amount_budgeted or 0))

    for cl in order.cost_lines:
        cat = cl.category
        if cat not in by_category:
            by_category[cat] = {"budgeted": Decimal("0"), "actual": Decimal("0"), "variance": Decimal("0")}
        by_category[cat]["actual"] += Decimal(str(cl.amount_actual or 0))

    for cat in by_category:
        by_category[cat]["variance"] = by_category[cat]["budgeted"] - by_category[cat]["actual"]

    return InternalOrderBudgetVsActualOut(
        order_id=order.id,
        order_no=order.order_no,
        title=order.title,
        order_kind=order.order_kind,
        status=order.status,
        total_budgeted=total_budgeted,
        total_actual=total_actual,
        total_variance=total_budgeted - total_actual,
        by_category=by_category,
        budget_lines=[BudgetLineOut.model_validate(b) for b in budget_lines],
    )


# ── Variance Runs ─────────────────────────────────────────────────────────────

@router.get("/variance-runs", response_model=List[VarianceRunOut])
async def list_variance_runs(
    company_id: Optional[UUID] = Query(None),
    period_year: Optional[int] = Query(None),
    period_month: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(500, ge=1, le=2000, description="Max rows returned"),
    offset: int = Query(0, ge=0),
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    q = select(CoVarianceRun).where(CoVarianceRun.vendor_id == vu.vendor_id)
    if company_id:
        q = q.where(CoVarianceRun.company_id == company_id)
    if period_year:
        q = q.where(CoVarianceRun.period_year == period_year)
    if period_month:
        q = q.where(CoVarianceRun.period_month == period_month)
    if status:
        q = q.where(CoVarianceRun.status == status)
    q = q.order_by(CoVarianceRun.run_date.desc(), CoVarianceRun.id).limit(limit).offset(offset)
    rows = (await db.execute(q)).scalars().all()
    return [VarianceRunOut.model_validate(r) for r in rows]


@router.post("/variance-runs", response_model=VarianceRunOut)
async def create_variance_run(
    body: VarianceRunCreate,
    vu: VendorUser = Depends(require_permission("finance.edit")),
    db: AsyncSession = Depends(get_db),
):
    """Collect the orders completed / closed in the period that no other run covers yet."""
    await _require_company(db, vu.vendor_id, body.company_id)

    period_start = date(body.period_year, body.period_month, 1)
    period_end = (
        date(body.period_year + 1, 1, 1) if body.period_month == 12
        else date(body.period_year, body.period_month + 1, 1)
    )
    # Orders are attributed to the period they completed in (fall back to last change for legacy rows).
    done_at = func.coalesce(CoManufacturingOrder.completed_at, CoManufacturingOrder.updated_at)
    already_covered = select(CoVarianceRunOrder.order_id).where(CoVarianceRunOrder.active.is_(True))
    q = (
        select(CoManufacturingOrder)
        .options(selectinload(CoManufacturingOrder.cost_lines))
        .where(
            CoManufacturingOrder.vendor_id == vu.vendor_id,
            CoManufacturingOrder.company_id == body.company_id,
            CoManufacturingOrder.status.in_(["completed", "closed"]),
            done_at >= period_start,
            done_at < period_end,
            CoManufacturingOrder.id.not_in(already_covered),
        )
        .order_by(CoManufacturingOrder.order_no)
    )
    orders = (await db.execute(q)).scalars().unique().all()
    if not orders:
        raise HTTPException(
            status_code=422,
            detail="No completed orders in this period are left to settle (each order is covered by one run only).",
        )

    total_planned = total_actual = Decimal("0")
    price_var = usage_var = overhead_var = scrap_var = Decimal("0")
    coverage: list[CoVarianceRunOrder] = []
    run_id = uuid.uuid4()

    for o in orders:
        o_planned = o_actual = Decimal("0")
        for ln in o.cost_lines:
            _order_line_amounts(ln)
            p = Decimal(str(ln.amount_planned or 0))
            a = Decimal(str(ln.amount_actual or 0))
            o_planned += p
            o_actual += a
            if ln.category == "overhead":
                overhead_var += a - p
            elif ln.category == "scrap":
                scrap_var += a - p
            elif ln.category == "material":
                qp = Decimal(str(ln.qty_planned or 0))
                qa = Decimal(str(ln.qty_actual or 0))
                rp = Decimal(str(ln.rate_planned or 0))
                ra = Decimal(str(ln.rate_actual or 0))
                price_var += (ra - rp) * qa
                usage_var += (qa - qp) * rp
            else:
                price_var += a - p
        total_planned += o_planned
        total_actual += o_actual
        coverage.append(
            CoVarianceRunOrder(
                id=uuid.uuid4(), run_id=run_id, order_id=o.id, vendor_id=vu.vendor_id,
                planned=o_planned.quantize(Decimal("0.0001")),
                actual=o_actual.quantize(Decimal("0.0001")),
                variance=(o_actual - o_planned).quantize(Decimal("0.0001")),
            )
        )

    vrun = CoVarianceRun(
        id=run_id,
        vendor_id=vu.vendor_id,
        company_id=body.company_id,
        period_year=body.period_year,
        period_month=body.period_month,
        run_type=body.run_type,
        run_date=body.run_date,
        total_planned=total_planned.quantize(Decimal("0.0001")),
        total_actual=total_actual.quantize(Decimal("0.0001")),
        total_variance=(total_actual - total_planned).quantize(Decimal("0.0001")),
        price_variance=price_var.quantize(Decimal("0.0001")),
        usage_variance=usage_var.quantize(Decimal("0.0001")),
        overhead_variance=overhead_var.quantize(Decimal("0.0001")),
        scrap_variance=scrap_var.quantize(Decimal("0.0001")),
        order_count=len(orders),
        narration=body.narration,
        extra={"order_ids": [str(o.id) for o in orders]},
    )
    db.add(vrun)
    await db.flush()
    db.add_all(coverage)
    await _commit(db)
    await db.refresh(vrun)
    return VarianceRunOut.model_validate(vrun)


async def _get_locked_variance_run(db: AsyncSession, vendor_id: UUID, run_id: UUID) -> CoVarianceRun:
    vrun = (
        await db.execute(
            select(CoVarianceRun)
            .where(CoVarianceRun.id == run_id, CoVarianceRun.vendor_id == vendor_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if not vrun:
        raise HTTPException(status_code=404, detail="Variance run not found")
    return vrun


@router.post("/variance-runs/{run_id}/post", response_model=VarianceRunOut)
async def post_variance_run(
    run_id: UUID,
    body: VarianceRunPostIn,
    vu: VendorUser = Depends(require_permission("finance.journal.post")),
    db: AsyncSession = Depends(get_db),
):
    """Finalise a run. The covered orders stay locked; the GL is only touched with ``post_to_gl``."""
    vrun = await _get_locked_variance_run(db, vu.vendor_id, run_id)
    if vrun.status == "posted":
        raise HTTPException(status_code=409, detail="Already posted")
    if vrun.status == "reversed":
        raise HTTPException(status_code=409, detail="A reversed run cannot be posted again — create a new run")

    entry_date_val = body.entry_date or date.today()
    var = Decimal(str(vrun.total_variance or 0))
    if body.post_to_gl and var != 0:
        mapping = await get_gl_mapping(db, vu.vendor_id, vrun.company_id)
        if not mapping or not mapping.production_variance_account_id or not mapping.cogs_account_id:
            raise HTTPException(
                status_code=422,
                detail="Configure the production variance and COGS accounts in CO GL mapping",
            )
        try:
            await check_period_open(db, vu.vendor_id, entry_date_val, vrun.company_id)
            from app.services.finance.posting import post_event

            abs_var = abs(var).quantize(Decimal("0.0001"))
            je = await post_event(
                db, vu.vendor_id, "co_cost_booking", vrun.id,
                {
                    "company_id": vrun.company_id,
                    "entry_date": entry_date_val.isoformat(),
                    "document_type": "CO",
                    "narration": vrun.narration or f"Variance run {vrun.period_year}/{vrun.period_month:02d}",
                    "reference": f"VRUN-{vrun.id}",
                    "ref_doc_type": "co_variance_run",
                    "ref_doc_id": str(vrun.id),
                    "lines": [
                        {
                            "account_id": str(mapping.production_variance_account_id),
                            "debit": str(abs_var) if var > 0 else "0",
                            "credit": "0" if var > 0 else str(abs_var),
                            "narration": "Production variance",
                        },
                        {
                            "account_id": str(mapping.cogs_account_id),
                            "debit": "0" if var > 0 else str(abs_var),
                            "credit": str(abs_var) if var > 0 else "0",
                            "narration": "COGS offset variance",
                        },
                    ],
                },
                created_by_id=vu.id,
            )
            if not je:
                raise ValueError("Journal posting failed — check the GL accounts and period")
        except ValueError as exc:
            await db.rollback()
            raise _co_error(exc) from exc
        vrun.journal_entry_id = je.id
    else:
        vrun.journal_entry_id = None
    vrun.status = "posted"
    vrun.extra = {**(vrun.extra or {}), "posted_to_gl": bool(vrun.journal_entry_id), "posted_on": entry_date_val.isoformat()}
    await _commit(db)
    await db.refresh(vrun)
    return VarianceRunOut.model_validate(vrun)


@router.post("/variance-runs/{run_id}/reverse", response_model=VarianceRunOut)
async def reverse_variance_run(
    run_id: UUID,
    body: CoSettlementReverseIn,
    vu: VendorUser = Depends(require_permission("finance.journal.post")),
    db: AsyncSession = Depends(get_db),
):
    """Undo a posted run (reverses its journal if any) and release its orders for a new run."""
    vrun = await _get_locked_variance_run(db, vu.vendor_id, run_id)
    if vrun.status != "posted":
        raise HTTPException(status_code=409, detail=f"Only posted runs can be reversed (status: {vrun.status})")
    try:
        if vrun.journal_entry_id:
            await check_period_open(db, vu.vendor_id, date.today(), vrun.company_id)
            await reverse_journal(db, vu.vendor_id, vrun.journal_entry_id, vu.id)
    except ValueError as exc:
        await db.rollback()
        raise _co_error(exc) from exc
    await db.execute(
        CoVarianceRunOrder.__table__.update()
        .where(CoVarianceRunOrder.run_id == vrun.id)
        .values(active=False)
    )
    vrun.status = "reversed"
    vrun.extra = {**(vrun.extra or {}), "reversal_reason": body.reason}
    await _commit(db)
    await db.refresh(vrun)
    return VarianceRunOut.model_validate(vrun)


@router.delete("/variance-runs/{run_id}", status_code=204)
async def delete_variance_run(
    run_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.edit")),
    db: AsyncSession = Depends(get_db),
):
    """Discard an open (not yet posted) run; its orders become available to the next run."""
    vrun = await _get_locked_variance_run(db, vu.vendor_id, run_id)
    if vrun.status != "open":
        raise HTTPException(status_code=409, detail="Only open runs can be deleted; reverse a posted run instead")
    await db.execute(delete(CoVarianceRunOrder).where(CoVarianceRunOrder.run_id == vrun.id))
    await db.delete(vrun)
    await _commit(db)


# ── Period-end report ─────────────────────────────────────────────────────────

@router.get("/period-end-report", response_model=PeriodEndReportOut)
async def period_end_report(
    company_id: Optional[UUID] = Query(None),
    period_year: int = Query(..., ge=2000, le=2100),
    period_month: int = Query(..., ge=1, le=12),
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    open_statuses = ("draft", "released", "in_progress")
    closed_statuses = ("completed", "closed")

    period_start = date(period_year, period_month, 1)
    period_end = date(period_year + 1, 1, 1) if period_month == 12 else date(period_year, period_month + 1, 1)
    done_at = func.coalesce(CoManufacturingOrder.completed_at, CoManufacturingOrder.updated_at)

    # Open orders / WIP are a live snapshot; everything else is limited to the selected period.
    q_open = select(func.count()).select_from(CoManufacturingOrder).where(
        CoManufacturingOrder.vendor_id == vu.vendor_id,
        CoManufacturingOrder.status.in_(open_statuses),
    )
    q_closed = select(func.count()).select_from(CoManufacturingOrder).where(
        CoManufacturingOrder.vendor_id == vu.vendor_id,
        CoManufacturingOrder.status.in_(closed_statuses),
        done_at >= period_start,
        done_at < period_end,
    )
    if company_id:
        q_open = q_open.where(CoManufacturingOrder.company_id == company_id)
        q_closed = q_closed.where(CoManufacturingOrder.company_id == company_id)

    open_count = (await db.execute(q_open)).scalar() or 0
    closed_count = (await db.execute(q_closed)).scalar() or 0

    _wip_open, wip_planned, wip_actual = await _wip_totals(db, vu.vendor_id, company_id)

    q_vrun = select(func.count()).select_from(CoVarianceRun).where(
        CoVarianceRun.vendor_id == vu.vendor_id,
        CoVarianceRun.period_year == period_year,
        CoVarianceRun.period_month == period_month,
        CoVarianceRun.status == "open",
    )
    if company_id:
        q_vrun = q_vrun.where(CoVarianceRun.company_id == company_id)

    q_alloc = select(func.count()).select_from(CoCostAllocation).where(
        CoCostAllocation.vendor_id == vu.vendor_id,
        CoCostAllocation.period_year == period_year,
        CoCostAllocation.period_month == period_month,
        CoCostAllocation.status == "planned",
    )
    if company_id:
        q_alloc = q_alloc.where(CoCostAllocation.company_id == company_id)

    q_gm = select(func.count()).select_from(CoGoodsMovement).where(
        CoGoodsMovement.vendor_id == vu.vendor_id,
        CoGoodsMovement.status == "posted",
        CoGoodsMovement.posting_date >= period_start,
        CoGoodsMovement.posting_date < period_end,
    )
    if company_id:
        q_gm = q_gm.where(CoGoodsMovement.company_id == company_id)

    q_ac = select(func.count()).select_from(CoActivityConfirmation).where(
        CoActivityConfirmation.vendor_id == vu.vendor_id,
        CoActivityConfirmation.status == "posted",
        CoActivityConfirmation.confirmation_date >= period_start,
        CoActivityConfirmation.confirmation_date < period_end,
    )
    if company_id:
        q_ac = q_ac.where(CoActivityConfirmation.company_id == company_id)

    pending_vruns = (await db.execute(q_vrun)).scalar() or 0
    pending_allocs = (await db.execute(q_alloc)).scalar() or 0
    gm_count = (await db.execute(q_gm)).scalar() or 0
    ac_count = (await db.execute(q_ac)).scalar() or 0

    return PeriodEndReportOut(
        company_id=company_id,
        period_year=period_year,
        period_month=period_month,
        open_orders=open_count,
        completed_orders=closed_count,
        total_planned=wip_planned,
        total_actual=wip_actual,
        total_variance=wip_actual - wip_planned,
        pending_variance_runs=pending_vruns,
        pending_allocations=pending_allocs,
        goods_movements_count=gm_count,
        activity_confirmations_count=ac_count,
    )


# ── Internal / Project orders report ─────────────────────────────────────────

@router.get("/internal-orders-report", response_model=List[dict])
async def internal_orders_report(
    company_id: Optional[UUID] = Query(None),
    order_kind: Optional[str] = Query(None, description="project | internal | assembly | process"),
    status: Optional[str] = Query(None),
    limit: int = Query(500, ge=1, le=2000, description="Max rows returned"),
    offset: int = Query(0, ge=0),
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    """Budget vs actual summary for internal / project orders."""
    q = (
        select(CoManufacturingOrder)
        .options(selectinload(CoManufacturingOrder.cost_lines))
        .where(CoManufacturingOrder.vendor_id == vu.vendor_id)
    )
    if company_id:
        q = q.where(CoManufacturingOrder.company_id == company_id)
    if order_kind:
        q = q.where(CoManufacturingOrder.order_kind == order_kind)
    else:
        q = q.where(CoManufacturingOrder.order_kind.in_(["project", "internal"]))
    if status:
        q = q.where(CoManufacturingOrder.status == status)
    q = q.order_by(CoManufacturingOrder.created_at.desc(), CoManufacturingOrder.id).limit(limit).offset(offset)
    orders = (await db.execute(q)).scalars().unique().all()

    # One grouped query for every budget total instead of one query per order.
    budget_by_order: dict = {}
    if orders:
        bl_rows = await db.execute(
            select(CoBudgetLine.order_id, func.sum(CoBudgetLine.amount_budgeted))
            .where(CoBudgetLine.order_id.in_([o.id for o in orders]))
            .group_by(CoBudgetLine.order_id)
        )
        budget_by_order = {oid: Decimal(str(total or 0)) for oid, total in bl_rows.all()}

    result = []
    for o in orders:
        p, a = _sum_order_planned_actual(o)
        budgeted = budget_by_order.get(o.id, Decimal("0"))

        result.append({
            "order_id": str(o.id),
            "order_no": o.order_no,
            "title": o.title,
            "order_kind": o.order_kind,
            "status": o.status,
            "project_id": str(o.project_id) if o.project_id else None,
            "scheduled_start": o.scheduled_start.isoformat() if o.scheduled_start else None,
            "scheduled_end": o.scheduled_end.isoformat() if o.scheduled_end else None,
            "budgeted": str(budgeted),
            "planned": str(p),
            "actual": str(a),
            "budget_variance": str(budgeted - a),
            "plan_variance": str(a - p),
            "settlement_status": o.settlement_status,
        })
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# WORK CENTERS
# ═══════════════════════════════════════════════════════════════════════════════

def _wc_out(wc: CoWorkCenter) -> dict:
    return {
        "id": str(wc.id),
        "company_id": str(wc.company_id),
        "code": wc.code,
        "name": wc.name,
        "description": wc.description,
        "wc_type": wc.wc_type,
        "capacity_uom": wc.capacity_uom,
        "labor_rate_per_hour": str(wc.labor_rate_per_hour),
        "machine_rate_per_hour": str(wc.machine_rate_per_hour),
        "direct_overhead_rate": str(wc.direct_overhead_rate),
        "capacity_hours_per_period": str(wc.capacity_hours_per_period),
        "cost_center_id": str(wc.cost_center_id) if wc.cost_center_id else None,
        "is_active": wc.is_active,
        "notes": wc.notes,
    }


async def _get_owned_work_center(db: AsyncSession, vendor_id: UUID, wc_id: UUID) -> CoWorkCenter:
    wc = (
        await db.execute(
            select(CoWorkCenter).where(CoWorkCenter.id == wc_id, CoWorkCenter.vendor_id == vendor_id)
        )
    ).scalar_one_or_none()
    if not wc:
        raise HTTPException(status_code=404, detail="Work center not found")
    return wc


@router.get("/work-centers")
async def list_work_centers(
    company_id: Optional[UUID] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.view")),
):
    q = select(CoWorkCenter).where(CoWorkCenter.vendor_id == current_user.vendor_id)
    if company_id:
        q = q.where(CoWorkCenter.company_id == company_id)
    if is_active is not None:
        q = q.where(CoWorkCenter.is_active == is_active)
    rows = (await db.execute(q.order_by(CoWorkCenter.code))).scalars().all()
    return [_wc_out(wc) for wc in rows]


@router.post("/work-centers", status_code=201)
async def create_work_center(
    body: WorkCenterCreate,
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.coa.manage")),
):
    vid = current_user.vendor_id
    await _require_company(db, vid, body.company_id)
    await _assert_owned(db, vid, FinCostCenter, [body.cost_center_id], "Cost center")
    code = body.code.strip()
    wc = CoWorkCenter(
        vendor_id=vid,
        company_id=body.company_id,
        code=code,
        name=(body.name or code).strip(),
        description=body.description,
        wc_type=body.wc_type,
        capacity_uom=body.capacity_uom,
        labor_rate_per_hour=body.labor_rate_per_hour,
        machine_rate_per_hour=body.machine_rate_per_hour,
        direct_overhead_rate=body.direct_overhead_rate,
        capacity_hours_per_period=body.capacity_hours_per_period,
        cost_center_id=body.cost_center_id,
        is_active=body.is_active,
        notes=body.notes,
    )
    db.add(wc)
    await _commit(db)
    await db.refresh(wc)
    return {"id": str(wc.id), "code": wc.code, "name": wc.name}


@router.patch("/work-centers/{wc_id}")
async def update_work_center(
    wc_id: UUID,
    body: WorkCenterUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.coa.manage")),
):
    wc = await _get_owned_work_center(db, current_user.vendor_id, wc_id)
    data = body.model_dump(exclude_unset=True)
    if data.get("cost_center_id"):
        await _assert_owned(db, current_user.vendor_id, FinCostCenter, [data["cost_center_id"]], "Cost center")
    for k, v in data.items():
        if v is None and k not in ("cost_center_id", "description", "notes"):
            continue  # never null out required columns
        setattr(wc, k, v)
    await _commit(db)
    return {"ok": True}


@router.delete("/work-centers/{wc_id}", status_code=204)
async def delete_work_center(
    wc_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.coa.manage")),
):
    wc = await _get_owned_work_center(db, current_user.vendor_id, wc_id)
    await db.delete(wc)
    await _commit(db)


# ═══════════════════════════════════════════════════════════════════════════════
# ROUTINGS
# ═══════════════════════════════════════════════════════════════════════════════

def _routing_out(r: CoRouting) -> dict:
    ops = []
    for op in (r.operations or []):
        ops.append({
            "id": str(op.id),
            "seq_no": op.seq_no,
            "operation_code": op.operation_code,
            "description": op.description,
            "work_center_id": str(op.work_center_id) if op.work_center_id else None,
            "work_center_name": op.work_center.name if op.work_center else None,
            "activity_type_id": str(op.activity_type_id) if op.activity_type_id else None,
            "setup_hrs": str(op.setup_hrs),
            "run_hrs_per_unit": str(op.run_hrs_per_unit),
            "teardown_hrs": str(op.teardown_hrs),
            "machine_hrs_per_unit": str(op.machine_hrs_per_unit),
            "labor_rate_override": str(op.labor_rate_override) if op.labor_rate_override is not None else None,
            "machine_rate_override": str(op.machine_rate_override) if op.machine_rate_override is not None else None,
            "direct_overhead_pct": str(op.direct_overhead_pct),
            "notes": op.notes,
        })
    return {
        "id": str(r.id),
        "company_id": str(r.company_id),
        "product_id": str(r.product_id) if r.product_id else None,
        "code": r.code,
        "name": r.name,
        "version": r.version,
        "status": r.status,
        "valid_from": r.valid_from.isoformat() if r.valid_from else None,
        "valid_to": r.valid_to.isoformat() if r.valid_to else None,
        "uom": r.uom,
        "lot_size": str(r.lot_size),
        "notes": r.notes,
        "operations": ops,
    }


def _routing_query():
    return select(CoRouting).options(
        selectinload(CoRouting.operations).selectinload(CoRoutingOperation.work_center)
    )


async def _get_owned_routing(db: AsyncSession, vendor_id: UUID, routing_id: UUID) -> CoRouting:
    r = (
        await db.execute(
            _routing_query().where(CoRouting.id == routing_id, CoRouting.vendor_id == vendor_id)
        )
    ).scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Routing not found")
    return r


@router.get("/routings")
async def list_routings(
    company_id: Optional[UUID] = Query(None),
    product_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.view")),
):
    q = _routing_query().where(CoRouting.vendor_id == current_user.vendor_id)
    if company_id:
        q = q.where(CoRouting.company_id == company_id)
    if product_id:
        q = q.where(CoRouting.product_id == product_id)
    if status:
        q = q.where(CoRouting.status == status)
    result = await db.execute(q.order_by(CoRouting.code, CoRouting.version))
    return [_routing_out(r) for r in result.scalars().all()]


@router.get("/routings/{routing_id}")
async def get_routing(
    routing_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.view")),
):
    return _routing_out(await _get_owned_routing(db, current_user.vendor_id, routing_id))


@router.post("/routings", status_code=201)
async def create_routing(
    body: RoutingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.coa.manage")),
):
    vid = current_user.vendor_id
    await _require_company(db, vid, body.company_id)
    await _assert_owned(db, vid, Product, [body.product_id], "Product")
    if body.valid_from and body.valid_to and body.valid_to < body.valid_from:
        raise HTTPException(status_code=422, detail="valid_to must not be before valid_from")
    code = body.code.strip()
    r = CoRouting(
        vendor_id=vid,
        company_id=body.company_id,
        product_id=body.product_id,
        code=code,
        name=(body.name or code).strip(),
        version=body.version,
        status=body.status,
        valid_from=body.valid_from,
        valid_to=body.valid_to,
        uom=body.uom,
        lot_size=body.lot_size,
        notes=body.notes,
    )
    db.add(r)
    await _commit(db)
    await db.refresh(r)
    return {"id": str(r.id), "code": r.code, "name": r.name, "version": r.version}


@router.patch("/routings/{routing_id}")
async def update_routing(
    routing_id: UUID,
    body: RoutingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.coa.manage")),
):
    r = await _get_owned_routing(db, current_user.vendor_id, routing_id)
    data = body.model_dump(exclude_unset=True)
    if data.get("product_id"):
        await _assert_owned(db, current_user.vendor_id, Product, [data["product_id"]], "Product")
    for k, v in data.items():
        if v is None and k not in ("product_id", "valid_from", "valid_to", "notes"):
            continue
        setattr(r, k, v)
    if r.valid_from and r.valid_to and r.valid_to < r.valid_from:
        raise HTTPException(status_code=422, detail="valid_to must not be before valid_from")
    await _commit(db)
    return {"ok": True}


@router.delete("/routings/{routing_id}", status_code=204)
async def delete_routing(
    routing_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.coa.manage")),
):
    r = await _get_owned_routing(db, current_user.vendor_id, routing_id)
    await db.delete(r)
    await _commit(db)


# ── Routing Operations ────────────────────────────────────────────────────────

async def _check_routing_op_refs(
    db: AsyncSession, vendor_id: UUID, routing: CoRouting, data: dict[str, Any]
) -> None:
    wc_id = data.get("work_center_id")
    if wc_id:
        wc = await _get_owned_work_center(db, vendor_id, wc_id)
        if wc.company_id != routing.company_id:
            raise HTTPException(status_code=400, detail="Work center belongs to a different business unit")
    await _assert_owned(db, vendor_id, CoActivityType, [data.get("activity_type_id")], "Activity type")


@router.post("/routings/{routing_id}/operations", status_code=201)
async def add_routing_operation(
    routing_id: UUID,
    body: RoutingOperationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.coa.manage")),
):
    r = await _get_owned_routing(db, current_user.vendor_id, routing_id)
    await _check_routing_op_refs(db, current_user.vendor_id, r, body.model_dump())
    op = CoRoutingOperation(routing_id=r.id, **body.model_dump())
    db.add(op)
    await _commit(db)
    await db.refresh(op)
    return {"id": str(op.id), "seq_no": op.seq_no}


async def _get_owned_routing_op(
    db: AsyncSession, vendor_id: UUID, routing_id: UUID, op_id: UUID
) -> tuple[CoRouting, CoRoutingOperation]:
    routing = await _get_owned_routing(db, vendor_id, routing_id)
    op = next((o for o in routing.operations if o.id == op_id), None)
    if not op:
        raise HTTPException(status_code=404, detail="Operation not found")
    return routing, op


@router.patch("/routings/{routing_id}/operations/{op_id}")
async def update_routing_operation(
    routing_id: UUID,
    op_id: UUID,
    body: RoutingOperationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.coa.manage")),
):
    routing, op = await _get_owned_routing_op(db, current_user.vendor_id, routing_id, op_id)
    data = body.model_dump(exclude_unset=True)
    await _check_routing_op_refs(db, current_user.vendor_id, routing, data)
    nullable = {"work_center_id", "activity_type_id", "labor_rate_override", "machine_rate_override",
                "operation_code", "description", "notes"}
    for k, v in data.items():
        if v is None and k not in nullable:
            continue
        setattr(op, k, v)
    await _commit(db)
    return {"ok": True}


@router.delete("/routings/{routing_id}/operations/{op_id}", status_code=204)
async def delete_routing_operation(
    routing_id: UUID,
    op_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.coa.manage")),
):
    _, op = await _get_owned_routing_op(db, current_user.vendor_id, routing_id, op_id)
    await db.delete(op)
    await _commit(db)


# ── Attach routing to product cost version ────────────────────────────────────

# Lines generated from a routing / overhead pools start at these sequence numbers so they can be
# regenerated without touching lines entered by hand.
ROUTING_SEQ_BASE = 1000
INDIRECT_SEQ_BASE = 2000

_D0 = Decimal("0")


def _dec(value: Any) -> Decimal:
    return Decimal(str(value if value is not None else 0))


async def _load_cost_version(
    db: AsyncSession, vendor_id: UUID, version_id: UUID, *, editable: bool = False
) -> CoProductCostVersion:
    """Load a cost version (row-locked); with ``editable`` it must still be a draft (409 otherwise)."""
    r = await db.execute(
        select(CoProductCostVersion)
        .options(selectinload(CoProductCostVersion.lines))
        .where(
            CoProductCostVersion.id == version_id,
            CoProductCostVersion.vendor_id == vendor_id,
        )
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    ver = r.scalar_one_or_none()
    if not ver:
        raise HTTPException(status_code=404, detail="Cost version not found")
    if editable:
        try:
            assert_version_editable(ver)
        except StateError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
    return ver


def _is_routing_generated(ln: CoProductCostLine) -> bool:
    lt = (ln.line_type or "").lower()
    return lt == "direct_overhead" or (lt == "activity" and (ln.sequence or 0) >= ROUTING_SEQ_BASE)


def _routing_cost_lines(routing: CoRouting) -> list[CoProductCostLine]:
    """Build per-output-unit activity / direct-overhead cost lines from a routing."""
    lot_size = _dec(routing.lot_size)
    if lot_size <= 0:
        lot_size = Decimal("1")

    lines: list[CoProductCostLine] = []
    seq = ROUTING_SEQ_BASE
    for rop in sorted(routing.operations or [], key=lambda o: o.seq_no or 0):
        wc = rop.work_center
        labor_rate = (
            _dec(rop.labor_rate_override)
            if rop.labor_rate_override is not None
            else _dec(wc.labor_rate_per_hour if wc else 0)
        )
        machine_rate = (
            _dec(rop.machine_rate_override)
            if rop.machine_rate_override is not None
            else _dec(wc.machine_rate_per_hour if wc else 0)
        )
        wc_overhead_rate = _dec(wc.direct_overhead_rate if wc else 0)

        # Setup / teardown are per lot, run time is per unit.
        labor_hrs = (_dec(rop.setup_hrs) + _dec(rop.teardown_hrs)) / lot_size + _dec(rop.run_hrs_per_unit)
        machine_hrs = _dec(rop.machine_hrs_per_unit)

        labor_cost = labor_hrs * labor_rate
        machine_cost = machine_hrs * machine_rate
        direct_oh = (labor_cost + machine_cost) * _dec(rop.direct_overhead_pct) / Decimal("100") + (
            machine_hrs * wc_overhead_rate
        )
        desc = rop.description or (wc.name if wc else f"Op {rop.seq_no}")

        for label, qty, rate in (
            ("labor", labor_hrs, labor_rate),
            ("machine", machine_hrs, machine_rate),
        ):
            if qty * rate <= 0:
                continue
            lines.append(CoProductCostLine(
                line_type="activity",
                description=f"{desc} — {label}",
                activity_type_id=rop.activity_type_id,
                qty_per_output_unit=qty.quantize(Decimal("0.000001")),
                unit_rate_planned=rate,
                sequence=seq,
            ))
            seq += 1

        if direct_oh > 0:
            lines.append(CoProductCostLine(
                line_type="direct_overhead",
                description=f"{desc} — direct overhead",
                qty_per_output_unit=Decimal("1"),
                unit_rate_planned=direct_oh.quantize(Decimal("0.000001")),
                sequence=seq,
            ))
            seq += 1
    return lines


@router.patch("/product-costs/{version_id}/routing")
async def set_cost_version_routing(
    version_id: UUID,
    body: CostVersionRoutingIn,
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.coa.manage")),
):
    """Link / unlink a routing to a product cost version and regenerate its activity / direct-overhead lines."""
    ver = await _load_cost_version(db, current_user.vendor_id, version_id, editable=True)

    routing: Optional[CoRouting] = None
    if body.routing_id:
        routing = (
            await db.execute(
                select(CoRouting)
                .options(selectinload(CoRouting.operations).selectinload(CoRoutingOperation.work_center))
                .where(CoRouting.id == body.routing_id, CoRouting.vendor_id == current_user.vendor_id)
            )
        ).scalar_one_or_none()
        if not routing:
            raise HTTPException(status_code=404, detail="Routing not found")
        if routing.company_id != ver.company_id:
            raise HTTPException(status_code=400, detail="Routing belongs to a different business unit")
        if routing.product_id and routing.product_id != ver.product_id:
            raise HTTPException(status_code=400, detail="Routing is defined for a different product")

    ver.routing_id = routing.id if routing else None

    for ln in [x for x in ver.lines if _is_routing_generated(x)]:
        ver.lines.remove(ln)  # delete-orphan removes the row
    if routing:
        for new_ln in _routing_cost_lines(routing):
            ver.lines.append(new_ln)

    _rollup_version_totals(ver)
    await _commit(db)
    return {
        "ok": True,
        "routing_id": str(ver.routing_id) if ver.routing_id else None,
        "activity": str(ver.activity_total_planned),
        "direct_overhead": str(ver.direct_overhead_total_planned),
        "rolled_up_unit_cost": str(ver.rolled_up_unit_cost),
    }


# ── Apply indirect overhead pools to product cost version ─────────────────────

@router.post("/product-costs/{version_id}/apply-overhead")
async def apply_overhead_to_cost_version(
    version_id: UUID,
    body: ApplyOverheadIn,
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.coa.manage")),
):
    """Recalculate and apply indirect overhead pools onto a product cost version."""
    ver = await _load_cost_version(db, current_user.vendor_id, version_id, editable=True)
    if body.company_id and body.company_id != ver.company_id:
        raise HTTPException(status_code=400, detail="company_id does not match the cost version")

    pq = select(CoOverheadPool).where(
        CoOverheadPool.vendor_id == current_user.vendor_id,
        CoOverheadPool.company_id == ver.company_id,
        CoOverheadPool.is_active.is_(True),
        or_(CoOverheadPool.overhead_type == "indirect", CoOverheadPool.overhead_type.is_(None)),
    )
    if body.pool_ids:
        pq = pq.where(CoOverheadPool.id.in_(body.pool_ids))
    pools = (await db.execute(pq.order_by(CoOverheadPool.code))).scalars().all()

    # Drop previously applied indirect overhead, then size the bases from what remains.
    for ln in [x for x in ver.lines if (x.line_type or "").lower() == "indirect_overhead"]:
        ver.lines.remove(ln)
    for ln in ver.lines:
        _recalc_product_cost_line_amount(ln)

    def _sum(line_type: str) -> Decimal:
        return sum((_dec(x.amount_planned) for x in ver.lines if (x.line_type or "").lower() == line_type), _D0)

    mat_total = _sum("material")
    act_total = _sum("activity")
    doh_total = _sum("direct_overhead")

    today = date.today()
    seq = INDIRECT_SEQ_BASE
    for pool in pools:
        rate_val = await _rate_for_pool_on_date(db, pool.id, today)
        if rate_val <= 0:
            continue
        formula = pool.formula_type or "fixed_rate"
        driver = body.base_quantities.get(str(pool.id))

        if formula == "pct_of_base":
            if pool.allocation_base == "material_cost":
                base = mat_total
            elif pool.allocation_base == "direct_labor_cost":
                base = act_total
            else:
                base = mat_total + act_total + doh_total
            amount = base * rate_val / Decimal("100")
        else:
            # per_machine_hour | per_labor_hour | per_unit | fixed_rate: rate × driver quantity (default 1)
            amount = (driver if driver is not None else Decimal("1")) * rate_val

        if amount <= 0:
            continue

        ver.lines.append(CoProductCostLine(
            line_type="indirect_overhead",
            description=f"{pool.name} — {formula}",
            overhead_pool_id=pool.id,
            qty_per_output_unit=Decimal("1"),
            unit_rate_planned=amount.quantize(Decimal("0.000001")),
            sequence=seq,
        ))
        seq += 1

    _rollup_version_totals(ver)
    await _commit(db)
    return {
        "ok": True,
        "material": str(ver.material_total_planned),
        "activity": str(ver.activity_total_planned),
        "direct_overhead": str(ver.direct_overhead_total_planned),
        "indirect_overhead": str(ver.indirect_overhead_total_planned),
        "total": str(ver.rolled_up_unit_cost),
    }
