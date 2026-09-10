"""
Inventory Analytics API
Prefix: /vendors/me/inventory/reports/analytics
All aggregation logic lives in inventory_analytics_service.py.

NOTE: Do not add `from __future__ import annotations` here.
Pydantic 2.13 + FastAPI Depends classes fail to resolve postponed
Optional[date]/Optional[UUID] ForwardRefs (class-not-fully-defined → 500).
"""
from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_vendor_id, require_permission
from app.services import inventory_analytics_service as svc

router = APIRouter(dependencies=[Depends(require_permission("inventory.view"))])

_PREFIX = "/reports/analytics"


# ── Shared filter dependency ───────────────────────────────────────────────

class _Filters:
    def __init__(
        self,
        store_id: Optional[UUID] = Query(None, description="Scope to a single business unit"),
        plant_id: Optional[UUID] = Query(None, description="Scope to a plant"),
        storage_location_id: Optional[UUID] = Query(None, description="Scope to a bin"),
        category: Optional[str] = Query(None, description="Filter by product category"),
        date_from: Optional[date] = Query(None, description="Start date (ISO, defaults to -29 days)"),
        date_to: Optional[date] = Query(None, description="End date (ISO, defaults to today)"),
        limit: int = Query(100, ge=1, le=500),
        offset: int = Query(0, ge=0),
    ):
        self.store_id = store_id
        self.plant_id = plant_id
        self.storage_location_id = storage_location_id
        self.category = category
        self.date_from = date_from
        self.date_to = date_to
        self.limit = limit
        self.offset = offset


# ── 1. Overview KPIs ────────────────────────────────────────────────────────

@router.get(f"{_PREFIX}/overview")
async def analytics_overview(
    f: _Filters = Depends(),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Single-payload KPI dashboard: stock value, turnover, DSI, stockouts, excess, expiry risk, count accuracy."""
    result = await svc.get_overview(
        db=db,
        vendor_id=vendor_id,
        store_id=f.store_id,
        date_from=f.date_from,
        date_to=f.date_to,
    )
    return JSONResponse(content=result)


# ── 2. Inventory Turnover & DSI ─────────────────────────────────────────────

@router.get(f"{_PREFIX}/turnover")
async def analytics_turnover(
    basis: str = Query("all_outbound", regex="^(all_outbound|sales)$",
                       description="all_outbound = all outbound movements; sales = sale movements only"),
    group_by: str = Query("category", regex="^(category|all)$"),
    f: _Filters = Depends(),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Inventory turnover ratio and Days Sales of Inventory (DSI) grouped by category."""
    result = await svc.get_turnover(
        db=db,
        vendor_id=vendor_id,
        store_id=f.store_id,
        date_from=f.date_from,
        date_to=f.date_to,
        basis=basis,
        group_by=group_by,
    )
    return JSONResponse(content=result)


# ── 3. Movement Trend ───────────────────────────────────────────────────────

@router.get(f"{_PREFIX}/movement-trend")
async def analytics_movement_trend(
    bucket: str = Query("day", regex="^(day|week|month)$",
                        description="Time bucket for aggregation"),
    f: _Filters = Depends(),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Time-series of inbound, outbound, and adjustment values, bucketed by day/week/month."""
    result = await svc.get_movement_trend(
        db=db,
        vendor_id=vendor_id,
        store_id=f.store_id,
        date_from=f.date_from,
        date_to=f.date_to,
        bucket=bucket,
    )
    return JSONResponse(content=result)


# ── 4. Stock Health ──────────────────────────────────────────────────────────

@router.get(f"{_PREFIX}/stock-health")
async def analytics_stock_health(
    f: _Filters = Depends(),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """On-hand vs. reorder policy per product: stockout / below_reorder / healthy / excess."""
    result = await svc.get_stock_health(
        db=db,
        vendor_id=vendor_id,
        store_id=f.store_id,
        category=f.category,
        limit=f.limit,
        offset=f.offset,
    )
    return JSONResponse(content=result)


# ── 5. Expiry / Batch Risk ──────────────────────────────────────────────────

@router.get(f"{_PREFIX}/expiry-risk")
async def analytics_expiry_risk(
    f: _Filters = Depends(),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Batch/lot expiry value-at-risk bucketed by proximity to expiry date."""
    result = await svc.get_expiry_risk(
        db=db,
        vendor_id=vendor_id,
        store_id=f.store_id,
        category=f.category,
        limit=f.limit,
        offset=f.offset,
    )
    return JSONResponse(content=result)


# ── 6. Shrinkage & Adjustments ──────────────────────────────────────────────

@router.get(f"{_PREFIX}/shrinkage")
async def analytics_shrinkage(
    group_by: str = Query("store", regex="^(store|movement_type)$"),
    f: _Filters = Depends(),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Write-offs, adjustments, and stock-count variances aggregated by store or movement type."""
    result = await svc.get_shrinkage(
        db=db,
        vendor_id=vendor_id,
        store_id=f.store_id,
        date_from=f.date_from,
        date_to=f.date_to,
        group_by=group_by,
    )
    return JSONResponse(content=result)


# ── 7. Count Accuracy ──────────────────────────────────────────────────────

@router.get(f"{_PREFIX}/count-accuracy")
async def analytics_count_accuracy(
    f: _Filters = Depends(),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Inventory Record Accuracy (IRA) trend from completed stock count sessions."""
    result = await svc.get_count_accuracy(
        db=db,
        vendor_id=vendor_id,
        store_id=f.store_id,
        date_from=f.date_from,
        date_to=f.date_to,
    )
    return JSONResponse(content=result)


# ── 8. Valuation Comparison ─────────────────────────────────────────────────

@router.get(f"{_PREFIX}/valuation-comparison")
async def analytics_valuation_comparison(
    f: _Filters = Depends(),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Side-by-side: cost_price vs. moving average price vs. standard price vs. FIFO per product."""
    result = await svc.get_valuation_comparison(
        db=db,
        vendor_id=vendor_id,
        store_id=f.store_id,
        category=f.category,
        limit=f.limit,
        offset=f.offset,
    )
    return JSONResponse(content=result)


# ── 9. In-Transit & Transfer Analytics ─────────────────────────────────────

@router.get(f"{_PREFIX}/in-transit")
async def analytics_in_transit(
    f: _Filters = Depends(),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """In-transit stock value and completed-transfer lead time analytics."""
    result = await svc.get_in_transit(
        db=db,
        vendor_id=vendor_id,
        date_from=f.date_from,
        date_to=f.date_to,
    )
    return JSONResponse(content=result)


# ── 10. Available-to-Promise ────────────────────────────────────────────────

@router.get(f"{_PREFIX}/atp")
async def analytics_atp(
    f: _Filters = Depends(),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Available-to-Promise: on-hand minus active reservations per product."""
    result = await svc.get_atp(
        db=db,
        vendor_id=vendor_id,
        store_id=f.store_id,
        category=f.category,
        limit=f.limit,
        offset=f.offset,
    )
    return JSONResponse(content=result)
