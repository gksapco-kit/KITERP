# app/services/platform_staff_audit_service.py
from __future__ import annotations

import logging
from typing import Any, Optional
from uuid import UUID

from fastapi import Request
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.platform_staff_audit import PlatformStaffAuditLog

logger = logging.getLogger(__name__)

ACTION_PLATFORM_LOGIN = "platform_login"
ACTION_SUPPORT_ACCESS_CREATED = "support_access_created"
ACTION_SUPPORT_PROFILE_UPDATED = "support_profile_updated"
ACTION_SUPPORT_ACCESS_REMOVED = "support_access_removed"
ACTION_SUPPORT_PASSWORD_RESET = "support_password_reset"
ACTION_VENDOR_DASHBOARD_HANDOFF = "vendor_dashboard_handoff"


def _request_meta(request: Optional[Request]) -> tuple[Optional[str], Optional[str], Optional[str]]:
    if request is None:
        return None, None, None
    ip = None
    ua = None
    path = None
    try:
        ip = request.client.host if request.client else None
        ua = request.headers.get("user-agent")
        path = str(request.url.path)
    except Exception:
        pass
    return ip, (ua[:500] if ua else None), (path[:500] if path else None)


async def log_platform_staff_audit(
    db: AsyncSession,
    *,
    subject_user_id: UUID,
    actor_user_id: Optional[UUID],
    action: str,
    detail: Any = None,
    request: Optional[Request] = None,
) -> None:
    """Persist one audit row and flush (caller commits)."""
    ip, ua, path = _request_meta(request)
    payload = jsonable_encoder(detail) if detail is not None else None
    row = PlatformStaffAuditLog(
        subject_user_id=subject_user_id,
        actor_user_id=actor_user_id,
        action=action,
        detail=payload,
        ip=ip,
        user_agent=ua,
        request_path=path,
    )
    db.add(row)
    try:
        await db.flush()
    except Exception as e:
        logger.error("platform_staff_audit write failed: %s", e)
