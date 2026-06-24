"""
Per-vendor integration registry. Loads encrypted credentials from
``crm_integration`` rows and returns a ready-to-use adapter for each channel.
Falls back to platform defaults (SMTP) when nothing else is configured.
"""
from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import decrypt_json
from app.config import settings
from app.integrations.base import (
    AiAdapter, CalendarAdapter, EmailAdapter, SmsAdapter,
    VoiceAdapter, WhatsAppAdapter,
)
from app.integrations.calendars import GoogleCalendarAdapter, OutlookCalendarAdapter
from app.integrations.email_sendgrid import SendGridEmailAdapter
from app.integrations.email_smtp import SmtpEmailAdapter
from app.integrations.meta_whatsapp import MetaWhatsAppAdapter
from app.integrations.openai_ai import OpenAIAdapter
from app.integrations.twilio import TwilioSmsAdapter, TwilioVoiceAdapter, TwilioWhatsAppAdapter

logger = logging.getLogger(__name__)


class IntegrationRegistry:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _load(self, vendor_id: UUID, provider: str) -> Optional[dict]:
        from app.models.crm import CrmIntegration

        row = await self.db.execute(
            select(CrmIntegration).where(
                CrmIntegration.vendor_id == vendor_id,
                CrmIntegration.provider == provider,
                CrmIntegration.status == "connected",
            )
        )
        integ = row.scalar_one_or_none()
        if not integ:
            return None
        creds = decrypt_json(integ.encrypted_credentials) or {}
        creds.update(integ.settings or {})
        return creds

    async def get_email_adapter(self, vendor_id: UUID) -> Optional[EmailAdapter]:
        from app.services.email_service import resolve_effective_sendgrid_key, sendgrid_api_key

        def _sendgrid_adapter(creds: dict, *, from_email: str | None = None) -> Optional[EmailAdapter]:
            api_key = resolve_effective_sendgrid_key(creds)
            if not api_key:
                return None
            payload = {
                **creds,
                "api_key": api_key,
                "from_email": (
                    creds.get("from")
                    or creds.get("from_email")
                    or from_email
                    or settings.FROM_EMAIL
                ),
                "from_name": creds.get("from_name"),
            }
            return SendGridEmailAdapter.from_credentials(payload)

        sg = await self._load(vendor_id, "sendgrid")
        if sg:
            adapter = _sendgrid_adapter(sg)
            if adapter:
                return adapter

        smtp_creds = await self._load(vendor_id, "smtp")
        if smtp_creds:
            host = str(smtp_creds.get("host") or "").lower()
            user = str(smtp_creds.get("username") or smtp_creds.get("user") or "").lower()
            api_key = resolve_effective_sendgrid_key(smtp_creds)
            if api_key or user == "apikey" or "sendgrid" in host:
                adapter = _sendgrid_adapter(smtp_creds)
                if adapter:
                    return adapter
            adapter = SmtpEmailAdapter.from_credentials(smtp_creds)
            if adapter:
                return adapter

        platform_key = sendgrid_api_key()
        if platform_key:
            adapter = _sendgrid_adapter(
                {"api_key": platform_key},
                from_email=settings.FROM_EMAIL,
            )
            if adapter:
                return adapter
        return SmtpEmailAdapter.from_credentials(None)

    async def get_sms_adapter(self, vendor_id: UUID) -> Optional[SmsAdapter]:
        from app.config import settings
        from app.services.integration_defaults_service import merge_platform_defaults

        def _merge_platform(creds: dict | None) -> dict:
            merged = dict(creds or {})
            platform_creds, platform_settings = merge_platform_defaults("twilio", {}, {})
            for key, value in platform_creds.items():
                if value and not merged.get(key):
                    merged[key] = value
            for key, value in platform_settings.items():
                if value and not merged.get(key):
                    merged[key] = value
            if not merged.get("from_number") and (settings.TWILIO_FROM_NUMBER or "").strip():
                merged["from_number"] = settings.TWILIO_FROM_NUMBER.strip()
            if not merged.get("account_sid") and (settings.TWILIO_ACCOUNT_SID or "").strip():
                merged["account_sid"] = settings.TWILIO_ACCOUNT_SID.strip()
            if not merged.get("auth_token") and (settings.TWILIO_AUTH_TOKEN or "").strip():
                merged["auth_token"] = settings.TWILIO_AUTH_TOKEN.strip()
            return merged

        creds = await self._load(vendor_id, "twilio_sms")
        if creds:
            return TwilioSmsAdapter.from_credentials(_merge_platform(creds))
        creds = await self._load(vendor_id, "twilio")
        if creds:
            return TwilioSmsAdapter.from_credentials(_merge_platform(creds))
        platform = _merge_platform({})
        if platform.get("account_sid") and platform.get("auth_token"):
            return TwilioSmsAdapter.from_credentials(platform)
        return None

    async def get_whatsapp_adapter(self, vendor_id: UUID) -> Optional[WhatsAppAdapter]:
        creds = await self._load(vendor_id, "twilio_whatsapp")
        if creds:
            adapter = TwilioWhatsAppAdapter.from_credentials(creds)
            if adapter:
                return adapter
        meta = await self._load(vendor_id, "meta_whatsapp")
        if meta:
            return MetaWhatsAppAdapter.from_credentials(meta)
        # CRM Integrations page saves a single "twilio" provider row
        creds = await self._load(vendor_id, "twilio")
        if creds and (creds.get("whatsapp_from") or "").strip():
            adapter = TwilioWhatsAppAdapter.from_credentials(creds)
            if adapter:
                return adapter
        return None

    async def get_voice_adapter(self, vendor_id: UUID) -> Optional[VoiceAdapter]:
        creds = await self._load(vendor_id, "twilio_voice")
        if creds:
            return TwilioVoiceAdapter.from_credentials(creds)
        # Fall back to twilio_sms creds (same Twilio account can do voice)
        creds = await self._load(vendor_id, "twilio_sms")
        if creds:
            return TwilioVoiceAdapter.from_credentials(creds)
        return None

    async def get_ai_adapter(self, vendor_id: UUID) -> Optional[AiAdapter]:
        creds = await self._load(vendor_id, "openai")
        if creds:
            return OpenAIAdapter.from_credentials(creds)
        return None

    async def get_calendar_adapter(self, vendor_id: UUID,
                                   prefer: str = "google") -> Optional[CalendarAdapter]:
        if prefer == "google":
            creds = await self._load(vendor_id, "google_calendar")
            if creds:
                return GoogleCalendarAdapter.from_credentials(creds)
        creds = await self._load(vendor_id, "outlook")
        if creds:
            return OutlookCalendarAdapter.from_credentials(creds)
        return None
