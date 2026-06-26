"""HTML shell strings for offer-letter layout variants (ported from vendor-web offerLayoutShells.ts)."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, TypedDict

ACCENT = "#1a56db"

ALIASES: dict[str, str] = {
    "standard": "classic",
    "two_column": "colorblock",
    "toprightbottomleft": "toprightlogobottomleft",
    "topleftbottomright": "topleftlogobottomright",
    "topbottom": "toprightlogobottomleft",
    "dual": "leftlogo",
}


def normalize_offer_layout_id(layout_id: str) -> str:
    key = (layout_id or "classic").strip().lower()
    return ALIASES.get(key, key)


class PadVals(TypedDict):
    pad_lg: str
    pad_md: str
    pad_sm: str
    sz_lg: int
    sz_md: int
    sz_sm: int


class OfferShellCtx(TypedDict):
    content: str
    vendor: str
    candidate: str
    ref: str
    today: str
    embed: bool
    mark_html: Callable[[int], str]


def _pads(embed: bool) -> PadVals:
    if embed:
        return PadVals(
            pad_lg="24px 32px",
            pad_md="24px 32px",
            pad_sm="24px 32px",
            sz_lg=52,
            sz_md=48,
            sz_sm=40,
        )
    return PadVals(
        pad_lg="48px 56px",
        pad_md="40px 48px",
        pad_sm="32px 56px 48px",
        sz_lg=64,
        sz_md=56,
        sz_sm=48,
    )


def _signature_row() -> str:
    return (
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:36px;padding:0 32px 8px">'
        '<div><div style="border-top:1px solid #374151;margin-top:52px;padding-top:8px;font-size:11px;color:#4b5563">'
        "Company Representative (Sign)</div></div>"
        '<div><div style="border-top:1px solid #374151;margin-top:52px;padding-top:8px;font-size:11px;color:#4b5563">'
        "Candidate (Sign)</div></div>"
        "</div>"
    )


def _mark_at(ctx: OfferShellCtx, size: int) -> str:
    return ctx["mark_html"](size)


def _mark_block(ctx: OfferShellCtx, size: int, wrap_style: str = "") -> str:
    html = _mark_at(ctx, size)
    if not html:
        return ""
    if wrap_style:
        return f'<div style="{wrap_style}">{html}</div>'
    return html


def _ref_line(ref: str) -> str:
    if not ref:
        return ""
    return f'<span style="color:#b91c1c;font-weight:600">Ref: {ref}</span>'


def _ref_div(ref: str, extra: str = "") -> str:
    if not ref:
        return ""
    extra_style = f";{extra}" if extra else ""
    return f'<div style="font-size:11px;color:#9ca3af;margin-top:4px{extra_style}">Ref: {ref}</div>'


def _body_wrap(content: str, pad: str | None = None) -> str:
    outer = f'<div style="padding:{pad}">' if pad else ""
    close = "</div>" if pad else ""
    return f'{outer}<div class="body-content">{content}</div>{close}'


def _footer_mark_row(ctx: OfferShellCtx, size: int, side: str) -> str:
    html = _mark_at(ctx, size)
    if not html:
        return ""
    justify = "flex-start" if side == "left" else "flex-end"
    return (
        f'<div style="padding:12px 32px 20px;display:flex;justify-content:{justify};'
        f'border-top:1px solid #e5e7eb;margin-top:4px">{html}</div>'
    )


def _shell_classic(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["today"], ctx["content"],
    )
    embed = ctx["embed"]
    mark = _mark_block(ctx, p["sz_md"])
    if mark:
        left = (
            f'<div style="display:flex;align-items:center;gap:14px;min-width:0;flex:1">'
            f"<div>{mark}</div>"
            f'<div style="min-width:0">'
            f'<div style="font-size:{"18px" if embed else "22px"};font-weight:700;color:{ACCENT}">{vendor}</div>'
            f'<div style="font-size:11px;color:#6b7280;margin-top:4px">Human Resources</div></div></div>'
        )
    else:
        left = (
            f'<div style="min-width:0;flex:1">'
            f'<div style="font-size:{"18px" if embed else "22px"};font-weight:700;color:{ACCENT}">{vendor}</div>'
            f'<div style="font-size:11px;color:#6b7280;margin-top:4px">Human Resources</div></div>'
        )
    return (
        f'<div class="page-inner"><div style="padding:{p["pad_lg"]};padding-bottom:{"18px" if embed else "32px"};'
        f"border-bottom:3px solid {ACCENT};display:flex;justify-content:space-between;align-items:center;gap:16px\">"
        f"{left}"
        f'<div style="text-align:right">'
        f'<div style="font-size:{"14px" if embed else "18px"};font-weight:600;color:#374151">Offer Letter</div>'
        f"{_ref_div(ref)}"
        f'<div style="font-size:11px;color:#6b7280;margin-top:6px">{today}</div></div></div>'
        f'<div style="padding:8px 32px 0;font-size:12px"><strong>Candidate:</strong> {candidate}</div>'
        f'{_body_wrap(content, p["pad_sm"])}</div>'
    )


def _shell_modern(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["content"],
    )
    embed = ctx["embed"]
    mark_html = _mark_block(ctx, p["sz_md"], "margin-bottom:10px")
    ref_html = f'<div style="font-size:10px;opacity:.85;margin-top:8px">{_ref_line(ref)}</div>' if ref else ""
    return (
        f'<div class="page-inner"><div style="background:linear-gradient(135deg,{ACCENT},#4f46e5);color:#fff;padding:{p["pad_md"]}">'
        f"{mark_html}"
        f'<div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;opacity:.85">Offer Letter</div>'
        f'<div style="font-size:{"20px" if embed else "24px"};font-weight:800;margin-top:4px">{vendor}</div>'
        f'<div style="font-size:12px;opacity:.9;margin-top:4px">For {candidate}</div>{ref_html}</div>'
        f'{_body_wrap(content, p["pad_md"])}</div>'
    )


def _shell_minimal(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["today"], ctx["content"],
    )
    embed = ctx["embed"]
    mark_html = _mark_block(ctx, p["sz_sm"], "margin-bottom:10px")
    return (
        f'<div class="page-inner" style="padding:{p["pad_lg"]}">{mark_html}'
        f'<div style="font-size:11px;color:#6b7280;margin-bottom:6px">{vendor}</div>'
        f'<div style="font-size:{"17px" if embed else "20px"};font-weight:600;color:#111827;margin-bottom:8px">Offer Letter</div>'
        f'<div style="font-size:11px;color:#6b7280;margin-bottom:16px">{today} · {candidate}</div>'
        f"{_body_wrap(content)}</div>"
    )


def _shell_luxury(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["today"], ctx["content"],
    )
    embed = ctx["embed"]
    mark = _mark_block(ctx, p["sz_md"])
    return (
        f'<div class="page-inner"><div style="background:#1f2937;padding:{p["pad_md"]};position:relative;overflow:hidden">'
        f'<div style="position:absolute;top:0;right:0;width:180px;height:100%;background:{ACCENT};opacity:.15;'
        f'transform:skewX(-15deg) translateX(30px)"></div>'
        f'<div style="display:flex;justify-content:space-between;align-items:center;position:relative;gap:16px">'
        f'<div style="display:flex;align-items:center;gap:14px">{mark}<div>'
        f'<div style="font-size:{"18px" if embed else "20px"};font-weight:700;color:#fff">{vendor}</div>'
        f'<div style="font-size:10px;color:rgba(255,255,255,.6);margin-top:3px">Human Resources</div></div></div>'
        f'<div style="text-align:right"><div style="font-size:11px;color:{ACCENT};text-transform:uppercase;letter-spacing:.2em">Offer Letter</div>'
        f'{_ref_div(ref, "color:rgba(255,255,255,.5)")}'
        f'<div style="font-size:11px;color:rgba(255,255,255,.7);margin-top:6px">{today}</div></div></div></div>'
        f'<div style="height:4px;background:{ACCENT}"></div>'
        f'<div style="padding:12px 32px;font-size:12px;border-bottom:1px solid #e5e7eb"><strong>Candidate:</strong> {candidate}</div>'
        f'{_body_wrap(content, p["pad_md"])}</div>'
    )


def _shell_corporate(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["today"], ctx["content"],
    )
    embed = ctx["embed"]
    mark = _mark_block(ctx, p["sz_md"])
    if mark:
        left = (
            f'<div style="display:flex;align-items:center;gap:14px">{mark}<div>'
            f'<div style="font-size:{"18px" if embed else "20px"};font-weight:800;color:#111">{vendor}</div>'
            f'<div style="font-size:11px;color:#6b7280;margin-top:3px">Human Resources</div></div></div>'
        )
    else:
        left = (
            f"<div>"
            f'<div style="font-size:{"18px" if embed else "20px"};font-weight:800;color:#111">{vendor}</div>'
            f'<div style="font-size:11px;color:#6b7280;margin-top:3px">Human Resources</div></div>'
        )
    return (
        f'<div class="page-inner" style="border-left:5px solid {ACCENT}">'
        f'<div style="padding:{p["pad_md"]};border-bottom:1px solid #e5e7eb">'
        f'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px">{left}'
        f'<div style="text-align:right;padding-left:20px;border-left:3px solid {ACCENT};min-width:160px">'
        f'<div style="font-size:9px;text-transform:uppercase;letter-spacing:.15em;color:{ACCENT};font-weight:700">Offer Letter</div>'
        f"{_ref_div(ref)}"
        f'<div style="font-size:10px;color:#6b7280;margin-top:6px">Date: {today}</div></div></div></div>'
        f'<div style="padding:14px 32px;background:#f8fafc;border-bottom:1px solid #e5e7eb">'
        f'<div style="border-left:4px solid {ACCENT};padding-left:14px">'
        f'<div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:{ACCENT};font-weight:700;margin-bottom:4px">Candidate</div>'
        f'<div style="font-weight:700;font-size:13px">{candidate}</div></div></div>'
        f'{_body_wrap(content, p["pad_sm"])}</div>'
    )


def _shell_colorblock(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["today"], ctx["content"],
    )
    embed = ctx["embed"]
    side_w = "140px" if embed else "200px"
    mark_html = _mark_block(ctx, p["sz_sm"], "margin-bottom:12px")
    ref_html = (
        f'<div style="font-size:10px;color:rgba(255,255,255,.55);margin-top:12px">{_ref_line(ref)}</div>'
        if ref else ""
    )
    return (
        f'<div class="page-inner" style="display:flex;min-height:{"360px" if embed else "480px"}">'
        f'<div style="width:{side_w};background:{ACCENT};flex-shrink:0;padding:24px 16px;color:#fff">'
        f'{mark_html}<div style="font-size:{"13px" if embed else "14px"};font-weight:800;line-height:1.3">{vendor}</div>'
        f'<div style="font-size:9px;opacity:.55;text-transform:uppercase;letter-spacing:.12em;margin:16px 0 6px">Offer Letter</div>'
        f'<div style="font-size:11px;font-weight:600">{today}</div>{ref_html}'
        f'<div style="border-top:1px solid rgba(255,255,255,.2);margin-top:16px;padding-top:14px">'
        f'<div style="font-size:9px;opacity:.55;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Candidate</div>'
        f'<div style="font-size:12px;font-weight:700">{candidate}</div></div></div>'
        f'<div style="flex:1;padding:{p["pad_md"]}">{_body_wrap(content)}</div></div>'
    )


def _shell_compact(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["today"], ctx["content"],
    )
    mark = _mark_block(ctx, p["sz_sm"])
    if mark:
        left = (
            f'<div style="display:flex;align-items:center;gap:10px">{mark}<div>'
            f'<div style="font-size:15px;font-weight:800;color:#111">{vendor}</div>'
            f'<div style="font-size:9px;color:#6b7280">Human Resources</div></div></div>'
        )
    else:
        left = (
            f"<div>"
            f'<div style="font-size:15px;font-weight:800;color:#111">{vendor}</div>'
            f'<div style="font-size:9px;color:#6b7280">Human Resources</div></div>'
        )
    return (
        f'<div class="page-inner" style="padding:{p["pad_md"]}">'
        f'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid {ACCENT}">'
        f"{left}"
        f'<div style="text-align:right"><div style="font-size:16px;font-weight:800;color:{ACCENT};letter-spacing:1px">OFFER LETTER</div>'
        f"{_ref_div(ref)}"
        f'<div style="font-size:9px;color:#9ca3af;margin-top:4px">{today}</div></div></div>'
        f'<div style="margin-bottom:12px;padding:8px 10px;background:#f8fafc;border-radius:4px;font-size:11px">'
        f'<span style="font-size:9px;text-transform:uppercase;color:#9ca3af;margin-right:6px">Candidate:</span>'
        f'<span style="font-weight:700">{candidate}</span></div>'
        f"{_body_wrap(content)}</div>"
    )


def _shell_bold(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["today"], ctx["content"],
    )
    mark = _mark_block(ctx, p["sz_md"])
    if mark:
        left = (
            f'<div style="padding:20px 24px;display:flex;align-items:center;gap:14px">{mark}<div>'
            f'<div style="font-size:18px;font-weight:900;color:#fff">{vendor}</div>'
            f'<div style="font-size:9px;color:rgba(255,255,255,.65);margin-top:2px">Human Resources</div></div></div>'
        )
    else:
        left = (
            f'<div style="padding:20px 24px">'
            f'<div style="font-size:18px;font-weight:900;color:#fff">{vendor}</div>'
            f'<div style="font-size:9px;color:rgba(255,255,255,.65);margin-top:2px">Human Resources</div></div>'
        )
    ref_part = f'<div style="font-size:10px;color:rgba(255,255,255,.7);margin-top:6px">{_ref_line(ref)}</div>' if ref else ""
    return (
        f'<div class="page-inner"><div style="background:{ACCENT}">'
        f'<div style="display:flex;justify-content:space-between;align-items:stretch">{left}'
        f'<div style="background:rgba(0,0,0,.18);padding:20px 24px;display:flex;flex-direction:column;justify-content:center;align-items:flex-end;min-width:180px">'
        f'<div style="font-size:9px;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.15em">Offer Letter</div>'
        f"{ref_part}"
        f'<div style="font-size:9px;color:rgba(255,255,255,.55);margin-top:6px">{today}</div></div></div></div>'
        f'<div style="background:#1f2937;padding:14px 24px;display:flex;justify-content:space-between;align-items:center">'
        f'<div><div style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.1em">Candidate</div>'
        f'<div style="font-size:13px;font-weight:700;color:#fff;margin-top:2px">{candidate}</div></div></div>'
        f'{_body_wrap(content, p["pad_md"])}</div>'
    )


def _shell_visual(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["today"], ctx["content"],
    )
    embed = ctx["embed"]
    mark = _mark_block(ctx, p["sz_md"])
    if mark:
        left = (
            f'<div style="display:flex;align-items:center;gap:14px">{mark}<div>'
            f'<div style="font-size:{"18px" if embed else "20px"};font-weight:800;color:#0f172a">{vendor}</div>'
            f'<div style="font-size:10px;color:#94a3b8;margin-top:3px">Human Resources</div></div></div>'
        )
    else:
        left = (
            f"<div>"
            f'<div style="font-size:{"18px" if embed else "20px"};font-weight:800;color:#0f172a">{vendor}</div>'
            f'<div style="font-size:10px;color:#94a3b8;margin-top:3px">Human Resources</div></div>'
        )
    return (
        f'<div class="page-inner"><div style="padding:{p["pad_md"]};border-bottom:1px solid #f1f5f9">'
        f'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px">{left}'
        f'<div style="background:{ACCENT};border-radius:10px;padding:14px 18px;text-align:right;min-width:160px;flex-shrink:0">'
        f'<div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.7);font-weight:600">Offer Letter</div>'
        f'{_ref_div(ref, "color:rgba(255,255,255,.65)")}'
        f'<div style="font-size:10px;color:rgba(255,255,255,.7);margin-top:6px">{today}</div></div></div></div>'
        f'<div style="padding:14px 32px;border-bottom:1px solid #f1f5f9;font-size:12px"><strong>Candidate:</strong> {candidate}</div>'
        f'{_body_wrap(content, p["pad_md"])}</div>'
    )


def _shell_centered(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["today"], ctx["content"],
    )
    embed = ctx["embed"]
    mark_html = _mark_block(ctx, p["sz_lg"], "margin:0 auto 12px;display:flex;justify-content:center")
    ref_html = f'<div style="font-size:10px;color:#9ca3af;margin-top:8px">Ref: {ref}</div>' if ref else ""
    return (
        f'<div class="page-inner" style="padding:{p["pad_lg"]}">'
        f'<div style="text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid {ACCENT}">'
        f"{mark_html}"
        f'<div style="font-size:{"20px" if embed else "22px"};font-weight:700;color:#111">{vendor}</div>'
        f'<div style="font-size:11px;color:#6b7280;margin-top:4px;letter-spacing:.08em;text-transform:uppercase">Offer Letter</div>'
        f"{ref_html}"
        f'<div style="font-size:11px;color:#6b7280;margin-top:10px">{today}</div></div>'
        f'<div style="text-align:center;font-size:12px;margin-bottom:16px">{candidate}</div>'
        f"{_body_wrap(content)}</div>"
    )


def _shell_letterhead(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["today"], ctx["content"],
    )
    embed = ctx["embed"]
    mark_html = _mark_block(ctx, p["sz_lg"], "margin-bottom:12px;display:flex;justify-content:center")
    ref_html = f'<div style="font-size:11px;color:#6b7280;margin-top:8px">Ref: {ref}</div>' if ref else ""
    return (
        f'<div class="page-inner"><div style="padding:{p["pad_lg"]};text-align:center;border-bottom:2px solid {ACCENT}">'
        f"{mark_html}"
        f'<div style="font-size:{"22px" if embed else "26px"};font-weight:700;color:{ACCENT}">{vendor}</div>'
        f'<div style="font-size:11px;color:#6b7280;margin-top:4px;letter-spacing:.08em;text-transform:uppercase">Official Offer of Employment</div>'
        f"{ref_html}</div>"
        f'<div style="padding:10px 32px;display:flex;justify-content:space-between;font-size:11px;color:#6b7280;border-bottom:1px solid #e5e7eb">'
        f"<span>{candidate}</span><span>{today}</span></div>"
        f'{_body_wrap(content, p["pad_md"])}</div>'
    )


def _shell_banner(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["today"], ctx["content"],
    )
    embed = ctx["embed"]
    mark_html = _mark_block(ctx, p["sz_sm"])
    ref_part = _ref_line(ref) if ref else ""
    return (
        f'<div class="page-inner"><div style="background:linear-gradient(90deg,{ACCENT} 0%,{ACCENT}dd 100%);padding:18px 28px;color:#fff">'
        f'<div style="display:flex;justify-content:space-between;align-items:center;gap:16px">'
        f'<div style="min-width:90px">{mark_html}</div>'
        f'<div style="flex:1;text-align:center"><div style="font-size:{"18px" if embed else "22px"};font-weight:900;letter-spacing:1px">OFFER LETTER</div>'
        f'<div style="font-size:12px;opacity:.85;margin-top:4px">{vendor}</div></div>'
        f'<div style="min-width:90px;text-align:right;font-size:10px;opacity:.9">{ref_part}'
        f'<div style="margin-top:4px">{today}</div></div></div></div>'
        f'<div style="padding:12px 28px;background:#f8fafc;border-bottom:1px solid #e5e7eb;font-size:12px"><strong>Candidate:</strong> {candidate}</div>'
        f'{_body_wrap(content, p["pad_md"])}</div>'
    )


def _shell_executive(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["today"], ctx["content"],
    )
    embed = ctx["embed"]
    mark_html = _mark_block(ctx, p["sz_lg"])
    return (
        f'<div class="page-inner" style="padding:{p["pad_lg"]}">'
        f'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;gap:16px">'
        f'<div style="flex:1"><div style="font-size:11px;font-weight:600;color:{ACCENT};text-transform:uppercase;letter-spacing:.2em;margin-bottom:8px">Offer Letter</div>'
        f'<div style="font-size:{"20px" if embed else "24px"};font-weight:700;color:#111">{vendor}</div>'
        f'<div style="font-size:11px;color:#6b7280;margin-top:8px">{today}</div>{_ref_div(ref)}'
        f'<div style="font-size:12px;margin-top:12px"><strong>Candidate:</strong> {candidate}</div></div>'
        f'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px">{mark_html}</div></div>'
        f'<div style="height:3px;background:linear-gradient(90deg,{ACCENT},transparent);margin-bottom:20px"></div>'
        f"{_body_wrap(content)}</div>"
    )


def _shell_stripe(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["today"], ctx["content"],
    )
    embed = ctx["embed"]
    mark_html = _mark_block(ctx, p["sz_sm"])
    ref_html = f'<div style="font-size:10px;color:#6b7280;margin-top:4px">{_ref_line(ref)}</div>' if ref else ""
    return (
        f'<div class="page-inner"><div style="height:6px;background:linear-gradient(90deg,{ACCENT} 33%,#1f2937 33%,#1f2937 66%,{ACCENT} 66%)"></div>'
        f'<div style="padding:18px 28px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e5e7eb;gap:12px">'
        f'<div style="min-width:100px">{mark_html}</div>'
        f'<div style="text-align:center;flex:1"><div style="font-size:{"16px" if embed else "19px"};font-weight:800;color:#111">{vendor}</div>'
        f'<div style="font-size:14px;font-weight:700;color:{ACCENT};margin-top:6px;letter-spacing:1px">OFFER LETTER</div>{ref_html}</div>'
        f'<div style="text-align:right;font-size:11px;color:#6b7280;min-width:100px">{today}</div></div>'
        f'<div style="padding:10px 28px;font-size:12px;border-bottom:1px solid #f3f4f6"><strong>Candidate:</strong> {candidate}</div>'
        f'{_body_wrap(content, p["pad_md"])}</div>'
    )


def _shell_gstpro(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["today"], ctx["content"],
    )
    embed = ctx["embed"]
    mark_html = _mark_block(ctx, p["sz_md"])
    ref_html = f'<div style="font-size:10px;color:#6b7280;margin-top:4px">{_ref_line(ref)}</div>' if ref else ""
    return (
        f'<div class="page-inner"><div style="display:grid;grid-template-columns:auto 1fr auto;gap:16px;padding:18px 24px;border-bottom:2px solid {ACCENT};align-items:start">'
        f'<div style="border:1px solid #e5e7eb;border-radius:6px;padding:8px;background:#f8fafc;min-width:90px;text-align:center">{mark_html}</div>'
        f'<div><div style="font-size:{"16px" if embed else "18px"};font-weight:800;color:#111">{vendor}</div>'
        f'<div style="font-size:10px;color:#6b7280;margin-top:4px">Human Resources</div></div>'
        f'<div style="text-align:right;min-width:120px"><div style="background:{ACCENT};color:#fff;padding:8px 14px;border-radius:4px;font-weight:800;font-size:13px;letter-spacing:1px">OFFER LETTER</div>'
        f"{ref_html}</div></div>"
        f'<div style="padding:14px 24px;display:grid;grid-template-columns:1fr 1fr;gap:12px;border-bottom:1px solid #e5e7eb">'
        f'<div style="border:1px solid #e5e7eb;border-radius:4px;overflow:hidden"><div style="background:{ACCENT};color:#fff;font-size:9px;font-weight:700;padding:5px 10px;text-transform:uppercase">Date</div>'
        f'<div style="padding:10px;font-size:11px">{today}</div></div>'
        f'<div style="border:1px solid #e5e7eb;border-radius:4px;overflow:hidden"><div style="background:#f1f5f9;font-size:9px;font-weight:700;padding:5px 10px;text-transform:uppercase;color:#374151">Candidate</div>'
        f'<div style="padding:10px;font-size:12px;font-weight:700">{candidate}</div></div></div>'
        f'{_body_wrap(content, p["pad_md"])}</div>'
    )


def _shell_retail(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["today"], ctx["content"],
    )
    mark_html = _mark_block(ctx, p["sz_sm"])
    if mark_html:
        left = (
            f'<div style="display:flex;align-items:center;gap:12px">{mark_html}<div>'
            f'<div style="font-size:16px;font-weight:800">{vendor}</div>'
            f'<div style="font-size:9px;opacity:.7;margin-top:2px">Human Resources</div></div></div>'
        )
    else:
        left = (
            f"<div>"
            f'<div style="font-size:16px;font-weight:800">{vendor}</div>'
            f'<div style="font-size:9px;opacity:.7;margin-top:2px">Human Resources</div></div>'
        )
    ref_part = f"<span>{_ref_line(ref)}</span>" if ref else "<span></span>"
    return (
        f'<div class="page-inner"><div style="display:flex;justify-content:space-between;align-items:center;padding:14px 20px;background:#111;color:#fff">'
        f"{left}"
        f'<div style="text-align:right"><div style="font-size:9px;opacity:.6;text-transform:uppercase">Offer Letter</div>'
        f'<div style="font-size:14px;font-weight:800;color:{ACCENT};margin-top:4px">{today}</div></div></div>'
        f'<div style="display:flex;justify-content:space-between;padding:10px 20px;background:{ACCENT}15;border-bottom:2px solid {ACCENT};font-size:11px">'
        f"<span><strong>Candidate:</strong> {candidate}</span>{ref_part}</div>"
        f'{_body_wrap(content, p["pad_md"])}</div>'
    )


def _shell_sideright(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["today"], ctx["content"],
    )
    embed = ctx["embed"]
    mark_html = _mark_block(ctx, p["sz_md"])
    ref_html = f'<div style="font-size:8px;opacity:.75;margin-top:8px">{_ref_line(ref)}</div>' if ref else ""
    return (
        f'<div class="page-inner" style="display:flex;min-height:{"320px" if embed else "420px"}">'
        f'<div style="flex:1;padding:{p["pad_md"]}">'
        f'<div style="margin-bottom:18px"><div style="font-size:{"18px" if embed else "22px"};font-weight:800;color:{ACCENT}">OFFER LETTER</div>'
        f'<div style="font-size:11px;color:#6b7280;margin-top:6px">{today}</div></div>'
        f'<div style="margin-bottom:16px;padding:12px;background:#f8fafc;border-radius:6px">'
        f'<div style="font-size:9px;color:#9ca3af;text-transform:uppercase;margin-bottom:4px">Candidate</div>'
        f'<div style="font-weight:700;font-size:13px">{candidate}</div></div>'
        f"{_body_wrap(content)}</div>"
        f'<div style="width:{"120px" if embed else "150px"};background:{ACCENT};color:#fff;padding:18px 12px;display:flex;flex-direction:column;align-items:center;gap:10px;flex-shrink:0">'
        f'{mark_html}<div style="text-align:center;font-size:11px;font-weight:700;line-height:1.3">{vendor}</div>{ref_html}</div></div>'
    )


def _shell_framed(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["today"], ctx["content"],
    )
    embed = ctx["embed"]
    mark_html = _mark_block(ctx, p["sz_md"])
    ref_part = f" · {_ref_line(ref)}" if ref else ""
    return (
        f'<div class="page-inner" style="border:3px double {ACCENT};padding:{p["pad_md"]}">'
        f'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid #d1d5db;gap:16px">'
        f'<div style="flex:1"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.2em;color:{ACCENT};font-weight:700">Offer Letter</div>'
        f'<div style="font-size:{"18px" if embed else "20px"};font-weight:700;margin-top:6px;color:#111">{vendor}</div>'
        f'<div style="margin-top:8px;font-size:11px;color:#374151">{today}{ref_part}</div>'
        f'<div style="font-size:12px;margin-top:10px"><strong>Candidate:</strong> {candidate}</div></div>'
        f"<div>{mark_html}</div></div>"
        f"{_body_wrap(content)}</div>"
    )


def _shell_slimleft(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["today"], ctx["content"],
    )
    embed = ctx["embed"]
    mark_html = _mark_block(ctx, p["sz_md"])
    ref_html = f'<div style="font-size:8px;color:#9ca3af;margin-top:8px">{_ref_line(ref)}</div>' if ref else ""
    return (
        f'<div class="page-inner" style="display:flex;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">'
        f'<div style="width:{"130px" if embed else "170px"};background:#f8fafc;border-right:1px solid #e5e7eb;padding:16px 12px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:8px">'
        f'{mark_html}<div style="text-align:center;font-size:11px;font-weight:800;color:#111;line-height:1.3">{vendor}</div>'
        f'<div style="width:100%;height:2px;background:{ACCENT};margin-top:4px"></div>{ref_html}</div>'
        f'<div style="flex:1;padding:18px 22px"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">'
        f'<div style="font-size:{"16px" if embed else "20px"};font-weight:800;color:{ACCENT}">OFFER LETTER</div>'
        f'<div style="text-align:right;font-size:11px;color:#6b7280"><div style="margin-top:2px">{today}</div></div></div>'
        f'<div style="margin-bottom:14px;padding:10px 12px;border:1px dashed #d1d5db;border-radius:6px;font-size:12px"><strong>Candidate:</strong> {candidate}</div>'
        f"{_body_wrap(content)}</div></div>"
    )


def _shell_premiumright(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["today"], ctx["content"],
    )
    embed = ctx["embed"]
    mark_html = _mark_block(ctx, p["sz_lg"])
    ref_html = f'<div style="font-size:10px;color:#6b7280;margin-top:6px">{_ref_line(ref)}</div>' if ref else ""
    return (
        f'<div class="page-inner"><div style="padding:20px 28px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:16px">'
        f'<div style="flex:1"><div style="display:inline-block;background:{ACCENT};color:#fff;font-size:9px;font-weight:700;padding:4px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">Offer Letter</div>'
        f'<div style="font-size:{"18px" if embed else "22px"};font-weight:800;color:#111">{vendor}</div>{ref_html}</div>'
        f"<div>{mark_html}</div></div>"
        f'<div style="margin:14px 28px 0;display:grid;grid-template-columns:1fr 1fr;gap:8px">'
        f'<div style="background:#f8fafc;border-radius:8px;padding:10px;text-align:center;border:1px solid #e5e7eb"><div style="font-size:8px;color:#9ca3af;text-transform:uppercase">Date</div><div style="font-weight:600;font-size:11px;margin-top:3px">{today}</div></div>'
        f'<div style="background:{ACCENT}12;border-radius:8px;padding:10px;text-align:center;border:1px solid {ACCENT}40"><div style="font-size:8px;color:#6b7280;text-transform:uppercase">Candidate</div><div style="font-weight:700;font-size:11px;color:{ACCENT};margin-top:3px">{candidate}</div></div></div>'
        f'{_body_wrap(content, "20px 28px 24px")}</div>'
    )


def _shell_leftlogo(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["today"], ctx["content"],
    )
    embed = ctx["embed"]
    mark_html = _mark_block(ctx, p["sz_lg"])
    ref_html = f'<div style="font-size:10px;color:#9ca3af;margin-top:4px">Ref: {ref}</div>' if ref else ""
    return (
        f'<div class="page-inner"><div style="padding:20px 28px;border-bottom:4px double {ACCENT}">'
        f'<div style="display:flex;justify-content:space-between;align-items:center;gap:16px">'
        f'<div style="min-width:100px">{mark_html}</div>'
        f'<div style="flex:1"><div style="font-size:{"18px" if embed else "20px"};font-weight:800;color:#111">{vendor}</div>'
        f'<div style="font-size:11px;color:#6b7280;margin-top:3px">Human Resources</div>'
        f'<div style="margin-top:10px;font-size:{"15px" if embed else "18px"};font-weight:700;color:{ACCENT};letter-spacing:2px">OFFER LETTER</div>{ref_html}</div>'
        f'<div style="text-align:right;font-size:11px;color:#6b7280"><div>Date: <strong style="color:#111">{today}</strong></div></div></div></div>'
        f'<div style="padding:12px 28px;font-size:12px;border-bottom:1px solid #e5e7eb"><strong>Candidate:</strong> {candidate}</div>'
        f'{_body_wrap(content, p["pad_md"])}</div>'
    )


def _shell_rightlogo(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["today"], ctx["content"],
    )
    embed = ctx["embed"]
    mark_html = _mark_block(ctx, p["sz_lg"])
    ref_html = f'<div style="font-size:10px;color:#6b7280;margin-top:6px">{_ref_line(ref)}</div>' if ref else ""
    return (
        f'<div class="page-inner"><div style="padding:{p["pad_md"]};border-bottom:3px solid {ACCENT};display:flex;justify-content:space-between;align-items:flex-start;gap:20px">'
        f'<div style="flex:1"><div style="font-size:{"18px" if embed else "22px"};font-weight:800;color:{ACCENT};letter-spacing:1px">OFFER LETTER</div>'
        f'<div style="font-size:{"16px" if embed else "20px"};font-weight:700;color:#111;margin-top:10px">{vendor}</div>'
        f'<div style="font-size:11px;color:#6b7280;margin-top:4px">Human Resources</div>{ref_html}'
        f'<div style="font-size:11px;color:#6b7280;margin-top:8px">{today}</div></div>'
        f'<div style="min-width:100px">{mark_html}</div></div>'
        f'<div style="padding:10px 32px;font-size:12px;border-bottom:1px solid #e5e7eb"><strong>Candidate:</strong> {candidate}</div>'
        f'{_body_wrap(content, p["pad_sm"])}</div>'
    )


def _shell_footerleft(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["today"], ctx["content"],
    )
    embed = ctx["embed"]
    header_mark = _mark_block(ctx, p["sz_md"])
    if header_mark:
        header_left = f'<div style="display:flex;align-items:flex-start;gap:14px"><div>{header_mark}</div><div>'
        header_close = "</div></div>"
    else:
        header_left = "<div>"
        header_close = "</div>"
    ref_part = f'<div style="font-size:10px;color:#6b7280;margin-top:6px">{_ref_line(ref)}</div>' if ref else ""
    return (
        f'<div class="page-inner"><div style="padding:{p["pad_md"]};border-bottom:3px solid {ACCENT}">'
        f'{header_left}<div style="font-size:{"18px" if embed else "22px"};font-weight:800;color:{ACCENT};letter-spacing:1px">OFFER LETTER</div>'
        f'<div style="font-size:{"16px" if embed else "20px"};font-weight:700;color:#111;margin-top:10px">{vendor}</div>'
        f'<div style="font-size:11px;color:#6b7280;margin-top:4px">Human Resources</div>{ref_part}{header_close}</div>'
        f'<div style="padding:12px 32px;display:grid;grid-template-columns:1fr 1fr;gap:16px;border-bottom:1px solid #e5e7eb;font-size:11px">'
        f'<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;padding:12px"><div style="color:#6b7280;margin-bottom:4px">Date</div><div style="font-weight:600">{today}</div></div>'
        f'<div><div style="font-size:10px;color:#9ca3af;text-transform:uppercase;margin-bottom:6px">Candidate</div><div style="font-weight:700;font-size:13px">{candidate}</div></div></div>'
        f'{_body_wrap(content, p["pad_sm"])}{_footer_mark_row(ctx, p["sz_sm"], "left")}</div>'
    )


def _shell_footerright(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["today"], ctx["content"],
    )
    embed = ctx["embed"]
    header_mark = _mark_block(ctx, p["sz_md"])
    if header_mark:
        header_left = f'<div style="display:flex;align-items:flex-start;gap:14px"><div>{header_mark}</div><div>'
        header_close = "</div></div>"
    else:
        header_left = "<div>"
        header_close = "</div>"
    return (
        f'<div class="page-inner"><div style="padding:{p["pad_md"]};border-bottom:3px solid {ACCENT}">'
        f'{header_left}<div style="font-size:{"18px" if embed else "22px"};font-weight:800;color:{ACCENT};letter-spacing:1px">OFFER LETTER</div>'
        f'<div style="font-size:{"16px" if embed else "20px"};font-weight:700;color:#111;margin-top:10px">{vendor}</div>'
        f'<div style="font-size:11px;color:#6b7280;margin-top:4px">Human Resources</div>{header_close}</div>'
        f'<div style="padding:12px 32px;display:grid;grid-template-columns:1fr 1fr;gap:16px;border-bottom:1px solid #e5e7eb;font-size:11px">'
        f'<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;padding:12px"><div style="color:#6b7280;margin-bottom:4px">Date</div><div style="font-weight:600">{today}</div></div>'
        f'<div><div style="font-size:10px;color:#9ca3af;text-transform:uppercase;margin-bottom:6px">Candidate</div><div style="font-weight:700;font-size:13px">{candidate}</div></div></div>'
        f'{_body_wrap(content, p["pad_sm"])}{_footer_mark_row(ctx, p["sz_sm"], "right")}</div>'
    )


def _shell_toprightlogobottomleft(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["today"], ctx["content"],
    )
    embed = ctx["embed"]
    header_mark = _mark_block(ctx, p["sz_lg"])
    ref_html = f'<div style="font-size:10px;color:#6b7280;margin-top:6px">{_ref_line(ref)}</div>' if ref else ""
    return (
        f'<div class="page-inner"><div style="padding:{p["pad_md"]};border-bottom:3px solid {ACCENT};display:flex;justify-content:space-between;align-items:flex-start;gap:20px">'
        f'<div style="flex:1"><div style="font-size:{"18px" if embed else "22px"};font-weight:800;color:{ACCENT};letter-spacing:1px">OFFER LETTER</div>'
        f'<div style="font-size:{"16px" if embed else "20px"};font-weight:700;color:#111;margin-top:10px">{vendor}</div>'
        f'<div style="font-size:11px;color:#6b7280;margin-top:4px">Human Resources</div>{ref_html}'
        f'<div style="font-size:11px;color:#6b7280;margin-top:8px">{today}</div></div>'
        f'<div style="min-width:100px">{header_mark}</div></div>'
        f'<div style="padding:10px 32px;font-size:12px;border-bottom:1px solid #e5e7eb"><strong>Candidate:</strong> {candidate}</div>'
        f'{_body_wrap(content, p["pad_sm"])}{_footer_mark_row(ctx, p["sz_sm"], "left")}</div>'
    )


def _shell_topleftlogobottomright(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["today"], ctx["content"],
    )
    embed = ctx["embed"]
    header_mark = _mark_block(ctx, p["sz_lg"])
    ref_html = f'<div style="font-size:10px;color:#6b7280;margin-top:6px">{_ref_line(ref)}</div>' if ref else ""
    return (
        f'<div class="page-inner"><div style="padding:{p["pad_md"]};border-bottom:3px solid {ACCENT};display:flex;justify-content:space-between;align-items:flex-start;gap:20px">'
        f'<div style="min-width:100px">{header_mark}</div>'
        f'<div style="flex:1;text-align:right"><div style="font-size:{"18px" if embed else "22px"};font-weight:800;color:{ACCENT};letter-spacing:1px">OFFER LETTER</div>'
        f'<div style="font-size:{"16px" if embed else "20px"};font-weight:700;color:#111;margin-top:10px">{vendor}</div>'
        f'<div style="font-size:11px;color:#6b7280;margin-top:4px">Human Resources</div>{ref_html}'
        f'<div style="font-size:11px;color:#6b7280;margin-top:8px">{today}</div></div></div>'
        f'<div style="padding:10px 32px;font-size:12px;border-bottom:1px solid #e5e7eb"><strong>Candidate:</strong> {candidate}</div>'
        f'{_body_wrap(content, p["pad_sm"])}{_footer_mark_row(ctx, p["sz_sm"], "right")}</div>'
    )


def _shell_official_gulf(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["today"], ctx["content"],
    )
    embed = ctx["embed"]
    mark = _mark_at(ctx, p["sz_lg"])
    ref_part = _ref_line(ref) if ref else "<span></span>"
    return (
        f'<div class="page-inner">'
        f'<div style="padding:{p["pad_lg"]};padding-bottom:16px;display:flex;align-items:center;gap:14px">{mark}'
        f'<div><div style="font-size:{"18px" if embed else "22px"};font-weight:800;color:{ACCENT}">{vendor}</div>'
        f'<div style="font-size:10px;color:#16a34a;letter-spacing:.12em;text-transform:uppercase;margin-top:3px">Official Offer of Employment</div></div></div>'
        f'<div style="border-top:1px solid #d1d5db;border-bottom:1px solid #d1d5db;padding:8px 32px;text-align:center;font-size:10px;color:#6b7280">Soft copy of official offer letter — {vendor}</div>'
        f'<div style="display:flex;justify-content:space-between;padding:10px 32px;font-size:11px">{ref_part}<span>Date: {today}</span></div>'
        f'<div style="padding:8px 32px 14px;border-bottom:1px solid #e5e7eb;font-size:12px"><strong>Employee:</strong> {candidate}</div>'
        f'<div style="padding:{p["pad_sm"]}"><div class="body-content"><div style="font-size:14px;font-weight:700;margin-bottom:12px">Offer of Employment</div>{content}</div></div>'
        f"{_signature_row()}"
        f'<div style="padding:0 32px 24px;font-size:10px;color:#9ca3af;text-align:center">Please sign and return a scanned copy to Human Resources.</div></div>'
    )


def _shell_employment_formal(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, ref, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["ref"], ctx["today"], ctx["content"],
    )
    embed = ctx["embed"]
    mark = _mark_at(ctx, p["sz_md"])
    if mark:
        header_row = (
            f'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px;font-size:11px;color:#4b5563">'
            f"<div>{mark}</div><span>Date: {today}</span></div>"
        )
    else:
        header_row = (
            f'<div style="display:flex;justify-content:flex-end;font-size:11px;color:#4b5563;margin-bottom:18px">'
            f"<span>Date: {today}</span></div>"
        )
    ref_part = _ref_line(ref) if ref else "Reference: —"
    return (
        f'<div class="page-inner" style="padding:{p["pad_lg"]}">'
        f'<div style="text-align:center;font-size:{"15px" if embed else "17px"};font-weight:800;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px">Employment Offer Letter</div>'
        f'<div style="display:flex;justify-content:space-between;font-size:11px;color:#4b5563;margin-bottom:10px"><span>{ref_part}</span></div>'
        f"{header_row}"
        f'<div style="font-size:12px;margin-bottom:14px"><strong>Candidate:</strong> {candidate}</div>'
        f'<div class="body-content"><div style="font-size:13px;font-weight:700;margin-bottom:10px">Summary of employment terms</div>{content}</div>'
        f"{_signature_row()}</div>"
    )


def _shell_branded_bands(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["today"], ctx["content"],
    )
    embed = ctx["embed"]
    mark = _mark_at(ctx, p["sz_md"])
    if mark:
        left_header = (
            f'<div style="display:flex;align-items:center;gap:12px;min-width:0"><div>{mark}</div><div>'
            f'<div style="font-size:{"16px" if embed else "18px"};font-weight:800;color:#0f766e">{vendor}</div>'
            f'<div style="font-size:10px;color:#6b7280;margin-top:4px">Human Resources Department</div></div></div>'
        )
    else:
        left_header = (
            f'<div style="min-width:0">'
            f'<div style="font-size:{"16px" if embed else "18px"};font-weight:800;color:#0f766e">{vendor}</div>'
            f'<div style="font-size:10px;color:#6b7280;margin-top:4px">Human Resources Department</div></div>'
        )
    return (
        f'<div class="page-inner">'
        f'<div style="height:10px;background:linear-gradient(105deg,#f97316 0%,#f97316 32%,#0d9488 32%,#0d9488 100%)"></div>'
        f'<div style="padding:20px 32px 12px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px">{left_header}'
        f'<div style="text-align:right;font-size:{"13px" if embed else "15px"};font-weight:800;text-transform:uppercase">Job Offer Letter</div></div>'
        f'<div style="margin:0 32px;border-top:1px solid #e5e7eb"></div>'
        f'<div style="padding:8px 32px 0;display:flex;justify-content:space-between;font-size:11px;color:#6b7280"><span>{vendor}</span><span>{today}</span></div>'
        f'<div style="padding:16px 32px 8px;font-size:12px"><strong>To:</strong> {candidate}</div>'
        f'<div style="padding:0 32px 24px"><div class="body-content">{content}</div></div>'
        f'<div style="padding:0 32px 28px;font-size:12px"><div>Warm regards,</div><div style="margin-top:28px;font-weight:600">{vendor}</div>'
        f'<div style="font-size:11px;color:#6b7280">Human Resources</div></div>'
        f'<div style="height:10px;background:linear-gradient(105deg,#0d9488 0%,#0d9488 68%,#f97316 68%,#f97316 100%)"></div></div>'
    )


def _shell_classic_formal(ctx: OfferShellCtx, p: PadVals) -> str:
    vendor, candidate, today, content = (
        ctx["vendor"], ctx["candidate"], ctx["today"], ctx["content"],
    )
    embed = ctx["embed"]
    mark = _mark_at(ctx, p["sz_md"])
    mark_html = f'<div style="display:flex;justify-content:center;margin-bottom:14px">{mark}</div>' if mark else ""
    return (
        f'<div class="page-inner" style="padding:{p["pad_lg"]}">{mark_html}'
        f'<div style="text-align:center;font-size:{"16px" if embed else "18px"};font-weight:700;margin-bottom:20px">Offer Letter</div>'
        f'<div style="font-size:12px;margin-bottom:16px">{today}</div>'
        f'<div style="font-size:12px;margin-bottom:16px">{candidate}</div>'
        f'<div class="body-content">{content}</div>'
        f'<div style="margin-top:28px;font-size:12px"><div>Sincerely,</div><div style="margin-top:40px;font-weight:600">{vendor}</div>'
        f'<div style="color:#6b7280">Human Resources</div></div></div>'
    )


ShellFn = Callable[[OfferShellCtx, PadVals], str]

SHELLS: dict[str, ShellFn] = {
    "classic": _shell_classic,
    "modern": _shell_modern,
    "minimal": _shell_minimal,
    "luxury": _shell_luxury,
    "corporate": _shell_corporate,
    "colorblock": _shell_colorblock,
    "compact": _shell_compact,
    "bold": _shell_bold,
    "visual": _shell_visual,
    "centered": _shell_centered,
    "letterhead": _shell_letterhead,
    "banner": _shell_banner,
    "executive": _shell_executive,
    "stripe": _shell_stripe,
    "gstpro": _shell_gstpro,
    "retail": _shell_retail,
    "sideright": _shell_sideright,
    "framed": _shell_framed,
    "slimleft": _shell_slimleft,
    "premiumright": _shell_premiumright,
    "leftlogo": _shell_leftlogo,
    "rightlogo": _shell_rightlogo,
    "footerleft": _shell_footerleft,
    "footerright": _shell_footerright,
    "toprightlogobottomleft": _shell_toprightlogobottomleft,
    "topleftlogobottomright": _shell_topleftlogobottomright,
    "official_gulf": _shell_official_gulf,
    "employment_formal": _shell_employment_formal,
    "branded_bands": _shell_branded_bands,
    "classic_formal": _shell_classic_formal,
}

OFFER_LAYOUT_IDS: frozenset[str] = frozenset(SHELLS) | frozenset(ALIASES)


def render_offer_layout_shell(layout_id: str, ctx: OfferShellCtx | dict[str, Any]) -> str:
    """Render the inner page HTML for a layout id using shell ctx (vendor, content, mark_html, …)."""
    lid = normalize_offer_layout_id(layout_id)
    fn = SHELLS.get(lid, SHELLS["classic"])
    shell_ctx: OfferShellCtx = ctx  # type: ignore[assignment]
    return fn(shell_ctx, _pads(shell_ctx["embed"]))
