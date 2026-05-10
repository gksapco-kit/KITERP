from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class VendorPlatformAuditEntry(BaseModel):
    id: UUID
    actor_user_id: Optional[UUID] = None
    actor_email: Optional[str] = None
    action: str
    detail: Optional[dict[str, Any]] = None
    ip: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class VendorPlatformAuditListResponse(BaseModel):
    items: List[VendorPlatformAuditEntry]
    total: int = Field(ge=0)
