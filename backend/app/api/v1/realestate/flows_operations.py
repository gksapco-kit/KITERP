"""Workflow endpoints — Phase 6: leasing, facility, society and asset management."""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.models.realestate import operations as O
from app.services.realestate import assets as asv
from app.services.realestate import facility as fac
from app.services.realestate import leasing as ls
from app.services.realestate import society as soc
from app.services.realestate.common import Ctx, audit, get_owned

from .ctx import ctx_dep

router = APIRouter()

view = ctx_dep("realestate.view")
manage = ctx_dep("realestate.manage")
money_dep = ctx_dep("realestate.collections")


def truthy(v: Any) -> bool:
    return v is True or str(v).strip().lower() in ("yes", "true", "1", "y")


async def _own(ctx: Ctx, model, id_: uuid.UUID, label: str):
    return await get_owned(ctx.db, model, ctx.vendor_id, id_, label)


class _Reason(BaseModel):
    reason: str = ""


class _ReceiveIn(BaseModel):
    amount: Decimal
    paid_on: Optional[date] = None
    mode: str = "neft"
    reference: Optional[str] = None


# ═══ report builders (generic KPI + table payload the UI renders) ═══════════════════════════

def _kpi(label: str, value: Any, fmt: str = "number", tone: Optional[str] = None) -> dict:
    return {"label": label, "value": value, "format": fmt, "tone": tone}


def _col(key: str, label: str, fmt: str = "text") -> dict:
    return {"key": key, "label": label, "format": fmt}


MONTH_PARAM = {"name": "month", "label": "Month (any date in it)", "type": "date", "required": True}


@router.get("/leasing/overview", summary="Rent roll, arrears, deposits and renewals")
async def leasing_overview(ctx: Ctx = Depends(view)):
    s = await ls.summary(ctx.db, ctx.vendor_id)
    await ctx.db.commit()  # persists leases that have just expired
    a = s["aging"]
    return {
        "title": "Leasing overview",
        "kpis": [_kpi("Active leases", s["active_leases"]), _kpi("Monthly rent roll", s["monthly_rent_roll"], "money"),
                 _kpi("Rent receivable", s["receivable"], "money", "warn" if s["receivable"] else None),
                 _kpi("Overdue", s["overdue"], "money", "bad" if s["overdue"] else None),
                 _kpi("Deposits held", s["deposits_held"], "money"), _kpi("Expiring in 90 days", s["expiring_90d"], "number", "warn" if s["expiring_90d"] else None)],
        "actions": [{"label": "Generate rent invoices", "path": "/rent-invoices/generate", "method": "POST", "params": [MONTH_PARAM],
                     "confirm": "Raise rent invoices for every active lease for this month? Leases already billed are skipped."}],
        "tables": [
            {"title": "Rent aging", "columns": [_col("bucket", "Days overdue"), _col("amount", "Outstanding", "money")],
             "rows": [{"bucket": k, "amount": v} for k, v in a.items()]},
            {"title": "Largest arrears", "columns": [_col("tenant", "Tenant"), _col("outstanding", "Outstanding", "money")], "rows": s["top_arrears"]},
            {"title": "Renewals due", "columns": [_col("lease_no", "Lease"), _col("tenant", "Tenant"), _col("unit", "Unit"), _col("end_date", "Ends", "date"),
                                                   _col("days_left", "Days left", "number"), _col("current_rent", "Rent", "money"), _col("stage", "Stage", "badge"),
                                                   _col("renewal", "Renewal")], "rows": s["renewals"]},
        ],
    }


@router.get("/leasing/renewals", summary="Leases ending soon and their renewal state")
async def leasing_renewals(days: int = 120, ctx: Ctx = Depends(view)):
    await ls.expire_leases(ctx.db, ctx.vendor_id)
    rows = await ls.renewals(ctx.db, ctx.vendor_id, max(1, min(days, 730)))
    await ctx.db.commit()
    return {
        "title": "Renewals",
        "kpis": [_kpi("Ending within window", len(rows)), _kpi("Notice due", len([r for r in rows if r["stage"] == "notice_due"]), "number", "warn"),
                 _kpi("Overdue", len([r for r in rows if r["stage"] == "overdue"]), "number", "bad"),
                 _kpi("Renewal in progress", len([r for r in rows if r["stage"] == "renewal_in_progress"]))],
        "tables": [{"title": "Leases", "columns": [_col("lease_no", "Lease"), _col("tenant", "Tenant"), _col("unit", "Unit"), _col("end_date", "Ends", "date"),
                                                   _col("days_left", "Days left", "number"), _col("current_rent", "Rent", "money"), _col("stage", "Stage", "badge"),
                                                   _col("renewal", "Renewal")], "rows": rows}],
    }


