"""Phase 1 workflow endpoints: property, sales/CRM, booking & allotment, customers."""
from __future__ import annotations

import re
import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.models.realestate import core as C
from app.models.realestate.admin import ReApprovalRequest
from app.services.realestate import booking as booking_svc
from app.services.realestate.approvals import decide
from app.services.realestate.common import Ctx, D, audit, get_owned, jsonable, money_q, next_number, row_dict
from app.services.realestate.pricing import cost_sheet, unit_total_price
from app.services.realestate.sales import customer_from_lead, recompute_kyc, refresh_lead_followup
from app.services.realestate.templates import render_template

from .crud import mask_pii, serialize
from .ctx import ctx_dep

router = APIRouter()

view = ctx_dep("realestate.view")
manage = ctx_dep("realestate.manage")
sales = ctx_dep("realestate.sales")
booking_dep = ctx_dep("realestate.booking")
legal = ctx_dep("realestate.legal")
approve_perm = ctx_dep("realestate.approve")


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ═══ Module 1 — Property ═══════════════════════════════════════════════════════════════════

class GenerateUnitsIn(BaseModel):
    unit_type_id: Optional[uuid.UUID] = None
    floors_from: int = Field(1, ge=0, le=300)
    floors_to: int = Field(..., ge=0, le=300)
    units_per_floor: int = Field(..., ge=1, le=60)
    start_index: int = Field(1, ge=0, le=99)


@router.post("/towers/{tower_id}/generate-units", summary="Bulk-generate units for a tower")
async def generate_units(tower_id: uuid.UUID, body: GenerateUnitsIn, ctx: Ctx = Depends(manage)):
    tower = await get_owned(ctx.db, C.ReTower, ctx.vendor_id, tower_id, "tower")
    if body.floors_to < body.floors_from:
        raise HTTPException(status_code=422, detail="floors_to must be >= floors_from")
    total = (body.floors_to - body.floors_from + 1) * body.units_per_floor
    if total > 2000:
        raise HTTPException(status_code=422, detail="Cannot generate more than 2000 units in one request")
    utype = None
    if body.unit_type_id:
        utype = await get_owned(ctx.db, C.ReUnitType, ctx.vendor_id, body.unit_type_id, "unit type")
        if utype.project_id != tower.project_id:
            raise HTTPException(status_code=422, detail="Unit type belongs to a different project")
    existing = set(
        (await ctx.db.execute(
            select(C.ReUnit.unit_number).where(C.ReUnit.tower_id == tower.id)
        )).scalars().all()
    )
    created, skipped = 0, 0
    for floor in range(body.floors_from, body.floors_to + 1):
        for i in range(body.units_per_floor):
            number = f"{floor}{body.start_index + i:02d}"
            if number in existing:
                skipped += 1
                continue
            unit = C.ReUnit(
                id=uuid.uuid4(), vendor_id=ctx.vendor_id, project_id=tower.project_id, tower_id=tower.id,
                unit_type_id=utype.id if utype else None, unit_number=number, floor_number=floor,
                category=utype.category if utype else "apartment", status="available",
                bedrooms=utype.bedrooms if utype else 0, bathrooms=utype.bathrooms if utype else 0,
                carpet_area=utype.carpet_area if utype else 0, built_up_area=utype.built_up_area if utype else 0,
                super_area=utype.super_area if utype else 0, base_rate=utype.base_rate if utype else 0,
            )
            unit.total_price = unit_total_price(unit)
            ctx.db.add(unit)
            created += 1
    tower.total_floors = max(tower.total_floors or 0, body.floors_to)
    tower.units_per_floor = max(tower.units_per_floor or 0, body.units_per_floor)
    await audit(ctx, "tower", tower.id, "generate_units", ref=tower.name, changes={"created": created, "skipped": skipped})
    await ctx.db.commit()
    return {"created": created, "skipped": skipped, "message": f"{created} unit(s) created, {skipped} skipped"}


@router.post("/price-lists/{price_list_id}/apply", summary="Apply a price list to project units")
async def apply_price_list(price_list_id: uuid.UUID, ctx: Ctx = Depends(manage)):
    pl = await get_owned(ctx.db, C.RePriceList, ctx.vendor_id, price_list_id, "price list")
    units = (
        await ctx.db.execute(
            select(C.ReUnit).where(
                C.ReUnit.project_id == pl.project_id, C.ReUnit.status.in_(("available", "hold"))
            )
        )
    ).scalars().all()
    plc_map = {str(k).lower(): D(v) for k, v in (pl.plc_by_facing or {}).items()}
    updated = 0
    for u in units:
        if D(pl.base_rate) > 0:
            u.base_rate = pl.base_rate
        if D(pl.floor_rise_per_floor) > 0:
            steps = max(0, (u.floor_number or 0) - ((pl.floor_rise_from_floor or 1) - 1))
            u.floor_rise_rate = D(pl.floor_rise_per_floor) * steps
        if u.facing and u.facing.lower() in plc_map:
            u.plc_amount = plc_map[u.facing.lower()]
        for src, dst in (("parking_amount", "parking_amount"), ("club_amount", "club_amount"), ("other_charges", "other_charges")):
            if D(getattr(pl, src)) > 0:
                setattr(u, dst, getattr(pl, src))
        u.total_price = unit_total_price(u)
        updated += 1
    others = (
        await ctx.db.execute(
            select(C.RePriceList).where(
                C.RePriceList.project_id == pl.project_id, C.RePriceList.status == "active", C.RePriceList.id != pl.id
            )
        )
    ).scalars().all()
    for o in others:
        o.status = "archived"
    pl.status = "active"
    await audit(ctx, "price_list", pl.id, "apply", ref=pl.name, changes={"units": updated})
    await ctx.db.commit()
    return {"updated": updated, "message": f"Price list applied to {updated} unit(s)"}


