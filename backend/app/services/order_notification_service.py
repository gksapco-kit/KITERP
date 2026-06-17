"""Order placement notifications — email, SMS, and WhatsApp driven by vendor settings."""
from __future__ import annotations

import html
import logging
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.integrations.registry import IntegrationRegistry
from app.models.customer import Customer
from app.models.order import Order
from app.models.vendor import Vendor
from app.services.email_service import send_email
from app.services.sms_service import SmsService, is_valid_e164, normalize_e164

log = logging.getLogger(__name__)


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


def customer_order_email_enabled(
    vendor: Vendor,
    customer_prefs: Optional[dict[str, Any]] = None,
) -> bool:
    if not vendor_order_email_enabled(vendor):
        return False
    return _customer_order_updates_allowed(customer_prefs)


def customer_order_sms_enabled(
    vendor: Vendor,
    customer_prefs: Optional[dict[str, Any]] = None,
) -> bool:
    if not vendor_order_sms_enabled(vendor):
        return False
    return _customer_sms_allowed(customer_prefs)


def customer_order_whatsapp_enabled(
    vendor: Vendor,
    customer_prefs: Optional[dict[str, Any]] = None,
) -> bool:
    if not vendor_order_whatsapp_enabled(vendor):
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
        return f"http://127.0.0.1:3002/store/{slug}/order/{order_id}/status"
    return f"https://{slug}.{settings.BASE_DOMAIN}/order/{order_id}/status"


def _vendor_phone(vendor: Vendor) -> str:
    raw = (vendor.support_phone or vendor.primary_phone or "").strip()
    if raw in {"-", "—", "N/A", "n/a", "NA"}:
        return ""
    return raw


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


def _order_context(
    vendor: Vendor,
    order: Order,
    customer: Optional[Customer],
) -> dict[str, Any]:
    store_name = vendor.display_name or vendor.business_name or "Your store"
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
    }


async def _send_sms_message(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    to_phone: str,
    body: str,
    recipient_label: str,
    order_number: str,
) -> None:
    phone = normalize_e164(to_phone)
    if not phone or not is_valid_e164(phone):
        log.warning("Order SMS skipped — invalid phone for %s on order %s", recipient_label, order_number)
        return

    masked = phone[-4:].rjust(len(phone), "*") if len(phone) > 4 else "****"

    # Prefer platform Twilio from .env (same credentials used for OTP / system SMS).
    platform_sms = SmsService()
    if platform_sms.is_configured:
        try:
            result = await platform_sms.send_sms(phone, body)
            if result.sent:
                log.info(
                    "Order confirmation SMS sent via platform Twilio to %s (%s) for order %s",
                    recipient_label, masked, order_number,
                )
                return
            log.warning("Platform SMS failed for %s on order %s: %s", recipient_label, order_number, result.twilio_message)
            if result.twilio_code == 21608:
                log.warning(
                    "Twilio trial: verify recipient %s at twilio.com/console/phone-numbers/verified "
                    "or upgrade the account.",
                    masked,
                )
        except Exception as exc:
            log.warning("Platform SMS error for %s on order %s: %s", recipient_label, order_number, exc)

    registry = IntegrationRegistry(db)
    adapter = await registry.get_sms_adapter(vendor_id)
    if adapter:
        try:
            result = await adapter.send(to=phone, body=body)
            if result.get("ok"):
                log.info(
                    "Order confirmation SMS sent via vendor integration to %s (%s) for order %s",
                    recipient_label, masked, order_number,
                )
                return
            log.warning(
                "Vendor SMS integration failed for %s on order %s: %s",
                recipient_label, order_number, result.get("error"),
            )
        except Exception as exc:
            log.warning("Vendor SMS integration error for %s on order %s: %s", recipient_label, order_number, exc)

    if not platform_sms.is_configured:
        log.info("[sms:dev] -> %s | order=%s | %s", masked, order_number, body[:300])
    else:
        log.warning("Order SMS not delivered to %s for order %s", recipient_label, order_number)