@router.get("/facility/overview", summary="Work orders, preventive maintenance, utilities, housekeeping and security")
async def facility_overview(ctx: Ctx = Depends(view)):
    s = await fac.summary(ctx.db, ctx.vendor_id)
    return {
        "title": "Facility overview",
        "kpis": [_kpi("Open work orders", s["open_work_orders"]), _kpi("Overdue", s["overdue_work_orders"], "number", "bad" if s["overdue_work_orders"] else None),
                 _kpi("Avg days to complete", s["avg_days_to_complete"], "number"), _kpi("PM due now", s["pm_due"], "number", "warn" if s["pm_due"] else None),
                 _kpi("Unresolved security", s["unresolved_security"], "number", "bad" if s["unresolved_security"] else None),
                 _kpi("Housekeeping done (month)", s["housekeeping_done_pct"] if s["housekeeping_done_pct"] is not None else "—",
                      "percent" if s["housekeeping_done_pct"] is not None else "text"),
                 _kpi("Utility cost (month)", s["utility_cost_month"], "money"), _kpi("Maintenance cost", s["maintenance_cost"], "money")],
        "actions": [{"label": "Create due PM work orders", "path": "/pm-schedules/run-due", "method": "POST", "params": [],
                     "confirm": "Create a work order for every preventive-maintenance schedule that is due?"}],
        "tables": [
            {"title": "Overdue work orders", "columns": [_col("wo_no", "WO"), _col("title", "Title"), _col("priority", "Priority", "badge"),
                                                          _col("due_date", "Due", "date"), _col("assigned_to", "Assigned to")], "rows": s["overdue"]},
            {"title": "By category", "columns": [_col("category", "Category", "badge"), _col("open", "Open", "number"), _col("done", "Done", "number"),
                                                  _col("cost", "Cost", "money")], "rows": s["by_category"]},
        ],
    }


@router.get("/society/overview", summary="Maintenance billing, collections and defaulters")
async def society_overview(project_id: Optional[uuid.UUID] = None, ctx: Ctx = Depends(view)):
    s = await soc.summary(ctx.db, ctx.vendor_id, project_id)
    return {
        "title": "Society overview",
        "kpis": [_kpi("Billed", s["billed"], "money"), _kpi("Collected", s["collected"], "money"),
                 _kpi("Collection", s["collection_pct"] if s["collection_pct"] is not None else "—", "percent" if s["collection_pct"] is not None else "text"),
                 _kpi("Overdue", s["overdue"], "money", "bad" if s["overdue"] else None), _kpi("Residents", s["active_residents"]),
                 _kpi("Visitors inside", s["visitors_inside"]), _kpi("Live notices", s["live_notices"])],
        "tables": [
            {"title": "Dues aging", "columns": [_col("bucket", "Days overdue"), _col("amount", "Outstanding", "money")],
             "rows": [{"bucket": k, "amount": v} for k, v in s["aging"].items()]},
            {"title": "Defaulters", "columns": [_col("unit", "Unit"), _col("resident", "Resident"), _col("phone", "Phone"), _col("overdue", "Overdue", "money")],
             "rows": s["defaulters"]},
        ],
    }


