"""Pharma CoA / BPR PDF generators (ReportLab with plain-PDF fallback)."""
from __future__ import annotations

import io
import logging
from datetime import datetime
from typing import Any, Optional

log = logging.getLogger(__name__)


def _s(value: Any, default: str = "—") -> str:
    if value is None or value == "":
        return default
    return str(value)


def _fmt_date(value: Any) -> str:
    if not value:
        return "—"
    if isinstance(value, datetime):
        return value.strftime("%d %b %Y %H:%M")
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).strftime("%d %b %Y %H:%M")
    except Exception:  # noqa: BLE001
        return str(value)[:32]


def generate_coa_pdf(
    *,
    coa_number: str,
    product_name: str,
    batch_number: str,
    manufacturing_date: Any = None,
    expiry_date: Any = None,
    released_at: Any = None,
    origin: str = "",
    results: Optional[list] = None,
    decision_notes: str = "",
    signatures: Optional[list] = None,
) -> bytes:
    payload = {
        "coa_number": coa_number,
        "product_name": product_name,
        "batch_number": batch_number,
        "manufacturing_date": manufacturing_date,
        "expiry_date": expiry_date,
        "released_at": released_at,
        "origin": origin,
        "results": results or [],
        "decision_notes": decision_notes,
        "signatures": signatures or [],
    }
    try:
        return _coa_reportlab(payload)
    except Exception as exc:  # noqa: BLE001
        log.warning("CoA ReportLab failed (%s); using plain PDF", exc)
        return _plain_pdf(
            title=f"Certificate of Analysis {coa_number}",
            lines=[
                f"Product: {product_name}",
                f"Batch: {batch_number}",
                f"Mfg: {_s(manufacturing_date)}  Expiry: {_s(expiry_date)}",
                f"Released: {_fmt_date(released_at)}  Origin: {_s(origin)}",
                f"Notes: {_s(decision_notes)}",
                "",
                "Results:",
                *[
                    f"  - {_s(r.get('name'))}: {_s(r.get('value'))} "
                    f"{_s(r.get('uom'), '')} "
                    f"{'PASS' if r.get('pass') else 'FAIL'}"
                    for r in (results or [])
                    if isinstance(r, dict)
                ],
            ],
        )


def generate_epcis_movements_pdf(
    *,
    exported_at: str,
    events: Optional[list] = None,
) -> bytes:
    """Human-readable movement timeline PDF (not an EPCIS exchange document)."""
    rows = [e for e in (events or []) if isinstance(e, dict)]
    try:
        return _epcis_movements_reportlab(exported_at=exported_at, events=rows)
    except Exception as exc:  # noqa: BLE001
        log.warning("EPCIS movements ReportLab failed (%s); using plain PDF", exc)
        lines = [
            f"Exported: {_s(exported_at)}",
            f"Events: {len(rows)}",
            "Note: Human report — use JSON/XML for partner EPCIS exchange.",
            "",
        ]
        for e in rows[:80]:
            lines.append(
                f"{_s(e.get('event_time'))} | {_s(e.get('biz_step'))} | "
                f"lot {_s(e.get('lot_number'))} | GTIN {_s(e.get('gtin'))} | "
                f"{_s(e.get('epc_count'))} EPC(s)"
            )
        if len(rows) > 80:
            lines.append(f"…and {len(rows) - 80} more events")
        return _plain_pdf(title="EPCIS Movement Report", lines=lines)


