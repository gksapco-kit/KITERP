# app/api/v1/vendor_controlling.py
"""Controlling (CO) API — cost planning, orders, variance, WIP."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, List, Optional, Set
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_db, require_permission
from app.models.vendor_user import VendorUser
from app.models.finance import FinCompany
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
)
from app.services.controlling.settlement import (
    get_gl_mapping,
    upsert_gl_mapping,
    post_production_completion,
    post_cogs_issue,
)

router = APIRouter()


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


def _line_amount(qty: Decimal, rate: Decimal) -> Decimal:
    return (qty * rate).quantize(Decimal("0.0001"))


def _recalc_product_cost_line_amount(line: CoProductCostLine) -> None:
    line.amount_planned = _line_amount(
        Decimal(str(line.qty_per_output_unit or 0)),
        Decimal(str(line.unit_rate_planned or 0)),
    )


def _rollup_version_totals(ver: CoProductCostVersion) -> None:
    mat = act = ovh = Decimal("0")
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
    ver.material_total_planned = mat
    ver.activity_total_planned = act
    ver.overhead_total_planned = ovh
    ver.rolled_up_unit_cost = mat + act + ovh


def _order_line_amounts(ln: CoOrderCostLine) -> None:
    ap0 = Decimal(str(ln.amount_planned or 0))
    if ap0 == 0 and ln.qty_planned is not None and ln.rate_planned is not None:
        ln.amount_planned = _line_amount(Decimal(str(ln.qty_planned)), Decimal(str(ln.rate_planned)))
    aa0 = Decimal(str(ln.amount_actual or 0))
    if aa0 == 0 and ln.qty_actual is not None and ln.rate_actual is not None:
        ln.amount_actual = _line_amount(Decimal(str(ln.qty_actual)), Decimal(str(ln.rate_actual)))


def _sum_order_planned_actual(order: CoManufacturingOrder) -> tuple[Decimal, Decimal]:
    p = a = Decimal("0")
    for ln in order.cost_lines:
        _order_line_amounts(ln)
        p += Decimal(str(ln.amount_planned or 0))
        a += Decimal(str(ln.amount_actual or 0))
    return p, a


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
        )
        .order_by(CoOverheadRate.effective_from.desc())
        .limit(1)
    )
    row = r.scalar_one_or_none()
    if not row:
        return Decimal("0")
    return Decimal(str(row.rate_per_unit or 0))


async def _next_order_no(db: AsyncSession, vendor_id: UUID) -> str:
    suffix = uuid.uuid4().hex[:6].upper()
    return f"MO-{date.today().strftime('%Y%m%d')}-{suffix}"


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
) -> Decimal:
    key = str(product_id)
    if key in visited:
        return Decimal("0")
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
        return cost
    total = Decimal("0")
    for bi in bom_items:
        comp_cost = await _rollup_unit_cost_recursive(db, vendor_id, company_id, bi.component_id, visited)
        total += Decimal(str(bi.qty_per_unit)) * comp_cost
    visited.remove(key)
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
    await db.commit()
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
    for k, v in data.items():
        setattr(row, k, v)
    await db.commit()
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
        is_active=body.is_active,
    )
    db.add(row)
    await db.commit()
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
    await db.commit()
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
    await db.commit()
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
    db.add(ver)
    await db.commit()
    r = await db.execute(
        select(CoProductCostVersion)
        .options(selectinload(CoProductCostVersion.lines))
        .where(CoProductCostVersion.id == ver.id)
    )
    return _version_to_out(r.scalar_one())


@router.patch("/product-costs/{version_id}", response_model=ProductCostVersionOut)
async def update_product_cost(
    version_id: UUID,
    body: ProductCostVersionUpdate,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
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
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(ver, k, v)
    _rollup_version_totals(ver)
    await db.commit()
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
    await db.commit()
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
    ver.lines = [ln for ln in ver.lines if ln.id != line_id]
    await db.execute(delete(CoProductCostLine).where(CoProductCostLine.id == line_id))
    _rollup_version_totals(ver)
    await db.commit()
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
    await db.commit()
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
    r = await db.execute(q.order_by(CoManufacturingOrder.created_at.desc()))
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
    if "already posted" in low:
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
    row = await upsert_gl_mapping(db, vu.vendor_id, body.company_id, **payload)
    await db.commit()
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
        raise _co_settle_http_err(e) from e
    await db.commit()
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
        raise _co_settle_http_err(e) from e
    await db.commit()
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


@router.post("/manufacturing-orders", response_model=ManufacturingOrderOut, status_code=201)
async def create_manufacturing_order(
    body: ManufacturingOrderCreate,
    vu: VendorUser = Depends(require_permission("finance.coa.manage")),
    db: AsyncSession = Depends(get_db),
):
    await _require_company(db, vu.vendor_id, body.company_id)
    order_no = (body.order_no or "").strip() or await _next_order_no(db, vu.vendor_id)
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
    await db.commit()
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
    prev_status = order.status
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(order, k, v)
    if prev_status == "draft" and order.status in ("released", "in_progress") and not order.released_at:
        order.released_at = datetime.now(timezone.utc)
    if order.status == "completed" and not order.completed_at:
        order.completed_at = datetime.now(timezone.utc)
    for ln in order.cost_lines:
        _order_line_amounts(ln)
    await db.commit()
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
    await db.commit()
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
    await db.commit()
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
    ln = next((x for x in order.cost_lines if x.id == line_id), None)
    if not ln:
        raise HTTPException(status_code=404, detail="Cost line not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(ln, k, v)
    _order_line_amounts(ln)
    await db.commit()
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
    await db.commit()
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
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(op, k, v)
    await db.commit()
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
    await db.commit()
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
    await db.commit()
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

    await db.commit()
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

    for ln in order.cost_lines:
        if (ln.category or "").lower() != "overhead" or not ln.overhead_pool_id:
            continue
        rpool = await db.execute(
            select(CoOverheadPool).where(
                CoOverheadPool.id == ln.overhead_pool_id,
                CoOverheadPool.vendor_id == vu.vendor_id,
            )
        )
        pool = rpool.scalar_one_or_none()
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
        rate = await _rate_for_pool_on_date(db, pool.id, d)
        ln.qty_actual = driver
        ln.rate_actual = rate
        ln.amount_actual = _line_amount(driver, rate)

    await db.commit()
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
    wip = await _build_wip_summary(db, vu.vendor_id, company_id)
    return {
        "active_standard_costs": active_costs,
        "manufacturing_orders": total_orders,
        "wip_open_orders": wip.open_orders,
        "wip_planned_value": str(wip.wip_planned_value),
        "wip_actual_cost": str(wip.wip_actual_cost),
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
    )
    order = r.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    current = order.status or "draft"
    allowed = _VALID_TRANSITIONS.get(current, set())
    if body.status not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"Cannot transition from '{current}' to '{body.status}'. Allowed: {sorted(allowed)}",
        )

    order.status = body.status
    if body.notes:
        order.notes = (order.notes or "") + f"\n[{body.status.upper()}] {body.notes}"
    if body.status == "released":
        order.released_at = datetime.now(timezone.utc)
    elif body.status == "completed":
        order.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(order)
    return ManufacturingOrderOut.model_validate(order)


# ── Activity Confirmations ────────────────────────────────────────────────────

@router.get("/activity-confirmations", response_model=List[ActivityConfirmationOut])
async def list_activity_confirmations(
    company_id: Optional[UUID] = Query(None),
    order_id: Optional[UUID] = Query(None),
    confirmation_type: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
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
    q = q.order_by(CoActivityConfirmation.confirmation_date.desc())
    rows = (await db.execute(q)).scalars().all()
    return [ActivityConfirmationOut.model_validate(r) for r in rows]


@router.post("/activity-confirmations", response_model=ActivityConfirmationOut)
async def create_activity_confirmation(
    body: ActivityConfirmationCreate,
    vu: VendorUser = Depends(require_permission("finance.edit")),
    db: AsyncSession = Depends(get_db),
):
    await _require_company(db, vu.vendor_id, body.company_id)
    hours = Decimal(str(body.hours_confirmed))
    rate = Decimal(str(body.rate_per_hour))
    total = (hours * rate).quantize(Decimal("0.0001"))

    conf = CoActivityConfirmation(
        id=uuid.uuid4(),
        vendor_id=vu.vendor_id,
        company_id=body.company_id,
        order_id=body.order_id,
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

    # Sync actual hours back to order operation
    if body.operation_id:
        op_r = await db.execute(
            select(CoOrderOperation).where(
                CoOrderOperation.id == body.operation_id,
                CoOrderOperation.order_id == body.order_id,
            )
        )
        op = op_r.scalar_one_or_none()
        if op:
            op.actual_hours = Decimal(str(op.actual_hours or 0)) + hours
            op.actual_rate = rate if rate > 0 else op.actual_rate
            op.confirmed_qty = Decimal(str(op.confirmed_qty or 0)) + Decimal(str(body.qty_confirmed))
            if body.qty_confirmed > 0:
                op.status = "completed"

    await db.commit()
    await db.refresh(conf)
    return ActivityConfirmationOut.model_validate(conf)


@router.patch("/activity-confirmations/{conf_id}", response_model=ActivityConfirmationOut)
async def update_activity_confirmation(
    conf_id: UUID,
    body: ActivityConfirmationUpdate,
    vu: VendorUser = Depends(require_permission("finance.edit")),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(CoActivityConfirmation).where(
            CoActivityConfirmation.id == conf_id,
            CoActivityConfirmation.vendor_id == vu.vendor_id,
        )
    )
    conf = r.scalar_one_or_none()
    if not conf:
        raise HTTPException(status_code=404, detail="Confirmation not found")

    for field, val in body.model_dump(exclude_none=True).items():
        setattr(conf, field, val)

    hours = Decimal(str(conf.hours_confirmed or 0))
    rate = Decimal(str(conf.rate_per_hour or 0))
    conf.total_cost = (hours * rate).quantize(Decimal("0.0001"))

    await db.commit()
    await db.refresh(conf)
    return ActivityConfirmationOut.model_validate(conf)


@router.delete("/activity-confirmations/{conf_id}", status_code=204)
async def delete_activity_confirmation(
    conf_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.edit")),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(CoActivityConfirmation).where(
            CoActivityConfirmation.id == conf_id,
            CoActivityConfirmation.vendor_id == vu.vendor_id,
        )
    )
    conf = r.scalar_one_or_none()
    if not conf:
        raise HTTPException(status_code=404, detail="Confirmation not found")
    await db.delete(conf)
    await db.commit()


# ── Goods Movements ───────────────────────────────────────────────────────────

_MOVEMENT_LABELS = {
    "component_issue": "Goods Issue — Component to Order",
    "component_return": "Goods Issue Return — Component from Order",
    "fg_receipt": "Goods Receipt — FG from Order",
    "fg_receipt_reversal": "Goods Receipt Return — FG to Order",
}


@router.get("/goods-movements", response_model=List[GoodsMovementOut])
async def list_goods_movements(
    company_id: Optional[UUID] = Query(None),
    order_id: Optional[UUID] = Query(None),
    movement_type: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
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
    q = q.order_by(CoGoodsMovement.posting_date.desc())
    rows = (await db.execute(q)).scalars().all()
    return [GoodsMovementOut.model_validate(r) for r in rows]


@router.post("/goods-movements", response_model=GoodsMovementOut)
async def create_goods_movement(
    body: GoodsMovementCreate,
    vu: VendorUser = Depends(require_permission("finance.edit")),
    db: AsyncSession = Depends(get_db),
):
    if body.movement_type not in _MOVEMENT_LABELS:
        raise HTTPException(status_code=422, detail=f"Invalid movement_type. Use: {list(_MOVEMENT_LABELS)}")
    await _require_company(db, vu.vendor_id, body.company_id)

    qty = Decimal(str(body.qty))
    uc = Decimal(str(body.unit_cost))
    total = (qty * uc).quantize(Decimal("0.0001"))

    # Auto-generate document_no
    count_r = await db.execute(
        select(func.count()).select_from(CoGoodsMovement).where(CoGoodsMovement.vendor_id == vu.vendor_id)
    )
    doc_no = f"GM{(count_r.scalar() or 0) + 1:06d}"

    gm = CoGoodsMovement(
        id=uuid.uuid4(),
        vendor_id=vu.vendor_id,
        company_id=body.company_id,
        order_id=body.order_id,
        movement_type=body.movement_type,
        posting_date=body.posting_date,
        document_no=doc_no,
        product_id=body.product_id,
        description=body.description or _MOVEMENT_LABELS[body.movement_type],
        uom=body.uom,
        qty=qty,
        unit_cost=uc,
        total_cost=total,
        cost_center_id=body.cost_center_id,
        storage_location=body.storage_location,
        batch_no=body.batch_no,
        extra=body.extra or {},
    )
    db.add(gm)

    # Sync actuals back to order cost lines for material issues (component_issue)
    if body.movement_type == "component_issue" and body.product_id and total > 0:
        ocl_r = await db.execute(
            select(CoOrderCostLine).where(
                CoOrderCostLine.order_id == body.order_id,
                CoOrderCostLine.category == "material",
                CoOrderCostLine.product_id == body.product_id,
            )
        )
        ocl = ocl_r.scalars().first()
        if ocl:
            ocl.qty_actual = Decimal(str(ocl.qty_actual or 0)) + qty
            ocl.amount_actual = Decimal(str(ocl.amount_actual or 0)) + total
            if ocl.qty_actual > 0:
                ocl.rate_actual = (Decimal(str(ocl.amount_actual)) / Decimal(str(ocl.qty_actual))).quantize(Decimal("0.000001"))

    await db.commit()
    await db.refresh(gm)
    return GoodsMovementOut.model_validate(gm)


@router.post("/goods-movements/{gm_id}/reverse", response_model=GoodsMovementOut)
async def reverse_goods_movement(
    gm_id: UUID,
    reason: str = Body(..., embed=True),
    vu: VendorUser = Depends(require_permission("finance.edit")),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(CoGoodsMovement).where(
            CoGoodsMovement.id == gm_id,
            CoGoodsMovement.vendor_id == vu.vendor_id,
        )
    )
    gm = r.scalar_one_or_none()
    if not gm:
        raise HTTPException(status_code=404, detail="Goods movement not found")
    if gm.status == "reversed":
        raise HTTPException(status_code=409, detail="Already reversed")

    gm.status = "reversed"
    gm.reversal_reason = reason
    await db.commit()
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
    q = q.order_by(CoCostAllocation.period_year.desc(), CoCostAllocation.period_month.desc())
    rows = (await db.execute(q)).scalars().all()
    return [CostAllocationOut.model_validate(r) for r in rows]


@router.post("/cost-allocations", response_model=CostAllocationOut)
async def create_cost_allocation(
    body: CostAllocationCreate,
    vu: VendorUser = Depends(require_permission("finance.edit")),
    db: AsyncSession = Depends(get_db),
):
    await _require_company(db, vu.vendor_id, body.company_id)
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
    await db.commit()
    await db.refresh(alloc)
    return CostAllocationOut.model_validate(alloc)


@router.post("/cost-allocations/{alloc_id}/post", response_model=CostAllocationOut)
async def post_cost_allocation(
    alloc_id: UUID,
    body: CostAllocationPostIn,
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
        raise HTTPException(status_code=409, detail="Already posted")

    alloc.status = "posted"
    alloc.posting_date = body.entry_date or date.today()
    await db.commit()
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
    await db.commit()


# ── Budget Lines ──────────────────────────────────────────────────────────────

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
    r = await db.execute(
        select(CoManufacturingOrder).where(
            CoManufacturingOrder.id == order_id,
            CoManufacturingOrder.vendor_id == vu.vendor_id,
        )
    )
    if not r.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Order not found")

    bl = CoBudgetLine(
        id=uuid.uuid4(),
        vendor_id=vu.vendor_id,
        company_id=body.company_id,
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
    await db.commit()
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
    await db.commit()
    await db.refresh(bl)
    return BudgetLineOut.model_validate(bl)


@router.delete("/manufacturing-orders/{order_id}/budget-lines/{bl_id}", status_code=204)
async def delete_budget_line(
    order_id: UUID,
    bl_id: UUID,
    vu: VendorUser = Depends(require_permission("finance.edit")),
    db: AsyncSession = Depends(get_db),
):
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
    await db.commit()


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
    q = q.order_by(CoVarianceRun.run_date.desc())
    rows = (await db.execute(q)).scalars().all()
    return [VarianceRunOut.model_validate(r) for r in rows]


@router.post("/variance-runs", response_model=VarianceRunOut)
async def create_variance_run(
    body: VarianceRunCreate,
    vu: VendorUser = Depends(require_permission("finance.edit")),
    db: AsyncSession = Depends(get_db),
):
    await _require_company(db, vu.vendor_id, body.company_id)

    # Aggregate completed/closed orders for the period
    q = (
        select(CoManufacturingOrder)
        .options(selectinload(CoManufacturingOrder.cost_lines))
        .where(
            CoManufacturingOrder.vendor_id == vu.vendor_id,
            CoManufacturingOrder.company_id == body.company_id,
            CoManufacturingOrder.status.in_(["completed", "closed"]),
        )
    )
    orders = (await db.execute(q)).scalars().unique().all()

    total_planned = total_actual = Decimal("0")
    price_var = usage_var = overhead_var = scrap_var = Decimal("0")

    for o in orders:
        for ln in o.cost_lines:
            p = Decimal(str(ln.amount_planned or 0))
            a = Decimal(str(ln.amount_actual or 0))
            total_planned += p
            total_actual += a
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

    vrun = CoVarianceRun(
        id=uuid.uuid4(),
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
        extra={},
    )
    db.add(vrun)
    await db.commit()
    await db.refresh(vrun)
    return VarianceRunOut.model_validate(vrun)


@router.post("/variance-runs/{run_id}/post", response_model=VarianceRunOut)
async def post_variance_run(
    run_id: UUID,
    body: VarianceRunPostIn,
    vu: VendorUser = Depends(require_permission("finance.edit")),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(CoVarianceRun).where(
            CoVarianceRun.id == run_id,
            CoVarianceRun.vendor_id == vu.vendor_id,
        )
    )
    vrun = r.scalar_one_or_none()
    if not vrun:
        raise HTTPException(status_code=404, detail="Variance run not found")
    if vrun.status == "posted":
        raise HTTPException(status_code=409, detail="Already posted")

    mapping = await get_gl_mapping(db, vu.vendor_id, vrun.company_id)
    if not mapping or not mapping.production_variance_account_id:
        raise HTTPException(status_code=422, detail="Configure production variance account in CO GL mapping")

    from app.services.finance.posting import post_event

    var = vrun.total_variance
    if var == 0:
        vrun.status = "posted"
        vrun.journal_entry_id = None
        await db.commit()
        await db.refresh(vrun)
        return VarianceRunOut.model_validate(vrun)

    dr_acc = str(mapping.production_variance_account_id)
    cr_acc = str(mapping.cogs_account_id or mapping.production_variance_account_id)
    entry_date_val = body.entry_date or date.today()
    abs_var = abs(var).quantize(Decimal("0.0001"))

    payload = {
        "company_id": vrun.company_id,
        "entry_date": entry_date_val.isoformat(),
        "document_type": "CO",
        "narration": vrun.narration or f"Variance run {vrun.period_year}/{vrun.period_month:02d}",
        "reference": f"VRUN-{vrun.id}",
        "ref_doc_type": "co_variance_run",
        "ref_doc_id": str(vrun.id),
        "lines": [
            {
                "account_id": dr_acc,
                "debit": str(abs_var) if var > 0 else "0",
                "credit": "0" if var > 0 else str(abs_var),
                "narration": "Production variance",
            },
            {
                "account_id": cr_acc,
                "debit": "0" if var > 0 else str(abs_var),
                "credit": str(abs_var) if var > 0 else "0",
                "narration": "COGS offset variance",
            },
        ],
    }
    je = await post_event(db, vu.vendor_id, "co_variance_run", vrun.id, payload, created_by_id=vu.id)
    vrun.journal_entry_id = je.id if je else None
    vrun.status = "posted"
    await db.commit()
    await db.refresh(vrun)
    return VarianceRunOut.model_validate(vrun)


# ── Period-end report ─────────────────────────────────────────────────────────

@router.get("/period-end-report", response_model=PeriodEndReportOut)
async def period_end_report(
    company_id: Optional[UUID] = Query(None),
    period_year: int = Query(...),
    period_month: int = Query(...),
    vu: VendorUser = Depends(require_permission("finance.view")),
    db: AsyncSession = Depends(get_db),
):
    open_statuses = ("draft", "released", "in_progress")
    closed_statuses = ("completed", "closed")

    q_open = select(func.count()).select_from(CoManufacturingOrder).where(
        CoManufacturingOrder.vendor_id == vu.vendor_id,
        CoManufacturingOrder.status.in_(open_statuses),
    )
    q_closed = select(func.count()).select_from(CoManufacturingOrder).where(
        CoManufacturingOrder.vendor_id == vu.vendor_id,
        CoManufacturingOrder.status.in_(closed_statuses),
    )
    if company_id:
        q_open = q_open.where(CoManufacturingOrder.company_id == company_id)
        q_closed = q_closed.where(CoManufacturingOrder.company_id == company_id)

    open_count = (await db.execute(q_open)).scalar() or 0
    closed_count = (await db.execute(q_closed)).scalar() or 0

    wip = await _build_wip_summary(db, vu.vendor_id, company_id)

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
    )
    if company_id:
        q_gm = q_gm.where(CoGoodsMovement.company_id == company_id)

    q_ac = select(func.count()).select_from(CoActivityConfirmation).where(
        CoActivityConfirmation.vendor_id == vu.vendor_id,
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
        total_planned=wip.wip_planned_value,
        total_actual=wip.wip_actual_cost,
        total_variance=wip.wip_actual_cost - wip.wip_planned_value,
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
    orders = (await db.execute(q)).scalars().unique().all()

    result = []
    for o in orders:
        p, a = _sum_order_planned_actual(o)
        # fetch budget total
        bl_r = await db.execute(
            select(func.sum(CoBudgetLine.amount_budgeted)).where(CoBudgetLine.order_id == o.id)
        )
        budgeted = Decimal(str(bl_r.scalar() or 0))

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

@router.get("/work-centers")
async def list_work_centers(
    company_id: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.view")),
):
    q = select(CoWorkCenter).where(CoWorkCenter.vendor_id == current_user.vendor_id)
    if company_id:
        q = q.where(CoWorkCenter.company_id == UUID(company_id))
    if is_active is not None:
        q = q.where(CoWorkCenter.is_active == is_active)
    q = q.order_by(CoWorkCenter.code)
    result = await db.execute(q)
    rows = result.scalars().all()
    out = []
    for wc in rows:
        out.append({
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
        })
    return out


@router.post("/work-centers", status_code=201)
async def create_work_center(
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.view")),
):
    company_id = body.get("company_id")
    if not company_id:
        raise HTTPException(400, "company_id required")
    wc = CoWorkCenter(
        vendor_id=current_user.vendor_id,
        company_id=UUID(company_id),
        code=body["code"],
        name=body.get("name", body["code"]),
        description=body.get("description"),
        wc_type=body.get("wc_type", "machine"),
        capacity_uom=body.get("capacity_uom", "H"),
        labor_rate_per_hour=Decimal(str(body.get("labor_rate_per_hour", 0))),
        machine_rate_per_hour=Decimal(str(body.get("machine_rate_per_hour", 0))),
        direct_overhead_rate=Decimal(str(body.get("direct_overhead_rate", 0))),
        capacity_hours_per_period=Decimal(str(body.get("capacity_hours_per_period", 0))),
        cost_center_id=UUID(body["cost_center_id"]) if body.get("cost_center_id") else None,
        is_active=body.get("is_active", True),
        notes=body.get("notes"),
    )
    db.add(wc)
    await db.commit()
    await db.refresh(wc)
    return {"id": str(wc.id), "code": wc.code, "name": wc.name}


@router.patch("/work-centers/{wc_id}")
async def update_work_center(
    wc_id: str,
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.view")),
):
    result = await db.execute(select(CoWorkCenter).where(
        CoWorkCenter.id == UUID(wc_id),
        CoWorkCenter.vendor_id == current_user.vendor_id,
    ))
    wc = result.scalar_one_or_none()
    if not wc:
        raise HTTPException(404, "Work center not found")
    for field in ("name", "description", "wc_type", "capacity_uom", "notes", "is_active"):
        if field in body:
            setattr(wc, field, body[field])
    for field in ("labor_rate_per_hour", "machine_rate_per_hour", "direct_overhead_rate", "capacity_hours_per_period"):
        if field in body:
            setattr(wc, field, Decimal(str(body[field])))
    if "cost_center_id" in body:
        wc.cost_center_id = UUID(body["cost_center_id"]) if body["cost_center_id"] else None
    await db.commit()
    return {"ok": True}


@router.delete("/work-centers/{wc_id}", status_code=204)
async def delete_work_center(
    wc_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.view")),
):
    result = await db.execute(select(CoWorkCenter).where(
        CoWorkCenter.id == UUID(wc_id),
        CoWorkCenter.vendor_id == current_user.vendor_id,
    ))
    wc = result.scalar_one_or_none()
    if not wc:
        raise HTTPException(404, "Not found")
    await db.delete(wc)
    await db.commit()


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


@router.get("/routings")
async def list_routings(
    company_id: Optional[str] = Query(None),
    product_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.view")),
):
    q = (
        select(CoRouting)
        .options(selectinload(CoRouting.operations).selectinload(CoRoutingOperation.work_center))
        .where(CoRouting.vendor_id == current_user.vendor_id)
    )
    if company_id:
        q = q.where(CoRouting.company_id == UUID(company_id))
    if product_id:
        q = q.where(CoRouting.product_id == UUID(product_id))
    if status:
        q = q.where(CoRouting.status == status)
    q = q.order_by(CoRouting.code, CoRouting.version)
    result = await db.execute(q)
    return [_routing_out(r) for r in result.scalars().all()]


@router.get("/routings/{routing_id}")
async def get_routing(
    routing_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.view")),
):
    q = (
        select(CoRouting)
        .options(selectinload(CoRouting.operations).selectinload(CoRoutingOperation.work_center))
        .where(CoRouting.id == UUID(routing_id), CoRouting.vendor_id == current_user.vendor_id)
    )
    result = await db.execute(q)
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Routing not found")
    return _routing_out(r)


@router.post("/routings", status_code=201)
async def create_routing(
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.view")),
):
    company_id = body.get("company_id")
    if not company_id:
        raise HTTPException(400, "company_id required")
    r = CoRouting(
        vendor_id=current_user.vendor_id,
        company_id=UUID(company_id),
        product_id=UUID(body["product_id"]) if body.get("product_id") else None,
        code=body["code"],
        name=body.get("name", body["code"]),
        version=body.get("version", "1"),
        status=body.get("status", "draft"),
        valid_from=date.fromisoformat(body["valid_from"]) if body.get("valid_from") else None,
        valid_to=date.fromisoformat(body["valid_to"]) if body.get("valid_to") else None,
        uom=body.get("uom", "EA"),
        lot_size=Decimal(str(body.get("lot_size", 1))),
        notes=body.get("notes"),
    )
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return {"id": str(r.id), "code": r.code, "name": r.name, "version": r.version}


@router.patch("/routings/{routing_id}")
async def update_routing(
    routing_id: str,
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.view")),
):
    result = await db.execute(select(CoRouting).where(
        CoRouting.id == UUID(routing_id), CoRouting.vendor_id == current_user.vendor_id,
    ))
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Not found")
    for field in ("name", "version", "status", "uom", "notes"):
        if field in body:
            setattr(r, field, body[field])
    if "product_id" in body:
        r.product_id = UUID(body["product_id"]) if body["product_id"] else None
    if "lot_size" in body:
        r.lot_size = Decimal(str(body["lot_size"]))
    if "valid_from" in body:
        r.valid_from = date.fromisoformat(body["valid_from"]) if body["valid_from"] else None
    if "valid_to" in body:
        r.valid_to = date.fromisoformat(body["valid_to"]) if body["valid_to"] else None
    await db.commit()
    return {"ok": True}


@router.delete("/routings/{routing_id}", status_code=204)
async def delete_routing(
    routing_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.view")),
):
    result = await db.execute(select(CoRouting).where(
        CoRouting.id == UUID(routing_id), CoRouting.vendor_id == current_user.vendor_id,
    ))
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Not found")
    await db.delete(r)
    await db.commit()


# ── Routing Operations ────────────────────────────────────────────────────────

@router.post("/routings/{routing_id}/operations", status_code=201)
async def add_routing_operation(
    routing_id: str,
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.view")),
):
    result = await db.execute(select(CoRouting).where(
        CoRouting.id == UUID(routing_id), CoRouting.vendor_id == current_user.vendor_id,
    ))
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Routing not found")
    op = CoRoutingOperation(
        routing_id=r.id,
        work_center_id=UUID(body["work_center_id"]) if body.get("work_center_id") else None,
        activity_type_id=UUID(body["activity_type_id"]) if body.get("activity_type_id") else None,
        seq_no=int(body.get("seq_no", 10)),
        operation_code=body.get("operation_code"),
        description=body.get("description"),
        setup_hrs=Decimal(str(body.get("setup_hrs", 0))),
        run_hrs_per_unit=Decimal(str(body.get("run_hrs_per_unit", 0))),
        teardown_hrs=Decimal(str(body.get("teardown_hrs", 0))),
        machine_hrs_per_unit=Decimal(str(body.get("machine_hrs_per_unit", 0))),
        labor_rate_override=Decimal(str(body["labor_rate_override"])) if body.get("labor_rate_override") else None,
        machine_rate_override=Decimal(str(body["machine_rate_override"])) if body.get("machine_rate_override") else None,
        direct_overhead_pct=Decimal(str(body.get("direct_overhead_pct", 0))),
        notes=body.get("notes"),
    )
    db.add(op)
    await db.commit()
    await db.refresh(op)
    return {"id": str(op.id), "seq_no": op.seq_no}


@router.patch("/routings/{routing_id}/operations/{op_id}")
async def update_routing_operation(
    routing_id: str,
    op_id: str,
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.view")),
):
    result = await db.execute(select(CoRoutingOperation).where(
        CoRoutingOperation.id == UUID(op_id),
        CoRoutingOperation.routing_id == UUID(routing_id),
    ))
    op = result.scalar_one_or_none()
    if not op:
        raise HTTPException(404, "Operation not found")
    for field in ("operation_code", "description", "notes"):
        if field in body:
            setattr(op, field, body[field])
    if "seq_no" in body:
        op.seq_no = int(body["seq_no"])
    if "work_center_id" in body:
        op.work_center_id = UUID(body["work_center_id"]) if body["work_center_id"] else None
    if "activity_type_id" in body:
        op.activity_type_id = UUID(body["activity_type_id"]) if body["activity_type_id"] else None
    for field in ("setup_hrs", "run_hrs_per_unit", "teardown_hrs", "machine_hrs_per_unit", "direct_overhead_pct"):
        if field in body:
            setattr(op, field, Decimal(str(body[field])))
    for field in ("labor_rate_override", "machine_rate_override"):
        if field in body:
            setattr(op, field, Decimal(str(body[field])) if body[field] else None)
    await db.commit()
    return {"ok": True}


@router.delete("/routings/{routing_id}/operations/{op_id}", status_code=204)
async def delete_routing_operation(
    routing_id: str,
    op_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.view")),
):
    result = await db.execute(select(CoRoutingOperation).where(
        CoRoutingOperation.id == UUID(op_id),
        CoRoutingOperation.routing_id == UUID(routing_id),
    ))
    op = result.scalar_one_or_none()
    if not op:
        raise HTTPException(404, "Not found")
    await db.delete(op)
    await db.commit()


# ── Attach routing to product cost version ────────────────────────────────────

@router.patch("/product-costs/{version_id}/routing")
async def set_cost_version_routing(
    version_id: str,
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.view")),
):
    """Link / unlink a routing to a product cost version and re-calculate activity cost lines."""
    result = await db.execute(
        select(CoProductCostVersion)
        .options(selectinload(CoProductCostVersion.lines))
        .where(
            CoProductCostVersion.id == UUID(version_id),
            CoProductCostVersion.vendor_id == current_user.vendor_id,
        )
    )
    ver = result.scalar_one_or_none()
    if not ver:
        raise HTTPException(404, "Cost version not found")

    routing_id = body.get("routing_id")
    ver.routing_id = UUID(routing_id) if routing_id else None

    if routing_id:
        # Load routing with operations + work centers
        rq = (
            select(CoRouting)
            .options(selectinload(CoRouting.operations).selectinload(CoRoutingOperation.work_center))
            .where(CoRouting.id == UUID(routing_id), CoRouting.vendor_id == current_user.vendor_id)
        )
        rres = await db.execute(rq)
        routing = rres.scalar_one_or_none()

        if routing:
            # Remove existing activity/direct-overhead lines generated from routing
            to_del = [ln for ln in ver.lines if ln.category in ("activity", "direct_overhead")]
            for ln in to_del:
                await db.delete(ln)

            lot_size = float(routing.lot_size or 1)
            seq = 1000
            act_total = Decimal("0")
            doh_total = Decimal("0")

            for rop in routing.operations:
                wc = rop.work_center
                labor_rate = Decimal(str(rop.labor_rate_override or (wc.labor_rate_per_hour if wc else 0)))
                machine_rate = Decimal(str(rop.machine_rate_override or (wc.machine_rate_per_hour if wc else 0)))
                doh_rate = Decimal(str(wc.direct_overhead_rate if wc else 0))

                setup = float(rop.setup_hrs or 0)
                teardown = float(rop.teardown_hrs or 0)
                run_per_unit = float(rop.run_hrs_per_unit or 0)
                mach_per_unit = float(rop.machine_hrs_per_unit or 0)

                total_labor_hrs = Decimal(str(setup + teardown + run_per_unit * lot_size)) / Decimal(str(lot_size))
                total_machine_hrs = Decimal(str(mach_per_unit))

                labor_cost = total_labor_hrs * labor_rate
                machine_cost = total_machine_hrs * machine_rate
                total_direct = labor_cost + machine_cost

                doh_pct = Decimal(str(rop.direct_overhead_pct or 0)) / Decimal("100")
                doh_from_pct = total_direct * doh_pct
                doh_from_rate = total_machine_hrs * doh_rate
                direct_oh = doh_from_pct + doh_from_rate

                desc = rop.description or (wc.name if wc else f"Op {rop.seq_no}")

                if total_direct > 0:
                    act_line = CoProductCostLine(
                        version_id=ver.id,
                        sequence=seq,
                        category="activity",
                        description=f"{desc} — labor/machine",
                        qty_planned=Decimal(str(float(total_labor_hrs))),
                        rate_planned=labor_rate + machine_rate,
                        amount_planned=total_direct,
                    )
                    db.add(act_line)
                    act_total += total_direct
                    seq += 1

                if direct_oh > 0:
                    doh_line = CoProductCostLine(
                        version_id=ver.id,
                        sequence=seq,
                        category="direct_overhead",
                        description=f"{desc} — direct overhead",
                        qty_planned=Decimal("1"),
                        rate_planned=direct_oh,
                        amount_planned=direct_oh,
                    )
                    db.add(doh_line)
                    doh_total += direct_oh
                    seq += 1

            ver.activity_total_planned = act_total
            ver.direct_overhead_total_planned = doh_total

    # Recalculate rolled_up_unit_cost
    mat = sum(float(ln.amount_planned) for ln in ver.lines if ln.category == "material")
    act = float(ver.activity_total_planned or 0)
    doh = float(ver.direct_overhead_total_planned or 0)
    ioh = float(ver.indirect_overhead_total_planned or 0)
    ver.rolled_up_unit_cost = Decimal(str(mat + act + doh + ioh))

    await db.commit()
    return {"ok": True, "routing_id": routing_id, "rolled_up_unit_cost": str(ver.rolled_up_unit_cost)}


# ── Apply indirect overhead pools to product cost version ─────────────────────

@router.post("/product-costs/{version_id}/apply-overhead")
async def apply_overhead_to_cost_version(
    version_id: str,
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: VendorUser = Depends(require_permission("finance.view")),
):
    """Recalculate and apply indirect overhead pools onto a product cost version."""
    result = await db.execute(
        select(CoProductCostVersion)
        .options(selectinload(CoProductCostVersion.lines))
        .where(
            CoProductCostVersion.id == UUID(version_id),
            CoProductCostVersion.vendor_id == current_user.vendor_id,
        )
    )
    ver = result.scalar_one_or_none()
    if not ver:
        raise HTTPException(404, "Cost version not found")

    # Pools to apply — caller can pass specific pool_ids or we use all active indirect pools
    pool_ids = body.get("pool_ids")
    company_id = body.get("company_id") or str(ver.company_id)

    pq = (
        select(CoOverheadPool, CoOverheadRate)
        .outerjoin(
            CoOverheadRate,
            (CoOverheadRate.pool_id == CoOverheadPool.id) &
            (CoOverheadRate.effective_from <= date.today()) &
            ((CoOverheadRate.effective_to.is_(None)) | (CoOverheadRate.effective_to >= date.today())),
        )
        .where(
            CoOverheadPool.company_id == UUID(company_id),
            CoOverheadPool.is_active == True,
        )
    )
    if pool_ids:
        pq = pq.where(CoOverheadPool.id.in_([UUID(p) for p in pool_ids]))
    pres = await db.execute(pq)
    pool_rows = pres.all()

    # Remove existing indirect overhead lines
    to_del = [ln for ln in ver.lines if ln.category == "indirect_overhead"]
    for ln in to_del:
        await db.delete(ln)

    mat_total = sum(float(ln.amount_planned) for ln in ver.lines if ln.category == "material")
    act_total = float(ver.activity_total_planned or 0)
    doh_total = float(ver.direct_overhead_total_planned or 0)

    ioh_total = Decimal("0")
    seq = 2000

    for pool, rate in pool_rows:
        if not rate:
            continue
        rate_val = float(rate.rate_per_unit or 0)
        formula = getattr(pool, "formula_type", "fixed_rate") or "fixed_rate"
        base_val = body.get("base_quantities", {}).get(str(pool.id))

        amount = 0.0
        description = f"{pool.name} — {formula}"

        if formula == "pct_of_base":
            alloc = pool.allocation_base
            if alloc == "material_cost":
                base = mat_total
            elif alloc == "direct_labor_cost":
                base = act_total
            else:
                base = mat_total + act_total + doh_total
            amount = base * rate_val / 100.0
        elif formula in ("per_machine_hour", "per_labor_hour", "per_unit"):
            qty = float(base_val) if base_val is not None else 1.0
            amount = qty * rate_val
        else:
            # fixed_rate: rate × base_qty provided or 1
            qty = float(base_val) if base_val is not None else 1.0
            amount = qty * rate_val

        if amount <= 0:
            continue

        ln = CoProductCostLine(
            version_id=ver.id,
            sequence=seq,
            category="indirect_overhead",
            description=description,
            qty_planned=Decimal("1"),
            rate_planned=Decimal(str(amount)),
            amount_planned=Decimal(str(amount)),
        )
        db.add(ln)
        ioh_total += Decimal(str(amount))
        seq += 1

    ver.indirect_overhead_total_planned = ioh_total
    total = (
        Decimal(str(mat_total)) +
        Decimal(str(act_total)) +
        Decimal(str(doh_total)) +
        ioh_total
    )
    ver.overhead_total_planned = Decimal(str(doh_total)) + ioh_total
    ver.rolled_up_unit_cost = total
    await db.commit()
    return {
        "ok": True,
        "material": str(mat_total),
        "activity": str(act_total),
        "direct_overhead": str(doh_total),
        "indirect_overhead": str(ioh_total),
        "total": str(total),
    }
