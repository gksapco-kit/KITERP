# app/services/vendor_platform_audit_service.py
from __future__ import annotations

import logging
from typing import Any, Optional
from uuid import UUID

from fastapi import Request
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vendor_platform_audit import VendorPlatformAuditLog

logger = logging.getLogger(__name__)

# Well-known ``VendorPlatformAuditLog.action`` values
ACTION_VENDOR_HANDOFF_REDEEMED = "vendor_handoff_redeemed"
ACTION_PLATFORM_STAFF_API_WRITE = "platform_staff_api_write"


def _request_ip(request: Optional[Request]) -> Optional[str]:
    if request is None:
        return None
    try:
        return request.client.host if request.client else None
    except Exception:
        return None


async def log_vendor_platform_audit(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    actor_user_id: Optional[UUID],
    action: str,
    detail: Any = None,
    request: Optional[Request] = None,
) -> None:
    payload = jsonable_encoder(detail) if detail is not None else None
    row = VendorPlatformAuditLog(
        vendor_id=vendor_id,
        actor_user_id=actor_user_id,
        action=action,
        detail=payload,
        ip=_request_ip(request),
    )
    db.add(row)
    try:
        await db.flush()
    except Exception as e:
        logger.error("vendor_platform_audit write failed: %s", e)
