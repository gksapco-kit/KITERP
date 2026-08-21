"""Spam / bot protection for unauthenticated contact and lead forms."""
from __future__ import annotations

import logging
import re
import time
from collections import defaultdict, deque
from threading import Lock
from typing import Optional

import httpx
from fastapi import HTTPException, Request, status

from app.config import settings

logger = logging.getLogger(__name__)

_VOWELS = set("aeiou")
_HASH_RE = re.compile(r"^[A-Za-z0-9._-]{10,80}$")
_GMAIL_DOMAINS = {"gmail.com", "googlemail.com"}
_THANKS = "Thanks — we received your message and will get back to you soon."

_RATE_WINDOW_SHORT = 15 * 60
_RATE_LIMIT_SHORT = 5
_RATE_WINDOW_HOUR = 60 * 60
_RATE_LIMIT_HOUR = 15

_hits: dict[str, deque[float]] = defaultdict(deque)
_hits_lock = Lock()


class SilentFormDrop(Exception):
    """Honeypot / instant-submit: pretend success so bots do not retry."""


def client_ip(request: Request) -> str:
    fwd = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if fwd:
        return fwd[:80]
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def is_honeypot_filled(*values: Optional[str]) -> bool:
    return any((v or "").strip() for v in values)


def public_form_thanks() -> str:
    return _THANKS


def _tokens(text: Optional[str]) -> list[str]:
    return re.findall(r"[A-Za-z]{2,}", text or "")


def _vowel_ratio(token: str) -> float:
    letters = [c for c in token.lower() if c.isalpha()]
    if not letters:
        return 1.0
    return sum(1 for c in letters if c in _VOWELS) / len(letters)


def _no_vowel_name(token: str) -> bool:
    return len(token) >= 5 and _vowel_ratio(token) == 0


def _high_consonant_name(token: str) -> bool:
    return len(token) >= 6 and _vowel_ratio(token) <= 0.22


def looks_like_hash(text: Optional[str]) -> bool:
    raw = (text or "").strip()
    if not _HASH_RE.fullmatch(raw) or re.search(r"\s", raw):
        return False
    letters = [c for c in raw if c.isalpha()]
    if not letters:
        return True
    vowels = sum(1 for c in letters if c.lower() in _VOWELS)
    has_upper = any(c.isupper() for c in raw)
    has_lower = any(c.islower() for c in raw)
    if vowels == 0:
        return True
    if has_upper and has_lower and vowels / len(letters) <= 0.25:
        return True
    return False


def gmail_dot_abuse(email: Optional[str]) -> bool:
    value = (email or "").strip().lower()
    if "@" not in value:
        return False
    local, domain = value.rsplit("@", 1)
    return domain in _GMAIL_DOMAINS and local.count(".") >= 3


def score_public_form_spam(
    *,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    name: Optional[str] = None,
    email: Optional[str] = None,
    title: Optional[str] = None,
    company: Optional[str] = None,
    message: Optional[str] = None,
) -> int:
    score = 0
    name_tokens = _tokens(" ".join(p for p in (first_name, last_name, name) if p))
    if any(_no_vowel_name(tok) for tok in name_tokens):
        score += 3
    person = [t for t in _tokens(first_name or "") + _tokens(last_name or "")]
    if len(person) >= 2 and all(_high_consonant_name(t) for t in person[:2]):
        score += 3
    if gmail_dot_abuse(email):
        score += 3
    if looks_like_hash(message):
        score += 3
    if looks_like_hash(title):
        score += 2
    if looks_like_hash(company):
        score += 2
    return score


def _prune(bucket: deque[float], now: float, window: float) -> None:
    while bucket and now - bucket[0] > window:
        bucket.popleft()


def _rate_limited_memory(key: str) -> bool:
    now = time.time()
    with _hits_lock:
        bucket = _hits[key]
        _prune(bucket, now, _RATE_WINDOW_HOUR)
        short = sum(1 for ts in bucket if now - ts <= _RATE_WINDOW_SHORT)
        if short >= _RATE_LIMIT_SHORT or len(bucket) >= _RATE_LIMIT_HOUR:
            return True
        bucket.append(now)
        if len(_hits) > 8000:
            stale = [k for k, q in _hits.items() if not q or now - q[-1] > _RATE_WINDOW_HOUR]
            for k in stale[:2000]:
                _hits.pop(k, None)
        return False


async def _rate_limited(ip: str, bucket: str) -> bool:
    key = f"pf:{bucket}:{ip}"
    try:
        from app.database import redis_client
        if redis_client:
            hour_key = f"{key}:h"
            short_key = f"{key}:s"
            hour_n, short_n = await redis_client.incr(hour_key), await redis_client.incr(short_key)
            if hour_n == 1:
                await redis_client.expire(hour_key, _RATE_WINDOW_HOUR)
            if short_n == 1:
                await redis_client.expire(short_key, _RATE_WINDOW_SHORT)
            if short_n > _RATE_LIMIT_SHORT or hour_n > _RATE_LIMIT_HOUR:
                return True
            return False
    except Exception:
        logger.debug("public form redis rate-limit fallback", exc_info=True)
    return _rate_limited_memory(key)


async def _verify_turnstile(token: Optional[str], ip: str) -> bool:
    secret = (settings.TURNSTILE_SECRET_KEY or "").strip()
    if not secret:
        return True
    value = (token or "").strip()
    if not value:
        return not settings.PUBLIC_FORM_REQUIRE_CAPTCHA
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            res = await client.post(
                "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                data={"secret": secret, "response": value, "remoteip": ip},
            )
            data = res.json()
        return bool(data.get("success"))
    except Exception:
        logger.warning("Turnstile verification failed", exc_info=True)
        return not settings.PUBLIC_FORM_REQUIRE_CAPTCHA


async def enforce_public_form_guard(
    request: Request,
    *,
    bucket: str,
    honeypot: Optional[str] = None,
    extra_honeypot: Optional[str] = None,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    name: Optional[str] = None,
    email: Optional[str] = None,
    title: Optional[str] = None,
    company: Optional[str] = None,
    message: Optional[str] = None,
    form_started_at: Optional[int | str] = None,
    captcha_token: Optional[str] = None,
) -> None:
    ip = client_ip(request)

    if is_honeypot_filled(honeypot, extra_honeypot):
        logger.info("public form honeypot trip bucket=%s ip=%s", bucket, ip)
        raise SilentFormDrop()

    if form_started_at:
        try:
            started_ms = int(form_started_at)
        except (TypeError, ValueError):
            started_ms = 0
        if started_ms > 0:
            elapsed_ms = int(time.time() * 1000) - started_ms
            if 0 <= elapsed_ms < 1200:
                logger.info("public form instant submit bucket=%s ip=%s ms=%s", bucket, ip, elapsed_ms)
                raise SilentFormDrop()

    if await _rate_limited(ip, bucket):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many submissions from this network. Please try again later.",
        )

    if not await _verify_turnstile(captcha_token, ip):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not verify this submission. Please refresh and try again.",
        )

    score = score_public_form_spam(
        first_name=first_name,
        last_name=last_name,
        name=name,
        email=email,
        title=title,
        company=company,
        message=message,
    )
    if score >= 3:
        logger.info(
            "public form spam score=%s bucket=%s ip=%s email=%s name=%s",
            score, bucket, ip, (email or "")[:80], (name or first_name or "")[:80],
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="We could not accept this submission. Use a real name and a short message, or email us directly.",
        )
