"""Test CRM integration credentials before saving."""
from __future__ import annotations

import logging
from typing import Any, Optional
from uuid import UUID

import httpx
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import decrypt_json
from app.integrations.email_sendgrid import SendGridEmailAdapter
from app.integrations.email_smtp import SmtpEmailAdapter
from app.integrations.twilio import TwilioSmsAdapter
from app.services.email_service import resolve_effective_sendgrid_key
from app.services.integration_defaults_service import resolve_credentials_for_test
from app.services.payment_integration_service import is_payment_provider
from app.repositories.crm.repos import IntegrationRepo
from app.services.sms_service import normalize_e164, is_valid_e164

log = logging.getLogger(__name__)


async def _resolve_credentials(
    db: AsyncSession,
    vendor_id: UUID,
    provider: str,
    credentials: Optional[dict[str, Any]],
    integration_id: Optional[UUID] = None,
    settings: Optional[dict[str, Any]] = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    stored: dict[str, Any] = {}
    stored_settings: dict[str, Any] = {}
    repo = IntegrationRepo(db)
    existing = None
    if integration_id:
        existing = await repo.get(vendor_id, integration_id)
    if not existing:
        existing = await repo.get_by_provider(vendor_id, provider)
    if existing:
        if existing.encrypted_credentials:
            stored = decrypt_json(existing.encrypted_credentials) or {}
        stored_settings = dict(existing.settings or {})

    merged, merged_settings = resolve_credentials_for_test(
        provider,
        incoming=credentials,
        stored=stored,
        incoming_settings=settings,
        stored_settings=stored_settings,
    )
    if not merged and provider not in {"smtp", "sendgrid"}:
        raise HTTPException(status_code=422, detail="Enter the required credentials to test.")
    return merged, merged_settings


async def test_integration_connection(
    db: AsyncSession,
    vendor_id: UUID,
    *,
    provider: str,
    credentials: Optional[dict[str, Any]] = None,
    settings: Optional[dict[str, Any]] = None,
    test_email: Optional[str] = None,
    test_phone: Optional[str] = None,
    integration_id: Optional[UUID] = None,
) -> dict[str, Any]:
    provider = (provider or "").strip().lower()
    settings = settings or {}
    creds, settings = await _resolve_credentials(
        db, vendor_id, provider, credentials, integration_id, settings,
    )

    if provider == "smtp":
        return await _test_smtp(creds, settings, test_email)
    if provider == "sendgrid":
        return await _test_sendgrid(creds, settings, test_email)
    if provider == "twilio":
        return await _test_twilio(creds, settings, test_phone)
    if provider == "razorpay":
        return await _test_razorpay(creds)
    if provider == "stripe":
        return await _test_stripe(creds)
    if provider == "paypal":
        return await _test_paypal(creds, settings)
    if provider == "square":
        return await _test_square(creds, settings)
    if provider == "payu":
        return await _test_payu(creds)
    raise HTTPException(status_code=422, detail=f"Testing is not supported for provider '{provider}'.")


async def _test_smtp(
    creds: dict[str, Any],
    settings: dict[str, Any],
    test_email: Optional[str],
) -> dict[str, Any]:
    if not test_email:
        raise HTTPException(status_code=422, detail="Enter a test email address to verify SMTP.")

    username = str(creds.get("username") or "").strip().lower()
    host = str(creds.get("host") or "").strip().lower()

    # SendGrid over SMTP often fails from Docker (connection drops). Prefer HTTP API when detected.
    api_key = resolve_effective_sendgrid_key(creds)
    if api_key or username == "apikey" or "sendgrid" in host:
        if not api_key:
            raise HTTPException(
                status_code=422,
                detail=(
                    "No SendGrid API key found. Set SENDGRID_API_KEY (or SMTP_PASSWORD=SG.xxx) in backend/.env "
                    "and restart the API, or paste your API key in the password field."
                ),
            )
        sg_payload = {
            "api_key": api_key,
            "from_email": settings.get("from_email"),
            "from_name": settings.get("from_name"),
        }
        return await _test_sendgrid(sg_payload, settings, test_email)

    payload = {**creds, **settings}
    adapter = SmtpEmailAdapter.from_credentials(payload)
    if not adapter:
        raise HTTPException(status_code=422, detail="SMTP host is required.")
    result = await adapter.send(
        to=test_email,
        subject="KITERP SMTP test",
        text="This is a test email from your KITERP SMTP integration.",
        html="<p>This is a <strong>test email</strong> from your KITERP SMTP integration.</p>",
    )
    if not result.get("ok"):
        err = str(result.get("error") or "SMTP connection failed.")
        if "connection" in err.lower() and ("lost" in err.lower() or "reset" in err.lower()):
            raise HTTPException(
                status_code=400,
                detail=(
                    "SMTP connection failed — if you use SendGrid, ensure host is smtp.sendgrid.net, "
                    "username is apikey, and password is your SendGrid API key. "
                    "You can also connect via the SendGrid (Email) card for more reliable delivery."
                ),
            )
        raise HTTPException(status_code=400, detail=err)
    return {"ok": True, "message": f"Test email sent to {test_email}."}


async def _test_sendgrid(
    creds: dict[str, Any],
    settings: dict[str, Any],
    test_email: Optional[str],
) -> dict[str, Any]:
    if not test_email:
        raise HTTPException(status_code=422, detail="Enter a test email address to verify SendGrid.")
    payload = {**creds, **settings}
    api_key = resolve_effective_sendgrid_key(payload)
    if not api_key:
        raise HTTPException(
            status_code=422,
            detail=(
                "SendGrid API key is required. Set SENDGRID_API_KEY in backend/.env (same key used for "
                "platform email) or paste it in the API key field, then restart the backend."
            ),
        )
    payload["api_key"] = api_key
    adapter = SendGridEmailAdapter.from_credentials(payload)
    result = await adapter.send(
        to=test_email,
        subject="KITERP SendGrid test",
        text="This is a test email from your KITERP SendGrid integration.",
        html="<p>This is a <strong>test email</strong> from your KITERP SendGrid integration.</p>",
    )
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error") or "SendGrid send failed.")
    return {"ok": True, "message": f"Test email sent to {test_email}."}


async def _test_twilio(
    creds: dict[str, Any],
    settings: dict[str, Any],
    test_phone: Optional[str],
) -> dict[str, Any]:
    account_sid = (creds.get("account_sid") or "").strip()
    auth_token = (creds.get("auth_token") or "").strip()
    if not account_sid or not auth_token:
        raise HTTPException(status_code=422, detail="Twilio Account SID and Auth Token are required.")

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}.json",
            auth=(account_sid, auth_token),
        )
    if resp.status_code == 401:
        raise HTTPException(status_code=400, detail="Twilio authentication failed — check Account SID and Auth Token.")
    if resp.status_code != 200:
        detail = resp.text[:200] if resp.text else "Could not reach Twilio."
        raise HTTPException(status_code=400, detail=detail)

    account_name = ""
    try:
        account_name = resp.json().get("friendly_name") or ""
    except Exception:
        pass

    from_number = normalize_e164(
        str(settings.get("from_number") or creds.get("from_number") or ""),
    )
    whatsapp_from = normalize_e164(
        str(settings.get("whatsapp_from") or creds.get("whatsapp_from") or ""),
    )

    messages: list[str] = []

    if test_phone and from_number:
        phone = normalize_e164(test_phone)
        if not is_valid_e164(phone):
            raise HTTPException(status_code=422, detail="Enter a valid test phone number (E.164).")
        merged = {**creds, "from_number": from_number}
        adapter = TwilioSmsAdapter.from_credentials(merged)
        if not adapter:
            raise HTTPException(status_code=422, detail="Twilio from_number is required to send a test SMS.")
        result = await adapter.send(
            to=phone,
            body="KITERP test: your Twilio SMS integration is working.",
        )
        if not result.get("ok"):
            raise HTTPException(status_code=400, detail=result.get("error") or "Twilio SMS test failed.")
        messages.append("Test SMS sent.")

    if test_phone and whatsapp_from:
        phone = normalize_e164(test_phone)
        from app.integrations.twilio import TwilioWhatsAppAdapter

        wa_adapter = TwilioWhatsAppAdapter(account_sid, auth_token, whatsapp_from)
        wa_result = await wa_adapter.send(
            to=phone,
            body="KITERP test: your Twilio WhatsApp integration is working.",
        )
        if not wa_result.get("ok"):
            err = str(wa_result.get("error") or "Twilio WhatsApp test failed.")
            if "63016" in err or "sandbox" in err.lower():
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "WhatsApp test failed — join the Twilio sandbox first: open WhatsApp on your phone, "
                        "message +1 415 523 8886 with the join code from Twilio Console → Messaging → Try WhatsApp."
                    ),
                )
            raise HTTPException(status_code=400, detail=err)
        messages.append("Test WhatsApp sent (check WhatsApp app — sandbox join required).")

    if messages:
        return {
            "ok": True,
            "message": f"Twilio account verified ({account_name or account_sid}). {' '.join(messages)}",
        }

    hints = ["Add from_number and test phone to send a test SMS."]
    if not whatsapp_from:
        hints.append("Add whatsapp_from (+14155238886 for sandbox) to test WhatsApp.")
    return {
        "ok": True,
        "message": f"Twilio account verified ({account_name or account_sid}). {' '.join(hints)}",
    }


