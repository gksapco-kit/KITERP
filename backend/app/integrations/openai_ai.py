"""OpenAI-compatible chat completion adapter."""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.integrations.base import AiAdapter

logger = logging.getLogger(__name__)


class OpenAIAdapter(AiAdapter):
    provider = "openai"

    def __init__(self, api_key: str, model: str = "gpt-4o-mini",
                 base_url: str = "https://api.openai.com/v1"):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")

    @classmethod
    def from_credentials(cls, creds: dict[str, Any] | None) -> "OpenAIAdapter | None":
        creds = creds or {}
        if not creds.get("api_key"):
            return None
        return cls(
            api_key=creds["api_key"],
            model=creds.get("model") or "gpt-4o-mini",
            base_url=creds.get("base_url") or "https://api.openai.com/v1",
        )

    async def complete(self, prompt: str, *, system: str | None = None,
                       max_tokens: int = 500) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json={
                        "model": self.model,
                        "messages": messages,
                        "max_tokens": max_tokens,
                        "temperature": 0.4,
                    },
                )
            if resp.status_code != 200:
                logger.warning("OpenAI returned %s: %s", resp.status_code, resp.text[:200])
                return ""
            data = resp.json()
            choices = data.get("choices") or []
            if not choices:
                return ""
            return (choices[0].get("message", {}).get("content") or "").strip()
        except Exception as e:
            logger.warning("OpenAI call failed: %s", e)
            return ""
