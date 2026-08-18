"""Order placement notifications — email, SMS, and WhatsApp driven by Create Messages (BU config)."""
from __future__ import annotations

import asyncio
import html
import logging
from dataclasses import dataclass, field
from typing import Any, Literal, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.integrations.registry import IntegrationRegistry
from app.models.customer import Customer
from app.models.order import Order
from app.models.store import Store
from app.models.vendor import Vendor
from app.services.email_service import send_email_for_vendor
from app.services.message_config_service import (
    default_message_config,
    get_message_config,
    get_event_email_addresses,
    get_event_phone_numbers,
    resolve_active_customer_template,
    resolve_active_vendor_template,
    render_customer_template_text,
    render_vendor_template_text,
)
from app.services.sms_service import SmsService, is_valid_e164, normalize_e164

log = logging.getLogger(__name__)

# Twilio errors where retry later may succeed (daily cap, unverified trial number, WA sandbox).
_RETRYABLE_TWILIO_CODES = frozenset({63038, 21608, 63016})

ChannelOutcome = Literal["sent", "skipped", "failed", "failed_retryable"]


@dataclass
class OrderNotificationResult:
    """Tracks whether enabled SMS/WhatsApp channels were delivered."""

    sms_whatsapp_complete: bool = True
    pending_channels: list[str] = field(default_factory=list)

    def should_mark_placement_sent(self) -> bool:
        return self.sms_whatsapp_complete


def _is_retryable_twilio_error(
    code: Optional[int] = None,
    message: Optional[str] = None,
) -> bool:
    if code in _RETRYABLE_TWILIO_CODES:
        return True
    msg = (message or "").lower()
    return "63038" in msg or "50 daily messages" in msg or "daily messages limit" in msg or "63016" in msg


async def _fetch_twilio_message_status(
    account_sid: str,
    auth_token: str,
    message_sid: str,
) -> tuple[str, Optional[int]]:
    import httpx

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages/{message_sid}.json",
            auth=(account_sid, auth_token),
        )
    if resp.status_code != 200:
        return "", None
    data = resp.json()
    code = data.get("error_code")
    return str(data.get("status") or ""), int(code) if code else None


def _log_whatsapp_delivery_hint(recipient_label: str, masked: str, error_code: Optional[int]) -> None:
    if error_code == 63016:
        log.warning(
            "WhatsApp to %s (%s) undelivered — this phone must join the Twilio WhatsApp sandbox "
            "(open WhatsApp on that device, message +1 415 523 8886 with: join <sandbox-code> "
            "from Twilio Console → Messaging → Try WhatsApp).",
            recipient_label,
            masked,
        )
        return
    log.warning(
        "WhatsApp to %s (%s) undelivered (Twilio error %s).",
        recipient_label,
        masked,
        error_code or "unknown",
    )


def _format_whatsapp_from(raw: str) -> str:
    value = (raw or "").strip()
    if not value:
        return ""
    if value.startswith("whatsapp:"):
        return value
    phone = normalize_e164(value)
    return f"whatsapp:{phone}" if phone else ""


async def _attempt_twilio_whatsapp_send(
    *,
    account_sid: str,
    auth_token: str,
    wa_from_raw: str,
    to_phone: str,
    body: str,
    recipient_label: str,
    masked: str,
    order_number: str,
    via_label: str,
) -> ChannelOutcome:
    from app.integrations.twilio import TwilioWhatsAppAdapter

    wa_from = _format_whatsapp_from(wa_from_raw)
    if not wa_from:
        return "skipped"

    adapter = TwilioWhatsAppAdapter(account_sid, auth_token, wa_from)
    try:
        result = await adapter.send(to=to_phone, body=body)
        if not result.get("ok"):
            err = str(result.get("error") or "")
            log.warning(
                "WhatsApp failed via %s for %s on order %s: %s",
                via_label, recipient_label, order_number, err,
            )
            if "Channel" in err or "From address" in err or "63016" in err:
                log.warning(
                    "Set whatsapp_from to your Twilio WhatsApp sender (sandbox: +14155238886). "
                    "Each recipient must join the sandbox on WhatsApp before messages arrive.",
                )
            if _is_retryable_twilio_error(message=err):
                return "failed_retryable"
            return "failed"

        message_sid = result.get("id")
        if message_sid:
            await asyncio.sleep(3)
            status, error_code = await _fetch_twilio_message_status(
                account_sid, auth_token, message_sid,
            )
            if status in {"undelivered", "failed"}:
                _log_whatsapp_delivery_hint(recipient_label, masked, error_code)
                if error_code in _RETRYABLE_TWILIO_CODES:
                    return "failed_retryable"
                return "failed"

        log.info(
            "Order confirmation WhatsApp sent via %s to %s (%s) for order %s",
            via_label, recipient_label, masked, order_number,
        )
        return "sent"
    except Exception as exc:
        log.warning("WhatsApp error via %s for %s on order %s: %s", via_label, recipient_label, order_number, exc)
        return "failed"


def _vendor_notification_settings(vendor: Vendor) -> dict[str, Any]:
    return dict(vendor.settings or {})


def _vendor_channel_enabled(vendor: Vendor, channel: str) -> bool:
    """True when vendor Notification Settings allow a channel for new orders."""
    settings = _vendor_notification_settings(vendor)
    notif = settings.get("notifications") or {}
    events = settings.get("notification_events") or {}
    if not notif.get("notifications_enabled", True):
        return False
    if not notif.get(channel, channel == "email"):
        return False
    if not events.get("new_orders", True):
        return False
    return True


def vendor_order_email_enabled(vendor: Vendor) -> bool:
    return _vendor_channel_enabled(vendor, "email")


def vendor_order_sms_enabled(vendor: Vendor) -> bool:
    return _vendor_channel_enabled(vendor, "sms")


