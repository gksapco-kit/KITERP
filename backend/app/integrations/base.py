"""Base classes for CRM integration adapters."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class EmailAdapter(ABC):
    provider: str = "generic_email"

    @abstractmethod
    async def send(self, *, to: str, subject: str, html: str | None = None,
                   text: str | None = None, from_addr: str | None = None,
                   reply_to: str | None = None) -> dict[str, Any]:
        ...


class SmsAdapter(ABC):
    provider: str = "generic_sms"

    @abstractmethod
    async def send(self, *, to: str, body: str, from_number: str | None = None) -> dict[str, Any]:
        ...


class WhatsAppAdapter(ABC):
    provider: str = "generic_whatsapp"

    @abstractmethod
    async def send(
        self, *, to: str, body: str,
        media_url: str | None = None,
        footer: str | None = None,
        cta_label: str | None = None,
        cta_url: str | None = None,
        media_type: str | None = None,
    ) -> dict[str, Any]:
        ...


class VoiceAdapter(ABC):
    provider: str = "generic_voice"

    @abstractmethod
    async def call(self, *, to: str, twiml_url: str | None = None,
                   from_number: str | None = None) -> dict[str, Any]:
        ...


class CalendarAdapter(ABC):
    provider: str = "generic_calendar"

    @abstractmethod
    async def create_event(self, *, title: str, starts_at: str, ends_at: str,
                           attendees: list[str] | None = None,
                           description: str | None = None) -> dict[str, Any]:
        ...


class AiAdapter(ABC):
    provider: str = "generic_ai"

    @abstractmethod
    async def complete(self, prompt: str, *, system: str | None = None,
                       max_tokens: int = 500) -> str:
        ...
