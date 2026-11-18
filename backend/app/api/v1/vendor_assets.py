"""Asset Management API — mounted at ``/vendors/me/assets``.

Permission keys: ``assets.view`` (read), ``assets.manage`` (custody, register, maintenance, licences),
``assets.approve`` (transfers / requests), ``assets.audit`` (physical audits), ``assets.finance``
(capitalise, link to Finance, disposal with GL).

Static paths are declared before the ``/{asset_id}`` routes so they are never swallowed by the path parameter.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Query, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_effective_permissions, require_any_permission, require_permission
from app.database import get_db
from app.models.asset_mgmt import AmAsset, AmDocument, DOCUMENT_TYPES
from app.models.vendor_user import VendorUser
from app.services import media_upload
from app.services.asset_mgmt import (
    assets as assets_svc, audits as audits_svc, custody, dashboard as dash_svc, finance_bridge, labels as labels_svc,
    licenses as lic_svc, maintenance as maint_svc, transfers as xfer_svc,
)
from app.services.asset_mgmt.common import (
    actor_id, as_datetime, as_uuid, check_choice, clean_str, get_asset, get_owned, record_event, to_dict,
)

router = APIRouter()

VIEW = Depends(require_permission("assets.view"))


def _perm(name: str):
    return Depends(require_permission(name))


def _can(vu: VendorUser, *perms: str) -> bool:
    eff = set(get_effective_permissions(vu))
    return any(p in eff for p in perms)


def _vendor_id(vu: VendorUser) -> UUID:
    return vu.vendor_id


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Dashboard & reports
# ═════════════════════════════════════════════════════════════════════════════════════════════════
@router.get("/dashboard")
async def dashboard(vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    return await dash_svc.dashboard(db, vu.vendor_id, include_finance=_can(vu, "assets.finance", "finance.assets.manage"))


@router.get("/reports/by-location")
async def report_by_location(vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    return await dash_svc.report_by_location(db, vu.vendor_id)


@router.get("/reports/maintenance-cost")
async def report_maintenance_cost(months: int = Query(12, ge=1, le=36), vu: VendorUser = VIEW,
                                  db: AsyncSession = Depends(get_db)):
    return await dash_svc.report_maintenance_cost(db, vu.vendor_id, months)


@router.get("/reports/aging")
async def report_aging(vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    return await dash_svc.report_aging(db, vu.vendor_id)


@router.post("/maintenance/run-daily")
async def run_daily_now(vu: VendorUser = _perm("assets.manage"), db: AsyncSession = Depends(get_db)):
    """Run the daily sweep for this tenant now (the scheduler runs it automatically every day)."""
    from app.services.asset_mgmt.alerts import vendor_daily
    out = await vendor_daily(db, vu.vendor_id)
    await db.commit()
    return out


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Categories & locations
# ═════════════════════════════════════════════════════════════════════════════════════════════════
@router.get("/categories")
async def list_categories(include_inactive: bool = True, vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    return await assets_svc.list_categories(db, vu.vendor_id, include_inactive)


@router.post("/categories", status_code=201)
async def create_category(body: dict = Body(...), vu: VendorUser = _perm("assets.manage"), db: AsyncSession = Depends(get_db)):
    cat = await assets_svc.create_category(db, vu.vendor_id, body)
    await db.commit()
    return to_dict(cat)


@router.put("/categories/{category_id}")
async def update_category(category_id: UUID, body: dict = Body(...), vu: VendorUser = _perm("assets.manage"),
                          db: AsyncSession = Depends(get_db)):
    cat = await assets_svc.update_category(db, vu.vendor_id, category_id, body)
    await db.commit()
    return to_dict(cat)


@router.delete("/categories/{category_id}", status_code=204)
async def delete_category(category_id: UUID, vu: VendorUser = _perm("assets.manage"), db: AsyncSession = Depends(get_db)):
    await assets_svc.delete_category(db, vu.vendor_id, category_id)
    await db.commit()
    return Response(status_code=204)


@router.get("/locations")
async def list_locations(vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    return await assets_svc.list_locations(db, vu.vendor_id)


@router.post("/locations", status_code=201)
async def create_location(body: dict = Body(...), vu: VendorUser = _perm("assets.manage"), db: AsyncSession = Depends(get_db)):
    loc = await assets_svc.create_location(db, vu.vendor_id, body)
    await db.commit()
    return to_dict(loc)


@router.put("/locations/{location_id}")
async def update_location(location_id: UUID, body: dict = Body(...), vu: VendorUser = _perm("assets.manage"),
                          db: AsyncSession = Depends(get_db)):
    loc = await assets_svc.update_location(db, vu.vendor_id, location_id, body)
    await db.commit()
    return to_dict(loc)


@router.delete("/locations/{location_id}", status_code=204)
async def delete_location(location_id: UUID, vu: VendorUser = _perm("assets.manage"), db: AsyncSession = Depends(get_db)):
    await assets_svc.delete_location(db, vu.vendor_id, location_id)
    await db.commit()
    return Response(status_code=204)


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Register: list / create / import / export / lookup / labels
# ═════════════════════════════════════════════════════════════════════════════════════════════════
def _opt_uuid(v: Optional[str], name: str) -> Optional[UUID]:
    return as_uuid(v, name) if v else None


@router.get("")
async def list_assets(
    q: Optional[str] = None, status: Optional[str] = None, category_id: Optional[str] = None,
    location_id: Optional[str] = None, store_id: Optional[str] = None, employee_id: Optional[str] = None,
    department_id: Optional[str] = None, condition: Optional[str] = None, unassigned: bool = False,
    fin_linked: Optional[bool] = None, include_closed: bool = True,
    page: int = Query(1, ge=1), size: int = Query(50, ge=1, le=200),
    vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db),
):
    return await assets_svc.list_assets(
        db, vu.vendor_id, page=page, size=size, q=q, status=status, category_id=_opt_uuid(category_id, "category_id"),
        location_id=_opt_uuid(location_id, "location_id"), store_id=_opt_uuid(store_id, "store_id"),
        employee_id=_opt_uuid(employee_id, "employee_id"), department_id=_opt_uuid(department_id, "department_id"),
        condition=condition, unassigned=unassigned, fin_linked=fin_linked, include_closed=include_closed)


@router.post("", status_code=201)
async def create_asset(body: dict = Body(...), vu: VendorUser = _perm("assets.manage"), db: AsyncSession = Depends(get_db)):
    """Register one asset, or several at once (``quantity`` / ``serial_numbers``). Pass ``capitalize: {...}`` to
    also create the Finance fixed-asset entry (needs ``assets.finance``)."""
    cap = body.get("capitalize")
    if cap and not _can(vu, "assets.finance"):
        raise HTTPException(403, "Missing permissions: assets.finance")
    created = await assets_svc.create_assets_bulk(db, vu.vendor_id, body, vu)
    fin: list[dict] = []
    if cap:
        for a in created:
            fin.append(await finance_bridge.capitalize(db, vu.vendor_id, a, cap if isinstance(cap, dict) else {}, vu))
    await db.commit()
    out = await assets_svc.assets_out(db, created)
    if len(out) == 1:
        res = out[0]
        if fin:
            res["finance"] = fin[0]
        return res
    return {"created": len(out), "items": out, "finance": fin}


@router.post("/import")
async def import_assets(body: dict = Body(...), vu: VendorUser = _perm("assets.manage"), db: AsyncSession = Depends(get_db)):
    rows = body.get("rows")
    if not isinstance(rows, list):
        raise HTTPException(400, "rows must be a list")
    res = await assets_svc.import_rows(db, vu.vendor_id, rows, vu, dry_run=bool(body.get("dry_run", True)))
    if not res["dry_run"]:
        await db.commit()
    return res


@router.get("/export.csv")
async def export_assets(
    q: Optional[str] = None, status: Optional[str] = None, category_id: Optional[str] = None,
    location_id: Optional[str] = None, vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db),
):
    csv_text = await assets_svc.export_csv(
        db, vu.vendor_id, q=q, status=status, category_id=_opt_uuid(category_id, "category_id"),
        location_id=_opt_uuid(location_id, "location_id"))
    return Response(csv_text, media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="assets.csv"'})


@router.get("/lookup")
async def lookup(code: str = Query(..., min_length=1, max_length=200), vu: VendorUser = VIEW,
                 db: AsyncSession = Depends(get_db)):
    """Resolve a scanned QR / barcode / typed tag or serial to an asset."""
    a = await assets_svc.lookup_asset(db, vu.vendor_id, code)
    return (await assets_svc.assets_out(db, [a]))[0]


@router.post("/labels")
async def print_labels(body: dict = Body(...), vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    ids = [as_uuid(i, "asset id") for i in (body.get("asset_ids") or [])]
    if not ids or len(ids) > 500:
        raise HTTPException(400, "Choose between 1 and 500 assets")
    rows = (await db.execute(select(AmAsset).where(AmAsset.vendor_id == vu.vendor_id, AmAsset.id.in_(ids))
                             .order_by(AmAsset.asset_tag))).scalars().all()
    if not rows:
        raise HTTPException(404, "No matching assets")
    company = clean_str(body.get("company"), 60)
    pdf = labels_svc.labels_pdf(rows, size=str(body.get("size") or "medium"), company=company)
    return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": 'inline; filename="asset-labels.pdf"'})


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Custody, reservations
# ═════════════════════════════════════════════════════════════════════════════════════════════════
@router.get("/assignments")
async def list_assignments(
    asset_id: Optional[str] = None, employee_id: Optional[str] = None, open_only: bool = False, overdue_only: bool = False,
    page: int = Query(1, ge=1), size: int = Query(50, ge=1, le=200), vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db),
):
    return await custody.list_assignments(db, vu.vendor_id, asset_id=asset_id, employee_id=employee_id,
                                          open_only=open_only, overdue_only=overdue_only, page=page, size=size)


@router.post("/assignments/{assignment_id}/acknowledge")
async def acknowledge(assignment_id: UUID, vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    """The holder (or a manager) confirms they have received the asset."""
    from app.models.asset_mgmt import AmAssignment
    row = await get_owned(db, AmAssignment, assignment_id, vu.vendor_id, "Assignment")
    me = await custody.current_employee_for(db, vu.vendor_id, vu)
    if not (me and row.employee_id == me.id) and not _can(vu, "assets.manage"):
        raise HTTPException(403, "Only the person holding this asset can acknowledge it")
    row = await custody.acknowledge(db, vu.vendor_id, assignment_id, vu)
    await db.commit()
    return to_dict(row)


@router.get("/reservations")
async def list_reservations(asset_id: Optional[str] = None, employee_id: Optional[str] = None,
                            date_from: Optional[str] = None, date_to: Optional[str] = None,
                            include_cancelled: bool = False, vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    return await custody.list_reservations(
        db, vu.vendor_id, asset_id=asset_id, employee_id=employee_id, date_from=as_datetime(date_from, "date_from"),
        date_to=as_datetime(date_to, "date_to"), include_cancelled=include_cancelled)


@router.post("/reservations", status_code=201)
async def create_reservation(body: dict = Body(...), vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    row = await custody.create_reservation(db, vu.vendor_id, body, vu)
    await db.commit()
    return to_dict(row)


@router.post("/reservations/{reservation_id}/cancel")
async def cancel_reservation(reservation_id: UUID, vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    from app.models.asset_mgmt import AmReservation
    row = await get_owned(db, AmReservation, reservation_id, vu.vendor_id, "Reservation")
    if row.reserved_by != vu.id and not _can(vu, "assets.manage"):
        raise HTTPException(403, "Only the person who booked this can cancel it")
    row = await custody.cancel_reservation(db, vu.vendor_id, reservation_id, vu)
    await db.commit()
    return to_dict(row)


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Transfers
# ═════════════════════════════════════════════════════════════════════════════════════════════════
@router.get("/transfers")
async def list_transfers(status: Optional[str] = None, page: int = Query(1, ge=1), size: int = Query(30, ge=1, le=100),
                         vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    return await xfer_svc.list_transfers(db, vu.vendor_id, status=status, page=page, size=size)


@router.post("/transfers", status_code=201)
async def create_transfer(body: dict = Body(...), vu: VendorUser = _perm("assets.manage"), db: AsyncSession = Depends(get_db)):
    t = await xfer_svc.create_transfer(db, vu.vendor_id, body, vu)
    await db.commit()
    return await xfer_svc.get_transfer(db, vu.vendor_id, t.id)


@router.get("/transfers/{transfer_id}")
async def get_transfer(transfer_id: UUID, vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    return await xfer_svc.get_transfer(db, vu.vendor_id, transfer_id)


@router.post("/transfers/{transfer_id}/submit")
async def submit_transfer(transfer_id: UUID, vu: VendorUser = _perm("assets.manage"), db: AsyncSession = Depends(get_db)):
    await xfer_svc.submit_transfer(db, vu.vendor_id, transfer_id, vu)
    await db.commit()
    return await xfer_svc.get_transfer(db, vu.vendor_id, transfer_id)


@router.post("/transfers/{transfer_id}/approve")
async def approve_transfer(transfer_id: UUID, body: dict = Body(default_factory=dict),
                           vu: VendorUser = _perm("assets.approve"), db: AsyncSession = Depends(get_db)):
    await xfer_svc.approve_transfer(db, vu.vendor_id, transfer_id, vu, body.get("notes"))
    await db.commit()
    return await xfer_svc.get_transfer(db, vu.vendor_id, transfer_id)


@router.post("/transfers/{transfer_id}/reject")
async def reject_transfer(transfer_id: UUID, body: dict = Body(default_factory=dict),
                          vu: VendorUser = _perm("assets.approve"), db: AsyncSession = Depends(get_db)):
    await xfer_svc.reject_transfer(db, vu.vendor_id, transfer_id, vu, body.get("notes"))
    await db.commit()
    return await xfer_svc.get_transfer(db, vu.vendor_id, transfer_id)


@router.post("/transfers/{transfer_id}/cancel")
async def cancel_transfer(transfer_id: UUID, vu: VendorUser = _perm("assets.manage"), db: AsyncSession = Depends(get_db)):
    await xfer_svc.cancel_transfer(db, vu.vendor_id, transfer_id, vu)
    await db.commit()
    return await xfer_svc.get_transfer(db, vu.vendor_id, transfer_id)


@router.post("/transfers/{transfer_id}/dispatch")
async def dispatch_transfer(transfer_id: UUID, vu: VendorUser = _perm("assets.manage"), db: AsyncSession = Depends(get_db)):
    await xfer_svc.dispatch_transfer(db, vu.vendor_id, transfer_id, vu)
    await db.commit()
    return await xfer_svc.get_transfer(db, vu.vendor_id, transfer_id)


@router.post("/transfers/{transfer_id}/receive")
async def receive_transfer(transfer_id: UUID, body: dict = Body(default_factory=dict),
                           vu: VendorUser = _perm("assets.manage"), db: AsyncSession = Depends(get_db)):
    await xfer_svc.receive_transfer(db, vu.vendor_id, transfer_id, body, vu)
    await db.commit()
    return await xfer_svc.get_transfer(db, vu.vendor_id, transfer_id)


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Requests
# ═════════════════════════════════════════════════════════════════════════════════════════════════
@router.get("/requests")
async def list_requests(status: Optional[str] = None, mine: bool = False, page: int = Query(1, ge=1),
                        size: int = Query(50, ge=1, le=100), vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    return await xfer_svc.list_requests(db, vu.vendor_id, status=status, mine_user_id=vu.id if mine else None,
                                        page=page, size=size)


@router.post("/requests", status_code=201)
async def create_request(body: dict = Body(...), vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    # Only managers may raise a request on someone else's behalf.
    if body.get("requester_employee_id") and not _can(vu, "assets.manage"):
        body = {k: v for k, v in body.items() if k != "requester_employee_id"}
    row = await xfer_svc.create_request(db, vu.vendor_id, body, vu)
    await db.commit()
    return to_dict(row)


@router.post("/requests/{request_id}/approve")
async def approve_request(request_id: UUID, body: dict = Body(default_factory=dict),
                          vu: VendorUser = _perm("assets.approve"), db: AsyncSession = Depends(get_db)):
    row = await xfer_svc.decide_request(db, vu.vendor_id, request_id, True, vu, body.get("notes"))
    await db.commit()
    return to_dict(row)


@router.post("/requests/{request_id}/reject")
async def reject_request(request_id: UUID, body: dict = Body(default_factory=dict),
                         vu: VendorUser = _perm("assets.approve"), db: AsyncSession = Depends(get_db)):
    row = await xfer_svc.decide_request(db, vu.vendor_id, request_id, False, vu, body.get("notes"))
    await db.commit()
    return to_dict(row)


@router.post("/requests/{request_id}/fulfill")
async def fulfill_request(request_id: UUID, body: dict = Body(...), vu: VendorUser = _perm("assets.manage"),
                          db: AsyncSession = Depends(get_db)):
    row = await xfer_svc.fulfill_request(db, vu.vendor_id, request_id, body, vu)
    await db.commit()
    return to_dict(row)


@router.post("/requests/{request_id}/cancel")
async def cancel_request(request_id: UUID, vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    row = await xfer_svc.cancel_request(db, vu.vendor_id, request_id, vu, _can(vu, "assets.manage"))
    await db.commit()
    return to_dict(row)


@router.post("/requests/{request_id}/requisition")
async def link_requisition(request_id: UUID, body: dict = Body(...), vu: VendorUser = _perm("assets.manage"),
                           db: AsyncSession = Depends(get_db)):
    row = await xfer_svc.link_requisition(db, vu.vendor_id, request_id, body.get("purchase_requisition_id"))
    await db.commit()
    return to_dict(row)


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Audits
# ═════════════════════════════════════════════════════════════════════════════════════════════════
@router.get("/audits")
async def list_audits(vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    return await audits_svc.list_audits(db, vu.vendor_id)


@router.post("/audits", status_code=201)
async def create_audit(body: dict = Body(...), vu: VendorUser = _perm("assets.audit"), db: AsyncSession = Depends(get_db)):
    a = await audits_svc.create_audit(db, vu.vendor_id, body, vu)
    await db.commit()
    return to_dict(a)


@router.get("/audits/{audit_id}")
async def get_audit(audit_id: UUID, vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    return await audits_svc.audit_report(db, vu.vendor_id, audit_id)


@router.post("/audits/{audit_id}/start")
async def start_audit(audit_id: UUID, vu: VendorUser = _perm("assets.audit"), db: AsyncSession = Depends(get_db)):
    a = await audits_svc.start_audit(db, vu.vendor_id, audit_id, vu)
    await db.commit()
    return to_dict(a)


@router.post("/audits/{audit_id}/scan")
async def scan_audit(audit_id: UUID, body: dict = Body(...), vu: VendorUser = _perm("assets.audit"),
                     db: AsyncSession = Depends(get_db)):
    res = await audits_svc.scan(db, vu.vendor_id, audit_id, body, vu)
    await db.commit()
    return res


@router.post("/audits/{audit_id}/lines/{line_id}/mark")
async def mark_audit_line(audit_id: UUID, line_id: UUID, body: dict = Body(...), vu: VendorUser = _perm("assets.audit"),
                          db: AsyncSession = Depends(get_db)):
    line = await audits_svc.mark_line(db, vu.vendor_id, audit_id, line_id, body, vu)
    await db.commit()
    return to_dict(line)


@router.post("/audits/{audit_id}/lines/{line_id}/resolve")
async def resolve_audit_line(audit_id: UUID, line_id: UUID, body: dict = Body(...), vu: VendorUser = _perm("assets.audit"),
                             db: AsyncSession = Depends(get_db)):
    line = await audits_svc.resolve_line(db, vu.vendor_id, audit_id, line_id, str(body.get("action") or ""), vu)
    await db.commit()
    return to_dict(line)


@router.post("/audits/{audit_id}/complete")
async def complete_audit(audit_id: UUID, body: dict = Body(default_factory=dict), vu: VendorUser = _perm("assets.audit"),
                         db: AsyncSession = Depends(get_db)):
    a = await audits_svc.complete_audit(db, vu.vendor_id, audit_id, body, vu)
    await db.commit()
    return to_dict(a)


@router.post("/audits/{audit_id}/cancel")
async def cancel_audit(audit_id: UUID, vu: VendorUser = _perm("assets.audit"), db: AsyncSession = Depends(get_db)):
    a = await audits_svc.cancel_audit(db, vu.vendor_id, audit_id, vu)
    await db.commit()
    return to_dict(a)


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Maintenance: plans, work orders, coverage
# ═════════════════════════════════════════════════════════════════════════════════════════════════
@router.get("/maintenance/plans")
async def list_plans(asset_id: Optional[str] = None, due_within_days: Optional[int] = Query(None, ge=0, le=365),
                     vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    return await maint_svc.list_plans(db, vu.vendor_id, asset_id=asset_id, due_within_days=due_within_days)


@router.post("/maintenance/plans", status_code=201)
async def create_plan(body: dict = Body(...), vu: VendorUser = _perm("assets.manage"), db: AsyncSession = Depends(get_db)):
    plan = await maint_svc.create_plan(db, vu.vendor_id, body, vu)
    await db.commit()
    return to_dict(plan)


@router.put("/maintenance/plans/{plan_id}")
async def update_plan(plan_id: UUID, body: dict = Body(...), vu: VendorUser = _perm("assets.manage"),
                      db: AsyncSession = Depends(get_db)):
    plan = await maint_svc.update_plan(db, vu.vendor_id, plan_id, body)
    await db.commit()
    return to_dict(plan)


@router.delete("/maintenance/plans/{plan_id}", status_code=204)
async def delete_plan(plan_id: UUID, vu: VendorUser = _perm("assets.manage"), db: AsyncSession = Depends(get_db)):
    await maint_svc.delete_plan(db, vu.vendor_id, plan_id)
    await db.commit()
    return Response(status_code=204)


@router.post("/maintenance/plans/generate")
async def generate_due(vu: VendorUser = _perm("assets.manage"), db: AsyncSession = Depends(get_db)):
    created = await maint_svc.generate_due_work_orders(db, vu.vendor_id, vu=vu)
    await db.commit()
    return {"created": len(created), "work_orders": [to_dict(w) for w in created]}


@router.get("/work-orders")
async def list_work_orders(status: Optional[str] = None, asset_id: Optional[str] = None, page: int = Query(1, ge=1),
                           size: int = Query(50, ge=1, le=200), vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    return await maint_svc.list_work_orders(db, vu.vendor_id, status=status, asset_id=asset_id, page=page, size=size)


@router.post("/work-orders", status_code=201)
async def create_work_order(body: dict = Body(...), vu: VendorUser = _perm("assets.manage"), db: AsyncSession = Depends(get_db)):
    wo = await maint_svc.create_work_order(db, vu.vendor_id, body, vu)
    await db.commit()
    return to_dict(wo)


@router.put("/work-orders/{wo_id}/links")
async def update_work_order_links(wo_id: UUID, body: dict = Body(...), vu: VendorUser = _perm("assets.manage"),
                                  db: AsyncSession = Depends(get_db)):
    wo = await maint_svc.update_work_order_links(db, vu.vendor_id, wo_id, body, vu)
    await db.commit()
    return to_dict(wo)


@router.post("/work-orders/{wo_id}/start")
async def start_work_order(wo_id: UUID, body: dict = Body(default_factory=dict), vu: VendorUser = _perm("assets.manage"),
                           db: AsyncSession = Depends(get_db)):
    wo = await maint_svc.start_work_order(db, vu.vendor_id, wo_id, body, vu)
    await db.commit()
    return to_dict(wo)


@router.post("/work-orders/{wo_id}/complete")
async def complete_work_order(wo_id: UUID, body: dict = Body(default_factory=dict), vu: VendorUser = _perm("assets.manage"),
                              db: AsyncSession = Depends(get_db)):
    # Capitalising maintenance cost or posting to the GL changes the books: that needs the finance permission.
    if (body.get("capitalize") or body.get("post_to_gl")) and not _can(vu, "assets.finance"):
        raise HTTPException(403, "Missing permissions: assets.finance")
    res = await maint_svc.complete_work_order(db, vu.vendor_id, wo_id, body, vu)
    await db.commit()
    return res


@router.post("/work-orders/{wo_id}/cancel")
async def cancel_work_order(wo_id: UUID, vu: VendorUser = _perm("assets.manage"), db: AsyncSession = Depends(get_db)):
    wo = await maint_svc.cancel_work_order(db, vu.vendor_id, wo_id, vu)
    await db.commit()
    return to_dict(wo)


@router.get("/coverage")
async def list_coverage(asset_id: Optional[str] = None, coverage_type: Optional[str] = None, state: Optional[str] = None,
                        vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    return await maint_svc.list_coverage(db, vu.vendor_id, asset_id=asset_id, coverage_type=coverage_type, state=state)


@router.post("/coverage", status_code=201)
async def create_coverage(body: dict = Body(...), vu: VendorUser = _perm("assets.manage"), db: AsyncSession = Depends(get_db)):
    row = await maint_svc.create_coverage(db, vu.vendor_id, body, vu)
    await db.commit()
    return to_dict(row)


@router.put("/coverage/{coverage_id}")
async def update_coverage(coverage_id: UUID, body: dict = Body(...), vu: VendorUser = _perm("assets.manage"),
                          db: AsyncSession = Depends(get_db)):
    row = await maint_svc.update_coverage(db, vu.vendor_id, coverage_id, body)
    await db.commit()
    return to_dict(row)


@router.delete("/coverage/{coverage_id}", status_code=204)
async def delete_coverage(coverage_id: UUID, vu: VendorUser = _perm("assets.manage"), db: AsyncSession = Depends(get_db)):
    await maint_svc.delete_coverage(db, vu.vendor_id, coverage_id)
    await db.commit()
    return Response(status_code=204)


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Software licences
# ═════════════════════════════════════════════════════════════════════════════════════════════════
@router.get("/licenses")
async def list_licenses(vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    return await lic_svc.list_licenses(db, vu.vendor_id, reveal_key=_can(vu, "assets.manage"))


@router.post("/licenses", status_code=201)
async def create_license(body: dict = Body(...), vu: VendorUser = _perm("assets.manage"), db: AsyncSession = Depends(get_db)):
    lic = await lic_svc.create_license(db, vu.vendor_id, body)
    await db.commit()
    return await lic_svc.get_license(db, vu.vendor_id, lic.id, reveal_key=True)


@router.get("/licenses/{license_id}")
async def get_license(license_id: UUID, vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    return await lic_svc.get_license(db, vu.vendor_id, license_id, reveal_key=_can(vu, "assets.manage"))


@router.put("/licenses/{license_id}")
async def update_license(license_id: UUID, body: dict = Body(...), vu: VendorUser = _perm("assets.manage"),
                         db: AsyncSession = Depends(get_db)):
    await lic_svc.update_license(db, vu.vendor_id, license_id, body)
    await db.commit()
    return await lic_svc.get_license(db, vu.vendor_id, license_id, reveal_key=True)


@router.delete("/licenses/{license_id}", status_code=204)
async def delete_license(license_id: UUID, vu: VendorUser = _perm("assets.manage"), db: AsyncSession = Depends(get_db)):
    await lic_svc.delete_license(db, vu.vendor_id, license_id)
    await db.commit()
    return Response(status_code=204)


@router.post("/licenses/{license_id}/seats", status_code=201)
async def assign_seat(license_id: UUID, body: dict = Body(...), vu: VendorUser = _perm("assets.manage"),
                      db: AsyncSession = Depends(get_db)):
    seat = await lic_svc.assign_seat(db, vu.vendor_id, license_id, body, vu)
    await db.commit()
    return to_dict(seat)


@router.delete("/licenses/seats/{seat_id}")
async def revoke_seat(seat_id: UUID, vu: VendorUser = _perm("assets.manage"), db: AsyncSession = Depends(get_db)):
    seat = await lic_svc.revoke_seat(db, vu.vendor_id, seat_id, vu)
    await db.commit()
    return to_dict(seat)


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# HR integration
# ═════════════════════════════════════════════════════════════════════════════════════════════════
@router.get("/me")
async def my_assets(vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    """What the signed-in user currently holds."""
    me = await custody.current_employee_for(db, vu.vendor_id, vu)
    if me is None:
        return {"employee_id": None, "assets": [], "licenses": [], "outstanding": 0}
    return await custody.employee_summary(db, vu.vendor_id, me.id)


@router.get("/employees/{employee_id}/summary")
async def employee_summary(employee_id: UUID,
                           vu: VendorUser = Depends(require_any_permission("assets.view", "hr.view")),
                           db: AsyncSession = Depends(get_db)):
    return await custody.employee_summary(db, vu.vendor_id, employee_id)


@router.post("/employees/{employee_id}/offboard")
async def offboard_employee(employee_id: UUID, body: dict = Body(default_factory=dict),
                            vu: VendorUser = Depends(require_any_permission("assets.manage", "hr.manage")),
                            db: AsyncSession = Depends(get_db)):
    res = await custody.offboard_employee(db, vu.vendor_id, employee_id, body, vu)
    await db.commit()
    return res


@router.get("/pickers/employees")
async def pick_employees(q: Optional[str] = None, limit: int = Query(300, ge=1, le=1000), vu: VendorUser = VIEW,
                         db: AsyncSession = Depends(get_db)):
    """Light employee lookup for custody forms, so asset users don't need the full HR permission."""
    from sqlalchemy import or_
    from app.models.hr import Department, EmployeeProfile
    conds = [EmployeeProfile.vendor_id == vu.vendor_id, EmployeeProfile.status != "exited"]
    if q and q.strip():
        like = f"%{q.strip()}%"
        conds.append(or_(EmployeeProfile.full_name.ilike(like), EmployeeProfile.employee_code.ilike(like)))
    rows = (await db.execute(
        select(EmployeeProfile.id, EmployeeProfile.full_name, EmployeeProfile.employee_code, Department.name)
        .outerjoin(Department, Department.id == EmployeeProfile.department_id)
        .where(*conds).order_by(EmployeeProfile.full_name).limit(limit))).all()
    return [{"id": str(r[0]), "name": r[1] or r[2] or "Employee", "code": r[2], "department": r[3]} for r in rows]


