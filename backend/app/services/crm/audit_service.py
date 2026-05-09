"""
CRM audit log helper. Call AuditService.log() from any CRM mutation to create a
crm_audit_log entry. Designed to be called inline from services so the
before/after state is precise.
"""
from __future__ import annotations

import logging
from typing import Any, Optional
from uuid import UUID

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.crm import CrmAuditLog

logger = logging.getLogger(__name__)


def _to_jsonable(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, dict):
        return {k: _to_jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_to_jsonable(v) for v in value]
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            return str(value)
    if hasattr(value, "__table__"):  # SQLAlchemy model
        cols = [c.name for c in value.__table__.columns]
        return {c: _to_jsonable(getattr(value, c, None)) for c in cols}
    return str(value)


class AuditService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def log(
        self,
        *,
        vendor_id: UUID,
        entity: str,
        action: str,
        entity_id: Optional[UUID] = None,
        actor_id: Optional[UUID] = None,
        actor_type: str = "user",
        before: Any = None,
        after: Any = None,
        request: Optional[Request] = None,
        commit: bool = False,
    ) -> CrmAuditLog:
        ip = None
        ua = None
        path = None
        if request is not None:
            ctx = getattr(getattr(request, "state", None), "crm_audit", None)
            if ctx is not None:
                ip = getattr(ctx, "ip", None)
                ua = getattr(ctx, "user_agent", None)
                path = getattr(ctx, "path", None)
            else:
                try:
                    ip = request.client.host if request.client else None
                    ua = request.headers.get("user-agent")
                    path = str(request.url.path)
                except Exception:
                    pass
        row = CrmAuditLog(
            vendor_id=vendor_id,
            actor_id=actor_id,
            actor_type=actor_type,
            entity=entity,
            entity_id=entity_id,
            action=action,
            before=_to_jsonable(before),
            after=_to_jsonable(after),
            ip=ip,
            user_agent=ua[:500] if ua else None,
            request_path=path[:500] if path else None,
        )
        self.db.add(row)
        try:
            if commit:
                await self.db.commit()
            else:
                await self.db.flush()
        except Exception as e:
            logger.error("Failed to write CRM audit log: %s", e)
        return row
