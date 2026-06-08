#!/usr/bin/env python3
"""Set the subject line on the active SendGrid OTP dynamic template version.

Usage (from repo root):
  docker exec kiterp-backend python scripts/fix_sendgrid_otp_subject.py

Requires SENDGRID_API_KEY or SMTP_PASSWORD (SendGrid key starting with SG.) in backend/.env
"""
from __future__ import annotations

import os
import sys

import httpx

# Allow running inside the backend container (/app)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import get_settings
from app.services.email_service import sendgrid_api_key

SUBJECT = "Your KITERP verification code"


def main() -> int:
    settings = get_settings()
    api_key = sendgrid_api_key()
    template_id = (settings.SENDGRID_OTP_TEMPLATE_ID or "").strip()
    if not api_key:
        print("ERROR: Set SENDGRID_API_KEY (or SMTP_PASSWORD) to a valid SendGrid API key in backend/.env")
        return 1
    if not template_id:
        print("ERROR: Set SENDGRID_OTP_TEMPLATE_ID in backend/.env")
        return 1

    headers = {"Authorization": f"Bearer {api_key}"}
    with httpx.Client(timeout=30.0) as client:
        resp = client.get(f"https://api.sendgrid.com/v3/templates/{template_id}", headers=headers)
        if resp.status_code == 401:
            print("ERROR: SendGrid API key is invalid or revoked. Create a new key at:")
            print("  https://app.sendgrid.com/settings/api_keys")
            return 1
        if resp.status_code >= 400:
            print(f"ERROR: Could not load template ({resp.status_code}): {resp.text[:400]}")
            return 1

        versions = resp.json().get("versions") or []
        active = next((v for v in versions if v.get("active") == 1), None)
        if not active:
            print(f"ERROR: No active version found for template {template_id}")
            return 1

        version_id = active["id"]
        patch = client.patch(
            f"https://api.sendgrid.com/v3/templates/{template_id}/versions/{version_id}",
            headers={**headers, "Content-Type": "application/json"},
            json={"subject": SUBJECT},
        )
        if patch.status_code >= 400:
            print(f"ERROR: Could not update subject ({patch.status_code}): {patch.text[:400]}")
            return 1

    print(f"OK: Set subject to {SUBJECT!r} on template {template_id} (version {version_id})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
