"""
Website outgoing webhook dispatcher.

Centralised so that any flow (publish, form submission, order placement,
custom integrations) can fire `wb_webhooks` rows without copy-pasting
the HMAC + httpx plumbing.

All dispatches are best-effort:
  - missing tables / DB errors are swallowed silently;
  - HTTP failures update `last_status_code` to 0 but never raise.

This keeps user-facing flows (checkout, contact submit) decoupled from the
reliability of arbitrary third-party endpoints.
"""
from __future__ import annotations

import hashlib
import hmac as hmac_mod
import json
import logging
from datetime import datetime
from typing import Any, Dict, Iterable, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger(__name__)


def _coerce_uuid(value: Any) -> Optional[UUID]:
    if isinstance(value, UUID):
        return value
    if not value:
        return None
    try:
        return UUID(str(value))
    except Exception:
        return None


async def dispatch_event(
    db: AsyncSession,
    *,
    site_id: Any,
    event: str,
    payload: Dict[str, Any],
) -> int:
    """
    Fire active outgoing webhooks for a single site + event pair.

    Returns the number of webhooks attempted. If the website tables are
    unavailable (e.g. tenant has not opted in yet), returns 0 silently.
    """
    site_uuid = _coerce_uuid(site_id)
    if not site_uuid:
        return 0

    try:
        from app.models.website import WebsiteWebhook
    except Exception:
        return 0

    try:
        result = await db.execute(
            select(WebsiteWebhook).where(
                WebsiteWebhook.site_id == site_uuid,
                WebsiteWebhook.event == event,
                WebsiteWebhook.is_active.is_(True),
            )
        )
        hooks = result.scalars().all()
    except Exception:
        return 0
    if not hooks:
        return 0

    import httpx
    body = {"event": event, "site_id": str(site_uuid), **payload}
    body_bytes = json.dumps(body, default=str).encode()

    for wh in hooks:
        sig = ""
        if wh.secret:
            sig = hmac_mod.new(wh.secret.encode(), body_bytes, hashlib.sha256).hexdigest()
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    wh.url,
                    content=body_bytes,
                    headers={
                        "Content-Type": "application/json",
                        "X-Webhook-Event": event,
                        "X-Webhook-Signature": sig,
                    },
                )
            wh.last_status_code = resp.status_code
        except Exception:  # network / timeout / DNS
            wh.last_status_code = 0
        wh.last_triggered_at = datetime.utcnow()

    try:
        await db.commit()
    except Exception:
        await db.rollback()

    return len(hooks)


async def dispatch_event_for_vendor(
    db: AsyncSession,
    *,
    vendor_id: Any,
    event: str,
    payload: Dict[str, Any],
    only_published: bool = True,
) -> int:
    """
    Resolve every site owned by a vendor and dispatch the same event to each.

    Used when the trigger source is not website-scoped (e.g. an order placed
    through the regular business front / POS) but vendors with multiple sites
    still want webhook subscribers to learn about it.
    """
    vendor_uuid = _coerce_uuid(vendor_id)
    if not vendor_uuid:
        return 0

    try:
        from app.models.website import WebsiteSite
    except Exception:
        return 0

    try:
        q = select(WebsiteSite).where(WebsiteSite.vendor_id == vendor_uuid)
        if only_published:
            q = q.where(WebsiteSite.is_published.is_(True))
        sites = (await db.execute(q)).scalars().all()
    except Exception:
        return 0

    total = 0
    for s in sites:
        try:
            total += await dispatch_event(db, site_id=s.id, event=event, payload=payload)
        except Exception as exc:
            log.warning("webhook dispatch for site %s failed: %s", s.id, exc)
    return total


def order_payload(order: Any) -> Dict[str, Any]:
    """Trim an `Order` ORM instance into a JSON-friendly webhook payload."""
    return {
        "order_id": str(getattr(order, "id", "") or ""),
        "order_number": getattr(order, "order_number", None),
        "vendor_id": str(getattr(order, "vendor_id", "") or ""),
        "customer_id": str(getattr(order, "customer_id", "") or "") or None,
        "status": getattr(order, "status", None),
        "payment_status": getattr(order, "payment_status", None),
        "payment_method": getattr(order, "payment_method", None),
        "subtotal": float(getattr(order, "subtotal", 0) or 0),
        "tax_amount": float(getattr(order, "tax_amount", 0) or 0),
        "discount_amount": float(getattr(order, "discount_amount", 0) or 0),
        "shipping_amount": float(getattr(order, "shipping_amount", 0) or 0),
        "total": float(getattr(order, "total", 0) or 0),
        "item_count": int(getattr(order, "item_count", 0) or 0),
        "items": getattr(order, "items", []) or [],
        "currency": getattr(order, "currency", None) or "INR",
        "source": getattr(order, "source", None),
        "placed_at": (getattr(order, "created_at", None) or datetime.utcnow()).isoformat(),
    }


__all__: Iterable[str] = (
    "dispatch_event",
    "dispatch_event_for_vendor",
    "order_payload",
)
