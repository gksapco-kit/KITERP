"""
Business logic for the CRM domain. Each service consumes one or more
repositories, emits domain events, writes audit log entries, and orchestrates
side-effects like calling external providers.
"""
from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException, Request, status
from slugify import slugify
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import encrypt_json
from app.core.events import event_emitter
from app.models.crm import (
    CrmAccount, CrmActivity, CrmAuditLog, CrmCampaign, CrmCampaignEnrollment,
    CrmCampaignStep, CrmChatConversation, CrmChatMessage,
    CrmCommunicationLog, CrmContact, CrmDeal, CrmEmailTemplate,
    CrmIntegration, CrmJourneyEvent, CrmKbArticle, CrmLead, CrmLeadIntakeToken,
    CrmPipeline, CrmSegment, CrmSlaPolicy, CrmStage, CrmTicket,
    CrmTicketComment, CrmWorkflow,
)
from app.repositories.crm.repos import (
    AccountRepo, ActivityRepo, AiInsightRepo, AuditLogRepo,
    CampaignEnrollmentRepo, CampaignRepo, ChatConversationRepo, ChatMessageRepo,
    CommunicationRepo, ContactRepo, DealRepo, EmailTemplateRepo,
    IntakeTokenRepo, IntegrationRepo, JourneyEventRepo, KbRepo, LeadRepo,
    PipelineRepo, SegmentRepo, SlaPolicyRepo, StageRepo, SuppressionRepo,
    TicketCommentRepo, TicketRepo, WorkflowRepo, WorkflowRunRepo,
)
from app.services.crm.audit_service import AuditService
from app.services.crm.numbering import next_crm_number

logger = logging.getLogger(__name__)


# ── Helpers ──────────────────────────────────────────────────────────────────

