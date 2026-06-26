"""Predefined offer-letter layout shells that wrap template body HTML."""

from __future__ import annotations

from html import escape
from typing import Any

from app.services.offer_layout_shells import (
    OFFER_LAYOUT_IDS,
    normalize_offer_layout_id,
    render_offer_layout_shell,
)

OFFER_LAYOUTS = tuple(sorted(OFFER_LAYOUT_IDS))

DEFAULT_LAYOUT = "classic"
OFFER_PAGE_BREAK = "<!-- offer-page-break -->"
DEFAULT_ACCENT = "#1a56db"


def _apply_offer_accent_color(html: str, accent_color: str | None) -> str:
    accent = (accent_color or "").strip()
    if not accent or accent.lower() == DEFAULT_ACCENT:
        return html
    return html.replace(DEFAULT_ACCENT, accent).replace(DEFAULT_ACCENT.upper(), accent)


def _parse_opacity(value: Any) -> float:
    try:
        op = float(value or 0.12)
    except (TypeError, ValueError):
        op = 0.12
    return max(0.04, min(0.35, op))


def _watermark_block(
    vendor_name: str,
    *,
    enabled: bool = False,
    text: str | None = None,
    opacity: Any = 0.12,
    style: str = "diagonal_text",
) -> str:
    if not enabled:
        return ""
    label = escape((text or vendor_name or "CONFIDENTIAL").strip() or "CONFIDENTIAL")
    op = _parse_opacity(opacity)
    initials = escape("".join(w[:1] for w in (vendor_name or "CO").split()[:3]).upper() or "CO")
    if style == "center_mark":
        return f"""
  <div aria-hidden="true" style="position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden">
    <div style="position:absolute;top:46%;left:50%;transform:translate(-50%,-50%);width:200px;height:200px;border-radius:50%;
      border:4px solid rgba(148,163,184,{op});display:flex;align-items:center;justify-content:center;
      font-size:56px;font-weight:900;color:rgba(100,116,139,{op});letter-spacing:.06em">{initials}</div>
    <div style="position:absolute;top:62%;left:50%;transform:translate(-50%,-50%);font-size:13px;font-weight:700;
      letter-spacing:.22em;text-transform:uppercase;color:rgba(100,116,139,{op * 0.85});white-space:nowrap">{label}</div>
  </div>"""
    return f"""
  <div aria-hidden="true" style="position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden;
    display:flex;align-items:center;justify-content:center">
    <div style="transform:rotate(-32deg);font-size:58px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
      color:rgba(100,116,139,{op});white-space:nowrap">{label}</div>
  </div>"""


def _initials_mark(vendor: str, size: int = 52) -> str:
    initials = escape("".join(w[:1] for w in (vendor or "CO").split()[:3]).upper() or "CO")
    return (
        f'<div style="width:{size}px;height:{size}px;border-radius:50%;border:3px solid #1a56db;flex-shrink:0;'
        f'display:flex;align-items:center;justify-content:center;font-weight:800;color:#ea580c;font-size:{max(12, size // 3)}px">'
        f'{initials}</div>'
    )


def _logo_clip_wrap(url: str, w: int, h: int, clip_path: str) -> str:
    return (
        f'<span style="display:inline-block;width:{w}px;height:{h}px;clip-path:{clip_path};'
        f'-webkit-clip-path:{clip_path};overflow:hidden;flex-shrink:0;line-height:0;vertical-align:middle;">'
        f'<img src="{url}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" /></span>'
    )


_VALID_LOGO_SHAPES = frozenset({
    "square", "rounded", "circle", "pill", "sharp",
    "squircle", "oval", "diamond", "hexagon", "arch", "shield",
})