@router.get("/units/availability", summary="Availability grid grouped by tower and floor")
async def availability(
    project_id: uuid.UUID = Query(...), tower_id: Optional[uuid.UUID] = None, ctx: Ctx = Depends(view),
):
    await get_owned(ctx.db, C.ReProject, ctx.vendor_id, project_id, "project")
    if await booking_svc.release_expired_blocks(ctx.db, ctx.vendor_id):
        await ctx.db.commit()
    q = select(C.ReUnit).where(C.ReUnit.vendor_id == ctx.vendor_id, C.ReUnit.project_id == project_id)
    if tower_id:
        q = q.where(C.ReUnit.tower_id == tower_id)
    units = (await ctx.db.execute(q.order_by(C.ReUnit.floor_number.desc(), C.ReUnit.unit_number))).scalars().all()
    towers = {t.id: t for t in (
        await ctx.db.execute(select(C.ReTower).where(C.ReTower.project_id == project_id))
    ).scalars().all()}
    summary: dict[str, int] = defaultdict(int)
    grid: dict[Optional[uuid.UUID], dict[int, list]] = defaultdict(lambda: defaultdict(list))
    for u in units:
        summary[u.status] += 1
        grid[u.tower_id][u.floor_number or 0].append({
            "id": str(u.id), "unit_number": u.unit_number, "status": u.status, "category": u.category,
            "area": float(u.super_area or u.built_up_area or u.carpet_area or 0), "price": float(u.total_price or 0),
            "bedrooms": u.bedrooms, "facing": u.facing,
        })
    out_towers = []
    for tid, floors in grid.items():
        t = towers.get(tid)
        out_towers.append({
            "id": str(tid) if tid else None, "name": t.name if t else "Unassigned",
            "floors": [{"floor": f, "units": floors[f]} for f in sorted(floors, reverse=True)],
        })
    out_towers.sort(key=lambda t: t["name"])
    return {"total": len(units), "summary": dict(summary), "towers": out_towers}


@router.get("/projects/{project_id}/inventory-summary", summary="Inventory counts, values and ageing")
async def inventory_summary(project_id: uuid.UUID, ctx: Ctx = Depends(view)):
    await get_owned(ctx.db, C.ReProject, ctx.vendor_id, project_id, "project")
    units = (await ctx.db.execute(select(C.ReUnit).where(C.ReUnit.project_id == project_id))).scalars().all()
    by_status: dict[str, dict] = defaultdict(lambda: {"count": 0, "value": 0.0})
    by_category: dict[str, int] = defaultdict(int)
    ageing = {"0-90": 0, "91-180": 0, "181-365": 0, "365+": 0}
    today = date.today()
    for u in units:
        s = by_status[u.status]
        s["count"] += 1
        s["value"] += float(u.total_price or 0)
        by_category[u.category] += 1
        if u.status == "available" and u.created_at:
            age = (today - u.created_at.date()).days
            ageing["0-90" if age <= 90 else "91-180" if age <= 180 else "181-365" if age <= 365 else "365+"] += 1
    sold = sum(v["count"] for k, v in by_status.items() if k in ("booked", "sold", "handed_over"))
    return {
        "total_units": len(units), "sold_units": sold,
        "sold_percent": round(sold / len(units) * 100, 2) if units else 0,
        "by_status": dict(by_status), "by_category": dict(by_category), "unsold_ageing_days": ageing,
        "inventory_value": round(sum(float(u.total_price or 0) for u in units), 2),
    }


class BlockIn(BaseModel):
    lead_id: Optional[uuid.UUID] = None
    customer_id: Optional[uuid.UUID] = None
    hours: int = 48
    token_amount: Decimal = Decimal(0)
    reason: Optional[str] = ""


@router.post("/units/{unit_id}/block", summary="Block (hold) a unit for a prospect")
async def block_unit(unit_id: uuid.UUID, body: BlockIn, ctx: Ctx = Depends(booking_dep)):
    block = await booking_svc.block_unit(
        ctx, unit_id, lead_id=body.lead_id, customer_id=body.customer_id, hours=body.hours,
        token_amount=body.token_amount, reason=body.reason or "",
    )
    await ctx.db.commit()
    return {"id": str(block.id), "expires_at": block.expires_at.isoformat(), "message": "Unit blocked"}


@router.post("/unit-blocks/{block_id}/release")
async def release_block(block_id: uuid.UUID, ctx: Ctx = Depends(booking_dep)):
    block = await get_owned(ctx.db, C.ReUnitBlock, ctx.vendor_id, block_id, "block")
    await booking_svc.release_block(ctx, block)
    await ctx.db.commit()
    return {"message": "Block released"}


@router.get("/units/{unit_id}/cost-sheet", summary="Cost sheet for a unit")
async def unit_cost_sheet(unit_id: uuid.UUID, discount: Decimal = Query(Decimal(0), ge=0), ctx: Ctx = Depends(view)):
    unit = await get_owned(ctx.db, C.ReUnit, ctx.vendor_id, unit_id, "unit")
    project = await ctx.db.get(C.ReProject, unit.project_id)
    sheet = cost_sheet(unit, project, discount=discount)
    values = {
        **jsonable(sheet),
        "unit_number": unit.unit_number,
        "project_name": getattr(project, "name", ""),
        "developer_entity": getattr(project, "developer_entity", "") or getattr(project, "name", ""),
        "rera_number": getattr(project, "rera_number", "") or "",
        "date": datetime.now(timezone.utc).strftime("%d %b %Y"),
    }
    rendered = await render_template(ctx.db, ctx.vendor_id, "cost_sheet", values)
    return {**jsonable(sheet), "html": rendered["html"]}


def _slug(text: str) -> str:
    return re.sub(r"[\s_-]+", "-", re.sub(r"[^\w\s-]", "", text.lower().strip()))[:180]


