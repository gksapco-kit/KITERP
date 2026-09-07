"""
Procurement Report Analytics API
Prefix: /vendors/me/procurement/reports/analytics
All aggregation logic lives in procurement_analytics_service.py.
"""
from __future__ import annotations

from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_vendor_id, require_permission
from app.services import procurement_analytics_service as svc

router = APIRouter(dependencies=[Depends(require_permission("procurement.view"))])

_PREFIX = "/reports/analytics"


# ── Shared filter dependency ────────────────────────────────────────────────

class _Filters:
    def __init__(
        self,
        supplier_id: Optional[UUID] = Query(None, description="Scope to a single supplier"),
        branch_id: Optional[UUID] = Query(None, description="Scope to a branch / business unit"),
        plant_id: Optional[UUID] = Query(None, description="Scope to a plant"),
        material_type: Optional[str] = Query(None, description="Filter by material type"),
        item_category: Optional[str] = Query(None, description="Filter by PO item category"),
        date_from: Optional[date] = Query(None, description="Start date (ISO, defaults to -29 days)"),
        date_to: Optional[date] = Query(None, description="End date (ISO, defaults to today)"),
        limit: int = Query(100, ge=1, le=500),
        offset: int = Query(0, ge=0),
    ):
        self.supplier_id = supplier_id
        self.branch_id = branch_id
        self.plant_id = plant_id
        self.material_type = material_type
        self.item_category = item_category
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
    """Period-compared KPIs: committed PO value, invoiced, AP outstanding, returns, fulfilment rate, PR conversion."""
    result = await svc.get_overview(
        db=db,
        vendor_id=vendor_id,
        date_from=f.date_from,
        date_to=f.date_to,
        branch_id=f.branch_id,
        supplier_id=f.supplier_id,
    )
    return JSONResponse(content=result)


# ── 2. Spend Analysis ───────────────────────────────────────────────────────

