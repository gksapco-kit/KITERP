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
        sg = await self._load(vendor_id, "sendgrid")
        if sg:
            adapter = SendGridEmailAdapter.from_credentials(sg)
            if adapter:
                return adapter
        smtp_creds = await self._load(vendor_id, "smtp")
        adapter = SmtpEmailAdapter.from_credentials(smtp_creds)
        return adapter

    async def get_sms_adapter(self, vendor_id: UUID) -> Optional[SmsAdapter]:
        creds = await self._load(vendor_id, "twilio_sms")
        if creds:
            return TwilioSmsAdapter.from_credentials(creds)
        # CRM Integrations page saves a single "twilio" provider row
        creds = await self._load(vendor_id, "twilio")
        if creds:
            return TwilioSmsAdapter.from_credentials(creds)
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
