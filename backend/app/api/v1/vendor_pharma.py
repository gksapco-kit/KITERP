"""Vendor Pharmaceutical Manufacturing API — dedicated Pharma module."""
from __future__ import annotations

import csv
import io
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import HTMLResponse, JSONResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.database import get_db
from app.api.deps import get_current_vendor_id, require_permission
from app.models.vendor_user import VendorUser
from app.models.vendor_product import Product
from app.models.procurement_goods import GoodsBatch
from app.models.procurement import PurchaseOrder
from app.models.production import ProductionOrder
from app.models.storage_location import StorageLocation
from app.models.vendor import Vendor
from app.models.pharma import (
    PharmaBatchNumberModel,
    PharmaBatchSequence,
    BatchTransaction,
    PharmaMbr,
    PharmaBpr,
    PharmaQcSpec,
    PharmaInspectionLot,
    PharmaRecall,
    PharmaDeviation,
    PharmaCapa,
    PharmaChangeControl,
    PharmaAuditEvent,
    PharmaSerialUnit,
    PharmaComplaint,
    PharmaSignerGroup,
    PharmaSignerGroupMember,
    PharmaApprovalRule,
    PharmaApprovalRuleStep,
    PharmaOrgRegion,
    PHARMA_ACTIONS,
    TRACK_TRACE_REGIONS,
)
from app.services.pharma_approvals import (
    resolve_approval_policy,
    build_batch_context,
    build_entity_context,
    check_signer_eligible,
    next_open_step,
)
from app.services.pharma_batch import (
    next_batch_number,
    render_batch_number,
    validate_pattern,
    list_fefo_batches,
    build_genealogy,
    append_pharma_audit,
    verify_pharma_audit_signature,
    release_batch_from_quarantine,
    list_batch_alerts,
    ensure_qi_inspection,
    open_retest_inspection,
    archive_coa_pdf,
    archive_bpr_pdf,
)
from app.services.pharma_esign import (
    PHARMA_SETTINGS_KEY,
    assert_release_qualified,
    get_pharma_settings,
    load_pending_signatures,
    load_pharma_settings,
    resolve_approver_requirement,
    resolve_track_trace_region,
    verify_and_record_esign,
)

router = APIRouter(dependencies=[Depends(require_permission("pharma.view"))])


def _client_ip(request: Optional[Request]) -> Optional[str]:
    if request is None:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    if request.client:
        return (request.client.host or "")[:64]
    return None


class ESignFields(BaseModel):
    """Part 11 e-sign payload — required when vendor pharma.esign_required is true."""
    password: Optional[str] = None
    meaning: Optional[str] = None  # author | reviewer | approver
    totp_code: Optional[str] = None


def _optional_uuid(value: Optional[str], field: str) -> Optional[UUID]:
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    try:
        return UUID(s)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {field}: expected a UUID",
        ) from exc


def _require_uuid(value: Optional[str], field: str) -> UUID:
    parsed = _optional_uuid(value, field)
    if parsed is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field} is required",
        )
    return parsed


# ── serializers ───────────────────────────────────────────────────────────────

def _batch_source_label(
    source_type: Optional[str],
    source_ref: Optional[str],
) -> Optional[str]:
    kind = (source_type or "").lower()
    if kind in ("purchase", "stock_in") and source_ref:
        return f"PO {source_ref}"
    if kind == "production" and source_ref:
        return f"Production {source_ref}"
    if kind == "transfer" and source_ref:
        return f"Transfer {source_ref}"
    if source_ref:
        return source_ref
    if kind:
        return kind.replace("_", " ").title()
    return None


def _batch_dict(
    b: GoodsBatch,
    product_name: Optional[str] = None,
    *,
    source_ref: Optional[str] = None,
) -> dict:
    source_label = _batch_source_label(b.source_type, source_ref)
    return {
        "id": str(b.id),
        "product_id": str(b.product_id),
        "product_name": product_name,
        "variant_id": str(b.variant_id) if b.variant_id else None,
        "batch_number": b.batch_number,
        "serial_numbers": b.serial_numbers or [],
        "manufacturing_date": b.manufacturing_date.isoformat() if b.manufacturing_date else None,
        "expiry_date": b.expiry_date.isoformat() if b.expiry_date else None,
        "best_before_date": b.best_before_date.isoformat() if b.best_before_date else None,
        "plant_id": str(b.plant_id) if b.plant_id else None,
        "storage_location_id": str(b.storage_location_id) if b.storage_location_id else None,
        "quantity_received": float(b.quantity_received or 0),
        "quantity_available": float(b.quantity_available or 0),
        "quantity_reserved": float(b.quantity_reserved or 0),
        "quantity_consumed": float(b.quantity_consumed or 0),
        "source_type": b.source_type,
        "source_id": str(b.source_id) if b.source_id else None,
        "source_ref": source_ref,
        "source_label": source_label,
        "quality_status": b.quality_status,
        "supplier_batch_number": b.supplier_batch_number,
        "notes": b.notes,
        "is_active": b.is_active,
        "created_at": b.created_at.isoformat() if b.created_at else None,
    }


async def _resolve_batch_source_refs(
    db: AsyncSession,
    batches: list[GoodsBatch],
) -> dict:
    """Map source_id → human ref (PO number / production order ref)."""
    po_ids = {
        b.source_id
        for b in batches
        if b.source_id and (b.source_type or "").lower() in ("purchase", "stock_in")
    }
    prod_ids = {
        b.source_id
        for b in batches
        if b.source_id and (b.source_type or "").lower() == "production"
    }
    ref_map: dict = {}
    if po_ids:
        for row in (
            await db.execute(
                select(PurchaseOrder.id, PurchaseOrder.po_number).where(PurchaseOrder.id.in_(po_ids))
            )
        ).all():
            ref_map[row[0]] = row[1]
    if prod_ids:
        for row in (
            await db.execute(
                select(ProductionOrder.id, ProductionOrder.ref).where(ProductionOrder.id.in_(prod_ids))
            )
        ).all():
            ref_map[row[0]] = row[1]
    return ref_map