def vendor_order_whatsapp_enabled(vendor: Vendor) -> bool:
    return _vendor_channel_enabled(vendor, "whatsapp")


def _customer_order_updates_allowed(customer_prefs: Optional[dict[str, Any]]) -> bool:
    prefs = customer_prefs or {}
    return prefs.get("orderUpdates") is not False and prefs.get("order_updates") is not False


def _customer_sms_allowed(customer_prefs: Optional[dict[str, Any]]) -> bool:
    prefs = customer_prefs or {}
    if prefs.get("smsEnabled") is False or prefs.get("sms_enabled") is False:
        return False
    return _customer_order_updates_allowed(prefs)


def _order_message_channels(
    message_config: Optional[dict[str, Any]],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Vendor/customer channel prefs from Create Messages (BU config or defaults)."""
    cfg = message_config if message_config is not None else default_message_config()
    vendor_channels = cfg.get("vendor_channels")
    customer_channels = cfg.get("customer_channels")
    return (
        vendor_channels if isinstance(vendor_channels, dict) else {},
        customer_channels if isinstance(customer_channels, dict) else {},
    )


def vendor_bu_order_email_enabled(
    vendor: Vendor,
    message_config: Optional[dict[str, Any]] = None,
) -> bool:
    vendor_channels, _ = _order_message_channels(message_config)
    return bool(vendor_channels.get("email", True))


def vendor_bu_order_sms_enabled(
    vendor: Vendor,
    message_config: Optional[dict[str, Any]] = None,
) -> bool:
    vendor_channels, _ = _order_message_channels(message_config)
    return bool(vendor_channels.get("sms", False))


def vendor_bu_order_whatsapp_enabled(
    vendor: Vendor,
    message_config: Optional[dict[str, Any]] = None,
) -> bool:
    vendor_channels, _ = _order_message_channels(message_config)
    return bool(vendor_channels.get("whatsapp", False))


def customer_order_email_enabled(
    vendor: Vendor,
    customer_prefs: Optional[dict[str, Any]] = None,
    message_config: Optional[dict[str, Any]] = None,
) -> bool:
    _, customer_channels = _order_message_channels(message_config)
    if not customer_channels.get("email", True):
        return False
    return _customer_order_updates_allowed(customer_prefs)


def customer_order_sms_enabled(
    vendor: Vendor,
    customer_prefs: Optional[dict[str, Any]] = None,
    message_config: Optional[dict[str, Any]] = None,
) -> bool:
    """Order confirmation SMS follows BU toggle + order-update opt-out (same as email/WhatsApp)."""
    _, customer_channels = _order_message_channels(message_config)
    if not customer_channels.get("sms", False):
        return False
    return _customer_order_updates_allowed(customer_prefs)


def customer_order_whatsapp_enabled(
    vendor: Vendor,
    customer_prefs: Optional[dict[str, Any]] = None,
    message_config: Optional[dict[str, Any]] = None,
) -> bool:
    _, customer_channels = _order_message_channels(message_config)
    if not customer_channels.get("whatsapp", False):
        return False
    return _customer_order_updates_allowed(customer_prefs)


def _vendor_dashboard_order_url(vendor: Vendor, order_id: UUID) -> str:
    settings = get_settings()
    slug = vendor.slug or vendor.subdomain
    if settings.DEBUG:
        return f"http://127.0.0.1:3001/orders/{order_id}"
    return f"https://{slug}.{settings.BASE_DOMAIN}/orders/{order_id}"


def _storefront_order_status_url(vendor: Vendor, order_id: UUID) -> str:
    settings = get_settings()
    slug = vendor.slug or vendor.subdomain
    if settings.DEBUG:
        return f"http://127.0.0.1:3002/{slug}/order/{order_id}/status"
    return f"https://{slug}.{settings.BASE_DOMAIN}/order/{order_id}/status"


async def _fetch_vendor_owner_phone(db: AsyncSession, vendor_id: UUID) -> str:
    """Phone from vendor owner profile (Dashboard → Personal Information)."""
    from app.models.user import User
    from app.models.vendor_user import VendorUser

    result = await db.execute(
        select(User.phone)
        .join(VendorUser, VendorUser.user_id == User.id)
        .where(
            VendorUser.vendor_id == vendor_id,
            VendorUser.role == "owner",
            VendorUser.is_active.is_(True),
        )
        .limit(1)
    )
    return (result.scalar_one_or_none() or "").strip()


def _pick_vendor_phone(
    *,
    support: Optional[str] = None,
    owner: Optional[str] = None,
    primary: Optional[str] = None,
    sms_phone: Optional[str] = None,
    contact_phone: Optional[str] = None,
) -> str:
    """Sync helper — priority for vendor order SMS/WhatsApp destination."""
    for raw in (sms_phone, contact_phone, support, owner, primary):
        found = _valid_phone(str(raw or ""))
        if found:
            return found
    return ""


async def _resolve_vendor_phone(db: AsyncSession, vendor: Vendor) -> str:
    """Resolve vendor SMS/WhatsApp destination."""
    settings = dict(vendor.settings or {})
    notif = settings.get("notifications") or {}
    owner_phone = await _fetch_vendor_owner_phone(db, vendor.id)
    return _pick_vendor_phone(
        sms_phone=str(notif.get("sms_phone") or ""),
        contact_phone=str(notif.get("contact_phone") or ""),
        support=vendor.support_phone,
        owner=owner_phone,
        primary=vendor.primary_phone,
    )


def _valid_phone(raw: str) -> str:
    val = (raw or "").strip()
    if val and val not in {"-", "—", "N/A", "n/a", "NA"}:
        return val
    return ""


def _customer_phone(customer: Optional[Customer], order: Optional[Order] = None) -> str:
    """Resolve customer SMS destination: profile phone, order shipping, then saved addresses."""
    if customer:
        found = _valid_phone(customer.phone or "")
        if found:
            return found
    if order:
        addr = order.shipping_address if isinstance(order.shipping_address, dict) else {}
        for key in ("phone", "contact", "mobile"):
            found = _valid_phone(str(addr.get(key) or ""))
            if found:
                return found
    if customer:
        addresses = customer.shipping_addresses or []
        if isinstance(addresses, list) and addresses:
            idx = customer.default_address_index or 0
            if 0 <= idx < len(addresses) and isinstance(addresses[idx], dict):
                for key in ("phone", "contact", "mobile"):
                    found = _valid_phone(str(addresses[idx].get(key) or ""))
                    if found:
                        return found
            for entry in addresses:
                if not isinstance(entry, dict):
                    continue
                for key in ("phone", "contact", "mobile"):
                    found = _valid_phone(str(entry.get(key) or ""))
                    if found:
                        return found
    return ""


def _email_layout(
    *,
    brand: str,
    title: str,
    body_html: str,
    cta_label: Optional[str] = None,
    cta_href: Optional[str] = None,
) -> str:
    cta = ""
    if cta_label and cta_href:
        cta = f"""
          <p style="margin:24px 0 0;">
            <a href="{html.escape(cta_href)}" style="display:inline-block; background:#13624A; color:#fff; text-decoration:none; padding:12px 20px; border-radius:8px; font-weight:600; font-size:14px;">{html.escape(cta_label)}</a>
          </p>"""
    return f"""\
<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f7f7fb; padding:24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #ececf5;">
      <tr>
        <td style="background:linear-gradient(135deg,#64C3A0 0%, #13624A 100%); padding:20px 24px; color:#fff;">
          <h2 style="margin:0; font-size:18px; font-weight:600;">{html.escape(brand)}</h2>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <h1 style="margin:0 0 16px; font-size:20px; color:#111827;">{html.escape(title)}</h1>
          {body_html}
          {cta}
        </td>
      </tr>
      <tr>
        <td style="padding:14px 24px; background:#fafafa; border-top:1px solid #ececf5;">
          <p style="margin:0; font-size:11px; color:#9ca3af;">Order notification</p>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def _format_items_rows(items: list[dict]) -> str:
    rows = []
    for item in items[:20]:
        name = html.escape(str(item.get("name") or item.get("title") or "Item"))
        qty = int(item.get("qty") or item.get("quantity") or 1)
        price = float(item.get("price") or item.get("unit_price") or 0)
        line_total = qty * price
        rows.append(
            f"<tr>"
            f"<td style='padding:8px 0; border-bottom:1px solid #f3f4f6; color:#374151;'>{name} × {qty}</td>"
            f"<td style='padding:8px 0; border-bottom:1px solid #f3f4f6; text-align:right; color:#374151;'>₹{line_total:,.2f}</td>"
            f"</tr>"
        )
    if len(items) > 20:
        rows.append(
            "<tr><td colspan='2' style='padding:8px 0; color:#6b7280; font-size:12px;'>"
            f"+ {len(items) - 20} more item(s)</td></tr>"
        )
    if not rows:
        return "<p style='margin:0; color:#6b7280; font-size:14px;'>No line items recorded.</p>"
    return (
        "<table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='margin:12px 0 0; font-size:14px;'>"
        + "".join(rows)
        + "</table>"
    )


def _payment_status_note(order: Order) -> str:
    if order.payment_status == "paid":
        return "Payment received."
    if order.payment_method == "cod":
        return "Payment: Cash on delivery."
    return "Payment is pending — we will confirm once it is completed."


def _customer_template_context(
    ctx: dict[str, Any],
    *,
    customer_name: str,
    channel: str = "email",
) -> dict[str, Any]:
    total = ctx.get("total")
    if isinstance(total, (int, float)):
        total_str = (
            _compact_sms_amount(float(total))
            if channel == "sms"
            else f"₹{float(total):,.2f}"
        )
    else:
        total_str = str(total or "")
    return {
        "customer_name": customer_name,
        "store_name": ctx.get("store_name") or "Your store",
        "order_number": ctx.get("order_number") or "",
        "total": total_str,
        "status": ctx.get("status_label") or "",
        "payment_note": ctx.get("payment_note") or "",
    }


def _render_customer_template_message(
    message_config: Optional[dict[str, Any]],
    event_type: str,
    channel: str,
    ctx: dict[str, Any],
    *,
    customer_name: str,
) -> Optional[tuple[str, str]]:
    """Return (subject, body) when an active scheduled template exists; else None."""
    active = resolve_active_customer_template(message_config, event_type, channel)
    if not active:
        return None
    template_ctx = _customer_template_context(ctx, customer_name=customer_name, channel=channel)
    message = render_customer_template_text(str(active.get("message") or ""), template_ctx).strip()
    if not message:
        return None
    default_subject = f"Order #{template_ctx['order_number']} confirmed — {template_ctx['store_name']}"
    subject_raw = str(active.get("subject") or default_subject)
    subject = render_customer_template_text(subject_raw, template_ctx).strip() or default_subject
    return subject, message


def _vendor_template_context(ctx: dict[str, Any], *, channel: str = "email") -> dict[str, Any]:
    total = ctx.get("total")
    if isinstance(total, (int, float)):
        total_str = (
            _compact_sms_amount(float(total))
            if channel == "sms"
            else f"₹{float(total):,.2f}"
        )
    else:
        total_str = str(total or "")
    return {
        "customer_name": ctx.get("customer_name") or "Customer",
        "store_name": ctx.get("store_name") or "Your store",
        "order_number": ctx.get("order_number") or "",
        "total": total_str,
        "status": ctx.get("status_label") or "",
    }


def _render_vendor_template_message(
    message_config: Optional[dict[str, Any]],
    event_type: str,
    channel: str,
    ctx: dict[str, Any],
) -> Optional[tuple[str, str]]:
    """Return (subject, body) when an active vendor template exists; else None."""
    active = resolve_active_vendor_template(message_config, event_type, channel)
    if not active:
        return None
    template_ctx = _vendor_template_context(ctx, channel=channel)
    message = render_vendor_template_text(str(active.get("message") or ""), template_ctx).strip()
    if not message:
        return None
    default_subject = f"New order #{template_ctx['order_number']} — {template_ctx['store_name']}"
    subject_raw = str(active.get("subject") or default_subject)
    subject = render_vendor_template_text(subject_raw, template_ctx).strip() or default_subject
    return subject, message


def _compact_sms_amount(total: float) -> str:
    """GSM-7 friendly amount — avoid ₹ which forces UCS-2 and burns trial segments."""
    amount = float(total or 0)
    if amount == int(amount):
        return f"Rs {int(amount)}"
    return f"Rs {amount:.2f}"


_SMS_MAX_GSM_LEN = 120


def _prepare_order_sms_body(text: str, *, fallback: str) -> str:
    """Length-capped GSM-7 SMS body (Twilio trial rejects long / UCS-2 messages)."""
    raw = (text or "").strip().replace("\r\n", "\n")
    if not raw:
        return fallback
    cleaned = (
        raw.replace("₹", "Rs")
        .replace("—", "-")
        .replace("–", "-")
        .replace("…", "...")
    )
    cleaned = " ".join(cleaned.split())
    if len(cleaned) > _SMS_MAX_GSM_LEN:
        return fallback
    if any(ord(ch) > 127 for ch in cleaned):
        return fallback
    return cleaned


def _sms_failure_is_length_limit(*, code: Optional[int] = None, message: Optional[str] = None) -> bool:
    if code == 30044:
        return True
    msg = (message or "").lower()
    return "30044" in msg or "too long" in msg or "maximum length" in msg


def _log_customer_sms_twilio_hint(masked: str, *, code: Optional[int] = None, message: Optional[str] = None) -> None:
    if code == 21608 or (message and "21608" in message):
        log.warning(
            "Customer order SMS blocked — Twilio trial accounts must verify the customer "
            "phone at console.twilio.com → Phone Numbers → Verified Caller IDs, or upgrade "
            "the account. Recipient: %s",
            masked,
        )
    elif _sms_failure_is_length_limit(code=code, message=message):
        log.warning(
            "Customer order SMS rejected as too long for Twilio trial — sent compact fallback instead. "
            "Recipient: %s",
            masked,
        )


def _customer_order_sms_body(store_name: str, order_number: str, total: float) -> str:
    """Short GSM-7 body for Twilio trial (error 30044 if too long / too many segments)."""
    name = (store_name or "Store").strip()
    if len(name) > 22:
        name = name[:22].rstrip() + "."
    return (
        f"Order #{order_number} confirmed at {name}. "
        f"{_compact_sms_amount(total)}. See your account for details."
    )


def _vendor_order_sms_body(
    order_number: str,
    customer_name: str,
    total: float,
) -> str:
    """Compact vendor alert — omit long localhost URLs that break trial segment limits."""
    buyer = (customer_name or "Customer").strip()
    if len(buyer) > 20:
        buyer = buyer[:20].rstrip() + "."
    return (
        f"KITERP: New order #{order_number} from {buyer}. "
        f"{_compact_sms_amount(total)}. Open your dashboard."
    )


def _vendor_order_whatsapp_body(
    order_number: str,
    customer_name: str,
    total: float,
) -> str:
    buyer = (customer_name or "Customer").strip()
    if len(buyer) > 24:
        buyer = buyer[:24].rstrip() + "."
    return (
        f"New order received\n"
        f"Order: #{order_number}\n"
        f"Customer: {buyer}\n"
        f"{_compact_sms_amount(total)}\n"
        f"Open your KITERP dashboard to view details."
    )


def _customer_order_whatsapp_body(
    store_name: str,
    order_number: str,
    total: float,
    customer_name: str,
) -> str:
    name = (store_name or "Store").strip()
    if len(name) > 28:
        name = name[:28].rstrip() + "."
    greet = (customer_name or "there").strip()
    if len(greet) > 24:
        greet = greet[:24].rstrip() + "."
    return (
        f"Order confirmed\n"
        f"Hi {greet}, thank you for shopping at {name}.\n"
        f"Order: #{order_number}\n"
        f"{_compact_sms_amount(total)}\n"
        f"Check your account for order updates."
    )


async def _resolve_order_message_config(
    db: AsyncSession,
    order: Order,
) -> tuple[Optional[dict[str, Any]], str]:
    """Load BU message config and store display name when order has a store."""
    store_name = ""
    message_config: Optional[dict[str, Any]] = None
    if not order.store_id:
        return message_config, store_name
    # Always read the latest store.settings from DB (not session cache).
    result = await db.execute(
        select(Store)
        .where(Store.id == order.store_id)
        .execution_options(populate_existing=True)
    )
    store = result.scalar_one_or_none()
    if not store:
        return message_config, store_name
    store_name = (store.name or "").strip()
    message_config = get_message_config(store)
    return message_config, store_name


def _vendor_email_recipients(
    vendor: Vendor,
    message_config: Optional[dict[str, Any]],
    event_type: str = "new_orders",
) -> list[str]:
    if message_config:
        emails = get_event_email_addresses(message_config, event_type)
        if emails:
            return emails
    fallback = (vendor.support_email or vendor.primary_email or "").strip()
    return [fallback] if fallback else []


async def _vendor_phone_recipients(
    db: AsyncSession,
    vendor: Vendor,
    message_config: Optional[dict[str, Any]],
    event_type: str = "new_orders",
) -> list[str]:
    if message_config:
        phones = get_event_phone_numbers(message_config, event_type)
        if phones:
            return phones
    fallback = await _resolve_vendor_phone(db, vendor)
    return [fallback] if fallback else []


def _order_context(
    vendor: Vendor,
    order: Order,
    customer: Optional[Customer],
    *,
    store_name_override: str = "",
    message_config: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    store_name = (
        store_name_override
        or vendor.display_name
        or vendor.business_name
        or "Your store"
    )
    order_number = order.order_number or str(order.id)[:8]
    total = float(order.total or 0)
    status_label = (order.status or "pending").replace("_", " ").title()
    customer_name = "Guest"
    if customer:
        customer_name = (customer.full_name or "Customer").strip()
    return {
        "store_name": store_name,
        "order_number": order_number,
        "total": total,
        "status_label": status_label,
        "customer_name": customer_name,
        "items": list(order.items or []),
        "track_url": _storefront_order_status_url(vendor, order.id),
        "vendor_url": _vendor_dashboard_order_url(vendor, order.id),
        "payment_note": _payment_status_note(order),
        "message_config": message_config,
    }


async def _send_sms_message(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    to_phone: str,
    body: str,
    recipient_label: str,
    order_number: str,
    compact_fallback: Optional[str] = None,
) -> ChannelOutcome:
    phone = normalize_e164(to_phone)
    if not phone or not is_valid_e164(phone):
        log.warning("Order SMS skipped — invalid phone for %s on order %s", recipient_label, order_number)
        return "skipped"

    masked = phone[-4:].rjust(len(phone), "*") if len(phone) > 4 else "****"
    bodies = [body]
    if compact_fallback and compact_fallback.strip() and compact_fallback.strip() != body.strip():
        bodies.append(compact_fallback.strip())

    registry = IntegrationRegistry(db)
    adapter = await registry.get_sms_adapter(vendor_id)
    platform_sms = SmsService()
    last_code: Optional[int] = None
    last_message: Optional[str] = None
    saw_retryable = False

    for attempt_idx, attempt_body in enumerate(bodies):
        if attempt_idx > 0:
            log.info(
                "Retrying order SMS with compact body for %s on order %s",
                recipient_label,
                order_number,
            )

        if adapter:
            try:
                result = await adapter.send(to=phone, body=attempt_body)
                if result.get("ok"):
                    log.info(
                        "Order confirmation SMS sent via vendor integration to %s (%s) for order %s",
                        recipient_label, masked, order_number,
                    )
                    return "sent"
                last_code = result.get("code")
                last_message = str(result.get("error") or "")
                log.warning(
                    "Vendor SMS integration failed for %s on order %s: %s",
                    recipient_label, order_number, last_message,
                )
                if _is_retryable_twilio_error(code=last_code, message=last_message):
                    saw_retryable = True
                if attempt_idx == 0 and len(bodies) > 1 and _sms_failure_is_length_limit(
                    code=last_code, message=last_message,
                ):
                    continue
            except Exception as exc:
                log.warning(
                    "Vendor SMS integration error for %s on order %s: %s",
                    recipient_label, order_number, exc,
                )

        if platform_sms.is_configured:
            try:
                result = await platform_sms.send_sms(phone, attempt_body)
                if result.sent:
                    log.info(
                        "Order confirmation SMS sent via platform Twilio to %s (%s) for order %s",
                        recipient_label, masked, order_number,
                    )
                    return "sent"
                last_code = result.twilio_code
                last_message = result.twilio_message
                log.warning(
                    "Platform SMS failed for %s on order %s: %s",
                    recipient_label, order_number, last_message,
                )
                if result.twilio_code == 21608:
                    log.warning(
                        "Twilio trial: verify recipient %s at twilio.com/console/phone-numbers/verified "
                        "or upgrade the account.",
                        masked,
                    )
                if _is_retryable_twilio_error(result.twilio_code, result.twilio_message):
                    saw_retryable = True
                if attempt_idx == 0 and len(bodies) > 1 and _sms_failure_is_length_limit(
                    code=result.twilio_code, message=result.twilio_message,
                ):
                    continue
            except Exception as exc:
                log.warning("Platform SMS error for %s on order %s: %s", recipient_label, order_number, exc)

    if recipient_label == "customer":
        _log_customer_sms_twilio_hint(masked, code=last_code, message=last_message)

    if not platform_sms.is_configured and not adapter:
        log.info("[sms:dev] -> %s | order=%s | %s", masked, order_number, body[:300])
        return "sent"

    if saw_retryable:
        log.warning(
            "Twilio limit/verification block — SMS not sent to %s for order %s.",
            recipient_label, order_number,
        )
        return "failed_retryable"

    log.warning("Order SMS not delivered to %s for order %s", recipient_label, order_number)
    return "failed"


async def _send_whatsapp_message(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    to_phone: str,
    body: str,
    recipient_label: str,
    order_number: str,
) -> ChannelOutcome:
    phone = normalize_e164(to_phone)
    if not phone or not is_valid_e164(phone):
        log.warning("Order WhatsApp skipped — invalid phone for %s on order %s", recipient_label, order_number)
        return "skipped"

    masked = phone[-4:].rjust(len(phone), "*") if len(phone) > 4 else "****"

    settings = get_settings()
    platform_sid = (settings.TWILIO_ACCOUNT_SID or "").strip()
    platform_token = (settings.TWILIO_AUTH_TOKEN or "").strip()
    platform_wa_from = (settings.TWILIO_WHATSAPP_FROM or "").strip()

    # Prefer vendor Twilio integration (same as SMS).
    registry = IntegrationRegistry(db)
    wa_creds = await registry._load(vendor_id, "twilio")
    if wa_creds:
        account_sid = (wa_creds.get("account_sid") or "").strip()
        auth_token = (wa_creds.get("auth_token") or "").strip()
        wa_from_raw = (wa_creds.get("whatsapp_from") or platform_wa_from or "").strip()
        if account_sid and auth_token:
            if not wa_from_raw:
                log.warning(
                    "Order WhatsApp skipped for %s on order %s — set whatsapp_from in CRM → Integrations → Twilio "
                    "(Twilio sandbox: +14155238886). SMS from_number alone cannot send WhatsApp.",
                    recipient_label, order_number,
                )
            else:
                outcome = await _attempt_twilio_whatsapp_send(
                    account_sid=account_sid,
                    auth_token=auth_token,
                    wa_from_raw=wa_from_raw,
                    to_phone=phone,
                    body=body,
                    recipient_label=recipient_label,
                    masked=masked,
                    order_number=order_number,
                    via_label="vendor Twilio integration",
                )
                if outcome == "sent":
                    return "sent"
                if outcome == "failed_retryable":
                    return "failed_retryable"
                if outcome != "skipped":
                    return outcome

    # Fall back to platform Twilio WhatsApp from .env.
    if platform_sid and platform_token and platform_wa_from:
        outcome = await _attempt_twilio_whatsapp_send(
            account_sid=platform_sid,
            auth_token=platform_token,
            wa_from_raw=platform_wa_from,
            to_phone=phone,
            body=body,
            recipient_label=recipient_label,
            masked=masked,
            order_number=order_number,
            via_label="platform Twilio",
        )
        if outcome == "sent":
            return "sent"
        if outcome == "failed_retryable":
            return "failed_retryable"
        if outcome != "skipped":
            return outcome

    # Meta WhatsApp Cloud API (if configured separately from Twilio).
    from app.integrations.meta_whatsapp import MetaWhatsAppAdapter

    meta_creds = await registry._load(vendor_id, "meta_whatsapp")
    if meta_creds:
        meta_adapter = MetaWhatsAppAdapter.from_credentials(meta_creds)
        if meta_adapter:
            try:
                result = await meta_adapter.send(to=phone, body=body)
                if result.get("ok"):
                    log.info(
                        "Order confirmation WhatsApp sent via Meta integration to %s (%s) for order %s",
                        recipient_label, masked, order_number,
                    )
                    return "sent"
                log.warning(
                    "Meta WhatsApp integration failed for %s on order %s: %s",
                    recipient_label, order_number, result.get("error"),
                )
            except Exception as exc:
                log.warning("Meta WhatsApp integration error for %s on order %s: %s", recipient_label, order_number, exc)

    if not platform_wa_from and not (wa_creds and wa_creds.get("whatsapp_from")):
        log.warning(
            "Order WhatsApp not sent to %s for order %s — set whatsapp_from in CRM → Integrations → Twilio "
            "(e.g. +14155238886 for sandbox) and have the recipient join the Twilio WhatsApp sandbox.",
            recipient_label, order_number,
        )
        return "skipped"

    log.warning("Order WhatsApp not delivered to %s for order %s", recipient_label, order_number)
    if settings.DEBUG:
        log.info("[whatsapp:dev] -> %s | order=%s | %s", masked, order_number, body[:300])
    return "failed"


def _record_channel_outcome(result: OrderNotificationResult, label: str, outcome: ChannelOutcome) -> None:
    if outcome in ("sent", "skipped"):
        return
    result.sms_whatsapp_complete = False
    if outcome == "failed_retryable":
        result.pending_channels.append(label)


async def _send_order_emails(
    db: AsyncSession,
    *,
    vendor: Vendor,
    order: Order,
    customer: Optional[Customer],
    ctx: dict[str, Any],
) -> None:
    store_name = ctx["store_name"]
    order_number = ctx["order_number"]
    total = ctx["total"]
    status_label = ctx["status_label"]
    customer_name = ctx["customer_name"]
    items = ctx["items"]

    if vendor_bu_order_email_enabled(vendor, ctx.get("message_config")):
        message_config = ctx.get("message_config")
        vendor_emails = _vendor_email_recipients(vendor, message_config, "new_orders")
        if vendor_emails:
            custom = _render_vendor_template_message(message_config, "new_orders", "email", ctx)
            if custom:
                subject, rendered = custom
                body = (
                    f"<p style='margin:0 0 12px; font-size:14px; color:#4b5563; white-space:pre-line;'>"
                    f"{html.escape(rendered)}</p>"
                    f"{_format_items_rows(items)}"
                )
                text = rendered
            else:
                subject = f"New order #{order_number} — {store_name}"
                body = (
                    f"<p style='margin:0 0 12px; font-size:14px; color:#4b5563;'>"
                    f"A new order has been placed on your store.</p>"
                    f"<p style='margin:0 0 8px; font-size:14px; color:#111827;'>"
                    f"<strong>Order:</strong> #{html.escape(order_number)}<br>"
                    f"<strong>Customer:</strong> {html.escape(customer_name)}<br>"
                    f"<strong>Status:</strong> {html.escape(status_label)}<br>"
                    f"<strong>Total:</strong> ₹{total:,.2f}</p>"
                    f"{_format_items_rows(items)}"
                )
                text = (
                    f"New order #{order_number} from {customer_name}.\n"
                    f"Total: ₹{total:,.2f}\n"
                    f"Status: {status_label}\n"
                )
            html_doc = _email_layout(
                brand=store_name,
                title="New order received",
                body_html=body,
                cta_label="View order",
                cta_href=ctx["vendor_url"],
            )
            for vendor_email in vendor_emails:
                try:
                    sent = await send_email_for_vendor(
                        db,
                        vendor.id,
                        to=vendor_email,
                        subject=subject,
                        html=html_doc,
                        text=text,
                    )
                    if sent:
                        log.info("Order confirmation email sent to vendor %s for order %s", vendor_email, order_number)
                    else:
                        log.info("Order confirmation email logged (dev/no SMTP) for vendor %s", vendor_email)
                except Exception as exc:
                    log.warning("Vendor order email failed for %s: %s", vendor_email, exc)
        else:
            log.warning("Vendor order email skipped — no email recipients for vendor %s", vendor.id)
    else:
        vendor_channels, _ = _order_message_channels(ctx.get("message_config"))
        if not vendor_channels.get("email", True):
            log.info(
                "Vendor order email skipped — Create Messages vendor email off for order %s",
                order_number,
            )

    customer_prefs = (customer.notification_preferences or {}) if customer else {}
    message_config = ctx.get("message_config")
    if customer_order_email_enabled(vendor, customer_prefs, message_config):
        customer_email = (customer.email or "").strip() if customer else ""
        if customer_email:
            greet_name = (customer.full_name or "there").strip() if customer else "there"
            template_ctx = _customer_template_context(ctx, customer_name=greet_name)
            custom = _render_customer_template_message(
                message_config, "new_orders", "email", ctx, customer_name=greet_name,
            )
            if custom:
                subject, rendered = custom
                body = (
                    f"<p style='margin:0 0 12px; font-size:14px; color:#4b5563; white-space:pre-line;'>"
                    f"{html.escape(rendered)}</p>"
                    f"{_format_items_rows(items)}"
                )
                text = rendered
            else:
                subject = f"Order #{order_number} confirmed — {store_name}"
                body = (
                    f"<p style='margin:0 0 12px; font-size:14px; color:#4b5563;'>"
                    f"Hi {html.escape(greet_name)},</p>"
                    f"<p style='margin:0 0 12px; font-size:14px; color:#4b5563;'>"
                    f"Thank you for your order at <strong>{html.escape(store_name)}</strong>. "
                    f"We have received it and will keep you updated.</p>"
                    f"<p style='margin:0 0 8px; font-size:14px; color:#111827;'>"
                    f"<strong>Order:</strong> #{html.escape(order_number)}<br>"
                    f"<strong>Status:</strong> {html.escape(status_label)}<br>"
                    f"<strong>Total:</strong> ₹{total:,.2f}<br>"
                    f"<strong>{html.escape(ctx['payment_note'])}</strong></p>"
                    f"{_format_items_rows(items)}"
                )
                text = (
                    f"Hi {greet_name},\n\n"
                    f"Your order #{order_number} at {store_name} has been placed.\n"
                    f"Total: ₹{total:,.2f}\n"
                    f"Status: {status_label}\n"
                    f"{ctx['payment_note']}\n"
                )
            html_doc = _email_layout(
                brand=store_name,
                title="Order confirmation",
                body_html=body,
                cta_label="Track your order",
                cta_href=ctx["track_url"],
            )
            try:
                sent = await send_email_for_vendor(
                    db,
                    vendor.id,
                    to=customer_email,
                    subject=subject,
                    html=html_doc,
                    text=text,
                )
                if sent:
                    log.info("Order confirmation email sent to customer %s for order %s", customer_email, order_number)
                else:
                    log.info("Order confirmation email logged (dev/no SMTP) for customer %s", customer_email)
            except Exception as exc:
                log.warning("Customer order email failed for %s: %s", customer_email, exc)
        else:
            log.warning("Customer order email skipped — no email for customer on order %s", order_number)
    else:
        _, customer_channels = _order_message_channels(message_config)
        if not customer_channels.get("email", True):
            log.info(
                "Customer order email skipped — Create Messages customer email off for order %s",
                order_number,
            )
        elif not _customer_order_updates_allowed(customer_prefs):
            log.info("Customer order email skipped — customer opted out for order %s", order_number)


async def _send_order_sms(
    db: AsyncSession,
    *,
    vendor: Vendor,
    order: Order,
    customer: Optional[Customer],
    ctx: dict[str, Any],
    result: OrderNotificationResult,
) -> None:
    order_number = ctx["order_number"]
    total = ctx["total"]
    store_name = ctx["store_name"]
    customer_name = ctx["customer_name"]
    customer_prefs = (customer.notification_preferences or {}) if customer else {}
    message_config = ctx.get("message_config")

    if vendor_bu_order_sms_enabled(vendor, message_config):
        vendor_phones = await _vendor_phone_recipients(db, vendor, message_config, "new_orders")
        if vendor_phones:
            custom = _render_vendor_template_message(message_config, "new_orders", "sms", ctx)
            default_sms = _vendor_order_sms_body(order_number, customer_name, total)
            body = (
                _prepare_order_sms_body(custom[1], fallback=default_sms)
                if custom
                else default_sms
            )
            for idx, vendor_phone in enumerate(vendor_phones):
                outcome = await _send_sms_message(
                    db,
                    vendor_id=vendor.id,
                    to_phone=vendor_phone,
                    body=body,
                    recipient_label=f"vendor_{idx + 1}",
                    order_number=order_number,
                    compact_fallback=default_sms,
                )
                _record_channel_outcome(result, f"vendor_sms_{idx + 1}", outcome)
        else:
            log.warning("Vendor order SMS skipped — no phone recipients for vendor %s", vendor.id)
    else:
        vendor_channels, _ = _order_message_channels(message_config)
        if not vendor_channels.get("sms", False):
            log.info(
                "Vendor order SMS skipped — Create Messages vendor SMS off for order %s",
                order_number,
            )

    if customer_order_sms_enabled(vendor, customer_prefs, message_config):
        customer_phone = _customer_phone(customer, order)
        if customer_phone:
            log.info(
                "Sending customer order SMS for %s to ****%s",
                order_number,
                customer_phone[-4:] if len(customer_phone) >= 4 else "****",
            )
            greet = (customer.full_name or "Customer").strip() if customer else "Customer"
            custom = _render_customer_template_message(
                message_config, "new_orders", "sms", ctx, customer_name=greet,
            )
            default_sms = _customer_order_sms_body(store_name, order_number, total)
            body = (
                _prepare_order_sms_body(custom[1], fallback=default_sms)
                if custom
                else default_sms
            )
            outcome = await _send_sms_message(
                db,
                vendor_id=vendor.id,
                to_phone=customer_phone,
                body=body,
                recipient_label="customer",
                order_number=order_number,
                compact_fallback=default_sms,
            )
            _record_channel_outcome(result, "customer_sms", outcome)
        else:
            log.warning("Customer order SMS skipped — no phone on order %s", order_number)
    else:
        _, customer_channels = _order_message_channels(message_config)
        if not customer_channels.get("sms", False):
            log.info(
                "Customer order SMS skipped — Create Messages customer SMS off for order %s",
                order_number,
            )
        elif not _customer_order_updates_allowed(customer_prefs):
            log.info(
                "Customer order SMS skipped — customer opted out of order updates for order %s",
                order_number,
            )


async def _send_order_whatsapp(
    db: AsyncSession,
    *,
    vendor: Vendor,
    order: Order,
    customer: Optional[Customer],
    ctx: dict[str, Any],
    result: OrderNotificationResult,
) -> None:
    order_number = ctx["order_number"]
    total = ctx["total"]
    store_name = ctx["store_name"]
    customer_name = ctx["customer_name"]
    customer_prefs = (customer.notification_preferences or {}) if customer else {}
    message_config = ctx.get("message_config")

    if vendor_bu_order_whatsapp_enabled(vendor, message_config):
        vendor_phones = await _vendor_phone_recipients(db, vendor, message_config, "new_orders")
        if vendor_phones:
            custom = _render_vendor_template_message(message_config, "new_orders", "whatsapp", ctx)
            body = custom[1] if custom else _vendor_order_whatsapp_body(order_number, customer_name, total)
            for idx, vendor_phone in enumerate(vendor_phones):
                outcome = await _send_whatsapp_message(
                    db,
                    vendor_id=vendor.id,
                    to_phone=vendor_phone,
                    body=body,
                    recipient_label=f"vendor_{idx + 1}",
                    order_number=order_number,
                )
                _record_channel_outcome(result, f"vendor_whatsapp_{idx + 1}", outcome)
        else:
            log.warning("Vendor order WhatsApp skipped — no phone recipients for vendor %s", vendor.id)
    else:
        vendor_channels, _ = _order_message_channels(message_config)
        if not vendor_channels.get("whatsapp", False):
            log.info(
                "Vendor order WhatsApp skipped — Create Messages vendor WhatsApp off for order %s",
                order_number,
            )

    if customer_order_whatsapp_enabled(vendor, customer_prefs, message_config):
        customer_phone = _customer_phone(customer, order)
        if customer_phone:
            log.info(
                "Sending customer order WhatsApp for %s to ****%s",
                order_number,
                customer_phone[-4:] if len(customer_phone) >= 4 else "****",
            )
            greet = (customer.full_name or "there").strip() if customer else "there"
            custom = _render_customer_template_message(
                message_config, "new_orders", "whatsapp", ctx, customer_name=greet,
            )
            body = custom[1] if custom else _customer_order_whatsapp_body(store_name, order_number, total, greet)
            outcome = await _send_whatsapp_message(
                db,
                vendor_id=vendor.id,
                to_phone=customer_phone,
                body=body,
                recipient_label="customer",
                order_number=order_number,
            )
            _record_channel_outcome(result, "customer_whatsapp", outcome)
        else:
            log.warning("Customer order WhatsApp skipped — no phone on order %s", order_number)
    else:
        _, customer_channels = _order_message_channels(message_config)
        if not customer_channels.get("whatsapp", False):
            log.info(
                "Customer order WhatsApp skipped — Create Messages customer WhatsApp off for order %s",
                order_number,
            )
        elif not _customer_order_updates_allowed(customer_prefs):
            log.info("Customer order WhatsApp skipped — customer opted out for order %s", order_number)


async def send_order_placed_notifications(
    db: AsyncSession,
    *,
    vendor: Vendor,
    order: Order,
    customer: Optional[Customer] = None,
) -> OrderNotificationResult:
    """Send order confirmation via email, SMS, and WhatsApp when toggles allow it."""
    delivery = OrderNotificationResult()
    fresh_order = await db.get(Order, order.id)
    if fresh_order:
        order = fresh_order
    message_config, store_name = await _resolve_order_message_config(db, order)
    if order.store_id and message_config:
        bu_emails = get_event_email_addresses(message_config, "new_orders")
        bu_phones = get_event_phone_numbers(message_config, "new_orders")
        if bu_emails or bu_phones:
            log.info(
                "Order %s notifications using BU config (store_id=%s): %d email(s), %d phone(s)",
                order.order_number or order.id,
                order.store_id,
                len(bu_emails),
                len(bu_phones),
            )
    ctx = _order_context(
        vendor,
        order,
        customer,
        store_name_override=store_name,
        message_config=message_config,
    )
    await _send_order_emails(db, vendor=vendor, order=order, customer=customer, ctx=ctx)
    await _send_order_sms(db, vendor=vendor, order=order, customer=customer, ctx=ctx, result=delivery)
    await _send_order_whatsapp(db, vendor=vendor, order=order, customer=customer, ctx=ctx, result=delivery)
    if delivery.pending_channels:
        log.warning(
            "Order %s SMS/WhatsApp pending retry for: %s",
            ctx["order_number"],
            ", ".join(delivery.pending_channels),
        )
    return delivery


# Backwards-compatible alias
async def send_order_placed_emails(
    db: AsyncSession,
    *,
    vendor: Vendor,
    order: Order,
    customer: Optional[Customer] = None,
) -> None:
    await send_order_placed_notifications(db, vendor=vendor, order=order, customer=customer)
