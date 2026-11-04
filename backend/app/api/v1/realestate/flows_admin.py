"""Phase 0 workflow endpoints: UI metadata, approvals, integrations, templates, alerts."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.models.realestate.admin import ReApprovalRequest, ReGlFailure, ReIntegration, ReTemplate
from app.models.realestate.core import ReCommunication
from app.services.realestate import alerts as alerts_svc
from app.services.realestate import messaging
from app.services.realestate import finance_bridge as gl_bridge
from app.services.realestate.approvals import decide
from app.services.realestate.common import Ctx, audit, get_owned
from app.services.realestate.templates import (
    DEFAULT_TEMPLATES,
    MERGE_FIELDS,
    SAMPLE_VALUES,
    render_string,
    render_template,
    wrap_print,
)

from .crud import resource_meta
from .ctx import ctx_dep
from .modules import MODULES
from .registry import RESOURCES, key_by_table

router = APIRouter()

view = ctx_dep("realestate.view")
approve_dep = ctx_dep("realestate.view")  # permission is evaluated per rule inside decide()
admin_dep = ctx_dep("realestate.admin")


@router.get("/meta", summary="UI metadata: modules, tabs, resources, fields, actions")
async def meta(ctx: Ctx = Depends(view)):
    kbt = key_by_table()
    resources = {r.key: resource_meta(r, kbt) for r in RESOURCES}
    modules = []
    for m in MODULES:
        tabs = [t for t in m["tabs"] if "resource" not in t or t["resource"] in resources]
        modules.append({**m, "tabs": tabs})
    # Build merge-fields map: common fields + type-specific fields
    common = MERGE_FIELDS.get("_common", [])
    merge_fields = {
        t: common + MERGE_FIELDS.get(t, [])
        for t in DEFAULT_TEMPLATES
    }
    return {
        "modules": modules,
        "resources": resources,
        "permissions": sorted(p for p in ctx.permissions if p.startswith("realestate.")),
        "template_types": sorted(DEFAULT_TEMPLATES.keys()),
        "merge_fields": merge_fields,
    }


@router.get("/alerts", summary="Operational alerts across the module")
async def get_alerts(ctx: Ctx = Depends(view)):
    items = await alerts_svc.collect(ctx)
    return {"items": items, "total": len(items)}


class DecisionBody(BaseModel):
    comments: Optional[str] = None


@router.post("/approval-requests/{request_id}/approve")
async def approve_request(request_id: uuid.UUID, body: DecisionBody = DecisionBody(), ctx: Ctx = Depends(approve_dep)):
    req = await get_owned(ctx.db, ReApprovalRequest, ctx.vendor_id, request_id, "approval request")
    await decide(ctx, req, True, body.comments or "")
    await ctx.db.commit()
    return {"id": str(req.id), "status": req.status}


@router.post("/approval-requests/{request_id}/reject")
async def reject_request(request_id: uuid.UUID, body: DecisionBody = DecisionBody(), ctx: Ctx = Depends(approve_dep)):
    if not (body.comments or "").strip():
        raise HTTPException(status_code=422, detail="A reason is required to reject")
    req = await get_owned(ctx.db, ReApprovalRequest, ctx.vendor_id, request_id, "approval request")
    await decide(ctx, req, False, body.comments or "")
    await ctx.db.commit()
    return {"id": str(req.id), "status": req.status}


_REQUIRED_CONFIG = {
    "payment_gateway": ["key_id", "key_secret"],
    "sms": ["api_key", "sender_id"],
    "whatsapp": ["api_key", "phone_number_id"],
    "email": ["from_email"],
    "esign": ["api_key"],
    "tally": ["company_name"],
    "rera_portal": ["registration_id"],
    "maps": ["api_key"],
}


@router.post("/integrations/{integration_id}/test")
async def test_integration(integration_id: uuid.UUID, ctx: Ctx = Depends(admin_dep)):
    """Validates that required settings are present (no outbound call is made)."""
    integ = await get_owned(ctx.db, ReIntegration, ctx.vendor_id, integration_id, "integration")
    cfg = integ.config or {}
    missing = [k for k in _REQUIRED_CONFIG.get(integ.provider, []) if not str(cfg.get(k, "")).strip()]
    integ.last_tested_at = datetime.now(timezone.utc)
    integ.last_status = "ok" if not missing else "missing_config"
    integ.last_message = "Configuration complete" if not missing else f"Missing: {', '.join(missing)}"
    await audit(ctx, "integration", integ.id, "test", ref=integ.name, changes={"status": integ.last_status})
    await ctx.db.commit()
    return {"status": integ.last_status, "message": integ.last_message}


@router.post("/gl-failures/retry-all")
async def retry_all_gl_failures(ctx: Ctx = Depends(admin_dep)):
    """Retry every open ledger-posting failure (after fixing Finance account setup or reopening a period)."""
    rows = (await ctx.db.execute(select(ReGlFailure).where(
        ReGlFailure.vendor_id == ctx.vendor_id, ReGlFailure.status == "open").limit(500))).scalars().all()
    resolved = 0
    for f in rows:
        if (await gl_bridge.retry_failure(ctx.db, f))["status"] == "resolved":
            resolved += 1
    await audit(ctx, "gl_failure", None, "retry_all", ref=str(len(rows)), changes={"tried": len(rows), "resolved": resolved})
    await ctx.db.commit()
    return {"tried": len(rows), "resolved": resolved, "still_open": len(rows) - resolved}


@router.post("/gl-failures/{failure_id}/retry")
async def retry_gl_failure(failure_id: uuid.UUID, ctx: Ctx = Depends(admin_dep)):
    f = await get_owned(ctx.db, ReGlFailure, ctx.vendor_id, failure_id, "posting issue")
    if f.status != "open":
        raise HTTPException(status_code=409, detail="This document is already posted")
    out = await gl_bridge.retry_failure(ctx.db, f)
    await audit(ctx, "gl_failure", f.id, "retry", ref=f.reference, changes={"status": out["status"]})
    await ctx.db.commit()
    return out


@router.post("/communications/{comm_id}/requeue")
async def requeue_communication(comm_id: uuid.UUID, ctx: Ctx = Depends(ctx_dep("realestate.sales"))):
    row = await get_owned(ctx.db, ReCommunication, ctx.vendor_id, comm_id, "message")
    if row.status != "failed":
        raise HTTPException(status_code=409, detail=f"Only failed messages can be retried (this one is {row.status})")
    await messaging.requeue(row)
    await audit(ctx, "communication", row.id, "requeue", ref=row.subject or "")
    await ctx.db.commit()
    return {"status": row.status}


@router.post("/communications/dispatch", summary="Send queued customer emails / SMS now instead of waiting for the next run")
async def dispatch_communications(ctx: Ctx = Depends(admin_dep)):
    out = await messaging.dispatch_queued(ctx.db, ctx.vendor_id)
    await ctx.db.commit()
    return out


@router.get("/templates/{template_id}/preview")
async def preview_template(template_id: uuid.UUID, ctx: Ctx = Depends(view)):
    """Render the template with comprehensive sample values and return a full print-ready document."""
    tpl = await get_owned(ctx.db, ReTemplate, ctx.vendor_id, template_id, "template")
    sample = {**SAMPLE_VALUES, "date": datetime.now(timezone.utc).strftime("%d %b %Y")}
    ps: dict = tpl.print_settings or {}
    body_html = render_string(tpl.body or "", sample)
    subject = render_string(tpl.subject or "", sample)
    html = wrap_print(body_html, ps, sample)
    return {"subject": subject, "html": html, "body": body_html, "print_settings": ps}


@router.get("/templates/defaults/{template_type}", summary="Built-in default body for a template type")
async def template_default(template_type: str, ctx: Ctx = Depends(admin_dep)):
    """Return the built-in subject/body so the UI can offer a 'Reset to default' option."""
    default = DEFAULT_TEMPLATES.get(template_type)
    if not default:
        raise HTTPException(status_code=404, detail=f"No built-in template for type '{template_type}'")
    sample = {**SAMPLE_VALUES, "date": datetime.now(timezone.utc).strftime("%d %b %Y")}
    body_html = render_string(default["body"], sample)
    return {
        "template_type": template_type,
        "subject": default["subject"],
        "body": default["body"],
        "preview_html": wrap_print(body_html, {}, sample),
        "merge_fields": MERGE_FIELDS.get("_common", []) + MERGE_FIELDS.get(template_type, []),
    }