@router.get("/assets/overview", summary="Asset register, book value and attention list")
async def assets_overview(ctx: Ctx = Depends(view)):
    s = await asv.register(ctx.db, ctx.vendor_id)
    return {
        "title": "Asset register",
        "kpis": [_kpi("Assets in service", s["assets"]), _kpi("Under maintenance", s["under_maintenance"]), _kpi("Purchase cost", s["total_cost"], "money"),
                 _kpi("Net book value", s["total_book_value"], "money"), _kpi("Maintenance spend (YTD)", s["maintenance_spend_ytd"], "money"),
                 _kpi("Disposed", s["disposed"])],
        "tables": [
            {"title": "Needs attention", "columns": [_col("asset_code", "Asset"), _col("name", "Name"), _col("project", "Project"), _col("next_maintenance_on", "Next service", "date"),
                                                      _col("flags", "Flags")], "rows": s["attention"]},
            {"title": "By category", "columns": [_col("category", "Category", "badge"), _col("count", "Assets", "number"), _col("cost", "Cost", "money"),
                                                  _col("book_value", "Book value", "money")], "rows": s["by_category"]},
            {"title": "Register", "columns": [_col("asset_code", "Asset"), _col("name", "Name"), _col("category", "Category", "badge"), _col("location", "Location"),
                                               _col("purchase_cost", "Cost", "money"), _col("book_value", "Book value", "money"), _col("status", "Status", "badge")],
             "rows": s["rows"]},
        ],
    }


# ═══ leases ═════════════════════════════════════════════════════════════════════════════════

@router.post("/leases/{lease_id}/activate")
async def lease_activate(lease_id: uuid.UUID, ctx: Ctx = Depends(manage)):
    lease = await ls.lease_activate(ctx, await _own(ctx, O.ReLease, lease_id, "lease"))
    await ctx.db.commit()
    return {"message": f"Lease {lease.lease_no} is active"}


class _DepositIn(_ReceiveIn):
    mode: str = "neft"


@router.post("/leases/{lease_id}/receive-deposit")
async def lease_receive_deposit(lease_id: uuid.UUID, body: _DepositIn, ctx: Ctx = Depends(money_dep)):
    out = await ls.deposit_receive(ctx, await _own(ctx, O.ReLease, lease_id, "lease"), body.amount, body.paid_on or date.today(), body.mode, body.reference)
    await ctx.db.commit()
    return {**out, "message": f"Deposit received — ₹{out['received']:,.2f} of ₹{out['agreed']:,.2f}"}


class _BillIn(BaseModel):
    upto: Optional[date] = None


@router.post("/leases/{lease_id}/bill-rent")
async def lease_bill_rent(lease_id: uuid.UUID, body: _BillIn, ctx: Ctx = Depends(money_dep)):
    out = await ls.bill_lease(ctx, await _own(ctx, O.ReLease, lease_id, "lease"), body.upto or date.today())
    await ctx.db.commit()
    return {**out, "message": f"{len(out['created'])} invoice(s) raised, {out['skipped']} month(s) already billed"}


class _RenewIn(BaseModel):
    new_end_date: date
    rent_increase_percent: Decimal = Field(Decimal(0))


@router.post("/leases/{lease_id}/renew", status_code=201)
async def lease_renew(lease_id: uuid.UUID, body: _RenewIn, ctx: Ctx = Depends(manage)):
    new = await ls.lease_renew(ctx, await _own(ctx, O.ReLease, lease_id, "lease"), body.new_end_date, body.rent_increase_percent)
    await ctx.db.commit()
    return {"id": str(new.id), "lease_no": new.lease_no, "message": f"Renewal {new.lease_no} created as a draft at ₹{float(new.rent_amount):,.2f}/month — activate it to take effect"}


class _TerminateIn(BaseModel):
    terminated_on: date
    reason: str = ""
    waive_lock_in: Any = "no"


@router.post("/leases/{lease_id}/terminate")
async def lease_terminate(lease_id: uuid.UUID, body: _TerminateIn, ctx: Ctx = Depends(manage)):
    lease = await _own(ctx, O.ReLease, lease_id, "lease")
    out = await ls.lease_terminate(ctx, lease, body.terminated_on, body.reason, truthy(body.waive_lock_in))
    await ctx.db.commit()
    return {**out, "message": f"Lease {lease.lease_no} terminated; {out['cancelled_invoices']} future invoice(s) cancelled"}


class _RefundIn(BaseModel):
    deductions: Decimal = Decimal(0)
    reason: str = ""
    adjust_dues: Any = "no"


@router.post("/leases/{lease_id}/refund-deposit")
async def lease_refund_deposit(lease_id: uuid.UUID, body: _RefundIn, ctx: Ctx = Depends(money_dep)):
    out = await ls.deposit_refund(ctx, await _own(ctx, O.ReLease, lease_id, "lease"), body.deductions, body.reason, truthy(body.adjust_dues))
    await ctx.db.commit()
    return {**out, "message": f"Refund of ₹{out['refund']:,.2f} due to the tenant"}


