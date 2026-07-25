"""Build in-app previews for Careers CV attachments (.doc / .docx)."""
from __future__ import annotations

import asyncio
import html
import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from app.services.ole_doc_text import extract_ole_doc_text

logger = logging.getLogger(__name__)

_SCRIPTS_DIR = Path(__file__).resolve().parents[2] / "scripts"
_SCRIPT = _SCRIPTS_DIR / "extract_word_text.js"

_OLE_JUNK_MARKERS = (
    "root entry",
    "summaryinformation",
    "documentsummaryinformation",
    "msip_label_",
)


@dataclass
class WordPreview:
    content: bytes
    media_type: str  # text/html or application/pdf
    mode: str


def _is_docx_bytes(data: bytes) -> bool:
    return len(data) >= 4 and data[:2] == b"PK"


def _is_ole_doc_bytes(data: bytes) -> bool:
    return len(data) >= 8 and data[:4] == b"\xd0\xcf\x11\xe0"


def _looks_like_ole_junk(text: str) -> bool:
    lower = (text or "").lower()
    if not lower.strip():
        return True
    hits = sum(1 for m in _OLE_JUNK_MARKERS if m in lower)
    if hits >= 2:
        return True
    if "worddocument" in lower and "summaryinformation" in lower:
        return True
    weird = sum(1 for ch in text if ord(ch) > 0x3000)
    if weird > 40 and weird > len(text) * 0.15:
        return True
    return False


def _text_to_html(title: str, body: str) -> str:
    safe_title = html.escape(title or "Document")
    # Preserve paragraphs for readability
    paras = [p.strip() for p in (body or "").replace("\r\n", "\n").split("\n") if p.strip()]
    if not paras:
        safe_body = "<p><em>No readable text found in this document.</em></p>"
    else:
        safe_body = "".join(f"<p>{html.escape(p)}</p>" for p in paras)
    return (
        "<!DOCTYPE html><html><head><meta charset='utf-8'>"
        f"<title>{safe_title}</title>"
        "<style>"
        "body{font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;"
        "margin:1.25rem;color:#111827;line-height:1.55;font-size:14px;max-width:48rem;}"
        "h1{font-size:15px;margin:0 0 1rem;color:#6b7280;font-weight:600;}"
        "p{margin:0 0 0.7rem;}"
        "</style></head><body>"
        f"<h1>{safe_title}</h1>"
        f"{safe_body}"
        "</body></html>"
    )


def _wrap_fragment_html(fragment: str) -> str:
    return (
        "<!DOCTYPE html><html><head><meta charset='utf-8'>"
        "<style>"
        "body{font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;"
        "margin:1.25rem;color:#111827;line-height:1.55;font-size:14px;}"
        "p{margin:0 0 0.65rem;} table{border-collapse:collapse;width:100%;}"
        "td,th{border:1px solid #e5e7eb;padding:0.35rem 0.5rem;}"
        "img{max-width:100%;height:auto;}"
        "</style></head><body>"
        f"{fragment}"
        "</body></html>"
    )


def _mammoth_docx_html(data: bytes) -> Optional[str]:
    try:
        import mammoth
    except ImportError:
        logger.warning("mammoth not installed; skipping docx HTML conversion")
        return None
    try:
        from io import BytesIO

        result = mammoth.convert_to_html(BytesIO(data))
        html_body = (result.value or "").strip()
        if not html_body:
            return None
        return _wrap_fragment_html(html_body)
    except Exception:
        logger.exception("mammoth conversion failed")
        return None


def _extract_via_node(path: Path) -> Optional[str]:
    if not _SCRIPT.is_file():
        return None
    node = shutil.which("node")
    if not node and sys.platform == "win32":
        for candidate in (
            r"D:\Program Files\nodejs\node.exe",
            r"C:\Program Files\nodejs\node.exe",
        ):
            if Path(candidate).is_file():
                node = candidate
                break
    if not node:
        return None
    try:
        proc = subprocess.run(
            [node, str(_SCRIPT), str(path)],
            capture_output=True,
            text=True,
            timeout=45,
            check=False,
            cwd=str(_SCRIPTS_DIR),
        )
    except Exception:
        logger.exception("node word extract failed")
        return None
    if proc.returncode != 0:
        logger.warning("word extract script failed: %s", (proc.stderr or "")[:500])
        return None
    try:
        payload = json.loads(proc.stdout or "{}")
    except json.JSONDecodeError:
        return None
    body = (payload.get("body") or "").strip()
    if not body or _looks_like_ole_junk(body):
        return None
    return body


def _read_text_file(path: Path) -> Optional[str]:
    for enc in ("utf-8", "utf-8-sig", "cp1252", "latin-1"):
        try:
            text = path.read_text(encoding=enc)
            if text and len(text.strip()) > 20:
                return text
        except Exception:
            continue
    return None


