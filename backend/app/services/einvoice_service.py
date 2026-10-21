"""GST e-invoice (IRN) generation for sales tax invoices.

The sales invoice is always created first. When the vendor has
``settings.auto_generate_einvoice`` turned on, this service then submits that
invoice to a GST IRP / GSP. Failures are stored on the invoice and never block
the existing invoice path.
"""
from __future__ import annotations

import base64
import io
import logging
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any

import httpx

from app.config import settings as app_settings
from app.utils.gst_utils import gstin_state_code, state_code_from_name

log = logging.getLogger(__name__)

AUTO_GENERATE_EINVOICE_KEY = "auto_generate_einvoice"
EINVOICE_CREDENTIALS_KEY = "einvoice"

STATUS_NONE = "none"
STATUS_GENERATED = "generated"
STATUS_FAILED = "failed"
STATUS_CANCELLED = "cancelled"

NIC_SANDBOX_BASE = "https://einv-apisandbox.nic.in"
NIC_LIVE_BASE = "https://einv-api.nic.in"
AUTH_PATH = "/eivital/v1.04/auth"
GENERATE_PATH = "/eicore/v1.03/Invoice"


def auto_generate_einvoice(vendor_settings: dict | None) -> bool:
    return bool(vendor_settings and vendor_settings.get(AUTO_GENERATE_EINVOICE_KEY))


def _einvoice_blob(invoice) -> dict:
    blob = getattr(invoice, "einvoice", None)
    return dict(blob) if isinstance(blob, dict) else {}


def einvoice_status(invoice) -> str:
    return str(_einvoice_blob(invoice).get("status") or STATUS_NONE)


def flatten_einvoice(invoice) -> dict:
    blob = _einvoice_blob(invoice)
    return {
        "einvoice_status": blob.get("status") or STATUS_NONE,
        "einvoice_irn": blob.get("irn"),
        "einvoice_ack_no": blob.get("ack_no"),
        "einvoice_ack_dt": blob.get("ack_dt"),
        "einvoice_error": blob.get("error"),
        "einvoice_signed_qr": blob.get("signed_qr"),
    }


def _pin_from_address(addr: Any) -> int | None:
    if not isinstance(addr, dict):
        return None
    raw = addr.get("postal_code") or addr.get("pincode") or addr.get("pin") or addr.get("zip")
    digits = "".join(ch for ch in str(raw or "") if ch.isdigit())
    if len(digits) != 6:
        return None
    return int(digits)


def _state_code(gstin: str | None, addr: Any = None, fallback: str | None = None) -> str | None:
    code = gstin_state_code(gstin)
    if code:
        return code
    if gstin and len(str(gstin).strip()) >= 2 and str(gstin).strip()[:2].isdigit():
        return str(gstin).strip()[:2]
    if isinstance(addr, dict):
        named = state_code_from_name(addr.get("state"))
        if named:
            return named
        raw = str(addr.get("state_code") or addr.get("stcd") or "").strip()
        if len(raw) == 2 and raw.isdigit():
            return raw
    if fallback and len(str(fallback).strip()) == 2:
        return str(fallback).strip()
    return None


def _loc_from_address(addr: Any, fallback: str = "") -> str:
    if isinstance(addr, dict):
        return str(addr.get("city") or addr.get("loc") or addr.get("district") or fallback or "NA")[:100]
    return (fallback or "NA")[:100]


def _addr1(addr: Any, fallback: str = "NA") -> str:
    if isinstance(addr, dict):
        line = addr.get("street") or addr.get("addr1") or addr.get("line1") or addr.get("address")
        if line:
            return str(line)[:100]
    return (fallback or "NA")[:100]


def eligibility_error(invoice) -> str | None:
    """Return a reason the invoice cannot be sent to the IRP, or None if eligible."""
    if getattr(invoice, "invoice_type", None) != "invoice":
        return "Only tax invoices can be submitted as an e-invoice"
    if getattr(invoice, "status", None) == "cancelled":
        return "Cancelled invoices cannot be submitted as an e-invoice"
    if getattr(invoice, "document_type", None) != "tax_invoice":
        return "Bill of supply documents are not e-invoices"
    if not getattr(invoice, "is_gst", True):
        return "GST is not enabled on this invoice"
    vendor_gstin = (getattr(invoice, "vendor_gstin", None) or "").strip()
    customer_gstin = (getattr(invoice, "customer_gstin", None) or "").strip()
    if len(vendor_gstin) != 15:
        return "Seller GSTIN is required to generate an e-invoice"
    if len(customer_gstin) != 15:
        return "Buyer GSTIN is required to generate an e-invoice (B2B only)"
    if einvoice_status(invoice) == STATUS_GENERATED and _einvoice_blob(invoice).get("irn"):
        return "An IRN already exists for this invoice"
    return None


