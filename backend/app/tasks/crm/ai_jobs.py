"""AI-powered jobs - lead scoring, deal probability, summarisation, sentiment."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.worker import CELERY_AVAILABLE, celery_app

logger = logging.getLogger(__name__)


async def _score_lead(lead_id: UUID) -> dict:
    from app.models.crm import CrmLead, CrmAiInsight
    from app.integrations.registry import IntegrationRegistry

    async with AsyncSessionLocal() as db:
        lead_row = await db.execute(select(CrmLead).where(CrmLead.id == lead_id))
        lead = lead_row.scalar_one_or_none()
        if not lead:
            return {"ok": False, "error": "lead_not_found"}

        rule_score = 0
        if lead.email:
            rule_score += 20
        if lead.phone:
            rule_score += 15
        if lead.company:
            rule_score += 15
        if lead.title:
            rule_score += 10
        if lead.website:
            rule_score += 10
        if lead.source in ("referral", "event", "partner"):
            rule_score += 20
        elif lead.source in ("website", "ad", "campaign"):
            rule_score += 15
        rule_score = min(100, rule_score)

        ai_score = rule_score
        ai_rationale = "Rule-based scoring (no AI provider configured)."

        registry = IntegrationRegistry(db)
        ai = await registry.get_ai_adapter(lead.vendor_id)
        if ai:
            try:
                resp = await ai.complete(
                    "You are an inside-sales SDR. Rate this lead from 0-100 and explain in one sentence."
                    f" Lead: {lead.first_name or ''} {lead.last_name or ''}, {lead.title or ''} at"
                    f" {lead.company or 'unknown'}, source={lead.source}. Reply as 'SCORE: <0-100>\\nNOTE: ...'."
                )
                txt = (resp or "").strip()
                if "SCORE:" in txt:
                    line = [l for l in txt.splitlines() if "SCORE:" in l][0]
                    digits = "".join(ch for ch in line if ch.isdigit())
                    if digits:
                        ai_score = max(0, min(100, int(digits[:3])))
                ai_rationale = txt[:500]
            except Exception as e:
                ai_rationale = f"AI scoring failed: {e}"

        lead.score = ai_score
        if ai_score >= 75:
            lead.rating = "hot"
        elif ai_score >= 45:
            lead.rating = "warm"
        else:
            lead.rating = "cold"

        db.add(CrmAiInsight(
            vendor_id=lead.vendor_id,
            entity_type="lead", entity_id=lead.id,
            kind="scoring",
            content={"score": ai_score, "rationale": ai_rationale, "rule_score": rule_score},
            model="hybrid",
        ))
        await db.commit()
        return {"ok": True, "score": ai_score, "rating": lead.rating}


async def _summarise(entity_type: str, entity_id: UUID, vendor_id: UUID) -> dict:
    from app.models.crm import CrmCommunicationLog, CrmAiInsight
    from app.integrations.registry import IntegrationRegistry

    async with AsyncSessionLocal() as db:
        rows = await db.execute(
            select(CrmCommunicationLog)
            .where(
                CrmCommunicationLog.related_type == entity_type,
                CrmCommunicationLog.related_id == entity_id,
            )
            .order_by(CrmCommunicationLog.occurred_at.desc())
            .limit(20)
        )
        items = rows.scalars().all()
        if not items:
            return {"ok": False, "error": "no_history"}
        text = "\n\n".join(
            f"[{it.occurred_at.isoformat() if it.occurred_at else ''}] {it.channel}/{it.direction}: "
            f"{(it.subject or '')} - {(it.body or '')[:300]}" for it in items
        )

        summary = "Conversation summary unavailable (no AI provider)."
        registry = IntegrationRegistry(db)
        ai = await registry.get_ai_adapter(vendor_id)
        if ai:
            try:
                summary = await ai.complete(
                    "Summarise this customer conversation in 3 short bullet points and suggest the next best action.\n\n"
                    + text
                ) or summary
            except Exception as e:
                summary = f"AI summary failed: {e}"

        db.add(CrmAiInsight(
            vendor_id=vendor_id,
            entity_type=entity_type, entity_id=entity_id,
            kind="summary", content={"summary": summary},
            model="ai_summary",
            generated_at=datetime.now(timezone.utc),
        ))
        await db.commit()
        return {"ok": True, "summary": summary}


def score_lead_now(lead_id: UUID) -> dict:
    return asyncio.run(_score_lead(lead_id))


def summarise_now(entity_type: str, entity_id: UUID, vendor_id: UUID) -> dict:
    return asyncio.run(_summarise(entity_type, entity_id, vendor_id))


if CELERY_AVAILABLE and celery_app is not None:
    @celery_app.task(name="crm.ai.score_lead")
    def score_lead_task(lead_id: str) -> dict:
        return asyncio.run(_score_lead(UUID(lead_id)))

    @celery_app.task(name="crm.ai.summarise")
    def summarise_task(entity_type: str, entity_id: str, vendor_id: str) -> dict:
        return asyncio.run(_summarise(entity_type, UUID(entity_id), UUID(vendor_id)))
else:
    def score_lead_task(*args, **kwargs):  # type: ignore[no-redef]
        return score_lead_now(*args, **kwargs)

    def summarise_task(*args, **kwargs):  # type: ignore[no-redef]
        return summarise_now(*args, **kwargs)
