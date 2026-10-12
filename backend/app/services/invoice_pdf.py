"""Build an invoice / quotation PDF that follows the vendor's saved template settings.

Loads the settings and the images (async, from storage), then hands everything to the pure,
synchronous renderer in ``app.utils.pdf_generator`` on a worker thread so a large document never
blocks the event loop.
"""
from __future__ import annotations

from typing import Dict

from starlette.concurrency import run_in_threadpool

from app.models.vendor import Vendor
from app.services.document_assets import load_document_image
from app.utils.document_settings import sanitize_document_settings
from app.utils.pdf_generator import generate_invoice_pdf, is_pos_invoice, resolve_pdf_settings


async def render_invoice_pdf(db, invoice) -> bytes:
    vendor = await db.get(Vendor, invoice.vendor_id)
    stored = (vendor.settings or {}) if vendor else {}

    is_quote = str(invoice.invoice_type or "").lower() == "estimate"
    # Same selection the vendor app uses: quotations have their own template; POS receipts layer
    # the shared POS overrides on top of the invoice template.
    # strict=False re-cleans data saved before validation existed instead of rejecting it.
    base = sanitize_document_settings(stored.get("quotation_settings" if is_quote else "invoice_settings", {}), strict=False)
    pos = sanitize_document_settings(stored.get("pos_receipt_settings", {}), strict=False) if is_pos_invoice(invoice) else None
    settings = resolve_pdf_settings(base, pos, is_quotation=is_quote)

    images: Dict[str, bytes] = {}
    company_logo = vendor.logo_url if vendor else None

    # Only images the settings turn on are read. ``logo_url == ""`` means "no logo" (don't fall
    # back to the company logo); unset means "use the company logo".
    if settings.get("show_logo", True) is not False and settings.get("logo_url") != "":
        body = await load_document_image(settings.get("logo_url"))
        if body is None and not settings.get("logo_url"):
            body = await load_document_image(company_logo, allow_company_logo=True)
        if body:
            images["logo"] = body
    if settings.get("show_signature", True) is not False:
        body = await load_document_image(settings.get("signature_url"))
        if body:
            images["signature"] = body
    if settings.get("show_qr_code") is True:
        body = await load_document_image(settings.get("qr_code_url"))
        if body:
            images["qr"] = body

    vendor_info = {
        "business_name": vendor.business_name if vendor else "",
        "phone": (vendor.support_phone or vendor.primary_phone) if vendor else "",
    }
    return await run_in_threadpool(generate_invoice_pdf, invoice, settings, images, vendor_info)
