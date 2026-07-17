# app/utils/validators.py
import re
from typing import Optional

# Must be a normal DNS label — email-validator rejects reserved TLDs like .local
PHONE_SIGNUP_EMAIL_DOMAIN = "phone-signup.kiterp.app"
_PHONE_SIGNUP_EMAIL_SUFFIXES = (
    f"@{PHONE_SIGNUP_EMAIL_DOMAIN}",
    "@phone-signup.kiterp.local",  # legacy placeholders
)


def phone_signup_placeholder_email(slug: str) -> str:
    """Synthetic email for phone-only vendors (DB column is NOT NULL)."""
    local = re.sub(r"[^a-z0-9._+-]+", "-", (slug or "vendor").lower()).strip("-._+") or "vendor"
    return f"{local}@{PHONE_SIGNUP_EMAIL_DOMAIN}"[:255]


def is_phone_signup_placeholder_email(email: Optional[str]) -> bool:
    e = (email or "").strip().lower()
    return any(e.endswith(suffix) for suffix in _PHONE_SIGNUP_EMAIL_SUFFIXES)


def validate_phone(phone: str) -> tuple[bool, Optional[str]]:
    """
    Validate phone number format.
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    # Remove all non-digits
    digits = re.sub(r"\D", "", phone)
    
    if len(digits) < 10:
        return False, "Phone number must have at least 10 digits"
    
    if len(digits) > 15:
        return False, "Phone number is too long"
    
    return True, None


def validate_email(email: str) -> tuple[bool, Optional[str]]:
    """
    Validate email format.
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    
    if not re.match(pattern, email):
        return False, "Invalid email format"
    
    return True, None


def validate_ifsc(ifsc: str) -> tuple[bool, Optional[str]]:
    """
    Validate Indian IFSC code format.
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    pattern = r"^[A-Z]{4}0[A-Z0-9]{6}$"
    
    if not re.match(pattern, ifsc.upper()):
        return False, "Invalid IFSC code format"
    
    return True, None


def validate_pan(pan: str) -> tuple[bool, Optional[str]]:
    """
    Validate Indian PAN card number format.
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    pattern = r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$"
    
    if not re.match(pattern, pan.upper()):
        return False, "Invalid PAN number format"
    
    return True, None


def validate_gstin(gstin: str) -> tuple[bool, Optional[str]]:
    """
    Validate Indian GSTIN format.
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    pattern = r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
    
    if not re.match(pattern, gstin.upper()):
        return False, "Invalid GSTIN format"
    
    return True, None
