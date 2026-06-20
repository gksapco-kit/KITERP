"""Business-unit message configuration — per-event recipients and customer channel preferences."""
from __future__ import annotations

import re
import uuid
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.store import Store
from app.services.sms_service import is_valid_e164, normalize_e164

MESSAGE_CONFIG_KEY = "message_config"

DEFAULT_CUSTOMER_CHANNELS: dict[str, bool] = {
    "email": True,
    "sms": False,
    "whatsapp": False,
}

DEFAULT_VENDOR_CHANNELS: dict[str, bool] = {
    "email": True,
    "sms": False,
    "whatsapp": False,
}

NOTIFICATION_EVENT_TYPES = (
    "new_orders",
    "order_status_updates",
    "customer_inquiries",
    "system_notifications",
)


class EmailRecipientSchema(BaseModel):
    id: str = Field(..., min_length=1, max_length=64)
    email: EmailStr
    label: Optional[str] = Field(None, max_length=120)

    @field_validator("id", mode="before")
    @classmethod
    def _strip_id(cls, v: Any) -> str:
        return str(v or "").strip()


class PhoneRecipientSchema(BaseModel):
    id: str = Field(..., min_length=1, max_length=64)
    phone: str = Field(..., min_length=5, max_length=20)
    label: Optional[str] = Field(None, max_length=120)

    @field_validator("id", mode="before")
    @classmethod
    def _strip_id(cls, v: Any) -> str:
        return str(v or "").strip()

    @field_validator("phone")
    @classmethod
    def _validate_phone(cls, v: str) -> str:
        normalized = normalize_e164(v)
        if not normalized or not is_valid_e164(normalized):
            raise ValueError("Invalid phone number — use E.164 format (e.g. +919876543210)")
        return normalized


class CustomerChannelsSchema(BaseModel):
    email: bool = True
    sms: bool = False
    whatsapp: bool = False


class VendorChannelsSchema(BaseModel):
    email: bool = True
    sms: bool = False
    whatsapp: bool = False


class EventRecipientsSchema(BaseModel):
    email_recipients: list[EmailRecipientSchema] = Field(default_factory=list)
    phone_recipients: list[PhoneRecipientSchema] = Field(default_factory=list)


class EventsSchema(BaseModel):
    new_orders: EventRecipientsSchema = Field(default_factory=EventRecipientsSchema)
    order_status_updates: EventRecipientsSchema = Field(default_factory=EventRecipientsSchema)
    customer_inquiries: EventRecipientsSchema = Field(default_factory=EventRecipientsSchema)
    system_notifications: EventRecipientsSchema = Field(default_factory=EventRecipientsSchema)


class MessageConfigSchema(BaseModel):
    events: EventsSchema = Field(default_factory=EventsSchema)
    vendor_channels: VendorChannelsSchema = Field(default_factory=VendorChannelsSchema)
    customer_channels: CustomerChannelsSchema = Field(default_factory=CustomerChannelsSchema)


def _dedupe_emails(recipients: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for item in recipients:
        email = str(item.get("email") or "").strip().lower()
        if not email or email in seen:
            continue
        seen.add(email)
        out.append(item)
    return out


def _dedupe_phones(recipients: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for item in recipients:
        phone = normalize_e164(str(item.get("phone") or ""))
        if not phone or phone in seen:
            continue
        seen.add(phone)
        item = dict(item)
        item["phone"] = phone
        out.append(item)
    return out


def _empty_event_recipients() -> dict[str, Any]:
    return {"email_recipients": [], "phone_recipients": []}


def _migrate_legacy_config(raw: dict[str, Any]) -> dict[str, Any]:
    """Convert flat email/phone lists into per-event structure."""
    if "events" in raw and isinstance(raw["events"], dict):
        return raw

    legacy_emails = list(raw.get("email_recipients") or [])
    legacy_phones = list(raw.get("phone_recipients") or [])
    events: dict[str, Any] = {}
    for event_type in NOTIFICATION_EVENT_TYPES:
        if event_type == "new_orders" and (legacy_emails or legacy_phones):
            events[event_type] = {
                "email_recipients": legacy_emails,
                "phone_recipients": legacy_phones,
            }
        else:
            events[event_type] = _empty_event_recipients()
    return {
        "events": events,
        "vendor_channels": raw.get("vendor_channels") or dict(DEFAULT_VENDOR_CHANNELS),
        "customer_channels": raw.get("customer_channels") or dict(DEFAULT_CUSTOMER_CHANNELS),
    }


def _normalize_events_dict(events: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for event_type in NOTIFICATION_EVENT_TYPES:
        block = events.get(event_type) if isinstance(events.get(event_type), dict) else {}
        emails = _dedupe_emails(list(block.get("email_recipients") or []))
        phones = _dedupe_phones(list(block.get("phone_recipients") or []))
        normalized[event_type] = {
            "email_recipients": emails,
            "phone_recipients": phones,
        }
    return normalized


def get_message_config(store: Optional[Store]) -> dict[str, Any]:
    """Return normalized message config from store.settings, or defaults."""
    if not store:
        return default_message_config()
    raw = (store.settings or {}).get(MESSAGE_CONFIG_KEY)
    if not isinstance(raw, dict):
        return default_message_config()
    try:
        migrated = _migrate_legacy_config(raw)
        parsed = MessageConfigSchema.model_validate(migrated)
        dumped = parsed.model_dump()
        dumped["events"] = _normalize_events_dict(dumped.get("events") or {})
        return dumped
    except Exception:
        return default_message_config()


def default_message_config() -> dict[str, Any]:
    return MessageConfigSchema().model_dump()


def validate_and_normalize_message_config(data: dict[str, Any]) -> dict[str, Any]:
    """Validate incoming payload and return normalized config for persistence."""
    migrated = _migrate_legacy_config(data)
    parsed = MessageConfigSchema.model_validate(migrated)
    dumped = parsed.model_dump()
    dumped["events"] = _normalize_events_dict(dumped.get("events") or {})
    return dumped


def merge_message_config_into_store_settings(
    store: Store,
    config: dict[str, Any],
) -> dict[str, Any]:
    merged = dict(store.settings or {})
    merged[MESSAGE_CONFIG_KEY] = config
    return merged


def get_event_block(
    message_config: Optional[dict[str, Any]],
    event_type: str,
) -> dict[str, Any]:
    if not message_config:
        return _empty_event_recipients()
    events = message_config.get("events") or {}
    if not isinstance(events, dict):
        return _empty_event_recipients()
    block = events.get(event_type)
    if isinstance(block, dict):
        return block
    return _empty_event_recipients()


def get_event_email_addresses(
    message_config: Optional[dict[str, Any]],
    event_type: str,
) -> list[str]:
    block = get_event_block(message_config, event_type)
    return [
        str(item.get("email") or "").strip()
        for item in (block.get("email_recipients") or [])
        if str(item.get("email") or "").strip()
    ]


def get_event_phone_numbers(
    message_config: Optional[dict[str, Any]],
    event_type: str,
) -> list[str]:
    block = get_event_block(message_config, event_type)
    phones = [
        normalize_e164(str(item.get("phone") or ""))
        for item in (block.get("phone_recipients") or [])
    ]
    return [p for p in phones if p and is_valid_e164(p)]


def new_recipient_id() -> str:
    return str(uuid.uuid4())


_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def is_valid_email_loose(value: str) -> bool:
    return bool(_EMAIL_RE.match((value or "").strip()))