def build_irp_payload(invoice) -> dict:
    """Build the NIC / GSP JSON body from a stored sales invoice."""
    vendor_addr = getattr(invoice, "vendor_address", None) or {}
    bill_addr = getattr(invoice, "billing_address", None) or {}
    ship_addr = getattr(invoice, "shipping_address", None) or bill_addr
    vendor_gstin = (getattr(invoice, "vendor_gstin", None) or "").strip().upper()
    customer_gstin = (getattr(invoice, "customer_gstin", None) or "").strip().upper()
    seller_stcd = _state_code(vendor_gstin, vendor_addr) or "99"
    buyer_stcd = _state_code(customer_gstin, bill_addr) or seller_stcd
    pos = str(getattr(invoice, "place_of_supply", None) or "").strip()
    if len(pos) != 2 or not pos.isdigit():
        pos = buyer_stcd

    inv_date = getattr(invoice, "invoice_date", None) or getattr(invoice, "created_at", None)
    if isinstance(inv_date, datetime):
        inv_date = inv_date.date()
    if not isinstance(inv_date, date):
        inv_date = date.today()

    is_inter = bool(getattr(invoice, "is_inter_state", False))
    items_out = []
    for idx, raw in enumerate(getattr(invoice, "items", None) or [], start=1):
        if not isinstance(raw, dict):
            continue
        qty = float(raw.get("qty") or 0)
        rate = float(raw.get("rate") or raw.get("price") or 0)
        taxable = float(raw.get("taxable_value") or (qty * rate))
        cgst_amt = float(raw.get("cgst_amt") or 0)
        sgst_amt = float(raw.get("sgst_amt") or 0)
        igst_amt = float(raw.get("igst_amt") or 0)
        gst_rt = float(raw.get("tax_rate") or 0)
        if not gst_rt:
            gst_rt = float(raw.get("igst_rate") or 0) or (
                float(raw.get("cgst_rate") or 0) + float(raw.get("sgst_rate") or 0)
            )
        if is_inter:
            cgst_amt = 0
            sgst_amt = 0
        else:
            igst_amt = 0
        items_out.append({
            "SlNo": str(idx),
            "PrdDesc": str(raw.get("name") or raw.get("description") or "Item")[:100],
            "IsServc": "Y" if str(raw.get("item_type") or "").lower() == "service" else "N",
            "HsnCd": str(raw.get("hsn_sac") or raw.get("hsn_code") or raw.get("sac_code") or "00"),
            "Qty": qty,
            "Unit": str(raw.get("unit") or "NOS")[:8],
            "UnitPrice": round(rate, 2),
            "TotAmt": round(qty * rate, 2),
            "Discount": round(float(raw.get("discount") or 0), 2),
            "AssAmt": round(taxable, 2),
            "GstRt": round(gst_rt, 2),
            "CgstAmt": round(cgst_amt, 2),
            "SgstAmt": round(sgst_amt, 2),
            "IgstAmt": round(igst_amt, 2),
            "TotItemVal": round(float(raw.get("total") or (taxable + cgst_amt + sgst_amt + igst_amt)), 2),
        })

    seller_pin = _pin_from_address(vendor_addr) or 999999
    buyer_pin = _pin_from_address(bill_addr) or _pin_from_address(ship_addr) or seller_pin

    return {
        "Version": "1.1",
        "TranDtls": {"TaxSch": "GST", "SupTyp": "B2B", "RegRev": "N", "IgstOnIntra": "N"},
        "DocDtls": {
            "Typ": "INV",
            "No": str(getattr(invoice, "invoice_number", "") or "")[:16],
            "Dt": inv_date.strftime("%d/%m/%Y"),
        },
        "SellerDtls": {
            "Gstin": vendor_gstin,
            "LglNm": str(getattr(invoice, "vendor_name", None) or "Seller")[:100],
            "Addr1": _addr1(vendor_addr),
            "Loc": _loc_from_address(vendor_addr),
            "Pin": seller_pin,
            "Stcd": seller_stcd,
        },
        "BuyerDtls": {
            "Gstin": customer_gstin,
            "LglNm": str(getattr(invoice, "customer_name", None) or "Buyer")[:100],
            "Pos": pos,
            "Addr1": _addr1(bill_addr, _addr1(ship_addr)),
            "Loc": _loc_from_address(bill_addr, _loc_from_address(ship_addr)),
            "Pin": buyer_pin,
            "Stcd": buyer_stcd,
        },
        "ItemList": items_out,
        "ValDtls": {
            "AssVal": round(float(getattr(invoice, "taxable_amount", 0) or 0), 2),
            "CgstVal": round(float(getattr(invoice, "cgst_amount", 0) or 0), 2),
            "SgstVal": round(float(getattr(invoice, "sgst_amount", 0) or 0), 2),
            "IgstVal": round(float(getattr(invoice, "igst_amount", 0) or 0), 2),
            "Discount": round(float(getattr(invoice, "discount_amount", 0) or 0), 2),
            "RndOffAmt": round(float(getattr(invoice, "round_off", 0) or 0), 2),
            "TotInvVal": round(float(getattr(invoice, "total", 0) or 0), 2),
        },
    }


