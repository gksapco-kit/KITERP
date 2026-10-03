"""LinkedIn Lead Sync for the platform (admin) CRM.

LinkedIn pushes a notification when someone submits a Lead Gen Form.
This service validates that webhook, fetches the form response, and creates
a CRM lead with source ``linkedin`` on the platform CRM vendor.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import re
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from urllib.parse import quote
from uuid import UUID

import httpx
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.config import settings
from app.core.encryption import decrypt_json, encrypt_json
from app.models.crm import CrmIntegration, CrmLead
from app.schemas.crm.schemas import LeadCreate
from app.services.crm.services import LeadService
from app.services.payment_integration_service import get_api_base_url

logger = logging.getLogger(__name__)

PROVIDER = "linkedin"
LINKEDIN_VERSION = "202608"
OAUTH_SCOPE = "r_marketing_leadgen_automation"
LEAD_TYPES = ("SPONSORED", "COMPANY", "EVENT", "ORGANIZATION_PRODUCT")
TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization"
API_ROOT = "https://api.linkedin.com/rest"

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

_PREDEFINED = {
    "FIRST_NAME": "first_name",
    "LAST_NAME": "last_name",
    "EMAIL": "email",
    "WORK_EMAIL": "email",
    "PHONE_NUMBER": "phone",
    "WORK_PHONE_NUMBER": "phone",
    "COMPANY_NAME": "company",
    "JOB_TITLE": "title",
    "LINKEDIN_PROFILE_LINK": "linkedin_url",
}

_NAME_HINTS = {
    "firstname": "first_name",
    "lastname": "last_name",
    "email": "email",
    "emailaddress": "email",
    "workemail": "email",
    "phone": "phone",
    "phonenumber": "phone",
    "company": "company",
    "companyname": "company",
    "jobtitle": "title",
    "linkedinprofilelink": "linkedin_url",
}


def linkedin_challenge_response(challenge_code: str, client_secret: str) -> str:
    """Hex HMAC-SHA256 of the challenge, using the LinkedIn app client secret."""
    digest = hmac.new(
        client_secret.encode("utf-8"),
        challenge_code.encode("utf-8"),
        hashlib.sha256,
    )
    return digest.hexdigest()


def _clip(value: Any, limit: int) -> Optional[str]:
    text = str(value or "").strip()
    if not text:
        return None
    return text[:limit]


def _localized(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if not isinstance(value, dict):
        return ""
    localized = value.get("localized")
    if isinstance(localized, dict) and localized:
        first = next(iter(localized.values()), "")
        return str(first or "").strip()
    return ""


def _question_label(question: dict) -> str:
    label = _localized((question or {}).get("question"))
    if label:
        return label
    return str((question or {}).get("name") or "").strip()


def _option_labels(question: dict) -> dict[str, str]:
    details = (question or {}).get("questionDetails") or {}
    if not isinstance(details, dict):
        return {}
    mc = details.get("multipleChoiceQuestionDetails") or {}
    options = mc.get("options") if isinstance(mc, dict) else None
    out: dict[str, str] = {}
    for opt in options or []:
        if not isinstance(opt, dict) or opt.get("id") is None:
            continue
        text = _localized(opt.get("text") or opt.get("label")) or str(opt.get("id"))
        out[str(opt.get("id"))] = text
    return out


def _answer_text(details: Any, option_labels: dict[str, str]) -> str:
    if not isinstance(details, dict):
        return ""
    text = details.get("textQuestionAnswer") or {}
    if isinstance(text, dict) and text.get("answer"):
        return str(text["answer"]).strip()
    mc = details.get("multipleChoiceAnswer") or {}
    if isinstance(mc, dict):
        labels = []
        for opt in mc.get("options") or []:
            labels.append(option_labels.get(str(opt), str(opt)))
        return ", ".join(part for part in labels if part)
    return ""


def map_linkedin_lead(response: dict) -> dict[str, Any]:
    """Turn a LinkedIn leadFormResponse into CRM lead fields."""
    form = response.get("form") if isinstance(response.get("form"), dict) else {}
    questions = ((form.get("content") or {}).get("questions") or []) if isinstance(form, dict) else []
    by_id: dict[str, dict] = {}
    for question in questions:
        if isinstance(question, dict) and question.get("questionId") is not None:
            by_id[str(question["questionId"])] = question

    fields: dict[str, str] = {}
    extras: list[str] = []
    answers = ((response.get("formResponse") or {}).get("answers") or [])
    for answer in answers:
        if not isinstance(answer, dict):
            continue
        question = by_id.get(str(answer.get("questionId")))
        option_labels = _option_labels(question or {})
        text = _answer_text(answer.get("answerDetails"), option_labels)
        if not text:
            continue
        key = None
        if question:
            predefined = str(question.get("predefinedField") or "").upper()
            key = _PREDEFINED.get(predefined)
            if not key:
                hint = re.sub(r"[^a-z]", "", str(question.get("name") or "").lower())
                key = _NAME_HINTS.get(hint)
                if not key:
                    label_hint = re.sub(r"[^a-z]", "", _question_label(question).lower())
                    key = _NAME_HINTS.get(label_hint)
        if key and key not in fields:
            fields[key] = text
        else:
            label = _question_label(question) if question else f"Question {answer.get('questionId')}"
            extras.append(f"{label}: {text}")

    form_name = _localized(form.get("name")) if isinstance(form.get("name"), dict) else str(form.get("name") or "").strip()
    meta = response.get("leadMetadataInfo") if isinstance(response.get("leadMetadataInfo"), dict) else {}
    sponsored = meta.get("sponsoredLeadMetadataInfo") if isinstance(meta, dict) else {}
    campaign = (sponsored or {}).get("campaign") if isinstance(sponsored, dict) else None
    campaign_name = campaign.get("name") if isinstance(campaign, dict) else None

    email = fields.get("email") or ""
    if email and not _EMAIL_RE.match(email):
        extras.append(f"Email: {email}")
        email = ""

    response_id = str(response.get("id") or "").strip()
    submitted_at = response.get("submittedAt")
    dedupe_key = f"urn:li:leadGenFormResponse:{response_id}_{submitted_at}" if response_id else ""

    notes_lines = []
    if form_name:
        notes_lines.append(f"LinkedIn form: {form_name}")
    if fields.get("linkedin_url"):
        notes_lines.append(f"LinkedIn profile: {fields['linkedin_url']}")
    notes_lines.extend(extras)

    first_name = fields.get("first_name") or "LinkedIn"
    return {
        "first_name": _clip(first_name, 120) or "LinkedIn",
        "last_name": _clip(fields.get("last_name"), 120),
        "company": _clip(fields.get("company"), 255),
        "email": _clip(email, 255),
        "phone": _clip(fields.get("phone"), 50),
        "title": _clip(fields.get("title"), 120),
        "source": "linkedin",
        "source_campaign": _clip(campaign_name or form_name or "LinkedIn", 255),
        "status": "new",
        "notes": "\n".join(notes_lines) or None,
        "tags": ["linkedin"],
        "custom_fields": {
            "linkedin_response_id": f"urn:li:leadGenFormResponse:{response_id}" if response_id else None,
            "linkedin_dedupe_key": dedupe_key or None,
            "linkedin_submitted_at": submitted_at,
            "linkedin_lead_type": response.get("leadType"),
            "linkedin_url": fields.get("linkedin_url"),
            "linkedin_form": form_name or None,
            "linkedin_test": bool(response.get("testLead")),
        },
        "intake_payload": {
            "provider": "linkedin",
            "id": response_id or None,
            "lead_type": response.get("leadType"),
            "submitted_at": submitted_at,
            "form": form_name or None,
            "test_lead": bool(response.get("testLead")),
        },
    }


def _numeric_id(value: str, label: str) -> str:
    raw = (value or "").strip()
    if raw.lower().startswith("urn:"):
        raw = raw.rsplit(":", 1)[-1].strip()
    if not raw.isdigit():
        raise HTTPException(status_code=400, detail=f"{label} should be the numeric LinkedIn ID.")
    return raw


def _admin_return_url(query: str = "") -> str:
    base = (os.environ.get("ADMIN_APP_URL") or "http://localhost:3000").rstrip("/")
    path = f"{base}/dashboard/crm/linkedin"
    return f"{path}?{query}" if query else path


class LinkedInLeadService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _row(self, vendor_id: UUID) -> Optional[CrmIntegration]:
        result = await self.db.execute(
            select(CrmIntegration).where(
                CrmIntegration.vendor_id == vendor_id,
                CrmIntegration.provider == PROVIDER,
            )
        )
        return result.scalar_one_or_none()

    def _creds(self, row: Optional[CrmIntegration]) -> dict:
        if not row:
            return {}
        return decrypt_json(row.encrypted_credentials) or {}

    def _settings(self, row: Optional[CrmIntegration]) -> dict:
        if not row or not isinstance(row.settings, dict):
            return {}
        return dict(row.settings)

    def redirect_uri(self) -> str:
        return f"{get_api_base_url()}/admin/crm/linkedin/callback"

    def webhook_url(self, secret: str) -> str:
        return f"{get_api_base_url()}/admin/crm/linkedin/webhook?secret={quote(secret, safe='')}"

    def public_status(self, row: Optional[CrmIntegration]) -> dict:
        creds = self._creds(row)
        stored = self._settings(row)
        secret = str(creds.get("webhook_secret") or "")
        connected = bool(creds.get("access_token"))
        status = "disconnected"
        if row:
            status = row.status or ("connected" if connected else "configured")
        if connected and status == "configured":
            status = "connected"
        return {
            "status": status,
            "connected": connected,
            "client_id": creds.get("client_id") or "",
            "client_secret_set": bool(creds.get("client_secret")),
            "organization_id": stored.get("organization_id") or "",
            "sponsored_account_id": stored.get("sponsored_account_id") or "",
            "lead_type": stored.get("lead_type") or "SPONSORED",
            "subscription_id": stored.get("subscription_id"),
            "webhook_url": self.webhook_url(secret) if secret else "",
            "redirect_uri": self.redirect_uri(),
            "webhook_https": self.webhook_url(secret).startswith("https://") if secret else False,
            "last_error": row.last_error if row else None,
            "last_synced_at": row.last_synced_at.isoformat() if row and row.last_synced_at else None,
            "scope": OAUTH_SCOPE,
            "lead_types": list(LEAD_TYPES),
        }

    async def save(self, vendor_id: UUID, payload: dict) -> dict:
        row = await self._row(vendor_id)
        creds = self._creds(row)
        stored = self._settings(row)

        client_id = str(payload.get("client_id") or creds.get("client_id") or "").strip()
        if not client_id:
            raise HTTPException(status_code=400, detail="LinkedIn Client ID is required.")
        if client_id != str(creds.get("client_id") or ""):
            creds.pop("access_token", None)
            creds.pop("refresh_token", None)
            creds.pop("expires_at", None)

        secret = str(payload.get("client_secret") or "").strip()
        if secret:
            creds["client_secret"] = secret
        elif not creds.get("client_secret"):
            raise HTTPException(status_code=400, detail="LinkedIn Client Secret is required.")

        creds["client_id"] = client_id
        if not creds.get("webhook_secret"):
            creds["webhook_secret"] = secrets.token_urlsafe(24)

        lead_type = str(payload.get("lead_type") or stored.get("lead_type") or "SPONSORED").upper()
        if lead_type not in LEAD_TYPES:
            raise HTTPException(status_code=400, detail="Choose a LinkedIn lead type.")
        stored["lead_type"] = lead_type
        stored["organization_id"] = str(payload.get("organization_id") or "").strip()
        stored["sponsored_account_id"] = str(payload.get("sponsored_account_id") or "").strip()

        if row is None:
            row = CrmIntegration(
                vendor_id=vendor_id,
                provider=PROVIDER,
                label="LinkedIn Lead Gen",
                status="connected" if creds.get("access_token") else "configured",
                settings=stored,
                encrypted_credentials=encrypt_json(creds),
            )
            self.db.add(row)
        else:
            row.label = row.label or "LinkedIn Lead Gen"
            row.settings = stored
            row.encrypted_credentials = encrypt_json(creds)
            row.status = "connected" if creds.get("access_token") else "configured"
            row.last_error = None
            flag_modified(row, "settings")
        await self.db.commit()
        await self.db.refresh(row)
        return self.public_status(row)

    async def disconnect(self, vendor_id: UUID) -> dict:
        row = await self._row(vendor_id)
        if not row:
            return self.public_status(None)
        creds = self._creds(row)
        creds.pop("access_token", None)
        creds.pop("refresh_token", None)
        creds.pop("expires_at", None)
        row.encrypted_credentials = encrypt_json(creds)
        row.status = "configured" if creds.get("client_id") else "disconnected"
        stored = self._settings(row)
        stored.pop("subscription_id", None)
        row.settings = stored
        flag_modified(row, "settings")
        await self.db.commit()
        await self.db.refresh(row)
        return self.public_status(row)

    def _sign_state(self) -> str:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
        return jwt.encode(
            {"purpose": "linkedin_oauth", "exp": expire},
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM,
        )

    def _read_state(self, state: str) -> None:
        try:
            payload = jwt.decode(state, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        except JWTError as exc:
            raise HTTPException(status_code=400, detail="LinkedIn login expired. Start the connection again.") from exc
        if payload.get("purpose") != "linkedin_oauth":
            raise HTTPException(status_code=400, detail="Invalid LinkedIn login state.")

    async def authorize_url(self, vendor_id: UUID) -> str:
        row = await self._row(vendor_id)
        creds = self._creds(row)
        client_id = str(creds.get("client_id") or "").strip()
        if not client_id or not creds.get("client_secret"):
            raise HTTPException(status_code=400, detail="Save the LinkedIn app Client ID and Client Secret first.")
        query = (
            f"response_type=code&client_id={quote(client_id, safe='')}"
            f"&redirect_uri={quote(self.redirect_uri(), safe='')}"
            f"&state={quote(self._sign_state(), safe='')}"
            f"&scope={quote(OAUTH_SCOPE, safe='')}"
        )
        return f"{AUTHORIZE_URL}?{query}"

    async def _require_creds(self, vendor_id: UUID) -> tuple[CrmIntegration, dict]:
        row = await self._row(vendor_id)
        creds = self._creds(row)
        if not row or not creds.get("client_secret"):
            raise HTTPException(status_code=400, detail="LinkedIn is not configured.")
        return row, creds

    async def finish_oauth(self, code: str, state: str) -> RedirectResponse:
        if not code or not state:
            return RedirectResponse(_admin_return_url("error=linkedin_denied"), status_code=302)
        try:
            self._read_state(state)
        except HTTPException:
            return RedirectResponse(_admin_return_url("error=linkedin_denied"), status_code=302)
        from app.services.platform_crm_tenant import get_platform_crm_vendor_id

        vendor_id = await get_platform_crm_vendor_id(self.db)
        try:
            row, creds = await self._require_creds(vendor_id)
        except HTTPException:
            return RedirectResponse(_admin_return_url("error=linkedin_not_configured"), status_code=302)
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.post(
                    TOKEN_URL,
                    data={
                        "grant_type": "authorization_code",
                        "code": code,
                        "redirect_uri": self.redirect_uri(),
                        "client_id": creds["client_id"],
                        "client_secret": creds["client_secret"],
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
            body = resp.json() if resp.content else {}
        except httpx.HTTPError as exc:
            logger.warning("LinkedIn token exchange failed: %s", exc)
            return RedirectResponse(_admin_return_url("error=linkedin_unreachable"), status_code=302)
        if resp.status_code >= 400 or not body.get("access_token"):
            detail = body.get("error_description") or body.get("error") or "LinkedIn rejected the login"
            row.status = "error"
            row.last_error = str(detail)[:500]
            await self.db.commit()
            return RedirectResponse(_admin_return_url("error=linkedin_denied"), status_code=302)

        creds["access_token"] = body["access_token"]
        if body.get("refresh_token"):
            creds["refresh_token"] = body["refresh_token"]
        expires_in = int(body.get("expires_in") or 0)
        creds["expires_at"] = int(time.time()) + expires_in if expires_in else None
        row.encrypted_credentials = encrypt_json(creds)
        row.status = "connected"
        row.last_error = None
        await self.db.commit()
        return RedirectResponse(_admin_return_url("connected=1"), status_code=302)

    async def _access_token(self, vendor_id: UUID) -> str:
        row, creds = await self._require_creds(vendor_id)
        token = str(creds.get("access_token") or "")
        expires_at = int(creds.get("expires_at") or 0)
        if token and (not expires_at or expires_at - 60 > int(time.time())):
            return token
        refresh = str(creds.get("refresh_token") or "")
        if not refresh:
            raise HTTPException(status_code=401, detail="Connect the LinkedIn account again. The login has expired.")
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                TOKEN_URL,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh,
                    "client_id": creds["client_id"],
                    "client_secret": creds["client_secret"],
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        body = resp.json() if resp.content else {}
        if resp.status_code >= 400 or not body.get("access_token"):
            row.status = "error"
            row.last_error = "LinkedIn login expired. Connect the account again."
            await self.db.commit()
            raise HTTPException(status_code=401, detail=row.last_error)
        creds["access_token"] = body["access_token"]
        if body.get("refresh_token"):
            creds["refresh_token"] = body["refresh_token"]
        expires_in = int(body.get("expires_in") or 0)
        creds["expires_at"] = int(time.time()) + expires_in if expires_in else None
        row.encrypted_credentials = encrypt_json(creds)
        row.status = "connected"
        row.last_error = None
        await self.db.commit()
        return str(creds["access_token"])

    def _headers(self, token: str) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {token}",
            "LinkedIn-Version": LINKEDIN_VERSION,
            "X-Restli-Protocol-Version": "2.0.0",
            "Content-Type": "application/json",
        }

    def _owner(self, stored: dict) -> tuple[str, str, str]:
        lead_type = str(stored.get("lead_type") or "SPONSORED").upper()
        if lead_type not in LEAD_TYPES:
            lead_type = "SPONSORED"
        if lead_type == "SPONSORED":
            account_id = _numeric_id(str(stored.get("sponsored_account_id") or ""), "Ad account ID")
            return lead_type, "sponsoredAccount", f"urn:li:sponsoredAccount:{account_id}"
        org_id = _numeric_id(str(stored.get("organization_id") or ""), "Company page ID")
        return lead_type, "organization", f"urn:li:organization:{org_id}"

    async def subscribe(self, vendor_id: UUID) -> dict:
        row, _creds = await self._require_creds(vendor_id)
        stored = self._settings(row)
        secret = str(self._creds(row).get("webhook_secret") or "")
        if not secret:
            raise HTTPException(status_code=400, detail="Save the LinkedIn app credentials first.")
        lead_type, owner_key, owner_urn = self._owner(stored)
        token = await self._access_token(vendor_id)
        payload = {
            "webhook": self.webhook_url(secret),
            "owner": {owner_key: owner_urn},
            "leadType": lead_type,
        }
        async with httpx.AsyncClient(timeout=25) as client:
            resp = await client.post(
                f"{API_ROOT}/leadNotifications",
                json=payload,
                headers=self._headers(token),
            )
        body = resp.json() if resp.content else {}
        if resp.status_code >= 400:
            message = _linkedin_error(body) or "LinkedIn did not accept the lead subscription."
            row.last_error = message[:500]
            row.status = "error"
            await self.db.commit()
            raise HTTPException(status_code=400, detail=message)
        sub_id = body.get("id")
        if sub_id is None and isinstance(body.get("value"), dict):
            sub_id = body["value"].get("id")
        stored["subscription_id"] = sub_id
        row.settings = stored
        row.status = "connected"
        row.last_error = None
        flag_modified(row, "settings")
        await self.db.commit()
        await self.db.refresh(row)
        status = self.public_status(row)
        status["subscribed"] = True
        return status

    async def sync_recent(self, vendor_id: UUID) -> dict:
        row, _creds = await self._require_creds(vendor_id)
        stored = self._settings(row)
        lead_type, owner_key, owner_urn = self._owner(stored)
        token = await self._access_token(vendor_id)
        now_ms = int(time.time() * 1000)
        start_ms = now_ms - 30 * 24 * 60 * 60 * 1000
        encoded_urn = quote(owner_urn, safe="")
        url = (
            f"{API_ROOT}/leadFormResponses?q=owner"
            f"&owner=({owner_key}:{encoded_urn})"
            f"&leadType=(leadType:{lead_type})"
            f"&submittedAtTimeRange=(start:{start_ms},end:{now_ms})"
            "&count=50&start=0"
            "&fields=id,submittedAt,leadType,testLead,formResponse,ownerInfo,leadMetadataInfo,form:(name,content)"
        )
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, headers=self._headers(token))
        body = resp.json() if resp.content else {}
        if resp.status_code >= 400:
            message = _linkedin_error(body) or "Could not read LinkedIn leads."
            row.last_error = message[:500]
            await self.db.commit()
            raise HTTPException(status_code=400, detail=message)
        elements = body.get("elements") if isinstance(body, dict) else None
        created = 0
        duplicates = 0
        for element in elements or []:
            if not isinstance(element, dict):
                continue
            result = await self._ingest_response(vendor_id, element)
            if result == "created":
                created += 1
            elif result == "duplicate":
                duplicates += 1
        row.last_synced_at = datetime.now(timezone.utc)
        row.last_error = None
        row.status = "connected"
        await self.db.commit()
        return {"ok": True, "created": created, "duplicates": duplicates}

    async def create_test_lead(self, vendor_id: UUID) -> Any:
        stamp = secrets.token_hex(4)
        data = LeadCreate(
            first_name="LinkedIn",
            last_name="Test",
            company="LinkedIn Lead Gen",
            email=f"linkedin-test-{stamp}@example.com",
            source="linkedin",
            source_campaign="LinkedIn test",
            status="new",
            notes="Test lead from CRM Management → LinkedIn. Form submissions from LinkedIn use this same source.",
            tags=["linkedin", "test"],
            custom_fields={"linkedin_test": True},
        )
        return await LeadService(self.db).create(vendor_id, data)

    async def _check_secret(self, request: Request) -> tuple[UUID, str]:
        from app.services.platform_crm_tenant import get_platform_crm_vendor_id

        vendor_id = await get_platform_crm_vendor_id(self.db)
        row, creds = await self._require_creds(vendor_id)
        expected = str(creds.get("webhook_secret") or "")
        provided = str(request.query_params.get("secret") or "")
        if not expected or not provided or not hmac.compare_digest(provided, expected):
            raise HTTPException(status_code=401, detail="Invalid LinkedIn webhook secret.")
        return vendor_id, str(creds["client_secret"])

    async def handle_challenge(self, request: Request) -> JSONResponse:
        _vendor_id, client_secret = await self._check_secret(request)
        code = str(request.query_params.get("challengeCode") or "").strip()
        if not code:
            raise HTTPException(status_code=400, detail="Missing challengeCode.")
        return JSONResponse(
            {
                "challengeCode": code,
                "challengeResponse": linkedin_challenge_response(code, client_secret),
            }
        )

    async def handle_webhook(self, request: Request) -> JSONResponse:
        vendor_id, client_secret = await self._check_secret(request)
        code = str(request.query_params.get("challengeCode") or "").strip()
        body: Any = {}
        if request.method.upper() != "GET":
            try:
                body = await request.json()
            except Exception:
                body = {}
        if not code and isinstance(body, dict):
            code = str(body.get("challengeCode") or "").strip()
        if code:
            return JSONResponse(
                {
                    "challengeCode": code,
                    "challengeResponse": linkedin_challenge_response(code, client_secret),
                }
            )

        events = body if isinstance(body, list) else [body]
        created = 0
        duplicates = 0
        for event in events:
            if not isinstance(event, dict):
                continue
            action = str(event.get("leadAction") or "CREATED").upper()
            response_urn = str(event.get("leadGenFormResponse") or "").strip()
            if not response_urn:
                continue
            if action == "DELETED":
                await self._mark_deleted(vendor_id, response_urn)
                continue
            response_id = response_urn.rsplit(":", 1)[-1]
            fetched = await self._fetch_response(vendor_id, response_id)
            if not fetched:
                raise HTTPException(status_code=502, detail="Could not read the LinkedIn lead.")
            result = await self._ingest_response(vendor_id, fetched)
            if result == "created":
                created += 1
            elif result == "duplicate":
                duplicates += 1
        row = await self._row(vendor_id)
        if row:
            row.last_synced_at = datetime.now(timezone.utc)
            row.last_error = None
            await self.db.commit()
        return JSONResponse({"ok": True, "created": created, "duplicates": duplicates})

    async def _fetch_response(self, vendor_id: UUID, response_id: str) -> Optional[dict]:
        token = await self._access_token(vendor_id)
        url = (
            f"{API_ROOT}/leadFormResponses/{quote(response_id, safe='')}"
            "?fields=id,submittedAt,leadType,testLead,formResponse,ownerInfo,leadMetadataInfo,form:(name,content)"
        )
        async with httpx.AsyncClient(timeout=25) as client:
            resp = await client.get(url, headers=self._headers(token))
        if resp.status_code >= 400:
            logger.warning("LinkedIn lead fetch failed: %s %s", resp.status_code, resp.text[:300])
            return None
        data = resp.json() if resp.content else {}
        return data if isinstance(data, dict) else None

    async def _ingest_response(self, vendor_id: UUID, response: dict) -> str:
        mapped = map_linkedin_lead(response)
        dedupe_key = (mapped.get("custom_fields") or {}).get("linkedin_dedupe_key")
        if dedupe_key:
            existing = await self.db.execute(
                select(CrmLead.id).where(
                    CrmLead.vendor_id == vendor_id,
                    CrmLead.deleted_at.is_(None),
                    CrmLead.custom_fields["linkedin_dedupe_key"].astext == dedupe_key,
                )
            )
            if existing.scalar_one_or_none():
                return "duplicate"
        custom = {k: v for k, v in (mapped.get("custom_fields") or {}).items() if v is not None}
        data = LeadCreate(
            first_name=mapped["first_name"],
            last_name=mapped.get("last_name"),
            company=mapped.get("company"),
            email=mapped.get("email"),
            phone=mapped.get("phone"),
            title=mapped.get("title"),
            source="linkedin",
            source_campaign=mapped.get("source_campaign"),
            status="new",
            notes=mapped.get("notes"),
            tags=mapped.get("tags"),
            custom_fields=custom,
            intake_payload=mapped.get("intake_payload"),
        )
        await LeadService(self.db).create(vendor_id, data)
        return "created"

    async def _mark_deleted(self, vendor_id: UUID, response_urn: str) -> None:
        result = await self.db.execute(
            select(CrmLead).where(
                CrmLead.vendor_id == vendor_id,
                CrmLead.deleted_at.is_(None),
                CrmLead.custom_fields["linkedin_response_id"].astext == response_urn,
            )
        )
        for lead in result.scalars().all():
            fields = dict(lead.custom_fields or {})
            fields["linkedin_status"] = "deleted"
            lead.custom_fields = fields
            flag_modified(lead, "custom_fields")
            note = (lead.notes or "").strip()
            extra = "LinkedIn reported this registration as removed."
            if extra not in note:
                lead.notes = f"{note}\n{extra}".strip()
        await self.db.commit()


def _linkedin_error(body: Any) -> str:
    if not isinstance(body, dict):
        return ""
    message = body.get("message") or body.get("error_description") or body.get("error")
    if message:
        return str(message)
    details = body.get("errorDetails") or body.get("errors")
    if isinstance(details, dict):
        return str(details.get("message") or details)[:400]
    if isinstance(details, list) and details:
        first = details[0]
        if isinstance(first, dict):
            return str(first.get("message") or first)[:400]
    return ""