def _logo_tag(logo_url: str | None, *, size: int = 52, shape: str = "rounded") -> str:
    if not logo_url or not logo_url.strip():
        return ""
    url = escape(logo_url.strip())
    shape = shape if shape in _VALID_LOGO_SHAPES else "rounded"

    if shape == "circle":
        return (
            f'<img src="{url}" alt="" style="width:{size}px;height:{size}px;max-width:{size}px;'
            f'min-width:{size}px;border-radius:50%;object-fit:cover;display:block;flex-shrink:0;" />'
        )
    if shape == "oval":
        w = round(size * 1.45)
        return (
            f'<img src="{url}" alt="" style="width:{w}px;height:{size}px;max-width:{w}px;'
            f'border-radius:50%;object-fit:cover;display:block;flex-shrink:0;" />'
        )
    if shape == "pill":
        return (
            f'<img src="{url}" alt="" style="height:{size}px;width:{round(size * 2.1)}px;'
            f'max-width:{round(size * 2.4)}px;border-radius:9999px;object-fit:contain;'
            f'display:block;flex-shrink:0;" />'
        )
    if shape == "squircle":
        return (
            f'<img src="{url}" alt="" style="width:{size}px;height:{size}px;max-width:{size}px;'
            f'min-width:{size}px;border-radius:28%;object-fit:cover;display:block;flex-shrink:0;" />'
        )
    if shape == "arch":
        return (
            f'<img src="{url}" alt="" style="width:{size}px;height:{size}px;max-width:{size}px;'
            f'border-radius:50% 50% 8px 8px;object-fit:cover;display:block;flex-shrink:0;" />'
        )
    if shape == "sharp":
        return (
            f'<img src="{url}" alt="" style="height:{size}px;max-width:{size * 2}px;'
            f'border-radius:0;object-fit:contain;display:block;flex-shrink:0;" />'
        )
    if shape == "square":
        return (
            f'<img src="{url}" alt="" style="width:{size}px;height:{size}px;max-width:{size}px;'
            f'min-width:{size}px;border-radius:4px;object-fit:contain;display:block;flex-shrink:0;" />'
        )
    if shape == "diamond":
        return _logo_clip_wrap(url, size, size, "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)")
    if shape == "hexagon":
        return _logo_clip_wrap(url, size, size, "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)")
    if shape == "shield":
        return _logo_clip_wrap(url, size, round(size * 1.12), "polygon(50% 0%, 92% 12%, 92% 58%, 50% 100%, 8% 58%, 8% 12%)")
    return (
        f'<img src="{url}" alt="" style="height:{size}px;max-width:{size * 2}px;'
        f'border-radius:8px;object-fit:contain;display:block;flex-shrink:0;" />'
    )


def _logo_img(logo_url: str | None, *, size: int = 52, shape: str = "rounded") -> str:
    return _logo_tag(logo_url, size=size, shape=shape)


def _header_mark(
    vendor: str,
    logo_url: str | None,
    show_logo: bool,
    *,
    size: int = 52,
    logo_shape: str = "rounded",
) -> str:
    if show_logo and logo_url:
        return _logo_tag(logo_url, size=size, shape=logo_shape)
    if show_logo:
        return _initials_mark(vendor, size=size)
    return ""