@router.post("/units/{unit_id}/publish", summary="Publish unit to the website property listings")
async def publish_unit(unit_id: uuid.UUID, ctx: Ctx = Depends(manage)):
    from app.models.vendor_property import VendorProperty

    unit = await get_owned(ctx.db, C.ReUnit, ctx.vendor_id, unit_id, "unit")
    if unit.status not in ("available", "hold"):
        raise HTTPException(status_code=409, detail="Only available units can be published")
    project = await ctx.db.get(C.ReProject, unit.project_id)
    listing = await ctx.db.get(VendorProperty, unit.listing_id) if unit.listing_id else None
    title = f"{project.name} — Unit {unit.unit_number}"
    if listing is None:
        slug = _slug(f"{project.name}-{unit.unit_number}") or str(uuid.uuid4())[:8]
        taken = (await ctx.db.execute(
            select(VendorProperty.id).where(VendorProperty.vendor_id == ctx.vendor_id, VendorProperty.slug == slug)
        )).first()
        if taken:
            slug = f"{slug}-{uuid.uuid4().hex[:6]}"
        listing = VendorProperty(id=uuid.uuid4(), vendor_id=ctx.vendor_id, slug=slug, title=title)
        ctx.db.add(listing)
    listing.title = title
    listing.address = ", ".join(p for p in (project.address, project.city, project.state) if p) or None
    listing.price = unit.total_price
    listing.currency = "INR"
    listing.beds = unit.bedrooms or 0
    listing.baths = unit.bathrooms or 0
    listing.sqft = int(unit.super_area or unit.built_up_area or unit.carpet_area or 0)
    listing.property_type = unit.category or "apartment"
    listing.status = "for-sale"
    listing.image_url = project.cover_image_url
    listing.gallery = project.gallery or []
    listing.is_active = True
    unit.listing_id = listing.id
    unit.published = True
    await audit(ctx, "unit", unit.id, "publish", ref=unit.unit_number)
    await ctx.db.commit()
    return {"listing_id": str(listing.id), "message": "Unit published to website listings"}


@router.post("/units/{unit_id}/unpublish")
async def unpublish_unit(unit_id: uuid.UUID, ctx: Ctx = Depends(manage)):
    from app.models.vendor_property import VendorProperty

    unit = await get_owned(ctx.db, C.ReUnit, ctx.vendor_id, unit_id, "unit")
    if unit.listing_id:
        listing = await ctx.db.get(VendorProperty, unit.listing_id)
        if listing is not None:
            listing.is_active = False
    unit.published = False
    await ctx.db.commit()
    return {"message": "Unit removed from website listings"}


# ═══ Module 3 — Sales & CRM ════════════════════════════════════════════════════════════════

class StageIn(BaseModel):
    stage: str
    lost_reason: Optional[str] = None


@router.post("/leads/{lead_id}/stage")
async def move_stage(lead_id: uuid.UUID, body: StageIn, ctx: Ctx = Depends(sales)):
    if body.stage not in C.PIPELINE_STAGES:
        raise HTTPException(status_code=422, detail=f"stage must be one of {', '.join(C.PIPELINE_STAGES)}")
    if body.stage == "booked":
        raise HTTPException(status_code=409, detail="A lead moves to 'booked' automatically when a booking is confirmed")
    if body.stage == "lost" and not (body.lost_reason or "").strip():
        raise HTTPException(status_code=422, detail="lost_reason is required")
    lead = await get_owned(ctx.db, C.ReLead, ctx.vendor_id, lead_id, "lead")
    if lead.stage == "booked":
        raise HTTPException(status_code=409, detail="Booked leads cannot change stage")
    old = lead.stage
    lead.stage = body.stage
    if body.stage == "lost":
        lead.lost_reason = body.lost_reason
    await audit(ctx, "lead", lead.id, "stage", ref=lead.lead_no or lead.full_name, changes={"from": old, "to": body.stage})
    await ctx.db.commit()
    return {"stage": lead.stage, "message": f"Moved to {body.stage}"}


class LostIn(BaseModel):
    reason: str = Field(..., min_length=1)


@router.post("/leads/{lead_id}/lost")
async def mark_lost(lead_id: uuid.UUID, body: LostIn, ctx: Ctx = Depends(sales)):
    return await move_stage(lead_id, StageIn(stage="lost", lost_reason=body.reason), ctx)


@router.post("/leads/{lead_id}/convert")
async def convert_lead(lead_id: uuid.UUID, ctx: Ctx = Depends(sales)):
    lead = await get_owned(ctx.db, C.ReLead, ctx.vendor_id, lead_id, "lead")
    cust = await customer_from_lead(ctx, lead)
    if lead.stage in ("new", "contacted"):
        lead.stage = "qualified"
    await audit(ctx, "lead", lead.id, "convert", ref=lead.lead_no or lead.full_name)
    await ctx.db.commit()
    return {"customer_id": str(cust.id), "message": f"Customer {cust.customer_code} linked"}


@router.get("/leads/pipeline", summary="Kanban pipeline: leads grouped by stage")
async def pipeline(
    project_id: Optional[uuid.UUID] = None, assigned_to: Optional[str] = None,
    per_stage: int = Query(30, ge=1, le=100), ctx: Ctx = Depends(view),
):
    base = [C.ReLead.vendor_id == ctx.vendor_id]
    if project_id:
        base.append(C.ReLead.project_id == project_id)
    if assigned_to:
        base.append(C.ReLead.assigned_to_name.ilike(f"%{assigned_to}%"))
    counts = {
        s: (c, float(v or 0))
        for s, c, v in (
            await ctx.db.execute(
                select(C.ReLead.stage, func.count(), func.coalesce(func.sum(C.ReLead.budget_max), 0))
                .where(*base).group_by(C.ReLead.stage)
            )
        ).all()
    }
    stages = []
    for st in C.PIPELINE_STAGES:
        rows = (
            await ctx.db.execute(
                select(C.ReLead).where(*base, C.ReLead.stage == st).order_by(C.ReLead.updated_at.desc()).limit(per_stage)
            )
        ).scalars().all()
        c, v = counts.get(st, (0, 0.0))
        stages.append({
            "stage": st, "count": c, "budget_total": v,
            "items": [{
                "id": str(r.id), "lead_no": r.lead_no, "full_name": r.full_name, "phone": r.phone, "source": r.source,
                "budget_max": float(r.budget_max or 0), "project_id": str(r.project_id) if r.project_id else None,
                "assigned_to_name": r.assigned_to_name, "next_followup_at": jsonable(r.next_followup_at),
            } for r in rows],
        })
    total = sum(s["count"] for s in stages)
    booked = counts.get("booked", (0, 0))[0]
    return {"stages": stages, "total": total, "conversion_percent": round(booked / total * 100, 2) if total else 0}