@router.get("/pickers/departments")
async def pick_departments(vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    from app.models.hr import Department
    rows = (await db.execute(select(Department.id, Department.name).where(
        Department.vendor_id == vu.vendor_id, Department.is_active.isnot(False)).order_by(Department.name))).all()
    return [{"id": str(r[0]), "name": r[1]} for r in rows]


@router.get("/pickers/stores")
async def pick_stores(vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    from app.models.store import Store
    rows = (await db.execute(select(Store.id, Store.name).where(Store.vendor_id == vu.vendor_id)
                             .order_by(Store.name))).all()
    return [{"id": str(r[0]), "name": r[1]} for r in rows]


@router.get("/pickers/suppliers")
async def pick_suppliers(q: Optional[str] = None, limit: int = Query(20, ge=1, le=100), vu: VendorUser = VIEW,
                         db: AsyncSession = Depends(get_db)):
    """Supplier master lookup for service-provider fields (searches name, code, GSTIN, phone, e-mail)."""
    from sqlalchemy import or_
    from app.models.procurement import Supplier
    conds = [Supplier.vendor_id == vu.vendor_id, Supplier.is_active.isnot(False), Supplier.party_type != "employee"]
    if q and q.strip():
        like = f"%{q.strip()}%"
        conds.append(or_(Supplier.name.ilike(like), Supplier.company_name.ilike(like), Supplier.master_code.ilike(like),
                         Supplier.gstin.ilike(like), Supplier.phone.ilike(like), Supplier.email.ilike(like)))
    rows = (await db.execute(select(Supplier).where(*conds).order_by(Supplier.name).limit(limit))).scalars().all()
    return [{"id": str(s.id), "name": s.name, "code": s.master_code, "gstin": s.gstin, "phone": s.phone, "email": s.email}
            for s in rows]


@router.get("/pickers/purchase-orders")
async def pick_purchase_orders(supplier_id: UUID, vu: VendorUser = Depends(require_any_permission("assets.manage", "assets.finance")),
                               db: AsyncSession = Depends(get_db)):
    """A supplier's purchase orders (not cancelled), newest first, to tag a work order."""
    from app.models.procurement import PurchaseOrder
    rows = (await db.execute(
        select(PurchaseOrder.id, PurchaseOrder.po_number, PurchaseOrder.status, PurchaseOrder.order_date,
               PurchaseOrder.total, PurchaseOrder.currency)
        .where(PurchaseOrder.vendor_id == vu.vendor_id, PurchaseOrder.supplier_id == supplier_id,
               PurchaseOrder.status != "cancelled")
        .order_by(PurchaseOrder.created_at.desc()).limit(100))).all()
    return [{"id": str(r[0]), "po_number": r[1], "status": r[2], "date": r[3].isoformat() if r[3] else None,
             "total": float(r[4] or 0), "currency": r[5]} for r in rows]


@router.get("/pickers/vendor-bills")
async def pick_vendor_bills(supplier_id: UUID, vu: VendorUser = Depends(require_any_permission("assets.manage", "assets.finance")),
                            db: AsyncSession = Depends(get_db)):
    """A supplier's bills (not void), newest first, to tag a work order."""
    from app.models.finance import FinVendorBill
    rows = (await db.execute(
        select(FinVendorBill.id, FinVendorBill.bill_no, FinVendorBill.status, FinVendorBill.bill_date, FinVendorBill.total,
               FinVendorBill.balance_due, FinVendorBill.currency, FinVendorBill.po_id)
        .where(FinVendorBill.vendor_id == vu.vendor_id, FinVendorBill.supplier_id == supplier_id,
               FinVendorBill.status != "void")
        .order_by(FinVendorBill.bill_date.desc()).limit(100))).all()
    return [{"id": str(r[0]), "bill_no": r[1], "status": r[2], "date": r[3].isoformat() if r[3] else None,
             "total": float(r[4] or 0), "balance_due": float(r[5] or 0), "currency": r[6],
             "po_id": str(r[7]) if r[7] else None} for r in rows]


@router.get("/pickers/fin-categories")
async def pick_fin_categories(vu: VendorUser = Depends(require_any_permission("assets.finance", "finance.assets.manage")),
                              db: AsyncSession = Depends(get_db)):
    from app.models.finance import FinAssetCategory
    rows = (await db.execute(select(FinAssetCategory).where(FinAssetCategory.vendor_id == vu.vendor_id)
                             .order_by(FinAssetCategory.name))).scalars().all()
    return [{"id": str(r.id), "name": r.name, "useful_life_years": r.useful_life_years,
             "depreciation_method": r.depreciation_method} for r in rows]


@router.get("/pickers/fin-assets")
async def pick_fin_assets(q: Optional[str] = None, vu: VendorUser = Depends(
        require_any_permission("assets.finance", "finance.assets.manage")), db: AsyncSession = Depends(get_db)):
    """Finance fixed assets not yet linked to a register entry (for the 'link to Finance' dialog)."""
    from app.models.finance import FinAsset
    conds = [FinAsset.vendor_id == vu.vendor_id,
             ~FinAsset.id.in_(select(AmAsset.fin_asset_id).where(AmAsset.vendor_id == vu.vendor_id,
                                                                  AmAsset.fin_asset_id.isnot(None)))]
    if q and q.strip():
        conds.append(FinAsset.name.ilike(f"%{q.strip()}%"))
    rows = (await db.execute(select(FinAsset).where(*conds).order_by(FinAsset.name).limit(50))).scalars().all()
    return [{"id": str(r.id), "name": r.name, "asset_code": getattr(r, "asset_code", None)} for r in rows]


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Finance integration (module level)
# ═════════════════════════════════════════════════════════════════════════════════════════════════
@router.post("/finance/import")
async def import_from_finance(vu: VendorUser = _perm("assets.finance"), db: AsyncSession = Depends(get_db)):
    """Bring existing Finance fixed assets into the module (idempotent)."""
    res = await finance_bridge.import_from_finance(db, vu.vendor_id, vu)
    await db.commit()
    return res


@router.get("/finance/summary")
async def finance_summary(vu: VendorUser = Depends(require_any_permission("assets.finance", "finance.assets.manage")),
                          db: AsyncSession = Depends(get_db)):
    return await finance_bridge.finance_summary(db, vu.vendor_id)


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Single asset (path parameter routes last)
# ═════════════════════════════════════════════════════════════════════════════════════════════════
@router.get("/{asset_id}")
async def get_asset_detail(asset_id: UUID, vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    out = await assets_svc.get_asset_detail(db, vu.vendor_id, asset_id)
    if out.get("fin_asset_id") and _can(vu, "assets.finance", "finance.assets.manage"):
        asset = await get_asset(db, vu.vendor_id, asset_id)
        out["finance"] = await finance_bridge.fin_block(db, vu.vendor_id, asset)
    return out


@router.put("/{asset_id}")
async def update_asset(asset_id: UUID, body: dict = Body(...), vu: VendorUser = _perm("assets.manage"),
                       db: AsyncSession = Depends(get_db)):
    asset = await assets_svc.update_asset(db, vu.vendor_id, asset_id, body, vu)
    await db.commit()
    return (await assets_svc.assets_out(db, [asset]))[0]


@router.get("/{asset_id}/timeline")
async def asset_timeline(asset_id: UUID, limit: int = Query(200, ge=1, le=500), vu: VendorUser = VIEW,
                         db: AsyncSession = Depends(get_db)):
    return await assets_svc.timeline(db, vu.vendor_id, asset_id, limit)


@router.get("/{asset_id}/qr.svg")
async def asset_qr(asset_id: UUID, vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    asset = await get_asset(db, vu.vendor_id, asset_id)
    return Response(labels_svc.qr_svg(asset), media_type="image/svg+xml")


@router.post("/{asset_id}/checkout", status_code=201)
async def checkout(asset_id: UUID, body: dict = Body(...), vu: VendorUser = _perm("assets.manage"),
                   db: AsyncSession = Depends(get_db)):
    row = await custody.checkout(db, vu.vendor_id, asset_id, body, vu)
    await db.commit()
    return to_dict(row)


@router.post("/{asset_id}/checkin")
async def checkin(asset_id: UUID, body: dict = Body(default_factory=dict), vu: VendorUser = _perm("assets.manage"),
                  db: AsyncSession = Depends(get_db)):
    row = await custody.checkin(db, vu.vendor_id, asset_id, body, vu)
    await db.commit()
    return to_dict(row)


@router.post("/{asset_id}/reassign", status_code=201)
async def reassign(asset_id: UUID, body: dict = Body(...), vu: VendorUser = _perm("assets.manage"),
                   db: AsyncSession = Depends(get_db)):
    row = await custody.reassign(db, vu.vendor_id, asset_id, body, vu)
    await db.commit()
    return to_dict(row)


@router.get("/{asset_id}/documents")
async def list_documents(asset_id: UUID, vu: VendorUser = VIEW, db: AsyncSession = Depends(get_db)):
    asset = await get_asset(db, vu.vendor_id, asset_id)
    rows = (await db.execute(select(AmDocument).where(
        AmDocument.vendor_id == vu.vendor_id, AmDocument.asset_id == asset.id).order_by(AmDocument.created_at.desc()))).scalars().all()
    return [to_dict(r) for r in rows]


@router.post("/{asset_id}/documents", status_code=201)
async def upload_document(
    asset_id: UUID, file: UploadFile = File(...), doc_type: str = Form("other"), notes: Optional[str] = Form(None),
    vu: VendorUser = _perm("assets.manage"), db: AsyncSession = Depends(get_db),
):
    asset = await get_asset(db, vu.vendor_id, asset_id)
    check_choice(doc_type, DOCUMENT_TYPES, "doc_type")
    meta = await media_upload.save_asset_document(file, vu.vendor_id, asset.id)
    doc = AmDocument(
        vendor_id=vu.vendor_id, asset_id=asset.id, doc_type=doc_type, name=meta["filename"][:255], file_url=meta["url"],
        content_type=meta["content_type"], size=meta["size"], is_image=bool(meta["is_image"]),
        notes=clean_str(notes), uploaded_by=actor_id(vu),
    )
    db.add(doc)
    if doc_type == "photo" and meta["is_image"] and not asset.image_url:
        asset.image_url = meta["url"]
    await db.flush()
    await record_event(db, vu.vendor_id, asset.id, "document_added", f"Document added: {doc.name}",
                       {"document_id": str(doc.id), "doc_type": doc_type}, actor_id(vu))
    await db.commit()
    return to_dict(doc)


@router.delete("/{asset_id}/documents/{doc_id}", status_code=204)
async def delete_document(asset_id: UUID, doc_id: UUID, vu: VendorUser = _perm("assets.manage"),
                          db: AsyncSession = Depends(get_db)):
    asset = await get_asset(db, vu.vendor_id, asset_id)
    doc = (await db.execute(select(AmDocument).where(
        AmDocument.id == doc_id, AmDocument.asset_id == asset.id, AmDocument.vendor_id == vu.vendor_id))).scalar_one_or_none()
    if doc is None:
        raise HTTPException(404, "Document not found")
    url = doc.file_url
    if asset.image_url == url:
        asset.image_url = None
    await record_event(db, vu.vendor_id, asset.id, "document_removed", f"Document removed: {doc.name}", {}, actor_id(vu))
    await db.delete(doc)
    await db.commit()
    try:
        await media_upload.delete_stored_file(url)   # best effort; the row is already gone
    except Exception:
        pass
    return Response(status_code=204)


@router.post("/{asset_id}/dispose")
async def dispose_asset(asset_id: UUID, body: dict = Body(default_factory=dict), vu: VendorUser = _perm("assets.manage"),
                        db: AsyncSession = Depends(get_db)):
    asset = await get_asset(db, vu.vendor_id, asset_id, lock=True)
    if asset.fin_asset_id and not _can(vu, "assets.finance"):
        raise HTTPException(403, "This asset is capitalised in Finance. Disposal needs the assets.finance permission.")
    res = await finance_bridge.dispose(db, vu.vendor_id, asset, body, vu)
    await db.commit()
    return res


@router.post("/{asset_id}/capitalize")
async def capitalize_asset(asset_id: UUID, body: dict = Body(default_factory=dict), vu: VendorUser = _perm("assets.finance"),
                           db: AsyncSession = Depends(get_db)):
    asset = await get_asset(db, vu.vendor_id, asset_id, lock=True)
    res = await finance_bridge.capitalize(db, vu.vendor_id, asset, body, vu)
    await db.commit()
    return res


@router.post("/{asset_id}/finance/link")
async def link_finance_asset(asset_id: UUID, body: dict = Body(...), vu: VendorUser = _perm("assets.finance"),
                             db: AsyncSession = Depends(get_db)):
    asset = await get_asset(db, vu.vendor_id, asset_id, lock=True)
    res = await finance_bridge.link_existing(db, vu.vendor_id, asset, body.get("fin_asset_id"), vu)
    await db.commit()
    return res


@router.delete("/{asset_id}/finance/link", status_code=204)
async def unlink_finance_asset(asset_id: UUID, vu: VendorUser = _perm("assets.finance"), db: AsyncSession = Depends(get_db)):
    asset = await get_asset(db, vu.vendor_id, asset_id, lock=True)
    await finance_bridge.unlink(db, vu.vendor_id, asset, vu)
    await db.commit()
    return Response(status_code=204)