# ═══ rent invoices & receipts ═══════════════════════════════════════════════════════════════

class _MonthIn(BaseModel):
    month: date


@router.post("/rent-invoices/generate")
async def rent_generate(body: _MonthIn, ctx: Ctx = Depends(money_dep)):
    out = await ls.bill_month(ctx, body.month)
    await ctx.db.commit()
    return {**out, "message": f"{len(out['created'])} invoice(s) raised for {out['month']}, {len(out['skipped'])} already billed"}


@router.post("/rent-invoices/{inv_id}/receive")
async def rent_receive(inv_id: uuid.UUID, body: _ReceiveIn, ctx: Ctx = Depends(money_dep)):
    inv = await _own(ctx, O.ReRentInvoice, inv_id, "invoice")
    r = await ls.receive(ctx, inv, "rent", body.amount, body.paid_on or date.today(), body.mode, body.reference)
    await ctx.db.commit()
    return {"receipt_no": r.receipt_no, "status": inv.status, "message": f"Receipt {r.receipt_no} — invoice {inv.invoice_no} is {inv.status}"}


@router.post("/rent-invoices/{inv_id}/cancel")
async def rent_cancel(inv_id: uuid.UUID, body: _Reason, ctx: Ctx = Depends(money_dep)):
    inv = await _own(ctx, O.ReRentInvoice, inv_id, "invoice")
    await ls.cancel_invoice(ctx, inv, body.reason)
    await ctx.db.commit()
    return {"message": f"Invoice {inv.invoice_no} cancelled"}


# ═══ facility ═══════════════════════════════════════════════════════════════════════════════

class _AssignIn(BaseModel):
    assigned_to: str = ""
    contractor_id: Optional[uuid.UUID] = None


@router.post("/facility-work-orders/{wo_id}/assign")
async def fwo_assign(wo_id: uuid.UUID, body: _AssignIn, ctx: Ctx = Depends(manage)):
    wo = await fac.fwo_assign(ctx, await _own(ctx, O.ReFacilityWorkOrder, wo_id, "work order"), body.assigned_to, body.contractor_id)
    await ctx.db.commit()
    return {"message": f"{wo.wo_no} assigned to {wo.assigned_to or 'the contractor'}"}


@router.post("/facility-work-orders/{wo_id}/start")
async def fwo_start(wo_id: uuid.UUID, ctx: Ctx = Depends(manage)):
    wo = await fac.fwo_start(ctx, await _own(ctx, O.ReFacilityWorkOrder, wo_id, "work order"))
    await ctx.db.commit()
    return {"message": f"{wo.wo_no} is in progress"}


class _CompleteIn(BaseModel):
    resolution: str = ""
    labour_cost: Decimal = Decimal(0)
    material_cost: Decimal = Decimal(0)


@router.post("/facility-work-orders/{wo_id}/complete")
async def fwo_complete(wo_id: uuid.UUID, body: _CompleteIn, ctx: Ctx = Depends(manage)):
    wo = await fac.fwo_complete(ctx, await _own(ctx, O.ReFacilityWorkOrder, wo_id, "work order"), body.resolution, body.labour_cost, body.material_cost)
    await ctx.db.commit()
    return {"message": f"{wo.wo_no} completed — cost ₹{float(wo.total_cost):,.2f}"}


@router.post("/facility-work-orders/{wo_id}/close")
async def fwo_close(wo_id: uuid.UUID, ctx: Ctx = Depends(manage)):
    wo = await fac.fwo_close(ctx, await _own(ctx, O.ReFacilityWorkOrder, wo_id, "work order"))
    await ctx.db.commit()
    return {"message": f"{wo.wo_no} closed"}


@router.post("/facility-work-orders/{wo_id}/cancel")
async def fwo_cancel(wo_id: uuid.UUID, body: _Reason, ctx: Ctx = Depends(manage)):
    wo = await fac.fwo_cancel(ctx, await _own(ctx, O.ReFacilityWorkOrder, wo_id, "work order"), body.reason)
    await ctx.db.commit()
    return {"message": f"{wo.wo_no} cancelled"}


