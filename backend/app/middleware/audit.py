"""
CRM audit context middleware.

For every request hitting a CRM route (``/api/v1/vendors/me/crm/...``),
this attaches a small ``CrmAuditContext`` object to ``request.state.crm_audit``
containing ip, user-agent, request path, HTTP method and request id.
``app.services.crm.audit_service.AuditService`` reads this when writing rows
to ``crm_audit_log`` so service-layer code does not need to thread the
``Request`` object through every call.

The middleware is intentionally lightweight: it does **not** persist anything
on its own. Precise before/after diffs are recorded by services calling
``AuditService.log(...)`` inline.
"""
from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass
from typing import Optional

from starlette.datastructures import MutableHeaders
from starlette.requests import Request
from starlette.types import ASGIApp, Receive, Scope, Send

logger = logging.getLogger(__name__)

CRM_PATH_PREFIX = "/api/v1/vendors/me/crm"
CRM_PUBLIC_PREFIX = "/api/v1/public/crm"
WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


@dataclass
class CrmAuditContext:
    request_id: str
    ip: Optional[str]
    user_agent: Optional[str]
    method: str
    path: str
    started_at: float


class CrmAuditMiddleware:
    """Attach per-request audit context for CRM endpoints.

    Adds ``X-Request-Id`` to the response so audit rows can be correlated to
    HTTP requests in logs.

    Pure ASGI — BaseHTTPMiddleware buffers the body and can 500 file uploads.
    """

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope)
        path = request.url.path or ""
        is_crm = path.startswith(CRM_PATH_PREFIX) or path.startswith(CRM_PUBLIC_PREFIX)

        if is_crm:
            ip: Optional[str] = None
            try:
                ip = request.client.host if request.client else None
            except Exception:
                ip = None
            forwarded = request.headers.get("x-forwarded-for")
            if forwarded:
                ip = forwarded.split(",", 1)[0].strip()

            ctx = CrmAuditContext(
                request_id=request.headers.get("x-request-id") or uuid.uuid4().hex,
                ip=ip,
                user_agent=(request.headers.get("user-agent") or None),
                method=request.method,
                path=path,
                started_at=time.monotonic(),
            )
            request.state.crm_audit = ctx

        async def send_wrapper(message):
            if is_crm and message["type"] == "http.response.start":
                try:
                    ctx = request.state.crm_audit
                    headers = MutableHeaders(raw=message.setdefault("headers", []))
                    headers["X-Request-Id"] = ctx.request_id
                    if request.method in WRITE_METHODS:
                        elapsed_ms = int((time.monotonic() - ctx.started_at) * 1000)
                        logger.debug(
                            "crm.audit method=%s path=%s status=%s ms=%s req_id=%s",
                            ctx.method, ctx.path, message.get("status"), elapsed_ms, ctx.request_id,
                        )
                except Exception:
                    pass
            await send(message)

        await self.app(scope, receive, send_wrapper)


def install(app) -> None:
    """Register the middleware on a FastAPI app. Idempotent."""
    flag = "_crm_audit_middleware_installed"
    if getattr(app.state, flag, False):
        return
    app.add_middleware(CrmAuditMiddleware)
    app.state._crm_audit_middleware_installed = True
