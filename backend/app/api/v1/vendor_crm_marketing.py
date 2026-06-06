"""
CRM marketing endpoints: segments, email templates, campaigns,
workflow automation and integration credential management.
"""
from __future__ import annotations

from math import ceil
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_permission
from app.database import get_db
from app.models.vendor_user import VendorUser
from app.schemas.crm.schemas import (
    CampaignCreate, CampaignResponse, CampaignStepResponse, CampaignUpdate,
    ContactResponse, EmailTemplateCreate, EmailTemplateResponse,
    IntegrationCreate, IntegrationResponse, IntegrationUpdate,
    PaginatedResponse, SegmentCreate, SegmentResponse,
    WorkflowCreate, WorkflowResponse, WorkflowRunResponse, WorkflowUpdate,
)
from app.services.crm.services import (
    CampaignService, EmailTemplateService, IntegrationService,
    SegmentService, WorkflowService,
)

router = APIRouter()


def _paginated(items, total, page, size):
    return {
        "items": items, "total": total, "page": page, "size": size,
        "pages": ceil(total / size) if total else 0,
    }


def _campaign_to_dict(c, steps):
    payload = CampaignResponse.model_validate(c).model_dump()
    payload["steps"] = [CampaignStepResponse.model_validate(s).model_dump() for s in steps]
    return payload


# ── Segments ─────────────────────────────────────────────────────────────────

