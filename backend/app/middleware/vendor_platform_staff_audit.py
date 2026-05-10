"""
Log successful mutating vendor-dashboard requests when the actor is a platform
support user (vendor membership role ``platform_staff``).

Uses a separate DB session after the request so audit writes never interfere with
the route transaction.
"""
from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

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


class VendorPlatformStaffMutationAuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        path = request.url.path or ""
        prefix = f"{settings.API_V1_PREFIX}/vendors/me"
        if not path.startswith(prefix):
            return response
        if request.method not in WRITE_METHODS:
            return response
        if response.status_code < 200 or response.status_code >= 300:
            return response

        token = _bearer_token(request)
        if not token:
            return response

        payload = decode_token(token)
        if not payload or payload.get("type") != "access":
            return response

        raw_uid = payload.get("sub")
        if not raw_uid:
            return response
        try:
            user_id = UUID(str(raw_uid))
        except (ValueError, TypeError):
            return response

        pref = preferred_vendor_id_from_request(request)
        detail = {
            "method": request.method,
            "path": path[:512],
            "status_code": response.status_code,
        }

        try:
            async with AsyncSessionLocal() as db:
                user_repo = UserRepository(db)
                user = await user_repo.get_by_id(user_id)
                if not user or not user.is_active:
                    return response

                vu_repo = VendorUserRepository(db)
                vu = None
                if pref is not None:
                    vu = await vu_repo.get_user_with_role(pref, user_id)
                if vu is None:
                    vu = await vu_repo.get_by_user_id(user_id)
                if vu is None or normalized_vendor_role(vu) != "platform_staff":
                    return response

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

        return response
