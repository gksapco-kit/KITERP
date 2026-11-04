"""Celery entry point for the production daily digest (registered in ``app.worker``).

Without Celery call :func:`run_daily_now` from cron or a management shell."""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict

from app.database import AsyncSessionLocal
from app.worker import CELERY_AVAILABLE, celery_app

logger = logging.getLogger(__name__)


async def _daily() -> Dict[str, Any]:
    from app.services.production_scheduler import run_daily

    results = await run_daily(AsyncSessionLocal)
    failed = [v for v, r in results.items() if "error" in r]
    logger.info("production.daily: %d vendors, %d failed", len(results), len(failed))
    return results


def run_daily_now() -> Dict[str, Any]:
    return asyncio.run(_daily())


if CELERY_AVAILABLE and celery_app is not None:

    @celery_app.task(name="production.daily")
    def production_daily_task() -> Dict[str, Any]:
        return asyncio.run(_daily())

else:  # pragma: no cover - no Celery in this environment

    def production_daily_task():  # type: ignore[no-redef]
        return run_daily_now()