@router.post("/enquiries/{enquiry_id}/convert")
async def convert_enquiry(enquiry_id: uuid.UUID, ctx: Ctx = Depends(sales)):
    enq = await get_owned(ctx.db, C.ReEnquiry, ctx.vendor_id, enquiry_id, "enquiry")
    if enq.lead_id:
        raise HTTPException(status_code=409, detail="Enquiry already converted")
    lead = C.ReLead(
        id=uuid.uuid4(), vendor_id=ctx.vendor_id, lead_no=await next_number(ctx.db, ctx.vendor_id, "lead"),
        full_name=enq.full_name, phone=enq.phone, email=enq.email, project_id=enq.project_id,
        source="website" if enq.channel in ("website", "portal") else enq.channel if enq.channel in C.LEAD_SOURCES else "other",
        stage="new", notes=enq.message, assigned_to_user_id=ctx.user_id, assigned_to_name=ctx.actor_name,
    )
    ctx.db.add(lead)
    await ctx.db.flush()
    enq.lead_id = lead.id
    enq.status = "converted"
    enq.handled_by_name = ctx.actor_name
    await audit(ctx, "enquiry", enq.id, "convert", ref=enq.enquiry_no or enq.full_name, changes={"lead": lead.lead_no})
    await ctx.db.commit()
    return {"lead_id": str(lead.id), "message": f"Lead {lead.lead_no} created"}


class VisitCompleteIn(BaseModel):
    outcome: Optional[str] = None
    interest_level: Optional[str] = "warm"
    rating: Optional[int] = Field(None, ge=1, le=5)
    feedback: Optional[str] = None
    next_followup_at: Optional[datetime] = None


@router.post("/site-visits/{visit_id}/complete")
async def complete_visit(visit_id: uuid.UUID, body: VisitCompleteIn, ctx: Ctx = Depends(sales)):
    if body.interest_level not in ("hot", "warm", "cold"):
        raise HTTPException(status_code=422, detail="interest_level must be hot, warm or cold")
    visit = await get_owned(ctx.db, C.ReSiteVisit, ctx.vendor_id, visit_id, "site visit")
    if visit.status not in ("scheduled", "rescheduled"):
        raise HTTPException(status_code=409, detail=f"Visit is already {visit.status}")
    visit.status = "completed"
    visit.outcome = body.outcome
    visit.interest_level = body.interest_level
    visit.rating = body.rating
    visit.feedback = body.feedback
    visit.conducted_by_name = visit.conducted_by_name or ctx.actor_name
    if visit.lead_id:
        lead = await ctx.db.get(C.ReLead, visit.lead_id)
        if lead and lead.stage in ("new", "contacted", "qualified", "site_visit_scheduled"):
            lead.stage = "site_visited"
        if body.next_followup_at:
            ctx.db.add(C.ReFollowup(
                id=uuid.uuid4(), vendor_id=ctx.vendor_id, lead_id=visit.lead_id, followup_type="call",
                due_at=body.next_followup_at, status="pending", assigned_to_name=ctx.actor_name,
                assigned_to_user_id=ctx.user_id, notes="Post site-visit follow-up",
            ))
            await refresh_lead_followup(ctx.db, visit.lead_id)
    await ctx.db.commit()
    return {"message": "Site visit completed"}


class QuotationIn(BaseModel):
    unit_id: uuid.UUID
    lead_id: Optional[uuid.UUID] = None
    customer_id: Optional[uuid.UUID] = None
    payment_plan_id: Optional[uuid.UUID] = None
    discount_amount: Decimal = Decimal(0)
    valid_days: int = Field(15, ge=1, le=365)
    quote_date: Optional[date] = None
    terms: Optional[str] = None


@router.post("/quotations", status_code=201, summary="Create a quotation with a computed cost sheet")
async def create_quotation(body: QuotationIn, ctx: Ctx = Depends(sales)):
    unit = await get_owned(ctx.db, C.ReUnit, ctx.vendor_id, body.unit_id, "unit")
    for table, rid in ((C.ReLead, body.lead_id), (C.ReCustomer, body.customer_id), (C.RePaymentPlan, body.payment_plan_id)):
        if rid:
            await get_owned(ctx.db, table, ctx.vendor_id, rid)
    if body.discount_amount < 0:
        raise HTTPException(status_code=422, detail="discount_amount cannot be negative")
    project = await ctx.db.get(C.ReProject, unit.project_id)
    sheet = cost_sheet(unit, project, discount=body.discount_amount)
    comp = sheet["components"]
    qdate = body.quote_date or date.today()
    q = C.ReQuotation(
        id=uuid.uuid4(), vendor_id=ctx.vendor_id, quote_no=await next_number(ctx.db, ctx.vendor_id, "quotation"),
        lead_id=body.lead_id, customer_id=body.customer_id, project_id=unit.project_id, unit_id=unit.id,
        payment_plan_id=body.payment_plan_id, status="draft", quote_date=qdate,
        valid_until=qdate + timedelta(days=body.valid_days),
        basic_amount=D(comp["basic"]), plc_amount=D(comp["plc"]), floor_rise_amount=D(comp["floor_rise"]),
        parking_amount=D(comp["parking"]), club_amount=D(comp["club"]), other_charges=D(comp["other"]),
        discount_amount=sheet["discount"], agreement_value=sheet["agreement_value"], gst_rate=sheet["gst_rate"],
        gst_amount=sheet["gst_amount"], stamp_duty=sheet["stamp_duty"], registration_fee=sheet["registration_fee"],
        total_cost=sheet["total_cost"], cost_sheet=sheet["lines"], terms=body.terms,
        prepared_by_name=ctx.actor_name,
    )
    ctx.db.add(q)
    await ctx.db.flush()
    await audit(ctx, "quotation", q.id, "create", ref=q.quote_no)
    await ctx.db.commit()
    await ctx.db.refresh(q)
    return serialize(q)