def generate_bpr_pdf(
    *,
    batch_number: str,
    product_name: str,
    status: str,
    planned_qty: Any = None,
    actual_qty: Any = None,
    yield_pct: Any = None,
    clearance_done: bool = False,
    operation_log: Optional[list] = None,
    ipc_results: Optional[list] = None,
    notes: str = "",
    completed_at: Any = None,
    signatures: Optional[list] = None,
) -> bytes:
    payload = {
        "batch_number": batch_number,
        "product_name": product_name,
        "status": status,
        "planned_qty": planned_qty,
        "actual_qty": actual_qty,
        "yield_pct": yield_pct,
        "clearance_done": clearance_done,
        "operation_log": operation_log or [],
        "ipc_results": ipc_results or [],
        "notes": notes,
        "completed_at": completed_at,
        "signatures": signatures or [],
    }
    try:
        return _bpr_reportlab(payload)
    except Exception as exc:  # noqa: BLE001
        log.warning("BPR ReportLab failed (%s); using plain PDF", exc)
        return _plain_pdf(
            title=f"Batch Production Record {batch_number}",
            lines=[
                f"Product: {product_name}",
                f"Status: {status}  Completed: {_fmt_date(completed_at)}",
                f"Planned: {_s(planned_qty)}  Actual: {_s(actual_qty)}  Yield: {_s(yield_pct)}%",
                f"Clearance: {'yes' if clearance_done else 'no'}",
                f"Notes: {_s(notes)}",
                "",
                "Operations:",
                *[
                    f"  - {s.get('seq')} {s.get('name')}: {s.get('status')}"
                    for s in (operation_log or [])
                    if isinstance(s, dict)
                ],
                "",
                "IPC:",
                *[
                    f"  - {r.get('name')}: {r.get('value')} "
                    f"{'PASS' if r.get('pass') is not False else 'FAIL'}"
                    for r in (ipc_results or [])
                    if isinstance(r, dict)
                ],
            ],
        )


def generate_recall_pdf(
    *,
    recall_number: str,
    product_name: str = "",
    batch_number: str = "",
    severity: str = "",
    status: str = "",
    reason: str = "",
    created_at: Any = None,
    closed_at: Any = None,
    affected_summary: Optional[dict] = None,
    actions: Optional[list] = None,
) -> bytes:
    """PDF recall impact report with header, affected summary, and action log."""
    payload = {
        "recall_number": recall_number,
        "product_name": product_name,
        "batch_number": batch_number,
        "severity": severity,
        "status": status,
        "reason": reason,
        "created_at": created_at,
        "closed_at": closed_at,
        "affected_summary": affected_summary or {},
        "actions": actions or [],
    }
    try:
        return _recall_reportlab(payload)
    except Exception as exc:  # noqa: BLE001
        log.warning("Recall ReportLab failed (%s); using plain PDF", exc)
        lines = [
            f"Recall Number: {recall_number}",
            f"Batch: {batch_number}  Product: {product_name}",
            f"Severity: {severity}  Status: {status}",
            f"Reason: {_s(reason)}",
            f"Initiated: {_fmt_date(created_at)}  Closed: {_fmt_date(closed_at)}",
            "",
            "Affected Summary:",
            *[f"  {k}: {v}" for k, v in (affected_summary or {}).items()],
            "",
            "Actions:",
            *[
                f"  {_s(a.get('at'))}: {_s(a.get('action'))} — {_s(a.get('notes'))}"
                for a in (actions or [])
                if isinstance(a, dict)
            ],
        ]
        return _plain_pdf(title=f"Recall Report {recall_number}", lines=lines)


def _coa_reportlab(p: dict) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=16 * mm, bottomMargin=16 * mm)
    styles = getSampleStyleSheet()
    story = [
        Paragraph("Certificate of Analysis", styles["Title"]),
        Paragraph(_s(p["coa_number"]), styles["Normal"]),
        Spacer(1, 8),
    ]
    meta = [
        ["Product", _s(p["product_name"]), "Batch", _s(p["batch_number"])],
        ["Manufactured", _s(p["manufacturing_date"]), "Expiry", _s(p["expiry_date"])],
        ["Released", _fmt_date(p["released_at"]), "Origin", _s(p["origin"])],
    ]
    t = Table(meta, colWidths=[28 * mm, 55 * mm, 28 * mm, 55 * mm])
    t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, 0), (0, -1), colors.Color(0.94, 0.94, 0.94)),
        ("BACKGROUND", (2, 0), (2, -1), colors.Color(0.94, 0.94, 0.94)),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(t)
    story.append(Spacer(1, 12))
    rows = [["Test", "Result", "UOM", "Disposition"]]
    for r in p["results"]:
        if not isinstance(r, dict):
            continue
        rows.append([
            _s(r.get("name")),
            _s(r.get("value")),
            _s(r.get("uom"), ""),
            "Pass" if r.get("pass") else "Fail",
        ])
    if len(rows) == 1:
        rows.append(["No results recorded", "", "", ""])
    rt = Table(rows, colWidths=[55 * mm, 45 * mm, 25 * mm, 35 * mm])
    rt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.9, 0.9, 0.9)),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
    ]))
    story.append(rt)
    story.append(Spacer(1, 10))
    story.append(Paragraph(f"<b>Decision notes:</b> {_s(p['decision_notes'])}", styles["Normal"]))
    if p["signatures"]:
        story.append(Spacer(1, 8))
        story.append(Paragraph("<b>Electronic signatures</b>", styles["Normal"]))
        for s in p["signatures"]:
            if isinstance(s, dict):
                story.append(Paragraph(
                    f"{_s(s.get('meaning'))}: {_s(s.get('by_name'))} @ {_fmt_date(s.get('at'))}",
                    styles["Normal"],
                ))
    doc.build(story)
    return buf.getvalue()