@dataclass
class EinvoiceCredentials:
    gstin: str
    client_id: str
    client_secret: str
    username: str
    password: str
    sandbox: bool = True
    auth_url: str = ""
    generate_url: str = ""


def resolve_credentials(vendor, vendor_settings: dict | None) -> EinvoiceCredentials | None:
    settings = vendor_settings or {}
    raw = settings.get(EINVOICE_CREDENTIALS_KEY)
    creds = raw if isinstance(raw, dict) else {}
    gstin = (getattr(vendor, "gstin", None) or "").strip().upper()
    client_id = str(creds.get("client_id") or getattr(app_settings, "EINVOICE_CLIENT_ID", "") or "").strip()
    client_secret = str(
        creds.get("client_secret") or getattr(app_settings, "EINVOICE_CLIENT_SECRET", "") or ""
    ).strip()
    username = str(creds.get("username") or getattr(app_settings, "EINVOICE_USERNAME", "") or "").strip()
    password = str(creds.get("password") or getattr(app_settings, "EINVOICE_PASSWORD", "") or "").strip()
    sandbox = creds.get("sandbox")
    if sandbox is None:
        sandbox = bool(getattr(app_settings, "EINVOICE_SANDBOX", True))
    if not (gstin and client_id and client_secret and username and password):
        return None
    base = str(getattr(app_settings, "EINVOICE_API_BASE", "") or "").rstrip("/")
    if not base:
        base = NIC_SANDBOX_BASE if sandbox else NIC_LIVE_BASE
    return EinvoiceCredentials(
        gstin=gstin,
        client_id=client_id,
        client_secret=client_secret,
        username=username,
        password=password,
        sandbox=bool(sandbox),
        auth_url=str(getattr(app_settings, "EINVOICE_AUTH_URL", "") or f"{base}{AUTH_PATH}"),
        generate_url=str(getattr(app_settings, "EINVOICE_GENERATE_URL", "") or f"{base}{GENERATE_PATH}"),
    )


def render_qr_png(signed_qr: str) -> bytes | None:
    if not signed_qr:
        return None
    try:
        import qrcode
    except ImportError:
        log.warning("qrcode package is not installed; skipping e-invoice QR image")
        return None
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=4, border=2)
    qr.add_data(signed_qr)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def render_qr_data_url(signed_qr: str) -> str | None:
    png = render_qr_png(signed_qr)
    if not png:
        return None
    return "data:image/png;base64," + base64.b64encode(png).decode("ascii")


def _irp_error_message(body: Any, fallback: str) -> str:
    if isinstance(body, dict):
        err = body.get("ErrorDetails") or body.get("error") or body.get("message") or body.get("Status")
        if isinstance(err, list) and err:
            first = err[0] if isinstance(err[0], dict) else {"ErrorMessage": str(err[0])}
            return str(first.get("ErrorMessage") or first.get("message") or first)
        if err:
            return str(err)
        data = body.get("Data")
        if isinstance(data, dict) and data.get("ErrorDetails"):
            return _irp_error_message(data, fallback)
    return fallback