async def _quote_status(ctx: Ctx, quote_id: uuid.UUID, allowed: tuple[str, ...], new: str) -> C.ReQuotation:
    q = await get_owned(ctx.db, C.ReQuotation, ctx.vendor_id, quote_id, "quotation")
    if q.status not in allowed:
        raise HTTPException(status_code=409, detail=f"Quotation is {q.status}; cannot move to {new}")
    q.status = new
    await audit(ctx, "quotation", q.id, new, ref=q.quote_no)
    return q


@router.post("/quotations/{quote_id}/send")
async def send_quotation(quote_id: uuid.UUID, ctx: Ctx = Depends(sales)):
    await _quote_status(ctx, quote_id, ("draft",), "sent")
    await ctx.db.commit()
    return {"message": "Quotation marked as sent"}


@router.post("/quotations/{quote_id}/accept")
async def accept_quotation(quote_id: uuid.UUID, ctx: Ctx = Depends(sales)):
    await _quote_status(ctx, quote_id, ("draft", "sent"), "accepted")
    await ctx.db.commit()
    return {"message": "Quotation accepted"}


@router.post("/quotations/{quote_id}/reject")
async def reject_quotation(quote_id: uuid.UUID, ctx: Ctx = Depends(sales)):
    await _quote_status(ctx, quote_id, ("draft", "sent"), "rejected")
    await ctx.db.commit()
    return {"message": "Quotation rejected"}


@router.get("/quotations/{quote_id}/sheet")
async def quotation_sheet(quote_id: uuid.UUID, ctx: Ctx = Depends(view)):
    q = await get_owned(ctx.db, C.ReQuotation, ctx.vendor_id, quote_id, "quotation")
    unit = await ctx.db.get(C.ReUnit, q.unit_id)
    project = await ctx.db.get(C.ReProject, q.project_id) if q.project_id else None
    values = {
        "lines": q.cost_sheet or [],
        "agreement_value": q.agreement_value,
        "gst_rate": q.gst_rate,
        "gst_amount": q.gst_amount,
        "stamp_duty": q.stamp_duty,
        "registration_fee": q.registration_fee,
        "total_cost": q.total_cost,
        "unit_number": unit.unit_number if unit else "",
        "project_name": getattr(project, "name", "") if project else "",
        "developer_entity": getattr(project, "developer_entity", "") or getattr(project, "name", "") if project else "",
        "rera_number": getattr(project, "rera_number", "") or "" if project else "",
        "quote_no": q.quote_no or "",
        "valid_until": str(q.valid_until) if q.valid_until else "",
        "date": datetime.now(timezone.utc).strftime("%d %b %Y"),
    }
    rendered = await render_template(ctx.db, ctx.vendor_id, "quotation", values)
    return {"html": rendered["html"], "total_cost": float(q.total_cost or 0)}


class QuoteToBookingIn(BaseModel):
    customer_id: Optional[uuid.UUID] = None
    token_amount: Decimal = Decimal(0)
    payment_plan_id: Optional[uuid.UUID] = None


@router.post("/quotations/{quote_id}/to-booking")
async def quotation_to_booking(quote_id: uuid.UUID, body: QuoteToBookingIn, ctx: Ctx = Depends(booking_dep)):
    q = await get_owned(ctx.db, C.ReQuotation, ctx.vendor_id, quote_id, "quotation")
    if q.status not in ("accepted", "sent"):
        raise HTTPException(status_code=409, detail=f"Quotation is {q.status}")
    customer_id = body.customer_id or q.customer_id
    if customer_id is None and q.lead_id:
        lead = await get_owned(ctx.db, C.ReLead, ctx.vendor_id, q.lead_id, "lead")
        customer_id = (await customer_from_lead(ctx, lead)).id
    if customer_id is None:
        raise HTTPException(status_code=422, detail="customer_id is required (quotation has no customer or lead)")
    booking = await booking_svc.create_booking(ctx, {
        "unit_id": q.unit_id, "customer_id": customer_id, "lead_id": q.lead_id, "quotation_id": q.id,
        "discount_amount": q.discount_amount, "token_amount": body.token_amount,
        "payment_plan_id": body.payment_plan_id or q.payment_plan_id,
    })
    q.status = "converted"
    await ctx.db.commit()
    return {"booking_id": str(booking.id), "status": booking.status, "message": f"Booking {booking.booking_no} created"}


class FollowupCompleteIn(BaseModel):
    outcome: Optional[str] = None
    next_due_at: Optional[datetime] = None


