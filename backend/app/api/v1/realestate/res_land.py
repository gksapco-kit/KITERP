"""Resource definitions — Phase 3: land bank & acquisition (module 2), legal & statutory (module 15)."""
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select, update

from app.models.realestate import land as L
from app.services.realestate import land as svc
from app.services.realestate.common import Ctx, D

from .crud import Action, Resource
from .registry import P, add

LEGAL = "realestate.legal"


# ── hooks ───────────────────────────────────────────────────────────────────────────────────

async def parcel_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    data["area_sqft"] = svc.area_in_sqft(data.get("area"), data.get("area_unit") or "sqft")
    data.setdefault("status", "identified")


async def parcel_before_update(ctx: Ctx, obj: Any, data: dict[str, Any]) -> None:
    if "area" in data or "area_unit" in data:
        data["area_sqft"] = svc.area_in_sqft(data.get("area", obj.area), data.get("area_unit") or obj.area_unit)


async def _validate_share(ctx: Ctx, parcel_id, share, exclude=None) -> None:
    share = D(share)
    if not 0 < share <= 100:
        raise HTTPException(status_code=422, detail="share_percent must be greater than 0 and at most 100")
    total = await svc.landowner_share_total(ctx.db, parcel_id, exclude)
    if total + share > 100 + D("0.01"):
        raise HTTPException(status_code=409, detail=f"Landowner shares on this parcel would total {total + share:g}% (max 100%)")


async def owner_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    await _validate_share(ctx, data["parcel_id"], data.get("share_percent", 100))


async def owner_before_update(ctx: Ctx, obj: Any, data: dict[str, Any]) -> None:
    if "share_percent" in data or "parcel_id" in data:
        await _validate_share(ctx, data.get("parcel_id", obj.parcel_id), data.get("share_percent", obj.share_percent), obj.id)


async def owner_after_save(ctx: Ctx, obj: Any, *_: Any) -> None:
    if obj.is_primary:
        await ctx.db.execute(update(L.ReLandowner).where(
            L.ReLandowner.parcel_id == obj.parcel_id, L.ReLandowner.id != obj.id).values(is_primary=False))


async def title_after_save(ctx: Ctx, obj: Any, *_: Any) -> None:
    parcel = await ctx.db.get(L.ReLandParcel, obj.parcel_id)
    if parcel is not None and parcel.status in ("identified", "under_negotiation"):
        parcel.status = "title_check"


async def acq_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    open_acq = (await ctx.db.execute(select(L.ReAcquisition.acquisition_no).where(
        L.ReAcquisition.vendor_id == ctx.vendor_id, L.ReAcquisition.parcel_id == data["parcel_id"],
        L.ReAcquisition.status.in_(svc.OPEN_ACQ + ("completed",))))).scalars().first()
    if open_acq:
        raise HTTPException(status_code=409, detail=f"This parcel already has acquisition {open_acq}")
    for k in ("agreed_price", "stamp_duty", "registration_fee", "other_costs"):
        if D(data.get(k)) < 0:
            raise HTTPException(status_code=422, detail=f"{k} cannot be negative")
    ns = type("N", (), {k: data.get(k, 0) for k in ("agreed_price", "stamp_duty", "registration_fee", "other_costs")})
    data["total_cost"] = svc.total_cost_of(ns)
    data["status"] = "draft"


async def acq_before_update(ctx: Ctx, obj: Any, data: dict[str, Any]) -> None:
    if "parcel_id" in data and data["parcel_id"] != obj.parcel_id:
        raise HTTPException(status_code=409, detail="The parcel of an acquisition cannot be changed")
    merged = {k: data.get(k, getattr(obj, k)) for k in ("agreed_price", "stamp_duty", "registration_fee", "other_costs")}
    for k, v in merged.items():
        if D(v) < 0:
            raise HTTPException(status_code=422, detail=f"{k} cannot be negative")
    data["total_cost"] = svc.total_cost_of(type("N", (), merged))


async def jda_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    await svc.jda_validate(ctx, data)
    data["status"] = "draft"


async def jda_before_update(ctx: Ctx, obj: Any, data: dict[str, Any]) -> None:
    await svc.jda_validate(ctx, data, obj)


async def approval_before_create(ctx: Ctx, data: dict[str, Any]) -> None:
    await svc.approval_validate(ctx, data)


async def approval_before_update(ctx: Ctx, obj: Any, data: dict[str, Any]) -> None:
    await svc.approval_validate(ctx, data, obj)


# ── Module 2 — Land Bank & Acquisition ──────────────────────────────────────────────────────

