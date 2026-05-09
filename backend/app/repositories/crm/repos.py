"""
CRM repositories. Each class is a thin wrapper over SQLAlchemy that returns
ORM models scoped by ``vendor_id`` and provides common list/search helpers.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional, Sequence
from uuid import UUID

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.crm import (
    CrmAccount, CrmActivity, CrmAiInsight, CrmAuditLog,
    CrmCampaign, CrmCampaignEnrollment, CrmCampaignStep,
    CrmChatConversation, CrmChatMessage, CrmCommunicationLog,
    CrmContact, CrmDeal, CrmEmailEvent, CrmEmailTemplate, CrmIntegration,
    CrmJourneyEvent, CrmKbArticle, CrmLead, CrmLeadIntakeToken,
    CrmPipeline, CrmSegment, CrmSlaPolicy, CrmStage,
    CrmSuppressionEntry, CrmTicket, CrmTicketComment,
    CrmWorkflow, CrmWorkflowRun,
)


def _paginate(stmt, page: int, size: int):
    return stmt.offset((page - 1) * size).limit(size)


# ── Generic helpers ──────────────────────────────────────────────────────────

class _VendorScopedRepo:
    model: Any

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(self, vendor_id: UUID, obj_id: UUID):
        row = await self.db.execute(
            select(self.model).where(
                self.model.vendor_id == vendor_id, self.model.id == obj_id
            )
        )
        return row.scalar_one_or_none()

    async def delete(self, obj) -> None:
        await self.db.delete(obj)
        await self.db.commit()

    async def list(self, vendor_id: UUID, *, page: int = 1, size: int = 20,
                   order_by=None, where=None) -> tuple[Sequence, int]:
        base_q = select(self.model).where(self.model.vendor_id == vendor_id)
        count_q = select(func.count()).select_from(self.model).where(
            self.model.vendor_id == vendor_id,
        )
        if where is not None:
            base_q = base_q.where(where)
            count_q = count_q.where(where)
        if order_by is None:
            order_by = desc(self.model.created_at)
        base_q = base_q.order_by(order_by)
        total = (await self.db.execute(count_q)).scalar_one()
        rows = await self.db.execute(_paginate(base_q, page, size))
        return list(rows.scalars().all()), total


# ── Accounts ─────────────────────────────────────────────────────────────────

class AccountRepo(_VendorScopedRepo):
    model = CrmAccount

    async def search(self, vendor_id: UUID, *, page=1, size=20, q: Optional[str] = None,
                     industry: Optional[str] = None, region: Optional[str] = None,
                     owner_id: Optional[UUID] = None):
        where = []
        if q:
            like = f"%{q}%"
            where.append(or_(
                CrmAccount.name.ilike(like),
                CrmAccount.email.ilike(like),
                CrmAccount.phone.ilike(like),
            ))
        if industry:
            where.append(CrmAccount.industry == industry)
        if region:
            where.append(CrmAccount.region == region)
        if owner_id:
            where.append(CrmAccount.owner_id == owner_id)
        return await self.list(
            vendor_id, page=page, size=size,
            where=and_(*where) if where else None,
        )


# ── Contacts ─────────────────────────────────────────────────────────────────

class ContactRepo(_VendorScopedRepo):
    model = CrmContact

    async def search(self, vendor_id: UUID, *, page=1, size=20, q: Optional[str] = None,
                     account_id: Optional[UUID] = None, owner_id: Optional[UUID] = None,
                     stage: Optional[str] = None, tag: Optional[str] = None):
        where = []
        if q:
            like = f"%{q}%"
            where.append(or_(
                CrmContact.first_name.ilike(like),
                CrmContact.last_name.ilike(like),
                CrmContact.email.ilike(like),
                CrmContact.phone.ilike(like),
                CrmContact.mobile.ilike(like),
            ))
        if account_id:
            where.append(CrmContact.account_id == account_id)
        if owner_id:
            where.append(CrmContact.owner_id == owner_id)
        if stage:
            where.append(CrmContact.lifecycle_stage == stage)
        if tag:
            where.append(CrmContact.tags.contains([tag]))
        return await self.list(
            vendor_id, page=page, size=size,
            where=and_(*where) if where else None,
        )

    async def find_by_email(self, vendor_id: UUID, email: str):
        row = await self.db.execute(
            select(CrmContact).where(
                CrmContact.vendor_id == vendor_id,
                CrmContact.email == email,
            )
        )
        return row.scalar_one_or_none()


# ── Leads ────────────────────────────────────────────────────────────────────

class LeadRepo(_VendorScopedRepo):
    model = CrmLead

    async def search(self, vendor_id: UUID, *, page=1, size=20, q: Optional[str] = None,
                     status: Optional[str] = None, source: Optional[str] = None,
                     assigned_to: Optional[UUID] = None, rating: Optional[str] = None):
        where = []
        if q:
            like = f"%{q}%"
            where.append(or_(
                CrmLead.first_name.ilike(like),
                CrmLead.last_name.ilike(like),
                CrmLead.company.ilike(like),
                CrmLead.email.ilike(like),
                CrmLead.phone.ilike(like),
            ))
        if status:
            where.append(CrmLead.status == status)
        if source:
            where.append(CrmLead.source == source)
        if assigned_to:
            where.append(CrmLead.assigned_to == assigned_to)
        if rating:
            where.append(CrmLead.rating == rating)
        return await self.list(
            vendor_id, page=page, size=size,
            where=and_(*where) if where else None,
        )


# ── Pipelines & Stages & Deals ───────────────────────────────────────────────

class PipelineRepo(_VendorScopedRepo):
    model = CrmPipeline

    async def list_with_stages(self, vendor_id: UUID):
        rows = await self.db.execute(
            select(CrmPipeline)
            .where(CrmPipeline.vendor_id == vendor_id, CrmPipeline.is_active.is_(True))
            .options(selectinload(CrmPipeline.stages))
            .order_by(CrmPipeline.sort_order, CrmPipeline.created_at)
        )
        return list(rows.scalars().all())

    async def get_default(self, vendor_id: UUID):
        row = await self.db.execute(
            select(CrmPipeline).where(
                CrmPipeline.vendor_id == vendor_id,
                CrmPipeline.is_default.is_(True),
            ).options(selectinload(CrmPipeline.stages))
        )
        return row.scalar_one_or_none()

    async def with_stages(self, vendor_id: UUID, pipeline_id: UUID):
        row = await self.db.execute(
            select(CrmPipeline).where(
                CrmPipeline.vendor_id == vendor_id, CrmPipeline.id == pipeline_id,
            ).options(selectinload(CrmPipeline.stages))
        )
        return row.scalar_one_or_none()


class StageRepo(_VendorScopedRepo):
    model = CrmStage


class DealRepo(_VendorScopedRepo):
    model = CrmDeal

    async def search(self, vendor_id: UUID, *, page=1, size=50, q: Optional[str] = None,
                     pipeline_id: Optional[UUID] = None, stage_id: Optional[UUID] = None,
                     owner_id: Optional[UUID] = None, status: Optional[str] = None,
                     min_amount: Optional[float] = None):
        where = []
        if q:
            like = f"%{q}%"
            where.append(or_(
                CrmDeal.title.ilike(like),
                CrmDeal.description.ilike(like),
            ))
        if pipeline_id:
            where.append(CrmDeal.pipeline_id == pipeline_id)
        if stage_id:
            where.append(CrmDeal.stage_id == stage_id)
        if owner_id:
            where.append(CrmDeal.owner_id == owner_id)
        if status:
            where.append(CrmDeal.status == status)
        if min_amount is not None:
            where.append(CrmDeal.amount >= min_amount)
        return await self.list(
            vendor_id, page=page, size=size,
            where=and_(*where) if where else None,
            order_by=CrmDeal.sort_order,
        )

    async def by_pipeline(self, vendor_id: UUID, pipeline_id: UUID,
                          status: str = "open") -> list[CrmDeal]:
        rows = await self.db.execute(
            select(CrmDeal).where(
                CrmDeal.vendor_id == vendor_id,
                CrmDeal.pipeline_id == pipeline_id,
                CrmDeal.status == status,
            ).order_by(CrmDeal.stage_id, CrmDeal.sort_order)
        )
        return list(rows.scalars().all())

    async def forecast(self, vendor_id: UUID, pipeline_id: Optional[UUID] = None) -> dict:
        q = select(
            CrmDeal.stage_id,
            func.coalesce(func.sum(CrmDeal.amount), 0),
            func.count(CrmDeal.id),
            func.avg(CrmDeal.probability),
        ).where(
            CrmDeal.vendor_id == vendor_id,
            CrmDeal.status == "open",
        ).group_by(CrmDeal.stage_id)
        if pipeline_id:
            q = q.where(CrmDeal.pipeline_id == pipeline_id)
        rows = await self.db.execute(q)

        result = []
        weighted_total = 0.0
        unweighted_total = 0.0
        for stage_id, total, count, avg_prob in rows.all():
            t = float(total or 0)
            p = float(avg_prob or 0) / 100.0
            weighted = t * p
            result.append({
                "stage_id": str(stage_id) if stage_id else None,
                "total": t,
                "count": int(count or 0),
                "weighted": weighted,
                "probability": float(avg_prob or 0),
            })
            unweighted_total += t
            weighted_total += weighted
        return {
            "stages": result,
            "weighted_total": weighted_total,
            "unweighted_total": unweighted_total,
        }


# ── Activities ───────────────────────────────────────────────────────────────

class ActivityRepo(_VendorScopedRepo):
    model = CrmActivity

    async def search(self, vendor_id: UUID, *, page=1, size=20, owner_id: Optional[UUID] = None,
                     status: Optional[str] = None, type_: Optional[str] = None,
                     related_type: Optional[str] = None, related_id: Optional[UUID] = None,
                     due_before: Optional[datetime] = None, due_after: Optional[datetime] = None):
        where = []
        if owner_id:
            where.append(CrmActivity.owner_id == owner_id)
        if status:
            where.append(CrmActivity.status == status)
        if type_:
            where.append(CrmActivity.type == type_)
        if related_type:
            where.append(CrmActivity.related_type == related_type)
        if related_id:
            where.append(CrmActivity.related_id == related_id)
        if due_before:
            where.append(CrmActivity.due_at <= due_before)
        if due_after:
            where.append(CrmActivity.due_at >= due_after)
        return await self.list(
            vendor_id, page=page, size=size,
            where=and_(*where) if where else None,
            order_by=CrmActivity.due_at.asc().nullslast(),
        )


# ── Communication & Calls ────────────────────────────────────────────────────

class CommunicationRepo(_VendorScopedRepo):
    model = CrmCommunicationLog

    async def for_entity(self, vendor_id: UUID, entity_type: str, entity_id: UUID,
                         page=1, size=50):
        where = and_(
            CrmCommunicationLog.related_type == entity_type,
            CrmCommunicationLog.related_id == entity_id,
        )
        return await self.list(
            vendor_id, page=page, size=size, where=where,
            order_by=CrmCommunicationLog.occurred_at.desc(),
        )


# ── Tickets / KB ─────────────────────────────────────────────────────────────

class TicketRepo(_VendorScopedRepo):
    model = CrmTicket

    async def search(self, vendor_id: UUID, *, page=1, size=20, q: Optional[str] = None,
                     status: Optional[str] = None, priority: Optional[str] = None,
                     assigned_to: Optional[UUID] = None, contact_id: Optional[UUID] = None):
        where = []
        if q:
            like = f"%{q}%"
            where.append(or_(
                CrmTicket.subject.ilike(like),
                CrmTicket.description.ilike(like),
                CrmTicket.number.ilike(like),
            ))
        if status:
            where.append(CrmTicket.status == status)
        if priority:
            where.append(CrmTicket.priority == priority)
        if assigned_to:
            where.append(CrmTicket.assigned_to == assigned_to)
        if contact_id:
            where.append(CrmTicket.contact_id == contact_id)
        return await self.list(
            vendor_id, page=page, size=size,
            where=and_(*where) if where else None,
        )

    async def next_ticket_number(self, vendor_id: UUID) -> str:
        row = await self.db.execute(
            select(func.count()).select_from(CrmTicket).where(CrmTicket.vendor_id == vendor_id)
        )
        n = (row.scalar_one() or 0) + 1
        return f"TCK-{n:06d}"


class TicketCommentRepo(_VendorScopedRepo):
    model = CrmTicketComment

    async def for_ticket(self, vendor_id: UUID, ticket_id: UUID):
        rows = await self.db.execute(
            select(CrmTicketComment).where(
                CrmTicketComment.vendor_id == vendor_id,
                CrmTicketComment.ticket_id == ticket_id,
            ).order_by(CrmTicketComment.created_at.asc())
        )
        return list(rows.scalars().all())


class SlaPolicyRepo(_VendorScopedRepo):
    model = CrmSlaPolicy


class KbRepo(_VendorScopedRepo):
    model = CrmKbArticle

    async def search(self, vendor_id: UUID, *, page=1, size=20, q: Optional[str] = None,
                     status: Optional[str] = None):
        where = []
        if q:
            like = f"%{q}%"
            where.append(or_(
                CrmKbArticle.title.ilike(like),
                CrmKbArticle.body.ilike(like),
                CrmKbArticle.summary.ilike(like),
            ))
        if status:
            where.append(CrmKbArticle.status == status)
        return await self.list(
            vendor_id, page=page, size=size,
            where=and_(*where) if where else None,
        )


# ── Marketing ────────────────────────────────────────────────────────────────

class SegmentRepo(_VendorScopedRepo):
    model = CrmSegment


class EmailTemplateRepo(_VendorScopedRepo):
    model = CrmEmailTemplate


class CampaignRepo(_VendorScopedRepo):
    model = CrmCampaign

    async def with_steps(self, vendor_id: UUID, campaign_id: UUID):
        row = await self.db.execute(
            select(CrmCampaign).where(
                CrmCampaign.vendor_id == vendor_id, CrmCampaign.id == campaign_id,
            )
        )
        campaign = row.scalar_one_or_none()
        if not campaign:
            return None
        steps_row = await self.db.execute(
            select(CrmCampaignStep)
            .where(CrmCampaignStep.campaign_id == campaign.id)
            .order_by(CrmCampaignStep.sort_order)
        )
        steps = list(steps_row.scalars().all())
        return campaign, steps


class CampaignEnrollmentRepo(_VendorScopedRepo):
    model = CrmCampaignEnrollment


class EmailEventRepo(_VendorScopedRepo):
    model = CrmEmailEvent


class SuppressionRepo(_VendorScopedRepo):
    model = CrmSuppressionEntry


# ── Workflows ────────────────────────────────────────────────────────────────

class WorkflowRepo(_VendorScopedRepo):
    model = CrmWorkflow


class WorkflowRunRepo(_VendorScopedRepo):
    model = CrmWorkflowRun


# ── Integrations / AI / Audit / Chat / Journey ───────────────────────────────

class IntegrationRepo(_VendorScopedRepo):
    model = CrmIntegration

    async def get_by_provider(self, vendor_id: UUID, provider: str):
        row = await self.db.execute(
            select(CrmIntegration).where(
                CrmIntegration.vendor_id == vendor_id,
                CrmIntegration.provider == provider,
            )
        )
        return row.scalar_one_or_none()


class AiInsightRepo(_VendorScopedRepo):
    model = CrmAiInsight

    async def latest_for(self, vendor_id: UUID, entity_type: str, entity_id: UUID,
                         kind: Optional[str] = None):
        q = select(CrmAiInsight).where(
            CrmAiInsight.vendor_id == vendor_id,
            CrmAiInsight.entity_type == entity_type,
            CrmAiInsight.entity_id == entity_id,
        ).order_by(CrmAiInsight.generated_at.desc()).limit(5)
        if kind:
            q = q.where(CrmAiInsight.kind == kind)
        rows = await self.db.execute(q)
        return list(rows.scalars().all())


class AuditLogRepo(_VendorScopedRepo):
    model = CrmAuditLog


class ChatConversationRepo(_VendorScopedRepo):
    model = CrmChatConversation

    async def with_messages(self, vendor_id: UUID, conv_id: UUID):
        row = await self.db.execute(
            select(CrmChatConversation).where(
                CrmChatConversation.vendor_id == vendor_id,
                CrmChatConversation.id == conv_id,
            ).options(selectinload(CrmChatConversation.messages))
        )
        return row.scalar_one_or_none()

    async def by_visitor(self, vendor_id: UUID, visitor_id: str):
        row = await self.db.execute(
            select(CrmChatConversation).where(
                CrmChatConversation.vendor_id == vendor_id,
                CrmChatConversation.visitor_id == visitor_id,
                CrmChatConversation.status != "closed",
            ).order_by(CrmChatConversation.last_message_at.desc())
        )
        return row.scalar_one_or_none()


class ChatMessageRepo(_VendorScopedRepo):
    model = CrmChatMessage


class JourneyEventRepo(_VendorScopedRepo):
    model = CrmJourneyEvent

    async def for_contact(self, vendor_id: UUID, contact_id: UUID, page=1, size=100):
        where = CrmJourneyEvent.contact_id == contact_id
        return await self.list(
            vendor_id, page=page, size=size, where=where,
            order_by=CrmJourneyEvent.occurred_at.desc(),
        )

    async def funnel(self, vendor_id: UUID, event_types: list[str]) -> dict:
        out = {}
        for et in event_types:
            row = await self.db.execute(
                select(func.count()).select_from(CrmJourneyEvent).where(
                    CrmJourneyEvent.vendor_id == vendor_id,
                    CrmJourneyEvent.event_type == et,
                )
            )
            out[et] = int(row.scalar_one() or 0)
        return out


class IntakeTokenRepo(_VendorScopedRepo):
    model = CrmLeadIntakeToken

    async def by_token(self, token: str):
        row = await self.db.execute(
            select(CrmLeadIntakeToken).where(
                CrmLeadIntakeToken.token == token,
                CrmLeadIntakeToken.is_active.is_(True),
            )
        )
        return row.scalar_one_or_none()