@router.post("/followups/{followup_id}/complete")
async def complete_followup(followup_id: uuid.UUID, body: FollowupCompleteIn, ctx: Ctx = Depends(sales)):
    f = await get_owned(ctx.db, C.ReFollowup, ctx.vendor_id, followup_id, "follow-up")
    if f.status not in ("pending", "missed"):
        raise HTTPException(status_code=409, detail=f"Follow-up is already {f.status}")
    f.status = "done"
    f.completed_at = _now()
    f.outcome = body.outcome
    if body.next_due_at:
        ctx.db.add(C.ReFollowup(
            id=uuid.uuid4(), vendor_id=ctx.vendor_id, lead_id=f.lead_id, customer_id=f.customer_id,
            booking_id=f.booking_id, followup_type=f.followup_type, due_at=body.next_due_at, status="pending",
            assigned_to_name=f.assigned_to_name, assigned_to_user_id=f.assigned_to_user_id,
        ))
    if f.lead_id:
        await refresh_lead_followup(ctx.db, f.lead_id)
    await ctx.db.commit()
    return {"message": "Follow-up completed"}


@router.get("/followups/summary", summary="Overdue / today / upcoming follow-up counts")
async def followup_summary(ctx: Ctx = Depends(view)):
    now = _now()
    end_today = now.replace(hour=23, minute=59, second=59, microsecond=0)
    base = [C.ReFollowup.vendor_id == ctx.vendor_id, C.ReFollowup.status == "pending"]

    async def count(*conds):
        return (await ctx.db.execute(select(func.count()).select_from(C.ReFollowup).where(*base, *conds))).scalar_one()

    return {
        "overdue": await count(C.ReFollowup.due_at < now),
        "today": await count(C.ReFollowup.due_at >= now, C.ReFollowup.due_at <= end_today),
        "upcoming": await count(C.ReFollowup.due_at > end_today),
    }


# ═══ Module 4 — Booking & Allotment ════════════════════════════════════════════════════════

class ApplicantIn(BaseModel):
    customer_id: Optional[uuid.UUID] = None
    full_name: str = Field(..., min_length=1)
    relation: Optional[str] = None
    pan: Optional[str] = None
    aadhaar_last4: Optional[str] = Field(None, max_length=4)
    phone: Optional[str] = None
    email: Optional[str] = None
    is_primary: bool = False
    share_percent: Decimal = Decimal(0)


class BookingIn(BaseModel):
    unit_id: uuid.UUID
    customer_id: uuid.UUID
    lead_id: Optional[uuid.UUID] = None
    broker_id: Optional[uuid.UUID] = None
    quotation_id: Optional[uuid.UUID] = None
    payment_plan_id: Optional[uuid.UUID] = None
    booking_date: Optional[date] = None
    discount_amount: Decimal = Decimal(0)
    token_amount: Decimal = Decimal(0)
    loan_amount: Decimal = Decimal(0)
    bank_name: Optional[str] = None
    funding: str = "self"
    nominee_name: Optional[str] = None
    remarks: Optional[str] = None
    sales_executive_name: Optional[str] = None
    applicants: list[ApplicantIn] = []


@router.post("/bookings", status_code=201, summary="Create a booking (confirms immediately unless approval is required)")
async def create_booking(body: BookingIn, ctx: Ctx = Depends(booking_dep)):
    if body.funding not in ("self", "home_loan", "mixed"):
        raise HTTPException(status_code=422, detail="funding must be self, home_loan or mixed")
    if body.quotation_id:
        await get_owned(ctx.db, C.ReQuotation, ctx.vendor_id, body.quotation_id, "quotation")
    payload = body.model_dump()
    payload["applicants"] = [a.model_dump() for a in body.applicants]
    booking = await booking_svc.create_booking(ctx, payload)
    await ctx.db.commit()
    await ctx.db.refresh(booking)
    out = serialize(booking)
    out["approval_required"] = booking.status == "pending_approval"
    return out


@router.get("/bookings/{booking_id}/summary", summary="Booking 360: unit, customer, applicants, documents")
async def booking_summary(booking_id: uuid.UUID, ctx: Ctx = Depends(view)):
    b = await get_owned(ctx.db, C.ReBooking, ctx.vendor_id, booking_id, "booking")
    unit = await ctx.db.get(C.ReUnit, b.unit_id)
    cust = await ctx.db.get(C.ReCustomer, b.customer_id)
    project = await ctx.db.get(C.ReProject, b.project_id)
    applicants = (await ctx.db.execute(select(C.ReBookingApplicant).where(C.ReBookingApplicant.booking_id == b.id))).scalars().all()
    allots = (await ctx.db.execute(select(C.ReAllotment).where(C.ReAllotment.booking_id == b.id))).scalars().all()
    agreements = (await ctx.db.execute(select(C.ReAgreement).where(C.ReAgreement.booking_id == b.id))).scalars().all()
    out = {
        "booking": serialize(b),
        "unit": serialize(unit) if unit else None,
        "customer": serialize(cust, ctx=ctx) if cust else None,
        "project": {"id": str(project.id), "name": project.name} if project else None,
        "applicants": [mask_pii(row_dict(a), a.__tablename__, ctx) for a in applicants],
        "allotments": [row_dict(a, exclude=("letter_html",)) for a in allots],
        "agreements": [row_dict(a, exclude=("content_html",)) for a in agreements],
    }
    from app.services.realestate.payments import booking_finance_summary

    out["finance"] = await booking_finance_summary(ctx.db, b)
    return out


@router.post("/bookings/{booking_id}/allot")
async def allot(booking_id: uuid.UUID, ctx: Ctx = Depends(booking_dep)):
    b = await get_owned(ctx.db, C.ReBooking, ctx.vendor_id, booking_id, "booking")
    allotment = await booking_svc.issue_allotment(ctx, b)
    await ctx.db.commit()
    return {"allotment_id": str(allotment.id), "html": allotment.letter_html, "message": f"Allotment {allotment.allotment_no} issued"}


class AgreementDraftIn(BaseModel):
    agreement_type: str = "agreement_for_sale"


