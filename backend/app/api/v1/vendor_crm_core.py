"""
Core CRM endpoints (vendor-scoped):
    - Accounts (companies + hierarchy)
    - Contacts (people)
    - Leads (intake + scoring + conversion)
    - Pipelines + Stages
    - Deals (with kanban + forecast)
    - Activities (tasks/calls/meetings/notes)
"""
from __future__ import annotations

from math import ceil
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_permission
from app.database import get_db
from app.models.vendor_user import VendorUser
from app.schemas.crm.schemas import (
    AccountCreate, AccountResponse, AccountUpdate,
    ActivityCreate, ActivityResponse, ActivityUpdate,
    ContactCreate, ContactResponse, ContactUpdate,
    DealCreate, DealMoveRequest, DealResponse, DealUpdate,
    LeadConvertRequest, LeadCreate, LeadResponse, LeadUpdate,
    PaginatedResponse, PipelineCreate, PipelineResponse,
    StageCreate, StageResponse,
)
from app.services.crm.services import (
    AccountService, ActivityService, ContactService, DealService,
    LeadService, PipelineService,
)

router = APIRouter()


def _paginated(items, total, page, size):
    return {
        "items": items, "total": total, "page": page, "size": size,
        "pages": ceil(total / size) if total else 0,
    }


# ── Accounts ─────────────────────────────────────────────────────────────────

