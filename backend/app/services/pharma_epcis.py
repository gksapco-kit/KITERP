"""Stage C track & trace — EPCIS event store, export, DSCSA verify stub."""
from __future__ import annotations

import csv
import io
import zipfile
import xml.etree.ElementTree as ET
from datetime import date, datetime, timezone
from typing import Any, Literal, Optional, Sequence
from uuid import UUID
from xml.dom import minidom

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pharma import PharmaEpcisEvent, PharmaTradingPartner, PharmaSerialUnit
from app.models.procurement_goods import GoodsBatch
from app.models.vendor_product import Product
from app.services.pharma_batch import append_pharma_audit

ExportFormat = Literal["json", "xml", "lite", "csv", "xlsx", "pdf"]

# Human-readable report columns (CSV / Excel / PDF)
_REPORT_HEADERS = (
    "event_time",
    "event_type",
    "action",
    "biz_step",
    "disposition",
    "gtin",
    "lot_number",
    "epc_count",
    "epcs",
    "parent_epc",
    "child_epcs",
    "biz_location",
    "read_point",
    "event_id",
)

# GS1 CBV vocabulary (partner-facing exports)
_BIZ_STEP_CBV: dict[str, str] = {
    "commissioning": "urn:epcglobal:cbv:bizstep:commissioning",
    "packing": "urn:epcglobal:cbv:bizstep:packing",
    "shipping": "urn:epcglobal:cbv:bizstep:shipping",
    "receiving": "urn:epcglobal:cbv:bizstep:receiving",
    "recalling": "urn:epcglobal:cbv:bizstep:recalling",
    "destroying": "urn:epcglobal:cbv:bizstep:destroying",
}

_DISPOSITION_CBV: dict[str, str] = {
    "active": "urn:epcglobal:cbv:disp:active",
    "in_progress": "urn:epcglobal:cbv:disp:in_progress",
    "in_transit": "urn:epcglobal:cbv:disp:in_transit",
    "destroyed": "urn:epcglobal:cbv:disp:destroyed",
    "recalled": "urn:epcglobal:cbv:disp:recalled",
    "expired": "urn:epcglobal:cbv:disp:expired",
    "reserved": "urn:epcglobal:cbv:disp:reserved",
}