@router.post("/bookings/{booking_id}/agreement")
async def draft_agreement(booking_id: uuid.UUID, body: AgreementDraftIn, ctx: Ctx = Depends(legal)):
    if body.agreement_type not in ("agreement_for_sale", "sale_deed", "builder_buyer"):
        raise HTTPException(status_code=422, detail="agreement_type must be agreement_for_sale, sale_deed or builder_buyer")
    b = await get_owned(ctx.db, C.ReBooking, ctx.vendor_id, booking_id, "booking")
    if b.status not in ("allotted", "agreement_signed", "registered"):
        raise HTTPException(status_code=409, detail="Agreements can be drafted after allotment")
    values = await booking_svc.booking_context(ctx.db, b)
    tpl = "sale_deed" if body.agreement_type == "sale_deed" else "agreement_for_sale"
    rendered = await render_template(ctx.db, ctx.vendor_id, tpl, values)
    ag = C.ReAgreement(
        id=uuid.uuid4(), vendor_id=ctx.vendor_id, agreement_no=await next_number(ctx.db, ctx.vendor_id, "agreement"),
        agreement_type=body.agreement_type, booking_id=b.id, customer_id=b.customer_id, unit_id=b.unit_id,
        project_id=b.project_id, status="draft", drafted_on=date.today(), content_html=rendered["html"],
    )
    ctx.db.add(ag)
    await ctx.db.flush()
    await audit(ctx, "agreement", ag.id, "draft", ref=ag.agreement_no)
    await ctx.db.commit()
    return {"agreement_id": str(ag.id), "html": ag.content_html, "message": f"Agreement {ag.agreement_no} drafted"}


class CancelRequestIn(BaseModel):
    reason: str = Field(..., min_length=1)
    forfeiture_percent: Decimal = Decimal(10)
    gst_adjustment: Decimal = Decimal(0)
    other_deductions: Decimal = Decimal(0)


@router.post("/bookings/{booking_id}/cancel-request")
async def cancel_request(booking_id: uuid.UUID, body: CancelRequestIn, ctx: Ctx = Depends(booking_dep)):
    b = await get_owned(ctx.db, C.ReBooking, ctx.vendor_id, booking_id, "booking")
    canc = await booking_svc.request_cancellation(
        ctx, b, reason=body.reason, forfeiture_percent=body.forfeiture_percent,
        gst_adjustment=body.gst_adjustment, other_deductions=body.other_deductions,
    )
    await ctx.db.commit()
    return {
        "cancellation_id": str(canc.id), "refundable_amount": float(canc.refundable_amount),
        "message": f"Cancellation {canc.cancellation_no} requested (refundable ₹{canc.refundable_amount:,.2f})",
    }


@router.get("/allotments/{allotment_id}/letter")
async def allotment_letter(allotment_id: uuid.UUID, ctx: Ctx = Depends(view)):
    a = await get_owned(ctx.db, C.ReAllotment, ctx.vendor_id, allotment_id, "allotment")
    return {"html": a.letter_html or "", "subject": a.allotment_no}


@router.post("/allotments/{allotment_id}/acknowledge")
async def acknowledge_allotment(allotment_id: uuid.UUID, ctx: Ctx = Depends(booking_dep)):
    a = await get_owned(ctx.db, C.ReAllotment, ctx.vendor_id, allotment_id, "allotment")
    if a.status != "issued":
        raise HTTPException(status_code=409, detail=f"Allotment is {a.status}")
    a.status = "acknowledged"
    a.acknowledged_at = _now()
    await ctx.db.commit()
    return {"message": "Allotment acknowledged"}


async def _pending_request(ctx: Ctx, entity_type: str, entity_id: uuid.UUID) -> Optional[ReApprovalRequest]:
    return (
        await ctx.db.execute(
            select(ReApprovalRequest).where(
                ReApprovalRequest.vendor_id == ctx.vendor_id, ReApprovalRequest.entity_type == entity_type,
                ReApprovalRequest.entity_id == entity_id, ReApprovalRequest.status == "pending",
            )
        )
    ).scalars().first()


@router.post("/cancellations/{cancellation_id}/approve")
async def approve_cancellation(cancellation_id: uuid.UUID, ctx: Ctx = Depends(approve_perm)):
    canc = await get_owned(ctx.db, C.ReCancellation, ctx.vendor_id, cancellation_id, "cancellation")
    req = await _pending_request(ctx, "cancellation", canc.id)
    if req is not None:
        await decide(ctx, req, True, "approved from cancellation screen")
    else:
        await booking_svc.approve_cancellation(ctx, canc)
    await ctx.db.commit()
    await ctx.db.refresh(canc)
    return {"status": canc.status, "message": "Cancellation approved; unit released"}


class RemarksIn(BaseModel):
    remarks: str = Field(..., min_length=1)


@router.post("/cancellations/{cancellation_id}/reject")
async def reject_cancellation(cancellation_id: uuid.UUID, body: RemarksIn, ctx: Ctx = Depends(approve_perm)):
    canc = await get_owned(ctx.db, C.ReCancellation, ctx.vendor_id, cancellation_id, "cancellation")
    if canc.status != "requested":
        raise HTTPException(status_code=409, detail=f"Cancellation is {canc.status}")
    req = await _pending_request(ctx, "cancellation", canc.id)
    if req is not None:
        await decide(ctx, req, False, body.remarks)
    else:
        canc.status = "rejected"
    canc.remarks = body.remarks
    await ctx.db.commit()
    return {"status": canc.status, "message": "Cancellation rejected"}


@router.get("/cancellations/{cancellation_id}/letter")
async def cancellation_letter(cancellation_id: uuid.UUID, ctx: Ctx = Depends(view)):
    canc = await get_owned(ctx.db, C.ReCancellation, ctx.vendor_id, cancellation_id, "cancellation")
    b = await get_owned(ctx.db, C.ReBooking, ctx.vendor_id, canc.booking_id, "booking")
    values = await booking_svc.booking_context(ctx.db, b)
    deductions = D(canc.forfeiture_amount) + D(canc.brokerage_recovery) + D(canc.gst_adjustment) + D(canc.other_deductions)
    values.update({
        "total_paid": f"{canc.total_paid:,.2f}", "deductions": f"{deductions:,.2f}",
        "refundable_amount": f"{canc.refundable_amount:,.2f}",
    })
    return await render_template(ctx.db, ctx.vendor_id, "cancellation_letter", values)


