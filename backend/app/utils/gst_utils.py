"""
GST utility functions for Indian Goods and Services Tax.

Place-of-supply logic:
  - Compare the first two digits of the supplier GSTIN (the state code) against
    the receiving location's state code.
  - Same state  → intra-state → CGST + SGST
  - Different   → inter-state → IGST
  - Unknown     → treat as inter-state (safe default; avoids under-charging)

State codes follow the official GST state code list (alphabetical order).
"""

from __future__ import annotations

import re
from typing import Optional

# Indian GST state codes (2-digit numeric → state name)
_STATE_CODES: dict[str, str] = {
    "01": "Jammu and Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "11": "Sikkim",
    "12": "Arunachal Pradesh",
    "13": "Nagaland",
    "14": "Manipur",
    "15": "Mizoram",
    "16": "Tripura",
    "17": "Meghalaya",
    "18": "Assam",
    "19": "West Bengal",
    "20": "Jharkhand",
    "21": "Odisha",
    "22": "Chhattisgarh",
    "23": "Madhya Pradesh",
    "24": "Gujarat",
    "25": "Daman and Diu",
    "26": "Dadra and Nagar Haveli",
    "27": "Maharashtra",
    "28": "Andhra Pradesh (old)",
    "29": "Karnataka",
    "30": "Goa",
    "31": "Lakshadweep",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "34": "Puducherry",
    "35": "Andaman and Nicobar Islands",
    "36": "Telangana",
    "37": "Andhra Pradesh",
    "38": "Ladakh",
    "97": "Other Territory",
    "99": "Centre Jurisdiction",
}

# Reverse map: state name (lowercase) → 2-digit code
_STATE_NAME_TO_CODE: dict[str, str] = {
    v.lower(): k for k, v in _STATE_CODES.items()
}

_GSTIN_RE = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z]\d$", re.IGNORECASE)


def gstin_state_code(gstin: str | None) -> Optional[str]:
    """Return the 2-digit state code embedded in a GSTIN, or None if invalid."""
    if not gstin:
        return None
    gstin = gstin.strip()
    if not _GSTIN_RE.match(gstin):
        return None
    return gstin[:2]


def state_code_from_name(state_name: str | None) -> Optional[str]:
    """Map a state name (case-insensitive) to its 2-digit GST state code."""
    if not state_name:
        return None
    return _STATE_NAME_TO_CODE.get(state_name.strip().lower())


def resolve_place_of_supply(
    supplier_gstin: str | None,
    recipient_state: str | None,
) -> Optional[str]:
    """
    Return the supplier's 2-digit GST state code which becomes the place of supply
    for inward procurement transactions under GST.

    Returns None when either GSTIN is absent or invalid (caller should treat as
    inter-state / IGST to avoid under-charging).
    """
    return gstin_state_code(supplier_gstin)


def is_intra_state(
    supplier_gstin: str | None,
    recipient_gstin: str | None = None,
    recipient_state_code: str | None = None,
    recipient_state_name: str | None = None,
) -> bool:
    """
    Return True when the supplier and recipient are in the same GST state.

    Priority for recipient state resolution:
      1. recipient_gstin first two digits
      2. recipient_state_code (2-digit code)
      3. recipient_state_name (human-readable, looked up in state table)

    Unknown → defaults to False (inter-state / IGST).
    """
    supplier_code = gstin_state_code(supplier_gstin)
    if not supplier_code:
        return False

    if recipient_gstin:
        rec_code = gstin_state_code(recipient_gstin)
    elif recipient_state_code:
        rec_code = recipient_state_code.strip() if len(recipient_state_code.strip()) == 2 else None
    elif recipient_state_name:
        rec_code = state_code_from_name(recipient_state_name)
    else:
        return False

    return bool(rec_code) and supplier_code == rec_code


def split_gst_rate(
    rate: float,
    intra: bool,
) -> tuple[float, float, float]:
    """
    Split a combined GST rate into (cgst_rate, sgst_rate, igst_rate).

    - intra-state: half to CGST, half to SGST, zero IGST
    - inter-state: zero CGST, zero SGST, full rate to IGST
    """
    if intra:
        half = round(rate / 2, 2)
        return half, half, 0.0
    return 0.0, 0.0, rate