@router.post("/pm-schedules/run-due")
async def pm_run_due(ctx: Ctx = Depends(manage)):
    out = await fac.pm_run_due(ctx, date.today())
    await ctx.db.commit()
    return {**out, "message": f"{len(out['created'])} work order(s) created, {len(out['skipped'])} already open"}


@router.post("/pm-schedules/{s_id}/generate", status_code=201)
async def pm_generate(s_id: uuid.UUID, ctx: Ctx = Depends(manage)):
    wo = await fac.pm_generate(ctx, await _own(ctx, O.RePmSchedule, s_id, "schedule"))
    await ctx.db.commit()
    return {"id": str(wo.id), "wo_no": wo.wo_no, "message": f"Work order {wo.wo_no} created"}


class _HkDone(BaseModel):
    checked_by: Optional[str] = None
    rating: Optional[int] = None
    remarks: Optional[str] = None


@router.post("/housekeeping/{h_id}/complete")
async def hk_complete(h_id: uuid.UUID, body: _HkDone, ctx: Ctx = Depends(manage)):
    await fac.hk_complete(ctx, await _own(ctx, O.ReHousekeepingLog, h_id, "task"), body.checked_by, body.rating, body.remarks)
    await ctx.db.commit()
    return {"message": "Task marked done"}


@router.post("/housekeeping/{h_id}/miss")
async def hk_miss(h_id: uuid.UUID, body: _Reason, ctx: Ctx = Depends(manage)):
    await fac.hk_miss(ctx, await _own(ctx, O.ReHousekeepingLog, h_id, "task"), body.reason)
    await ctx.db.commit()
    return {"message": "Task marked missed"}


class _ActionIn(BaseModel):
    action_taken: str = ""


@router.post("/security-logs/{s_id}/resolve")
async def security_resolve(s_id: uuid.UUID, body: _ActionIn, ctx: Ctx = Depends(manage)):
    await fac.security_resolve(ctx, await _own(ctx, O.ReSecurityLog, s_id, "log entry"), body.action_taken)
    await ctx.db.commit()
    return {"message": "Entry resolved"}


# ═══ society ════════════════════════════════════════════════════════════════════════════════

class _MoveOut(BaseModel):
    moved_out_on: Optional[date] = None


@router.post("/residents/{r_id}/move-out")
async def resident_move_out(r_id: uuid.UUID, body: _MoveOut, ctx: Ctx = Depends(manage)):
    r = await soc.resident_move_out(ctx, await _own(ctx, O.ReResident, r_id, "resident"), body.moved_out_on)
    await ctx.db.commit()
    return {"message": f"{r.name} moved out"}


@router.post("/maintenance-plans/{plan_id}/generate")
async def plan_generate(plan_id: uuid.UUID, body: _MonthIn, ctx: Ctx = Depends(money_dep)):
    out = await soc.generate_bills(ctx, await _own(ctx, O.ReMaintenancePlan, plan_id, "plan"), body.month)
    await ctx.db.commit()
    return {**out, "message": f"{len(out['created'])} bill(s) raised for {out['period']}, {len(out['skipped'])} skipped"}


@router.post("/maintenance-bills/{b_id}/receive")
async def bill_receive(b_id: uuid.UUID, body: _ReceiveIn, ctx: Ctx = Depends(money_dep)):
    b = await _own(ctx, O.ReMaintenanceBill, b_id, "bill")
    r = await ls.receive(ctx, b, "maintenance", body.amount, body.paid_on or date.today(), body.mode, body.reference)
    await ctx.db.commit()
    return {"receipt_no": r.receipt_no, "status": b.status, "message": f"Receipt {r.receipt_no} — bill {b.bill_no} is {b.status}"}


@router.post("/maintenance-bills/{b_id}/cancel")
async def bill_cancel(b_id: uuid.UUID, body: _Reason, ctx: Ctx = Depends(money_dep)):
    b = await _own(ctx, O.ReMaintenanceBill, b_id, "bill")
    await soc.cancel_bill(ctx, b, body.reason)
    await ctx.db.commit()
    return {"message": f"Bill {b.bill_no} cancelled"}