def _txn_dict(t: BatchTransaction) -> dict:
    return {
        "id": str(t.id),
        "txn_type": t.txn_type,
        "source_type": t.source_type,
        "source_id": str(t.source_id) if t.source_id else None,
        "document_number": t.document_number,
        "product_id": str(t.product_id),
        "from_batch_id": str(t.from_batch_id) if t.from_batch_id else None,
        "to_batch_id": str(t.to_batch_id) if t.to_batch_id else None,
        "quantity": float(t.quantity or 0),
        "quality_status": t.quality_status,
        "notes": t.notes,
        "meta": t.meta or {},
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


# ── Phase 0: overview + settings + batch numbers ──────────────────────────────

@router.get("/overview")
async def pharma_overview(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    async def _count(model, *extra):
        q = select(func.count()).select_from(model).where(model.vendor_id == vendor_id, *extra)
        return int((await db.execute(q)).scalar() or 0)

    batch_managed = await _count(Product, Product.batch_managed.is_(True))
    qi = await _count(GoodsBatch, GoodsBatch.quality_status == "quality_inspection")
    blocked = await _count(GoodsBatch, GoodsBatch.quality_status == "blocked")
    unrestricted = await _count(GoodsBatch, GoodsBatch.quality_status == "unrestricted")
    quarantine_sloc = await _count(StorageLocation, StorageLocation.stock_type == "quarantine")
    open_insp = await _count(PharmaInspectionLot, PharmaInspectionLot.status.in_(["open", "testing", "pending_release"]))
    open_dev = await _count(PharmaDeviation, PharmaDeviation.status == "open")
    open_recall = await _count(PharmaRecall, PharmaRecall.status.in_(["open", "investigating", "notified"]))
    capa_eff_overdue = int(
        (
            await db.execute(
                select(func.count()).select_from(PharmaCapa).where(
                    PharmaCapa.vendor_id == vendor_id,
                    PharmaCapa.status.in_(["open", "in_progress", "effectiveness_check"]),
                    PharmaCapa.effectiveness_due_date.is_not(None),
                    PharmaCapa.effectiveness_due_date < date.today(),
                )
            )
        ).scalar() or 0
    )
    from app.services.pharma_serial import count_active_serials
    from app.services.pharma_gdp import count_open_excursions
    from app.services.pharma_epcis import count_epcis_events
    active_serials = await count_active_serials(db, vendor_id)
    open_excursions = await count_open_excursions(db, vendor_id)
    epcis_events = await count_epcis_events(db, vendor_id)

    alerts = await list_batch_alerts(db, vendor_id, expiry_within_days=30, limit=50)

    return JSONResponse({
        "phases": [
            {
                "id": 0, "key": "foundations", "label": "Foundations",
                "status": "enforced",
                "note": "Product batch flags, sequences, quarantine SLoc types",
            },
            {
                "id": 1, "key": "lot_stock", "label": "Lot-first stock",
                "status": "enforced",
                "note": "GR + production create GoodsBatch; lot qty tracked",
            },
            {
                "id": 2, "key": "fefo", "label": "FEFO & quarantine",
                "status": "enforced",
                "note": "FEFO on production issue and sales; QI auto-moves to quarantine SLoc",
            },
            {
                "id": 3, "key": "ebmr", "label": "MBR / BPR",
                "status": "enforced",
                "note": "MBR templates seed BPR steps/IPC; clearance + complete gates",
            },
            {
                "id": 4, "key": "qc", "label": "QC / CoA / Release",
                "status": "enforced",
                "note": "QI auto-opens inspection; printable CoA; quarantine SLoc moves",
            },
            {
                "id": 5, "key": "genealogy", "label": "Genealogy & recall",
                "status": "enforced",
                "note": "Component→FG links; recall actions/status lifecycle",
            },
            {
                "id": 6, "key": "qms", "label": "QMS",
                "status": "enforced",
                "note": "Deviation → CAPA close; change-control approve",
            },
            {
                "id": 7, "key": "esign", "label": "E-sign & audit",
                "status": "enforced",
                "note": "Password/TOTP re-auth, meaning-of-signature, dual sign on release & BPR complete; failed attempts audited",
            },
            {
                "id": 8, "key": "serialization", "label": "Serialization",
                "status": "enforced",
                "note": "Hierarchy + status workflow; serial_managed enforced on sale; auto-commission on GR/production",
            },
            {
                "id": 9, "key": "gdp", "label": "GDP / cold chain",
                "status": "enforced",
                "note": "SLoc/lot storage conditions; temp excursion log; wholesale license ship gate",
            },
            {
                "id": 10, "key": "track_trace", "label": "Track & trace",
                "status": "enforced",
                "note": "GTIN/NDC; EPCIS event export; DSCSA verify stub; EU FMD decommission when region=eu",
            },
        ],
        "stats": {
            "batch_managed_products": batch_managed,
            "batches_qi": qi,
            "batches_blocked": blocked,
            "batches_unrestricted": unrestricted,
            "quarantine_locations": quarantine_sloc,
            "open_inspections": open_insp,
            "open_deviations": open_dev,
            "open_recalls": open_recall,
            "expired_lots": alerts["counts"]["expired"],
            "expiring_soon": alerts["counts"]["expiring_soon"],
            "retest_due": alerts["counts"]["retest_due"],
            "capa_effectiveness_overdue": capa_eff_overdue,
            "active_serials": active_serials,
            "open_excursions": open_excursions,
            "epcis_events": epcis_events,
        },
        "alerts": {
            "expired": alerts["expired"][:10],
            "expiring_soon": alerts["expiring_soon"][:10],
            "retest_due": alerts["retest_due"][:10],
        },
    })


# ── Pharma product enrollment ─────────────────────────────────────────────────

class _EnrollBody(BaseModel):
    product_ids: list[str] = Field(..., min_length=1)

@router.post("/products/enroll", status_code=200)
async def enroll_pharma_products(
    body: _EnrollBody,
    vendor_id: UUID = Depends(get_current_vendor_id),
    _: None = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Mark products as pharma-managed and apply default flags."""
    ids: list[UUID] = []
    for raw in body.product_ids:
        try:
            ids.append(UUID(raw))
        except ValueError:
            raise HTTPException(400, f"Invalid product_id: {raw}")

    rows = list(
        (
            await db.execute(
                select(Product).where(
                    Product.vendor_id == vendor_id,
                    Product.id.in_(ids),
                )
            )
        ).scalars().all()
    )
    if not rows:
        raise HTTPException(404, "No matching products found")

    enrolled = []
    for p in rows:
        p.pharma_managed = True
        p.batch_managed = True
        p.qc_required_on_receipt = True
        enrolled.append(str(p.id))

    await db.commit()
    return {"enrolled": enrolled, "count": len(enrolled)}


@router.post("/products/unenroll", status_code=200)
async def unenroll_pharma_products(
    body: _EnrollBody,
    vendor_id: UUID = Depends(get_current_vendor_id),
    _: None = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Remove pharma enrollment after verifying no batch history exists."""
    ids: list[UUID] = []
    for raw in body.product_ids:
        try:
            ids.append(UUID(raw))
        except ValueError:
            raise HTTPException(400, f"Invalid product_id: {raw}")

    rows = list(
        (
            await db.execute(
                select(Product).where(
                    Product.vendor_id == vendor_id,
                    Product.id.in_(ids),
                )
            )
        ).scalars().all()
    )
    if not rows:
        raise HTTPException(404, "No matching products found")

    # Guard: refuse to unenroll any product that already has batch history or BPRs
    blocked = []
    for p in rows:
        has_batches = bool(
            (
                await db.execute(
                    select(GoodsBatch.id)
                    .where(GoodsBatch.product_id == p.id)
                    .limit(1)
                )
            ).scalar_one_or_none()
        )
        has_bpr = bool(
            (
                await db.execute(
                    select(PharmaBpr.id)
                    .where(PharmaBpr.product_id == p.id)
                    .limit(1)
                )
            ).scalar_one_or_none()
        )
        if has_batches or has_bpr:
            blocked.append(p.name)

    if blocked:
        names = ", ".join(blocked)
        raise HTTPException(
            409,
            f"Cannot unenroll: batch or BPR records exist for: {names}. "
            "Archive or reassign those records before unenrolling.",
        )

    unenrolled = []
    for p in rows:
        p.pharma_managed = False
        unenrolled.append(str(p.id))

    await db.commit()
    return {"unenrolled": unenrolled, "count": len(unenrolled)}


@router.get("/alerts")
async def pharma_alerts(
    expiry_within_days: int = Query(30, ge=1, le=365),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    return JSONResponse(await list_batch_alerts(db, vendor_id, expiry_within_days=expiry_within_days))


@router.get("/settings")
async def get_pharma_module_settings(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    return JSONResponse(await load_pharma_settings(db, vendor_id))


class PharmaSettingsUpdate(BaseModel):
    esign_required: Optional[bool] = None
    dual_sign_release: Optional[bool] = None
    dual_sign_bpr_complete: Optional[bool] = None
    dual_sign_capa_close: Optional[bool] = None
    dual_sign_cc_approve: Optional[bool] = None
    # N-approver matrices (0 = N/A, 1 = single, 2–10 = multi-sign); overrides dual_sign_* shorthand
    min_approvers_release: Optional[int] = Field(None, ge=0, le=10)
    min_approvers_bpr_complete: Optional[int] = Field(None, ge=0, le=10)
    min_approvers_capa_close: Optional[int] = Field(None, ge=0, le=10)
    min_approvers_cc_approve: Optional[int] = Field(None, ge=0, le=10)
    bpr_required_before_release: Optional[bool] = None
    release_training_required: Optional[bool] = None
    release_qualified_ids: Optional[list[str]] = None
    wholesale_license_check: Optional[bool] = None
    track_trace_region: Optional[str] = None
    auto_epcis_on_serial: Optional[bool] = None
    # DSCSA VRS credentials
    vrs_endpoint: Optional[str] = None
    vrs_api_key: Optional[str] = None
    # GS1 company prefix for proper SGTIN encoding
    gs1_company_prefix: Optional[str] = None
    # EU FMD NMVS credentials
    nmvs_endpoint: Optional[str] = None
    nmvs_api_key: Optional[str] = None


@router.patch("/settings")
async def patch_pharma_module_settings(
    data: PharmaSettingsUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    _perm: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    vendor = (
        await db.execute(select(Vendor).where(Vendor.id == vendor_id))
    ).scalar_one_or_none()
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    current = dict(vendor.settings or {})
    pharma = dict(get_pharma_settings(current))
    patch = data.model_dump(exclude_none=True)
    if "release_qualified_ids" in patch:
        patch["release_qualified_ids"] = [
            str(x).strip() for x in (patch["release_qualified_ids"] or []) if str(x).strip()
        ]
    if "track_trace_region" in patch:
        region = str(patch["track_trace_region"] or "none").lower()
        if region not in ("none", "us", "eu"):
            raise HTTPException(400, "track_trace_region must be none|us|eu")
        patch["track_trace_region"] = region
    pharma.update(patch)
    current[PHARMA_SETTINGS_KEY] = pharma
    vendor.settings = current
    flag_modified(vendor, "settings")
    await db.commit()
    return JSONResponse(pharma)


@router.post("/settings/qualify-me")
async def qualify_current_user_for_release(
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    vendor = (
        await db.execute(select(Vendor).where(Vendor.id == vendor_id))
    ).scalar_one_or_none()
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    current = dict(vendor.settings or {})
    pharma = dict(get_pharma_settings(current))
    ids = list(pharma.get("release_qualified_ids") or [])
    sid = str(vu.id)
    if sid not in ids:
        ids.append(sid)
    pharma["release_qualified_ids"] = ids
    current[PHARMA_SETTINGS_KEY] = pharma
    vendor.settings = current
    flag_modified(vendor, "settings")
    await db.commit()
    return JSONResponse(pharma)


# ── Scoped approval rules ─────────────────────────────────────────────────────

class ApprovalRuleStepIn(BaseModel):
    level: int = Field(1, ge=1, le=20)
    signer_type: str  # user | role | permission | signer_group
    vendor_user_id: Optional[UUID] = None
    role_slug: Optional[str] = None
    permission: Optional[str] = None
    signer_group_id: Optional[UUID] = None
    meaning: str = Field("approver", pattern="^(author|reviewer|approver)$")
    min_signatures: int = Field(1, ge=1)
    is_mandatory: bool = True


class ApprovalRuleIn(BaseModel):
    action: str
    product_id: Optional[UUID] = None
    product_group_id: Optional[UUID] = None
    plant_id: Optional[UUID] = None
    store_id: Optional[UUID] = None
    region: Optional[str] = None           # us | eu | none | null (any region)
    required_approvers: int = Field(2, ge=0, le=20)
    sequential: bool = False
    forbid_initiator: bool = True
    overrides_default: bool = False
    is_default: bool = False
    is_active: bool = True
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    priority: int = Field(100, ge=0)
    notes: Optional[str] = None
    steps: list[ApprovalRuleStepIn] = []


class SignerGroupIn(BaseModel):
    code: str = Field(..., min_length=1, max_length=40)
    name: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = None
    is_active: bool = True


def _rule_to_dict(rule: PharmaApprovalRule, steps: list[PharmaApprovalRuleStep]) -> dict:
    return {
        "id": str(rule.id),
        "action": rule.action,
        "product_id": str(rule.product_id) if rule.product_id else None,
        "product_group_id": str(rule.product_group_id) if rule.product_group_id else None,
        "plant_id": str(rule.plant_id) if rule.plant_id else None,
        "store_id": str(rule.store_id) if rule.store_id else None,
        "region": rule.region,
        "required_approvers": rule.required_approvers,
        "sequential": rule.sequential,
        "forbid_initiator": rule.forbid_initiator,
        "overrides_default": rule.overrides_default,
        "is_default": rule.is_default,
        "is_active": rule.is_active,
        "valid_from": rule.valid_from.isoformat() if rule.valid_from else None,
        "valid_to": rule.valid_to.isoformat() if rule.valid_to else None,
        "priority": rule.priority,
        "version": rule.version,
        "notes": rule.notes,
        "created_by": str(rule.created_by) if rule.created_by else None,
        "created_at": rule.created_at.isoformat() if rule.created_at else None,
        "updated_at": rule.updated_at.isoformat() if rule.updated_at else None,
        "steps": [
            {
                "id": str(s.id),
                "level": s.level,
                "signer_type": s.signer_type,
                "vendor_user_id": str(s.vendor_user_id) if s.vendor_user_id else None,
                "role_slug": s.role_slug,
                "permission": s.permission,
                "signer_group_id": str(s.signer_group_id) if s.signer_group_id else None,
                "meaning": s.meaning,
                "min_signatures": s.min_signatures,
                "is_mandatory": s.is_mandatory,
            }
            for s in sorted(steps, key=lambda x: x.level)
        ],
    }


@router.get("/approval-rules")
async def list_approval_rules(
    action: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(PharmaApprovalRule).where(PharmaApprovalRule.vendor_id == vendor_id)
    if action:
        q = q.where(PharmaApprovalRule.action == action)
    if is_active is not None:
        q = q.where(PharmaApprovalRule.is_active == is_active)
    rules = (await db.execute(q.order_by(PharmaApprovalRule.action, PharmaApprovalRule.is_default.desc(), PharmaApprovalRule.priority))).scalars().all()
    if not rules:
        return JSONResponse([])
    rule_ids = [r.id for r in rules]
    steps = (
        await db.execute(
            select(PharmaApprovalRuleStep).where(PharmaApprovalRuleStep.rule_id.in_(rule_ids))
        )
    ).scalars().all()
    steps_by_rule: dict = {}
    for s in steps:
        steps_by_rule.setdefault(s.rule_id, []).append(s)
    return JSONResponse([_rule_to_dict(r, steps_by_rule.get(r.id, [])) for r in rules])


@router.post("/approval-rules", status_code=201)
async def create_approval_rule(
    data: ApprovalRuleIn,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    if data.action not in PHARMA_ACTIONS:
        raise HTTPException(400, f"action must be one of: {', '.join(PHARMA_ACTIONS)}")
    rule = PharmaApprovalRule(
        id=__import__("uuid").uuid4(),
        vendor_id=vendor_id,
        action=data.action,
        product_id=data.product_id,
        product_group_id=data.product_group_id,
        plant_id=data.plant_id,
        store_id=data.store_id,
        region=data.region,
        required_approvers=data.required_approvers,
        sequential=data.sequential,
        forbid_initiator=data.forbid_initiator,
        overrides_default=data.overrides_default,
        is_default=data.is_default,
        is_active=data.is_active,
        valid_from=data.valid_from,
        valid_to=data.valid_to,
        priority=data.priority,
        notes=data.notes,
        created_by=vu.id,
    )
    db.add(rule)
    await db.flush()
    step_objs = []
    for s in data.steps:
        step_objs.append(PharmaApprovalRuleStep(
            id=__import__("uuid").uuid4(),
            rule_id=rule.id,
            level=s.level,
            signer_type=s.signer_type,
            vendor_user_id=s.vendor_user_id,
            role_slug=s.role_slug,
            permission=s.permission,
            signer_group_id=s.signer_group_id,
            meaning=s.meaning,
            min_signatures=s.min_signatures,
            is_mandatory=s.is_mandatory,
        ))
        db.add(step_objs[-1])
    await db.commit()
    await db.refresh(rule)
    for s in step_objs:
        await db.refresh(s)
    return JSONResponse(_rule_to_dict(rule, step_objs), status_code=201)


@router.get("/approval-rules/resolve")
async def preview_approval_policy(
    action: str = Query(...),
    product_id: Optional[UUID] = Query(None),
    plant_id: Optional[UUID] = Query(None),
    store_id: Optional[UUID] = Query(None),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Preview the resolved approval policy for a given action + context.

    Returns the merged policy plus every contributing rule so QA can validate
    the configuration before activating it.
    """
    ctx = await build_entity_context(
        db, vendor_id, product_id=product_id, plant_id=plant_id, store_id=store_id
    )
    policy = await resolve_approval_policy(db, vendor_id=vendor_id, action=action, ctx=ctx)
    return JSONResponse({
        "action": action,
        "required_approvers": policy.required_approvers,
        "dual_sign": policy.dual_sign,
        "sequential": policy.sequential,
        "forbid_initiator": policy.forbid_initiator,
        "source": policy.source,
        "rule_ids": [str(rid) for rid in policy.rule_ids],
        "steps": [
            {
                "level": s.level,
                "signer_type": s.signer_type,
                "target": s.describe(),
                "meaning": s.meaning,
                "min_signatures": s.min_signatures,
                "is_mandatory": s.is_mandatory,
            }
            for s in policy.steps
        ],
    })


@router.get("/approval-rules/scope-matrix")
async def get_approval_scope_matrix(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Return all unique (BU/store, plant, region) scope combinations with their rules.

    Each row represents one distinct combination that has at least one active
    approval rule defined.  A None value means "any" for that dimension.
    The 'actions' map shows the effective policy summary per GxP action.
    """
    from app.models.plant import Plant
    from app.models.store import Store

    rules = (
        await db.execute(
            select(PharmaApprovalRule)
            .where(
                PharmaApprovalRule.vendor_id == vendor_id,
                PharmaApprovalRule.is_active.is_(True),
            )
            .order_by(PharmaApprovalRule.action, PharmaApprovalRule.priority)
        )
    ).scalars().all()

    # Collect all unique scope combos (store_id, plant_id, region) seen in rules
    seen_combos: dict[tuple, dict] = {}
    for rule in rules:
        key = (
            str(rule.store_id) if rule.store_id else None,
            str(rule.plant_id) if rule.plant_id else None,
            rule.region,
        )
        if key not in seen_combos:
            seen_combos[key] = {
                "store_id": str(rule.store_id) if rule.store_id else None,
                "plant_id": str(rule.plant_id) if rule.plant_id else None,
                "region": rule.region,
                "actions": {},
            }
        action_summary = seen_combos[key]["actions"]
        if rule.action not in action_summary or rule.required_approvers > action_summary[rule.action]["required_approvers"]:
            action_summary[rule.action] = {
                "rule_id": str(rule.id),
                "required_approvers": rule.required_approvers,
                "sequential": rule.sequential,
                "forbid_initiator": rule.forbid_initiator,
                "overrides_default": rule.overrides_default,
                "is_default": rule.is_default,
            }

    # Enrich with store/plant names
    store_ids = {c["store_id"] for c in seen_combos.values() if c["store_id"]}
    plant_ids = {c["plant_id"] for c in seen_combos.values() if c["plant_id"]}

    store_names: dict[str, str] = {}
    if store_ids:
        rows = (
            await db.execute(
                select(Store.id, Store.name, Store.unit_type)
                .where(Store.id.in_([__import__("uuid").UUID(s) for s in store_ids]))
            )
        ).all()
        for sid, sname, utype in rows:
            store_names[str(sid)] = f"[{utype.upper() if utype else 'BU'}] {sname}"

    plant_names: dict[str, str] = {}
    if plant_ids:
        rows = (
            await db.execute(
                select(Plant.id, Plant.name, Plant.store_id)
                .where(Plant.id.in_([__import__("uuid").UUID(p) for p in plant_ids]))
            )
        ).all()
        for pid, pname, ps_id in rows:
            plant_names[str(pid)] = pname
            # If no BU assigned for this combo, look it up from plant
            for key, combo in seen_combos.items():
                if combo["plant_id"] == str(pid) and not combo["store_id"] and ps_id:
                    combo["_plant_store_id"] = str(ps_id)

    result = []
    for combo in seen_combos.values():
        bu_id = combo["store_id"]
        plant_id = combo["plant_id"]
        # Derive BU name from plant's store when not directly scoped
        bu_name = store_names.get(bu_id) if bu_id else None
        if not bu_name and combo.get("_plant_store_id"):
            bu_name = store_names.get(combo["_plant_store_id"])
        plant_name = plant_names.get(plant_id) if plant_id else None
        result.append({
            "store_id": bu_id,
            "store_name": bu_name,
            "plant_id": plant_id,
            "plant_name": plant_name,
            "region": combo["region"],
            "actions": combo["actions"],
        })

    # Sort: global default first, then by store name, plant name
    result.sort(key=lambda x: (
        x["store_id"] is None and x["plant_id"] is None,
        x["store_name"] or "",
        x["plant_name"] or "",
        x["region"] or "",
    ), reverse=False)

    return JSONResponse(result)


@router.get("/approval-rules/{rule_id}")
async def get_approval_rule(
    rule_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    rule = (
        await db.execute(
            select(PharmaApprovalRule).where(
                PharmaApprovalRule.id == rule_id,
                PharmaApprovalRule.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Approval rule not found")
    steps = (
        await db.execute(
            select(PharmaApprovalRuleStep).where(PharmaApprovalRuleStep.rule_id == rule_id)
        )
    ).scalars().all()
    return JSONResponse(_rule_to_dict(rule, list(steps)))


@router.patch("/approval-rules/{rule_id}")
async def update_approval_rule(
    rule_id: UUID,
    data: ApprovalRuleIn,
    vendor_id: UUID = Depends(get_current_vendor_id),
    _perm: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    rule = (
        await db.execute(
            select(PharmaApprovalRule).where(
                PharmaApprovalRule.id == rule_id,
                PharmaApprovalRule.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Approval rule not found")
    if data.action not in PHARMA_ACTIONS:
        raise HTTPException(400, f"action must be one of: {', '.join(PHARMA_ACTIONS)}")
    for attr in (
        "action", "product_id", "product_group_id", "plant_id", "store_id", "region",
        "required_approvers", "sequential", "forbid_initiator", "overrides_default",
        "is_default", "is_active", "valid_from", "valid_to", "priority", "notes",
    ):
        setattr(rule, attr, getattr(data, attr))
    rule.version = (rule.version or 1) + 1

    # Replace steps
    existing_steps = (
        await db.execute(
            select(PharmaApprovalRuleStep).where(PharmaApprovalRuleStep.rule_id == rule_id)
        )
    ).scalars().all()
    for s in existing_steps:
        await db.delete(s)
    await db.flush()
    step_objs = []
    for s in data.steps:
        step_objs.append(PharmaApprovalRuleStep(
            id=__import__("uuid").uuid4(),
            rule_id=rule.id,
            level=s.level,
            signer_type=s.signer_type,
            vendor_user_id=s.vendor_user_id,
            role_slug=s.role_slug,
            permission=s.permission,
            signer_group_id=s.signer_group_id,
            meaning=s.meaning,
            min_signatures=s.min_signatures,
            is_mandatory=s.is_mandatory,
        ))
        db.add(step_objs[-1])
    await db.commit()
    await db.refresh(rule)
    for s in step_objs:
        await db.refresh(s)
    return JSONResponse(_rule_to_dict(rule, step_objs))


@router.delete("/approval-rules/{rule_id}", status_code=204)
async def deactivate_approval_rule(
    rule_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    _perm: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Deactivates (soft-deletes) a rule. The record is kept for audit history."""
    rule = (
        await db.execute(
            select(PharmaApprovalRule).where(
                PharmaApprovalRule.id == rule_id,
                PharmaApprovalRule.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Approval rule not found")
    rule.is_active = False
    await db.commit()


# ── Signer groups ─────────────────────────────────────────────────────────────

def _group_to_dict(group: PharmaSignerGroup, members: list) -> dict:
    return {
        "id": str(group.id),
        "code": group.code,
        "name": group.name,
        "description": group.description,
        "is_active": group.is_active,
        "member_count": len(members),
        "members": [
            {"vendor_user_id": str(m.vendor_user_id), "id": str(m.id)}
            for m in members
        ],
        "created_at": group.created_at.isoformat() if group.created_at else None,
    }


@router.get("/signer-groups")
async def list_signer_groups(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    groups = (
        await db.execute(
            select(PharmaSignerGroup)
            .where(PharmaSignerGroup.vendor_id == vendor_id)
            .order_by(PharmaSignerGroup.code)
        )
    ).scalars().all()
    if not groups:
        return JSONResponse([])
    gids = [g.id for g in groups]
    members = (
        await db.execute(
            select(PharmaSignerGroupMember).where(PharmaSignerGroupMember.group_id.in_(gids))
        )
    ).scalars().all()
    by_group: dict = {}
    for m in members:
        by_group.setdefault(m.group_id, []).append(m)
    return JSONResponse([_group_to_dict(g, by_group.get(g.id, [])) for g in groups])


@router.post("/signer-groups", status_code=201)
async def create_signer_group(
    data: SignerGroupIn,
    vendor_id: UUID = Depends(get_current_vendor_id),
    _perm: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    existing = (
        await db.execute(
            select(PharmaSignerGroup).where(
                PharmaSignerGroup.vendor_id == vendor_id,
                PharmaSignerGroup.code == data.code,
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(409, f"Signer group with code '{data.code}' already exists")
    group = PharmaSignerGroup(
        id=__import__("uuid").uuid4(),
        vendor_id=vendor_id,
        code=data.code,
        name=data.name,
        description=data.description,
        is_active=data.is_active,
    )
    db.add(group)
    await db.commit()
    return JSONResponse(_group_to_dict(group, []), status_code=201)


@router.patch("/signer-groups/{group_id}")
async def update_signer_group(
    group_id: UUID,
    data: SignerGroupIn,
    vendor_id: UUID = Depends(get_current_vendor_id),
    _perm: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    group = (
        await db.execute(
            select(PharmaSignerGroup).where(
                PharmaSignerGroup.id == group_id,
                PharmaSignerGroup.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not group:
        raise HTTPException(404, "Signer group not found")
    group.name = data.name
    group.description = data.description
    group.is_active = data.is_active
    await db.commit()
    members = (
        await db.execute(
            select(PharmaSignerGroupMember).where(PharmaSignerGroupMember.group_id == group_id)
        )
    ).scalars().all()
    return JSONResponse(_group_to_dict(group, list(members)))


@router.post("/signer-groups/{group_id}/members", status_code=201)
async def add_signer_group_member(
    group_id: UUID,
    vendor_user_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    _perm: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    group = (
        await db.execute(
            select(PharmaSignerGroup).where(
                PharmaSignerGroup.id == group_id,
                PharmaSignerGroup.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not group:
        raise HTTPException(404, "Signer group not found")
    existing = (
        await db.execute(
            select(PharmaSignerGroupMember).where(
                PharmaSignerGroupMember.group_id == group_id,
                PharmaSignerGroupMember.vendor_user_id == vendor_user_id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(409, "User is already a member of this signer group")
    member = PharmaSignerGroupMember(
        id=__import__("uuid").uuid4(),
        group_id=group_id,
        vendor_user_id=vendor_user_id,
    )
    db.add(member)
    await db.commit()
    members = (
        await db.execute(
            select(PharmaSignerGroupMember).where(PharmaSignerGroupMember.group_id == group_id)
        )
    ).scalars().all()
    return JSONResponse(_group_to_dict(group, list(members)), status_code=201)


@router.delete("/signer-groups/{group_id}/members/{vendor_user_id}", status_code=204)
async def remove_signer_group_member(
    group_id: UUID,
    vendor_user_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    _perm: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    group = (
        await db.execute(
            select(PharmaSignerGroup).where(
                PharmaSignerGroup.id == group_id,
                PharmaSignerGroup.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not group:
        raise HTTPException(404, "Signer group not found")
    member = (
        await db.execute(
            select(PharmaSignerGroupMember).where(
                PharmaSignerGroupMember.group_id == group_id,
                PharmaSignerGroupMember.vendor_user_id == vendor_user_id,
            )
        )
    ).scalar_one_or_none()
    if not member:
        raise HTTPException(404, "Member not found in this signer group")
    await db.delete(member)
    await db.commit()


# ── Per-org Track & Trace region overrides ───────────────────────────────────

class OrgRegionUpsert(BaseModel):
    store_id: Optional[UUID] = None
    plant_id: Optional[UUID] = None
    track_trace_region: str = Field(..., pattern="^(none|us|eu)$")


def _org_region_dict(r: PharmaOrgRegion) -> dict:
    return {
        "id": str(r.id),
        "store_id": str(r.store_id) if r.store_id else None,
        "plant_id": str(r.plant_id) if r.plant_id else None,
        "track_trace_region": r.track_trace_region,
    }


@router.get("/org-regions")
async def list_org_regions(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Return all per-BU / branch / plant Track & Trace region overrides."""
    rows = (
        await db.execute(
            select(PharmaOrgRegion)
            .where(PharmaOrgRegion.vendor_id == vendor_id)
            .order_by(PharmaOrgRegion.store_id.nulls_last(), PharmaOrgRegion.plant_id.nulls_last())
        )
    ).scalars().all()
    return JSONResponse([_org_region_dict(r) for r in rows])


@router.put("/org-regions", status_code=200)
async def upsert_org_region(
    data: OrgRegionUpsert,
    vendor_id: UUID = Depends(get_current_vendor_id),
    _perm: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Create or update a per-org region override.

    Exactly one of store_id or plant_id must be provided.
    Sending track_trace_region='none' is valid — it explicitly overrides the
    vendor default to 'no serialization required here'.
    """
    if not data.store_id and not data.plant_id:
        raise HTTPException(400, "Provide store_id (BU/branch) or plant_id — not both or neither")
    if data.store_id and data.plant_id:
        raise HTTPException(400, "Provide store_id or plant_id, not both")

    region = data.track_trace_region.lower()
    if region not in TRACK_TRACE_REGIONS:
        raise HTTPException(400, f"track_trace_region must be one of: {', '.join(TRACK_TRACE_REGIONS)}")

    if data.plant_id:
        row = (
            await db.execute(
                select(PharmaOrgRegion).where(
                    PharmaOrgRegion.vendor_id == vendor_id,
                    PharmaOrgRegion.plant_id == data.plant_id,
                )
            )
        ).scalar_one_or_none()
        if row:
            row.track_trace_region = region
        else:
            row = PharmaOrgRegion(
                id=__import__("uuid").uuid4(),
                vendor_id=vendor_id,
                plant_id=data.plant_id,
                track_trace_region=region,
            )
            db.add(row)
    else:
        row = (
            await db.execute(
                select(PharmaOrgRegion).where(
                    PharmaOrgRegion.vendor_id == vendor_id,
                    PharmaOrgRegion.store_id == data.store_id,
                )
            )
        ).scalar_one_or_none()
        if row:
            row.track_trace_region = region
        else:
            row = PharmaOrgRegion(
                id=__import__("uuid").uuid4(),
                vendor_id=vendor_id,
                store_id=data.store_id,
                track_trace_region=region,
            )
            db.add(row)

    await db.commit()
    return JSONResponse(_org_region_dict(row))


@router.delete("/org-regions/{region_id}", status_code=204)
async def delete_org_region(
    region_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    _perm: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Remove a per-org region override (falls back to vendor default after deletion)."""
    row = (
        await db.execute(
            select(PharmaOrgRegion).where(
                PharmaOrgRegion.id == region_id,
                PharmaOrgRegion.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Org region override not found")
    await db.delete(row)
    await db.commit()


# ── Batch number allocation ───────────────────────────────────────────────────

class BatchNumberRequest(BaseModel):
    plant_id: Optional[str] = None
    product_id: Optional[str] = None
    # Prefer model_code; purpose resolves the default model for that use-case
    model_code: Optional[str] = None
    purpose: Optional[str] = "manual"  # manual|production|receipt|return|serial
    # Legacy hard-coded fallback only when no model exists (internal call sites)
    prefix: str = "B"
    pad_width: int = 5


@router.post("/batch-numbers/next")
async def allocate_batch_number(
    data: BatchNumberRequest,
    vendor_id: UUID = Depends(get_current_vendor_id),
    _perm: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    resolved_model = None
    if data.model_code:
        resolved_model = (
            await db.execute(
                select(PharmaBatchNumberModel).where(
                    PharmaBatchNumberModel.vendor_id == vendor_id,
                    PharmaBatchNumberModel.code == data.model_code.strip().upper(),
                    PharmaBatchNumberModel.is_active.is_(True),
                )
            )
        ).scalar_one_or_none()
        if not resolved_model:
            raise HTTPException(404, f"Batch number model '{data.model_code}' not found")

    number = await next_batch_number(
        db,
        vendor_id,
        prefix=data.prefix,
        plant_id=_optional_uuid(data.plant_id, "plant_id"),
        product_id=_optional_uuid(data.product_id, "product_id"),
        pad_width=data.pad_width,
        model=resolved_model,
        purpose=data.purpose,
    )
    await db.commit()
    return JSONResponse({"batch_number": number})


def _period_matches_reset(period_key: str, reset_period: str) -> bool:
    """True when a sequence period_key is consistent with a model's reset_period."""
    pk = (period_key or "").strip()
    rp = (reset_period or "never").strip().lower()
    if rp == "never":
        return pk == ""
    if rp == "yearly":
        return len(pk) == 4 and pk.isdigit()
    if rp == "monthly":
        return len(pk) == 6 and pk.isdigit()
    if rp == "daily":
        return len(pk) == 8 and pk.isdigit()
    return True


def _linked_models_for_sequence(
    seq: PharmaBatchSequence,
    models: list[PharmaBatchNumberModel],
) -> list[dict]:
    """Match models → sequence by prefix + reset/period (no FK exists)."""
    prefix = (seq.prefix or "").strip().upper()
    pk = seq.period_key or ""
    linked: list[dict] = []
    for m in models:
        if (m.prefix or "").strip().upper() != prefix:
            continue
        if not _period_matches_reset(pk, m.reset_period or "never"):
            continue
        linked.append(
            {
                "id": str(m.id),
                "code": m.code,
                "label": m.label,
                "is_active": bool(m.is_active),
                "is_default": bool(m.is_default),
            }
        )
    return linked


@router.get("/batch-sequences")
async def list_batch_sequences(
    plant_id: Optional[str] = Query(None, description="Filter to a specific plant"),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(PharmaBatchSequence)
        .where(PharmaBatchSequence.vendor_id == vendor_id)
        .order_by(PharmaBatchSequence.prefix)
    )
    if plant_id:
        q = q.where(PharmaBatchSequence.plant_id == _optional_uuid(plant_id, "plant_id"))
    rows = (await db.execute(q)).scalars().all()
    models = (
        await db.execute(
            select(PharmaBatchNumberModel)
            .where(PharmaBatchNumberModel.vendor_id == vendor_id)
            .order_by(PharmaBatchNumberModel.code)
        )
    ).scalars().all()
    sequences = []
    for s in rows:
        prefix = (s.prefix or "").strip()
        batch_count = 0
        if prefix:
            batch_count = int(
                (
                    await db.execute(
                        select(func.count())
                        .select_from(GoodsBatch)
                        .where(
                            GoodsBatch.vendor_id == vendor_id,
                            GoodsBatch.is_active.is_(True),
                            (
                                (GoodsBatch.batch_number == prefix)
                                | GoodsBatch.batch_number.ilike(f"{prefix}-%")
                            ),
                        )
                    )
                ).scalar()
                or 0
            )
        sequences.append(
            {
                "id": str(s.id),
                "prefix": s.prefix,
                "plant_id": str(s.plant_id) if s.plant_id else None,
                "product_id": str(s.product_id) if s.product_id else None,
                "period_key": s.period_key or "",
                "last_number": s.last_number,
                "pad_width": s.pad_width,
                "batch_count": batch_count,
                "linked_models": _linked_models_for_sequence(s, list(models)),
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "updated_at": s.updated_at.isoformat() if s.updated_at else None,
            }
        )
    return JSONResponse({"sequences": sequences})


@router.get("/batch-sequences/{sequence_id}")
async def get_batch_sequence(
    sequence_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Sequence track info + batches allocated under this prefix + workflow history."""
    seq = (
        await db.execute(
            select(PharmaBatchSequence).where(
                PharmaBatchSequence.id == sequence_id,
                PharmaBatchSequence.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not seq:
        raise HTTPException(404, "Sequence not found")

    prefix = (seq.prefix or "").strip()
    product_name: Optional[str] = None
    if seq.product_id:
        product_name = (
            await db.execute(select(Product.name).where(Product.id == seq.product_id))
        ).scalar_one_or_none()

    batches: list = []
    if prefix:
        # Prefer exact prefix segment: "B-…" / "B" — exclude longer prefixes like "BH-…"
        batch_rows = (
            await db.execute(
                select(GoodsBatch)
                .where(
                    GoodsBatch.vendor_id == vendor_id,
                    GoodsBatch.is_active.is_(True),
                    (
                        (GoodsBatch.batch_number == prefix)
                        | GoodsBatch.batch_number.ilike(f"{prefix}-%")
                    ),
                )
                .order_by(GoodsBatch.created_at.desc())
                .limit(200)
            )
        ).scalars().all()
        # Filter out false positives where another prefix starts with this one (B vs BH)
        batches = [
            b
            for b in batch_rows
            if b.batch_number == prefix
            or (b.batch_number or "").startswith(f"{prefix}-")
        ]

    batch_ids = [b.id for b in batches]
    name_map: dict = {}
    if batches:
        product_ids = {b.product_id for b in batches if b.product_id}
        if product_ids:
            name_rows = (
                await db.execute(select(Product.id, Product.name).where(Product.id.in_(product_ids)))
            ).all()
            name_map = {row[0]: row[1] for row in name_rows}

    status_counts: dict[str, int] = {}
    for b in batches:
        key = b.quality_status or "unknown"
        status_counts[key] = status_counts.get(key, 0) + 1

    transactions: list = []
    bprs: list = []
    inspections: list = []
    if batch_ids:
        txn_rows = (
            await db.execute(
                select(BatchTransaction)
                .where(
                    BatchTransaction.vendor_id == vendor_id,
                    (
                        BatchTransaction.from_batch_id.in_(batch_ids)
                        | BatchTransaction.to_batch_id.in_(batch_ids)
                    ),
                )
                .order_by(BatchTransaction.created_at.desc())
                .limit(200)
            )
        ).scalars().all()
        transactions = [_txn_dict(t) for t in txn_rows]

        bpr_rows = (
            await db.execute(
                select(PharmaBpr)
                .where(
                    PharmaBpr.vendor_id == vendor_id,
                    PharmaBpr.goods_batch_id.in_(batch_ids),
                )
                .order_by(PharmaBpr.created_at.desc())
                .limit(100)
            )
        ).scalars().all()
        bprs = [
            {
                "id": str(r.id),
                "batch_number": r.batch_number,
                "goods_batch_id": str(r.goods_batch_id) if r.goods_batch_id else None,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "completed_at": r.completed_at.isoformat() if getattr(r, "completed_at", None) else None,
            }
            for r in bpr_rows
        ]

        insp_rows = (
            await db.execute(
                select(PharmaInspectionLot)
                .where(
                    PharmaInspectionLot.vendor_id == vendor_id,
                    PharmaInspectionLot.goods_batch_id.in_(batch_ids),
                )
                .order_by(PharmaInspectionLot.created_at.desc())
                .limit(100)
            )
        ).scalars().all()
        batch_number_map = {b.id: b.batch_number for b in batches}
        inspections = [
            {
                "id": str(r.id),
                "goods_batch_id": str(r.goods_batch_id),
                "batch_number": batch_number_map.get(r.goods_batch_id),
                "status": r.status,
                "decision": r.decision,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in insp_rows
        ]

    # Enrich transactions with batch numbers for readability
    batch_number_by_id = {str(b.id): b.batch_number for b in batches}
    for t in transactions:
        t["from_batch_number"] = batch_number_by_id.get(t.get("from_batch_id") or "")
        t["to_batch_number"] = batch_number_by_id.get(t.get("to_batch_id") or "")

    models = (
        await db.execute(
            select(PharmaBatchNumberModel)
            .where(PharmaBatchNumberModel.vendor_id == vendor_id)
            .order_by(PharmaBatchNumberModel.code)
        )
    ).scalars().all()
    linked_models = _linked_models_for_sequence(seq, list(models))

    return JSONResponse(
        {
            "sequence": {
                "id": str(seq.id),
                "prefix": seq.prefix,
                "plant_id": str(seq.plant_id) if seq.plant_id else None,
                "product_id": str(seq.product_id) if seq.product_id else None,
                "product_name": product_name,
                "period_key": seq.period_key or "",
                "last_number": seq.last_number,
                "pad_width": seq.pad_width,
                "created_at": seq.created_at.isoformat() if seq.created_at else None,
                "updated_at": seq.updated_at.isoformat() if seq.updated_at else None,
            },
            "linked_models": linked_models,
            "track": {
                "batch_count": len(batches),
                "status_counts": status_counts,
                "txn_count": len(transactions),
                "bpr_count": len(bprs),
                "inspection_count": len(inspections),
                "next_preview": (
                    f"{prefix}-{str(int(seq.last_number or 0) + 1).zfill(int(seq.pad_width or 5))}"
                    if prefix
                    else None
                ),
            },
            "batches": [_batch_dict(b, product_name=name_map.get(b.product_id)) for b in batches],
            "workflow": {
                "transactions": transactions,
                "bprs": bprs,
                "inspections": inspections,
            },
        }
    )


# ── Batch Number Models (user-defined patterns) ────────────────────────────────

class BatchNumberModelCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=40)
    label: str = Field(..., min_length=1, max_length=120)
    pattern: str = Field(..., min_length=1, max_length=120)
    prefix: str = Field("B", max_length=40)
    pad_width: int = Field(5, ge=2, le=12)
    reset_period: str = Field("never")   # never|yearly|monthly|daily
    scope: str = Field("vendor")         # vendor|plant|product
    applies_to: str = Field("manual")   # comma-separated
    is_default: bool = False
    is_active: bool = True


class BatchNumberModelUpdate(BaseModel):
    label: Optional[str] = Field(None, max_length=120)
    pattern: Optional[str] = Field(None, max_length=120)
    prefix: Optional[str] = Field(None, max_length=40)
    pad_width: Optional[int] = Field(None, ge=2, le=12)
    reset_period: Optional[str] = None
    scope: Optional[str] = None
    applies_to: Optional[str] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None


def _model_dict(m: PharmaBatchNumberModel) -> dict:
    return {
        "id": str(m.id),
        "code": m.code,
        "label": m.label,
        "pattern": m.pattern,
        "prefix": m.prefix,
        "pad_width": m.pad_width,
        "reset_period": m.reset_period,
        "scope": m.scope,
        "applies_to": m.applies_to,
        "is_default": m.is_default,
        "is_active": m.is_active,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "updated_at": m.updated_at.isoformat() if m.updated_at else None,
    }


@router.get("/batch-number-models")
async def list_batch_number_models(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(PharmaBatchNumberModel)
            .where(PharmaBatchNumberModel.vendor_id == vendor_id)
            .order_by(
                PharmaBatchNumberModel.is_default.desc(),
                PharmaBatchNumberModel.code,
            )
        )
    ).scalars().all()
    return JSONResponse({"models": [_model_dict(m) for m in rows]})


@router.post(
    "/batch-number-models",
    status_code=201,
    dependencies=[Depends(require_permission("pharma.manage"))],
)
async def create_batch_number_model(
    body: BatchNumberModelCreate,
    request: Request,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    # Validate pattern
    errors = validate_pattern(body.pattern)
    if errors:
        raise HTTPException(422, detail="; ".join(errors))

    # Enforce unique code per vendor
    existing = (
        await db.execute(
            select(PharmaBatchNumberModel).where(
                PharmaBatchNumberModel.vendor_id == vendor_id,
                PharmaBatchNumberModel.code == body.code.strip().upper(),
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(409, "A model with that code already exists.")

    valid_periods = {"never", "yearly", "monthly", "daily"}
    if body.reset_period not in valid_periods:
        raise HTTPException(422, f"reset_period must be one of {sorted(valid_periods)}")
    valid_scopes = {"vendor", "plant", "product"}
    if body.scope not in valid_scopes:
        raise HTTPException(422, f"scope must be one of {sorted(valid_scopes)}")

    model = PharmaBatchNumberModel(
        vendor_id=vendor_id,
        code=body.code.strip().upper(),
        label=body.label.strip(),
        pattern=body.pattern.strip(),
        prefix=(body.prefix or "B").strip().upper()[:40],
        pad_width=max(2, min(12, body.pad_width)),
        reset_period=body.reset_period,
        scope=body.scope,
        applies_to=body.applies_to,
        is_default=body.is_default,
        is_active=body.is_active,
    )
    db.add(model)
    await db.flush()
    # Refresh so server_default timestamps are loaded (avoids MissingGreenlet on _model_dict)
    await db.refresh(model)
    payload = _model_dict(model)

    await append_pharma_audit(
        db,
        vendor_id=vendor_id,
        entity_type="batch_number_model",
        entity_id=model.id,
        action="create",
        new_value=payload,
        ip_address=_client_ip(request),
    )
    await db.commit()
    return JSONResponse({"model": payload}, status_code=201)


@router.get("/batch-number-models/{model_id}")
async def get_batch_number_model(
    model_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    m = (
        await db.execute(
            select(PharmaBatchNumberModel).where(
                PharmaBatchNumberModel.id == model_id,
                PharmaBatchNumberModel.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not m:
        raise HTTPException(404, "Model not found")
    return JSONResponse({"model": _model_dict(m)})


@router.patch(
    "/batch-number-models/{model_id}",
    dependencies=[Depends(require_permission("pharma.manage"))],
)
async def update_batch_number_model(
    model_id: UUID,
    body: BatchNumberModelUpdate,
    request: Request,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    m = (
        await db.execute(
            select(PharmaBatchNumberModel).where(
                PharmaBatchNumberModel.id == model_id,
                PharmaBatchNumberModel.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not m:
        raise HTTPException(404, "Model not found")

    old = _model_dict(m)

    if body.pattern is not None:
        errors = validate_pattern(body.pattern)
        if errors:
            raise HTTPException(422, detail="; ".join(errors))
        m.pattern = body.pattern.strip()
    if body.label is not None:
        m.label = body.label.strip()
    if body.prefix is not None:
        m.prefix = body.prefix.strip().upper()[:40]
    if body.pad_width is not None:
        m.pad_width = max(2, min(12, body.pad_width))
    if body.reset_period is not None:
        valid_periods = {"never", "yearly", "monthly", "daily"}
        if body.reset_period not in valid_periods:
            raise HTTPException(422, f"reset_period must be one of {sorted(valid_periods)}")
        m.reset_period = body.reset_period
    if body.scope is not None:
        valid_scopes = {"vendor", "plant", "product"}
        if body.scope not in valid_scopes:
            raise HTTPException(422, f"scope must be one of {sorted(valid_scopes)}")
        m.scope = body.scope
    if body.applies_to is not None:
        m.applies_to = body.applies_to
    if body.is_default is not None:
        m.is_default = body.is_default
    if body.is_active is not None:
        m.is_active = body.is_active

    await db.flush()
    # Refresh so onupdate timestamps are loaded (avoids MissingGreenlet on _model_dict)
    await db.refresh(m)
    payload = _model_dict(m)
    await append_pharma_audit(
        db,
        vendor_id=vendor_id,
        entity_type="batch_number_model",
        entity_id=m.id,
        action="update",
        old_value=old,
        new_value=payload,
        ip_address=_client_ip(request),
    )
    await db.commit()
    return JSONResponse({"model": payload})


@router.delete(
    "/batch-number-models/{model_id}",
    status_code=204,
    dependencies=[Depends(require_permission("pharma.manage"))],
)
async def delete_batch_number_model(
    model_id: UUID,
    request: Request,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    m = (
        await db.execute(
            select(PharmaBatchNumberModel).where(
                PharmaBatchNumberModel.id == model_id,
                PharmaBatchNumberModel.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not m:
        raise HTTPException(404, "Model not found")
    old = _model_dict(m)
    await db.delete(m)
    await append_pharma_audit(
        db,
        vendor_id=vendor_id,
        entity_type="batch_number_model",
        entity_id=model_id,
        action="delete",
        old_value=old,
        ip_address=_client_ip(request),
    )
    await db.commit()


@router.post("/batch-number-models/preview")
async def preview_batch_number_pattern(
    body: dict,
    vendor_id: UUID = Depends(get_current_vendor_id),
):
    """Render a pattern preview without persisting a counter. Used by UI builder."""
    pattern = str(body.get("pattern", ""))
    prefix = str(body.get("prefix", "B"))
    pad_width = int(body.get("pad_width", 5))
    errors = validate_pattern(pattern)
    if errors:
        return JSONResponse({"preview": None, "errors": errors})
    preview = render_batch_number(pattern, 1, prefix=prefix, pad_width=pad_width)
    return JSONResponse({"preview": preview, "errors": []})


# ── Phase 1: batches + transactions ───────────────────────────────────────────

@router.get("/batches")
async def list_pharma_batches(
    product_id: Optional[str] = None,
    quality_status: Optional[str] = None,
    plant_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(GoodsBatch).where(GoodsBatch.vendor_id == vendor_id, GoodsBatch.is_active.is_(True))
    if product_id:
        q = q.where(GoodsBatch.product_id == _require_uuid(product_id, "product_id"))
    if quality_status:
        q = q.where(GoodsBatch.quality_status == quality_status)
    if plant_id:
        q = q.where(GoodsBatch.plant_id == _require_uuid(plant_id, "plant_id"))
    if search:
        q = q.where(GoodsBatch.batch_number.ilike(f"%{search.strip()}%"))
    total = int((await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0)
    rows = (
        await db.execute(q.order_by(GoodsBatch.expiry_date.asc().nulls_last()).offset(offset).limit(limit))
    ).scalars().all()
    product_ids = {b.product_id for b in rows}
    name_map: dict = {}
    if product_ids:
        name_rows = (
            await db.execute(select(Product.id, Product.name).where(Product.id.in_(product_ids)))
        ).all()
        name_map = {row[0]: row[1] for row in name_rows}
    ref_map = await _resolve_batch_source_refs(db, list(rows))
    return JSONResponse({
        "batches": [
            _batch_dict(
                b,
                product_name=name_map.get(b.product_id),
                source_ref=ref_map.get(b.source_id) if b.source_id else None,
            )
            for b in rows
        ],
        "total": total,
    })


@router.get("/batches/{batch_id}")
async def get_pharma_batch(
    batch_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    batch = (
        await db.execute(
            select(GoodsBatch).where(GoodsBatch.id == batch_id, GoodsBatch.vendor_id == vendor_id)
        )
    ).scalar_one_or_none()
    if not batch:
        raise HTTPException(404, "Batch not found")
    product_name: Optional[str] = None
    if batch.product_id:
        row = (await db.execute(select(Product.name).where(Product.id == batch.product_id))).scalar_one_or_none()
        product_name = row
    ref_map = await _resolve_batch_source_refs(db, [batch])
    return JSONResponse(
        _batch_dict(
            batch,
            product_name=product_name,
            source_ref=ref_map.get(batch.source_id) if batch.source_id else None,
        )
    )


class BatchStatusUpdate(BaseModel):
    quality_status: str
    notes: Optional[str] = None
    meaning: Optional[str] = "status_change"


@router.patch("/batches/{batch_id}/status")
async def update_batch_status(
    batch_id: UUID,
    data: BatchStatusUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    allowed = {"quality_inspection", "blocked"}
    if data.quality_status == "unrestricted":
        raise HTTPException(
            400,
            "Release lots via Inspections → Decide (requires pharma.release). "
            "Direct unrestricted status is not allowed.",
        )
    if data.quality_status not in allowed:
        raise HTTPException(400, f"quality_status must be one of {sorted(allowed | {'unrestricted'})}")
    batch = (
        await db.execute(
            select(GoodsBatch).where(GoodsBatch.id == batch_id, GoodsBatch.vendor_id == vendor_id)
        )
    ).scalar_one_or_none()
    if not batch:
        raise HTTPException(404, "Batch not found")
    old = batch.quality_status
    batch.quality_status = data.quality_status
    if data.notes:
        batch.notes = ((batch.notes or "") + "\n" + data.notes).strip()
    await append_pharma_audit(
        db,
        vendor_id=vendor_id,
        entity_type="goods_batch",
        entity_id=batch.id,
        action="quality_status_change",
        actor_id=vu.id,
        meaning=data.meaning,
        old_value={"quality_status": old},
        new_value={"quality_status": data.quality_status},
    )
    await db.commit()
    await db.refresh(batch)
    return JSONResponse(_batch_dict(batch))


@router.get("/transactions")
async def list_batch_transactions(
    product_id: Optional[str] = None,
    batch_id: Optional[str] = None,
    source_type: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(BatchTransaction).where(BatchTransaction.vendor_id == vendor_id)
    if product_id:
        q = q.where(BatchTransaction.product_id == _require_uuid(product_id, "product_id"))
    if batch_id:
        bid = _require_uuid(batch_id, "batch_id")
        q = q.where(
            (BatchTransaction.from_batch_id == bid) | (BatchTransaction.to_batch_id == bid)
        )
    if source_type:
        q = q.where(BatchTransaction.source_type == source_type)
    total = int((await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0)
    rows = (
        await db.execute(q.order_by(BatchTransaction.created_at.desc()).offset(offset).limit(limit))
    ).scalars().all()
    return JSONResponse({"transactions": [_txn_dict(t) for t in rows], "total": total})


# ── Phase 2: FEFO + quarantine ────────────────────────────────────────────────

@router.get("/fefo")
async def fefo_preview(
    product_id: str = Query(...),
    qty: float = Query(1, gt=0),
    plant_id: Optional[str] = None,
    storage_location_id: Optional[str] = None,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    batches = await list_fefo_batches(
        db,
        vendor_id,
        _require_uuid(product_id, "product_id"),
        qty_needed=Decimal(str(qty)),
        plant_id=_optional_uuid(plant_id, "plant_id"),
        storage_location_id=_optional_uuid(storage_location_id, "storage_location_id"),
    )
    remaining = Decimal(str(qty))
    plan = []
    for b in batches:
        take = min(Decimal(str(b.quantity_available or 0)), remaining)
        if take <= 0:
            continue
        plan.append({**_batch_dict(b), "allocate_qty": float(take)})
        remaining -= take
    return JSONResponse({
        "product_id": product_id,
        "requested_qty": qty,
        "allocations": plan,
        "short_by": float(remaining) if remaining > 0 else 0,
    })


@router.get("/quarantine")
async def quarantine_board(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    batches = (
        await db.execute(
            select(GoodsBatch).where(
                GoodsBatch.vendor_id == vendor_id,
                GoodsBatch.is_active.is_(True),
                GoodsBatch.quality_status.in_(["quality_inspection", "blocked"]),
            ).order_by(GoodsBatch.created_at.desc()).limit(200)
        )
    ).scalars().all()
    slocs = (
        await db.execute(
            select(StorageLocation).where(
                StorageLocation.vendor_id == vendor_id,
                StorageLocation.stock_type.in_(["quarantine", "rejected", "returns"]),
            )
        )
    ).scalars().all()
    return JSONResponse({
        "batches": [_batch_dict(b) for b in batches],
        "locations": [
            {
                "id": str(s.id),
                "name": s.name,
                "code": s.code,
                "stock_type": s.stock_type,
                "store_id": str(s.store_id),
            }
            for s in slocs
        ],
    })


# ── Phase 3: MBR / BPR ────────────────────────────────────────────────────────

class MbrCreate(BaseModel):
    product_id: str
    code: str
    title: str
    batch_size: Optional[float] = None
    batch_size_uom: Optional[str] = None
    bom_snapshot: list = Field(default_factory=list)
    operations: list = Field(default_factory=list)
    line_clearance: list = Field(default_factory=list)
    ipc_checks: list = Field(default_factory=list)
    notes: Optional[str] = None


@router.get("/mbr")
async def list_mbr(
    product_id: Optional[str] = None,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(PharmaMbr).where(PharmaMbr.vendor_id == vendor_id)
    if product_id:
        q = q.where(PharmaMbr.product_id == _require_uuid(product_id, "product_id"))
    rows = (await db.execute(q.order_by(PharmaMbr.code, PharmaMbr.version.desc()))).scalars().all()
    return JSONResponse({"items": [_mbr_dict(r) for r in rows]})


def _mbr_dict(m: PharmaMbr) -> dict:
    return {
        "id": str(m.id),
        "product_id": str(m.product_id),
        "code": m.code,
        "title": m.title,
        "version": m.version,
        "status": m.status,
        "batch_size": float(m.batch_size) if m.batch_size is not None else None,
        "batch_size_uom": m.batch_size_uom,
        "bom_snapshot": m.bom_snapshot or [],
        "operations": m.operations or [],
        "line_clearance": m.line_clearance or [],
        "ipc_checks": m.ipc_checks or [],
        "notes": m.notes,
        "approved_at": m.approved_at.isoformat() if m.approved_at else None,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


@router.post("/mbr", status_code=201)
async def create_mbr(
    data: MbrCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    last = (
        await db.execute(
            select(func.max(PharmaMbr.version)).where(
                PharmaMbr.vendor_id == vendor_id,
                PharmaMbr.code == data.code.strip(),
            )
        )
    ).scalar()
    mbr = PharmaMbr(
        vendor_id=vendor_id,
        product_id=_require_uuid(data.product_id, "product_id"),
        code=data.code.strip(),
        title=data.title.strip(),
        version=int(last or 0) + 1,
        batch_size=Decimal(str(data.batch_size)) if data.batch_size is not None else None,
        batch_size_uom=data.batch_size_uom,
        bom_snapshot=data.bom_snapshot,
        operations=data.operations,
        line_clearance=data.line_clearance,
        ipc_checks=data.ipc_checks,
        notes=data.notes,
    )
    db.add(mbr)
    await db.flush()
    await append_pharma_audit(
        db, vendor_id=vendor_id, entity_type="pharma_mbr", entity_id=mbr.id,
        action="create", actor_id=vu.id, new_value=_mbr_dict(mbr),
    )
    await db.commit()
    await db.refresh(mbr)
    return JSONResponse(_mbr_dict(mbr), status_code=201)


class MbrApprove(ESignFields):
    pass


@router.post("/mbr/{mbr_id}/approve")
async def approve_mbr(
    mbr_id: UUID,
    data: MbrApprove = MbrApprove(),
    request: Request = None,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    mbr = (
        await db.execute(select(PharmaMbr).where(PharmaMbr.id == mbr_id, PharmaMbr.vendor_id == vendor_id))
    ).scalar_one_or_none()
    if not mbr:
        raise HTTPException(404, "MBR not found")
    if mbr.status != "draft":
        raise HTTPException(400, "Only draft MBRs can be approved")
    cfg = await load_pharma_settings(db, vendor_id)
    if cfg.get("esign_required"):
        await verify_and_record_esign(
            db, vendor_id=vendor_id, vu=vu,
            entity_type="pharma_mbr", entity_id=mbr.id,
            action="approve", password=data.password,
            meaning=data.meaning or "approver",
            totp_code=data.totp_code,
            dual_sign_required=False,
            ip_address=_client_ip(request),
            settings=cfg,
        )
    # Supersede prior approved versions of same code
    prior = (
        await db.execute(
            select(PharmaMbr).where(
                PharmaMbr.vendor_id == vendor_id,
                PharmaMbr.code == mbr.code,
                PharmaMbr.status == "approved",
                PharmaMbr.id != mbr.id,
            )
        )
    ).scalars().all()
    for p in prior:
        p.status = "superseded"
    mbr.status = "approved"
    mbr.approved_at = datetime.now(timezone.utc)
    mbr.approved_by = vu.id
    await append_pharma_audit(
        db, vendor_id=vendor_id, entity_type="pharma_mbr", entity_id=mbr.id,
        action="approve", actor_id=vu.id, meaning=data.meaning or "approver",
    )
    await db.commit()
    await db.refresh(mbr)
    return JSONResponse(_mbr_dict(mbr))


class MbrUpdate(BaseModel):
    title: Optional[str] = None
    batch_size: Optional[float] = None
    batch_size_uom: Optional[str] = None
    bom_snapshot: Optional[list] = None
    operations: Optional[list] = None
    line_clearance: Optional[list] = None
    ipc_checks: Optional[list] = None
    notes: Optional[str] = None


@router.patch("/mbr/{mbr_id}")
async def update_mbr(
    mbr_id: UUID,
    data: MbrUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    mbr = (
        await db.execute(select(PharmaMbr).where(PharmaMbr.id == mbr_id, PharmaMbr.vendor_id == vendor_id))
    ).scalar_one_or_none()
    if not mbr:
        raise HTTPException(404, "MBR not found")
    if mbr.status != "draft":
        raise HTTPException(400, "Only draft MBRs can be edited — create a new version instead")
    if data.title is not None:
        mbr.title = data.title.strip()
    if data.batch_size is not None:
        mbr.batch_size = Decimal(str(data.batch_size))
    if data.batch_size_uom is not None:
        mbr.batch_size_uom = data.batch_size_uom
    if data.bom_snapshot is not None:
        mbr.bom_snapshot = data.bom_snapshot
        flag_modified(mbr, "bom_snapshot")
    if data.operations is not None:
        mbr.operations = data.operations
        flag_modified(mbr, "operations")
    if data.line_clearance is not None:
        mbr.line_clearance = data.line_clearance
        flag_modified(mbr, "line_clearance")
    if data.ipc_checks is not None:
        mbr.ipc_checks = data.ipc_checks
        flag_modified(mbr, "ipc_checks")
    if data.notes is not None:
        mbr.notes = data.notes
    await append_pharma_audit(
        db, vendor_id=vendor_id, entity_type="pharma_mbr", entity_id=mbr.id,
        action="update", actor_id=vu.id,
    )
    await db.commit()
    await db.refresh(mbr)
    return JSONResponse(_mbr_dict(mbr))


class BprCreate(BaseModel):
    product_id: str
    batch_number: str
    mbr_id: Optional[str] = None
    production_order_id: Optional[str] = None
    goods_batch_id: Optional[str] = None
    planned_qty: Optional[float] = None


def _seed_bpr_from_mbr(mbr: PharmaMbr) -> tuple[list, list]:
    """Seed operation_log + ipc_results from an approved MBR template."""
    ops = []
    for i, op in enumerate(mbr.operations or []):
        if not isinstance(op, dict):
            continue
        ops.append({
            "seq": op.get("seq", (i + 1) * 10),
            "name": op.get("name") or f"Step {i + 1}",
            "status": "pending",
            "started_at": None,
            "completed_at": None,
            "notes": None,
            "meta": {k: v for k, v in op.items() if k not in ("seq", "name")},
        })
    ipcs = []
    for check in mbr.ipc_checks or []:
        if not isinstance(check, dict):
            continue
        ipcs.append({
            "name": check.get("name") or "IPC",
            "status": "pending",
            "value": None,
            "pass": None,
            "checked_at": None,
            "meta": check,
        })
    return ops, ipcs


def _bpr_dict(b: PharmaBpr) -> dict:
    return {
        "id": str(b.id),
        "product_id": str(b.product_id),
        "mbr_id": str(b.mbr_id) if b.mbr_id else None,
        "production_order_id": str(b.production_order_id) if b.production_order_id else None,
        "goods_batch_id": str(b.goods_batch_id) if b.goods_batch_id else None,
        "batch_number": b.batch_number,
        "status": b.status,
        "planned_qty": float(b.planned_qty) if b.planned_qty is not None else None,
        "actual_qty": float(b.actual_qty) if b.actual_qty is not None else None,
        "yield_pct": float(b.yield_pct) if b.yield_pct is not None else None,
        "operation_log": b.operation_log or [],
        "material_log": b.material_log or [],
        "ipc_results": b.ipc_results or [],
        "clearance_done": bool(b.clearance_done),
        "notes": b.notes,
        "pdf_url": getattr(b, "pdf_url", None),
        "started_at": b.started_at.isoformat() if b.started_at else None,
        "completed_at": b.completed_at.isoformat() if b.completed_at else None,
        "created_at": b.created_at.isoformat() if b.created_at else None,
    }


@router.get("/bpr")
async def list_bpr(
    status_filter: Optional[str] = Query(None, alias="status"),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(PharmaBpr).where(PharmaBpr.vendor_id == vendor_id)
    if status_filter:
        q = q.where(PharmaBpr.status == status_filter)
    rows = (await db.execute(q.order_by(PharmaBpr.created_at.desc()))).scalars().all()
    return JSONResponse({"items": [_bpr_dict(r) for r in rows]})


@router.post("/bpr", status_code=201)
async def create_bpr(
    data: BprCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    product_id = _require_uuid(data.product_id, "product_id")
    mbr = None
    mbr_id = _optional_uuid(data.mbr_id, "mbr_id")
    if mbr_id:
        mbr = (
            await db.execute(
                select(PharmaMbr).where(PharmaMbr.id == mbr_id, PharmaMbr.vendor_id == vendor_id)
            )
        ).scalar_one_or_none()
        if not mbr:
            raise HTTPException(404, "MBR not found")
    else:
        mbr = (
            await db.execute(
                select(PharmaMbr).where(
                    PharmaMbr.vendor_id == vendor_id,
                    PharmaMbr.product_id == product_id,
                    PharmaMbr.status == "approved",
                ).order_by(PharmaMbr.version.desc()).limit(1)
            )
        ).scalar_one_or_none()

    op_log: list = []
    ipc_log: list = []
    if mbr:
        op_log, ipc_log = _seed_bpr_from_mbr(mbr)

    bpr = PharmaBpr(
        vendor_id=vendor_id,
        product_id=product_id,
        batch_number=data.batch_number.strip(),
        mbr_id=mbr.id if mbr else None,
        production_order_id=_optional_uuid(data.production_order_id, "production_order_id"),
        goods_batch_id=_optional_uuid(data.goods_batch_id, "goods_batch_id"),
        planned_qty=Decimal(str(data.planned_qty)) if data.planned_qty is not None else None,
        operation_log=op_log,
        ipc_results=ipc_log,
        status="open",
    )
    db.add(bpr)
    await db.flush()
    await append_pharma_audit(
        db, vendor_id=vendor_id, entity_type="pharma_bpr", entity_id=bpr.id,
        action="create", actor_id=vu.id,
        new_value={"mbr_id": str(mbr.id) if mbr else None, "steps": len(op_log)},
    )
    await db.commit()
    await db.refresh(bpr)
    return JSONResponse(_bpr_dict(bpr), status_code=201)


class BprUpdate(BaseModel):
    status: Optional[str] = None
    actual_qty: Optional[float] = None
    yield_pct: Optional[float] = None
    operation_log: Optional[list] = None
    material_log: Optional[list] = None
    ipc_results: Optional[list] = None
    clearance_done: Optional[bool] = None
    notes: Optional[str] = None


@router.patch("/bpr/{bpr_id}")
async def update_bpr(
    bpr_id: UUID,
    data: BprUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    bpr = (
        await db.execute(select(PharmaBpr).where(PharmaBpr.id == bpr_id, PharmaBpr.vendor_id == vendor_id))
    ).scalar_one_or_none()
    if not bpr:
        raise HTTPException(404, "BPR not found")
    for field in ("status", "notes"):
        val = getattr(data, field)
        if val is not None:
            setattr(bpr, field, val)
    if data.actual_qty is not None:
        bpr.actual_qty = Decimal(str(data.actual_qty))
    if data.yield_pct is not None:
        bpr.yield_pct = Decimal(str(data.yield_pct))
    if data.operation_log is not None:
        bpr.operation_log = data.operation_log
    if data.material_log is not None:
        bpr.material_log = data.material_log
    if data.ipc_results is not None:
        bpr.ipc_results = data.ipc_results
    if data.clearance_done is not None:
        bpr.clearance_done = data.clearance_done
    if data.status == "in_progress" and not bpr.started_at:
        bpr.started_at = datetime.now(timezone.utc)
    if data.status in ("completed", "closed") and not bpr.completed_at:
        bpr.completed_at = datetime.now(timezone.utc)
    await append_pharma_audit(
        db, vendor_id=vendor_id, entity_type="pharma_bpr", entity_id=bpr.id,
        action="update", actor_id=vu.id, new_value={"status": bpr.status},
    )
    await db.commit()
    await db.refresh(bpr)
    return JSONResponse(_bpr_dict(bpr))


class BprStepLog(BaseModel):
    seq: Optional[int] = None
    name: Optional[str] = None
    status: str = "completed"  # in_progress | completed | skipped
    notes: Optional[str] = None


@router.post("/bpr/{bpr_id}/steps")
async def log_bpr_step(
    bpr_id: UUID,
    data: BprStepLog,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    bpr = (
        await db.execute(select(PharmaBpr).where(PharmaBpr.id == bpr_id, PharmaBpr.vendor_id == vendor_id))
    ).scalar_one_or_none()
    if not bpr:
        raise HTTPException(404, "BPR not found")
    if bpr.status in ("completed", "closed"):
        raise HTTPException(400, "Cannot log steps on a completed BPR")
    if not bpr.clearance_done:
        raise HTTPException(400, "Complete line clearance before logging steps")
    if data.status not in ("in_progress", "completed", "skipped"):
        raise HTTPException(400, "status must be in_progress|completed|skipped")

    log = list(bpr.operation_log or [])
    now = datetime.now(timezone.utc).isoformat()
    matched = False
    for step in log:
        if not isinstance(step, dict):
            continue
        if (data.seq is not None and step.get("seq") == data.seq) or (
            data.name and step.get("name") == data.name
        ):
            step["status"] = data.status
            if data.notes is not None:
                step["notes"] = data.notes
            if data.status == "in_progress" and not step.get("started_at"):
                step["started_at"] = now
            if data.status in ("completed", "skipped"):
                step["completed_at"] = now
                if not step.get("started_at"):
                    step["started_at"] = now
            step["logged_by"] = str(vu.id)
            matched = True
            break
    if not matched:
        log.append({
            "seq": data.seq or (len(log) + 1) * 10,
            "name": data.name or f"Step {len(log) + 1}",
            "status": data.status,
            "notes": data.notes,
            "started_at": now,
            "completed_at": now if data.status in ("completed", "skipped") else None,
            "logged_by": str(vu.id),
        })
    bpr.operation_log = log
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(bpr, "operation_log")
    if bpr.status == "open":
        bpr.status = "in_progress"
        bpr.started_at = bpr.started_at or datetime.now(timezone.utc)
    await append_pharma_audit(
        db, vendor_id=vendor_id, entity_type="pharma_bpr", entity_id=bpr.id,
        action="step_log", actor_id=vu.id, new_value={"seq": data.seq, "status": data.status},
    )
    await db.commit()
    await db.refresh(bpr)
    return JSONResponse(_bpr_dict(bpr))


class BprIpcLog(BaseModel):
    name: str
    value: Optional[str] = None
    passed: bool = True
    notes: Optional[str] = None


@router.post("/bpr/{bpr_id}/ipc")
async def log_bpr_ipc(
    bpr_id: UUID,
    data: BprIpcLog,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    bpr = (
        await db.execute(select(PharmaBpr).where(PharmaBpr.id == bpr_id, PharmaBpr.vendor_id == vendor_id))
    ).scalar_one_or_none()
    if not bpr:
        raise HTTPException(404, "BPR not found")
    results = list(bpr.ipc_results or [])
    now = datetime.now(timezone.utc).isoformat()
    matched = False
    for row in results:
        if isinstance(row, dict) and row.get("name") == data.name:
            row["status"] = "done"
            row["value"] = data.value
            row["pass"] = data.passed
            row["notes"] = data.notes
            row["checked_at"] = now
            row["checked_by"] = str(vu.id)
            matched = True
            break
    if not matched:
        results.append({
            "name": data.name,
            "status": "done",
            "value": data.value,
            "pass": data.passed,
            "notes": data.notes,
            "checked_at": now,
            "checked_by": str(vu.id),
        })
    bpr.ipc_results = results
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(bpr, "ipc_results")
    await db.commit()
    await db.refresh(bpr)
    return JSONResponse(_bpr_dict(bpr))


class BprCompleteRequest(ESignFields):
    actual_qty: float
    notes: Optional[str] = None


@router.post("/bpr/{bpr_id}/complete")
async def complete_bpr(
    bpr_id: UUID,
    data: BprCompleteRequest,
    request: Request,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    bpr = (
        await db.execute(select(PharmaBpr).where(PharmaBpr.id == bpr_id, PharmaBpr.vendor_id == vendor_id))
    ).scalar_one_or_none()
    if not bpr:
        raise HTTPException(404, "BPR not found")
    if bpr.status == "completed":
        raise HTTPException(400, "BPR already completed")
    if not bpr.clearance_done:
        raise HTTPException(400, "Line clearance required before completion")
    pending_ops = [
        s for s in (bpr.operation_log or [])
        if isinstance(s, dict) and s.get("status") not in ("completed", "skipped")
    ]
    if pending_ops:
        raise HTTPException(
            400,
            f"{len(pending_ops)} operation step(s) still pending — complete or skip them first",
        )
    failed_ipc = [
        r for r in (bpr.ipc_results or [])
        if isinstance(r, dict) and r.get("pass") is False
    ]
    if failed_ipc:
        raise HTTPException(400, "Cannot complete BPR with failed IPC checks")

    cfg = await load_pharma_settings(db, vendor_id)
    bpr_ctx = await build_entity_context(
        db, vendor_id, product_id=bpr.product_id,
    )
    bpr_policy = await resolve_approval_policy(
        db, vendor_id=vendor_id, action="bpr_complete", ctx=bpr_ctx, settings=cfg,
    )
    pending_sigs = await load_pending_signatures(
        db, vendor_id=vendor_id, entity_type="pharma_bpr", entity_id=bpr.id,
    )
    esign = await verify_and_record_esign(
        db,
        vendor_id=vendor_id,
        vu=vu,
        entity_type="pharma_bpr",
        entity_id=bpr.id,
        action="complete",
        password=data.password,
        meaning=data.meaning,
        totp_code=data.totp_code,
        dual_sign_required=bpr_policy.dual_sign,
        required_approvers=bpr_policy.required_approvers,
        existing_signatures=pending_sigs,
        ip_address=_client_ip(request),
        extra_new_value={"actual_qty": data.actual_qty, "policy_snapshot": bpr_policy.snapshot},
        settings=cfg,
    )
    if not esign.complete:
        await db.commit()
        await db.refresh(bpr)
        body = _bpr_dict(bpr)
        body["esign"] = {
            "complete": False,
            "message": esign.message,
            "signatures": esign.signatures,
        }
        return JSONResponse(body)

    bpr.actual_qty = Decimal(str(data.actual_qty))
    if bpr.planned_qty and float(bpr.planned_qty) > 0:
        bpr.yield_pct = (Decimal(str(data.actual_qty)) / Decimal(str(bpr.planned_qty))) * Decimal("100")
    if data.notes:
        bpr.notes = ((bpr.notes or "") + "\n" + data.notes).strip()
    bpr.status = "completed"
    bpr.completed_at = datetime.now(timezone.utc)
    product = (
        await db.execute(select(Product).where(Product.id == bpr.product_id))
    ).scalar_one_or_none()
    try:
        await archive_bpr_pdf(
            db,
            vendor_id=vendor_id,
            bpr=bpr,
            product_name=product.name if product else "",
            signatures=esign.signatures,
        )
    except Exception:
        # Archive is best-effort — completion still succeeds
        pass
    await db.commit()
    await db.refresh(bpr)
    body = _bpr_dict(bpr)
    body["esign"] = {
        "complete": True,
        "message": esign.message,
        "signatures": esign.signatures,
    }
    return JSONResponse(body)


# ── Phase 4: QC / release / CoA ───────────────────────────────────────────────

class QcSpecCreate(BaseModel):
    product_id: str
    code: str
    title: str
    items: list = Field(default_factory=list)
    notes: Optional[str] = None


def _qc_spec_dict(
    s: PharmaQcSpec,
    *,
    product_name: Optional[str] = None,
    product_sku: Optional[str] = None,
) -> dict:
    return {
        "id": str(s.id),
        "product_id": str(s.product_id),
        "product_name": product_name,
        "product_sku": product_sku,
        "code": s.code,
        "title": s.title,
        "version": s.version,
        "status": s.status,
        "items": s.items or [],
        "notes": s.notes,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


def _suggest_next_qc_code(codes: list[str]) -> str:
    """Next sequential numeric code from existing specs (e.g. 00042 → 00043)."""
    max_n = 0
    width = 5
    for raw in codes:
        c = (raw or "").strip()
        if c.isdigit():
            max_n = max(max_n, int(c))
            width = max(width, len(c))
    return str(max_n + 1).zfill(width)


@router.get("/qc-specs")
async def list_qc_specs(
    product_id: Optional[str] = None,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(PharmaQcSpec).where(PharmaQcSpec.vendor_id == vendor_id)
    if product_id:
        q = q.where(PharmaQcSpec.product_id == _require_uuid(product_id, "product_id"))
    rows = (await db.execute(q.order_by(PharmaQcSpec.code))).scalars().all()
    # Always suggest from the full vendor code space (not the filtered subset).
    all_codes = (
        await db.execute(select(PharmaQcSpec.code).where(PharmaQcSpec.vendor_id == vendor_id))
    ).scalars().all()
    name_map: dict = {}
    sku_map: dict = {}
    product_ids = {r.product_id for r in rows if r.product_id}
    if product_ids:
        for row in (
            await db.execute(
                select(Product.id, Product.name, Product.sku, Product.material_code).where(
                    Product.id.in_(product_ids)
                )
            )
        ).all():
            name_map[row[0]] = row[1]
            sku_map[row[0]] = row[2] or row[3]
    return JSONResponse({
        "items": [
            _qc_spec_dict(
                r,
                product_name=name_map.get(r.product_id),
                product_sku=sku_map.get(r.product_id),
            )
            for r in rows
        ],
        "suggested_code": _suggest_next_qc_code(list(all_codes)),
    })


@router.post("/qc-specs", status_code=201)
async def create_qc_spec(
    data: QcSpecCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    _perm: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    last = (
        await db.execute(
            select(func.max(PharmaQcSpec.version)).where(
                PharmaQcSpec.vendor_id == vendor_id,
                PharmaQcSpec.code == data.code.strip(),
            )
        )
    ).scalar()
    spec = PharmaQcSpec(
        vendor_id=vendor_id,
        product_id=_require_uuid(data.product_id, "product_id"),
        code=data.code.strip(),
        title=data.title.strip(),
        version=int(last or 0) + 1,
        items=data.items,
        notes=data.notes,
        status="draft",
    )
    db.add(spec)
    await db.commit()
    await db.refresh(spec)
    return JSONResponse(_qc_spec_dict(spec), status_code=201)


class QcSpecUpdate(BaseModel):
    title: Optional[str] = None
    items: Optional[list] = None
    notes: Optional[str] = None


@router.patch("/qc-specs/{spec_id}")
async def update_qc_spec(
    spec_id: UUID,
    data: QcSpecUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    spec = (
        await db.execute(
            select(PharmaQcSpec).where(PharmaQcSpec.id == spec_id, PharmaQcSpec.vendor_id == vendor_id)
        )
    ).scalar_one_or_none()
    if not spec:
        raise HTTPException(404, "QC spec not found")
    if spec.status != "draft":
        raise HTTPException(400, "Only draft QC specs can be edited — create a new version instead")
    if data.title is not None:
        spec.title = data.title.strip()
    if data.items is not None:
        spec.items = data.items
        flag_modified(spec, "items")
    if data.notes is not None:
        spec.notes = data.notes
    await append_pharma_audit(
        db, vendor_id=vendor_id, entity_type="pharma_qc_spec", entity_id=spec.id,
        action="update", actor_id=vu.id,
    )
    await db.commit()
    await db.refresh(spec)
    return JSONResponse(_qc_spec_dict(spec))


class QcSpecApprove(ESignFields):
    pass


@router.post("/qc-specs/{spec_id}/approve")
async def approve_qc_spec(
    spec_id: UUID,
    data: QcSpecApprove = QcSpecApprove(),
    request: Request = None,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    spec = (
        await db.execute(
            select(PharmaQcSpec).where(PharmaQcSpec.id == spec_id, PharmaQcSpec.vendor_id == vendor_id)
        )
    ).scalar_one_or_none()
    if not spec:
        raise HTTPException(404, "QC spec not found")
    if spec.status != "draft":
        raise HTTPException(400, "Only draft QC specs can be approved")
    cfg = await load_pharma_settings(db, vendor_id)
    if cfg.get("esign_required"):
        await verify_and_record_esign(
            db, vendor_id=vendor_id, vu=vu,
            entity_type="pharma_qc_spec", entity_id=spec.id,
            action="approve", password=data.password,
            meaning=data.meaning or "approver",
            totp_code=data.totp_code,
            dual_sign_required=False,
            ip_address=_client_ip(request),
            settings=cfg,
        )
    for p in (
        await db.execute(
            select(PharmaQcSpec).where(
                PharmaQcSpec.vendor_id == vendor_id,
                PharmaQcSpec.code == spec.code,
                PharmaQcSpec.status == "approved",
                PharmaQcSpec.id != spec.id,
            )
        )
    ).scalars().all():
        p.status = "superseded"
    spec.status = "approved"
    await append_pharma_audit(
        db, vendor_id=vendor_id, entity_type="pharma_qc_spec", entity_id=spec.id,
        action="approve", actor_id=vu.id, meaning=data.meaning or "approver",
    )
    await db.commit()
    await db.refresh(spec)
    return JSONResponse(_qc_spec_dict(spec))


class InspectionCreate(BaseModel):
    goods_batch_id: str
    product_id: str
    qc_spec_id: Optional[str] = None
    origin: str = "receipt"
    sample_qty: Optional[float] = None


def _insp_dict(
    i: PharmaInspectionLot,
    *,
    batch_number: Optional[str] = None,
    product_name: Optional[str] = None,
    source_type: Optional[str] = None,
    source_id: Optional[str] = None,
    source_ref: Optional[str] = None,
    supplier_batch_number: Optional[str] = None,
) -> dict:
    origin = i.origin or ""
    # Prefer lot source; fall back to inspection origin for label kind.
    kind = (source_type or "").lower() or (
        "purchase" if origin == "receipt" else "production" if origin == "production" else origin or None
    )
    if kind in ("purchase", "stock_in") and source_ref:
        source_label = f"PO {source_ref}"
    elif kind == "production" and source_ref:
        source_label = f"Production {source_ref}"
    elif kind == "transfer" and source_ref:
        source_label = f"Transfer {source_ref}"
    elif kind:
        source_label = kind.replace("_", " ").title()
    else:
        source_label = None
    return {
        "id": str(i.id),
        "goods_batch_id": str(i.goods_batch_id),
        "batch_number": batch_number,
        "supplier_batch_number": supplier_batch_number,
        "product_id": str(i.product_id),
        "product_name": product_name,
        "qc_spec_id": str(i.qc_spec_id) if i.qc_spec_id else None,
        "origin": i.origin,
        "source_type": source_type or kind,
        "source_id": source_id,
        "source_ref": source_ref,
        "source_label": source_label,
        "status": i.status,
        "sample_qty": float(i.sample_qty) if i.sample_qty is not None else None,
        "results": i.results or [],
        "decision": i.decision,
        "decision_notes": i.decision_notes,
        "decided_at": i.decided_at.isoformat() if i.decided_at else None,
        "coa_number": i.coa_number,
        "coa_data": i.coa_data or {},
        "oos_status": i.oos_status,
        "oos_data": i.oos_data or {},
        "created_at": i.created_at.isoformat() if i.created_at else None,
    }


@router.get("/inspections")
async def list_inspections(
    status_filter: Optional[str] = Query(None, alias="status"),
    goods_batch_id: Optional[str] = None,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(PharmaInspectionLot).where(PharmaInspectionLot.vendor_id == vendor_id)
    if status_filter:
        q = q.where(PharmaInspectionLot.status == status_filter)
    if goods_batch_id:
        q = q.where(PharmaInspectionLot.goods_batch_id == _require_uuid(goods_batch_id, "goods_batch_id"))
    rows = (await db.execute(q.order_by(PharmaInspectionLot.created_at.desc()))).scalars().all()
    batch_ids = {r.goods_batch_id for r in rows}
    product_ids = {r.product_id for r in rows}
    batch_map: dict = {}
    name_map: dict = {}
    po_map: dict = {}
    prod_map: dict = {}
    if batch_ids:
        for b in (await db.execute(select(GoodsBatch).where(GoodsBatch.id.in_(batch_ids)))).scalars().all():
            batch_map[b.id] = b
    if product_ids:
        for row in (await db.execute(select(Product.id, Product.name).where(Product.id.in_(product_ids)))).all():
            name_map[row[0]] = row[1]
    purchase_ids = {
        b.source_id
        for b in batch_map.values()
        if b.source_id and (b.source_type or "").lower() in ("purchase", "stock_in")
    }
    production_ids = {
        b.source_id
        for b in batch_map.values()
        if b.source_id and (b.source_type or "").lower() == "production"
    }
    if purchase_ids:
        for row in (
            await db.execute(
                select(PurchaseOrder.id, PurchaseOrder.po_number).where(PurchaseOrder.id.in_(purchase_ids))
            )
        ).all():
            po_map[row[0]] = row[1]
    if production_ids:
        for row in (
            await db.execute(
                select(ProductionOrder.id, ProductionOrder.ref).where(ProductionOrder.id.in_(production_ids))
            )
        ).all():
            prod_map[row[0]] = row[1]

    items = []
    for r in rows:
        b = batch_map.get(r.goods_batch_id)
        source_type = b.source_type if b else None
        source_id = b.source_id if b else None
        source_ref = None
        if source_id:
            st = (source_type or "").lower()
            if st in ("purchase", "stock_in"):
                source_ref = po_map.get(source_id)
            elif st == "production":
                source_ref = prod_map.get(source_id)
        items.append(
            _insp_dict(
                r,
                batch_number=b.batch_number if b else None,
                product_name=name_map.get(r.product_id),
                source_type=source_type,
                source_id=str(source_id) if source_id else None,
                source_ref=source_ref,
                supplier_batch_number=b.supplier_batch_number if b else None,
            )
        )
    return JSONResponse({"items": items})


@router.post("/inspections", status_code=201)
async def create_inspection(
    data: InspectionCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    _perm: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    batch = (
        await db.execute(
            select(GoodsBatch).where(
                GoodsBatch.id == _require_uuid(data.goods_batch_id, "goods_batch_id"),
                GoodsBatch.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not batch:
        raise HTTPException(404, "Batch not found")
    batch.quality_status = "quality_inspection"
    from app.services.pharma_batch import place_batch_in_quarantine
    await place_batch_in_quarantine(db, vendor_id=vendor_id, batch=batch)
    insp = await ensure_qi_inspection(
        db, vendor_id=vendor_id, batch=batch, origin=data.origin or "receipt"
    )
    if data.qc_spec_id:
        insp.qc_spec_id = _optional_uuid(data.qc_spec_id, "qc_spec_id")
    if data.sample_qty is not None:
        insp.sample_qty = Decimal(str(data.sample_qty))
    if data.origin:
        insp.origin = data.origin
    await db.commit()
    await db.refresh(insp)
    return JSONResponse(_insp_dict(insp, batch_number=batch.batch_number), status_code=201)


class InspectionResults(BaseModel):
    results: list
    status: str = "pending_release"


@router.patch("/inspections/{insp_id}/results")
async def save_inspection_results(
    insp_id: UUID,
    data: InspectionResults,
    vendor_id: UUID = Depends(get_current_vendor_id),
    _perm: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    insp = (
        await db.execute(
            select(PharmaInspectionLot).where(
                PharmaInspectionLot.id == insp_id,
                PharmaInspectionLot.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not insp:
        raise HTTPException(404, "Inspection not found")
    insp.results = data.results
    insp.status = data.status
    await db.commit()
    await db.refresh(insp)
    return JSONResponse(_insp_dict(insp))


class ReleaseDecision(ESignFields):
    decision: str  # release | reject | retest
    notes: Optional[str] = None
    # legacy alias — prefer meaning from ESignFields (author|reviewer|approver)
    # kept for backward compat of non-esign callers when esign disabled


@router.post("/inspections/{insp_id}/decide")
async def decide_inspection(
    insp_id: UUID,
    data: ReleaseDecision,
    request: Request,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.release")),
    db: AsyncSession = Depends(get_db),
):
    if data.decision not in ("release", "reject", "retest"):
        raise HTTPException(400, "decision must be release|reject|retest")
    insp = (
        await db.execute(
            select(PharmaInspectionLot).where(
                PharmaInspectionLot.id == insp_id,
                PharmaInspectionLot.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not insp:
        raise HTTPException(404, "Inspection not found")
    batch = (
        await db.execute(select(GoodsBatch).where(GoodsBatch.id == insp.goods_batch_id))
    ).scalar_one()
    old_status = batch.quality_status

    cfg = await load_pharma_settings(db, vendor_id)
    if data.decision == "release":
        assert_release_qualified(cfg, vu)
    release_ctx = await build_batch_context(db, vendor_id, batch)
    release_policy = await resolve_approval_policy(
        db, vendor_id=vendor_id, action="batch_release", ctx=release_ctx, settings=cfg,
    )
    dual = release_policy.dual_sign and data.decision == "release"
    # Prefer signatures already stored on CoA draft during pending dual-sign
    coa = dict(insp.coa_data or {})
    pending_sigs = list(coa.get("esignatures") or [])
    if not pending_sigs:
        pending_sigs = await load_pending_signatures(
            db, vendor_id=vendor_id, entity_type="pharma_inspection_lot", entity_id=insp.id,
        )

    meaning = data.meaning
    # Map legacy batch_release default if someone still sends it
    if meaning == "batch_release":
        meaning = "approver" if not dual else "reviewer"

    esign = await verify_and_record_esign(
        db,
        vendor_id=vendor_id,
        vu=vu,
        entity_type="pharma_inspection_lot",
        entity_id=insp.id,
        action=f"decide_{data.decision}",
        password=data.password,
        meaning=meaning,
        totp_code=data.totp_code,
        dual_sign_required=dual,
        required_approvers=release_policy.required_approvers if dual else 1,
        existing_signatures=pending_sigs,
        ip_address=_client_ip(request),
        extra_new_value={"decision": data.decision, "policy_snapshot": release_policy.snapshot},
        settings=cfg,
    )
    coa["esignatures"] = esign.signatures
    insp.coa_data = coa
    flag_modified(insp, "coa_data")

    if not esign.complete:
        await db.commit()
        await db.refresh(insp)
        body = _insp_dict(insp)
        body["esign"] = {
            "complete": False,
            "message": esign.message,
            "signatures": esign.signatures,
        }
        return JSONResponse(body)

    if data.decision == "release":
        if insp.status not in ("pending_release", "testing", "open"):
            raise HTTPException(400, f"Cannot release inspection in status {insp.status}")
        if cfg.get("bpr_required_before_release") and batch.source_type == "production":
            bpr_ok = (
                await db.execute(
                    select(func.count()).select_from(PharmaBpr).where(
                        PharmaBpr.vendor_id == vendor_id,
                        PharmaBpr.goods_batch_id == batch.id,
                        PharmaBpr.status == "completed",
                    )
                )
            ).scalar() or 0
            if not bpr_ok:
                raise HTTPException(
                    400,
                    "Completed BPR required before release (pharma.bpr_required_before_release)",
                )
        batch.quality_status = "unrestricted"
        insp.status = "released"
        insp.coa_number = insp.coa_number or f"COA-{batch.batch_number}"
        coa.update({
            "batch_number": batch.batch_number,
            "product_id": str(batch.product_id),
            "results": insp.results or [],
            "released_at": datetime.now(timezone.utc).isoformat(),
            "released_by": str(vu.id),
            "esignatures": esign.signatures,
        })
        insp.coa_data = coa
        flag_modified(insp, "coa_data")
        await release_batch_from_quarantine(db, vendor_id=vendor_id, batch=batch, to_rejected=False)
        product = (
            await db.execute(select(Product).where(Product.id == insp.product_id))
        ).scalar_one_or_none()
        try:
            await archive_coa_pdf(
                db,
                vendor_id=vendor_id,
                insp=insp,
                batch=batch,
                product_name=product.name if product else "",
            )
        except Exception:
            pass
    elif data.decision == "reject":
        batch.quality_status = "blocked"
        insp.status = "rejected"
        await release_batch_from_quarantine(db, vendor_id=vendor_id, batch=batch, to_rejected=True)
    else:
        insp.status = "testing"
        batch.quality_status = "quality_inspection"
    insp.decision = data.decision
    insp.decision_notes = data.notes
    insp.decided_by = vu.id
    insp.decided_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(insp)
    body = _insp_dict(insp)
    body["esign"] = {
        "complete": True,
        "message": esign.message,
        "signatures": esign.signatures,
        "old_batch_status": old_status,
    }
    return JSONResponse(body)


@router.get("/coa/{insp_id}")
async def get_coa(
    insp_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    insp = (
        await db.execute(
            select(PharmaInspectionLot).where(
                PharmaInspectionLot.id == insp_id,
                PharmaInspectionLot.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not insp:
        raise HTTPException(404, "Inspection not found")
    if insp.status != "released":
        raise HTTPException(400, "CoA available only after release")
    batch = (
        await db.execute(select(GoodsBatch).where(GoodsBatch.id == insp.goods_batch_id))
    ).scalar_one_or_none()
    return JSONResponse({
        "coa_number": insp.coa_number,
        "inspection": _insp_dict(insp),
        "batch": _batch_dict(batch) if batch else None,
        "coa_data": insp.coa_data or {},
    })


def _escape_html(value: Any) -> str:
    s = "" if value is None else str(value)
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


@router.get("/coa/{insp_id}/print", response_class=HTMLResponse)
async def print_coa(
    insp_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Printable Certificate of Analysis (HTML suitable for browser print / PDF)."""
    insp = (
        await db.execute(
            select(PharmaInspectionLot).where(
                PharmaInspectionLot.id == insp_id,
                PharmaInspectionLot.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not insp:
        raise HTTPException(404, "Inspection not found")
    if insp.status != "released":
        raise HTTPException(400, "CoA available only after release")
    batch = (
        await db.execute(select(GoodsBatch).where(GoodsBatch.id == insp.goods_batch_id))
    ).scalar_one_or_none()
    product = (
        await db.execute(select(Product).where(Product.id == insp.product_id))
    ).scalar_one_or_none()

    rows_html = ""
    for r in insp.results or []:
        if not isinstance(r, dict):
            continue
        rows_html += (
            f"<tr><td>{_escape_html(r.get('name'))}</td>"
            f"<td>{_escape_html(r.get('value'))}</td>"
            f"<td>{_escape_html(r.get('uom') or '')}</td>"
            f"<td>{'Pass' if r.get('pass') else 'Fail'}</td></tr>"
        )
    if not rows_html:
        rows_html = "<tr><td colspan='4'>No results recorded</td></tr>"

    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>CoA {_escape_html(insp.coa_number)}</title>
<style>
  body {{ font-family: Georgia, 'Times New Roman', serif; margin: 40px; color: #111; }}
  h1 {{ font-size: 22px; margin: 0 0 4px; }}
  .sub {{ color: #555; margin-bottom: 24px; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 16px; }}
  th, td {{ border: 1px solid #333; padding: 8px; text-align: left; font-size: 13px; }}
  th {{ background: #f3f3f3; }}
  .meta {{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 13px; }}
  .sign {{ margin-top: 48px; display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }}
  .line {{ border-top: 1px solid #333; margin-top: 40px; padding-top: 6px; font-size: 12px; }}
  @media print {{ body {{ margin: 16px; }} }}
</style></head><body>
  <h1>Certificate of Analysis</h1>
  <div class="sub">{_escape_html(insp.coa_number)}</div>
  <div class="meta">
    <div><strong>Product</strong><br/>{_escape_html(product.name if product else insp.product_id)}</div>
    <div><strong>Batch</strong><br/>{_escape_html(batch.batch_number if batch else '')}</div>
    <div><strong>Manufactured</strong><br/>{_escape_html(batch.manufacturing_date if batch and batch.manufacturing_date else '—')}</div>
    <div><strong>Expiry</strong><br/>{_escape_html(batch.expiry_date if batch and batch.expiry_date else '—')}</div>
    <div><strong>Released</strong><br/>{_escape_html((insp.coa_data or {}).get('released_at') or insp.decided_at or '')}</div>
    <div><strong>Origin</strong><br/>{_escape_html(insp.origin)}</div>
  </div>
  <table>
    <thead><tr><th>Test</th><th>Result</th><th>UOM</th><th>Disposition</th></tr></thead>
    <tbody>{rows_html}</tbody>
  </table>
  <p style="margin-top:16px;font-size:13px"><strong>Decision notes:</strong> {_escape_html(insp.decision_notes or '—')}</p>
  <div class="sign">
    <div class="line">Analyst / QC</div>
    <div class="line">Authorized releaser</div>
  </div>
  <script>window.onload = function() {{ /* ready for print */ }};</script>
</body></html>"""
    return HTMLResponse(content=html)


@router.get("/coa/{insp_id}/pdf")
async def download_coa_pdf(
    insp_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Download archived CoA PDF (generates on demand if archive missing)."""
    from app.utils.pharma_pdf import generate_coa_pdf

    insp = (
        await db.execute(
            select(PharmaInspectionLot).where(
                PharmaInspectionLot.id == insp_id,
                PharmaInspectionLot.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not insp:
        raise HTTPException(404, "Inspection not found")
    if insp.status != "released":
        raise HTTPException(400, "CoA PDF available only after release")

    coa = dict(insp.coa_data or {})
    batch = (
        await db.execute(select(GoodsBatch).where(GoodsBatch.id == insp.goods_batch_id))
    ).scalar_one_or_none()
    product = (
        await db.execute(select(Product).where(Product.id == insp.product_id))
    ).scalar_one_or_none()

    if not coa.get("pdf_url"):
        try:
            await archive_coa_pdf(
                db,
                vendor_id=vendor_id,
                insp=insp,
                batch=batch,
                product_name=product.name if product else "",
            )
            await db.commit()
            await db.refresh(insp)
            coa = dict(insp.coa_data or {})
        except Exception:
            pass

    pdf_bytes = generate_coa_pdf(
        coa_number=insp.coa_number or "",
        product_name=product.name if product else str(insp.product_id),
        batch_number=batch.batch_number if batch else "",
        manufacturing_date=batch.manufacturing_date if batch else None,
        expiry_date=batch.expiry_date if batch else None,
        released_at=coa.get("released_at") or insp.decided_at,
        origin=insp.origin or "",
        results=insp.results or [],
        decision_notes=insp.decision_notes or "",
        signatures=coa.get("esignatures") or [],
    )
    filename = f"{(insp.coa_number or 'coa').replace('/', '-')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/bpr/{bpr_id}/pdf")
async def download_bpr_pdf(
    bpr_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    from app.utils.pharma_pdf import generate_bpr_pdf

    bpr = (
        await db.execute(
            select(PharmaBpr).where(PharmaBpr.id == bpr_id, PharmaBpr.vendor_id == vendor_id)
        )
    ).scalar_one_or_none()
    if not bpr:
        raise HTTPException(404, "BPR not found")
    if bpr.status not in ("completed", "closed"):
        raise HTTPException(400, "BPR PDF available after completion")

    product = (
        await db.execute(select(Product).where(Product.id == bpr.product_id))
    ).scalar_one_or_none()

    if not getattr(bpr, "pdf_url", None):
        try:
            await archive_bpr_pdf(
                db,
                vendor_id=vendor_id,
                bpr=bpr,
                product_name=product.name if product else "",
            )
            await db.commit()
            await db.refresh(bpr)
        except Exception:
            pass

    pdf_bytes = generate_bpr_pdf(
        batch_number=bpr.batch_number,
        product_name=product.name if product else str(bpr.product_id),
        status=bpr.status,
        planned_qty=float(bpr.planned_qty) if bpr.planned_qty is not None else None,
        actual_qty=float(bpr.actual_qty) if bpr.actual_qty is not None else None,
        yield_pct=float(bpr.yield_pct) if bpr.yield_pct is not None else None,
        clearance_done=bool(bpr.clearance_done),
        operation_log=bpr.operation_log or [],
        ipc_results=bpr.ipc_results or [],
        notes=bpr.notes or "",
        completed_at=bpr.completed_at,
    )
    filename = f"BPR-{bpr.batch_number.replace('/', '-')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/batches/{batch_id}/retest", status_code=201)
async def open_batch_retest(
    batch_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Open a retest QI inspection from a retest-due alert (Stage A)."""
    try:
        insp = await open_retest_inspection(db, vendor_id=vendor_id, batch_id=batch_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
    await append_pharma_audit(
        db,
        vendor_id=vendor_id,
        entity_type="pharma_inspection_lot",
        entity_id=insp.id,
        action="retest_opened",
        actor_id=vu.id,
        meaning="author",
        new_value={"goods_batch_id": str(batch_id), "origin": "retest"},
    )
    await db.commit()
    await db.refresh(insp)
    return JSONResponse(_insp_dict(insp), status_code=201)


# ── Phase 5: genealogy + recall ───────────────────────────────────────────────

@router.get("/genealogy/{batch_id}")
async def genealogy(
    batch_id: UUID,
    direction: str = Query("both"),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        tree = await build_genealogy(db, vendor_id, batch_id, direction=direction)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return JSONResponse(tree)


class RecallCreate(BaseModel):
    goods_batch_id: str
    reason: str
    severity: str = "class_ii"
    recall_number: Optional[str] = None


def _recall_dict(r: PharmaRecall) -> dict:
    return {
        "id": str(r.id),
        "goods_batch_id": str(r.goods_batch_id),
        "recall_number": r.recall_number,
        "reason": r.reason,
        "severity": r.severity,
        "status": r.status,
        "affected_summary": r.affected_summary or {},
        "actions": r.actions or [],
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "closed_at": r.closed_at.isoformat() if r.closed_at else None,
    }


@router.get("/recalls")
async def list_recalls(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(PharmaRecall).where(PharmaRecall.vendor_id == vendor_id)
            .order_by(PharmaRecall.created_at.desc())
        )
    ).scalars().all()
    return JSONResponse({"items": [_recall_dict(r) for r in rows]})


@router.post("/recalls", status_code=201)
async def create_recall(
    data: RecallCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    batch = (
        await db.execute(
            select(GoodsBatch).where(
                GoodsBatch.id == _require_uuid(data.goods_batch_id, "goods_batch_id"),
                GoodsBatch.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not batch:
        raise HTTPException(404, "Batch not found")
    batch.quality_status = "blocked"
    number = data.recall_number or f"RCL-{date.today().strftime('%Y%m%d')}-{batch.batch_number}"
    tree = await build_genealogy(db, vendor_id, batch.id, direction="forward")
    recall = PharmaRecall(
        vendor_id=vendor_id,
        goods_batch_id=batch.id,
        recall_number=number,
        reason=data.reason,
        severity=data.severity,
        status="open",
        affected_summary={"genealogy": tree, "qty_on_hand": float(batch.quantity_available or 0)},
        created_by=vu.id,
    )
    db.add(recall)
    await db.flush()
    await append_pharma_audit(
        db, vendor_id=vendor_id, entity_type="pharma_recall", entity_id=recall.id,
        action="create", actor_id=vu.id, meaning="recall_initiated",
    )
    await db.commit()
    await db.refresh(recall)
    return JSONResponse(_recall_dict(recall), status_code=201)


class RecallUpdate(BaseModel):
    status: Optional[str] = None
    action: Optional[str] = None  # append to actions log
    notes: Optional[str] = None


@router.patch("/recalls/{recall_id}")
async def update_recall(
    recall_id: UUID,
    data: RecallUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    recall = (
        await db.execute(
            select(PharmaRecall).where(PharmaRecall.id == recall_id, PharmaRecall.vendor_id == vendor_id)
        )
    ).scalar_one_or_none()
    if not recall:
        raise HTTPException(404, "Recall not found")
    allowed = {"open", "investigating", "notified", "closed"}
    if data.status:
        if data.status not in allowed:
            raise HTTPException(400, f"status must be one of {sorted(allowed)}")
        recall.status = data.status
        if data.status == "closed":
            recall.closed_at = datetime.now(timezone.utc)
    if data.action:
        actions = list(recall.actions or [])
        actions.append({
            "at": datetime.now(timezone.utc).isoformat(),
            "by": str(vu.id),
            "action": data.action,
            "notes": data.notes,
        })
        recall.actions = actions
    await append_pharma_audit(
        db, vendor_id=vendor_id, entity_type="pharma_recall", entity_id=recall.id,
        action="update", actor_id=vu.id, new_value={"status": recall.status},
    )
    await db.commit()
    await db.refresh(recall)
    return JSONResponse(_recall_dict(recall))


# ── Stage B: recall CSV export ────────────────────────────────────────────────

@router.get("/recalls/{recall_id}/export")
async def export_recall_csv(
    recall_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Download a recall impact report as CSV."""
    recall = (
        await db.execute(
            select(PharmaRecall).where(PharmaRecall.id == recall_id, PharmaRecall.vendor_id == vendor_id)
        )
    ).scalar_one_or_none()
    if not recall:
        raise HTTPException(404, "Recall not found")

    batch = (
        await db.execute(
            select(GoodsBatch).where(GoodsBatch.id == recall.goods_batch_id)
        )
    ).scalar_one_or_none()

    buf = io.StringIO()
    writer = csv.writer(buf)

    # Header section
    writer.writerow(["RECALL IMPACT REPORT"])
    writer.writerow(["Generated", datetime.now(timezone.utc).isoformat()])
    writer.writerow([])
    writer.writerow(["Recall Number", recall.recall_number])
    writer.writerow(["Severity", recall.severity])
    writer.writerow(["Status", recall.status])
    writer.writerow(["Reason", recall.reason])
    writer.writerow(["Batch Number", batch.batch_number if batch else ""])
    writer.writerow(["Expiry Date", batch.expiry_date.isoformat() if batch and batch.expiry_date else ""])
    writer.writerow(["Qty Available", float(batch.quantity_available or 0) if batch else ""])
    writer.writerow(["Initiated", recall.created_at.isoformat() if recall.created_at else ""])
    writer.writerow(["Closed", recall.closed_at.isoformat() if recall.closed_at else ""])
    writer.writerow([])

    # Affected summary
    writer.writerow(["AFFECTED SUMMARY"])
    summary = recall.affected_summary or {}
    for k, v in summary.items():
        writer.writerow([k, v])
    writer.writerow([])

    # Actions log
    writer.writerow(["ACTIONS LOG"])
    writer.writerow(["Timestamp", "Actor", "Action", "Notes"])
    for act in (recall.actions or []):
        writer.writerow([
            act.get("at", ""),
            act.get("by", ""),
            act.get("action", ""),
            act.get("notes", ""),
        ])

    content = buf.getvalue()
    filename = f"recall_{recall.recall_number.replace('/', '-')}.csv"
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/recalls/{recall_id}/export/pdf")
async def export_recall_pdf(
    recall_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Download a recall impact report as PDF."""
    from app.utils.pharma_pdf import generate_recall_pdf

    recall = (
        await db.execute(
            select(PharmaRecall).where(PharmaRecall.id == recall_id, PharmaRecall.vendor_id == vendor_id)
        )
    ).scalar_one_or_none()
    if not recall:
        raise HTTPException(404, "Recall not found")

    batch = (
        await db.execute(
            select(GoodsBatch).where(GoodsBatch.id == recall.goods_batch_id)
        )
    ).scalar_one_or_none()

    product_name = ""
    if batch and getattr(batch, "product_id", None):
        from app.models.vendor_product import Product as VendorProduct
        prod = await db.get(VendorProduct, batch.product_id)
        product_name = getattr(prod, "name", "") or ""

    pdf_bytes = generate_recall_pdf(
        recall_number=recall.recall_number,
        product_name=product_name,
        batch_number=batch.batch_number if batch else "",
        severity=recall.severity or "",
        status=recall.status or "",
        reason=recall.reason or "",
        created_at=recall.created_at,
        closed_at=recall.closed_at,
        affected_summary=recall.affected_summary or {},
        actions=recall.actions or [],
    )
    filename = f"recall_{recall.recall_number.replace('/', '-')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Stage B: OOS investigation ────────────────────────────────────────────────

class OosOpen(BaseModel):
    notes: Optional[str] = None
    assignee: Optional[str] = None


class OosClose(BaseModel):
    root_cause: str
    disposition: str  # rework | reject | release_conditional | recall
    notes: Optional[str] = None


@router.post("/inspections/{insp_id}/oos", status_code=201)
async def open_oos_investigation(
    insp_id: UUID,
    data: OosOpen = OosOpen(),
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Open an Out-of-Specification investigation for a rejected inspection lot."""
    insp = (
        await db.execute(
            select(PharmaInspectionLot).where(
                PharmaInspectionLot.id == insp_id,
                PharmaInspectionLot.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not insp:
        raise HTTPException(404, "Inspection not found")
    if insp.oos_status == "open":
        raise HTTPException(400, "OOS investigation already open")
    insp.oos_status = "open"
    insp.oos_data = {
        "opened_at": datetime.now(timezone.utc).isoformat(),
        "opened_by": str(vu.id),
        "notes": data.notes or "",
        "assignee": data.assignee or "",
        "root_cause": None,
        "disposition": None,
        "closed_at": None,
    }
    await append_pharma_audit(
        db, vendor_id=vendor_id, entity_type="pharma_inspection_lot",
        entity_id=insp.id, action="oos_opened", actor_id=vu.id,
        new_value={"oos_status": "open"},
    )
    await db.commit()
    await db.refresh(insp)
    return JSONResponse(_insp_dict(insp), status_code=201)


@router.patch("/inspections/{insp_id}/oos")
async def close_oos_investigation(
    insp_id: UUID,
    data: OosClose,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Close/resolve an OOS investigation with root cause and disposition."""
    allowed_disp = {"rework", "reject", "release_conditional", "recall"}
    if data.disposition not in allowed_disp:
        raise HTTPException(400, f"disposition must be one of {sorted(allowed_disp)}")
    insp = (
        await db.execute(
            select(PharmaInspectionLot).where(
                PharmaInspectionLot.id == insp_id,
                PharmaInspectionLot.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not insp:
        raise HTTPException(404, "Inspection not found")
    if insp.oos_status != "open":
        raise HTTPException(400, "No open OOS investigation on this lot")
    insp.oos_status = "closed"
    oos = dict(insp.oos_data or {})
    oos.update({
        "root_cause": data.root_cause,
        "disposition": data.disposition,
        "notes": data.notes or oos.get("notes", ""),
        "closed_at": datetime.now(timezone.utc).isoformat(),
        "closed_by": str(vu.id),
    })
    insp.oos_data = oos
    await append_pharma_audit(
        db, vendor_id=vendor_id, entity_type="pharma_inspection_lot",
        entity_id=insp.id, action="oos_closed", actor_id=vu.id,
        new_value={"disposition": data.disposition},
    )
    await db.commit()
    await db.refresh(insp)
    return JSONResponse(_insp_dict(insp))


# ── Stage B: complaint intake ─────────────────────────────────────────────────

def _complaint_dict(c: PharmaComplaint) -> dict:
    return {
        "id": str(c.id),
        "number": c.number,
        "complaint_type": c.complaint_type,
        "severity": c.severity,
        "title": c.title,
        "description": c.description,
        "goods_batch_id": str(c.goods_batch_id) if c.goods_batch_id else None,
        "customer_id": str(c.customer_id) if c.customer_id else None,
        "reported_by": c.reported_by,
        "status": c.status,
        "investigation_notes": c.investigation_notes,
        "disposition": c.disposition,
        "closed_at": c.closed_at.isoformat() if c.closed_at else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


class ComplaintCreate(BaseModel):
    complaint_type: str = "customer"  # customer | adverse_event | product_defect | packaging
    severity: str = "minor"           # minor | major | critical
    title: str
    description: Optional[str] = None
    goods_batch_id: Optional[str] = None
    customer_id: Optional[str] = None
    reported_by: Optional[str] = None


class ComplaintUpdate(BaseModel):
    status: Optional[str] = None      # open | investigating | closed
    investigation_notes: Optional[str] = None
    disposition: Optional[str] = None
    severity: Optional[str] = None


@router.get("/complaints")
async def list_complaints(
    status_filter: Optional[str] = Query(None, alias="status"),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(PharmaComplaint).where(PharmaComplaint.vendor_id == vendor_id)
    if status_filter:
        q = q.where(PharmaComplaint.status == status_filter)
    rows = (await db.execute(q.order_by(PharmaComplaint.created_at.desc()))).scalars().all()
    return JSONResponse({"items": [_complaint_dict(c) for c in rows]})


@router.post("/complaints", status_code=201)
async def create_complaint(
    data: ComplaintCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    allowed_types = {"customer", "adverse_event", "product_defect", "packaging"}
    if data.complaint_type not in allowed_types:
        raise HTTPException(400, f"complaint_type must be one of {sorted(allowed_types)}")
    allowed_sev = {"minor", "major", "critical"}
    if data.severity not in allowed_sev:
        raise HTTPException(400, f"severity must be one of {sorted(allowed_sev)}")

    # Auto-number: COMP-YYYYNNNNN
    year = datetime.now(timezone.utc).year
    prefix = f"COMP-{year}"
    count_q = select(func.count()).select_from(PharmaComplaint).where(
        PharmaComplaint.vendor_id == vendor_id,
        PharmaComplaint.number.like(f"{prefix}%"),
    )
    n = int((await db.execute(count_q)).scalar() or 0) + 1
    number = f"{prefix}{n:04d}"

    customer_uuid = None
    if data.customer_id:
        from app.models.customer import Customer
        customer_uuid = _require_uuid(data.customer_id, "customer_id")
        cust = (
            await db.execute(
                select(Customer).where(Customer.id == customer_uuid, Customer.vendor_id == vendor_id)
            )
        ).scalar_one_or_none()
        if not cust:
            raise HTTPException(404, "Customer not found")

    complaint = PharmaComplaint(
        vendor_id=vendor_id,
        number=number,
        complaint_type=data.complaint_type,
        severity=data.severity,
        title=data.title,
        description=data.description,
        goods_batch_id=_require_uuid(data.goods_batch_id, "goods_batch_id") if data.goods_batch_id else None,
        customer_id=customer_uuid,
        reported_by=data.reported_by,
        created_by=vu.id,
    )
    db.add(complaint)
    await db.flush()  # assign complaint.id before audit (entity_id is NOT NULL)
    await append_pharma_audit(
        db, vendor_id=vendor_id, entity_type="pharma_complaint", entity_id=complaint.id,
        action="create", actor_id=vu.id,
        new_value={
            "number": number,
            "title": data.title,
            "customer_id": str(customer_uuid) if customer_uuid else None,
        },
    )
    await db.commit()
    await db.refresh(complaint)
    return JSONResponse(_complaint_dict(complaint), status_code=201)


@router.patch("/complaints/{complaint_id}")
async def update_complaint(
    complaint_id: UUID,
    data: ComplaintUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    complaint = (
        await db.execute(
            select(PharmaComplaint).where(
                PharmaComplaint.id == complaint_id,
                PharmaComplaint.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not complaint:
        raise HTTPException(404, "Complaint not found")
    if complaint.status == "closed":
        raise HTTPException(400, "Complaint is already closed")
    allowed_statuses = {"open", "investigating", "closed"}
    if data.status:
        if data.status not in allowed_statuses:
            raise HTTPException(400, f"status must be one of {sorted(allowed_statuses)}")
        complaint.status = data.status
        if data.status == "closed":
            complaint.closed_at = datetime.now(timezone.utc)
    if data.severity is not None:
        complaint.severity = data.severity
    if data.investigation_notes is not None:
        complaint.investigation_notes = data.investigation_notes
    if data.disposition is not None:
        complaint.disposition = data.disposition
    await append_pharma_audit(
        db, vendor_id=vendor_id, entity_type="pharma_complaint", entity_id=complaint.id,
        action="update", actor_id=vu.id, new_value={"status": complaint.status},
    )
    await db.commit()
    await db.refresh(complaint)
    return JSONResponse(_complaint_dict(complaint))


# ── Phase 6: QMS ──────────────────────────────────────────────────────────────

class DeviationCreate(BaseModel):
    title: str
    description: Optional[str] = None
    severity: str = "minor"
    goods_batch_id: Optional[str] = None
    bpr_id: Optional[str] = None
    production_order_id: Optional[str] = None
    number: Optional[str] = None


def _dev_dict(d: PharmaDeviation) -> dict:
    return {
        "id": str(d.id),
        "number": d.number,
        "title": d.title,
        "description": d.description,
        "status": d.status,
        "severity": d.severity,
        "goods_batch_id": str(d.goods_batch_id) if d.goods_batch_id else None,
        "bpr_id": str(d.bpr_id) if d.bpr_id else None,
        "production_order_id": str(d.production_order_id) if d.production_order_id else None,
        "linked_capa_id": str(d.linked_capa_id) if d.linked_capa_id else None,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }


@router.get("/deviations")
async def list_deviations(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(PharmaDeviation).where(PharmaDeviation.vendor_id == vendor_id)
            .order_by(PharmaDeviation.created_at.desc())
        )
    ).scalars().all()
    return JSONResponse({"items": [_dev_dict(r) for r in rows]})


@router.post("/deviations", status_code=201)
async def create_deviation(
    data: DeviationCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    count = int(
        (await db.execute(
            select(func.count()).select_from(PharmaDeviation).where(PharmaDeviation.vendor_id == vendor_id)
        )).scalar() or 0
    ) + 1
    d = PharmaDeviation(
        vendor_id=vendor_id,
        number=data.number or f"DEV-{count:05d}",
        title=data.title.strip(),
        description=data.description,
        severity=data.severity,
        goods_batch_id=_optional_uuid(data.goods_batch_id, "goods_batch_id"),
        bpr_id=_optional_uuid(data.bpr_id, "bpr_id"),
        production_order_id=_optional_uuid(data.production_order_id, "production_order_id"),
        created_by=vu.id,
    )
    db.add(d)
    await db.commit()
    await db.refresh(d)
    return JSONResponse(_dev_dict(d), status_code=201)


class DeviationUpdate(BaseModel):
    status: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    title: Optional[str] = None


@router.patch("/deviations/{deviation_id}")
async def update_deviation(
    deviation_id: UUID,
    data: DeviationUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    d = (
        await db.execute(
            select(PharmaDeviation).where(
                PharmaDeviation.id == deviation_id, PharmaDeviation.vendor_id == vendor_id
            )
        )
    ).scalar_one_or_none()
    if not d:
        raise HTTPException(404, "Deviation not found")
    allowed = {"open", "investigating", "closed", "cancelled"}
    if data.status:
        if data.status not in allowed:
            raise HTTPException(400, f"status must be one of {sorted(allowed)}")
        if data.status == "closed" and not d.linked_capa_id:
            # Allow close without CAPA for minor, but warn via requiring explicit status only
            pass
        d.status = data.status
    if data.description is not None:
        d.description = data.description
    if data.severity is not None:
        d.severity = data.severity
    if data.title is not None:
        d.title = data.title.strip()
    await append_pharma_audit(
        db, vendor_id=vendor_id, entity_type="pharma_deviation", entity_id=d.id,
        action="update", actor_id=vu.id, new_value={"status": d.status},
    )
    await db.commit()
    await db.refresh(d)
    return JSONResponse(_dev_dict(d))


class CapaCreate(BaseModel):
    title: str
    root_cause: Optional[str] = None
    corrective_actions: list = Field(default_factory=list)
    preventive_actions: list = Field(default_factory=list)
    deviation_id: Optional[str] = None
    due_date: Optional[str] = None
    number: Optional[str] = None


def _capa_dict(c: PharmaCapa) -> dict:
    return {
        "id": str(c.id),
        "number": c.number,
        "title": c.title,
        "root_cause": c.root_cause,
        "corrective_actions": c.corrective_actions or [],
        "preventive_actions": c.preventive_actions or [],
        "status": c.status,
        "due_date": c.due_date.isoformat() if c.due_date else None,
        "deviation_id": str(c.deviation_id) if c.deviation_id else None,
        "effectiveness_check": c.effectiveness_check,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.get("/capas")
async def list_capas(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(PharmaCapa).where(PharmaCapa.vendor_id == vendor_id)
            .order_by(PharmaCapa.created_at.desc())
        )
    ).scalars().all()
    return JSONResponse({"items": [_capa_dict(r) for r in rows]})


@router.post("/capas", status_code=201)
async def create_capa(
    data: CapaCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    count = int(
        (await db.execute(
            select(func.count()).select_from(PharmaCapa).where(PharmaCapa.vendor_id == vendor_id)
        )).scalar() or 0
    ) + 1
    c = PharmaCapa(
        vendor_id=vendor_id,
        number=data.number or f"CAPA-{count:05d}",
        title=data.title.strip(),
        root_cause=data.root_cause,
        corrective_actions=data.corrective_actions,
        preventive_actions=data.preventive_actions,
        deviation_id=_optional_uuid(data.deviation_id, "deviation_id"),
        due_date=date.fromisoformat(data.due_date) if data.due_date else None,
        created_by=vu.id,
    )
    db.add(c)
    await db.flush()
    if c.deviation_id:
        dev = (
            await db.execute(
                select(PharmaDeviation).where(
                    PharmaDeviation.id == c.deviation_id,
                    PharmaDeviation.vendor_id == vendor_id,
                )
            )
        ).scalar_one_or_none()
        if dev:
            dev.linked_capa_id = c.id
    await db.commit()
    await db.refresh(c)
    return JSONResponse(_capa_dict(c), status_code=201)


class CapaUpdate(ESignFields):
    status: Optional[str] = None
    root_cause: Optional[str] = None
    corrective_actions: Optional[list] = None
    preventive_actions: Optional[list] = None
    effectiveness_check: Optional[str] = None
    due_date: Optional[str] = None


@router.patch("/capas/{capa_id}")
async def update_capa(
    capa_id: UUID,
    data: CapaUpdate,
    request: Request,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    c = (
        await db.execute(
            select(PharmaCapa).where(PharmaCapa.id == capa_id, PharmaCapa.vendor_id == vendor_id)
        )
    ).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "CAPA not found")
    allowed = {"open", "in_progress", "effectiveness_check", "closed", "cancelled"}
    closing = data.status == "closed"
    if data.status:
        if data.status not in allowed:
            raise HTTPException(400, f"status must be one of {sorted(allowed)}")
        if closing:
            if not (data.effectiveness_check or c.effectiveness_check):
                raise HTTPException(400, "effectiveness_check required to close CAPA")

    cfg = await load_pharma_settings(db, vendor_id)
    esign_ctx = None
    if closing:
        pending_sigs = await load_pending_signatures(
            db, vendor_id=vendor_id, entity_type="pharma_capa", entity_id=c.id,
        )
        capa_policy = await resolve_approval_policy(
            db, vendor_id=vendor_id, action="capa_close", ctx={}, settings=cfg,
        )
        esign_ctx = await verify_and_record_esign(
            db,
            vendor_id=vendor_id,
            vu=vu,
            entity_type="pharma_capa",
            entity_id=c.id,
            action="close",
            password=data.password,
            meaning=data.meaning,
            totp_code=data.totp_code,
            dual_sign_required=capa_policy.dual_sign,
            required_approvers=capa_policy.required_approvers,
            existing_signatures=pending_sigs,
            ip_address=_client_ip(request),
            extra_new_value={"policy_snapshot": capa_policy.snapshot},
            settings=cfg,
        )
        if not esign_ctx.complete:
            await db.commit()
            body = _capa_dict(c)
            body["esign"] = {
                "complete": False,
                "message": esign_ctx.message,
                "signatures": esign_ctx.signatures,
            }
            return JSONResponse(body)

    if data.status:
        if closing:
            c.closed_at = datetime.now(timezone.utc)
            if c.deviation_id:
                dev = (
                    await db.execute(
                        select(PharmaDeviation).where(
                            PharmaDeviation.id == c.deviation_id,
                            PharmaDeviation.vendor_id == vendor_id,
                        )
                    )
                ).scalar_one_or_none()
                if dev and dev.status != "closed":
                    dev.status = "closed"
        c.status = data.status
    if data.root_cause is not None:
        c.root_cause = data.root_cause
    if data.corrective_actions is not None:
        c.corrective_actions = data.corrective_actions
    if data.preventive_actions is not None:
        c.preventive_actions = data.preventive_actions
    if data.effectiveness_check is not None:
        c.effectiveness_check = data.effectiveness_check
    if data.due_date is not None:
        c.due_date = date.fromisoformat(data.due_date) if data.due_date else None
    if not closing:
        await append_pharma_audit(
            db, vendor_id=vendor_id, entity_type="pharma_capa", entity_id=c.id,
            action="update", actor_id=vu.id, new_value={"status": c.status},
        )
    await db.commit()
    await db.refresh(c)
    body = _capa_dict(c)
    if esign_ctx:
        body["esign"] = {
            "complete": True,
            "message": esign_ctx.message,
            "signatures": esign_ctx.signatures,
        }
    return JSONResponse(body)


class ChangeControlCreate(BaseModel):
    title: str
    change_type: str = "other"
    description: Optional[str] = None
    impact_assessment: Optional[str] = None
    target_ref: dict = Field(default_factory=dict)
    number: Optional[str] = None


def _cc_dict(c: PharmaChangeControl) -> dict:
    return {
        "id": str(c.id),
        "number": c.number,
        "title": c.title,
        "change_type": c.change_type,
        "description": c.description,
        "status": c.status,
        "impact_assessment": c.impact_assessment,
        "target_ref": c.target_ref or {},
        "approvals": c.approvals or [],
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.get("/change-controls")
async def list_change_controls(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(PharmaChangeControl).where(PharmaChangeControl.vendor_id == vendor_id)
            .order_by(PharmaChangeControl.created_at.desc())
        )
    ).scalars().all()
    return JSONResponse({"items": [_cc_dict(r) for r in rows]})


@router.post("/change-controls", status_code=201)
async def create_change_control(
    data: ChangeControlCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    count = int(
        (await db.execute(
            select(func.count()).select_from(PharmaChangeControl).where(
                PharmaChangeControl.vendor_id == vendor_id
            )
        )).scalar() or 0
    ) + 1
    c = PharmaChangeControl(
        vendor_id=vendor_id,
        number=data.number or f"CC-{count:05d}",
        title=data.title.strip(),
        change_type=data.change_type,
        description=data.description,
        impact_assessment=data.impact_assessment,
        target_ref=data.target_ref,
        created_by=vu.id,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return JSONResponse(_cc_dict(c), status_code=201)


class ChangeControlUpdate(BaseModel):
    status: Optional[str] = None
    description: Optional[str] = None
    impact_assessment: Optional[str] = None
    target_ref: Optional[dict] = None


@router.patch("/change-controls/{cc_id}")
async def update_change_control(
    cc_id: UUID,
    data: ChangeControlUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    c = (
        await db.execute(
            select(PharmaChangeControl).where(
                PharmaChangeControl.id == cc_id, PharmaChangeControl.vendor_id == vendor_id
            )
        )
    ).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Change control not found")
    allowed = {"draft", "in_review", "approved", "rejected", "implemented"}
    if data.status:
        if data.status not in allowed:
            raise HTTPException(400, f"status must be one of {sorted(allowed)}")
        if data.status == "approved":
            raise HTTPException(400, "Use POST /change-controls/{id}/approve to approve")
        c.status = data.status
    if data.description is not None:
        c.description = data.description
    if data.impact_assessment is not None:
        c.impact_assessment = data.impact_assessment
    if data.target_ref is not None:
        c.target_ref = data.target_ref
    await append_pharma_audit(
        db, vendor_id=vendor_id, entity_type="pharma_change_control", entity_id=c.id,
        action="update", actor_id=vu.id, new_value={"status": c.status},
    )
    await db.commit()
    await db.refresh(c)
    return JSONResponse(_cc_dict(c))


class ChangeControlApprove(ESignFields):
    pass


@router.post("/change-controls/{cc_id}/approve")
async def approve_change_control(
    cc_id: UUID,
    request: Request,
    data: ChangeControlApprove = ChangeControlApprove(),
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.release")),
    db: AsyncSession = Depends(get_db),
):
    c = (
        await db.execute(
            select(PharmaChangeControl).where(
                PharmaChangeControl.id == cc_id, PharmaChangeControl.vendor_id == vendor_id
            )
        )
    ).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Change control not found")
    if c.status not in ("draft", "in_review"):
        raise HTTPException(400, f"Cannot approve from status {c.status}")

    cfg = await load_pharma_settings(db, vendor_id)
    pending_sigs = await load_pending_signatures(
        db, vendor_id=vendor_id, entity_type="pharma_change_control", entity_id=c.id,
    )
    existing = list(pending_sigs)
    for a in (c.approvals or []):
        if isinstance(a, dict) and a.get("meaning") in ("author", "reviewer", "approver"):
            existing.append(a)

    cc_policy = await resolve_approval_policy(
        db, vendor_id=vendor_id, action="cc_approve", ctx={}, settings=cfg,
    )
    esign = await verify_and_record_esign(
        db,
        vendor_id=vendor_id,
        vu=vu,
        entity_type="pharma_change_control",
        entity_id=c.id,
        action="approve",
        password=data.password,
        meaning=data.meaning,
        totp_code=data.totp_code,
        dual_sign_required=cc_policy.dual_sign,
        required_approvers=cc_policy.required_approvers,
        existing_signatures=existing,
        ip_address=_client_ip(request),
        extra_new_value={"policy_snapshot": cc_policy.snapshot},
        settings=cfg,
    )
    approvals = list(c.approvals or [])
    approvals.append({
        "at": datetime.now(timezone.utc).isoformat(),
        "by": str(vu.id),
        "by_name": esign.actor_name,
        "decision": "approved" if esign.complete else "signed",
        "meaning": esign.meaning,
    })
    c.approvals = approvals
    flag_modified(c, "approvals")

    if not esign.complete:
        c.status = "in_review"
        await db.commit()
        await db.refresh(c)
        body = _cc_dict(c)
        body["esign"] = {
            "complete": False,
            "message": esign.message,
            "signatures": esign.signatures,
        }
        return JSONResponse(body)

    c.status = "approved"
    await db.commit()
    await db.refresh(c)
    body = _cc_dict(c)
    body["esign"] = {
        "complete": True,
        "message": esign.message,
        "signatures": esign.signatures,
    }
    return JSONResponse(body)


# ── Phase 7: audit ────────────────────────────────────────────────────────────

@router.get("/audit")
async def list_audit(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    _perm: VendorUser = Depends(require_permission("pharma.audit")),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(PharmaAuditEvent).where(PharmaAuditEvent.vendor_id == vendor_id)
    if entity_type:
        q = q.where(PharmaAuditEvent.entity_type == entity_type)
    if entity_id:
        q = q.where(PharmaAuditEvent.entity_id == _require_uuid(entity_id, "entity_id"))
    rows = (
        await db.execute(q.order_by(PharmaAuditEvent.created_at.desc()).limit(limit))
    ).scalars().all()
    return JSONResponse({
        "events": [
            {
                "id": str(e.id),
                "entity_type": e.entity_type,
                "entity_id": str(e.entity_id),
                "action": e.action,
                "meaning": e.meaning,
                "actor_id": str(e.actor_id) if e.actor_id else None,
                "actor_name": e.actor_name,
                "old_value": e.old_value,
                "new_value": e.new_value,
                "signature_hash": e.signature_hash,
                "signature_valid": verify_pharma_audit_signature(e),
                "esign_verified": bool(getattr(e, "esign_verified", False)),
                "ip_address": e.ip_address,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in rows
        ]
    })


# ── Phase 8: serialization (Stage B lifecycle) ────────────────────────────────

class SerialCreate(BaseModel):
    goods_batch_id: str
    serial_number: str
    level: str = "unit"
    parent_id: Optional[str] = None


class SerialCommission(BaseModel):
    goods_batch_id: str
    quantity: int = Field(ge=1, le=5000)
    prefix: str = "SN"
    level: str = "unit"


class SerialAggregate(BaseModel):
    goods_batch_id: str
    parent_serial_number: str
    parent_level: str = "pack"
    child_ids: list[str] = Field(default_factory=list)


class SerialTransition(ESignFields):
    status: str
    notes: Optional[str] = None
    cascade: bool = True


def _serial_out(s) -> dict:
    from app.services.pharma_serial import _serial_dict
    return _serial_dict(s)


@router.get("/serials")
async def list_serials(
    goods_batch_id: Optional[str] = None,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(PharmaSerialUnit).where(PharmaSerialUnit.vendor_id == vendor_id)
    if goods_batch_id:
        q = q.where(PharmaSerialUnit.goods_batch_id == _require_uuid(goods_batch_id, "goods_batch_id"))
    rows = (await db.execute(q.order_by(PharmaSerialUnit.created_at.desc()).limit(500))).scalars().all()
    return JSONResponse({"items": [_serial_out(s) for s in rows]})


@router.post("/serials", status_code=201)
async def create_serial(
    data: SerialCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    from app.services.pharma_serial import create_serial_unit
    s = await create_serial_unit(
        db,
        vendor_id=vendor_id,
        goods_batch_id=_require_uuid(data.goods_batch_id, "goods_batch_id"),
        serial_number=data.serial_number,
        level=data.level,
        parent_id=_optional_uuid(data.parent_id, "parent_id"),
        actor_id=vu.id,
    )
    await db.commit()
    await db.refresh(s)
    return JSONResponse(_serial_out(s), status_code=201)


@router.post("/serials/commission", status_code=201)
async def commission_serials(
    data: SerialCommission,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    from app.services.pharma_serial import commission_serials_for_batch
    created = await commission_serials_for_batch(
        db,
        vendor_id=vendor_id,
        goods_batch_id=_require_uuid(data.goods_batch_id, "goods_batch_id"),
        quantity=data.quantity,
        prefix=data.prefix,
        level=data.level,
        actor_id=vu.id,
    )
    await db.commit()
    return JSONResponse({"items": [_serial_out(s) for s in created], "count": len(created)}, status_code=201)


@router.post("/serials/aggregate", status_code=201)
async def aggregate_serials_endpoint(
    data: SerialAggregate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    from app.services.pharma_serial import aggregate_serials
    child_ids = [_require_uuid(c, "child_ids") for c in data.child_ids]
    parent = await aggregate_serials(
        db,
        vendor_id=vendor_id,
        parent_serial_number=data.parent_serial_number,
        child_ids=child_ids,
        goods_batch_id=_require_uuid(data.goods_batch_id, "goods_batch_id"),
        parent_level=data.parent_level,
        actor_id=vu.id,
    )
    await db.commit()
    await db.refresh(parent)
    return JSONResponse(_serial_out(parent), status_code=201)


class SerialDisaggregate(BaseModel):
    parent_id: str


@router.post("/serials/disaggregate", status_code=200)
async def disaggregate_serials_endpoint(
    data: SerialDisaggregate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Detach all children from a parent serial, returning them as standalone units."""
    from app.services.pharma_serial import disaggregate_serials
    children = await disaggregate_serials(
        db,
        vendor_id=vendor_id,
        parent_id=_require_uuid(data.parent_id, "parent_id"),
        actor_id=vu.id,
    )
    await db.commit()
    return JSONResponse(
        {"items": [_serial_out(c) for c in children], "count": len(children)}
    )


@router.post("/serials/{serial_id}/transition")
async def transition_serial_endpoint(
    serial_id: UUID,
    request: Request,
    data: SerialTransition,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    from app.services.pharma_serial import transition_serial
    cfg = await load_pharma_settings(db, vendor_id)
    if data.status in ("shipped", "recalled", "destroyed") and cfg.get("esign_required", True):
        await verify_and_record_esign(
            db,
            vendor_id=vendor_id,
            vu=vu,
            entity_type="pharma_serial_unit",
            entity_id=serial_id,
            action=f"serial_{data.status}",
            password=data.password,
            meaning=data.meaning or "approver",
            totp_code=data.totp_code,
            dual_sign_required=False,
            ip_address=_client_ip(request),
            settings=cfg,
        )
    s = await transition_serial(
        db,
        vendor_id=vendor_id,
        serial_id=serial_id,
        new_status=data.status,
        actor_id=vu.id,
        cascade=data.cascade,
        notes=data.notes,
    )
    await db.commit()
    await db.refresh(s)
    return JSONResponse(_serial_out(s))


# ── Phase 9 / 10: GDP + track & trace (Stage C) ───────────────────────────────

class TempExcursionCreate(BaseModel):
    temp_c: float
    storage_location_id: Optional[str] = None
    goods_batch_id: Optional[str] = None
    duration_minutes: Optional[int] = None
    severity: str = "minor"
    notes: Optional[str] = None


class TempExcursionUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    action: Optional[str] = None


@router.get("/excursions")
async def list_temp_excursions(
    status_filter: Optional[str] = Query(None, alias="status"),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    from app.models.pharma import PharmaTempExcursion
    from app.services.pharma_gdp import _excursion_dict
    q = select(PharmaTempExcursion).where(PharmaTempExcursion.vendor_id == vendor_id)
    if status_filter:
        q = q.where(PharmaTempExcursion.status == status_filter)
    rows = (await db.execute(q.order_by(PharmaTempExcursion.recorded_at.desc()))).scalars().all()
    return JSONResponse({"items": [_excursion_dict(r) for r in rows]})


@router.post("/excursions", status_code=201)
async def create_temp_excursion_endpoint(
    data: TempExcursionCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    from app.services.pharma_gdp import create_temp_excursion, _excursion_dict
    e = await create_temp_excursion(
        db,
        vendor_id=vendor_id,
        temp_c=data.temp_c,
        storage_location_id=_optional_uuid(data.storage_location_id, "storage_location_id"),
        goods_batch_id=_optional_uuid(data.goods_batch_id, "goods_batch_id"),
        duration_minutes=data.duration_minutes,
        severity=data.severity,
        notes=data.notes,
        actor_id=vu.id,
    )
    await db.commit()
    await db.refresh(e)
    return JSONResponse(_excursion_dict(e), status_code=201)


@router.post("/excursions/import", status_code=201)
async def import_excursions_csv(
    file: UploadFile,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    """
    Bulk-import temperature excursions from a CSV file (sensor logger export).

    Expected columns (header row required):
      recorded_at, temp_c, duration_minutes, severity, notes, storage_location_id, goods_batch_id

    Only recorded_at and temp_c are mandatory; others are optional.
    severity defaults to 'minor'.  Exactly one of storage_location_id or goods_batch_id must be provided
    per row (or storage_location_id can be omitted if goods_batch_id is present).
    """
    import csv as csv_mod
    import io as _io
    from app.services.pharma_gdp import create_temp_excursion, _excursion_dict

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Only .csv files are accepted")

    raw = (await file.read()).decode("utf-8-sig", errors="replace")
    reader = csv_mod.DictReader(_io.StringIO(raw))
    created_rows = []
    errors = []

    for idx, row in enumerate(reader, start=2):  # row 1 is header
        try:
            recorded_at_raw = (row.get("recorded_at") or "").strip()
            temp_c_raw = (row.get("temp_c") or "").strip()
            if not temp_c_raw:
                errors.append(f"Row {idx}: temp_c required")
                continue
            temp_c_val = float(temp_c_raw)
            recorded_at_val: Optional[datetime] = None
            if recorded_at_raw:
                try:
                    recorded_at_val = datetime.fromisoformat(recorded_at_raw.replace("Z", "+00:00"))
                except ValueError:
                    errors.append(f"Row {idx}: invalid recorded_at '{recorded_at_raw}'")
                    continue

            dur_raw = (row.get("duration_minutes") or "").strip()
            duration_val = int(dur_raw) if dur_raw else None
            severity_val = (row.get("severity") or "minor").strip().lower()
            notes_val = (row.get("notes") or "").strip() or None

            sloc_raw = (row.get("storage_location_id") or "").strip()
            batch_raw = (row.get("goods_batch_id") or "").strip()
            sloc_id = _optional_uuid(sloc_raw, "storage_location_id") if sloc_raw else None
            batch_id = _optional_uuid(batch_raw, "goods_batch_id") if batch_raw else None

            if sloc_id is None and batch_id is None:
                errors.append(f"Row {idx}: storage_location_id or goods_batch_id required")
                continue

            e = await create_temp_excursion(
                db,
                vendor_id=vendor_id,
                temp_c=temp_c_val,
                storage_location_id=sloc_id,
                goods_batch_id=batch_id,
                duration_minutes=duration_val,
                severity=severity_val,
                notes=notes_val,
                actor_id=vu.id,
                recorded_at=recorded_at_val,
            )
            created_rows.append(_excursion_dict(e))
        except HTTPException as exc:
            errors.append(f"Row {idx}: {exc.detail}")
        except Exception as exc:
            errors.append(f"Row {idx}: {exc}")

    if created_rows:
        await db.commit()

    return JSONResponse(
        {"created": len(created_rows), "errors": errors, "items": created_rows},
        status_code=201,
    )


@router.patch("/excursions/{excursion_id}")
async def update_temp_excursion_endpoint(
    excursion_id: UUID,
    data: TempExcursionUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    from app.services.pharma_gdp import update_temp_excursion, _excursion_dict
    e = await update_temp_excursion(
        db,
        vendor_id=vendor_id,
        excursion_id=excursion_id,
        status=data.status,
        notes=data.notes,
        action=data.action,
        actor_id=vu.id,
    )
    await db.commit()
    await db.refresh(e)
    return JSONResponse(_excursion_dict(e))


class WholesaleLicenseCheck(BaseModel):
    customer_id: str


@router.post("/gdp/check-license")
async def check_wholesale_license(
    data: WholesaleLicenseCheck,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
):
    from app.models.customer import Customer
    from app.services.pharma_gdp import (
        assert_customer_wholesale_license,
        record_wholesale_license_history,
    )
    cfg = await load_pharma_settings(db, vendor_id)
    cust = (
        await db.execute(
            select(Customer).where(
                Customer.id == _require_uuid(data.customer_id, "customer_id"),
                Customer.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not cust:
        raise HTTPException(404, "Customer not found")
    try:
        assert_customer_wholesale_license(cust, required=True)
        ok = True
        detail = "License valid"
    except HTTPException as exc:
        ok = False
        detail = str(exc.detail)
    await record_wholesale_license_history(
        db,
        vendor_id=vendor_id,
        customer_id=cust.id,
        action="checked",
        license_number=cust.wholesale_license_number,
        license_expires=cust.wholesale_license_expires,
        check_ok=ok,
        detail=detail,
        created_by=vu.id,
    )
    await db.commit()
    return JSONResponse({
        "ok": ok,
        "detail": detail,
        "enforced": bool(cfg.get("wholesale_license_check")),
        "license_number": cust.wholesale_license_number,
        "license_expires": cust.wholesale_license_expires.isoformat() if cust.wholesale_license_expires else None,
    })


@router.get("/gdp/license-history")
async def wholesale_license_history(
    customer_id: str = Query(...),
    limit: int = Query(50, ge=1, le=200),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _perm: VendorUser = Depends(require_permission("pharma.manage")),
):
    from app.models.customer import Customer
    from app.services.pharma_gdp import list_wholesale_license_history

    cust = (
        await db.execute(
            select(Customer).where(
                Customer.id == _require_uuid(customer_id, "customer_id"),
                Customer.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not cust:
        raise HTTPException(404, "Customer not found")
    items = await list_wholesale_license_history(
        db, vendor_id, cust.id, limit=limit
    )
    return JSONResponse({
        "customer_id": str(cust.id),
        "customer_name": cust.company_name or cust.full_name,
        "items": items,
    })


def _license_document_dict(row) -> dict:
    return {
        "id": str(row.id),
        "customer_id": str(row.customer_id),
        "file_url": row.file_url,
        "filename": row.filename,
        "content_type": row.content_type,
        "size_bytes": row.size_bytes,
        "created_by": str(row.created_by) if row.created_by else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@router.get("/gdp/license-documents")
async def list_wholesale_license_documents(
    customer_id: str = Query(...),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _perm: VendorUser = Depends(require_permission("pharma.manage")),
):
    from app.models.customer import Customer
    from app.models.pharma import PharmaWholesaleLicenseDocument

    cust = (
        await db.execute(
            select(Customer).where(
                Customer.id == _require_uuid(customer_id, "customer_id"),
                Customer.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not cust:
        raise HTTPException(404, "Customer not found")
    rows = (
        await db.execute(
            select(PharmaWholesaleLicenseDocument)
            .where(
                PharmaWholesaleLicenseDocument.vendor_id == vendor_id,
                PharmaWholesaleLicenseDocument.customer_id == cust.id,
            )
            .order_by(PharmaWholesaleLicenseDocument.created_at.desc())
        )
    ).scalars().all()
    return JSONResponse({
        "customer_id": str(cust.id),
        "customer_name": cust.company_name or cust.full_name,
        "items": [_license_document_dict(r) for r in rows],
    })


@router.post("/gdp/license-documents")
async def upload_wholesale_license_document(
    customer_id: str = Query(...),
    file: UploadFile = File(...),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
):
    from app.models.customer import Customer
    from app.models.pharma import PharmaWholesaleLicenseDocument
    from app.services.media_upload import save_wholesale_license_document

    cust = (
        await db.execute(
            select(Customer).where(
                Customer.id == _require_uuid(customer_id, "customer_id"),
                Customer.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not cust:
        raise HTTPException(404, "Customer not found")
    payload = await save_wholesale_license_document(file, vendor_id, cust.id)
    row = PharmaWholesaleLicenseDocument(
        vendor_id=vendor_id,
        customer_id=cust.id,
        file_url=payload["url"],
        filename=payload["filename"][:255],
        content_type=payload.get("content_type"),
        size_bytes=payload.get("size"),
        created_by=vu.id,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return JSONResponse(_license_document_dict(row), status_code=201)


@router.delete("/gdp/license-documents/{document_id}", status_code=204)
async def delete_wholesale_license_document(
    document_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _perm: VendorUser = Depends(require_permission("pharma.manage")),
):
    from app.models.pharma import PharmaWholesaleLicenseDocument
    from app.services.media_upload import get_file_service

    row = (
        await db.execute(
            select(PharmaWholesaleLicenseDocument).where(
                PharmaWholesaleLicenseDocument.id == document_id,
                PharmaWholesaleLicenseDocument.vendor_id == vendor_id,
            )
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Document not found")
    file_url = row.file_url
    await db.delete(row)
    await db.commit()
    try:
        await get_file_service().delete_file(file_url)
    except Exception:
        pass
    return Response(status_code=204)


class PartnerCreate(BaseModel):
    name: Optional[str] = None
    partner_type: str = "wholesaler"
    gln: Optional[str] = None
    license_number: Optional[str] = None
    license_expires: Optional[str] = None
    verification_endpoint: Optional[str] = None
    business_partner_id: Optional[str] = None
    customer_id: Optional[str] = None
    supplier_id: Optional[str] = None


@router.get("/partners")
async def list_trading_partners(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    from app.models.pharma import PharmaTradingPartner
    from app.services.pharma_epcis import _partner_dict
    rows = (
        await db.execute(
            select(PharmaTradingPartner).where(PharmaTradingPartner.vendor_id == vendor_id)
            .order_by(PharmaTradingPartner.name)
        )
    ).scalars().all()
    return JSONResponse({"items": [_partner_dict(r) for r in rows]})


@router.post("/partners", status_code=201)
async def create_trading_partner(
    data: PartnerCreate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.manage")),
    db: AsyncSession = Depends(get_db),
):
    from app.models.business_partner import BusinessPartner, BusinessPartnerRole
    from app.models.customer import Customer
    from app.models.pharma import PharmaTradingPartner
    from app.models.procurement import Supplier
    from app.services.pharma_epcis import _partner_dict

    name = (data.name or "").strip()
    license_number = data.license_number
    license_expires = date.fromisoformat(data.license_expires) if data.license_expires else None
    meta: dict[str, Any] = {}

    if data.business_partner_id:
        bp = (
            await db.execute(
                select(BusinessPartner).where(
                    BusinessPartner.id == _require_uuid(data.business_partner_id, "business_partner_id"),
                    BusinessPartner.vendor_id == vendor_id,
                )
            )
        ).scalar_one_or_none()
        if not bp:
            raise HTTPException(status_code=404, detail="Business partner not found")
        if not name:
            name = (bp.name or bp.company_name or "").strip()
        meta["business_partner_id"] = str(bp.id)
        # Pull wholesale license from linked customer role when not supplied
        if not license_number:
            role_rows = (
                await db.execute(
                    select(BusinessPartnerRole).where(
                        BusinessPartnerRole.business_partner_id == bp.id,
                        BusinessPartnerRole.vendor_id == vendor_id,
                        BusinessPartnerRole.role == "customer",
                        BusinessPartnerRole.customer_id.isnot(None),
                    )
                )
            ).scalars().all()
            for role in role_rows:
                cust = (
                    await db.execute(
                        select(Customer).where(
                            Customer.id == role.customer_id,
                            Customer.vendor_id == vendor_id,
                        )
                    )
                ).scalar_one_or_none()
                if cust and getattr(cust, "wholesale_license_number", None):
                    license_number = cust.wholesale_license_number
                    if not license_expires and cust.wholesale_license_expires:
                        license_expires = cust.wholesale_license_expires
                    meta["customer_id"] = str(cust.id)
                    break
        # Capture linked supplier role when present
        if "supplier_id" not in meta:
            vendor_role = (
                await db.execute(
                    select(BusinessPartnerRole).where(
                        BusinessPartnerRole.business_partner_id == bp.id,
                        BusinessPartnerRole.vendor_id == vendor_id,
                        BusinessPartnerRole.role == "vendor",
                        BusinessPartnerRole.supplier_id.isnot(None),
                    ).limit(1)
                )
            ).scalar_one_or_none()
            if vendor_role and vendor_role.supplier_id:
                meta["supplier_id"] = str(vendor_role.supplier_id)

    if data.customer_id:
        cust = (
            await db.execute(
                select(Customer).where(
                    Customer.id == _require_uuid(data.customer_id, "customer_id"),
                    Customer.vendor_id == vendor_id,
                )
            )
        ).scalar_one_or_none()
        if not cust:
            raise HTTPException(status_code=404, detail="Customer not found")
        if not name:
            name = (cust.company_name or cust.full_name or "").strip()
        meta["customer_id"] = str(cust.id)
        if not license_number and getattr(cust, "wholesale_license_number", None):
            license_number = cust.wholesale_license_number
        if not license_expires and getattr(cust, "wholesale_license_expires", None):
            license_expires = cust.wholesale_license_expires

    if data.supplier_id:
        supplier = (
            await db.execute(
                select(Supplier).where(
                    Supplier.id == _require_uuid(data.supplier_id, "supplier_id"),
                    Supplier.vendor_id == vendor_id,
                )
            )
        ).scalar_one_or_none()
        if not supplier:
            raise HTTPException(status_code=404, detail="Vendor / supplier not found")
        if not name:
            name = (supplier.name or "").strip()
        meta["supplier_id"] = str(supplier.id)

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Select a master-data partner or enter a partner name",
        )

    p = PharmaTradingPartner(
        vendor_id=vendor_id,
        name=name,
        partner_type=data.partner_type,
        gln=data.gln,
        license_number=license_number,
        license_expires=license_expires,
        verification_endpoint=data.verification_endpoint,
        meta=meta,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return JSONResponse(_partner_dict(p), status_code=201)


@router.get("/epcis/events")
async def list_epcis_events(
    goods_batch_id: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    from app.models.pharma import PharmaEpcisEvent
    from app.services.pharma_epcis import _event_dict
    q = (
        select(PharmaEpcisEvent)
        .where(PharmaEpcisEvent.vendor_id == vendor_id)
        .order_by(PharmaEpcisEvent.event_time.desc())
        .limit(limit)
    )
    if goods_batch_id:
        q = q.where(PharmaEpcisEvent.goods_batch_id == _require_uuid(goods_batch_id, "goods_batch_id"))
    rows = (await db.execute(q)).scalars().all()
    return JSONResponse({"items": [_event_dict(r) for r in rows]})


@router.get("/epcis/export")
async def export_epcis(
    goods_batch_id: Optional[str] = None,
    limit: int = Query(500, ge=1, le=2000),
    format: str = Query("json", pattern="^(json|xml|lite|csv|xlsx|pdf)$"),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    from fastapi.responses import Response
    from app.services.pharma_epcis import export_epcis_document

    cfg = await load_pharma_settings(db, vendor_id)
    doc = await export_epcis_document(
        db,
        vendor_id=vendor_id,
        goods_batch_id=_optional_uuid(goods_batch_id, "goods_batch_id"),
        limit=limit,
        fmt=format,  # type: ignore[arg-type]
        gs1_company_prefix=cfg.get("gs1_company_prefix") or None,
    )
    if format == "xml":
        return Response(
            content=doc if isinstance(doc, str) else str(doc),
            media_type="application/xml; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="epcis-export.xml"'},
        )
    if format == "csv":
        return Response(
            content=doc if isinstance(doc, str) else str(doc),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="epcis-movements.csv"'},
        )
    if format == "xlsx":
        content = doc if isinstance(doc, (bytes, bytearray)) else bytes(doc)
        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="epcis-movements.xlsx"'},
        )
    if format == "pdf":
        content = doc if isinstance(doc, (bytes, bytearray)) else bytes(doc)
        return Response(
            content=content,
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="epcis-movements.pdf"'},
        )
    return JSONResponse(doc)


class DscsaVerifyRequest(BaseModel):
    serial_number: str
    gtin: Optional[str] = None
    lot_number: Optional[str] = None
    expiry_date: Optional[str] = None
    partner_id: Optional[str] = None


@router.post("/dscsa/verify")
async def dscsa_verify(
    data: DscsaVerifyRequest,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    from app.services.pharma_epcis import dscsa_verify_stub
    cfg = await load_pharma_settings(db, vendor_id)
    result = await dscsa_verify_stub(
        db,
        vendor_id=vendor_id,
        gtin=data.gtin,
        serial_number=data.serial_number,
        lot_number=data.lot_number,
        expiry_date=data.expiry_date,
        partner_id=_optional_uuid(data.partner_id, "partner_id"),
        vrs_endpoint=cfg.get("vrs_endpoint") or None,
        vrs_api_key=cfg.get("vrs_api_key") or None,
    )
    return JSONResponse(result)


class FmdDecommissionRequest(ESignFields):
    serial_id: str
    reason: str = "supplied"


@router.post("/fmd/decommission")
async def fmd_decommission_endpoint(
    request: Request,
    data: FmdDecommissionRequest,
    vendor_id: UUID = Depends(get_current_vendor_id),
    vu: VendorUser = Depends(require_permission("pharma.release")),
    db: AsyncSession = Depends(get_db),
):
    cfg = await load_pharma_settings(db, vendor_id)
    serial_id = _require_uuid(data.serial_id, "serial_id")
    # Resolve region with plant/store context from the serial's batch
    serial_for_region = (
        await db.execute(select(PharmaSerialUnit).where(PharmaSerialUnit.id == serial_id))
    ).scalar_one_or_none()
    _fmd_plant_id: Optional[UUID] = None
    if serial_for_region and serial_for_region.goods_batch_id:
        _fmd_batch = (
            await db.execute(
                select(GoodsBatch.plant_id).where(GoodsBatch.id == serial_for_region.goods_batch_id)
            )
        ).scalar_one_or_none()
        if _fmd_batch:
            _fmd_plant_id = _fmd_batch
    effective_region = await resolve_track_trace_region(
        db, vendor_id, plant_id=_fmd_plant_id, settings=cfg,
    )
    if effective_region != "eu":
        raise HTTPException(
            400,
            "FMD decommission requires track_trace_region=eu "
            f"(effective region for this serial's plant: '{effective_region}')",
        )
    if cfg.get("esign_required", True):
        await verify_and_record_esign(
            db,
            vendor_id=vendor_id,
            vu=vu,
            entity_type="pharma_serial_unit",
            entity_id=serial_id,
            action="fmd_decommission",
            password=data.password,
            meaning=data.meaning or "approver",
            totp_code=data.totp_code,
            dual_sign_required=False,
            ip_address=_client_ip(request),
            settings=cfg,
        )
    from app.services.pharma_epcis import fmd_decommission, _event_dict
    ev = await fmd_decommission(
        db,
        vendor_id=vendor_id,
        serial_id=serial_id,
        actor_id=vu.id,
        reason=data.reason,
        nmvs_endpoint=cfg.get("nmvs_endpoint") or None,
        nmvs_api_key=cfg.get("nmvs_api_key") or None,
    )
    await db.commit()
    await db.refresh(ev)
    return JSONResponse(_event_dict(ev))
