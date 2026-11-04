"""Celery entry points for the Real Estate scheduled jobs (registered in ``app.worker``).

The logic lives in :mod:`app.services.realestate.scheduler`; this module only schedules it. Without Celery the
same function can be called directly (``run_daily_now``) from a cron job or a management shell.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict

from app.database import AsyncSessionLocal
from app.worker import CELERY_AVAILABLE, celery_app

logger = logging.getLogger(__name__)


async def _daily() -> Dict[str, Any]:
    from app.services.realestate.scheduler import run_daily

    results = await run_daily(AsyncSessionLocal)
    failed = [v for v, r in results.items() if "error" in r]
    logger.info("realestate.daily: %d vendors, %d failed", len(results), len(failed))
    return results


async def _outbox() -> Dict[str, Any]:
    from app.services.realestate.scheduler import run_outbox

    return await run_outbox(AsyncSessionLocal)


def run_daily_now() -> Dict[str, Any]:
    """Synchronous entry point (dev fallback, cron, tests)."""
    return asyncio.run(_daily())


def run_outbox_now() -> Dict[str, Any]:
    return asyncio.run(_outbox())


if CELERY_AVAILABLE and celery_app is not None:

    @celery_app.task(name="realestate.daily")
    def realestate_daily_task() -> Dict[str, Any]:
        return asyncio.run(_daily())

    @celery_app.task(name="realestate.outbox")
    def realestate_outbox_task() -> Dict[str, Any]:
        return asyncio.run(_outbox())

else:  # pragma: no cover - no Celery in this environment

    def realestate_daily_task():  # type: ignore[no-redef]
        return run_daily_now()

    def realestate_outbox_task():  # type: ignore[no-redef]
        return run_outbox_now()
