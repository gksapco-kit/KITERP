"""Customer email / SMS for the Real Estate module.

Outbox pattern: business code only *queues* a message (a ``re_communication`` row, in the same transaction as the
event it describes), so a slow or failing provider can never block or roll back a receipt or a demand. A background
job (``dispatch_queued``, every minute from Celery beat) delivers queued rows, retries a few times and records the
outcome on the row, which is also what the staff see in the Communication log.

Off by default. Switch on per vendor in Administration -> Automation, setting ``notifications``::

    {"email": true, "sms": true, "overdue_reminders": true, "reminder_every_days": 7}

Email goes through the vendor's own email integration when configured (else the platform sender); SMS through the
platform SMS provider. Nothing sensitive (portal tokens, PAN, bank details) is ever put in a message body.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.realestate import core as C
from app.models.realestate.admin import ReSetting

from .common import D, money_q

log = logging.getLogger(__name__)

MAX_ATTEMPTS = 3
SEND_TIMEOUT_SECONDS = 30
DEFAULT_PREFS: dict[str, Any] = {"email": False, "sms": False, "overdue_reminders": False, "reminder_every_days": 7}


async def prefs(db: AsyncSession, vendor_id: UUID) -> dict[str, Any]:
    row = (await db.execute(select(ReSetting).where(ReSetting.vendor_id == vendor_id, ReSetting.key == "notifications"))).scalar_one_or_none()
    out = dict(DEFAULT_PREFS)
    out.update(row.value or {} if row is not None else {})
    return out


def _fmt(v: Any) -> str:
    return f"Rs {money_q(D(v)):,.2f}"


async def queue_for_customer(
    db: AsyncSession, vendor_id: UUID, customer_id: UUID, *, event: str, subject: str, body: str,
    booking_id: Optional[UUID] = None, reference_id: Optional[UUID] = None,
) -> list[C.ReCommunication]:
    """Queue ``body`` for the customer on each enabled channel they can be reached on. Never raises, never sends."""
    try:
        p = await prefs(db, vendor_id)
        if not (p.get("email") or p.get("sms")):
            return []
        customer = await db.get(C.ReCustomer, customer_id)
        if customer is None or customer.vendor_id != vendor_id:
            return []
        queued: list[C.ReCommunication] = []
        for channel, enabled, address in (("email", p.get("email"), customer.email), ("sms", p.get("sms"), customer.phone)):
            if not enabled or not (address or "").strip():
                continue
            row = C.ReCommunication(
                vendor_id=vendor_id, customer_id=customer_id, booking_id=booking_id, channel=channel, direction="outbound",
                subject=subject[:255], body=body, status="queued", by_name="System", recipient=address.strip()[:255],
                event=event, reference_id=reference_id, attempts=0)
            db.add(row)
            queued.append(row)
        if queued:
            await db.flush()
        return queued
    except Exception:  # a notification problem must never break the business transaction
        log.exception("Could not queue %s notification for customer %s", event, customer_id)
        return []


# -- events -----------------------------------------------------------------------------------

async def on_demand_issued(db: AsyncSession, vendor_id: UUID, booking, demand) -> None:
    await queue_for_customer(
        db, vendor_id, booking.customer_id, event="demand_issued", booking_id=booking.id, reference_id=demand.id,
        subject=f"Payment demand {demand.demand_no} - {demand.stage_name}",
        body=(f"Dear customer, a payment demand {demand.demand_no} of {_fmt(demand.total_amount)} for {demand.stage_name} "
              f"(booking {booking.booking_no}) is due on {demand.due_date:%d %b %Y}. Please log in to your portal or contact "
              "the sales office for the demand letter and payment details."))


async def on_receipt_cleared(db: AsyncSession, vendor_id: UUID, booking, receipt) -> None:
    await queue_for_customer(
        db, vendor_id, booking.customer_id, event="receipt_cleared", booking_id=booking.id, reference_id=receipt.id,
        subject=f"Payment received - receipt {receipt.receipt_no}",
        body=(f"Dear customer, we have received {_fmt(receipt.gross_amount)} against booking {booking.booking_no} "
              f"(receipt {receipt.receipt_no}, {receipt.receipt_date:%d %b %Y}). Thank you."))


async def send_overdue_reminders(db: AsyncSession, vendor_id: UUID, today: Optional[date] = None) -> int:
    """Queue a reminder for each overdue demand, at most one per ``reminder_every_days`` per demand."""
    from app.models.realestate import receivables as R

    p = await prefs(db, vendor_id)
    if not p.get("overdue_reminders") or not (p.get("email") or p.get("sms")):
        return 0
    today = today or date.today()
    gap = max(1, int(p.get("reminder_every_days") or 7))
    demands = (await db.execute(select(R.ReDemand).where(
        R.ReDemand.vendor_id == vendor_id, R.ReDemand.status.in_(("issued", "partial")), R.ReDemand.due_date < today).limit(500))).scalars().all()
    count = 0
    cutoff = datetime.now(timezone.utc) - timedelta(days=gap)
    for d in demands:
        recent = (await db.execute(select(func.count()).select_from(C.ReCommunication).where(
            C.ReCommunication.vendor_id == vendor_id, C.ReCommunication.event == "overdue_reminder",
            C.ReCommunication.reference_id == d.id, C.ReCommunication.created_at >= cutoff))).scalar_one()
        if recent:
            continue
        booking = await db.get(C.ReBooking, d.booking_id)
        if booking is None:
            continue
        due = D(d.total_amount) - D(d.paid_amount)
        queued = await queue_for_customer(
            db, vendor_id, d.customer_id, event="overdue_reminder", booking_id=booking.id, reference_id=d.id,
            subject=f"Payment overdue - {d.demand_no}",
            body=(f"Dear customer, {_fmt(due)} for {d.stage_name} (booking {booking.booking_no}) was due on {d.due_date:%d %b %Y} "
                  "and is still pending. Please make the payment at the earliest or contact the sales office."))
        count += 1 if queued else 0
    return count


# -- delivery ---------------------------------------------------------------------------------

def _html(body: str) -> str:
    from html import escape

    return f"<p>{escape(body)}</p>"


async def _deliver(db: AsyncSession, vendor_id: UUID, row: C.ReCommunication) -> tuple[bool, Optional[str]]:
    if row.channel == "email":
        from app.services.email_service import send_email_detailed_for_vendor

        res = await asyncio.wait_for(
            send_email_detailed_for_vendor(db, vendor_id, to=row.recipient, subject=row.subject or "Notification",
                                           html=_html(row.body or ""), text=row.body), SEND_TIMEOUT_SECONDS)
        return bool(res.ok), (None if res.ok else (res.error or "Email could not be sent"))
    if row.channel == "sms":
        from app.services.sms_service import SmsService, truncate_sms_body

        svc = SmsService()
        if not svc.is_configured:
            return False, "SMS provider is not configured"
        res = await asyncio.wait_for(svc.send_sms(row.recipient, truncate_sms_body(row.body or "")), SEND_TIMEOUT_SECONDS)
        return bool(res.sent), (None if res.sent else (res.twilio_message or "SMS could not be sent"))
    return False, f"Unsupported channel {row.channel}"


async def dispatch_queued(db: AsyncSession, vendor_id: UUID, limit: int = 100) -> dict[str, int]:
    rows = (await db.execute(select(C.ReCommunication).where(
        C.ReCommunication.vendor_id == vendor_id, C.ReCommunication.status == "queued",
        C.ReCommunication.attempts < MAX_ATTEMPTS).order_by(C.ReCommunication.created_at).limit(limit))).scalars().all()
    sent = failed = 0
    for row in rows:
        row.attempts = (row.attempts or 0) + 1
        try:
            ok, err = await _deliver(db, vendor_id, row)
        except Exception as exc:  # timeouts, provider crashes
            ok, err = False, (str(exc) or exc.__class__.__name__)
        if ok:
            row.status, row.sent_at, row.error = "sent", datetime.now(timezone.utc), None
            sent += 1
        else:
            row.error = (err or "failed")[:500]
            if row.attempts >= MAX_ATTEMPTS:
                row.status = "failed"
                failed += 1
    return {"picked": len(rows), "sent": sent, "failed": failed}


async def requeue(row: C.ReCommunication) -> C.ReCommunication:
    row.status, row.attempts, row.error = "queued", 0, None
    return row
