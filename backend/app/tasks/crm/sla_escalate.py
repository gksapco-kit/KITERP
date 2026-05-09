"""Periodically check tickets against SLA targets and flag breaches."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.worker import CELERY_AVAILABLE, celery_app

logger = logging.getLogger(__name__)


async def _check() -> dict:
    from app.models.crm import CrmTicket, CrmSlaPolicy
    breached = 0
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        rows = await db.execute(
            select(CrmTicket).where(
                CrmTicket.status.in_(("open", "pending", "on_hold")),
                CrmTicket.sla_breached.is_(False),
            ).limit(500)
        )
        for ticket in rows.scalars().all():
            policy = None
            if ticket.sla_policy_id:
                p_row = await db.execute(
                    select(CrmSlaPolicy).where(CrmSlaPolicy.id == ticket.sla_policy_id)
                )
                policy = p_row.scalar_one_or_none()
            if not policy:
                continue
            created = ticket.created_at or now
            age_minutes = (now - created).total_seconds() / 60
            if not ticket.first_response_at and age_minutes > policy.response_target_minutes:
                ticket.sla_breached = True
                breached += 1
                continue
            if not ticket.resolved_at and age_minutes > policy.resolution_target_minutes:
                ticket.sla_breached = True
                breached += 1
        await db.commit()
    return {"breached": breached}


def check_now() -> dict:
    return asyncio.run(_check())


if CELERY_AVAILABLE and celery_app is not None:
    @celery_app.task(name="crm.tickets.sla_check")
    def sla_check_task() -> dict:
        return asyncio.run(_check())
else:
    def sla_check_task():  # type: ignore[no-redef]
        return check_now()