def _base_styles(embed: bool = False) -> str:
    page = """
    background: #fff;
    max-width: 100%;
    margin: 0;
    box-shadow: none;
    border-radius: 0;
    overflow: hidden;
    position: relative;
  """ if embed else """
    background: #fff;
    max-width: 780px;
    margin: 0 auto;
    box-shadow: 0 2px 16px rgba(0,0,0,.08);
    border-radius: 4px;
    position: relative;
  """
    return f"""
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: {'13px' if embed else '14px'};
    color: #1f2937;
    background: {'#fff' if embed else '#f3f4f6'};
    line-height: 1.65;
  }}
  .page {{ {page} }}
  .page-inner {{ position: relative; z-index: 1; }}
  .body-content p {{ margin-bottom: {'10px' if embed else '12px'}; overflow-wrap: break-word; word-break: break-word; }}
  .body-content h1, .body-content h2, .body-content h3 {{ margin: 16px 0 8px; color: #111827; }}
  .body-content table {{
    width: 100%; max-width: 100%; border-collapse: collapse; margin: {'10px' if embed else '12px'} 0;
    font-size: {'12px' if embed else '13px'}; table-layout: fixed;
  }}
  .body-content th, .body-content td {{
    border: 1px solid #e5e7eb; padding: {'6px 8px' if embed else '8px 10px'};
    text-align: left; vertical-align: top; word-break: break-word;
  }}
  .body-content th {{ background: #f8fafc; width: 34%; }}
  .footer-note {{
    margin: 0; padding: {'16px 32px' if embed else '14px 56px 32px'};
    font-size: 10px; color: #9ca3af; text-align: center;
    border-top: 1px solid #e5e7eb; position: relative; z-index: 1;
  }}
  .page + .page {{
    margin-top: 14px;
    border-top: 2px dashed #e5e7eb;
    padding-top: 14px;
  }}
  @media print {{
    body {{ background: #fff; }}
    .page {{ box-shadow: none; margin: 0; page-break-after: always; }}
    .page:last-child {{ page-break-after: auto; }}
  }}
"""


def _is_full_document(body_html: str) -> bool:
    s = (body_html or "").strip().lower()
    return s.startswith("<!doctype") or s.startswith("<html")


def _is_custom_offer_html(body_html: str) -> bool:
    s = (body_html or "").strip()
    return 'data-offer-custom="true"' in s or (
        s.startswith('<div class="page-inner"') and "data-offer-custom" in s
    ) or "data-offer-multi-page" in s


def _is_multi_page_offer_html(body_html: str) -> bool:
    s = (body_html or "").strip()
    return "data-offer-multi-page" in s or OFFER_PAGE_BREAK in s


def _extract_page_inner_divs(html: str) -> list[str]:
    import re

    pattern = re.compile(r'<div\s+class="page-inner"[^>]*>', re.IGNORECASE)
    out: list[str] = []
    for m in pattern.finditer(html):
        start = m.start()
        depth = 0
        i = start
        while i < len(html):
            if html[i : i + 4].lower() == "<div":
                depth += 1
                close = html.find(">", i)
                if close == -1:
                    break
                i = close + 1
            elif html[i : i + 6].lower() == "</div>":
                depth -= 1
                i += 6
                if depth == 0:
                    out.append(html[start:i].strip())
                    break
            else:
                i += 1
    return out


def _parse_offer_page_fragments(body_html: str) -> list[str]:
    s = (body_html or "").strip() or "<p></p>"
    if "data-offer-multi-page" in s or 'data-offer-page="' in s:
        fragments = _extract_page_inner_divs(s)
        if fragments:
            return fragments
    if OFFER_PAGE_BREAK in s:
        parts = [p.strip() for p in s.split(OFFER_PAGE_BREAK) if p.strip()]
        if parts:
            return parts
    return [s]


def _is_custom_page_fragment(fragment: str) -> bool:
    s = fragment.strip()
    return 'data-offer-custom="true"' in s or s.startswith('<div class="page-inner"')


def _build_layout_inner(
    layout: str,
    content: str,
    *,
    vendor: str,
    candidate: str,
    ref: str,
    today: str,
    embed: bool,
    logo_url: str | None = None,
    show_logo: bool = True,
    logo_shape: str = "rounded",
) -> str:
    layout_id = normalize_offer_layout_id(layout)

    def mark_html(size: int = 52) -> str:
        return _header_mark(
            vendor, logo_url, show_logo, size=size, logo_shape=logo_shape,
        )

    ctx = {
        "content": content,
        "vendor": vendor,
        "candidate": candidate,
        "ref": ref,
        "today": today,
        "embed": embed,
        "mark_html": mark_html,
    }
    return render_offer_layout_shell(layout_id, ctx)