def _convert_via_office_com(path: Path) -> Optional[WordPreview]:
    if sys.platform != "win32":
        return None

    out_pdf = path.with_suffix(".preview.pdf")
    out_html = path.with_suffix(".preview.html")
    src = str(path).replace("'", "''")
    pdf = str(out_pdf).replace("'", "''")
    html_out = str(out_html).replace("'", "''")

    ps = f"""
$ErrorActionPreference = 'Stop'
$src = '{src}'
$pdf = '{pdf}'
$html = '{html_out}'

function Save-Doc($doc, $target, $format) {{
  try {{ $doc.SaveAs2([string]$target, [ref]$format) | Out-Null; return }} catch {{}}
  try {{ $doc.SaveAs([string]$target, $format) | Out-Null; return }} catch {{}}
  $doc.SaveAs([ref]([string]$target), [ref]$format) | Out-Null
}}

function Convert-WithApp($progId) {{
  $app = New-Object -ComObject $progId
  try {{
    try {{ $app.Visible = $false }} catch {{}}
    try {{ $app.DisplayAlerts = 0 }} catch {{}}
    $doc = $app.Documents.Open($src, $false, $true)
    try {{
      Save-Doc $doc $pdf 17
      if (Test-Path -LiteralPath $pdf) {{ return 'pdf' }}
      Save-Doc $doc $html 10
      if (Test-Path -LiteralPath $html) {{ return 'html' }}
      throw 'SaveAs produced no output'
    }} finally {{ $doc.Close($false) }}
  }} finally {{
    try {{ $app.Quit() }} catch {{}}
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
  }}
}}

foreach ($id in @('Word.Application', 'KWPS.Application', 'WPS.Application', 'Ket.Application')) {{
  try {{
    $result = Convert-WithApp $id
    if ($result) {{ Write-Output $result; exit 0 }}
  }} catch {{ }}
}}
throw 'No Office automation host could convert the document'
"""
    try:
        proc = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                ps,
            ],
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
    except Exception:
        logger.exception("Office COM conversion failed")
        return None

    kind = (proc.stdout or "").strip().lower()
    if proc.returncode != 0:
        for p in (out_pdf, out_html):
            try:
                p.unlink(missing_ok=True)
            except OSError:
                pass
        return None

    try:
        if kind == "pdf" and out_pdf.is_file() and out_pdf.stat().st_size > 100:
            return WordPreview(out_pdf.read_bytes(), "application/pdf", "office-pdf")
        if out_html.is_file():
            html_doc = _read_text_file(out_html)
            if html_doc and not _looks_like_ole_junk(html_doc):
                return WordPreview(html_doc.encode("utf-8"), "text/html; charset=utf-8", "office-html")
    finally:
        for p in (out_pdf, out_html):
            try:
                p.unlink(missing_ok=True)
            except OSError:
                pass
        assets = path.with_name(path.stem + ".preview_files")
        if assets.is_dir():
            shutil.rmtree(assets, ignore_errors=True)
    return None


async def build_word_preview(filename: str, data: bytes) -> WordPreview:
    """
    Build a browser-viewable preview for a Word CV.
    Works without Microsoft Word installed (text/HTML via mammoth / OLE parser / node).
    """
    name = (filename or "document").strip() or "document"
    lower = name.lower()

    # 1) Modern .docx — rich HTML via mammoth (no Office needed)
    if _is_docx_bytes(data) or lower.endswith(".docx"):
        html_doc = await asyncio.to_thread(_mammoth_docx_html, data)
        if html_doc:
            return WordPreview(html_doc.encode("utf-8"), "text/html; charset=utf-8", "mammoth")

    # 2) Legacy .doc — pure Python piece-table extract (no Office needed)
    if _is_ole_doc_bytes(data) or lower.endswith(".doc"):
        text = await asyncio.to_thread(extract_ole_doc_text, data)
        if text and not _looks_like_ole_junk(text) and len(text.strip()) >= 8:
            return WordPreview(
                _text_to_html(name, text).encode("utf-8"),
                "text/html; charset=utf-8",
                "ole-text",
            )

    suffix = ".docx" if _is_docx_bytes(data) or lower.endswith(".docx") else ".doc"
    tmp_path: Optional[Path] = None
    try:
        fd, tmp = tempfile.mkstemp(prefix="kiterp-cv-", suffix=suffix)
        os.close(fd)
        tmp_path = Path(tmp)
        tmp_path.write_bytes(data)

        # 3) node word-extractor (also no Office)
        text = await asyncio.to_thread(_extract_via_node, tmp_path)
        if text and not _looks_like_ole_junk(text):
            return WordPreview(
                _text_to_html(name, text).encode("utf-8"),
                "text/html; charset=utf-8",
                "node",
            )

        # 4) Optional richer layout if Word/WPS happens to be installed
        preview = await asyncio.to_thread(_convert_via_office_com, tmp_path)
        if preview:
            return preview
    finally:
        if tmp_path is not None:
            try:
                tmp_path.unlink(missing_ok=True)
            except OSError:
                pass

    raise ValueError(
        "Could not read text from this Word document. "
        "Please ask the applicant to re-upload the CV as PDF or .docx."
    )


async def build_word_preview_html(filename: str, data: bytes):
    preview = await build_word_preview(filename, data)
    if not preview.media_type.startswith("text/html"):
        raise ValueError("Preview is not HTML")
    return preview.content.decode("utf-8"), preview.mode
