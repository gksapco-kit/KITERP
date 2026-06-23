"""Render CRM marketing template merge tags and rich message bodies."""
from __future__ import annotations

import os
import re
from typing import Any


def read_template_settings(raw: Any) -> dict[str, str]:
    if not raw or not isinstance(raw, dict):
        return {}
    return {
        "cta_label": str(raw.get("cta_label") or "").strip(),
        "cta_url": str(raw.get("cta_url") or "").strip(),
        "footer_text": str(raw.get("footer_text") or "").strip(),
    }


def header_attachment(attachments: Any) -> dict[str, str] | None:
    if not attachments or not isinstance(attachments, list):
        return None
    for item in attachments:
        if isinstance(item, dict) and item.get("is_header"):
            return item
    first = attachments[0] if attachments else None
    return first if isinstance(first, dict) else None


def ensure_public_media_url(url: str | None) -> str | None:
    if not url or not str(url).strip():
        return None
    raw = str(url).strip()
    if raw.startswith("http://") or raw.startswith("https://"):
        return raw
    base = (os.environ.get("PUBLIC_API_BASE_URL") or os.environ.get("API_PUBLIC_URL") or "").strip().rstrip("/")
    if not base:
        return None
    return f"{base}/{raw.lstrip('/')}"


def render_merge_tags(
    text: str,
    *,
    first_name: str = "Priya",
    last_name: str = "Sharma",
    email: str = "priya.sharma@example.com",
    company: str = "Acme Industries",
    vendor_name: str = "Your Business",
    user_name: str = "Alex Kumar",
) -> str:
    if not text:
        return ""
    replacements = {
        "{{contact.first_name}}": first_name,
        "{{contact.last_name}}": last_name,
        "{{contact.email}}": email,
        "{{contact.company}}": company,
        "{{user.name}}": user_name,
        "{{vendor.name}}": vendor_name,
    }
    out = text
    for tag, value in replacements.items():
        out = out.replace(tag, value)
    return out


def format_rich_message_to_html(text: str) -> str:
    if not text or not text.strip():
        return ""

    def inline_fmt(line: str) -> str:
        line = re.sub(r"\*([^*\n]+)\*", r"<strong>\1</strong>", line)
        return re.sub(r"_([^_\n]+)_", r"<em>\1</em>", line)

    parts: list[str] = []
    in_list = False
    for raw in text.split("\n"):
        trimmed = raw.strip()
        is_check = bool(re.match(r"^✅", trimmed)) or bool(re.match(r"^[-•]", trimmed))
        if is_check:
            if not in_list:
                parts.append('<ul class="space-y-1.5 my-2 list-none p-0">')
                in_list = True
            content = re.sub(r"^✅\s*", "", trimmed)
            content = re.sub(r"^[-•]\s*", "", content)
            parts.append(
                f'<li class="flex gap-2 items-start"><span class="shrink-0">✅</span>'
                f"<span>{inline_fmt(content)}</span></li>"
            )
        else:
            if in_list:
                parts.append("</ul>")
                in_list = False
            if trimmed:
                parts.append(f'<p class="my-1 leading-relaxed">{inline_fmt(raw)}</p>')
            else:
                parts.append('<div class="h-2"></div>')
    if in_list:
        parts.append("</ul>")
    return "".join(parts)


def resolve_email_body_html(template: Any) -> str:
    body_text = getattr(template, "body_text", None) or ""
    body_html = getattr(template, "body_html", None) or ""
    if body_text.strip():
        return format_rich_message_to_html(body_text)
    return body_html


def resolve_plain_body(template: Any) -> str:
    body_text = getattr(template, "body_text", None) or ""
    if body_text.strip():
        return body_text
    body_html = getattr(template, "body_html", None) or ""
    if not body_html.strip():
        return ""
    text = re.sub(r"<br\s*/?>", "\n", body_html, flags=re.I)
    text = re.sub(r"</p>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def build_whatsapp_payload(
    template: Any,
    *,
    first_name: str = "Priya",
    last_name: str = "Sharma",
    email: str = "priya.sharma@example.com",
    company: str = "Acme Industries",
    vendor_name: str = "Your Business",
    user_name: str = "Alex Kumar",
) -> dict[str, str | None]:
    """Build Twilio/Meta WhatsApp fields from a CRM marketing template."""
    merge_kwargs = {
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "company": company,
        "vendor_name": vendor_name,
        "user_name": user_name,
    }
    settings = read_template_settings(getattr(template, "settings", None))
    body = render_merge_tags(resolve_plain_body(template) or "Test message", **merge_kwargs)
    footer = render_merge_tags(settings.get("footer_text") or "", **merge_kwargs) or None
    cta_label = render_merge_tags(settings.get("cta_label") or "", **merge_kwargs) or None
    cta_url = render_merge_tags(settings.get("cta_url") or "", **merge_kwargs) or None

    header = header_attachment(getattr(template, "attachments", None))
    media_url = None
    media_type = None
    if header and header.get("type") in ("image", "video"):
        media_type = str(header.get("type") or "image")
        media_url = ensure_public_media_url(str(header.get("url") or ""))

    return {
        "body": body,
        "footer": footer,
        "cta_label": cta_label,
        "cta_url": cta_url,
        "media_url": media_url,
        "media_type": media_type,
    }