@router.get(f"{_PREFIX}/spend")
async def analytics_spend(
    group_by: str = Query("supplier", regex="^(supplier|material_type|branch|plant|item_category|account)$",
                          description="Dimension to group spend by"),
    f: _Filters = Depends(),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Spend breakdown by dimension with Pareto/ABC classification."""
    result = await svc.get_spend(
        db=db,
        vendor_id=vendor_id,
        date_from=f.date_from,
        date_to=f.date_to,
        group_by=group_by,
        branch_id=f.branch_id,
        plant_id=f.plant_id,
        supplier_id=f.supplier_id,
        material_type=f.material_type,
        item_category=f.item_category,
        limit=f.limit,
        offset=f.offset,
    )
    return JSONResponse(content=result)


# ── 3. Spend Trend ──────────────────────────────────────────────────────────

@router.get(f"{_PREFIX}/spend-trend")
async def analytics_spend_trend(
    bucket: str = Query("month", regex="^(day|week|month)$",
                        description="Time bucket for aggregation"),
    f: _Filters = Depends(),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Time-series of committed (PO), invoiced, and paid amounts to visualise commitment-to-cash lag."""
    result = await svc.get_spend_trend(
        db=db,
        vendor_id=vendor_id,
        date_from=f.date_from,
        date_to=f.date_to,
        bucket=bucket,
        branch_id=f.branch_id,
        supplier_id=f.supplier_id,
    )
    return JSONResponse(content=result)


# ── 4. Cycle Time ──────────────────────────────────────────────────────────

@router.get(f"{_PREFIX}/cycle-time")
async def analytics_cycle_time(
    f: _Filters = Depends(),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Average days per P2P stage: PR approval → PO to delivery → receipt to invoice → invoice to payment."""
    result = await svc.get_cycle_time(
        db=db,
        vendor_id=vendor_id,
        date_from=f.date_from,
        date_to=f.date_to,
        branch_id=f.branch_id,
        supplier_id=f.supplier_id,
    )
    return JSONResponse(content=result)


# ── 5. Approval Turnaround ──────────────────────────────────────────────────

@router.get(f"{_PREFIX}/approval-turnaround")
async def analytics_approval_turnaround(
    doc_type: Optional[str] = Query(None, regex="^(PO|PR|Invoice)$",
                                    description="Filter to a specific document type"),
    f: _Filters = Depends(),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Approval performance across POs, PRs, and Invoices: avg turnaround hours, approve/reject split, pending aging."""
    result = await svc.get_approval_turnaround(
        db=db,
        vendor_id=vendor_id,
        date_from=f.date_from,
        date_to=f.date_to,
        doc_type=doc_type,
    )
    return JSONResponse(content=result)


# ── 6. Supplier Scorecard ───────────────────────────────────────────────────

@router.get(f"{_PREFIX}/supplier-scorecard")
async def analytics_supplier_scorecard(
    f: _Filters = Depends(),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Composite supplier ranking: on-time delivery, quality acceptance, invoice match rate, return rate."""
    result = await svc.get_supplier_scorecard(
        db=db,
        vendor_id=vendor_id,
        date_from=f.date_from,
        date_to=f.date_to,
        supplier_id=f.supplier_id,
        limit=f.limit,
        offset=f.offset,
    )
    return JSONResponse(content=result)


# ── 7. Sourcing Funnel ──────────────────────────────────────────────────────

@router.get(f"{_PREFIX}/sourcing-funnel")
async def analytics_sourcing_funnel(
    f: _Filters = Depends(),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """PR → RFQ → Quotation → PO funnel counts, response rates, and realised savings vs target price."""
    result = await svc.get_sourcing_funnel(
        db=db,
        vendor_id=vendor_id,
        date_from=f.date_from,
        date_to=f.date_to,
    )
    return JSONResponse(content=result)


# ── 8. Price Purchase Variance ──────────────────────────────────────────────

@router.get(f"{_PREFIX}/price-variance")
async def analytics_price_variance(
    f: _Filters = Depends(),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """PO price vs invoice price variance per product — surfaces billing leakage."""
    result = await svc.get_price_variance(
        db=db,
        vendor_id=vendor_id,
        date_from=f.date_from,
        date_to=f.date_to,
        supplier_id=f.supplier_id,
        material_type=f.material_type,
        limit=f.limit,
        offset=f.offset,
    )
    return JSONResponse(content=result)


# ── 9. Three-Way Match Exceptions ───────────────────────────────────────────

@router.get(f"{_PREFIX}/match-exceptions")
async def analytics_match_exceptions(
    match_status: Optional[str] = Query(None, regex="^(blocked_qty|blocked_price|partial)$",
                                        description="Filter by specific match exception type"),
    f: _Filters = Depends(),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Actionable worklist of invoices blocked or partially matched, with aging."""
    result = await svc.get_match_exceptions(
        db=db,
        vendor_id=vendor_id,
        date_from=f.date_from,
        date_to=f.date_to,
        match_status=match_status,
        supplier_id=f.supplier_id,
        limit=f.limit,
        offset=f.offset,
    )
    return JSONResponse(content=result)


# ── 10. GST Input Credit ─────────────────────────────────────────────────────

@router.get(f"{_PREFIX}/gst-input-credit")
async def analytics_gst_input_credit(
    place_of_supply: Optional[str] = Query(None, description="2-digit GST state code"),
    f: _Filters = Depends(),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """CGST/SGST/IGST input credit by HSN code and place-of-supply, plus PO vs invoice GST variance."""
    result = await svc.get_gst_input_credit(
        db=db,
        vendor_id=vendor_id,
        date_from=f.date_from,
        date_to=f.date_to,
        place_of_supply=place_of_supply,
        limit=f.limit,
        offset=f.offset,
    )
    return JSONResponse(content=result)


# ── 11. Purchase Returns ─────────────────────────────────────────────────────

@router.get(f"{_PREFIX}/returns")
async def analytics_returns(
    return_reason: Optional[str] = Query(None,
                                         regex="^(quality_rejection|wrong_item|excess_delivery|damaged|other)$",
                                         description="Filter by return reason"),
    f: _Filters = Depends(),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Return value/count by reason and supplier, plus individual return list."""
    result = await svc.get_returns(
        db=db,
        vendor_id=vendor_id,
        date_from=f.date_from,
        date_to=f.date_to,
        supplier_id=f.supplier_id,
        return_reason=return_reason,
        limit=f.limit,
        offset=f.offset,
    )
    return JSONResponse(content=result)