async def get_vendor_id_for_user(db: AsyncSession, user_id: UUID) -> UUID:
    """Resolve vendor_id from a User. Reuses existing VendorService logic."""
    from app.services.vendor_service import VendorService
    vs = VendorService(db)
    vendor = await vs.get_by_user_id(user_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found for current user")
    return vendor.id


def _apply_updates(obj, payload: dict[str, Any]) -> dict[str, Any]:
    before = {}
    for key, value in payload.items():
        if value is None:
            continue
        if hasattr(obj, key):
            before[key] = getattr(obj, key)
            setattr(obj, key, value)
    return before


# ── Account service ──────────────────────────────────────────────────────────

class AccountService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = AccountRepo(db)
        self.audit = AuditService(db)

    async def list(self, vendor_id: UUID, **kwargs):
        return await self.repo.search(vendor_id, **kwargs)

    async def get(self, vendor_id: UUID, account_id: UUID) -> CrmAccount:
        obj = await self.repo.get(vendor_id, account_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Account not found")
        return obj

    async def create(self, vendor_id: UUID, data, *, actor_id: Optional[UUID] = None,
                     request: Optional[Request] = None) -> CrmAccount:
        number = await next_crm_number(self.db, vendor_id, CrmAccount, "ACC")
        obj = CrmAccount(vendor_id=vendor_id, number=number, **data.model_dump(exclude_unset=True))
        self.db.add(obj)
        await self.db.commit()
        await self.db.refresh(obj)
        await self.audit.log(
            vendor_id=vendor_id, entity="crm_account", entity_id=obj.id,
            action="create", actor_id=actor_id, after=obj, request=request,
            commit=True,
        )
        return obj

    async def update(self, vendor_id: UUID, account_id: UUID, data, *,
                     actor_id: Optional[UUID] = None,
                     request: Optional[Request] = None) -> CrmAccount:
        obj = await self.get(vendor_id, account_id)
        before = _apply_updates(obj, data.model_dump(exclude_unset=True))
        await self.db.commit()
        await self.db.refresh(obj)
        await self.audit.log(
            vendor_id=vendor_id, entity="crm_account", entity_id=obj.id,
            action="update", actor_id=actor_id, before=before, after=obj,
            request=request, commit=True,
        )
        return obj

    async def delete(self, vendor_id: UUID, account_id: UUID, *,
                     actor_id: Optional[UUID] = None,
                     request: Optional[Request] = None) -> None:
        obj = await self.get(vendor_id, account_id)
        await self.audit.log(
            vendor_id=vendor_id, entity="crm_account", entity_id=obj.id,
            action="delete", actor_id=actor_id, before=obj, request=request,
        )
        await self.db.delete(obj)
        await self.db.commit()


# ── Contact service ──────────────────────────────────────────────────────────

class ContactService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ContactRepo(db)
        self.account_repo = AccountRepo(db)
        self.audit = AuditService(db)

    async def list(self, vendor_id: UUID, **kwargs):
        return await self.repo.search(vendor_id, **kwargs)

    async def get(self, vendor_id: UUID, contact_id: UUID) -> CrmContact:
        obj = await self.repo.get(vendor_id, contact_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Contact not found")
        return obj

    async def _sync_company_account(self, vendor_id: UUID, contact: CrmContact) -> None:
        if contact.record_type != "company":
            return
        payload = {
            "name": contact.first_name,
            "industry": contact.industry,
            "region": contact.region,
            "website": contact.website,
            "phone": contact.phone,
            "email": contact.email,
            "annual_revenue": contact.annual_revenue,
            "employee_count": contact.employee_count,
            "tags": contact.tags,
            "notes": contact.notes,
            "owner_id": contact.owner_id,
            "is_active": contact.is_active,
        }
        if contact.linked_account_id:
            acc = await self.account_repo.get(vendor_id, contact.linked_account_id)
            if acc:
                _apply_updates(acc, payload)
                if contact.number and not acc.number:
                    acc.number = contact.number
        else:
            number = contact.number or await next_crm_number(self.db, vendor_id, CrmAccount, "ACC")
            acc = CrmAccount(vendor_id=vendor_id, number=number, **payload)
            self.db.add(acc)
            await self.db.flush()
            contact.linked_account_id = acc.id
            if not contact.number:
                contact.number = number

    async def _link_person_to_company(self, vendor_id: UUID, contact: CrmContact) -> None:
        if contact.record_type != "person" or not contact.parent_contact_id:
            return
        parent = await self.repo.get(vendor_id, contact.parent_contact_id)
        if not parent or parent.record_type != "company":
            return
        if parent.linked_account_id:
            contact.account_id = parent.linked_account_id

    async def create(self, vendor_id: UUID, data, *, actor_id: Optional[UUID] = None,
                     request: Optional[Request] = None) -> CrmContact:
        payload = data.model_dump(exclude_unset=True)
        record_type = payload.get("record_type") or "person"
        payload["record_type"] = record_type
        if record_type == "company" and not payload.get("number"):
            payload["number"] = await next_crm_number(self.db, vendor_id, CrmContact, "ACC")
        obj = CrmContact(vendor_id=vendor_id, **payload)
        self.db.add(obj)
        await self.db.flush()
        if record_type == "company":
            await self._sync_company_account(vendor_id, obj)
        else:
            await self._link_person_to_company(vendor_id, obj)
        await self.db.commit()
        await self.db.refresh(obj)
        await self.audit.log(
            vendor_id=vendor_id, entity="crm_contact", entity_id=obj.id,
            action="create", actor_id=actor_id, after=obj, request=request,
            commit=True,
        )
        return obj

    async def update(self, vendor_id: UUID, contact_id: UUID, data, *,
                     actor_id: Optional[UUID] = None,
                     request: Optional[Request] = None) -> CrmContact:
        obj = await self.get(vendor_id, contact_id)
        before = _apply_updates(obj, data.model_dump(exclude_unset=True))
        if obj.record_type == "company":
            await self._sync_company_account(vendor_id, obj)
        else:
            await self._link_person_to_company(vendor_id, obj)
        await self.db.commit()
        await self.db.refresh(obj)
        await self.audit.log(
            vendor_id=vendor_id, entity="crm_contact", entity_id=obj.id,
            action="update", actor_id=actor_id, before=before, after=obj,
            request=request, commit=True,
        )
        return obj

    async def delete(self, vendor_id: UUID, contact_id: UUID, *,
                     actor_id: Optional[UUID] = None,
                     request: Optional[Request] = None) -> None:
        obj = await self.get(vendor_id, contact_id)
        await self.audit.log(
            vendor_id=vendor_id, entity="crm_contact", entity_id=obj.id,
            action="delete", actor_id=actor_id, before=obj, request=request,
        )
        await self.db.delete(obj)
        await self.db.commit()


# ── Lead service ─────────────────────────────────────────────────────────────

class LeadService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = LeadRepo(db)
        self.audit = AuditService(db)

    async def list(self, vendor_id: UUID, **kwargs):
        return await self.repo.search(vendor_id, **kwargs)

    async def get(self, vendor_id: UUID, lead_id: UUID) -> CrmLead:
        obj = await self.repo.get(vendor_id, lead_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Lead not found")
        return obj

    async def create(self, vendor_id: UUID, data, *, actor_id: Optional[UUID] = None,
                     request: Optional[Request] = None) -> CrmLead:
        number = await next_crm_number(self.db, vendor_id, CrmLead, "LED")
        obj = CrmLead(vendor_id=vendor_id, number=number, **data.model_dump(exclude_unset=True))
        self.db.add(obj)
        await self.db.commit()
        await self.db.refresh(obj)
        await self._auto_score(obj)
        await self.audit.log(
            vendor_id=vendor_id, entity="crm_lead", entity_id=obj.id,
            action="create", actor_id=actor_id, after=obj, request=request,
            commit=True,
        )
        await event_emitter.emit("crm.lead.created", {
            "vendor_id": str(vendor_id), "lead_id": str(obj.id),
        })
        return obj

    async def _auto_score(self, lead: CrmLead) -> None:
        """Background lead scoring (best-effort)."""
        try:
            from app.tasks.crm.ai_jobs import score_lead_now
            from app.tasks.crm.runner import schedule

            schedule(
                "crm.ai.score_lead",
                lambda _session: _async_run(score_lead_now, lead.id),
            )
        except Exception as e:
            logger.debug("lead scoring skipped: %s", e)

    async def update(self, vendor_id: UUID, lead_id: UUID, data, *,
                     actor_id: Optional[UUID] = None,
                     request: Optional[Request] = None) -> CrmLead:
        obj = await self.get(vendor_id, lead_id)
        before = _apply_updates(obj, data.model_dump(exclude_unset=True))
        await self.db.commit()
        await self.db.refresh(obj)
        await self.audit.log(
            vendor_id=vendor_id, entity="crm_lead", entity_id=obj.id,
            action="update", actor_id=actor_id, before=before, after=obj,
            request=request, commit=True,
        )
        return obj

    async def delete(self, vendor_id: UUID, lead_id: UUID, *,
                     actor_id: Optional[UUID] = None,
                     request: Optional[Request] = None) -> None:
        obj = await self.get(vendor_id, lead_id)
        await self.audit.log(
            vendor_id=vendor_id, entity="crm_lead", entity_id=obj.id,
            action="delete", actor_id=actor_id, before=obj, request=request,
        )
        await self.db.delete(obj)
        await self.db.commit()

    async def assign(self, vendor_id: UUID, lead_id: UUID, user_id: UUID, *,
                     actor_id: Optional[UUID] = None) -> CrmLead:
        obj = await self.get(vendor_id, lead_id)
        before = {"assigned_to": obj.assigned_to}
        obj.assigned_to = user_id
        await self.db.commit()
        await self.db.refresh(obj)
        await self.audit.log(
            vendor_id=vendor_id, entity="crm_lead", entity_id=obj.id,
            action="assign", actor_id=actor_id, before=before,
            after={"assigned_to": user_id}, commit=True,
        )
        return obj

    async def convert(self, vendor_id: UUID, lead_id: UUID, payload, *,
                      actor_id: Optional[UUID] = None,
                      request: Optional[Request] = None) -> dict:
        lead = await self.get(vendor_id, lead_id)
        if lead.converted_at:
            raise HTTPException(status_code=409, detail="Lead already converted")

        contact = None
        account = None
        deal = None

        if payload.account_id:
            account = await AccountRepo(self.db).get(vendor_id, payload.account_id)
        elif lead.company:
            account = CrmAccount(
                vendor_id=vendor_id,
                number=await next_crm_number(self.db, vendor_id, CrmAccount, "ACC"),
                name=lead.company,
                owner_id=lead.assigned_to,
            )
            self.db.add(account)
            await self.db.flush()

        if payload.contact_id:
            contact = await ContactRepo(self.db).get(vendor_id, payload.contact_id)
        else:
            contact = CrmContact(
                vendor_id=vendor_id,
                first_name=lead.first_name or "Lead",
                last_name=lead.last_name,
                email=lead.email,
                phone=lead.phone,
                title=lead.title,
                lifecycle_stage="customer",
                lead_source=lead.source,
                account_id=account.id if account else None,
                owner_id=lead.assigned_to,
            )
            self.db.add(contact)
            await self.db.flush()

        if payload.create_deal:
            pipeline_id = payload.pipeline_id
            stage_id = payload.stage_id
            if not pipeline_id or not stage_id:
                pipeline = await PipelineRepo(self.db).get_default(vendor_id)
                if not pipeline:
                    pipeline = await PipelineService(self.db).ensure_default(vendor_id)
                pipeline_id = pipeline.id
                stage_id = pipeline.stages[0].id if pipeline.stages else None
            if not stage_id:
                raise HTTPException(status_code=400, detail="No pipeline stage available")
            deal = CrmDeal(
                vendor_id=vendor_id,
                number=await next_crm_number(self.db, vendor_id, CrmDeal, "DEAL"),
                pipeline_id=pipeline_id,
                stage_id=stage_id,
                title=payload.deal_title or (lead.company or f"{lead.first_name or 'Lead'} opportunity"),
                amount=payload.deal_amount or Decimal(0),
                account_id=account.id if account else None,
                contact_id=contact.id if contact else None,
                owner_id=lead.assigned_to,
                source=lead.source,
            )
            self.db.add(deal)
            await self.db.flush()

        lead.status = "converted"
        lead.converted_at = datetime.now(timezone.utc)
        lead.converted_account_id = account.id if account else None
        lead.converted_contact_id = contact.id if contact else None
        lead.converted_deal_id = deal.id if deal else None

        await self.db.commit()
        await self.db.refresh(lead)

        await self.audit.log(
            vendor_id=vendor_id, entity="crm_lead", entity_id=lead.id,
            action="convert", actor_id=actor_id,
            after={
                "account_id": str(account.id) if account else None,
                "contact_id": str(contact.id) if contact else None,
                "deal_id": str(deal.id) if deal else None,
            },
            request=request, commit=True,
        )
        await event_emitter.emit("crm.lead.converted", {
            "vendor_id": str(vendor_id), "lead_id": str(lead.id),
            "deal_id": str(deal.id) if deal else None,
        })
        return {
            "lead": lead, "account": account, "contact": contact, "deal": deal,
        }


def _async_run(fn, *args, **kwargs):
    """Wrap a sync function so it can be passed to schedule()."""
    async def _coro(_):
        try:
            fn(*args, **kwargs)
        except Exception as e:
            logger.warning("background task failed: %s", e)
    return _coro(None)


# ── Pipeline / Deal ──────────────────────────────────────────────────────────

class PipelineService:
    DEFAULT_STAGES = [
        ("Prospect", 10, "#94a3b8"),
        ("Qualified", 25, "#60a5fa"),
        ("Proposal", 50, "#a78bfa"),
        ("Negotiation", 70, "#f59e0b"),
        ("Closed Won", 100, "#22c55e"),
        ("Closed Lost", 0, "#ef4444"),
    ]

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = PipelineRepo(db)
        self.stage_repo = StageRepo(db)
        self.audit = AuditService(db)

    async def list(self, vendor_id: UUID):
        items = await self.repo.list_with_stages(vendor_id)
        if not items:
            await self.ensure_default(vendor_id)
            items = await self.repo.list_with_stages(vendor_id)
        return items

    async def get(self, vendor_id: UUID, pipeline_id: UUID):
        obj = await self.repo.with_stages(vendor_id, pipeline_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Pipeline not found")
        return obj

    async def ensure_default(self, vendor_id: UUID) -> CrmPipeline:
        existing = await self.repo.get_default(vendor_id)
        if existing:
            return existing
        pipeline = CrmPipeline(
            vendor_id=vendor_id, name="Sales Pipeline",
            description="Default sales pipeline", is_default=True, sort_order=0,
        )
        self.db.add(pipeline)
        await self.db.flush()
        for idx, (name, prob, color) in enumerate(self.DEFAULT_STAGES):
            self.db.add(CrmStage(
                pipeline_id=pipeline.id, vendor_id=vendor_id,
                name=name, probability=Decimal(prob), sort_order=idx,
                is_won=(name == "Closed Won"), is_lost=(name == "Closed Lost"),
                color=color,
            ))
        await self.db.commit()
        return await self.repo.with_stages(vendor_id, pipeline.id)

    async def create(self, vendor_id: UUID, data, *, actor_id: Optional[UUID] = None):
        pipeline = CrmPipeline(
            vendor_id=vendor_id, name=data.name, description=data.description,
            is_default=data.is_default, is_active=data.is_active,
            sort_order=data.sort_order,
        )
        self.db.add(pipeline)
        await self.db.flush()
        stages_payload = data.stages or [
            type("S", (), {
                "name": s[0], "probability": Decimal(s[1]),
                "sort_order": idx, "is_won": s[0] == "Closed Won",
                "is_lost": s[0] == "Closed Lost", "color": s[2],
            })()
            for idx, s in enumerate(self.DEFAULT_STAGES)
        ]
        for idx, st in enumerate(stages_payload):
            self.db.add(CrmStage(
                pipeline_id=pipeline.id, vendor_id=vendor_id,
                name=st.name,
                probability=Decimal(st.probability) if st.probability is not None else Decimal(0),
                sort_order=getattr(st, "sort_order", idx),
                is_won=getattr(st, "is_won", False),
                is_lost=getattr(st, "is_lost", False),
                color=getattr(st, "color", None),
            ))
        await self.db.commit()
        await self.audit.log(
            vendor_id=vendor_id, entity="crm_pipeline", entity_id=pipeline.id,
            action="create", actor_id=actor_id, after=pipeline, commit=True,
        )
        return await self.repo.with_stages(vendor_id, pipeline.id)

    async def add_stage(self, vendor_id: UUID, pipeline_id: UUID, data,
                        *, actor_id: Optional[UUID] = None) -> CrmStage:
        pipeline = await self.get(vendor_id, pipeline_id)
        stage = CrmStage(
            pipeline_id=pipeline.id, vendor_id=vendor_id,
            name=data.name, probability=data.probability,
            sort_order=data.sort_order, is_won=data.is_won, is_lost=data.is_lost,
            color=data.color,
        )
        self.db.add(stage)
        await self.db.commit()
        await self.audit.log(
            vendor_id=vendor_id, entity="crm_stage", entity_id=stage.id,
            action="create", actor_id=actor_id, after=stage, commit=True,
        )
        return stage

    async def delete_stage(self, vendor_id: UUID, stage_id: UUID,
                           *, actor_id: Optional[UUID] = None) -> None:
        stage = await self.stage_repo.get(vendor_id, stage_id)
        if not stage:
            raise HTTPException(status_code=404, detail="Stage not found")
        await self.audit.log(
            vendor_id=vendor_id, entity="crm_stage", entity_id=stage.id,
            action="delete", actor_id=actor_id, before=stage,
        )
        await self.db.delete(stage)
        await self.db.commit()

    async def delete(self, vendor_id: UUID, pipeline_id: UUID,
                     *, actor_id: Optional[UUID] = None) -> None:
        pipeline = await self.get(vendor_id, pipeline_id)
        await self.audit.log(
            vendor_id=vendor_id, entity="crm_pipeline", entity_id=pipeline.id,
            action="delete", actor_id=actor_id, before=pipeline,
        )
        await self.db.delete(pipeline)
        await self.db.commit()


class DealService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = DealRepo(db)
        self.audit = AuditService(db)

    async def list(self, vendor_id: UUID, **kwargs):
        return await self.repo.search(vendor_id, **kwargs)

    async def kanban(self, vendor_id: UUID, pipeline_id: UUID, status: str = "open"):
        pipeline = await PipelineService(self.db).get(vendor_id, pipeline_id)
        deals = await self.repo.by_pipeline(vendor_id, pipeline_id, status=status)
        by_stage: dict[str, list] = {str(s.id): [] for s in pipeline.stages}
        for d in deals:
            by_stage.setdefault(str(d.stage_id), []).append(d)
        return {
            "pipeline": pipeline,
            "columns": [
                {"stage": s, "deals": by_stage.get(str(s.id), [])}
                for s in pipeline.stages
            ],
        }

    async def get(self, vendor_id: UUID, deal_id: UUID) -> CrmDeal:
        obj = await self.repo.get(vendor_id, deal_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Deal not found")
        return obj

    async def create(self, vendor_id: UUID, data, *, actor_id: Optional[UUID] = None,
                     request: Optional[Request] = None) -> CrmDeal:
        number = await next_crm_number(self.db, vendor_id, CrmDeal, "DEAL")
        obj = CrmDeal(vendor_id=vendor_id, number=number, **data.model_dump(exclude_unset=True))
        self.db.add(obj)
        await self.db.commit()
        await self.db.refresh(obj)
        await self.audit.log(
            vendor_id=vendor_id, entity="crm_deal", entity_id=obj.id,
            action="create", actor_id=actor_id, after=obj, request=request, commit=True,
        )
        await event_emitter.emit("crm.deal.created", {"vendor_id": str(vendor_id), "deal_id": str(obj.id)})
        return obj

    async def update(self, vendor_id: UUID, deal_id: UUID, data, *,
                     actor_id: Optional[UUID] = None,
                     request: Optional[Request] = None) -> CrmDeal:
        obj = await self.get(vendor_id, deal_id)
        before_stage = obj.stage_id
        before = _apply_updates(obj, data.model_dump(exclude_unset=True))
        if obj.status == "won" and not obj.closed_at:
            obj.closed_at = datetime.now(timezone.utc)
        if obj.status == "lost" and not obj.closed_at:
            obj.closed_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(obj)
        await self.audit.log(
            vendor_id=vendor_id, entity="crm_deal", entity_id=obj.id,
            action="update", actor_id=actor_id, before=before, after=obj,
            request=request, commit=True,
        )
        if before_stage != obj.stage_id:
            await event_emitter.emit("crm.deal.stage_changed", {
                "vendor_id": str(vendor_id), "deal_id": str(obj.id),
                "from_stage": str(before_stage), "to_stage": str(obj.stage_id),
            })
        return obj

    async def move(self, vendor_id: UUID, deal_id: UUID, payload, *,
                   actor_id: Optional[UUID] = None) -> CrmDeal:
        obj = await self.get(vendor_id, deal_id)
        before = {"stage_id": obj.stage_id, "sort_order": obj.sort_order}
        obj.stage_id = payload.stage_id
        if payload.sort_order is not None:
            obj.sort_order = payload.sort_order
        # Detect won/lost stages
        stage = await StageRepo(self.db).get(vendor_id, payload.stage_id)
        if stage:
            if stage.is_won:
                obj.status = "won"
                obj.closed_at = datetime.now(timezone.utc)
            elif stage.is_lost:
                obj.status = "lost"
                obj.closed_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(obj)
        await self.audit.log(
            vendor_id=vendor_id, entity="crm_deal", entity_id=obj.id,
            action="stage_change", actor_id=actor_id, before=before,
            after={"stage_id": obj.stage_id}, commit=True,
        )
        await event_emitter.emit("crm.deal.stage_changed", {
            "vendor_id": str(vendor_id), "deal_id": str(obj.id),
            "from_stage": str(before["stage_id"]), "to_stage": str(obj.stage_id),
        })
        return obj

    async def delete(self, vendor_id: UUID, deal_id: UUID, *,
                     actor_id: Optional[UUID] = None) -> None:
        obj = await self.get(vendor_id, deal_id)
        await self.audit.log(
            vendor_id=vendor_id, entity="crm_deal", entity_id=obj.id,
            action="delete", actor_id=actor_id, before=obj,
        )
        await self.db.delete(obj)
        await self.db.commit()

    async def forecast(self, vendor_id: UUID, pipeline_id: Optional[UUID] = None) -> dict:
        return await self.repo.forecast(vendor_id, pipeline_id)


# ── Activity ─────────────────────────────────────────────────────────────────

class ActivityService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ActivityRepo(db)
        self.audit = AuditService(db)

    async def list(self, vendor_id: UUID, **kwargs):
        return await self.repo.search(vendor_id, **kwargs)

    async def get(self, vendor_id: UUID, activity_id: UUID) -> CrmActivity:
        obj = await self.repo.get(vendor_id, activity_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Activity not found")
        return obj

    async def create(self, vendor_id: UUID, data, *, actor_id: Optional[UUID] = None) -> CrmActivity:
        payload = data.model_dump(exclude_unset=True)
        if "owner_id" not in payload or payload["owner_id"] is None:
            payload["owner_id"] = actor_id
        number = await next_crm_number(self.db, vendor_id, CrmActivity, "TSK")
        obj = CrmActivity(vendor_id=vendor_id, number=number, **payload)
        self.db.add(obj)
        await self.db.commit()
        await self.db.refresh(obj)
        await self.audit.log(
            vendor_id=vendor_id, entity="crm_activity", entity_id=obj.id,
            action="create", actor_id=actor_id, after=obj, commit=True,
        )
        await event_emitter.emit("crm.activity.created", {
            "vendor_id": str(vendor_id), "activity_id": str(obj.id),
        })
        return obj

    async def update(self, vendor_id: UUID, activity_id: UUID, data, *,
                     actor_id: Optional[UUID] = None) -> CrmActivity:
        obj = await self.get(vendor_id, activity_id)
        before = _apply_updates(obj, data.model_dump(exclude_unset=True))
        if obj.status == "completed" and not obj.completed_at:
            obj.completed_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(obj)
        await self.audit.log(
            vendor_id=vendor_id, entity="crm_activity", entity_id=obj.id,
            action="update", actor_id=actor_id, before=before, after=obj, commit=True,
        )
        return obj

    async def complete(self, vendor_id: UUID, activity_id: UUID, *,
                       outcome: Optional[str] = None,
                       actor_id: Optional[UUID] = None) -> CrmActivity:
        obj = await self.get(vendor_id, activity_id)
        obj.status = "completed"
        obj.completed_at = datetime.now(timezone.utc)
        if outcome:
            obj.outcome = outcome
        await self.db.commit()
        await self.db.refresh(obj)
        await self.audit.log(
            vendor_id=vendor_id, entity="crm_activity", entity_id=obj.id,
            action="complete", actor_id=actor_id, after=obj, commit=True,
        )
        return obj

    async def delete(self, vendor_id: UUID, activity_id: UUID, *,
                     actor_id: Optional[UUID] = None) -> None:
        obj = await self.get(vendor_id, activity_id)
        await self.db.delete(obj)
        await self.db.commit()


# ── Communications ───────────────────────────────────────────────────────────

class CommunicationService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = CommunicationRepo(db)

    async def list(self, vendor_id: UUID, **kwargs):
        return await self.repo.list(vendor_id, **kwargs)

    async def for_entity(self, vendor_id: UUID, entity_type: str, entity_id: UUID, **kw):
        return await self.repo.for_entity(vendor_id, entity_type, entity_id, **kw)

    async def log(self, vendor_id: UUID, data, *, recorded_by: Optional[UUID] = None) -> CrmCommunicationLog:
        obj = CrmCommunicationLog(
            vendor_id=vendor_id,
            recorded_by=recorded_by,
            **data.model_dump(exclude_unset=True, exclude={"metadata"}),
        )
        if data.metadata is not None:
            obj.metadata_json = data.metadata
        self.db.add(obj)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def send_email(self, vendor_id: UUID, payload, *,
                         recorded_by: Optional[UUID] = None) -> dict:
        from app.tasks.crm.send_email import send_email_now
        result = send_email_now(
            vendor_id=vendor_id,
            contact_id=payload.contact_id,
            subject=payload.subject,
            body_html=payload.body_html,
            body_text=payload.body_text,
        )
        return result

    async def send_sms(self, vendor_id: UUID, payload, *,
                       recorded_by: Optional[UUID] = None) -> dict:
        from app.tasks.crm.send_sms import send_sms_now
        return send_sms_now(
            vendor_id=vendor_id, contact_id=payload.contact_id,
            body=payload.body, to_phone=payload.to_phone,
        )

    async def send_whatsapp(self, vendor_id: UUID, payload, *,
                            recorded_by: Optional[UUID] = None) -> dict:
        from app.tasks.crm.send_whatsapp import send_whatsapp_now
        return send_whatsapp_now(
            vendor_id=vendor_id, contact_id=payload.contact_id,
            body=payload.body, to_phone=payload.to_phone,
        )

    async def click_to_call(self, vendor_id: UUID, payload, *,
                            recorded_by: Optional[UUID] = None) -> dict:
        from app.integrations.registry import IntegrationRegistry
        registry = IntegrationRegistry(self.db)
        adapter = await registry.get_voice_adapter(vendor_id)
        if not adapter:
            raise HTTPException(status_code=400, detail="Voice adapter not configured")
        target = payload.to_phone
        if not target and payload.contact_id:
            row = await self.db.execute(select(CrmContact).where(CrmContact.id == payload.contact_id))
            contact = row.scalar_one_or_none()
            if contact:
                target = contact.mobile or contact.phone
        if not target:
            raise HTTPException(status_code=400, detail="Missing phone number")
        result = await adapter.call(to=target, twiml_url=payload.twiml_url)
        log = CrmCommunicationLog(
            vendor_id=vendor_id, channel="call", direction="outbound",
            related_type="contact" if payload.contact_id else None,
            related_id=payload.contact_id,
            contact_id=payload.contact_id,
            external_id=result.get("id"), provider=result.get("provider", "voice"),
            status="initiated" if result.get("ok") else "failed",
            metadata_json={"to": target, "error": result.get("error")},
            recorded_by=recorded_by,
        )
        self.db.add(log)
        await self.db.commit()
        return result


# ── Tickets / KB ─────────────────────────────────────────────────────────────

class TicketService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = TicketRepo(db)
        self.comments = TicketCommentRepo(db)
        self.audit = AuditService(db)

    async def list(self, vendor_id: UUID, **kwargs):
        return await self.repo.search(vendor_id, **kwargs)

    async def get(self, vendor_id: UUID, ticket_id: UUID) -> CrmTicket:
        obj = await self.repo.get(vendor_id, ticket_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Ticket not found")
        return obj

    async def create(self, vendor_id: UUID, data, *,
                     actor_id: Optional[UUID] = None) -> CrmTicket:
        number = await self.repo.next_ticket_number(vendor_id)
        obj = CrmTicket(vendor_id=vendor_id, number=number,
                        **data.model_dump(exclude_unset=True))
        self.db.add(obj)
        await self.db.commit()
        await self.db.refresh(obj)
        await self.audit.log(
            vendor_id=vendor_id, entity="crm_ticket", entity_id=obj.id,
            action="create", actor_id=actor_id, after=obj, commit=True,
        )
        await event_emitter.emit("crm.ticket.created", {
            "vendor_id": str(vendor_id), "ticket_id": str(obj.id),
        })
        return obj

    async def update(self, vendor_id: UUID, ticket_id: UUID, data, *,
                     actor_id: Optional[UUID] = None) -> CrmTicket:
        obj = await self.get(vendor_id, ticket_id)
        before = _apply_updates(obj, data.model_dump(exclude_unset=True))
        now = datetime.now(timezone.utc)
        if obj.status in ("resolved", "closed") and not obj.resolved_at:
            obj.resolved_at = now
        if obj.status == "closed" and not obj.closed_at:
            obj.closed_at = now
        await self.db.commit()
        await self.db.refresh(obj)
        await self.audit.log(
            vendor_id=vendor_id, entity="crm_ticket", entity_id=obj.id,
            action="update", actor_id=actor_id, before=before, after=obj, commit=True,
        )
        return obj

    async def add_comment(self, vendor_id: UUID, ticket_id: UUID, payload,
                          *, actor_id: Optional[UUID] = None,
                          contact_id: Optional[UUID] = None) -> CrmTicketComment:
        ticket = await self.get(vendor_id, ticket_id)
        comment = CrmTicketComment(
            vendor_id=vendor_id, ticket_id=ticket.id,
            author_id=actor_id, contact_id=contact_id,
            body=payload.body, is_internal=payload.is_internal,
            attachments=payload.attachments or [],
        )
        self.db.add(comment)
        if not ticket.first_response_at and not payload.is_internal:
            ticket.first_response_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(comment)
        return comment

    async def list_comments(self, vendor_id: UUID, ticket_id: UUID):
        return await self.comments.for_ticket(vendor_id, ticket_id)


class SlaPolicyService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = SlaPolicyRepo(db)

    async def list(self, vendor_id: UUID):
        items, _ = await self.repo.list(vendor_id, page=1, size=100)
        return items

    async def create(self, vendor_id: UUID, data) -> CrmSlaPolicy:
        obj = CrmSlaPolicy(vendor_id=vendor_id, **data.model_dump(exclude_unset=True))
        self.db.add(obj)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def delete(self, vendor_id: UUID, policy_id: UUID) -> None:
        obj = await self.repo.get(vendor_id, policy_id)
        if obj:
            await self.db.delete(obj)
            await self.db.commit()


class KbService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = KbRepo(db)
        self.audit = AuditService(db)

    async def list(self, vendor_id: UUID, **kwargs):
        return await self.repo.search(vendor_id, **kwargs)

    async def get(self, vendor_id: UUID, article_id: UUID) -> CrmKbArticle:
        obj = await self.repo.get(vendor_id, article_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Article not found")
        return obj

    async def create(self, vendor_id: UUID, data, *,
                     actor_id: Optional[UUID] = None) -> CrmKbArticle:
        slug = data.slug or slugify(data.title)
        obj = CrmKbArticle(
            vendor_id=vendor_id, author_id=actor_id,
            **{**data.model_dump(exclude_unset=True), "slug": slug},
        )
        self.db.add(obj)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def update(self, vendor_id: UUID, article_id: UUID, data, *,
                     actor_id: Optional[UUID] = None) -> CrmKbArticle:
        obj = await self.get(vendor_id, article_id)
        _apply_updates(obj, data.model_dump(exclude_unset=True))
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def delete(self, vendor_id: UUID, article_id: UUID) -> None:
        obj = await self.get(vendor_id, article_id)
        await self.db.delete(obj)
        await self.db.commit()


# ── Marketing ────────────────────────────────────────────────────────────────

class SegmentService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = SegmentRepo(db)

    async def list(self, vendor_id: UUID):
        items, _ = await self.repo.list(vendor_id, page=1, size=100)
        return items

    async def get(self, vendor_id: UUID, segment_id: UUID) -> CrmSegment:
        obj = await self.repo.get(vendor_id, segment_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Segment not found")
        return obj

    async def create(self, vendor_id: UUID, data) -> CrmSegment:
        obj = CrmSegment(vendor_id=vendor_id, **data.model_dump(exclude_unset=True))
        self.db.add(obj)
        await self.db.commit()
        await self.db.refresh(obj)
        await self.refresh_count(vendor_id, obj.id)
        return obj

    async def update(self, vendor_id: UUID, segment_id: UUID, data) -> CrmSegment:
        obj = await self.get(vendor_id, segment_id)
        _apply_updates(obj, data.model_dump(exclude_unset=True))
        await self.db.commit()
        await self.db.refresh(obj)
        await self.refresh_count(vendor_id, obj.id)
        return obj

    async def delete(self, vendor_id: UUID, segment_id: UUID) -> None:
        obj = await self.get(vendor_id, segment_id)
        await self.db.delete(obj)
        await self.db.commit()

    async def refresh_count(self, vendor_id: UUID, segment_id: UUID) -> int:
        from sqlalchemy import func as sa_func
        seg = await self.get(vendor_id, segment_id)
        ids = await self._matching_contact_ids(vendor_id, seg)
        seg.contact_count = len(ids)
        seg.last_computed_at = datetime.now(timezone.utc)
        await self.db.commit()
        return seg.contact_count

    async def _matching_contact_ids(self, vendor_id: UUID, segment: CrmSegment) -> list[UUID]:
        """Evaluate the JSON DSL against contacts. The DSL supports:

            {"all": [{"field": "tags", "op": "contains", "value": "vip"}, ...]}
            {"any": [...]}
        """
        from sqlalchemy import and_ as sa_and, or_ as sa_or
        rules = segment.filter_dsl or {}
        groups = rules.get("all") or []
        any_groups = rules.get("any") or []

        def to_clause(rule: dict):
            field = rule.get("field")
            op = rule.get("op", "eq")
            value = rule.get("value")
            col = getattr(CrmContact, field, None)
            if col is None:
                return None
            if op == "eq":
                return col == value
            if op == "neq":
                return col != value
            if op == "contains" and field == "tags":
                return CrmContact.tags.contains([value])
            if op == "ilike" and value is not None:
                return col.ilike(f"%{value}%")
            if op == "gte":
                return col >= value
            if op == "lte":
                return col <= value
            return None

        clauses_all = [c for c in (to_clause(r) for r in groups) if c is not None]
        clauses_any = [c for c in (to_clause(r) for r in any_groups) if c is not None]

        where = [CrmContact.vendor_id == vendor_id]
        if clauses_all:
            where.append(sa_and(*clauses_all))
        if clauses_any:
            where.append(sa_or(*clauses_any))

        rows = await self.db.execute(select(CrmContact.id).where(*where))
        return [r[0] for r in rows.all()]

    async def preview(self, vendor_id: UUID, segment_id: UUID, limit: int = 25):
        seg = await self.get(vendor_id, segment_id)
        ids = await self._matching_contact_ids(vendor_id, seg)
        if not ids:
            return []
        rows = await self.db.execute(
            select(CrmContact).where(CrmContact.id.in_(ids[:limit]))
        )
        return list(rows.scalars().all())


class EmailTemplateService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = EmailTemplateRepo(db)

    async def list(self, vendor_id: UUID):
        items, _ = await self.repo.list(vendor_id, page=1, size=200)
        return items

    async def get(self, vendor_id: UUID, template_id: UUID) -> CrmEmailTemplate:
        obj = await self.repo.get(vendor_id, template_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Template not found")
        return obj

    async def create(self, vendor_id: UUID, data) -> CrmEmailTemplate:
        obj = CrmEmailTemplate(vendor_id=vendor_id, **data.model_dump(exclude_unset=True))
        self.db.add(obj)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def update(self, vendor_id: UUID, template_id: UUID, data) -> CrmEmailTemplate:
        obj = await self.get(vendor_id, template_id)
        _apply_updates(obj, data.model_dump(exclude_unset=True))
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def delete(self, vendor_id: UUID, template_id: UUID) -> None:
        obj = await self.get(vendor_id, template_id)
        await self.db.delete(obj)
        await self.db.commit()


class CampaignService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = CampaignRepo(db)
        self.enrollment_repo = CampaignEnrollmentRepo(db)
        self.audit = AuditService(db)

    async def list(self, vendor_id: UUID, **kwargs):
        items, total = await self.repo.list(vendor_id, page=kwargs.get("page", 1),
                                            size=kwargs.get("size", 20))
        return items, total

    async def get(self, vendor_id: UUID, campaign_id: UUID):
        result = await self.repo.with_steps(vendor_id, campaign_id)
        if not result:
            raise HTTPException(status_code=404, detail="Campaign not found")
        return result

    async def create(self, vendor_id: UUID, data, *,
                     actor_id: Optional[UUID] = None) -> tuple[CrmCampaign, list[CrmCampaignStep]]:
        payload = data.model_dump(exclude_unset=True, exclude={"steps"})
        obj = CrmCampaign(vendor_id=vendor_id, **payload)
        self.db.add(obj)
        await self.db.flush()
        steps = []
        for s in (data.steps or []):
            step = CrmCampaignStep(campaign_id=obj.id, **s.model_dump(exclude_unset=True))
            self.db.add(step)
            steps.append(step)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj, steps

    async def update(self, vendor_id: UUID, campaign_id: UUID, data, *,
                     actor_id: Optional[UUID] = None) -> CrmCampaign:
        result = await self.get(vendor_id, campaign_id)
        obj, _ = result
        payload = data.model_dump(exclude_unset=True, exclude={"steps"})
        _apply_updates(obj, payload)
        if data.steps is not None:
            await self.db.execute(
                CrmCampaignStep.__table__.delete().where(CrmCampaignStep.campaign_id == obj.id)
            )
            for s in data.steps:
                self.db.add(CrmCampaignStep(campaign_id=obj.id, **s.model_dump(exclude_unset=True)))
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def delete(self, vendor_id: UUID, campaign_id: UUID) -> None:
        result = await self.get(vendor_id, campaign_id)
        obj, _ = result
        await self.db.delete(obj)
        await self.db.commit()

    async def enroll_segment(self, vendor_id: UUID, campaign_id: UUID,
                             segment_id: UUID, *, actor_id: Optional[UUID] = None) -> int:
        seg_service = SegmentService(self.db)
        seg = await seg_service.get(vendor_id, segment_id)
        ids = await seg_service._matching_contact_ids(vendor_id, seg)
        count = 0
        for cid in ids:
            existing = await self.db.execute(
                select(CrmCampaignEnrollment).where(
                    CrmCampaignEnrollment.campaign_id == campaign_id,
                    CrmCampaignEnrollment.contact_id == cid,
                )
            )
            if existing.scalar_one_or_none():
                continue
            self.db.add(CrmCampaignEnrollment(
                campaign_id=campaign_id, contact_id=cid, vendor_id=vendor_id,
                next_action_at=datetime.now(timezone.utc),
            ))
            count += 1
        await self.db.commit()
        return count

    async def start(self, vendor_id: UUID, campaign_id: UUID) -> CrmCampaign:
        result = await self.get(vendor_id, campaign_id)
        obj, _ = result
        obj.status = "active"
        obj.started_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def pause(self, vendor_id: UUID, campaign_id: UUID) -> CrmCampaign:
        result = await self.get(vendor_id, campaign_id)
        obj, _ = result
        obj.status = "paused"
        await self.db.commit()
        await self.db.refresh(obj)
        return obj


# ── Workflow ─────────────────────────────────────────────────────────────────

class WorkflowService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = WorkflowRepo(db)
        self.run_repo = WorkflowRunRepo(db)

    async def list(self, vendor_id: UUID):
        items, _ = await self.repo.list(vendor_id, page=1, size=200)
        return items

    async def get(self, vendor_id: UUID, workflow_id: UUID) -> CrmWorkflow:
        obj = await self.repo.get(vendor_id, workflow_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Workflow not found")
        return obj

    async def create(self, vendor_id: UUID, data) -> CrmWorkflow:
        obj = CrmWorkflow(vendor_id=vendor_id, **data.model_dump(exclude_unset=True))
        self.db.add(obj)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def update(self, vendor_id: UUID, workflow_id: UUID, data) -> CrmWorkflow:
        obj = await self.get(vendor_id, workflow_id)
        _apply_updates(obj, data.model_dump(exclude_unset=True))
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def delete(self, vendor_id: UUID, workflow_id: UUID) -> None:
        obj = await self.get(vendor_id, workflow_id)
        await self.db.delete(obj)
        await self.db.commit()

    async def list_runs(self, vendor_id: UUID, workflow_id: UUID, page=1, size=20):
        items, total = await self.run_repo.list(
            vendor_id, page=page, size=size,
            where=(self.run_repo.model.workflow_id == workflow_id),
            order_by=desc(self.run_repo.model.started_at),
        )
        return items, total

    async def trigger(self, vendor_id: UUID, workflow_id: UUID,
                      entity_type: str, entity_id: UUID,
                      context: Optional[dict] = None) -> dict:
        from app.tasks.crm.workflow_execute import execute_now
        await self.get(vendor_id, workflow_id)
        return execute_now(workflow_id, entity_type, entity_id, context or {})


# ── Integration ──────────────────────────────────────────────────────────────

class IntegrationService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = IntegrationRepo(db)

    async def list(self, vendor_id: UUID):
        items, _ = await self.repo.list(vendor_id, page=1, size=100)
        return items

    async def get(self, vendor_id: UUID, integration_id: UUID) -> CrmIntegration:
        obj = await self.repo.get(vendor_id, integration_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Integration not found")
        return obj

    async def upsert(self, vendor_id: UUID, data) -> CrmIntegration:
        from app.core.encryption import decrypt_json
        from app.services.integration_defaults_service import merge_platform_defaults

        incoming_creds = data.credentials or {}
        incoming_settings = data.settings or {}
        platform_creds, platform_settings = merge_platform_defaults(
            data.provider, {}, {},
        )

        existing = await self.repo.get_by_provider(vendor_id, data.provider)
        if existing:
            existing.label = data.label or existing.label
            merged_settings = dict(platform_settings)
            merged_settings.update({k: v for k, v in (existing.settings or {}).items() if v})
            merged_settings.update({k: v for k, v in incoming_settings.items() if v})
            existing.settings = merged_settings
            if data.credentials:
                old = decrypt_json(existing.encrypted_credentials) or {}
                merged = dict(old)
                for key, value in incoming_creds.items():
                    if value is None:
                        continue
                    if isinstance(value, str) and not value.strip():
                        continue
                    merged[key] = value.strip() if isinstance(value, str) else value
                for key, value in platform_creds.items():
                    if key in {"password", "auth_token", "api_key"}:
                        continue
                    if not str(merged.get(key) or "").strip() and value:
                        merged[key] = value
                existing.encrypted_credentials = encrypt_json(merged)
            existing.status = "connected"
            existing.last_error = None
            await self.db.commit()
            await self.db.refresh(existing)
            return existing

        merged_creds, merged_settings = merge_platform_defaults(
            data.provider, incoming_creds, incoming_settings,
        )
        obj = CrmIntegration(
            vendor_id=vendor_id,
            provider=data.provider,
            label=data.label,
            settings=merged_settings or {},
            encrypted_credentials=encrypt_json(merged_creds) if merged_creds else None,
        )
        self.db.add(obj)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def update(self, vendor_id: UUID, integration_id: UUID, data) -> CrmIntegration:
        obj = await self.get(vendor_id, integration_id)
        if data.label is not None:
            obj.label = data.label
        if data.status is not None:
            obj.status = data.status
        if data.settings is not None:
            obj.settings = data.settings
        if data.credentials is not None:
            obj.encrypted_credentials = encrypt_json(data.credentials)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def delete(self, vendor_id: UUID, integration_id: UUID) -> None:
        obj = await self.get(vendor_id, integration_id)
        await self.db.delete(obj)
        await self.db.commit()


# ── Chat ─────────────────────────────────────────────────────────────────────

class ChatService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ChatConversationRepo(db)
        self.msg_repo = ChatMessageRepo(db)

    async def list_conversations(self, vendor_id: UUID, status: Optional[str] = None,
                                 page: int = 1, size: int = 50):
        where = None
        if status:
            where = (CrmChatConversation.status == status)
        return await self.repo.list(vendor_id, page=page, size=size, where=where,
                                    order_by=desc(CrmChatConversation.last_message_at))

    async def get_conversation(self, vendor_id: UUID, conv_id: UUID):
        obj = await self.repo.with_messages(vendor_id, conv_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return obj

    async def get_or_create_for_visitor(self, vendor_id: UUID, visitor_id: str,
                                        visitor_name: str | None = None,
                                        visitor_email: str | None = None) -> CrmChatConversation:
        existing = await self.repo.by_visitor(vendor_id, visitor_id)
        if existing:
            return existing
        obj = CrmChatConversation(
            vendor_id=vendor_id, visitor_id=visitor_id,
            visitor_name=visitor_name, visitor_email=visitor_email,
        )
        self.db.add(obj)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def post_message(self, vendor_id: UUID, conv_id: UUID, *, sender: str,
                           body: str, sender_id: Optional[UUID] = None,
                           metadata: Optional[dict] = None,
                           attachments: Optional[list[dict]] = None) -> CrmChatMessage:
        conv = await self.repo.get(vendor_id, conv_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        msg = CrmChatMessage(
            conversation_id=conv.id, vendor_id=vendor_id,
            sender=sender, sender_id=sender_id, body=body,
            attachments=attachments or [],
        )
        if metadata is not None:
            msg.metadata_json = metadata
        self.db.add(msg)
        conv.last_message_at = datetime.now(timezone.utc)
        if sender == "customer":
            conv.status = "awaiting_agent" if not conv.bot_handled else "open"
        elif sender == "agent":
            conv.status = "open"
            conv.bot_handled = False
        await self.db.commit()
        await self.db.refresh(msg)
        return msg

    async def assign(self, vendor_id: UUID, conv_id: UUID, user_id: UUID) -> CrmChatConversation:
        conv = await self.repo.get(vendor_id, conv_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        conv.assigned_to = user_id
        conv.bot_handled = False
        await self.db.commit()
        await self.db.refresh(conv)
        return conv

    async def close(self, vendor_id: UUID, conv_id: UUID) -> CrmChatConversation:
        conv = await self.repo.get(vendor_id, conv_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        conv.status = "closed"
        await self.db.commit()
        await self.db.refresh(conv)
        return conv

    async def bot_reply(self, vendor_id: UUID, conv_id: UUID, prompt: str) -> Optional[CrmChatMessage]:
        from app.integrations.registry import IntegrationRegistry
        registry = IntegrationRegistry(self.db)
        adapter = await registry.get_ai_adapter(vendor_id)
        if not adapter:
            return await self.post_message(
                vendor_id=vendor_id, conv_id=conv_id, sender="bot",
                body="Thanks for reaching out — a teammate will be with you shortly.",
            )
        try:
            reply = await adapter.complete(
                prompt,
                system="You are a helpful customer support assistant. Reply briefly.",
            )
        except Exception as e:
            logger.warning("Bot reply failed: %s", e)
            reply = "I'm having trouble right now — a human agent will follow up."
        return await self.post_message(
            vendor_id=vendor_id, conv_id=conv_id, sender="bot", body=reply,
        )


# ── Journey / Audit / AI / Intake ────────────────────────────────────────────

class JourneyService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = JourneyEventRepo(db)

    async def record(self, vendor_id: UUID, payload) -> CrmJourneyEvent:
        obj = CrmJourneyEvent(vendor_id=vendor_id, **payload.model_dump(exclude_unset=True))
        self.db.add(obj)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def for_contact(self, vendor_id: UUID, contact_id: UUID, **kw):
        return await self.repo.for_contact(vendor_id, contact_id, **kw)

    async def funnel(self, vendor_id: UUID, event_types: list[str]) -> dict:
        return await self.repo.funnel(vendor_id, event_types)


class AuditQueryService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = AuditLogRepo(db)

    async def list(self, vendor_id: UUID, *, page=1, size=50,
                   entity: Optional[str] = None, actor_id: Optional[UUID] = None,
                   entity_id: Optional[UUID] = None):
        from sqlalchemy import and_ as sa_and
        where = []
        if entity:
            where.append(CrmAuditLog.entity == entity)
        if entity_id:
            where.append(CrmAuditLog.entity_id == entity_id)
        if actor_id:
            where.append(CrmAuditLog.actor_id == actor_id)
        return await self.repo.list(
            vendor_id, page=page, size=size,
            where=sa_and(*where) if where else None,
            order_by=desc(CrmAuditLog.created_at),
        )


class AiService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = AiInsightRepo(db)

    async def latest(self, vendor_id: UUID, entity_type: str, entity_id: UUID,
                     kind: Optional[str] = None):
        return await self.repo.latest_for(vendor_id, entity_type, entity_id, kind)

    async def score_lead(self, vendor_id: UUID, lead_id: UUID) -> dict:
        from app.tasks.crm.ai_jobs import score_lead_now
        return score_lead_now(lead_id)

    async def summarise_entity(self, vendor_id: UUID, entity_type: str, entity_id: UUID) -> dict:
        from app.tasks.crm.ai_jobs import summarise_now
        return summarise_now(entity_type, entity_id, vendor_id)

    async def next_best_action(self, vendor_id: UUID, contact_id: UUID) -> dict:
        from app.integrations.registry import IntegrationRegistry
        registry = IntegrationRegistry(self.db)
        adapter = await registry.get_ai_adapter(vendor_id)
        contact_row = await self.db.execute(select(CrmContact).where(CrmContact.id == contact_id))
        contact = contact_row.scalar_one_or_none()
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        if not adapter:
            return {
                "ok": True,
                "suggestion": "Schedule a discovery call within 48 hours.",
                "model": "rule",
            }
        prompt = (
            f"Suggest the next best sales action for this contact in 1 sentence. "
            f"Contact: {contact.first_name} {contact.last_name or ''}, "
            f"stage={contact.lifecycle_stage}, last_activity_at={contact.last_activity_at}."
        )
        try:
            text = await adapter.complete(prompt) or "Schedule a follow-up."
        except Exception as e:
            text = f"Schedule a follow-up. ({e})"
        return {"ok": True, "suggestion": text, "model": adapter.provider}


class IntakeTokenService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = IntakeTokenRepo(db)

    async def list(self, vendor_id: UUID):
        items, _ = await self.repo.list(vendor_id, page=1, size=50)
        return items

    async def create(self, vendor_id: UUID, data) -> CrmLeadIntakeToken:
        token = secrets.token_urlsafe(32)
        obj = CrmLeadIntakeToken(
            vendor_id=vendor_id, token=token,
            label=data.label, source_default=data.source_default or "form",
        )
        self.db.add(obj)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def revoke(self, vendor_id: UUID, token_id: UUID) -> None:
        obj = await self.repo.get(vendor_id, token_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Token not found")
        obj.is_active = False
        await self.db.commit()


# ── Reports ──────────────────────────────────────────────────────────────────

_CRM_RANGE_DAYS = {
    "30d": 30,
    "3m": 92,
    "6m": 183,
    "1y": 365,
    "2y": 730,
    "5y": 1825,
    "10y": 3650,
}


class ReportService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _bucket_series(
        self,
        vendor_id: UUID,
        *,
        days: int,
        buckets: int = 14,
        count_model=None,
        sum_model=None,
        sum_col=None,
        extra=None,
    ) -> list[float]:
        from datetime import timedelta
        from sqlalchemy import func as sa_func

        extra = list(extra or [])
        model = sum_model or count_model
        if model is None:
            return [0.0] * buckets
        end = datetime.now(timezone.utc)
        start = end - timedelta(days=days)
        step = max(days / buckets, 1)
        out: list[float] = []
        for i in range(buckets):
            b_start = start + timedelta(days=i * step)
            b_end = start + timedelta(days=(i + 1) * step)
            window = [
                model.vendor_id == vendor_id,
                model.created_at >= b_start,
                model.created_at < b_end,
                *extra,
            ]
            if sum_col is not None:
                row = await self.db.execute(
                    select(sa_func.coalesce(sa_func.sum(sum_col), 0)).where(*window)
                )
                out.append(float(row.scalar_one() or 0))
            else:
                row = await self.db.execute(
                    select(sa_func.coalesce(sa_func.count(), 0)).select_from(model).where(*window)
                )
                out.append(float(row.scalar_one() or 0))
        return out

    async def overview(self, vendor_id: UUID, range_key: str = "30d") -> dict:
        from sqlalchemy import func as sa_func

        days = _CRM_RANGE_DAYS.get(range_key, 30)

        async def _count(model, *extra):
            row = await self.db.execute(
                select(sa_func.count()).select_from(model).where(
                    model.vendor_id == vendor_id, *extra,
                )
            )
            return int(row.scalar_one() or 0)

        try:
            persons = await _count(CrmContact, CrmContact.record_type != "company")
        except Exception:
            persons = await _count(CrmContact)

        try:
            companies = await _count(CrmContact, CrmContact.record_type == "company")
        except Exception:
            companies = await _count(CrmAccount)

        total_leads = await _count(CrmLead)
        leads_open = await _count(CrmLead, CrmLead.status != "converted")
        deals_open = await _count(CrmDeal, CrmDeal.status == "open")
        deals_won = await _count(CrmDeal, CrmDeal.status == "won")
        tickets_open = await _count(
            CrmTicket, CrmTicket.status.in_(("open", "pending", "on_hold")),
        )
        tickets_overdue = await _count(CrmTicket, CrmTicket.sla_breached.is_(True))
        pending_tasks = await _count(
            CrmActivity,
            CrmActivity.status.in_(("open", "in_progress", "pending")),
        )
        active_workflows = await _count(CrmWorkflow, CrmWorkflow.status == "active")
        active_campaigns = await _count(CrmCampaign, CrmCampaign.status == "active")

        forecast = await DealService(self.db).forecast(vendor_id)
        pipeline_value = float(forecast.get("total") or forecast.get("pipeline_total") or 0)
        weighted_value = float(forecast.get("weighted") or forecast.get("weighted_total") or 0)

        row = await self.db.execute(
            select(sa_func.coalesce(sa_func.sum(CrmDeal.amount), 0)).where(
                CrmDeal.vendor_id == vendor_id, CrmDeal.status == "won",
            )
        )
        won_total = float(row.scalar_one() or 0)
        conversion_rate = (deals_won / total_leads * 100) if total_leads else 0.0

        person_extra = [CrmContact.record_type != "company"]
        company_extra = [CrmContact.record_type == "company"]
        try:
            person_trend = await self._bucket_series(
                vendor_id, days=days, count_model=CrmContact, extra=person_extra,
            )
            company_trend = await self._bucket_series(
                vendor_id, days=days, count_model=CrmContact, extra=company_extra,
            )
        except Exception:
            person_trend = await self._bucket_series(
                vendor_id, days=days, count_model=CrmContact,
            )
            company_trend = await self._bucket_series(
                vendor_id, days=days, count_model=CrmAccount,
            )

        contacts_companies_trend = [
            person_trend[i] + company_trend[i] for i in range(len(person_trend))
        ]

        trends = {
            "contacts_companies": contacts_companies_trend,
            "leads": await self._bucket_series(
                vendor_id, days=days, count_model=CrmLead,
            ),
            "conversion": await self._bucket_series(
                vendor_id, days=days, count_model=CrmDeal,
                extra=[CrmDeal.status == "won"],
            ),
            "pipeline": await self._bucket_series(
                vendor_id, days=days, sum_model=CrmDeal, sum_col=CrmDeal.amount,
            ),
            "deals": await self._bucket_series(
                vendor_id, days=days, count_model=CrmDeal,
                extra=[CrmDeal.status == "open"],
            ),
            "tickets": await self._bucket_series(
                vendor_id, days=days, count_model=CrmTicket,
                extra=[CrmTicket.status.in_(("open", "pending", "on_hold"))],
            ),
            "tasks": await self._bucket_series(
                vendor_id, days=days, count_model=CrmActivity,
            ),
        }

        return {
            "contacts": persons + companies,
            "total_contacts": persons,
            "total_companies": companies,
            "total_leads": total_leads,
            "leads_open": leads_open,
            "open_leads": leads_open,
            "deals_open": deals_open,
            "open_deals": deals_open,
            "deals_won": deals_won,
            "tickets_open": tickets_open,
            "open_tickets": tickets_open,
            "overdue_tickets": tickets_overdue,
            "pending_activities": pending_tasks,
            "won_total": won_total,
            "conversion_rate": round(conversion_rate, 1),
            "pipeline_value": pipeline_value,
            "weighted_value": weighted_value,
            "active_campaigns": active_campaigns,
            "active_workflows": active_workflows,
            "pipeline_forecast": forecast,
            "range": range_key,
            "trends": trends,
        }

    async def sales_performance(self, vendor_id: UUID) -> dict:
        from sqlalchemy import func as sa_func
        rows = await self.db.execute(
            select(
                CrmDeal.owner_id,
                sa_func.count(CrmDeal.id).filter(CrmDeal.status == "won"),
                sa_func.coalesce(sa_func.sum(CrmDeal.amount).filter(CrmDeal.status == "won"), 0),
                sa_func.count(CrmDeal.id).filter(CrmDeal.status == "open"),
            ).where(CrmDeal.vendor_id == vendor_id).group_by(CrmDeal.owner_id)
        )
        rows_list = [
            {
                "owner_id": str(r[0]) if r[0] else None,
                "won_count": int(r[1] or 0),
                "won_amount": float(r[2] or 0),
                "open_count": int(r[3] or 0),
            }
            for r in rows.all()
        ]
        return {"reps": rows_list}

    async def campaign_performance(self, vendor_id: UUID) -> dict:
        rows = await self.db.execute(
            select(CrmCampaign).where(CrmCampaign.vendor_id == vendor_id)
        )
        items = [
            {
                "id": str(c.id),
                "name": c.name,
                "status": c.status,
                "sent": c.sent_count,
                "open": c.open_count,
                "click": c.click_count,
                "bounce": c.bounce_count,
                "unsubscribe": c.unsubscribe_count,
            }
            for c in rows.scalars().all()
        ]
        return {"campaigns": items}

    async def ticket_performance(self, vendor_id: UUID) -> dict:
        from sqlalchemy import func as sa_func
        rows = await self.db.execute(
            select(
                CrmTicket.status, sa_func.count(CrmTicket.id),
            ).where(CrmTicket.vendor_id == vendor_id).group_by(CrmTicket.status)
        )
        by_status = {r[0]: int(r[1] or 0) for r in rows.all()}
        breached_row = await self.db.execute(
            select(sa_func.count()).select_from(CrmTicket).where(
                CrmTicket.vendor_id == vendor_id, CrmTicket.sla_breached.is_(True),
            )
        )
        return {"by_status": by_status, "sla_breached": int(breached_row.scalar_one() or 0)}