@router.post("/visitors/{v_id}/check-in")
async def visitor_check_in(v_id: uuid.UUID, ctx: Ctx = Depends(manage)):
    v = await soc.visitor_check_in(ctx, await _own(ctx, O.ReVisitor, v_id, "visitor"))
    await ctx.db.commit()
    return {"message": f"{v.visitor_name} checked in"}


@router.post("/visitors/{v_id}/check-out")
async def visitor_check_out(v_id: uuid.UUID, ctx: Ctx = Depends(manage)):
    v = await soc.visitor_check_out(ctx, await _own(ctx, O.ReVisitor, v_id, "visitor"))
    await ctx.db.commit()
    return {"message": f"{v.visitor_name} checked out"}


@router.post("/visitors/{v_id}/deny")
async def visitor_deny(v_id: uuid.UUID, body: _Reason, ctx: Ctx = Depends(manage)):
    v = await soc.visitor_deny(ctx, await _own(ctx, O.ReVisitor, v_id, "visitor"), body.reason)
    await ctx.db.commit()
    return {"message": f"Entry denied to {v.visitor_name}"}


@router.post("/notices/{n_id}/publish")
async def notice_publish(n_id: uuid.UUID, ctx: Ctx = Depends(manage)):
    n = await soc.notice_publish(ctx, await _own(ctx, O.ReNotice, n_id, "notice"))
    await ctx.db.commit()
    return {"message": f"“{n.title}” published"}


@router.post("/notices/{n_id}/unpublish")
async def notice_unpublish(n_id: uuid.UUID, ctx: Ctx = Depends(manage)):
    n = await soc.notice_unpublish(ctx, await _own(ctx, O.ReNotice, n_id, "notice"))
    await ctx.db.commit()
    return {"message": f"“{n.title}” withdrawn"}


# ═══ assets ═════════════════════════════════════════════════════════════════════════════════

@router.get("/assets/{asset_id}/book-value")
async def asset_book_value(asset_id: uuid.UUID, on: Optional[date] = None, ctx: Ctx = Depends(view)):
    a = await _own(ctx, O.ReAsset, asset_id, "asset")
    bv = asv.book_value(a, on)
    return {"asset_code": a.asset_code, "as_on": (on or a.disposed_on or date.today()).isoformat(), "purchase_cost": float(a.purchase_cost or 0),
            "book_value": float(bv), "accumulated_depreciation": float((a.purchase_cost or 0) - bv), "method": a.depreciation_method,
            "message": f"Book value of {a.name} is ₹{float(bv):,.2f}"}


@router.post("/assets/{asset_id}/to-maintenance")
async def asset_to_maintenance(asset_id: uuid.UUID, ctx: Ctx = Depends(manage)):
    a = await _own(ctx, O.ReAsset, asset_id, "asset")
    if a.status != "active":
        raise HTTPException(status_code=409, detail=f"Asset is {a.status.replace('_', ' ')}")
    a.status = "under_maintenance"
    await audit(ctx, "asset", a.id, "to_maintenance", ref=a.asset_code)
    await ctx.db.commit()
    return {"message": f"{a.name} is out of service"}


@router.post("/assets/{asset_id}/back-in-service")
async def asset_back(asset_id: uuid.UUID, ctx: Ctx = Depends(manage)):
    a = await _own(ctx, O.ReAsset, asset_id, "asset")
    if a.status != "under_maintenance":
        raise HTTPException(status_code=409, detail=f"Asset is {a.status.replace('_', ' ')}")
    a.status = "active"
    await audit(ctx, "asset", a.id, "back_in_service", ref=a.asset_code)
    await ctx.db.commit()
    return {"message": f"{a.name} is back in service"}


@router.post("/asset-transfers/{t_id}/complete")
async def transfer_complete(t_id: uuid.UUID, ctx: Ctx = Depends(manage)):
    await asv.transfer_complete(ctx, await _own(ctx, O.ReAssetTransfer, t_id, "transfer"))
    await ctx.db.commit()
    return {"message": "Transfer completed"}


@router.post("/asset-transfers/{t_id}/cancel")
async def transfer_cancel(t_id: uuid.UUID, ctx: Ctx = Depends(manage)):
    await asv.transfer_cancel(ctx, await _own(ctx, O.ReAssetTransfer, t_id, "transfer"))
    await ctx.db.commit()
    return {"message": "Transfer cancelled"}