async def _test_razorpay(creds: dict[str, Any]) -> dict[str, Any]:
    key_id = (creds.get("key_id") or "").strip()
    key_secret = (creds.get("key_secret") or "").strip()
    if not key_id or not key_secret:
        raise HTTPException(status_code=422, detail="Razorpay Key ID and Key Secret are required.")
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            "https://api.razorpay.com/v1/orders?count=1",
            auth=(key_id, key_secret),
        )
    if resp.status_code == 401:
        raise HTTPException(status_code=400, detail="Razorpay authentication failed — check Key ID and Secret.")
    if resp.status_code >= 400:
        raise HTTPException(status_code=400, detail=resp.text[:200] or "Could not reach Razorpay.")
    msg = "Razorpay credentials verified."
    if not (creds.get("webhook_secret") or "").strip():
        msg += " Add webhook_secret and register the webhook URL in Razorpay Dashboard."
    return {"ok": True, "message": msg}


async def _test_stripe(creds: dict[str, Any]) -> dict[str, Any]:
    secret_key = (creds.get("secret_key") or "").strip()
    publishable_key = (creds.get("publishable_key") or "").strip()
    if not secret_key or not publishable_key:
        raise HTTPException(status_code=422, detail="Stripe publishable_key and secret_key are required.")
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            "https://api.stripe.com/v1/balance",
            headers={"Authorization": f"Bearer {secret_key}"},
        )
    if resp.status_code == 401:
        raise HTTPException(status_code=400, detail="Stripe authentication failed — check secret_key.")
    if resp.status_code >= 400:
        raise HTTPException(status_code=400, detail=resp.text[:200] or "Could not reach Stripe.")
    msg = "Stripe credentials verified."
    if not (creds.get("webhook_secret") or "").strip():
        msg += " Add webhook_secret and register the webhook URL in Stripe Dashboard."
    return {"ok": True, "message": msg}


