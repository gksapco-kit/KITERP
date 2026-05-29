"""Expose X-Vendor-Id from the current HTTP request to vendor-dashboard helpers."""
from __future__ import annotations

from contextvars import ContextVar
from typing import Optional
from uuid import UUID

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.api.deps import preferred_vendor_id_from_request

_preferred_vendor_id: ContextVar[Optional[UUID]] = ContextVar(
    "preferred_vendor_id",
    default=None,
)


def get_preferred_vendor_id_from_context() -> Optional[UUID]:
    return _preferred_vendor_id.get()


class VendorDashboardContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        token = _preferred_vendor_id.set(preferred_vendor_id_from_request(request))
        try:
            return await call_next(request)
        finally:
            _preferred_vendor_id.reset(token)
