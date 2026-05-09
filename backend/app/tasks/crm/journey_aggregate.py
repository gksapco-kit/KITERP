"""Recompute touchpoint counts for contacts based on journey events."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select, func

from app.database import AsyncSessionLocal
from app.worker import CELERY_AVAILABLE, celery_app

logger = logging.getLogger(__name__)


async def _aggregate() -> dict:
    from app.models.crm import CrmJourneyEvent, CrmContact

    updated = 0
    async with AsyncSessionLocal() as db:
        rows = await db.execute(
            select(
                CrmJourneyEvent.contact_id,
                func.max(CrmJourneyEvent.occurred_at),
            ).where(CrmJourneyEvent.contact_id.isnot(None))
            .group_by(CrmJourneyEvent.contact_id)
        )
        for contact_id, last_at in rows.all():
            if not contact_id:
                continue
            await db.execute(
                CrmContact.__table__.update()
                .where(CrmContact.id == contact_id)
                .values(last_activity_at=last_at)
            )
            updated += 1
        await db.commit()
    return {"updated": updated, "at": datetime.now(timezone.utc).isoformat()}


def aggregate_now() -> dict:
    return asyncio.run(_aggregate())


if CELERY_AVAILABLE and celery_app is not None:
    @celery_app.task(name="crm.journey.aggregate")
    def aggregate_task() -> dict:
        return asyncio.run(_aggregate())
else:
    def aggregate_task():  # type: ignore[no-redef]
        return aggregate_now()