def wrap_offer_layout(
    body_html: str,
    layout: str,
    *,
    vendor_name: str,
    candidate_name: str = "",
    ref: str = "",
    today: str = "",
    embed: bool = False,
    watermark_enabled: bool = False,
    watermark_text: str | None = None,
    watermark_opacity: Any = "0.12",
    watermark_style: str = "diagonal_text",
    logo_url: str | None = None,
    show_logo: bool = True,
    logo_shape: str = "rounded",
    accent_color: str = DEFAULT_ACCENT,
) -> str:
    """Wrap fragment body HTML in a print-ready document shell."""
    if _is_full_document(body_html):
        return body_html

    layout = normalize_offer_layout_id(layout or DEFAULT_LAYOUT)
    safe_vendor = escape(vendor_name or "Company")
    safe_candidate = escape(candidate_name or "")
    safe_ref = escape(ref or "")
    safe_today = escape(today or "")
    content = body_html or "<p></p>"

    wm = _watermark_block(
        vendor_name,
        enabled=watermark_enabled,
        text=watermark_text,
        opacity=watermark_opacity,
        style=watermark_style or "diagonal_text",
    )

    fragments = _parse_offer_page_fragments(content)
    multi_page = len(fragments) > 1 or _is_multi_page_offer_html(content)

    if multi_page:
        custom_pages = _is_multi_page_offer_html(content) or all(
            _is_custom_page_fragment(f) for f in fragments
        )
        page_blocks: list[str] = []
        for i, fragment in enumerate(fragments):
            is_last = i == len(fragments) - 1
            if custom_pages or _is_custom_page_fragment(fragment):
                inner = fragment.strip()
                if 'class="page-inner"' not in inner:
                    inner = f'<div class="page-inner" data-offer-page="{i + 1}" data-offer-custom="true">{inner}</div>'
                page_blocks.append(
                    f'<div class="page" data-offer-page="{i + 1}">\n{wm}\n{inner}\n</div>'
                )
            else:
                inner = _build_layout_inner(
                    layout, fragment,
                    vendor=safe_vendor,
                    candidate=safe_candidate,
                    ref=safe_ref,
                    today=safe_today,
                    embed=embed,
                    logo_url=logo_url,
                    show_logo=show_logo,
                    logo_shape=logo_shape,
                )
                footer = ""
                if is_last:
                    footer = f"""
  <div class="footer-note">
    Computer-generated offer letter issued by {safe_vendor}.
  </div>"""
                page_blocks.append(
                    f'<div class="page" data-offer-page="{i + 1}">\n{wm}\n{inner}{footer}\n</div>'
                )
        pages_html = "\n".join(page_blocks)
        return _apply_offer_accent_color(f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Offer Letter{f' — {safe_candidate}' if safe_candidate else ''}</title>
<style>{_base_styles(embed)}</style>
</head>
<body>
{pages_html}
</body>
</html>""", accent_color)

    if _is_custom_offer_html(content):
        inner = content.strip()
        if 'class="page-inner"' not in inner:
            inner = f'<div class="page-inner" data-offer-custom="true">{inner}</div>'
        return _apply_offer_accent_color(f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Offer Letter{f' — {safe_candidate}' if safe_candidate else ''}</title>
<style>{_base_styles(embed)}</style>
</head>
<body>
<div class="page">
{wm}
{inner}
</div>
</body>
</html>""", accent_color)

    inner = _build_layout_inner(
        layout, content,
        vendor=safe_vendor,
        candidate=safe_candidate,
        ref=safe_ref,
        today=safe_today,
        embed=embed,
        logo_url=logo_url,
        show_logo=show_logo,
        logo_shape=logo_shape,
    )
    footer = f"""
  <div class="footer-note">
    Computer-generated offer letter issued by {safe_vendor}.
  </div>"""

    return _apply_offer_accent_color(f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Offer Letter{f' — {safe_candidate}' if safe_candidate else ''}</title>
<style>{_base_styles(embed)}</style>
</head>
<body>
<div class="page">
{wm}
{inner}
{footer}
</div>
</body>
</html>""", accent_color)