class RefundPayIn(BaseModel):
    mode: str = "neft"
    reference_no: str = Field(..., min_length=1)
    paid_on: Optional[date] = None


@router.post("/refunds/{refund_id}/pay")
async def pay_refund(refund_id: uuid.UUID, body: RefundPayIn, ctx: Ctx = Depends(booking_dep)):
    if body.mode not in C.PAYMENT_MODES:
        raise HTTPException(status_code=422, detail=f"mode must be one of {', '.join(C.PAYMENT_MODES)}")
    refund = await get_owned(ctx.db, C.ReRefund, ctx.vendor_id, refund_id, "refund")
    await booking_svc.pay_refund(ctx, refund, mode=body.mode, reference_no=body.reference_no, paid_on=body.paid_on)
    await ctx.db.commit()
    return {"status": refund.status, "message": f"Refund {refund.refund_no} marked paid"}


# ═══ Module 5 — Customers, KYC, agreements ═════════════════════════════════════════════════

@router.post("/kyc-documents/{doc_id}/verify")
async def verify_kyc(doc_id: uuid.UUID, ctx: Ctx = Depends(sales)):
    doc = await get_owned(ctx.db, C.ReKycDocument, ctx.vendor_id, doc_id, "KYC document")
    doc.status = "verified"
    doc.verified_by_name = ctx.actor_name
    doc.verified_at = _now()
    doc.remarks = None
    status = await recompute_kyc(ctx.db, doc.customer_id)
    await audit(ctx, "kyc_document", doc.id, "verify", ref=doc.doc_type)
    await ctx.db.commit()
    return {"customer_kyc_status": status, "message": "Document verified"}


@router.post("/kyc-documents/{doc_id}/reject")
async def reject_kyc(doc_id: uuid.UUID, body: RemarksIn, ctx: Ctx = Depends(sales)):
    doc = await get_owned(ctx.db, C.ReKycDocument, ctx.vendor_id, doc_id, "KYC document")
    doc.status = "rejected"
    doc.remarks = body.remarks
    doc.verified_by_name = ctx.actor_name
    doc.verified_at = _now()
    status = await recompute_kyc(ctx.db, doc.customer_id)
    await audit(ctx, "kyc_document", doc.id, "reject", ref=doc.doc_type)
    await ctx.db.commit()
    return {"customer_kyc_status": status, "message": "Document rejected"}


@router.get("/agreements/{agreement_id}/letter")
async def agreement_letter(agreement_id: uuid.UUID, ctx: Ctx = Depends(view)):
    ag = await get_owned(ctx.db, C.ReAgreement, ctx.vendor_id, agreement_id, "agreement")
    return {"html": ag.content_html or "<p>No generated content. Use the document URL.</p>", "subject": ag.agreement_no}


class SignIn(BaseModel):
    signed_on: Optional[date] = None


@router.post("/agreements/{agreement_id}/sign")
async def sign_agreement(agreement_id: uuid.UUID, body: SignIn, ctx: Ctx = Depends(legal)):
    ag = await get_owned(ctx.db, C.ReAgreement, ctx.vendor_id, agreement_id, "agreement")
    if ag.status not in ("draft", "sent"):
        raise HTTPException(status_code=409, detail=f"Agreement is {ag.status}")
    ag.status = "signed"
    ag.signed_on = body.signed_on or date.today()
    if ag.booking_id:
        b = await ctx.db.get(C.ReBooking, ag.booking_id)
        if b and b.status == "allotted":
            b.status = "agreement_signed"
            b.agreement_date = ag.signed_on
            await ctx.db.flush()
            from app.services.realestate.payments import on_booking_stage

            await on_booking_stage(ctx, b, "agreement_signed")
    await audit(ctx, "agreement", ag.id, "sign", ref=ag.agreement_no)
    await ctx.db.commit()
    return {"message": "Agreement marked as signed"}


class RegisterIn(BaseModel):
    registration_no: str = Field(..., min_length=1)
    registration_date: Optional[date] = None
    sub_registrar_office: Optional[str] = None
    stamp_duty_paid: Decimal = Decimal(0)
    registration_fee_paid: Decimal = Decimal(0)


@router.post("/agreements/{agreement_id}/register")
async def register_agreement(agreement_id: uuid.UUID, body: RegisterIn, ctx: Ctx = Depends(legal)):
    ag = await get_owned(ctx.db, C.ReAgreement, ctx.vendor_id, agreement_id, "agreement")
    if ag.status != "signed":
        raise HTTPException(status_code=409, detail="Only signed agreements can be registered")
    ag.status = "registered"
    ag.registration_no = body.registration_no
    ag.registration_date = body.registration_date or date.today()
    ag.sub_registrar_office = body.sub_registrar_office
    ag.stamp_duty_paid = body.stamp_duty_paid
    ag.registration_fee_paid = body.registration_fee_paid
    if ag.booking_id and ag.agreement_type in ("agreement_for_sale", "sale_deed", "builder_buyer"):
        b = await ctx.db.get(C.ReBooking, ag.booking_id)
        if b and b.status in ("allotted", "agreement_signed"):
            b.status = "registered"
            await ctx.db.flush()
            from app.services.realestate.payments import on_booking_stage

            await on_booking_stage(ctx, b, "registered")
    await audit(ctx, "agreement", ag.id, "register", ref=ag.agreement_no, changes={"registration_no": body.registration_no})
    await ctx.db.commit()
    return {"message": f"Registered as {body.registration_no}"}