async def _test_paypal(creds: dict[str, Any], settings: dict[str, Any]) -> dict[str, Any]:
    client_id = (creds.get("client_id") or "").strip()
    client_secret = (creds.get("client_secret") or "").strip()
    if not client_id or not client_secret:
        raise HTTPException(status_code=422, detail="PayPal client_id and client_secret are required.")
    mode = (settings.get("mode") or "sandbox").strip().lower()
    base = "https://api-m.sandbox.paypal.com" if mode != "live" else "https://api-m.paypal.com"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{base}/v1/oauth2/token",
            data={"grant_type": "client_credentials"},
            auth=(client_id, client_secret),
            headers={"Accept": "application/json"},
        )
    if resp.status_code == 401:
        raise HTTPException(status_code=400, detail="PayPal authentication failed — check client_id and client_secret.")
    if resp.status_code >= 400:
        raise HTTPException(status_code=400, detail=resp.text[:200] or "Could not reach PayPal.")
    return {"ok": True, "message": f"PayPal credentials verified ({mode} mode)."}


async def _test_square(creds: dict[str, Any], settings: dict[str, Any]) -> dict[str, Any]:
    access_token = (creds.get("access_token") or "").strip()
    application_id = (creds.get("application_id") or "").strip()
    if not access_token or not application_id:
        raise HTTPException(status_code=422, detail="Square access_token and application_id are required.")
    mode = (settings.get("mode") or "sandbox").strip().lower()
    base = "https://connect.squareupsandbox.com" if mode != "live" else "https://connect.squareup.com"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{base}/v2/locations",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Square-Version": "2024-01-18",
            },
        )
    if resp.status_code == 401:
        raise HTTPException(status_code=400, detail="Square authentication failed — check access_token.")
    if resp.status_code >= 400:
        raise HTTPException(status_code=400, detail=resp.text[:200] or "Could not reach Square.")
    return {"ok": True, "message": f"Square credentials verified ({mode} mode)."}


async def _test_payu(creds: dict[str, Any]) -> dict[str, Any]:
    merchant_key = (creds.get("merchant_key") or "").strip()
    merchant_salt = (creds.get("merchant_salt") or "").strip()
    if not merchant_key or not merchant_salt:
        raise HTTPException(status_code=422, detail="PayU merchant_key and merchant_salt are required.")
    return {
        "ok": True,
        "message": "PayU credentials saved. Register the webhook URL in your PayU merchant panel.",
    }