async def _send_whatsapp_message(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    to_phone: str,
    body: str,
    recipient_label: str,
    order_number: str,
) -> None:
    phone = normalize_e164(to_phone)
    if not phone or not is_valid_e164(phone):
        log.warning("Order WhatsApp skipped — invalid phone for %s on order %s", recipient_label, order_number)
        return

    masked = phone[-4:].rjust(len(phone), "*") if len(phone) > 4 else "****"

    # Prefer platform Twilio WhatsApp from .env (same account as SMS).
    settings = get_settings()
    account_sid = (settings.TWILIO_ACCOUNT_SID or "").strip()
    auth_token = (settings.TWILIO_AUTH_TOKEN or "").strip()
    wa_from_raw = (settings.TWILIO_WHATSAPP_FROM or "").strip()
    wa_from = ""
    if wa_from_raw:
        wa_from = wa_from_raw if wa_from_raw.startswith("whatsapp:") else f"whatsapp:{normalize_e164(wa_from_raw)}"
    if account_sid and auth_token and wa_from:
        from app.integrations.twilio import TwilioWhatsAppAdapter

        adapter = TwilioWhatsAppAdapter(account_sid, auth_token, wa_from)
        try:
            result = await adapter.send(to=phone, body=body)
            if result.get("ok"):
                log.info(
                    "Order confirmation WhatsApp sent via platform Twilio to %s (%s) for order %s",
                    recipient_label, masked, order_number,
                )
                return
            log.warning(
                "Platform WhatsApp failed for %s on order %s: %s",
                recipient_label, order_number, result.get("error"),
            )
            err = str(result.get("error") or "")
            if "Channel" in err or "From address" in err:
                log.warning(
                    "Enable Twilio WhatsApp Sandbox in Twilio Console → Messaging → Try it out, "
                    "set TWILIO_WHATSAPP_FROM=+14155238886, and have recipients join the sandbox on WhatsApp.",
                )
        except Exception as exc:
            log.warning("Platform WhatsApp error for %s on order %s: %s", recipient_label, order_number, exc)

    registry = IntegrationRegistry(db)
    adapter = await registry.get_whatsapp_adapter(vendor_id)
    if adapter:
        try:
            result = await adapter.send(to=phone, body=body)
            if result.get("ok"):
                log.info(
                    "Order confirmation WhatsApp sent via vendor integration to %s (%s) for order %s",
                    recipient_label, masked, order_number,
                )
                return
            log.warning(
                "Vendor WhatsApp integration failed for %s on order %s: %s",
                recipient_label, order_number, result.get("error"),
            )
        except Exception as exc:
            log.warning("Vendor WhatsApp integration error for %s on order %s: %s", recipient_label, order_number, exc)

    if not (account_sid and auth_token and wa_from):
        log.warning(
            "Order WhatsApp not sent to %s for order %s — set TWILIO_WHATSAPP_FROM in .env "
            "(e.g. whatsapp:+14155238886 for Twilio sandbox) or connect a vendor WhatsApp integration",
            recipient_label, order_number,
        )
    else:
        log.warning("Order WhatsApp not delivered to %s for order %s", recipient_label, order_number)
    if settings.DEBUG:
        log.info("[whatsapp:dev] -> %s | order=%s | %s", masked, order_number, body[:300])


