"""Dedupe partner visits / product views so counters reflect unique visitors."""
from __future__ import annotations

import hashlib
import logging
import time
from typing import Optional

from fastapi import Request

logger = logging.getLogger(__name__)

# One counted view per visitor per entity within this window.
_VIEW_TTL_SEC = 24 * 60 * 60
_memory: dict[str, float] = {}  # key -> expires_at epoch


def visitor_key_from_request(visitor_id: Optional[str], request: Request) -> str:
    """Stable visitor key from client id, or hashed IP+UA fallback."""
    vid = (visitor_id or "").strip()[:120]
    if vid:
        return f"vid:{vid}"
    ip = request.client.host if request.client else "unknown"
    ua = (request.headers.get("user-agent") or "")[:200]
    digest = hashlib.sha256(f"{ip}|{ua}".encode("utf-8")).hexdigest()[:32]
    return f"ip:{digest}"


def _prune_memory(now: float) -> None:
    if len(_memory) < 2000:
        return
    expired = [k for k, exp in _memory.items() if exp <= now]
    for k in expired:
        _memory.pop(k, None)


async def claim_unique_view(kind: str, entity_id: str, visitor_key: str) -> bool:
    """
    Return True if this visitor should increment the counter.

    Uses Redis SET NX when available; falls back to process memory.
    """
    key = f"view:{kind}:{entity_id}:{visitor_key}"
    from app.database import redis_client

    if redis_client:
        try:
            ok = await redis_client.set(key, "1", nx=True, ex=_VIEW_TTL_SEC)
            return bool(ok)
        except Exception as e:
            logger.warning("Redis view-dedupe claim failed: %s", e)

    now = time.time()
    _prune_memory(now)
    exp = _memory.get(key)
    if exp and exp > now:
        return False
    _memory[key] = now + _VIEW_TTL_SEC
    return True
