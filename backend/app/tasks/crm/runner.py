"""
Helper to dispatch CRM background work either via Celery (production) or inline
(dev/testing without a broker). All callables receive a fresh AsyncSession.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Awaitable, Callable

from app.database import AsyncSessionLocal
from app.worker import CELERY_AVAILABLE, celery_app

logger = logging.getLogger(__name__)


async def _with_session(coro_factory: Callable[[Any], Awaitable[Any]]):
    async with AsyncSessionLocal() as session:
        try:
            return await coro_factory(session)
        finally:
            await session.close()


def schedule(name: str, coro_factory: Callable[[Any], Awaitable[Any]], *, eta_seconds: float = 0.0) -> None:
    """Run a coroutine factory soon. Uses Celery when available (best-effort),
    otherwise schedules an asyncio task in the current event loop."""
    if CELERY_AVAILABLE and celery_app is not None:
        try:
            # Send a generic dispatch task; the per-task modules register their own
            # entry points but we keep a simple "fire and forget" path here for
            # ad-hoc callers that don't have a registered task name.
            from app.tasks.crm.send_email import dispatch_inline  # circular-safe at call time
            dispatch_inline.apply_async(args=[name], countdown=eta_seconds)
            return
        except Exception as e:
            logger.debug("Celery dispatch fell back to inline: %s", e)

    async def _run():
        if eta_seconds > 0:
            await asyncio.sleep(eta_seconds)
        try:
            await _with_session(coro_factory)
        except Exception as e:
            logger.exception("Inline CRM task '%s' failed: %s", name, e)

    try:
        loop = asyncio.get_event_loop()
        loop.create_task(_run())
    except RuntimeError:
        asyncio.run(_run())