def _iso_z(dt: Optional[datetime]) -> Optional[str]:
    """UTC ISO-8601 with trailing Z (partner / GS1-friendly)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _sgtin_split(gtin14: str, company_prefix: str) -> tuple[str, str]:
    """
    Split a GTIN-14 into (company_prefix, item_reference) for proper SGTIN URN.

    GTIN-14 layout: I  CCCCCCCC  IIIII  K
      I = indicator (1 digit)
      C = company prefix (variable, GS1 assigned, here cp_len digits)
      I = item reference (fill remainder excluding check digit)
      K = check digit (1 digit)

    We strip the leading indicator and trailing check digit, then split by
    company_prefix length to produce item_reference.  If the prefix doesn't
    match or GTIN is malformed, we return a safe fallback.
    """
    g = gtin14.strip().lstrip("0") if False else gtin14.strip()
    cp = (company_prefix or "").strip()
    # GTIN-14 must be exactly 14 digits
    if len(g) == 14 and g.isdigit() and cp and g[1:1+len(cp)] == cp:
        item_ref = g[1+len(cp):-1]  # strip indicator + check digit
        return cp, item_ref
    # Fallback: treat entire GTIN (minus check digit) as prefix
    if len(g) == 14 and g.isdigit():
        return g[:-1], "0"
    return "0", g


def _epc_urn(serial: str, gtin: Optional[str] = None, company_prefix: Optional[str] = None) -> str:
    sn = (serial or "").strip()
    g = (gtin or "").strip()
    cp = (company_prefix or "").strip()
    if g and cp:
        pfx, item_ref = _sgtin_split(g, cp)
        return f"urn:epc:id:sgtin:{pfx}.{item_ref}.{sn}"
    if g:
        # Lite SGTIN: keep full GTIN + serial (no company-prefix available)
        return f"urn:epc:id:sgtin:{g}.{sn}"
    return f"urn:epc:id:sgtin:0.0.{sn}"


def _reencode_epc(epc: str, gtin: Optional[str], company_prefix: Optional[str]) -> str:
    """
    Re-encode a lite SGTIN (`urn:epc:id:sgtin:{gtin14}.{sn}`) to a proper SGTIN
    (`urn:epc:id:sgtin:{cp}.{item_ref}.{sn}`) when company_prefix is available.
    If already in proper format (≥3 segments after 'sgtin:') or no prefix, returns unchanged.
    """
    if not company_prefix:
        return epc
    prefix = "urn:epc:id:sgtin:"
    if not epc.startswith(prefix):
        return epc
    rest = epc[len(prefix):]
    parts = rest.split(".")
    # Already proper SGTIN: sgtin:cp.item.serial (3+ parts)
    if len(parts) >= 3:
        return epc
    # Lite format: sgtin:gtin14.serial
    if len(parts) == 2:
        g14, sn = parts
        cp_val, item_ref = _sgtin_split(g14, company_prefix)
        return f"{prefix}{cp_val}.{item_ref}.{sn}"
    return epc


def _cbv_biz_step(step: Optional[str]) -> Optional[str]:
    if not step:
        return None
    if step.startswith("urn:"):
        return step
    return _BIZ_STEP_CBV.get(step, f"urn:epcglobal:cbv:bizstep:{step}")


def _cbv_disposition(disp: Optional[str]) -> Optional[str]:
    if not disp:
        return None
    if disp.startswith("urn:"):
        return disp
    return _DISPOSITION_CBV.get(disp, f"urn:epcglobal:cbv:disp:{disp}")


def _event_dict(e: PharmaEpcisEvent) -> dict[str, Any]:
    return {
        "id": str(e.id),
        "event_type": e.event_type,
        "action": e.action,
        "biz_step": e.biz_step,
        "disposition": e.disposition,
        "event_time": _iso_z(e.event_time),
        "epc_list": e.epc_list or [],
        "parent_epc": e.parent_epc,
        "child_epcs": e.child_epcs or [],
        "biz_location": e.biz_location,
        "read_point": e.read_point,
        "goods_batch_id": str(e.goods_batch_id) if e.goods_batch_id else None,
        "product_id": str(e.product_id) if e.product_id else None,
        "gtin": e.gtin,
        "lot_number": e.lot_number,
        "source_type": e.source_type,
        "source_id": str(e.source_id) if e.source_id else None,
        "partner_id": str(e.partner_id) if e.partner_id else None,
        "meta": e.meta or {},
        "created_at": _iso_z(e.created_at),
    }


def _partner_event_json(
    e: PharmaEpcisEvent,
    company_prefix: Optional[str] = None,
) -> dict[str, Any]:
    """GS1 EPCIS 2.0–inspired JSON event (camelCase + CBV URNs).
    When company_prefix is set, lite SGTIN URNs are re-encoded to proper SGTIN."""
    etype = e.event_type or "ObjectEvent"
    event: dict[str, Any] = {
        "type": etype,
        "eventID": f"urn:uuid:{e.id}",
        "eventTime": _iso_z(e.event_time),
        "eventTimeZoneOffset": "+00:00",
        "action": (e.action or "OBSERVE").upper(),
    }
    biz = _cbv_biz_step(e.biz_step)
    if biz:
        event["bizStep"] = biz
    disp = _cbv_disposition(e.disposition)
    if disp:
        event["disposition"] = disp
    if e.read_point:
        event["readPoint"] = {"id": e.read_point}
    if e.biz_location:
        event["bizLocation"] = {"id": e.biz_location}

    def _reenc(epc: str) -> str:
        return _reencode_epc(epc, e.gtin, company_prefix)

    if etype == "AggregationEvent":
        if e.parent_epc:
            event["parentID"] = _reenc(e.parent_epc)
        event["childEPCs"] = [_reenc(x) for x in (e.child_epcs or e.epc_list or [])]
    else:
        event["epcList"] = [_reenc(x) for x in (e.epc_list or [])]

    ilmd: dict[str, Any] = {}
    if e.lot_number:
        ilmd["lotNumber"] = e.lot_number
    if e.gtin:
        ilmd["gtin"] = e.gtin
    if ilmd:
        event["ilmd"] = ilmd

    # Non-standard extensions kept under a clear namespace for partner tooling
    event["kiterp:extensions"] = {
        "goodsBatchId": str(e.goods_batch_id) if e.goods_batch_id else None,
        "productId": str(e.product_id) if e.product_id else None,
        "partnerId": str(e.partner_id) if e.partner_id else None,
        "sourceType": e.source_type,
        "sourceId": str(e.source_id) if e.source_id else None,
    }
    return event


def _build_partner_json_document(
    rows: list[PharmaEpcisEvent],
    company_prefix: Optional[str] = None,
) -> dict[str, Any]:
    created = _iso_z(datetime.now(timezone.utc))
    return {
        "@context": ["https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld"],
        "type": "EPCISDocument",
        "schemaVersion": "2.0",
        "creationDate": created,
        "epcisBody": {
            "eventList": [_partner_event_json(r, company_prefix) for r in rows],
        },
        "meta": {
            "format": "epcis-2.0-json-lite",
            "sgtin_encoding": "proper" if company_prefix else "lite",
            "gs1_company_prefix": company_prefix or None,
            "count": len(rows),
            "exported_at": created,
            "note": (
                "GS1 EPCIS 2.0–inspired JSON for trading-partner exchange. "
                "Not a certified GS1 network payload."
            ),
        },
    }


def _xml_text(parent: ET.Element, tag: str, text: Optional[str]) -> None:
    if text is None or text == "":
        return
    el = ET.SubElement(parent, tag)
    el.text = str(text)


def _build_partner_xml_document(rows: list[PharmaEpcisEvent]) -> str:
    """EPCIS 1.2–inspired XML document for partners that expect XML."""
    created = _iso_z(datetime.now(timezone.utc)) or ""
    root = ET.Element(
        "epcis:EPCISDocument",
        {
            "xmlns:epcis": "urn:epcglobal:epcis:xsd:1",
            "xmlns:cbv": "urn:epcglobal:cbv:mda",
            "schemaVersion": "1.2",
            "creationDate": created,
        },
    )
    body = ET.SubElement(root, "EPCISBody")
    event_list = ET.SubElement(body, "EventList")

    for e in rows:
        etype = e.event_type or "ObjectEvent"
        tag = "AggregationEvent" if etype == "AggregationEvent" else "ObjectEvent"
        ev = ET.SubElement(event_list, tag)
        _xml_text(ev, "eventTime", _iso_z(e.event_time))
        _xml_text(ev, "eventTimeZoneOffset", "+00:00")
        _xml_text(ev, "eventID", f"urn:uuid:{e.id}")

        if tag == "AggregationEvent":
            _xml_text(ev, "parentID", e.parent_epc)
            children = ET.SubElement(ev, "childEPCs")
            for epc in e.child_epcs or e.epc_list or []:
                _xml_text(children, "epc", epc)
        else:
            epcs = ET.SubElement(ev, "epcList")
            for epc in e.epc_list or []:
                _xml_text(epcs, "epc", epc)

        _xml_text(ev, "action", (e.action or "OBSERVE").upper())
        _xml_text(ev, "bizStep", _cbv_biz_step(e.biz_step))
        _xml_text(ev, "disposition", _cbv_disposition(e.disposition))
        if e.read_point:
            rp = ET.SubElement(ev, "readPoint")
            _xml_text(rp, "id", e.read_point)
        if e.biz_location:
            bl = ET.SubElement(ev, "bizLocation")
            _xml_text(bl, "id", e.biz_location)
        if e.lot_number or e.gtin:
            ilmd = ET.SubElement(ev, "ilmd")
            _xml_text(ilmd, "cbv:lotNumber", e.lot_number)
            _xml_text(ilmd, "cbv:gtin", e.gtin)

    rough = ET.tostring(root, encoding="utf-8")
    parsed = minidom.parseString(rough)
    # strip XML declaration from toprettyxml then add our own once
    pretty = parsed.toprettyxml(indent="  ", encoding="utf-8").decode("utf-8")
    # minidom adds its own declaration; normalize blank lines
    lines = [ln for ln in pretty.splitlines() if ln.strip()]
    return "\n".join(lines) + "\n"


def _flatten_epcs(values: Optional[Sequence[str]], *, max_items: int = 40) -> str:
    items = [str(v) for v in (values or []) if v]
    if not items:
        return ""
    if len(items) > max_items:
        return "; ".join(items[:max_items]) + f"; …(+{len(items) - max_items} more)"
    return "; ".join(items)


def _event_report_row(e: PharmaEpcisEvent) -> dict[str, str]:
    epcs = list(e.epc_list or [])
    children = list(e.child_epcs or [])
    return {
        "event_time": _iso_z(e.event_time) or "",
        "event_type": e.event_type or "",
        "action": (e.action or "").upper(),
        "biz_step": e.biz_step or "",
        "disposition": e.disposition or "",
        "gtin": e.gtin or "",
        "lot_number": e.lot_number or "",
        "epc_count": str(len(epcs) or len(children)),
        "epcs": _flatten_epcs(epcs),
        "parent_epc": e.parent_epc or "",
        "child_epcs": _flatten_epcs(children),
        "biz_location": e.biz_location or "",
        "read_point": e.read_point or "",
        "event_id": str(e.id),
    }


def _build_partner_csv_document(rows: list[PharmaEpcisEvent]) -> str:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=list(_REPORT_HEADERS), extrasaction="ignore")
    writer.writeheader()
    for e in rows:
        writer.writerow(_event_report_row(e))
    return buf.getvalue()


def _xlsx_escape(value: str) -> str:
    return (
        (value or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _build_partner_xlsx_document(rows: list[PharmaEpcisEvent]) -> bytes:
    """Minimal Office Open XML workbook (no openpyxl dependency)."""
    sheet_rows = [
        "<row>"
        + "".join(f'<c t="inlineStr"><is><t>{_xlsx_escape(h)}</t></is></c>' for h in _REPORT_HEADERS)
        + "</row>"
    ]
    for e in rows:
        data = _event_report_row(e)
        cells = "".join(
            f'<c t="inlineStr"><is><t>{_xlsx_escape(data[h])}</t></is></c>' for h in _REPORT_HEADERS
        )
        sheet_rows.append(f"<row>{cells}</row>")

    sheet_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f"<sheetData>{''.join(sheet_rows)}</sheetData>"
        "</worksheet>"
    )
    workbook_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets><sheet name="Movements" sheetId="1" r:id="rId1"/></sheets>'
        "</workbook>"
    )
    root_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="xl/workbook.xml"/>'
        "</Relationships>"
    )
    wb_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
        'Target="worksheets/sheet1.xml"/>'
        "</Relationships>"
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        "</Types>"
    )

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", root_rels)
        zf.writestr("xl/workbook.xml", workbook_xml)
        zf.writestr("xl/_rels/workbook.xml.rels", wb_rels)
        zf.writestr("xl/worksheets/sheet1.xml", sheet_xml)
    return buf.getvalue()


def _build_partner_pdf_document(rows: list[PharmaEpcisEvent]) -> bytes:
    from app.utils.pharma_pdf import generate_epcis_movements_pdf

    return generate_epcis_movements_pdf(
        exported_at=_iso_z(datetime.now(timezone.utc)) or "",
        events=[_event_report_row(e) for e in rows],
    )


def _partner_dict(p: PharmaTradingPartner) -> dict[str, Any]:
    return {
        "id": str(p.id),
        "name": p.name,
        "partner_type": p.partner_type,
        "gln": p.gln,
        "license_number": p.license_number,
        "license_expires": p.license_expires.isoformat() if p.license_expires else None,
        "verification_endpoint": p.verification_endpoint,
        "is_active": p.is_active,
        "meta": p.meta or {},
        "created_at": _iso_z(p.created_at),
    }


async def record_epcis_event(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    biz_step: str,
    epc_list: list[str],
    event_type: str = "ObjectEvent",
    action: str = "ADD",
    disposition: Optional[str] = None,
    parent_epc: Optional[str] = None,
    child_epcs: Optional[list[str]] = None,
    goods_batch_id: Optional[UUID] = None,
    product_id: Optional[UUID] = None,
    gtin: Optional[str] = None,
    lot_number: Optional[str] = None,
    biz_location: Optional[str] = None,
    read_point: Optional[str] = None,
    source_type: Optional[str] = None,
    source_id: Optional[UUID] = None,
    partner_id: Optional[UUID] = None,
    meta: Optional[dict] = None,
    actor_id: Optional[UUID] = None,
    event_time: Optional[datetime] = None,
) -> PharmaEpcisEvent:
    if not epc_list and not child_epcs:
        raise HTTPException(400, "epc_list or child_epcs required")
    e = PharmaEpcisEvent(
        vendor_id=vendor_id,
        event_type=event_type,
        action=action,
        biz_step=biz_step,
        disposition=disposition,
        event_time=event_time or datetime.now(timezone.utc),
        epc_list=list(epc_list or []),
        parent_epc=parent_epc,
        child_epcs=list(child_epcs or []),
        biz_location=biz_location,
        read_point=read_point,
        goods_batch_id=goods_batch_id,
        product_id=product_id,
        gtin=gtin,
        lot_number=lot_number,
        source_type=source_type,
        source_id=source_id,
        partner_id=partner_id,
        meta=meta or {},
    )
    db.add(e)
    await db.flush()
    await append_pharma_audit(
        db,
        vendor_id=vendor_id,
        entity_type="pharma_epcis_event",
        entity_id=e.id,
        action=f"epcis_{biz_step}",
        actor_id=actor_id,
        new_value={"biz_step": biz_step, "epc_count": len(e.epc_list or [])},
    )
    return e


async def record_serial_lifecycle_event(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    serials: list[PharmaSerialUnit],
    biz_step: str,
    disposition: Optional[str] = None,
    event_type: str = "ObjectEvent",
    parent: Optional[PharmaSerialUnit] = None,
    actor_id: Optional[UUID] = None,
    source_type: Optional[str] = None,
    source_id: Optional[UUID] = None,
    gs1_company_prefix: Optional[str] = None,
) -> Optional[PharmaEpcisEvent]:
    if not serials:
        return None
    batch_id = serials[0].goods_batch_id
    batch = await db.get(GoodsBatch, batch_id) if batch_id else None
    product = await db.get(Product, batch.product_id) if batch else None
    gtin = getattr(product, "gtin", None) if product else None
    epcs = [_epc_urn(s.serial_number, gtin, gs1_company_prefix) for s in serials]
    parent_epc = _epc_urn(parent.serial_number, gtin, gs1_company_prefix) if parent else None
    child_epcs = epcs if parent else []
    return await record_epcis_event(
        db,
        vendor_id=vendor_id,
        biz_step=biz_step,
        event_type="AggregationEvent" if parent else event_type,
        action="ADD" if biz_step in ("commissioning", "packing", "receiving") else "OBSERVE",
        disposition=disposition,
        epc_list=epcs if not parent else [parent_epc] if parent_epc else [],
        parent_epc=parent_epc,
        child_epcs=child_epcs if parent else [],
        goods_batch_id=batch_id,
        product_id=product.id if product else None,
        gtin=gtin,
        lot_number=batch.batch_number if batch else None,
        source_type=source_type,
        source_id=source_id,
        actor_id=actor_id,
    )


async def export_epcis_document(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    since: Optional[datetime] = None,
    goods_batch_id: Optional[UUID] = None,
    limit: int = 500,
    fmt: ExportFormat = "json",
    gs1_company_prefix: Optional[str] = None,
) -> dict[str, Any] | str | bytes:
    """
    Partner export formats:
      - json: GS1 EPCIS 2.0–inspired JSON (machine exchange)
      - xml:  EPCIS 1.2–inspired XML (machine exchange)
      - csv / xlsx / pdf: human-readable movement reports
      - lite: internal snake_case event dump (legacy)
    When gs1_company_prefix is set, lite SGTINs are re-encoded to proper SGTIN-96 format.
    """
    q = (
        select(PharmaEpcisEvent)
        .where(PharmaEpcisEvent.vendor_id == vendor_id)
        .order_by(PharmaEpcisEvent.event_time.asc())
        .limit(min(limit, 2000))
    )
    if since:
        q = q.where(PharmaEpcisEvent.event_time >= since)
    if goods_batch_id:
        q = q.where(PharmaEpcisEvent.goods_batch_id == goods_batch_id)
    rows = list((await db.execute(q)).scalars().all())

    if fmt == "xml":
        return _build_partner_xml_document(rows)
    if fmt == "csv":
        return _build_partner_csv_document(rows)
    if fmt == "xlsx":
        return _build_partner_xlsx_document(rows)
    if fmt == "pdf":
        return _build_partner_pdf_document(rows)
    if fmt == "lite":
        return {
            "epcisBody": {
                "EventList": [_event_dict(r) for r in rows],
            },
            "meta": {
                "format": "kiterp-epcis-lite-json",
                "count": len(rows),
                "exported_at": _iso_z(datetime.now(timezone.utc)),
                "note": "Internal lite JSON — use format=json or format=xml for partner exchange.",
            },
        }
    return _build_partner_json_document(rows, company_prefix=gs1_company_prefix)


async def _call_vrs(
    endpoint: str,
    api_key: str,
    *,
    gtin: Optional[str],
    serial_number: str,
    lot_number: Optional[str],
    expiry_date: Optional[str],
) -> dict[str, Any]:
    """
    Make a live call to a DSCSA Verification Router Service (VRS).
    Expects a JSON response with at least {verified: bool, reason: str}.
    Returns the parsed response or raises HTTPException on failure.
    """
    import httpx

    payload: dict[str, Any] = {"serialNumber": serial_number}
    if gtin:
        payload["gtin"] = gtin
    if lot_number:
        payload["lotNumber"] = lot_number
    if expiry_date:
        payload["expiryDate"] = expiry_date

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(endpoint, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
    except httpx.TimeoutException:
        raise HTTPException(504, "VRS request timed out")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(502, f"VRS returned {exc.response.status_code}: {exc.response.text[:200]}")
    except Exception as exc:
        raise HTTPException(502, f"VRS call failed: {exc}")

    return {
        "verified": bool(data.get("verified", False)),
        "reason": data.get("reason", "vrs_response"),
        "message": data.get("message", "VRS verification result"),
        "vrs_raw": data,
    }


async def dscsa_verify_stub(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    gtin: Optional[str],
    serial_number: str,
    lot_number: Optional[str] = None,
    expiry_date: Optional[str] = None,
    partner_id: Optional[UUID] = None,
    vrs_endpoint: Optional[str] = None,
    vrs_api_key: Optional[str] = None,
) -> dict[str, Any]:
    """
    Saleable-return / DSCSA verification.
    When vrs_endpoint + vrs_api_key are configured, dispatches to the live VRS
    and also cross-checks against the local registry.  Falls back to local-only
    stub when credentials are absent.
    """
    sn = (serial_number or "").strip()
    if not sn:
        raise HTTPException(400, "serial_number required")

    serial = (
        await db.execute(
            select(PharmaSerialUnit).where(
                PharmaSerialUnit.vendor_id == vendor_id,
                PharmaSerialUnit.serial_number == sn,
            )
        )
    ).scalar_one_or_none()

    partner = None
    if partner_id:
        partner = (
            await db.execute(
                select(PharmaTradingPartner).where(
                    PharmaTradingPartner.id == partner_id,
                    PharmaTradingPartner.vendor_id == vendor_id,
                )
            )
        ).scalar_one_or_none()

    # --- Local verification ---
    local_verified = False
    reason = "serial_not_found"
    if serial:
        if serial.status in ("destroyed",):
            reason = "serial_destroyed"
        elif serial.status == "recalled":
            reason = "serial_recalled"
        else:
            local_verified = True
            reason = "verified_local"
            batch = None
            if gtin or lot_number:
                batch = await db.get(GoodsBatch, serial.goods_batch_id)
            if gtin and batch:
                product = await db.get(Product, batch.product_id) if batch else None
                prod_gtin = getattr(product, "gtin", None) if product else None
                if prod_gtin and prod_gtin != gtin:
                    local_verified = False
                    reason = "gtin_mismatch"
            if lot_number and batch and batch.batch_number != lot_number:
                local_verified = False
                reason = "lot_mismatch"

    partner_call: str = "none"
    vrs_result: Optional[dict[str, Any]] = None

    # --- Live VRS call (when configured) ---
    vrs_ep = (vrs_endpoint or "").strip()
    vrs_key = (vrs_api_key or "").strip()
    if vrs_ep and vrs_key:
        partner_call = "live"
        try:
            vrs_result = await _call_vrs(
                vrs_ep,
                vrs_key,
                gtin=gtin,
                serial_number=sn,
                lot_number=lot_number,
                expiry_date=expiry_date,
            )
            # A serial that passes locally but fails VRS is suspect — VRS wins
            if not vrs_result["verified"]:
                local_verified = False
                reason = vrs_result.get("reason", "vrs_not_verified")
            elif not local_verified and vrs_result["verified"]:
                # VRS says ok but we've never seen this serial — honour VRS, flag it
                reason = "vrs_verified_not_in_registry"
                local_verified = True
        except HTTPException as exc:
            # VRS unreachable — fall back to local but warn
            partner_call = "error"
            vrs_result = {"error": exc.detail}
    else:
        partner_call = "stub"

    result: dict[str, Any] = {
        "verified": local_verified,
        "reason": reason,
        "serial_number": sn,
        "gtin": gtin,
        "lot_number": lot_number,
        "expiry_date": expiry_date,
        "serial_status": serial.status if serial else None,
        "partner": _partner_dict(partner) if partner else None,
        "partner_call": partner_call,
        "message": (
            "Verified against local serial registry"
            if local_verified and partner_call == "stub"
            else "Verified via VRS + local registry"
            if local_verified and partner_call == "live"
            else f"Not verified: {reason}"
        ),
    }
    if vrs_result:
        result["vrs_result"] = vrs_result
    return result


async def _call_nmvs(
    endpoint: str,
    api_key: str,
    *,
    serial_number: str,
    gtin: Optional[str],
    reason: str,
) -> dict[str, Any]:
    """
    Notify an EU FMD NMVS (National Medicines Verification System) of a decommission.
    Expects a JSON response with at least {success: bool}.
    """
    import httpx

    payload: dict[str, Any] = {
        "serialNumber": serial_number,
        "reason": reason,
    }
    if gtin:
        payload["gtin"] = gtin

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(endpoint, json=payload, headers=headers)
            resp.raise_for_status()
            return resp.json()
    except httpx.TimeoutException:
        return {"success": False, "error": "NMVS request timed out"}
    except httpx.HTTPStatusError as exc:
        return {"success": False, "error": f"NMVS returned {exc.response.status_code}: {exc.response.text[:200]}"}
    except Exception as exc:
        return {"success": False, "error": str(exc)}


async def fmd_decommission(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    serial_id: UUID,
    actor_id: Optional[UUID] = None,
    reason: str = "supplied",
    nmvs_endpoint: Optional[str] = None,
    nmvs_api_key: Optional[str] = None,
) -> PharmaEpcisEvent:
    """EU FMD-style decommission.  When nmvs_endpoint + nmvs_api_key are set,
    also notifies the national NMVS system in real-time."""
    from app.services.pharma_serial import transition_serial
    s = await transition_serial(
        db,
        vendor_id=vendor_id,
        serial_id=serial_id,
        new_status="destroyed",
        actor_id=actor_id,
        cascade=True,
        notes=f"FMD decommission: {reason}",
    )
    ev = await record_serial_lifecycle_event(
        db,
        vendor_id=vendor_id,
        serials=[s],
        biz_step="destroying",
        disposition="destroyed",
        actor_id=actor_id,
        source_type="fmd_decommission",
        source_id=s.id,
    )
    assert ev is not None

    nmvs_result: dict[str, Any] = {}
    nmvs_ep = (nmvs_endpoint or "").strip()
    nmvs_key = (nmvs_api_key or "").strip()
    if nmvs_ep and nmvs_key:
        # Build GTIN from linked product if available
        batch = await db.get(GoodsBatch, s.goods_batch_id)
        product = await db.get(Product, batch.product_id) if batch else None
        gtin = getattr(product, "gtin", None) if product else None
        nmvs_result = await _call_nmvs(
            nmvs_ep, nmvs_key,
            serial_number=s.serial_number,
            gtin=gtin,
            reason=reason,
        )

    ev.meta = {
        **(ev.meta or {}),
        "fmd_reason": reason,
        "region": "eu",
        **({"nmvs": nmvs_result} if nmvs_result else {}),
    }
    return ev


async def count_epcis_events(db: AsyncSession, vendor_id: UUID) -> int:
    return int(
        (
            await db.execute(
                select(func.count()).select_from(PharmaEpcisEvent).where(
                    PharmaEpcisEvent.vendor_id == vendor_id,
                )
            )
        ).scalar()
        or 0
    )
