"""Calendar adapters (Google, Outlook). Both speak OAuth - we expect the
caller to have already obtained an access_token from the provider."""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.integrations.base import CalendarAdapter

logger = logging.getLogger(__name__)


class GoogleCalendarAdapter(CalendarAdapter):
    provider = "google_calendar"

    def __init__(self, access_token: str, calendar_id: str = "primary"):
        self.access_token = access_token
        self.calendar_id = calendar_id

    @classmethod
    def from_credentials(cls, creds: dict[str, Any] | None) -> "GoogleCalendarAdapter | None":
        creds = creds or {}
        if not creds.get("access_token"):
            return None
        return cls(
            access_token=creds["access_token"],
            calendar_id=creds.get("calendar_id", "primary"),
        )

    async def create_event(self, *, title: str, starts_at: str, ends_at: str,
                           attendees: list[str] | None = None,
                           description: str | None = None) -> dict[str, Any]:
        body = {
            "summary": title,
            "description": description or "",
            "start": {"dateTime": starts_at},
            "end": {"dateTime": ends_at},
        }
        if attendees:
            body["attendees"] = [{"email": e} for e in attendees]
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"https://www.googleapis.com/calendar/v3/calendars/{self.calendar_id}/events",
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    json=body,
                )
            data = resp.json() if resp.content else {}
            if resp.status_code in (200, 201):
                return {"ok": True, "provider": self.provider, "id": data.get("id"), "htmlLink": data.get("htmlLink")}
            return {"ok": False, "provider": self.provider, "error": str(data)[:300]}
        except Exception as e:
            logger.warning("Google calendar failed: %s", e)
            return {"ok": False, "provider": self.provider, "error": str(e)}


class OutlookCalendarAdapter(CalendarAdapter):
    provider = "outlook_calendar"

    def __init__(self, access_token: str):
        self.access_token = access_token

    @classmethod
    def from_credentials(cls, creds: dict[str, Any] | None) -> "OutlookCalendarAdapter | None":
        creds = creds or {}
        if not creds.get("access_token"):
            return None
        return cls(access_token=creds["access_token"])

    async def create_event(self, *, title: str, starts_at: str, ends_at: str,
                           attendees: list[str] | None = None,
                           description: str | None = None) -> dict[str, Any]:
        body = {
            "subject": title,
            "body": {"contentType": "HTML", "content": description or ""},
            "start": {"dateTime": starts_at, "timeZone": "UTC"},
            "end": {"dateTime": ends_at, "timeZone": "UTC"},
        }
        if attendees:
            body["attendees"] = [
                {"emailAddress": {"address": e}, "type": "required"} for e in attendees
            ]
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    "https://graph.microsoft.com/v1.0/me/events",
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    json=body,
                )
            data = resp.json() if resp.content else {}
            if resp.status_code in (200, 201):
                return {"ok": True, "provider": self.provider, "id": data.get("id"), "webLink": data.get("webLink")}
            return {"ok": False, "provider": self.provider, "error": str(data)[:300]}
        except Exception as e:
            logger.warning("Outlook calendar failed: %s", e)
            return {"ok": False, "provider": self.provider, "error": str(e)}
