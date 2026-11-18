"""Preventive-maintenance plans, work orders, and warranty / insurance / AMC coverage."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset_mgmt import (
    COVERAGE_TYPES, WORK_ORDER_TYPES, AmAsset, AmCoverage, AmMaintenancePlan, AmWorkOrder,
)
from app.models.finance import FinVendorBill
from app.models.hr import EmployeeProfile
from app.models.procurement import PurchaseOrder, Supplier
from app.services.asset_mgmt import finance_bridge
from app.services.asset_mgmt.assets import has_open_assignment
from app.services.asset_mgmt.common import (
    actor_id, as_date, as_decimal, as_uuid, assert_owned, check_choice, clean_str, get_asset, get_owned, jsonable,
    next_number, pick, record_event, to_dict,
)

_PRIORITIES = ("low", "medium", "high", "urgent")


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Supplier / PO / bill linking
# ═════════════════════════════════════════════════════════════════════════════════════════════════
async def _provider_fields(db: AsyncSession, vendor_id: UUID, data: dict, name_key: str) -> dict:
    """``{supplier_id, <name_key>}`` for a request that names a provider; ``{}`` when it says nothing about one.

    A ``supplier_id`` must be a supplier of this tenant, and its name is copied into ``name_key`` so existing
    screens, exports and the Finance bridge keep working with plain text. Without an id, the typed name is kept
    as a free-text provider (a technician who is not in the supplier master yet).
    """
    if "supplier_id" not in data and name_key not in data:
        return {}
    sid = as_uuid(data.get("supplier_id"), "supplier_id")
    if sid is None:
        return {"supplier_id": None, name_key: clean_str(data.get(name_key), 200)}
    name = (await db.execute(select(Supplier.name).where(Supplier.id == sid, Supplier.vendor_id == vendor_id))).scalar_one_or_none()
    if name is None:
        raise HTTPException(404, "Supplier not found")
    return {"supplier_id": sid, name_key: clean_str(name, 200)}


async def _apply_wo_links(db: AsyncSession, vendor_id: UUID, wo: AmWorkOrder, data: dict) -> None:
    """Set the supplier, purchase order and supplier bill of a work order, keeping the three consistent."""
    old_supplier = wo.supplier_id
    fields = await _provider_fields(db, vendor_id, data, "service_provider")
    for k, v in fields.items():
        setattr(wo, k, v)
    # Changing the supplier invalidates documents that belong to the previous one.
    if fields and wo.supplier_id != old_supplier:
        if "purchase_order_id" not in data:
            wo.purchase_order_id = None
        if "vendor_bill_id" not in data:
            wo.vendor_bill_id = None

    if "purchase_order_id" in data:
        po_id = as_uuid(data.get("purchase_order_id"), "purchase_order_id")
        if po_id is None:
            wo.purchase_order_id = None
        else:
            po = (await db.execute(select(PurchaseOrder).where(
                PurchaseOrder.id == po_id, PurchaseOrder.vendor_id == vendor_id))).scalar_one_or_none()
            if po is None:
                raise HTTPException(404, "Purchase order not found")
            if po.status == "cancelled":
                raise HTTPException(409, f"Purchase order {po.po_number} is cancelled")
            if wo.supplier_id and po.supplier_id != wo.supplier_id:
                raise HTTPException(400, f"Purchase order {po.po_number} belongs to a different supplier")
            wo.purchase_order_id = po.id
            if wo.supplier_id is None:    # adopt the PO's supplier
                wo.supplier_id = po.supplier_id
                wo.service_provider = clean_str(
                    (await db.execute(select(Supplier.name).where(Supplier.id == po.supplier_id))).scalar_one_or_none(), 200)

    if "vendor_bill_id" in data:
        bill_id = as_uuid(data.get("vendor_bill_id"), "vendor_bill_id")
        if bill_id is None:
            wo.vendor_bill_id = None
        else:
            if wo.journal_entry_id:
                raise HTTPException(409, "This work order's cost is already posted to the ledger, so a bill cannot be linked. "
                                         "Link the bill instead of posting the cost.")
            bill = (await db.execute(select(FinVendorBill).where(
                FinVendorBill.id == bill_id, FinVendorBill.vendor_id == vendor_id))).scalar_one_or_none()
            if bill is None:
                raise HTTPException(404, "Supplier bill not found")
            if bill.status == "void":
                raise HTTPException(409, f"Bill {bill.bill_no} is void")
            if wo.supplier_id and bill.supplier_id != wo.supplier_id:
                raise HTTPException(400, f"Bill {bill.bill_no} belongs to a different supplier")
            if bill.po_id and wo.purchase_order_id and bill.po_id != wo.purchase_order_id:
                raise HTTPException(400, f"Bill {bill.bill_no} is against a different purchase order")
            wo.vendor_bill_id = bill.id
            if wo.supplier_id is None:
                wo.supplier_id = bill.supplier_id
                wo.service_provider = clean_str(
                    (await db.execute(select(Supplier.name).where(Supplier.id == bill.supplier_id))).scalar_one_or_none(), 200)
            if bill.po_id and wo.purchase_order_id is None:
                wo.purchase_order_id = bill.po_id


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Plans
# ═════════════════════════════════════════════════════════════════════════════════════════════════
def _compute_next_due(interval_days: Optional[int], last_done_on: Optional[date], base: Optional[date]) -> Optional[date]:
    if not interval_days:
        return None
    return (last_done_on or base or date.today()) + timedelta(days=interval_days)


async def _plan_payload(db: AsyncSession, vendor_id: UUID, data: dict, *, partial: bool) -> dict:
    p = pick(data, ("name", "description", "interval_days", "interval_meter", "last_done_on", "last_done_meter",
                    "priority", "estimated_cost", "service_provider", "is_active"))
    if "name" in p:
        p["name"] = clean_str(p["name"], 200)
        if not p["name"]:
            raise HTTPException(400, "Plan name is required")
    elif not partial:
        raise HTTPException(400, "Plan name is required")
    if "interval_days" in p:
        v = p["interval_days"]
        p["interval_days"] = int(v) if v not in (None, "", 0, "0") else None
        if p["interval_days"] is not None and not 1 <= p["interval_days"] <= 3650:
            raise HTTPException(400, "interval_days must be between 1 and 3650")
    for k in ("interval_meter", "last_done_meter", "estimated_cost"):
        if k in p:
            p[k] = as_decimal(p[k], k)
    if "interval_meter" in p and p["interval_meter"] is not None and p["interval_meter"] <= 0:
        p["interval_meter"] = None
    if "last_done_on" in p:
        p["last_done_on"] = as_date(p["last_done_on"], "last_done_on")
    if "priority" in p:
        check_choice(p["priority"], _PRIORITIES, "priority")
    if "description" in p:
        p["description"] = clean_str(p["description"])
    p.pop("service_provider", None)
    p.update(await _provider_fields(db, vendor_id, data, "service_provider"))
    if "is_active" in p:
        p["is_active"] = bool(p["is_active"])
    return p


async def create_plan(db: AsyncSession, vendor_id: UUID, data: dict, vu: Any) -> AmMaintenancePlan:
    asset = await get_asset(db, vendor_id, data.get("asset_id"))
    p = await _plan_payload(db, vendor_id, data, partial=False)
    if not p.get("interval_days") and not p.get("interval_meter"):
        raise HTTPException(400, "Set a time interval (days), a meter interval, or both")
    plan = AmMaintenancePlan(vendor_id=vendor_id, asset_id=asset.id, **p)
    plan.next_due_on = _compute_next_due(plan.interval_days, plan.last_done_on, date.today())
    db.add(plan)
    await db.flush()
    await record_event(db, vendor_id, asset.id, "plan_added", f"Maintenance plan: {plan.name}", {"plan_id": str(plan.id)}, actor_id(vu))
    return plan


async def update_plan(db: AsyncSession, vendor_id: UUID, plan_id: Any, data: dict) -> AmMaintenancePlan:
    plan = await get_owned(db, AmMaintenancePlan, plan_id, vendor_id, "Plan")
    p = await _plan_payload(db, vendor_id, data, partial=True)
    for k, v in p.items():
        setattr(plan, k, v)
    if not plan.interval_days and not plan.interval_meter:
        raise HTTPException(400, "A plan needs a time interval, a meter interval, or both")
    plan.next_due_on = _compute_next_due(plan.interval_days, plan.last_done_on, date.today())
    await db.flush()
    return plan


async def delete_plan(db: AsyncSession, vendor_id: UUID, plan_id: Any) -> None:
    plan = await get_owned(db, AmMaintenancePlan, plan_id, vendor_id, "Plan")
    await db.delete(plan)
    await db.flush()


def _meter_due(plan: AmMaintenancePlan, asset: AmAsset) -> bool:
    if not plan.interval_meter or asset.meter_reading is None:
        return False
    base = plan.last_done_meter or Decimal(0)
    return Decimal(str(asset.meter_reading)) - Decimal(str(base)) >= Decimal(str(plan.interval_meter))


async def list_plans(db: AsyncSession, vendor_id: UUID, *, asset_id: Any = None, due_within_days: Optional[int] = None) -> list[dict]:
    q = (select(AmMaintenancePlan, AmAsset.asset_tag, AmAsset.name, AmAsset.meter_reading, AmAsset.meter_unit)
         .join(AmAsset, AmAsset.id == AmMaintenancePlan.asset_id)
         .where(AmMaintenancePlan.vendor_id == vendor_id).order_by(AmMaintenancePlan.next_due_on.asc().nullslast()))
    if asset_id:
        q = q.where(AmMaintenancePlan.asset_id == as_uuid(asset_id))
    rows = (await db.execute(q)).all()
    today = date.today()
    out = []
    for plan, tag, name, meter, unit in rows:
        stub = AmAsset(meter_reading=meter)
        due_meter = _meter_due(plan, stub)
        days = (plan.next_due_on - today).days if plan.next_due_on else None
        if due_within_days is not None and not (due_meter or (days is not None and days <= due_within_days)):
            continue
        out.append({**to_dict(plan), "asset_tag": tag, "asset_name": name, "meter_reading": jsonable(meter),
                    "meter_unit": unit, "days_until_due": days, "is_due": bool(due_meter or (days is not None and days <= 0)),
                    "meter_due": due_meter})
    return out


async def generate_due_work_orders(db: AsyncSession, vendor_id: UUID, *, lead_days: int = 7, vu: Any = None) -> list[AmWorkOrder]:
    """Create a preventive work order for every active plan that is due (or due within ``lead_days``) and has
    no open work order yet. Idempotent: safe to run daily and on demand."""
    today = date.today()
    rows = (await db.execute(
        select(AmMaintenancePlan, AmAsset)
        .join(AmAsset, AmAsset.id == AmMaintenancePlan.asset_id)
        .where(AmMaintenancePlan.vendor_id == vendor_id, AmMaintenancePlan.is_active.is_(True),
               AmAsset.status.notin_(("disposed", "retired", "lost")))
    )).all()
    created: list[AmWorkOrder] = []
    for plan, asset in rows:
        time_due = plan.next_due_on is not None and plan.next_due_on <= today + timedelta(days=lead_days)
        if not (time_due or _meter_due(plan, asset)):
            continue
        open_wo = (await db.execute(select(AmWorkOrder.id).where(
            AmWorkOrder.plan_id == plan.id, AmWorkOrder.status.in_(("open", "in_progress"))).limit(1))).first()
        if open_wo:
            continue
        wo = AmWorkOrder(
            vendor_id=vendor_id, wo_no=await next_number(db, vendor_id, "workorder", "WO"), asset_id=asset.id,
            plan_id=plan.id, wo_type="preventive", title=plan.name, description=plan.description,
            priority=plan.priority or "medium", scheduled_on=max(plan.next_due_on or today, today) if time_due else today,
            service_provider=plan.service_provider, supplier_id=plan.supplier_id,
            created_by=actor_id(vu) if vu else None,
        )
        db.add(wo)
        await db.flush()
        await record_event(db, vendor_id, asset.id, "work_order_created", f"{wo.wo_no}: {wo.title} (scheduled)",
                           {"work_order_id": str(wo.id), "plan_id": str(plan.id)}, actor_id(vu) if vu else None)
        created.append(wo)
    return created


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Work orders
# ═════════════════════════════════════════════════════════════════════════════════════════════════
async def create_work_order(db: AsyncSession, vendor_id: UUID, data: dict, vu: Any) -> AmWorkOrder:
    asset = await get_asset(db, vendor_id, data.get("asset_id"), lock=True)
    if asset.status in ("disposed", "retired"):
        raise HTTPException(409, f"Asset is {asset.status}")
    title = clean_str(data.get("title"), 200)
    if not title:
        raise HTTPException(400, "Work order title is required")
    wo = AmWorkOrder(
        vendor_id=vendor_id, wo_no=await next_number(db, vendor_id, "workorder", "WO"), asset_id=asset.id,
        wo_type=check_choice(clean_str(data.get("wo_type")) or "corrective", WORK_ORDER_TYPES, "wo_type"),
        title=title, description=clean_str(data.get("description")),
        priority=check_choice(clean_str(data.get("priority")) or "medium", _PRIORITIES, "priority"),
        scheduled_on=as_date(data.get("scheduled_on"), "scheduled_on") or date.today(),
        assigned_employee_id=await assert_owned(db, EmployeeProfile, data.get("assigned_employee_id"), vendor_id, "Employee"),
        created_by=actor_id(vu),
    )
    await _apply_wo_links(db, vendor_id, wo, data)
    db.add(wo)
    await db.flush()
    await record_event(db, vendor_id, asset.id, "work_order_created", f"{wo.wo_no}: {wo.title}",
                       {"work_order_id": str(wo.id), "type": wo.wo_type}, actor_id(vu))
    return wo


async def update_work_order_links(db: AsyncSession, vendor_id: UUID, wo_id: Any, data: dict, vu: Any) -> AmWorkOrder:
    """Change the supplier / purchase order / supplier bill of a work order at any stage."""
    wo = await get_owned(db, AmWorkOrder, wo_id, vendor_id, "Work order", lock=True)
    await _apply_wo_links(db, vendor_id, wo, data)
    await db.flush()
    await record_event(db, vendor_id, wo.asset_id, "work_order_linked", f"{wo.wo_no}: supplier / PO / bill updated",
                       {"work_order_id": str(wo.id), "supplier_id": wo.supplier_id, "purchase_order_id": wo.purchase_order_id,
                        "vendor_bill_id": wo.vendor_bill_id}, actor_id(vu))
    return wo


async def start_work_order(db: AsyncSession, vendor_id: UUID, wo_id: Any, data: dict, vu: Any) -> AmWorkOrder:
    wo = await get_owned(db, AmWorkOrder, wo_id, vendor_id, "Work order", lock=True)
    if wo.status != "open":
        raise HTTPException(409, f"Work order is already {wo.status.replace('_', ' ')}")
    asset = await get_asset(db, vendor_id, wo.asset_id, lock=True)
    wo.status, wo.started_at = "in_progress", datetime.now(timezone.utc)
    if data.get("take_out_of_service", wo.wo_type != "inspection") and asset.status in ("in_stock", "assigned"):
        asset.status = "under_maintenance"
    await record_event(db, vendor_id, asset.id, "maintenance_started", f"{wo.wo_no} started", {"work_order_id": str(wo.id)}, actor_id(vu))
    await db.flush()
    return wo


async def complete_work_order(db: AsyncSession, vendor_id: UUID, wo_id: Any, data: dict, vu: Any) -> dict:
    wo = await get_owned(db, AmWorkOrder, wo_id, vendor_id, "Work order", lock=True)
    if wo.status not in ("open", "in_progress"):
        raise HTTPException(409, f"Work order is already {wo.status}")
    asset = await get_asset(db, vendor_id, wo.asset_id, lock=True)

    labor = as_decimal(data.get("cost_labor"), "cost_labor") or Decimal(0)
    parts_list = data.get("parts") or []
    if not isinstance(parts_list, list):
        raise HTTPException(400, "parts must be a list")
    parts: list[dict] = []
    parts_cost = Decimal(0)
    for prt in parts_list[:100]:
        qty = as_decimal(prt.get("qty") or 1, "part qty") or Decimal(1)
        unit = as_decimal(prt.get("unit_cost") or 0, "part unit_cost") or Decimal(0)
        parts_cost += qty * unit
        parts.append({"name": clean_str(prt.get("name"), 200) or "Part", "qty": float(qty), "unit_cost": float(unit)})
    if "cost_parts" in data and not parts:
        parts_cost = as_decimal(data.get("cost_parts"), "cost_parts") or Decimal(0)
    wo.cost_labor, wo.cost_parts, wo.cost_total = labor, parts_cost, labor + parts_cost
    wo.parts = parts
    wo.downtime_hours = as_decimal(data.get("downtime_hours"), "downtime_hours")
    wo.resolution_notes = clean_str(data.get("resolution_notes"))
    if data.get("supplier_id") or data.get("service_provider") or "purchase_order_id" in data or "vendor_bill_id" in data:
        await _apply_wo_links(db, vendor_id, wo, data)
    wo.capitalize = bool(data.get("capitalize", False))
    meter = as_decimal(data.get("meter_reading"), "meter_reading")
    if meter is not None:
        wo.meter_reading = meter
        asset.meter_reading = max(Decimal(str(asset.meter_reading or 0)), meter)
    wo.status, wo.completed_at = "completed", datetime.now(timezone.utc)
    if wo.started_at is None:
        wo.started_at = wo.completed_at

    cond = check_choice(clean_str(data.get("condition_after")), ("new", "good", "fair", "poor", "damaged"), "condition_after")
    if cond:
        asset.condition = cond
    # Back into service, to wherever custody says the asset belongs.
    if asset.status == "under_maintenance":
        others = (await db.execute(select(func.count(AmWorkOrder.id)).where(
            AmWorkOrder.asset_id == asset.id, AmWorkOrder.id != wo.id, AmWorkOrder.status == "in_progress"))).scalar_one()
        if not others:
            asset.status = "assigned" if await has_open_assignment(db, asset.id) else "in_stock"

    if wo.plan_id:
        plan = await db.get(AmMaintenancePlan, wo.plan_id)
        if plan is not None and plan.vendor_id == vendor_id:
            plan.last_done_on = date.today()
            plan.last_done_meter = asset.meter_reading
            plan.next_due_on = _compute_next_due(plan.interval_days, plan.last_done_on, None)

    gl: dict[str, Any] = {"posted": False}
    if wo.vendor_bill_id:
        # The supplier bill books this cost when it is posted; posting it here as well would count it twice.
        bill = await db.get(FinVendorBill, wo.vendor_bill_id)
        gl = {"posted": False, "linked_bill": True, "bill_no": bill.bill_no if bill else None,
              "journal_entry_id": str(bill.journal_entry_id) if bill and bill.journal_entry_id else None}
    elif wo.cost_total and wo.cost_total > 0 and data.get("post_to_gl", asset.fin_asset_id is not None):
        gl = await finance_bridge.post_maintenance_cost(db, vendor_id, asset, wo, vu)

    await record_event(db, vendor_id, asset.id, "maintenance_completed", f"{wo.wo_no} completed",
                       {"work_order_id": str(wo.id), "cost": wo.cost_total, "gl": gl}, actor_id(vu))
    await db.flush()
    return {"work_order": to_dict(wo), "gl": gl}


async def cancel_work_order(db: AsyncSession, vendor_id: UUID, wo_id: Any, vu: Any) -> AmWorkOrder:
    wo = await get_owned(db, AmWorkOrder, wo_id, vendor_id, "Work order", lock=True)
    if wo.status not in ("open", "in_progress"):
        raise HTTPException(409, f"Work order is already {wo.status}")
    asset = await get_asset(db, vendor_id, wo.asset_id, lock=True)
    was_running = wo.status == "in_progress"
    wo.status = "cancelled"
    if was_running and asset.status == "under_maintenance":
        others = (await db.execute(select(func.count(AmWorkOrder.id)).where(
            AmWorkOrder.asset_id == asset.id, AmWorkOrder.id != wo.id, AmWorkOrder.status == "in_progress"))).scalar_one()
        if not others:
            asset.status = "assigned" if await has_open_assignment(db, asset.id) else "in_stock"
    await record_event(db, vendor_id, asset.id, "work_order_cancelled", f"{wo.wo_no} cancelled", {"work_order_id": str(wo.id)}, actor_id(vu))
    await db.flush()
    return wo


async def list_work_orders(db: AsyncSession, vendor_id: UUID, *, status: Optional[str] = None, asset_id: Any = None,
                           page: int = 1, size: int = 50) -> dict:
    conds = [AmWorkOrder.vendor_id == vendor_id]
    if status:
        conds.append(AmWorkOrder.status.in_([s for s in status.split(",") if s]))
    if asset_id:
        conds.append(AmWorkOrder.asset_id == as_uuid(asset_id))
    total = (await db.execute(select(func.count(AmWorkOrder.id)).where(*conds))).scalar_one()
    rows = (await db.execute(
        select(AmWorkOrder, AmAsset.asset_tag, AmAsset.name, EmployeeProfile.full_name, AmAsset.fin_asset_id,
               PurchaseOrder.po_number, PurchaseOrder.status, FinVendorBill.bill_no, FinVendorBill.status)
        .join(AmAsset, AmAsset.id == AmWorkOrder.asset_id)
        .outerjoin(EmployeeProfile, EmployeeProfile.id == AmWorkOrder.assigned_employee_id)
        .outerjoin(PurchaseOrder, PurchaseOrder.id == AmWorkOrder.purchase_order_id)
        .outerjoin(FinVendorBill, FinVendorBill.id == AmWorkOrder.vendor_bill_id)
        .where(*conds).order_by(AmWorkOrder.created_at.desc()).offset((page - 1) * size).limit(size)
    )).all()
    today = date.today()
    return {"items": [{**to_dict(w), "asset_tag": tag, "asset_name": name, "assigned_name": emp,
                       "asset_is_capitalized": fin_id is not None,
                       "po_number": po_no, "po_status": po_st, "bill_no": bill_no, "bill_status": bill_st,
                       "is_overdue": bool(w.status in ("open", "in_progress") and w.scheduled_on and w.scheduled_on < today)}
                      for w, tag, name, emp, fin_id, po_no, po_st, bill_no, bill_st in rows],
            "total": total, "page": page, "size": size}


# ═════════════════════════════════════════════════════════════════════════════════════════════════
# Coverage (warranty / insurance / AMC)
# ═════════════════════════════════════════════════════════════════════════════════════════════════
async def _coverage_payload(db: AsyncSession, vendor_id: UUID, data: dict, *, partial: bool) -> dict:
    p = pick(data, ("coverage_type", "provider", "reference_no", "start_date", "end_date", "cost", "coverage_amount",
                    "contact", "terms", "renewal_alert_days", "is_active"))
    if "coverage_type" in p:
        check_choice(p["coverage_type"], COVERAGE_TYPES, "coverage_type")
    elif not partial:
        raise HTTPException(400, "coverage_type is required (warranty, insurance or amc)")
    for k in ("start_date", "end_date"):
        if k in p:
            p[k] = as_date(p[k], k)
    for k in ("cost", "coverage_amount"):
        if k in p:
            p[k] = as_decimal(p[k], k)
    if "renewal_alert_days" in p:
        p["renewal_alert_days"] = max(0, min(int(p["renewal_alert_days"] or 30), 365))
    for k, n in (("reference_no", 120), ("contact", 200), ("terms", None)):
        if k in p:
            p[k] = clean_str(p[k], n)
    p.pop("provider", None)
    p.update(await _provider_fields(db, vendor_id, data, "provider"))
    if "is_active" in p:
        p["is_active"] = bool(p["is_active"])
    return p


async def create_coverage(db: AsyncSession, vendor_id: UUID, data: dict, vu: Any) -> AmCoverage:
    asset = await get_asset(db, vendor_id, data.get("asset_id"))
    p = await _coverage_payload(db, vendor_id, data, partial=False)
    if p.get("start_date") and p.get("end_date") and p["end_date"] < p["start_date"]:
        raise HTTPException(400, "End date must be on or after the start date")
    row = AmCoverage(vendor_id=vendor_id, asset_id=asset.id, **p)
    db.add(row)
    await db.flush()
    await record_event(db, vendor_id, asset.id, "coverage_added",
                       f"{row.coverage_type.upper()} added" + (f" until {row.end_date:%d %b %Y}" if row.end_date else ""),
                       {"coverage_id": str(row.id)}, actor_id(vu))
    return row


async def update_coverage(db: AsyncSession, vendor_id: UUID, coverage_id: Any, data: dict) -> AmCoverage:
    row = await get_owned(db, AmCoverage, coverage_id, vendor_id, "Coverage")
    p = await _coverage_payload(db, vendor_id, data, partial=True)
    for k, v in p.items():
        setattr(row, k, v)
    if row.start_date and row.end_date and row.end_date < row.start_date:
        raise HTTPException(400, "End date must be on or after the start date")
    if "end_date" in p:
        row.last_alerted_on = None     # a renewed end date re-arms the expiry alert
    await db.flush()
    return row


async def delete_coverage(db: AsyncSession, vendor_id: UUID, coverage_id: Any) -> None:
    row = await get_owned(db, AmCoverage, coverage_id, vendor_id, "Coverage")
    await db.delete(row)
    await db.flush()


def coverage_state(c: AmCoverage, today: Optional[date] = None) -> str:
    today = today or date.today()
    if not c.is_active:
        return "inactive"
    if c.end_date is None:
        return "active"
    if c.end_date < today:
        return "expired"
    if (c.end_date - today).days <= (c.renewal_alert_days or 30):
        return "expiring"
    return "active"


async def list_coverage(db: AsyncSession, vendor_id: UUID, *, asset_id: Any = None, coverage_type: Optional[str] = None,
                        state: Optional[str] = None) -> list[dict]:
    q = (select(AmCoverage, AmAsset.asset_tag, AmAsset.name).join(AmAsset, AmAsset.id == AmCoverage.asset_id)
         .where(AmCoverage.vendor_id == vendor_id).order_by(AmCoverage.end_date.asc().nullslast()))
    if asset_id:
        q = q.where(AmCoverage.asset_id == as_uuid(asset_id))
    if coverage_type:
        q = q.where(AmCoverage.coverage_type == check_choice(coverage_type, COVERAGE_TYPES, "coverage_type"))
    today = date.today()
    out = []
    for c, tag, name in (await db.execute(q)).all():
        st = coverage_state(c, today)
        if state and st != state:
            continue
        out.append({**to_dict(c), "asset_tag": tag, "asset_name": name, "state": st,
                    "days_left": (c.end_date - today).days if c.end_date else None})
    return out