@router.get("/accounts", response_model=PaginatedResponse)
async def list_accounts(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    q: Optional[str] = None, industry: Optional[str] = None,
    region: Optional[str] = None, owner_id: Optional[UUID] = None,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    items, total = await AccountService(db).list(
        vu.vendor_id, page=page, size=size, q=q, industry=industry,
        region=region, owner_id=owner_id,
    )
    items = [AccountResponse.model_validate(a).model_dump() for a in items]
    return _paginated(items, total, page, size)


@router.post("/accounts", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    data: AccountCreate, request: Request,
    vu: VendorUser = Depends(require_permission("crm.contacts.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await AccountService(db).create(vu.vendor_id, data,
                                            actor_id=vu.user_id, request=request)


@router.get("/accounts/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    return await AccountService(db).get(vu.vendor_id, account_id)


@router.put("/accounts/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: UUID, data: AccountUpdate, request: Request,
    vu: VendorUser = Depends(require_permission("crm.contacts.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await AccountService(db).update(vu.vendor_id, account_id, data,
                                            actor_id=vu.user_id, request=request)


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: UUID, request: Request,
    vu: VendorUser = Depends(require_permission("crm.contacts.manage")),
    db: AsyncSession = Depends(get_db),
):
    await AccountService(db).delete(vu.vendor_id, account_id,
                                     actor_id=vu.user_id, request=request)
    return None


# ── Contacts ─────────────────────────────────────────────────────────────────

@router.get("/contacts", response_model=PaginatedResponse)
async def list_contacts(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=200),
    q: Optional[str] = None, account_id: Optional[UUID] = None,
    owner_id: Optional[UUID] = None, stage: Optional[str] = None,
    tag: Optional[str] = None, record_type: Optional[str] = None,
    parent_contact_id: Optional[UUID] = None,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    items, total = await ContactService(db).list(
        vu.vendor_id, page=page, size=size, q=q, account_id=account_id,
        owner_id=owner_id, stage=stage, tag=tag, record_type=record_type,
        parent_contact_id=parent_contact_id,
    )
    items = [ContactResponse.model_validate(c).model_dump() for c in items]
    return _paginated(items, total, page, size)


@router.post("/contacts", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(
    data: ContactCreate, request: Request,
    vu: VendorUser = Depends(require_permission("crm.contacts.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await ContactService(db).create(vu.vendor_id, data,
                                            actor_id=vu.user_id, request=request)


@router.get("/contacts/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    return await ContactService(db).get(vu.vendor_id, contact_id)


@router.put("/contacts/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: UUID, data: ContactUpdate, request: Request,
    vu: VendorUser = Depends(require_permission("crm.contacts.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await ContactService(db).update(vu.vendor_id, contact_id, data,
                                            actor_id=vu.user_id, request=request)


@router.delete("/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: UUID, request: Request,
    vu: VendorUser = Depends(require_permission("crm.contacts.manage")),
    db: AsyncSession = Depends(get_db),
):
    await ContactService(db).delete(vu.vendor_id, contact_id,
                                     actor_id=vu.user_id, request=request)
    return None


# ── Leads ────────────────────────────────────────────────────────────────────

@router.get("/leads", response_model=PaginatedResponse)
async def list_leads(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    q: Optional[str] = None, status_: Optional[str] = Query(None, alias="status"),
    source: Optional[str] = None, assigned_to: Optional[UUID] = None,
    rating: Optional[str] = None,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    items, total = await LeadService(db).list(
        vu.vendor_id, page=page, size=size, q=q, status=status_,
        source=source, assigned_to=assigned_to, rating=rating,
    )
    items = [LeadResponse.model_validate(l).model_dump() for l in items]
    return _paginated(items, total, page, size)


@router.post("/leads", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def create_lead(
    data: LeadCreate, request: Request,
    vu: VendorUser = Depends(require_permission("crm.leads.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await LeadService(db).create(vu.vendor_id, data,
                                         actor_id=vu.user_id, request=request)


@router.get("/leads/{lead_id}", response_model=LeadResponse)
async def get_lead(
    lead_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    return await LeadService(db).get(vu.vendor_id, lead_id)


@router.put("/leads/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: UUID, data: LeadUpdate, request: Request,
    vu: VendorUser = Depends(require_permission("crm.leads.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await LeadService(db).update(vu.vendor_id, lead_id, data,
                                         actor_id=vu.user_id, request=request)


@router.delete("/leads/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(
    lead_id: UUID, request: Request,
    vu: VendorUser = Depends(require_permission("crm.leads.manage")),
    db: AsyncSession = Depends(get_db),
):
    await LeadService(db).delete(vu.vendor_id, lead_id,
                                  actor_id=vu.user_id, request=request)
    return None


@router.post("/leads/{lead_id}/assign")
async def assign_lead(
    lead_id: UUID, payload: dict,
    vu: VendorUser = Depends(require_permission("crm.leads.manage")),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")
    obj = await LeadService(db).assign(vu.vendor_id, lead_id, UUID(user_id),
                                        actor_id=vu.user_id)
    return LeadResponse.model_validate(obj).model_dump()


@router.post("/leads/{lead_id}/convert")
async def convert_lead(
    lead_id: UUID, payload: LeadConvertRequest, request: Request,
    vu: VendorUser = Depends(require_permission("crm.leads.manage")),
    db: AsyncSession = Depends(get_db),
):
    result = await LeadService(db).convert(vu.vendor_id, lead_id, payload,
                                            actor_id=vu.user_id, request=request)
    out = {"lead": LeadResponse.model_validate(result["lead"]).model_dump()}
    if result.get("contact"):
        out["contact"] = ContactResponse.model_validate(result["contact"]).model_dump()
    if result.get("account"):
        out["account"] = AccountResponse.model_validate(result["account"]).model_dump()
    if result.get("deal"):
        out["deal"] = DealResponse.model_validate(result["deal"]).model_dump()
    return out


@router.post("/leads/{lead_id}/score")
async def score_lead(
    lead_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.ai.use")),
    db: AsyncSession = Depends(get_db),
):
    from app.services.crm.services import AiService
    return await AiService(db).score_lead(vu.vendor_id, lead_id)


# ── Pipelines & Stages ───────────────────────────────────────────────────────

@router.get("/pipelines", response_model=list[PipelineResponse])
async def list_pipelines(
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    items = await PipelineService(db).list(vu.vendor_id)
    return [PipelineResponse.model_validate(p) for p in items]


@router.post("/pipelines", response_model=PipelineResponse, status_code=status.HTTP_201_CREATED)
async def create_pipeline(
    data: PipelineCreate,
    vu: VendorUser = Depends(require_permission("crm.deals.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await PipelineService(db).create(vu.vendor_id, data, actor_id=vu.user_id)


@router.get("/pipelines/{pipeline_id}", response_model=PipelineResponse)
async def get_pipeline(
    pipeline_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    return await PipelineService(db).get(vu.vendor_id, pipeline_id)


@router.delete("/pipelines/{pipeline_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pipeline(
    pipeline_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.deals.manage")),
    db: AsyncSession = Depends(get_db),
):
    await PipelineService(db).delete(vu.vendor_id, pipeline_id, actor_id=vu.user_id)
    return None


@router.post("/pipelines/{pipeline_id}/stages", response_model=StageResponse,
             status_code=status.HTTP_201_CREATED)
async def add_stage(
    pipeline_id: UUID, data: StageCreate,
    vu: VendorUser = Depends(require_permission("crm.deals.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await PipelineService(db).add_stage(vu.vendor_id, pipeline_id, data,
                                                actor_id=vu.user_id)


@router.delete("/pipelines/stages/{stage_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_stage(
    stage_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.deals.manage")),
    db: AsyncSession = Depends(get_db),
):
    await PipelineService(db).delete_stage(vu.vendor_id, stage_id, actor_id=vu.user_id)
    return None


# ── Deals ────────────────────────────────────────────────────────────────────

@router.get("/deals", response_model=PaginatedResponse)
async def list_deals(
    page: int = Query(1, ge=1), size: int = Query(50, ge=1, le=200),
    q: Optional[str] = None, pipeline_id: Optional[UUID] = None,
    stage_id: Optional[UUID] = None, owner_id: Optional[UUID] = None,
    status_: Optional[str] = Query(None, alias="status"),
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    items, total = await DealService(db).list(
        vu.vendor_id, page=page, size=size, q=q, pipeline_id=pipeline_id,
        stage_id=stage_id, owner_id=owner_id, status=status_,
    )
    items = [DealResponse.model_validate(d).model_dump() for d in items]
    return _paginated(items, total, page, size)


@router.get("/deals/kanban")
async def deals_kanban(
    pipeline_id: Optional[UUID] = None,
    status_: str = Query("open", alias="status"),
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    if not pipeline_id:
        pipelines = await PipelineService(db).list(vu.vendor_id)
        if not pipelines:
            raise HTTPException(status_code=400, detail="No pipeline found")
        pipeline_id = pipelines[0].id
    data = await DealService(db).kanban(vu.vendor_id, pipeline_id, status=status_)
    return {
        "pipeline": PipelineResponse.model_validate(data["pipeline"]).model_dump(),
        "columns": [
            {
                "stage": StageResponse.model_validate(c["stage"]).model_dump(),
                "deals": [DealResponse.model_validate(d).model_dump() for d in c["deals"]],
            }
            for c in data["columns"]
        ],
    }


@router.get("/deals/forecast")
async def deals_forecast(
    pipeline_id: Optional[UUID] = None,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    return await DealService(db).forecast(vu.vendor_id, pipeline_id)


@router.post("/deals", response_model=DealResponse, status_code=status.HTTP_201_CREATED)
async def create_deal(
    data: DealCreate, request: Request,
    vu: VendorUser = Depends(require_permission("crm.deals.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await DealService(db).create(vu.vendor_id, data,
                                         actor_id=vu.user_id, request=request)


@router.get("/deals/{deal_id}", response_model=DealResponse)
async def get_deal(
    deal_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    return await DealService(db).get(vu.vendor_id, deal_id)


@router.put("/deals/{deal_id}", response_model=DealResponse)
async def update_deal(
    deal_id: UUID, data: DealUpdate, request: Request,
    vu: VendorUser = Depends(require_permission("crm.deals.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await DealService(db).update(vu.vendor_id, deal_id, data,
                                         actor_id=vu.user_id, request=request)


@router.post("/deals/{deal_id}/move", response_model=DealResponse)
async def move_deal(
    deal_id: UUID, payload: DealMoveRequest,
    vu: VendorUser = Depends(require_permission("crm.deals.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await DealService(db).move(vu.vendor_id, deal_id, payload, actor_id=vu.user_id)


@router.delete("/deals/{deal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deal(
    deal_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.deals.manage")),
    db: AsyncSession = Depends(get_db),
):
    await DealService(db).delete(vu.vendor_id, deal_id, actor_id=vu.user_id)
    return None


# ── Activities ───────────────────────────────────────────────────────────────

@router.get("/activities", response_model=PaginatedResponse)
async def list_activities(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    owner_id: Optional[UUID] = None,
    status_: Optional[str] = Query(None, alias="status"),
    type_: Optional[str] = Query(None, alias="type"),
    related_type: Optional[str] = None, related_id: Optional[UUID] = None,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    items, total = await ActivityService(db).list(
        vu.vendor_id, page=page, size=size, owner_id=owner_id,
        status=status_, type_=type_,
        related_type=related_type, related_id=related_id,
    )
    items = [ActivityResponse.model_validate(a).model_dump() for a in items]
    return _paginated(items, total, page, size)


@router.post("/activities", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
async def create_activity(
    data: ActivityCreate,
    vu: VendorUser = Depends(require_permission("crm.activities.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await ActivityService(db).create(vu.vendor_id, data, actor_id=vu.user_id)


@router.get("/activities/{activity_id}", response_model=ActivityResponse)
async def get_activity(
    activity_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.view")),
    db: AsyncSession = Depends(get_db),
):
    return await ActivityService(db).get(vu.vendor_id, activity_id)


@router.put("/activities/{activity_id}", response_model=ActivityResponse)
async def update_activity(
    activity_id: UUID, data: ActivityUpdate,
    vu: VendorUser = Depends(require_permission("crm.activities.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await ActivityService(db).update(vu.vendor_id, activity_id, data,
                                             actor_id=vu.user_id)


@router.post("/activities/{activity_id}/complete", response_model=ActivityResponse)
async def complete_activity(
    activity_id: UUID, payload: dict | None = None,
    vu: VendorUser = Depends(require_permission("crm.activities.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await ActivityService(db).complete(
        vu.vendor_id, activity_id,
        outcome=(payload or {}).get("outcome"),
        actor_id=vu.user_id,
    )


@router.delete("/activities/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_activity(
    activity_id: UUID,
    vu: VendorUser = Depends(require_permission("crm.activities.manage")),
    db: AsyncSession = Depends(get_db),
):
    await ActivityService(db).delete(vu.vendor_id, activity_id, actor_id=vu.user_id)
    return None
