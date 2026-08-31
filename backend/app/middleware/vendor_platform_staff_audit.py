"""
Log successful mutating vendor-dashboard requests when the actor is a platform
support user (vendor membership role ``platform_staff``).

Uses a separate DB session after the request so audit writes never interfere with
the route transaction.

Pure ASGI — BaseHTTPMiddleware buffers the body and can 500 file uploads.
"""
from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from starlette.requests import Request
from starlette.types import ASGIApp, Receive, Scope, Send

from app.api.deps import normalized_vendor_role, preferred_vendor_id_from_request
from app.config import settings
from app.core.security import decode_token
from app.database import AsyncSessionLocal
from app.repositories.user_repo import UserRepository
from app.repositories.vendor_user_repo import VendorUserRepository
from app.services.vendor_platform_audit_service import (
    ACTION_PLATFORM_STAFF_API_WRITE,
    log_vendor_platform_audit,
)

logger = logging.getLogger(__name__)

WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


def _bearer_token(request: Request) -> Optional[str]:
    auth = request.headers.get("authorization") or ""
    if not auth.lower().startswith("bearer "):
        return None
    return auth[7:].strip() or None


class VendorPlatformStaffMutationAuditMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope)
        status_code: Optional[int] = None

        async def send_wrapper(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message.get("status")
            await send(message)

        await self.app(scope, receive, send_wrapper)

        path = request.url.path or ""
        prefix = f"{settings.API_V1_PREFIX}/vendors/me"
        if not path.startswith(prefix):
            return
        if request.method not in WRITE_METHODS:
            return
        if status_code is None or status_code < 200 or status_code >= 300:
            return

        token = _bearer_token(request)
        if not token:
            return

        payload = decode_token(token)
        if not payload or payload.get("type") != "access":
            return

        raw_uid = payload.get("sub")
        if not raw_uid:
            return
        try:
            user_id = UUID(str(raw_uid))
        except (ValueError, TypeError):
            return

        pref = preferred_vendor_id_from_request(request)
        detail = {
            "method": request.method,
            "path": path[:512],
            "status_code": status_code,
        }

        try:
            async with AsyncSessionLocal() as db:
                user_repo = UserRepository(db)
                user = await user_repo.get_by_id(user_id)
                if not user or not user.is_active:
                    return

                vu_repo = VendorUserRepository(db)
                vu = None
                if pref is not None:
                    vu = await vu_repo.get_user_with_role(pref, user_id)
                if vu is None:
                    vu = await vu_repo.get_by_user_id(user_id)
                if vu is None or normalized_vendor_role(vu) != "platform_staff":
                    return

                await log_vendor_platform_audit(
                    db,
                    vendor_id=vu.vendor_id,
                    actor_user_id=user_id,
                    action=ACTION_PLATFORM_STAFF_API_WRITE,
                    detail=detail,
                    request=request,
                )
                await db.commit()
        except Exception as e:
            logger.warning("vendor platform_staff mutation audit skipped: %s", e)