add(
    Resource(
        key="land-parcels", model=L.ReLandParcel, title="Land parcels",
        columns=["code", "name", "survey_number", "village", "district", "area", "area_unit", "land_use", "status", "asking_price"],
        search=["code", "name", "survey_number", "village", "district"], filters=["status", "land_use", "district", "project_id"],
        number=("parcel", "code"), readonly=("area_sqft", "status"), write_perm="realestate.manage",
        before_create=parcel_before_create, before_update=parcel_before_update,
        actions=[
            Action("clearance", "Title clearance", "clearance", method="GET"),
            Action("reject", "Reject parcel", "reject", params=[P("reason", "Reason", "text", required=True)],
                   when={"status": ["identified", "under_negotiation", "title_check"]}, style="danger"),
            Action("reopen", "Reopen", "reopen", when={"status": ["rejected"]}),
        ],
    ),
    Resource(
        key="landowners", model=L.ReLandowner, title="Landowners",
        columns=["parcel_id", "name", "owner_type", "share_percent", "phone", "pan", "is_primary"],
        search=["name", "phone", "pan"], filters=["parcel_id", "owner_type"], order="name", write_perm="realestate.manage",
        before_create=owner_before_create, before_update=owner_before_update,
        after_create=owner_after_save, after_update=owner_after_save,
    ),
    Resource(
        key="title-checks", model=L.ReTitleCheck, title="Title verification",
        columns=["parcel_id", "check_type", "status", "risk_level", "advocate_name", "report_date", "valid_until"],
        search=["advocate_name", "findings"], filters=["parcel_id", "check_type", "status", "risk_level"],
        write_perm=LEGAL, after_create=title_after_save, after_update=title_after_save,
    ),
    Resource(
        key="acquisitions", model=L.ReAcquisition, title="Acquisitions",
        columns=["acquisition_no", "parcel_id", "mode", "status", "agreed_price", "total_cost", "paid_amount", "registration_no"],
        search=["acquisition_no", "registration_no"], filters=["status", "mode", "parcel_id", "project_id"],
        number=("acquisition", "acquisition_no"), write_perm="realestate.manage",
        readonly=("status", "total_cost", "paid_amount", "agreement_date", "registration_date", "registration_no",
                  "sub_registrar_office", "possession_date"),
        before_create=acq_before_create, before_update=acq_before_update, editable_when={"status": ["draft", "negotiating"]},
        actions=[
            Action("negotiate", "Start negotiation", "negotiate", when={"status": ["draft"]}),
            Action("sign", "Sign agreement", "sign", params=[P("signed_on", "Signed on", "date")],
                   when={"status": ["draft", "negotiating"]}, style="primary"),
            Action("register", "Register deed", "register",
                   params=[P("registration_no", "Registration no.", "text", required=True), P("registration_date", "Registration date", "date"),
                           P("sub_registrar_office", "Sub-registrar office", "text"), P("stamp_duty", "Stamp duty paid", "money"),
                           P("registration_fee", "Registration fee paid", "money")],
                   when={"status": ["agreement_signed"]}, style="primary"),
            Action("complete", "Take possession", "complete", params=[P("possession_date", "Possession date", "date")],
                   when={"status": ["registered"]}, style="primary"),
            Action("tds_suggestion", "TDS 194-IA calculator", "tds-suggestion", method="GET",
                   params=[P("amount", "Payment amount", "money", required=True)]),
            Action("clearance", "Title clearance", "clearance", method="GET"),
            Action("cancel", "Cancel", "cancel", params=[P("reason", "Reason", "text")],
                   when={"status": ["draft", "negotiating", "agreement_signed"]}, style="danger"),
        ],
    ),
    Resource(
        key="acquisition-payments", model=L.ReAcquisitionPayment, title="Acquisition payments",
        columns=["acquisition_id", "landowner_id", "payment_date", "purpose", "amount", "tds_amount", "net_paid", "mode", "status"],
        search=["reference_no"], filters=["acquisition_id", "landowner_id", "status", "purpose"], order="-payment_date",
        write_perm="realestate.manage", readonly=("status", "net_paid"), allow_edit=False, allow_delete=False,
        before_create=svc.payment_before_create, after_create=svc.payment_after_create,
        actions=[Action("cancel", "Cancel / refund", "cancel", params=[P("reason", "Reason", "text", required=True)],
                        when={"status": ["paid"]}, style="danger")],
    ),
    Resource(
        key="jdas", model=L.ReJda, title="JDA / JV agreements",
        columns=["jda_no", "parcel_id", "project_id", "landowner_id", "model", "landowner_share_percent", "status", "signing_date"],
        search=["jda_no", "registration_no"], filters=["status", "model", "parcel_id", "project_id"],
        number=("jda", "jda_no"), write_perm="realestate.manage", readonly=("status", "signing_date"),
        before_create=jda_before_create, before_update=jda_before_update, editable_when={"status": ["draft"]},
        actions=[
            Action("activate", "Activate", "activate", params=[P("signing_date", "Signing date", "date")],
                   when={"status": ["draft"]}, style="primary"),
            Action("allocate_units", "Allocate landowner units", "allocate-units",
                   params=[P("unit_numbers", "Unit numbers (comma separated)", "text", required=True)],
                   when={"status": ["active"]}),
            Action("release_units", "Release units", "release-units",
                   params=[P("unit_numbers", "Unit numbers (comma separated)", "text", required=True)],
                   when={"status": ["active"]}),
            Action("share_report", "Entitlement vs allocation", "share-report", method="GET"),
            Action("complete", "Complete", "complete", when={"status": ["active"]}),
            Action("terminate", "Terminate", "terminate", params=[P("reason", "Reason", "text", required=True)],
                   when={"status": ["draft", "active"]}, style="danger"),
        ],
    ),
)

# ── Module 15 — Legal & Documentation (statutory approvals) ─────────────────────────────────

add(
    Resource(
        key="statutory-approvals", model=L.ReStatutoryApproval, title="Statutory approvals",
        columns=["approval_type", "project_id", "parcel_id", "authority", "reference_no", "status", "applied_on", "valid_until"],
        search=["authority", "reference_no"], filters=["approval_type", "status", "project_id", "parcel_id"],
        order="valid_until", json_fields=("tags",), write_perm=LEGAL,
        before_create=approval_before_create, before_update=approval_before_update,
        actions=[
            Action("approve", "Mark approved", "approve",
                   params=[P("approved_on", "Approved on", "date"), P("valid_until", "Valid until", "date"),
                           P("reference_no", "Reference no.", "text")],
                   when={"status": ["not_applied", "applied", "under_review", "expired"]}, style="primary"),
            Action("renew", "Renew", "renew",
                   params=[P("valid_until", "New validity", "date", required=True), P("reference_no", "Reference no.", "text")],
                   when={"status": ["approved", "expired"]}),
        ],
    ),
)
