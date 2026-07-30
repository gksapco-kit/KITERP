"""Business-unit message configuration — notification recipients and customer channels."""
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_vendor_id, require_permission
from app.api.v1.vendor_stores import _get_store_or_404, _store_to_dict
from app.database import get_db
from app.services.message_config_service import (
    default_message_config,
    get_message_config,
    merge_message_config_into_store_settings,
    validate_and_normalize_message_config,
)
from app.services.integration_defaults_service import get_delivery_status
from app.services.crm.services import IntegrationService

router = APIRouter(dependencies=[Depends(require_permission("settings.edit"))])


class MessageConfigUpdate(BaseModel):
    events: dict[str, Any] = {}
    vendor_channels: dict[str, bool] = {}
    customer_channels: dict[str, bool] = {}


class DeliveryChannelStatus(BaseModel):
    ready: bool = False
    provider: str | None = None
    missing: list[str] = []


class DeliveryStatusResponse(BaseModel):
    email: DeliveryChannelStatus
    sms: DeliveryChannelStatus
    whatsapp: DeliveryChannelStatus
    integrations_url: str = "/crm/integrations"


@router.get("/message-delivery-status", response_model=DeliveryStatusResponse)
async def get_message_delivery_status(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Which delivery channels are configured (integrations + platform .env)."""
    integrations = await IntegrationService(db).list(vendor_id)
    return DeliveryStatusResponse(**get_delivery_status(integrations))


@router.get("/stores/{store_id}/message-config")
async def get_store_message_config(
    store_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Return BU-level notification recipients and customer channel preferences."""
    store = await _get_store_or_404(store_id, vendor_id, db)
    config = get_message_config(store)
    return {
        "store_id": str(store.id),
        "store_name": store.name,
        "message_config": config,
    }


@router.put("/stores/{store_id}/message-config")
async def update_store_message_config(
    store_id: UUID,
    data: MessageConfigUpdate,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Save BU-level notification recipients and customer channel preferences."""
    store = await _get_store_or_404(store_id, vendor_id, db)
    try:
        normalized = validate_and_normalize_message_config(data.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    store.settings = merge_message_config_into_store_settings(store, normalized)
    await db.commit()
    await db.refresh(store)
    return {
        "store": _store_to_dict(store),
        "message_config": get_message_config(store),
        "message": "Message configuration saved",
    }