@router.get("/segments", response_model=list[SegmentResponse])
async def list_segments(
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    items = await SegmentService(db).list(vu.vendor_id)
    return [SegmentResponse.model_validate(s) for s in items]


@router.post("/segments", response_model=SegmentResponse, status_code=status.HTTP_201_CREATED)
async def create_segment(
    data: SegmentCreate,
    vu: VendorUser = Depends(require_permission("crm.segments.manage")),
    db: AsyncSession = Depends(get_db),
):
    obj = await SegmentService(db).create(vu.vendor_id, data)
    return SegmentResponse.model_validate(obj)


@router.get("/segments/{segment_id}", response_model=SegmentResponse)
async def get_segment(
    segment_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    return await SegmentService(db).get(vu.vendor_id, segment_id)


@router.put("/segments/{segment_id}", response_model=SegmentResponse)
async def update_segment(
    segment_id: UUID, data: SegmentCreate,
    vu: VendorUser = Depends(require_permission("crm.segments.manage")),
    db: AsyncSession = Depends(get_db),
):
    obj = await SegmentService(db).update(vu.vendor_id, segment_id, data)
    return SegmentResponse.model_validate(obj)


@router.delete("/segments/{segment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_segment(
    segment_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.segments.manage")),
    db: AsyncSession = Depends(get_db),
):
    await SegmentService(db).delete(vu.vendor_id, segment_id)
    return None


@router.post("/segments/{segment_id}/refresh")
async def refresh_segment(
    segment_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.segments.manage")),
    db: AsyncSession = Depends(get_db),
):
    count = await SegmentService(db).refresh_count(vu.vendor_id, segment_id)
    return {"ok": True, "contact_count": count}


@router.get("/segments/{segment_id}/preview", response_model=list[ContactResponse])
async def preview_segment(
    segment_id: UUID, limit: int = Query(25, ge=1, le=100),
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    items = await SegmentService(db).preview(vu.vendor_id, segment_id, limit=limit)
    return [ContactResponse.model_validate(c) for c in items]


# ── Email templates ──────────────────────────────────────────────────────────

@router.get("/templates", response_model=list[EmailTemplateResponse])
async def list_templates(
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    items = await EmailTemplateService(db).list(vu.vendor_id)
    return [EmailTemplateResponse.model_validate(t) for t in items]


@router.post("/templates", response_model=EmailTemplateResponse,
             status_code=status.HTTP_201_CREATED)
async def create_template(
    data: EmailTemplateCreate,
    vu: VendorUser = Depends(require_permission("crm.campaigns.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await EmailTemplateService(db).create(vu.vendor_id, data)


@router.put("/templates/{template_id}", response_model=EmailTemplateResponse)
async def update_template(
    template_id: UUID, data: EmailTemplateCreate,
    vu: VendorUser = Depends(require_permission("crm.campaigns.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await EmailTemplateService(db).update(vu.vendor_id, template_id, data)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.campaigns.manage")),
    db: AsyncSession = Depends(get_db),
):
    await EmailTemplateService(db).delete(vu.vendor_id, template_id)
    return None


# ── Campaigns ────────────────────────────────────────────────────────────────

@router.get("/campaigns", response_model=PaginatedResponse)
async def list_campaigns(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    items, total = await CampaignService(db).list(vu.vendor_id, page=page, size=size)
    items = [CampaignResponse.model_validate(c).model_dump() for c in items]
    return _paginated(items, total, page, size)


@router.post("/campaigns", status_code=status.HTTP_201_CREATED)
async def create_campaign(
    data: CampaignCreate,
    vu: VendorUser = Depends(require_permission("crm.campaigns.manage")),
    db: AsyncSession = Depends(get_db),
):
    obj, steps = await CampaignService(db).create(vu.vendor_id, data, actor_id=vu.user_id)
    return _campaign_to_dict(obj, steps)


@router.get("/campaigns/{campaign_id}")
async def get_campaign(
    campaign_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    obj, steps = await CampaignService(db).get(vu.vendor_id, campaign_id)
    return _campaign_to_dict(obj, steps)


@router.put("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: UUID, data: CampaignUpdate,
    vu: VendorUser = Depends(require_permission("crm.campaigns.manage")),
    db: AsyncSession = Depends(get_db),
):
    obj = await CampaignService(db).update(vu.vendor_id, campaign_id, data,
                                            actor_id=vu.user_id)
    return CampaignResponse.model_validate(obj)


@router.delete("/campaigns/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(
    campaign_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.campaigns.manage")),
    db: AsyncSession = Depends(get_db),
):
    await CampaignService(db).delete(vu.vendor_id, campaign_id)
    return None


@router.post("/campaigns/{campaign_id}/start")
async def start_campaign(
    campaign_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.campaigns.manage")),
    db: AsyncSession = Depends(get_db),
):
    obj = await CampaignService(db).start(vu.vendor_id, campaign_id)
    return CampaignResponse.model_validate(obj)


@router.post("/campaigns/{campaign_id}/pause")
async def pause_campaign(
    campaign_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.campaigns.manage")),
    db: AsyncSession = Depends(get_db),
):
    obj = await CampaignService(db).pause(vu.vendor_id, campaign_id)
    return CampaignResponse.model_validate(obj)


@router.post("/campaigns/{campaign_id}/enroll-segment/{segment_id}")
async def enroll_segment(
    campaign_id: UUID, segment_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.campaigns.manage")),
    db: AsyncSession = Depends(get_db),
):
    count = await CampaignService(db).enroll_segment(vu.vendor_id, campaign_id, segment_id,
                                                      actor_id=vu.user_id)
    return {"ok": True, "enrolled": count}


# ── Workflows ────────────────────────────────────────────────────────────────

@router.get("/workflows", response_model=list[WorkflowResponse])
async def list_workflows(
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    items = await WorkflowService(db).list(vu.vendor_id)
    return [WorkflowResponse.model_validate(w) for w in items]


@router.post("/workflows", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    data: WorkflowCreate,
    vu: VendorUser = Depends(require_permission("crm.workflows.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await WorkflowService(db).create(vu.vendor_id, data)


@router.get("/workflows/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    return await WorkflowService(db).get(vu.vendor_id, workflow_id)


@router.put("/workflows/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: UUID, data: WorkflowUpdate,
    vu: VendorUser = Depends(require_permission("crm.workflows.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await WorkflowService(db).update(vu.vendor_id, workflow_id, data)


@router.delete("/workflows/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(
    workflow_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.workflows.manage")),
    db: AsyncSession = Depends(get_db),
):
    await WorkflowService(db).delete(vu.vendor_id, workflow_id)
    return None


@router.get("/workflows/{workflow_id}/runs", response_model=PaginatedResponse)
async def list_workflow_runs(
    workflow_id: UUID, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    items, total = await WorkflowService(db).list_runs(vu.vendor_id, workflow_id,
                                                        page=page, size=size)
    items = [WorkflowRunResponse.model_validate(r).model_dump() for r in items]
    return _paginated(items, total, page, size)


@router.post("/workflows/{workflow_id}/trigger")
async def trigger_workflow(
    workflow_id: UUID, payload: dict,
    vu: VendorUser = Depends(require_permission("crm.workflows.manage")),
    db: AsyncSession = Depends(get_db),
):
    entity_type = payload.get("entity_type")
    entity_id = payload.get("entity_id")
    if not entity_type or not entity_id:
        raise HTTPException(status_code=400, detail="entity_type and entity_id required")
    return await WorkflowService(db).trigger(
        vu.vendor_id, workflow_id, entity_type, UUID(entity_id),
        context=payload.get("context") or {},
    )


# ── Integrations ─────────────────────────────────────────────────────────────

@router.get("/integrations", response_model=list[IntegrationResponse])
async def list_integrations(
    vu: VendorUser = Depends(require_permission("crm.integrations.manage")),
    db: AsyncSession = Depends(get_db),
):
    items = await IntegrationService(db).list(vu.vendor_id)
    return [IntegrationResponse.model_validate(i) for i in items]


@router.post("/integrations", response_model=IntegrationResponse,
             status_code=status.HTTP_201_CREATED)
async def upsert_integration(
    data: IntegrationCreate,
    vu: VendorUser = Depends(require_permission("crm.integrations.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await IntegrationService(db).upsert(vu.vendor_id, data)


@router.put("/integrations/{integration_id}", response_model=IntegrationResponse)
async def update_integration(
    integration_id: UUID, data: IntegrationUpdate,
    vu: VendorUser = Depends(require_permission("crm.integrations.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await IntegrationService(db).update(vu.vendor_id, integration_id, data)


@router.delete("/integrations/{integration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_integration(
    integration_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.integrations.manage")),
    db: AsyncSession = Depends(get_db),
):
    await IntegrationService(db).delete(vu.vendor_id, integration_id)
    return None