async def _authenticate(creds: EinvoiceCredentials) -> str:
    headers = {
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "Gstin": creds.gstin,
    }
    payload = {"UserName": creds.username, "Password": creds.password, "ForceRefreshAccessToken": True}
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(creds.auth_url, headers=headers, json=payload)
    body = {}
    try:
        body = response.json()
    except Exception:
        body = {}
    if response.status_code >= 400:
        raise ValueError(_irp_error_message(body, f"e-invoice login failed ({response.status_code})"))
    data = body.get("Data") if isinstance(body.get("Data"), dict) else body
    token = (
        (data or {}).get("AuthToken")
        or (data or {}).get("auth_token")
        or body.get("AuthToken")
        or body.get("token")
    )
    if not token:
        raise ValueError(_irp_error_message(body, "e-invoice login did not return an AuthToken"))
    return str(token)


async def _submit_invoice(creds: EinvoiceCredentials, token: str, payload: dict) -> dict:
    headers = {
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "Gstin": creds.gstin,
        "user_name": creds.username,
        "AuthToken": token,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(creds.generate_url, headers=headers, json=payload)
    body = {}
    try:
        body = response.json()
    except Exception:
        body = {}
    if response.status_code >= 400:
        raise ValueError(_irp_error_message(body, f"e-invoice generate failed ({response.status_code})"))
    data = body.get("Data") if isinstance(body.get("Data"), dict) else body
    irn = (data or {}).get("Irn") or (data or {}).get("irn") or body.get("Irn")
    if not irn:
        raise ValueError(_irp_error_message(body, "e-invoice generate did not return an IRN"))
    return {
        "irn": str(irn),
        "ack_no": str((data or {}).get("AckNo") or (data or {}).get("ack_no") or ""),
        "ack_dt": str((data or {}).get("AckDt") or (data or {}).get("ack_dt") or ""),
        "signed_qr": str((data or {}).get("SignedQRCode") or (data or {}).get("signed_qr") or ""),
    }


def _store_result(invoice, **fields) -> None:
    blob = _einvoice_blob(invoice)
    blob.update(fields)
    blob["updated_at"] = datetime.now(timezone.utc).isoformat()
    invoice.einvoice = blob


async def generate_einvoice(invoice, vendor, force: bool = False) -> dict:
    """Submit ``invoice`` to the IRP / GSP and persist the IRN on the same row.

    Never raises to the caller: errors become ``einvoice.status = failed``.
    """
    if not force and not auto_generate_einvoice(getattr(vendor, "settings", None)):
        return _einvoice_blob(invoice)

    reason = eligibility_error(invoice)
    if reason:
        if reason.startswith("An IRN already exists"):
            return _einvoice_blob(invoice)
        _store_result(invoice, status=STATUS_FAILED, error=reason)
        return invoice.einvoice

    creds = resolve_credentials(vendor, getattr(vendor, "settings", None))
    if not creds:
        _store_result(
            invoice,
            status=STATUS_FAILED,
            error="e-invoice API credentials are not configured (client_id, client_secret, username, password)",
        )
        return invoice.einvoice

    try:
        payload = build_irp_payload(invoice)
        token = await _authenticate(creds)
        result = await _submit_invoice(creds, token, payload)
        _store_result(
            invoice,
            status=STATUS_GENERATED,
            error=None,
            **result,
        )
    except Exception as exc:
        log.warning("e-invoice generate failed for invoice %s: %s", getattr(invoice, "id", None), exc)
        _store_result(invoice, status=STATUS_FAILED, error=str(exc)[:500])
    return invoice.einvoice


async def maybe_generate_einvoice(db, invoice, vendor=None) -> None:
    """Best-effort hook used after invoice creation. Never raises."""
    try:
        if vendor is None:
            from app.models.vendor import Vendor
            vendor = await db.get(Vendor, invoice.vendor_id)
        if vendor is None:
            return
        if getattr(invoice, "invoice_type", None) != "invoice":
            return
        if not auto_generate_einvoice(getattr(vendor, "settings", None)):
            return
        await generate_einvoice(invoice, vendor, force=False)
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(invoice, "einvoice")
        await db.flush()
    except Exception:
        log.exception("e-invoice auto-generate failed for invoice %s", getattr(invoice, "id", None))