def _epcis_movements_reportlab(*, exported_at: str, events: list[dict]) -> bytes:
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        leftMargin=10 * mm,
        rightMargin=10 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
    )
    styles = getSampleStyleSheet()
    story = [
        Paragraph("EPCIS Movement Report", styles["Title"]),
        Paragraph(
            f"Exported {_s(exported_at)} · {len(events)} event(s) · "
            "Human-readable summary (not a GS1 EPCIS exchange file)",
            styles["Normal"],
        ),
        Spacer(1, 8),
    ]
    table_rows = [["Time (UTC)", "Step", "Disposition", "GTIN", "Lot", "EPCs", "Location"]]
    for e in events[:200]:
        table_rows.append([
            _s(e.get("event_time"))[:22],
            _s(e.get("biz_step")),
            _s(e.get("disposition")),
            _s(e.get("gtin")),
            _s(e.get("lot_number")),
            _s(e.get("epc_count")),
            (_s(e.get("biz_location"), ""))[:28] or "—",
        ])
    if len(table_rows) == 1:
        table_rows.append(["—", "No events", "—", "—", "—", "—", "—"])
    t = Table(
        table_rows,
        colWidths=[38 * mm, 28 * mm, 28 * mm, 32 * mm, 28 * mm, 18 * mm, 50 * mm],
        repeatRows=1,
    )
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.9, 0.9, 0.9)),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(t)
    if len(events) > 200:
        story.append(Spacer(1, 6))
        story.append(Paragraph(
            f"Showing first 200 of {len(events)} events. Export CSV/Excel for the full list.",
            styles["Normal"],
        ))
    doc.build(story)
    return buf.getvalue()


def _bpr_reportlab(p: dict) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=16 * mm, bottomMargin=16 * mm)
    styles = getSampleStyleSheet()
    story = [
        Paragraph("Batch Production Record", styles["Title"]),
        Paragraph(_s(p["batch_number"]), styles["Normal"]),
        Spacer(1, 8),
        Paragraph(
            f"Product: {_s(p['product_name'])} · Status: {_s(p['status'])} · "
            f"Completed: {_fmt_date(p['completed_at'])}",
            styles["Normal"],
        ),
        Paragraph(
            f"Planned {_s(p['planned_qty'])} · Actual {_s(p['actual_qty'])} · "
            f"Yield {_s(p['yield_pct'])}% · Clearance: "
            f"{'yes' if p['clearance_done'] else 'no'}",
            styles["Normal"],
        ),
        Spacer(1, 10),
        Paragraph("<b>Operations</b>", styles["Normal"]),
    ]
    op_rows = [["Seq", "Name", "Status"]]
    for s in p["operation_log"]:
        if isinstance(s, dict):
            op_rows.append([_s(s.get("seq")), _s(s.get("name")), _s(s.get("status"))])
    if len(op_rows) == 1:
        op_rows.append(["—", "No steps", "—"])
    ot = Table(op_rows, colWidths=[25 * mm, 100 * mm, 40 * mm])
    ot.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.9, 0.9, 0.9)),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
    ]))
    story.append(ot)
    story.append(Spacer(1, 10))
    story.append(Paragraph("<b>IPC</b>", styles["Normal"]))
    ipc_rows = [["Check", "Value", "Result"]]
    for r in p["ipc_results"]:
        if isinstance(r, dict):
            ipc_rows.append([
                _s(r.get("name")),
                _s(r.get("value"), ""),
                "Pass" if r.get("pass") is not False else "Fail",
            ])
    if len(ipc_rows) == 1:
        ipc_rows.append(["—", "", "—"])
    it = Table(ipc_rows, colWidths=[70 * mm, 55 * mm, 40 * mm])
    it.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.9, 0.9, 0.9)),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
    ]))
    story.append(it)
    if p.get("notes"):
        story.append(Spacer(1, 8))
        story.append(Paragraph(f"<b>Notes:</b> {_s(p['notes'])}", styles["Normal"]))
    if p["signatures"]:
        story.append(Spacer(1, 8))
        story.append(Paragraph("<b>Electronic signatures</b>", styles["Normal"]))
        for s in p["signatures"]:
            if isinstance(s, dict):
                story.append(Paragraph(
                    f"{_s(s.get('meaning'))}: {_s(s.get('by_name'))} @ {_fmt_date(s.get('at'))}",
                    styles["Normal"],
                ))
    doc.build(story)
    return buf.getvalue()


