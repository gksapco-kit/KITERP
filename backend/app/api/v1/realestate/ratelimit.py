"""Small fixed-window rate limiter for the unauthenticated customer-portal endpoints.

Uses Redis when it is connected (shared across workers) and falls back to a per-process memory
window otherwise, so it never blocks a request because Redis is down.
"""
from __future__ import annotations

import hashlib
import threading
import time
from collections import defaultdict
from typing import Optional

from fastapi import HTTPException, Request

IP_LIMIT, IP_WINDOW = 300, 60          # every portal call from one address
READ_LIMIT, READ_WINDOW = 120, 60      # reads per link
WRITE_LIMIT, WRITE_WINDOW = 20, 60     # tickets / comments / feedback per link

_lock = threading.Lock()
_hits: dict[str, list[float]] = defaultdict(list)


def client_ip(request: Request) -> str:
    fwd = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if fwd:
        return fwd[:64]
    return (request.client.host if request.client and request.client.host else "unknown")[:64]


def _memory_hit(key: str, limit: int, window: int) -> bool:
    """Record a hit; return True when the caller is over the limit."""
    now = time.time()
    with _lock:
        bucket = [t for t in _hits[key] if now - t < window]
        over = len(bucket) >= limit
        if not over:
            bucket.append(now)
        _hits[key] = bucket
        if len(_hits) > 20000:
            for k in [k for k, v in _hits.items() if not v or now - v[-1] > window][:5000]:
                _hits.pop(k, None)
        return over


async def _over_limit(key: str, limit: int, window: int) -> bool:
    try:
        from app import database

        client = database.redis_client
        if client is not None:
            rk = f"re:rl:{key}:{int(time.time() // window)}"
            n = await client.incr(rk)
            if n == 1:
                await client.expire(rk, window + 5)
            return n > limit
    except Exception:  # Redis hiccup: fall back to the in-process window
        pass
    return _memory_hit(key, limit, window)


def reset_memory() -> None:
    """Test helper."""
    with _lock:
        _hits.clear()


def _token_of(request: Request) -> Optional[str]:
    return request.headers.get("x-portal-token") or None


async def portal_rate_limit(request: Request) -> None:
    """FastAPI dependency: per-address and per-link limits, stricter for writes."""
    ip = client_ip(request)
    token = _token_of(request)
    if await _over_limit(f"ip:{ip}", IP_LIMIT, IP_WINDOW):
        raise HTTPException(status_code=429, detail="Too many requests. Please slow down and try again shortly.",
                            headers={"Retry-After": str(IP_WINDOW)})
    if token:
        who = hashlib.sha256(token.encode()).hexdigest()[:24]
        write = request.method.upper() in ("POST", "PUT", "PATCH", "DELETE")
        limit, window = (WRITE_LIMIT, WRITE_WINDOW) if write else (READ_LIMIT, READ_WINDOW)
        if await _over_limit(f"tok:{'w' if write else 'r'}:{who}", limit, window):
            raise HTTPException(status_code=429, detail="Too many requests. Please slow down and try again shortly.",
                                headers={"Retry-After": str(window)})