async def _send_order_emails(
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

    if vendor_order_email_enabled(vendor):
        vendor_email = (vendor.support_email or vendor.primary_email or "").strip()
        if vendor_email:
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
            html_doc = _email_layout(
                brand=store_name,
                title="New order received",
                body_html=body,
                cta_label="View order",
                cta_href=ctx["vendor_url"],
            )
            text = (
                f"New order #{order_number} from {customer_name}.\n"
                f"Total: ₹{total:,.2f}\n"
                f"Status: {status_label}\n"
            )
            try:
                sent = await send_email(
                    to=vendor_email,
                    subject=f"New order #{order_number} — {store_name}",
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
            log.warning("Vendor order email skipped — no email on vendor %s", vendor.id)

    customer_prefs = (customer.notification_preferences or {}) if customer else {}
    if customer_order_email_enabled(vendor, customer_prefs):
        customer_email = (customer.email or "").strip() if customer else ""
        if customer_email:
            greet_name = (customer.full_name or "there").strip() if customer else "there"
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
            html_doc = _email_layout(
                brand=store_name,
                title="Order confirmation",
                body_html=body,
                cta_label="Track your order",
                cta_href=ctx["track_url"],
            )
            text = (
                f"Hi {greet_name},\n\n"
                f"Your order #{order_number} at {store_name} has been placed.\n"
                f"Total: ₹{total:,.2f}\n"
                f"Status: {status_label}\n"
                f"{ctx['payment_note']}\n"
            )
            try:
                sent = await send_email(
                    to=customer_email,
                    subject=f"Order #{order_number} confirmed — {store_name}",
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


async def _send_order_sms(
    db: AsyncSession,
    *,
    vendor: Vendor,
    order: Order,
    customer: Optional[Customer],
    ctx: dict[str, Any],
) -> None:
    order_number = ctx["order_number"]
    total = ctx["total"]
    store_name = ctx["store_name"]
    customer_name = ctx["customer_name"]
    customer_prefs = (customer.notification_preferences or {}) if customer else {}

    if vendor_order_sms_enabled(vendor):
        vendor_phone = _vendor_phone(vendor)
        if vendor_phone:
            body = (
                f"KITERP: New order #{order_number} from {customer_name}. "
                f"Total ₹{total:,.2f}. View: {ctx['vendor_url']}"
            )
            await _send_sms_message(
                db,
                vendor_id=vendor.id,
                to_phone=vendor_phone,
                body=body,
                recipient_label="vendor",
                order_number=order_number,
            )
        else:
            log.warning("Vendor order SMS skipped — no phone on vendor %s", vendor.id)

    if customer_order_sms_enabled(vendor, customer_prefs):
        customer_phone = _customer_phone(customer, order)
        if customer_phone:
            log.info(
                "Sending customer order SMS for %s to ****%s",
                order_number,
                customer_phone[-4:] if len(customer_phone) >= 4 else "****",
            )
            body = (
                f"{store_name}: Your order #{order_number} is confirmed. "
                f"Total ₹{total:,.2f}. Track: {ctx['track_url']}"
            )
            await _send_sms_message(
                db,
                vendor_id=vendor.id,
                to_phone=customer_phone,
                body=body,
                recipient_label="customer",
                order_number=order_number,
            )
        else:
            log.warning("Customer order SMS skipped — no phone on order %s", order_number)
    elif vendor_order_sms_enabled(vendor):
        log.info(
            "Customer order SMS skipped — customer opted out or disabled for order %s",
            order_number,
        )
    else:
        log.info("Customer order SMS skipped — vendor SMS notifications off for order %s", order_number)


async def _send_order_whatsapp(
    db: AsyncSession,
    *,
    vendor: Vendor,
    order: Order,
    customer: Optional[Customer],
    ctx: dict[str, Any],
) -> None:
    order_number = ctx["order_number"]
    total = ctx["total"]
    store_name = ctx["store_name"]
    customer_name = ctx["customer_name"]
    status_label = ctx["status_label"]
    customer_prefs = (customer.notification_preferences or {}) if customer else {}

    if vendor_order_whatsapp_enabled(vendor):
        vendor_phone = _vendor_phone(vendor)
        if vendor_phone:
            body = (
                f"🛒 *New order received*\n\n"
                f"Order: *#{order_number}*\n"
                f"Customer: {customer_name}\n"
                f"Total: ₹{total:,.2f}\n"
                f"Status: {status_label}\n\n"
                f"View order: {ctx['vendor_url']}"
            )
            await _send_whatsapp_message(
                db,
                vendor_id=vendor.id,
                to_phone=vendor_phone,
                body=body,
                recipient_label="vendor",
                order_number=order_number,
            )
        else:
            log.warning("Vendor order WhatsApp skipped — no phone on vendor %s", vendor.id)

    if customer_order_whatsapp_enabled(vendor, customer_prefs):
        customer_phone = _customer_phone(customer, order)
        if customer_phone:
            log.info(
                "Sending customer order WhatsApp for %s to ****%s",
                order_number,
                customer_phone[-4:] if len(customer_phone) >= 4 else "****",
            )
            greet = (customer.full_name or "there").strip() if customer else "there"
            body = (
                f"✅ *Order confirmed*\n\n"
                f"Hi {greet},\n"
                f"Thank you for shopping at *{store_name}*.\n\n"
                f"Order: *#{order_number}*\n"
                f"Total: ₹{total:,.2f}\n"
                f"Status: {status_label}\n"
                f"{ctx['payment_note']}\n\n"
                f"Track your order: {ctx['track_url']}"
            )
            await _send_whatsapp_message(
                db,
                vendor_id=vendor.id,
                to_phone=customer_phone,
                body=body,
                recipient_label="customer",
                order_number=order_number,
            )
        else:
            log.warning("Customer order WhatsApp skipped — no phone on order %s", order_number)


async def send_order_placed_notifications(
    db: AsyncSession,
    *,
    vendor: Vendor,
    order: Order,
    customer: Optional[Customer] = None,
) -> None:
    """Send order confirmation via email, SMS, and WhatsApp when toggles allow it."""
    ctx = _order_context(vendor, order, customer)
    await _send_order_emails(vendor=vendor, order=order, customer=customer, ctx=ctx)
    await _send_order_sms(db, vendor=vendor, order=order, customer=customer, ctx=ctx)
    await _send_order_whatsapp(db, vendor=vendor, order=order, customer=customer, ctx=ctx)


# Backwards-compatible alias
async def send_order_placed_emails(
    db: AsyncSession,
    *,
    vendor: Vendor,
    order: Order,
    customer: Optional[Customer] = None,
) -> None:
    await send_order_placed_notifications(db, vendor=vendor, order=order, customer=customer)