def _recall_reportlab(p: dict) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=16 * mm, bottomMargin=16 * mm)
    styles = getSampleStyleSheet()
    story = [
        Paragraph("Recall Impact Report", styles["Title"]),
        Paragraph(_s(p["recall_number"]), styles["Normal"]),
        Spacer(1, 8),
    ]
    meta = [
        ["Recall #", _s(p["recall_number"]), "Severity", _s(p["severity"])],
        ["Batch", _s(p["batch_number"]), "Status", _s(p["status"])],
        ["Product", _s(p["product_name"]), "Initiated", _fmt_date(p["created_at"])],
        ["Reason", _s(p["reason"]), "Closed", _fmt_date(p["closed_at"])],
    ]
    mt = Table(meta, colWidths=[28 * mm, 60 * mm, 28 * mm, 50 * mm])
    mt.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, 0), (0, -1), colors.Color(0.94, 0.94, 0.94)),
        ("BACKGROUND", (2, 0), (2, -1), colors.Color(0.94, 0.94, 0.94)),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("SPAN", (1, 3), (3, 3)),
    ]))
    story.append(mt)

    summary = p.get("affected_summary") or {}
    if summary:
        story.append(Spacer(1, 10))
        story.append(Paragraph("<b>Affected Summary</b>", styles["Normal"]))
        sum_rows = [["Key", "Value"]] + [[_s(k), _s(v)] for k, v in summary.items()]
        st = Table(sum_rows, colWidths=[60 * mm, 110 * mm])
        st.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.9, 0.9, 0.9)),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ]))
        story.append(st)

    actions = [a for a in (p.get("actions") or []) if isinstance(a, dict)]
    story.append(Spacer(1, 10))
    story.append(Paragraph("<b>Action Log</b>", styles["Normal"]))
    act_rows = [["Timestamp", "Actor", "Action", "Notes"]]
    for a in actions:
        act_rows.append([
            _s(a.get("at"))[:19],
            _s(a.get("by"), ""),
            _s(a.get("action")),
            _s(a.get("notes"), ""),
        ])
    if len(act_rows) == 1:
        act_rows.append(["—", "", "No actions recorded", ""])
    at = Table(act_rows, colWidths=[38 * mm, 30 * mm, 40 * mm, 58 * mm], repeatRows=1)
    at.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.9, 0.9, 0.9)),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(at)
    doc.build(story)
    return buf.getvalue()


def _plain_pdf(*, title: str, lines: list[str]) -> bytes:
    """Minimal valid PDF with no external deps."""
    content_lines = [title, ""] + lines
    # Escape PDF string specials
    text = "\\n".join(
        str(line).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        for line in content_lines
    )
    stream = f"BT /F1 10 Tf 50 780 Td ({text[:3500]}) Tj ET"
    objects = [
        "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n",
        "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n",
        "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        "/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n",
        f"4 0 obj<< /Length {len(stream)} >>stream\n{stream}\nendstream\nendobj\n",
        "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(len(out))
        out.extend(obj.encode("latin-1", errors="replace"))
    xref_pos = len(out)
    out.extend(f"xref\n0 {len(offsets)}\n".encode())
    out.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        out.extend(f"{off:010d} 00000 n \n".encode())
    out.extend(
        f"trailer<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode()
    )
    return bytes(out)
