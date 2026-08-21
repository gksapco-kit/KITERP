"""
Platform CRM endpoints (KIT ERP admin).

Reuses vendor CRM services against the seeded platform CRM vendor tenant.
Auth: platform staff (superuser / support).
"""
from __future__ import annotations

from math import ceil
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_platform_staff
from app.database import get_db
from app.models.user import User
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
    LeadService, PipelineService, ReportService,
)
from app.services.platform_crm_tenant import get_platform_crm_vendor_id

router = APIRouter()


def _paginated(items, total, page, size):
    return {
        "items": items, "total": total, "page": page, "size": size,
        "pages": ceil(total / size) if total else 0,
    }


async def _vid(db: AsyncSession) -> UUID:
    return await get_platform_crm_vendor_id(db)


# ── Overview ─────────────────────────────────────────────────────────────────

@router.get("/reports/overview")
async def report_overview(
    range: str = Query("30d", pattern="^(30d|3m|6m|1y|2y|5y|10y)$"),
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    return await ReportService(db).overview(await _vid(db), range_key=range)


# ── Accounts ─────────────────────────────────────────────────────────────────

@router.get("/accounts", response_model=PaginatedResponse)
async def list_accounts(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    q: Optional[str] = None, industry: Optional[str] = None,
    region: Optional[str] = None, owner_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    vid = await _vid(db)
    items, total = await AccountService(db).list(
        vid, page=page, size=size, q=q, industry=industry,
        region=region, owner_id=owner_id,
    )
    items = [AccountResponse.model_validate(a).model_dump() for a in items]
    return _paginated(items, total, page, size)


@router.post("/accounts", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    data: AccountCreate, request: Request,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    return await AccountService(db).create(
        await _vid(db), data, actor_id=current_user.id, request=request,
    )


@router.get("/accounts/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: UUID,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    return await AccountService(db).get(await _vid(db), account_id)


@router.put("/accounts/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: UUID, data: AccountUpdate, request: Request,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    return await AccountService(db).update(
        await _vid(db), account_id, data, actor_id=current_user.id, request=request,
    )


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: UUID, request: Request,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    await AccountService(db).delete(
        await _vid(db), account_id, actor_id=current_user.id, request=request,
    )
    return None


# ── Contacts ─────────────────────────────────────────────────────────────────

@router.get("/contacts", response_model=PaginatedResponse)
async def list_contacts(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=200),
    q: Optional[str] = None, account_id: Optional[UUID] = None,
    owner_id: Optional[UUID] = None, stage: Optional[str] = None,
    tag: Optional[str] = None, record_type: Optional[str] = None,
    parent_contact_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    vid = await _vid(db)
    items, total = await ContactService(db).list(
        vid, page=page, size=size, q=q, account_id=account_id,
        owner_id=owner_id, stage=stage, tag=tag, record_type=record_type,
        parent_contact_id=parent_contact_id,
    )
    items = [ContactResponse.model_validate(c).model_dump() for c in items]
    return _paginated(items, total, page, size)


@router.post("/contacts", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(
    data: ContactCreate, request: Request,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    return await ContactService(db).create(
        await _vid(db), data, actor_id=current_user.id, request=request,
    )


@router.get("/contacts/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: UUID,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    return await ContactService(db).get(await _vid(db), contact_id)


@router.put("/contacts/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: UUID, data: ContactUpdate, request: Request,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    return await ContactService(db).update(
        await _vid(db), contact_id, data, actor_id=current_user.id, request=request,
    )


@router.delete("/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: UUID, request: Request,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    await ContactService(db).delete(
        await _vid(db), contact_id, actor_id=current_user.id, request=request,
    )
    return None


# ── Leads ────────────────────────────────────────────────────────────────────

@router.get("/leads", response_model=PaginatedResponse)
async def list_leads(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    q: Optional[str] = None, status_: Optional[str] = Query(None, alias="status"),
    source: Optional[str] = None, assigned_to: Optional[UUID] = None,
    rating: Optional[str] = None,
    deleted: bool = Query(False),
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    vid = await _vid(db)
    items, total = await LeadService(db).list(
        vid, page=page, size=size, q=q, status=status_,
        source=source, assigned_to=assigned_to, rating=rating, deleted=deleted,
    )
    items = [LeadResponse.model_validate(l).model_dump() for l in items]
    return _paginated(items, total, page, size)


@router.post("/leads", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def create_lead(
    data: LeadCreate, request: Request,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    return await LeadService(db).create(
        await _vid(db), data, actor_id=current_user.id, request=request,
    )


@router.get("/leads/{lead_id}", response_model=LeadResponse)
async def get_lead(
    lead_id: UUID,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    return await LeadService(db).get(await _vid(db), lead_id)


@router.put("/leads/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: UUID, data: LeadUpdate, request: Request,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    return await LeadService(db).update(
        await _vid(db), lead_id, data, actor_id=current_user.id, request=request,
    )


@router.delete("/leads/trash")
async def purge_trashed_leads(
    request: Request,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    deleted = await LeadService(db).purge_all_trashed(
        await _vid(db), actor_id=current_user.id, request=request,
    )
    return {"deleted": deleted}


@router.delete("/leads/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(
    lead_id: UUID, request: Request,
    permanent: bool = Query(False),
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    await LeadService(db).delete(
        await _vid(db), lead_id, permanent=permanent,
        actor_id=current_user.id, request=request,
    )
    return None


@router.post("/leads/{lead_id}/restore", response_model=LeadResponse)
async def restore_lead(
    lead_id: UUID, request: Request,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    return await LeadService(db).restore(
        await _vid(db), lead_id, actor_id=current_user.id, request=request,
    )


@router.post("/leads/{lead_id}/assign")
async def assign_lead(
    lead_id: UUID, payload: dict,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")
    obj = await LeadService(db).assign(
        await _vid(db), lead_id, UUID(user_id), actor_id=current_user.id,
    )
    return LeadResponse.model_validate(obj).model_dump()


@router.post("/leads/{lead_id}/convert")
async def convert_lead(
    lead_id: UUID, payload: LeadConvertRequest, request: Request,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    result = await LeadService(db).convert(
        await _vid(db), lead_id, payload, actor_id=current_user.id, request=request,
    )
    out = {"lead": LeadResponse.model_validate(result["lead"]).model_dump()}
    if result.get("contact"):
        out["contact"] = ContactResponse.model_validate(result["contact"]).model_dump()
    if result.get("account"):
        out["account"] = AccountResponse.model_validate(result["account"]).model_dump()
    if result.get("deal"):
        out["deal"] = DealResponse.model_validate(result["deal"]).model_dump()
    return out


# ── Pipelines & Stages ───────────────────────────────────────────────────────

@router.get("/pipelines", response_model=list[PipelineResponse])
async def list_pipelines(
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    items = await PipelineService(db).list(await _vid(db))
    return [PipelineResponse.model_validate(p) for p in items]


@router.post("/pipelines", response_model=PipelineResponse, status_code=status.HTTP_201_CREATED)
async def create_pipeline(
    data: PipelineCreate,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    return await PipelineService(db).create(
        await _vid(db), data, actor_id=current_user.id,
    )


@router.get("/pipelines/{pipeline_id}", response_model=PipelineResponse)
async def get_pipeline(
    pipeline_id: UUID,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    return await PipelineService(db).get(await _vid(db), pipeline_id)


@router.delete("/pipelines/{pipeline_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pipeline(
    pipeline_id: UUID,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    await PipelineService(db).delete(await _vid(db), pipeline_id, actor_id=current_user.id)
    return None


@router.post("/pipelines/{pipeline_id}/stages", response_model=StageResponse,
             status_code=status.HTTP_201_CREATED)
async def add_stage(
    pipeline_id: UUID, data: StageCreate,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    return await PipelineService(db).add_stage(
        await _vid(db), pipeline_id, data, actor_id=current_user.id,
    )


@router.delete("/pipelines/stages/{stage_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_stage(
    stage_id: UUID,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    await PipelineService(db).delete_stage(
        await _vid(db), stage_id, actor_id=current_user.id,
    )
    return None


# ── Deals ────────────────────────────────────────────────────────────────────

@router.get("/deals", response_model=PaginatedResponse)
async def list_deals(
    page: int = Query(1, ge=1), size: int = Query(50, ge=1, le=200),
    q: Optional[str] = None, pipeline_id: Optional[UUID] = None,
    stage_id: Optional[UUID] = None, owner_id: Optional[UUID] = None,
    status_: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    vid = await _vid(db)
    items, total = await DealService(db).list(
        vid, page=page, size=size, q=q, pipeline_id=pipeline_id,
        stage_id=stage_id, owner_id=owner_id, status=status_,
    )
    items = [DealResponse.model_validate(d).model_dump() for d in items]
    return _paginated(items, total, page, size)


@router.get("/deals/kanban")
async def deals_kanban(
    pipeline_id: Optional[UUID] = None,
    status_: str = Query("open", alias="status"),
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    vid = await _vid(db)
    if not pipeline_id:
        pipelines = await PipelineService(db).list(vid)
        if not pipelines:
            raise HTTPException(status_code=400, detail="No pipeline found")
        pipeline_id = pipelines[0].id
    data = await DealService(db).kanban(vid, pipeline_id, status=status_)
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
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    return await DealService(db).forecast(await _vid(db), pipeline_id)


@router.post("/deals", response_model=DealResponse, status_code=status.HTTP_201_CREATED)
async def create_deal(
    data: DealCreate, request: Request,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    return await DealService(db).create(
        await _vid(db), data, actor_id=current_user.id, request=request,
    )


@router.get("/deals/{deal_id}", response_model=DealResponse)
async def get_deal(
    deal_id: UUID,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    return await DealService(db).get(await _vid(db), deal_id)


@router.put("/deals/{deal_id}", response_model=DealResponse)
async def update_deal(
    deal_id: UUID, data: DealUpdate, request: Request,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    return await DealService(db).update(
        await _vid(db), deal_id, data, actor_id=current_user.id, request=request,
    )


@router.post("/deals/{deal_id}/move", response_model=DealResponse)
async def move_deal(
    deal_id: UUID, payload: DealMoveRequest,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    return await DealService(db).move(
        await _vid(db), deal_id, payload, actor_id=current_user.id,
    )


@router.delete("/deals/{deal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deal(
    deal_id: UUID,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    await DealService(db).delete(await _vid(db), deal_id, actor_id=current_user.id)
    return None


# ── Activities ───────────────────────────────────────────────────────────────

@router.get("/activities", response_model=PaginatedResponse)
async def list_activities(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    owner_id: Optional[UUID] = None,
    status_: Optional[str] = Query(None, alias="status"),
    type_: Optional[str] = Query(None, alias="type"),
    related_type: Optional[str] = None, related_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    vid = await _vid(db)
    items, total = await ActivityService(db).list(
        vid, page=page, size=size, owner_id=owner_id,
        status=status_, type_=type_,
        related_type=related_type, related_id=related_id,
    )
    items = [ActivityResponse.model_validate(a).model_dump() for a in items]
    return _paginated(items, total, page, size)


@router.post("/activities", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
async def create_activity(
    data: ActivityCreate,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    return await ActivityService(db).create(
        await _vid(db), data, actor_id=current_user.id,
    )


@router.get("/activities/{activity_id}", response_model=ActivityResponse)
async def get_activity(
    activity_id: UUID,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    return await ActivityService(db).get(await _vid(db), activity_id)


@router.put("/activities/{activity_id}", response_model=ActivityResponse)
async def update_activity(
    activity_id: UUID, data: ActivityUpdate,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    return await ActivityService(db).update(
        await _vid(db), activity_id, data, actor_id=current_user.id,
    )


@router.post("/activities/{activity_id}/complete", response_model=ActivityResponse)
async def complete_activity(
    activity_id: UUID, payload: dict | None = None,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    return await ActivityService(db).complete(
        await _vid(db), activity_id,
        outcome=(payload or {}).get("outcome"),
        actor_id=current_user.id,
    )


@router.delete("/activities/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_activity(
    activity_id: UUID,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    await ActivityService(db).delete(
        await _vid(db), activity_id, actor_id=current_user.id,
    )
    return None


# ── Contact query → lead ─────────────────────────────────────────────────────

@router.post("/contact-queries/{query_id}/convert-to-lead", response_model=LeadResponse,
             status_code=status.HTTP_201_CREATED)
async def convert_contact_query_to_lead(
    query_id: UUID, request: Request,
    current_user: User = Depends(get_current_platform_staff),
    db: AsyncSession = Depends(get_db),
):
    """Create a platform CRM lead from a platform Contact Us query."""
    from sqlalchemy import select
    from app.models.storefront_contact_query import StorefrontContactQuery

    result = await db.execute(
        select(StorefrontContactQuery).where(StorefrontContactQuery.id == query_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Contact query not found")
    if row.vendor_id is not None:
        raise HTTPException(
            status_code=400,
            detail="Only platform Contact Us queries can convert to platform CRM leads",
        )

    custom = dict(row.custom_fields or {}) if hasattr(row, "custom_fields") else {}
    # Prefer notes / message; store link in custom_fields via LeadCreate
    parts = (row.name or "").strip().split(None, 1)
    first = parts[0] if parts else "Contact"
    last = parts[1] if len(parts) > 1 else None

    data = LeadCreate(
        first_name=first,
        last_name=last,
        email=row.email,
        phone=row.phone,
        source="talk_to_us",
        status="new",
        notes=row.message,
        custom_fields={
            "contact_query_id": str(row.id),
            **custom,
        },
        intake_payload={
            "contact_query_id": str(row.id),
            "name": row.name,
            "email": row.email,
            "phone": row.phone,
            "message": row.message,
        },
    )
    return await LeadService(db).create(
        await _vid(db), data, actor_id=current_user.id, request=request,
    )
