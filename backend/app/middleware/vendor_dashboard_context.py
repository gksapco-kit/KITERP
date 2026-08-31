"""Expose X-Vendor-Id from the current HTTP request to vendor-dashboard helpers."""
from __future__ import annotations

from contextvars import ContextVar
from typing import Optional
from uuid import UUID

from starlette.requests import Request
from starlette.types import ASGIApp, Receive, Scope, Send

from app.api.deps import preferred_vendor_id_from_request

_preferred_vendor_id: ContextVar[Optional[UUID]] = ContextVar(
    "preferred_vendor_id",
    default=None,
)


def get_preferred_vendor_id_from_context() -> Optional[UUID]:
    return _preferred_vendor_id.get()


class VendorDashboardContextMiddleware:
    """Pure ASGI — BaseHTTPMiddleware buffers the body and can 500 file uploads."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        request = Request(scope)
        token = _preferred_vendor_id.set(preferred_vendor_id_from_request(request))
        try:
            await self.app(scope, receive, send)
        finally:
            _preferred_vendor_id.reset(token)
