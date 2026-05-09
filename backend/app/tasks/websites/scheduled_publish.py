"""
Scheduled-publish worker.

Promotes any `wb_pages` row whose `publish_status='scheduled'` and
`scheduled_publish_at <= now()` into `publish_status='published'` and flips
`is_published=True`. Also invalidates the public-sites cache so the new
content shows up on the storefront within the next request.

The tick is intentionally cheap: a single SELECT, then a per-row UPDATE.
Rows are batched at 200 to avoid long transactions while still draining a
backlog quickly.

Run via Celery beat at 60-second cadence (registered in `app.worker`).
Falls back to a sync runner when Celery isn't available so the same code
path works in dev / tests.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, List

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.worker import CELERY_AVAILABLE, celery_app

logger = logging.getLogger(__name__)


async def _tick() -> Dict[str, int]:
    """Promote due `scheduled` pages to `published`. Returns a stats dict."""
    from app.models.website import WebsitePage, WebsiteSite

    promoted = 0
    invalidated_sites = 0
    now = datetime.now(timezone.utc).replace(tzinfo=None)  # column is naive UTC

    async with AsyncSessionLocal() as db:
        rows = await db.execute(
            select(WebsitePage)
            .where(
                WebsitePage.publish_status == "scheduled",
                WebsitePage.scheduled_publish_at.isnot(None),
                WebsitePage.scheduled_publish_at <= now,
            )
            .limit(200)
        )
        pages: List[WebsitePage] = list(rows.scalars().all())
        if not pages:
            return {"promoted": 0, "invalidated_sites": 0}

        site_ids = {p.site_id for p in pages}
        for page in pages:
            page.publish_status = "published"
            page.is_published = True
            page.scheduled_publish_at = None
            page.updated_at = datetime.utcnow()
            promoted += 1

        await db.commit()

        # Best-effort: clear public-site caches for affected sites so the
        # storefront sees the change without waiting for the 60s TTL.
        try:
            from app.api.v1.public_sites import invalidate_site_cache

            site_rows = await db.execute(
                select(WebsiteSite).where(WebsiteSite.id.in_(list(site_ids)))
            )
            sites = site_rows.scalars().all()
            for s in sites:
                try:
                    await invalidate_site_cache(s.subdomain, str(s.id))
                    invalidated_sites += 1
                except Exception:
                    pass
        except Exception as exc:
            logger.warning("invalidate cache failed in scheduled-publish tick: %s", exc)

    return {"promoted": promoted, "invalidated_sites": invalidated_sites}


def tick_now() -> Dict[str, int]:
    """Synchronous entrypoint used by the dev fallback and unit tests."""
    return asyncio.run(_tick())


if CELERY_AVAILABLE and celery_app is not None:
    @celery_app.task(name="websites.scheduled_publish.tick")
    def scheduled_publish_tick_task() -> Dict[str, int]:
        return asyncio.run(_tick())
else:
    def scheduled_publish_tick_task():  # type: ignore[no-redef]
        return tick_now()
