"""Read and write the product import workbook and its image zip."""
from __future__ import annotations

import csv
import io
import re
import zipfile
from xml.etree import ElementTree as ET

SHEET_COLUMNS = [
    "name",
    "sku",
    "material_code",
    "barcode",
    "brand",
    "category",
    "product_type",
    "price",
    "quantity",
    "status",
    "visibility",
    "image_path",
]

EXAMPLE_NAME = "(example) Chekkalu - Andu Korrulu"

_HEADER_ALIASES = {
    "name": "name",
    "product_name": "name",
    "product": "name",
    "sku": "sku",
    "material_code": "material_code",
    "materialcode": "material_code",
    "barcode": "barcode",
    "brand": "brand",
    "category": "category",
    "product_type": "product_type",
    "type": "product_type",
    "price": "price",
    "quantity": "quantity",
    "stock": "quantity",
    "status": "status",
    "visibility": "visibility",
    "image_path": "image_path",
    "image": "image_path",
    "image_url": "image_path",
    "images": "image_path",
}

_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
_MAX_IMAGE_BYTES = 5 * 1024 * 1024


def is_example_name(name: str) -> bool:
    return (name or "").strip().lower().startswith("(example)")


def build_xlsx(rows: list[dict[str, str]]) -> bytes:
    """Build a single-sheet workbook. Every cell is an inline string."""
    sheet_rows = [_xml_row(SHEET_COLUMNS)]
    for row in rows:
        sheet_rows.append(_xml_row([str(row.get(col, "") or "") for col in SHEET_COLUMNS]))

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
        '<sheets><sheet name="Products" sheetId="1" r:id="rId1"/></sheets>'
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


def template_rows() -> list[dict[str, str]]:
    return [{
        "name": EXAMPLE_NAME,
        "sku": "CK-ANDU",
        "material_code": "",
        "barcode": "",
        "brand": "",
        "category": "Special order",
        "product_type": "physical",
        "price": "480",
        "quantity": "100",
        "status": "",
        "visibility": "hidden",
        "image_path": "images/chekkalu-andu.jpg",
    }]


def build_export_zip(rows: list[dict[str, str]], images: dict[str, bytes]) -> bytes:
    """Zip products.xlsx plus the images folder. Paths in the sheet are relative."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("products.xlsx", build_xlsx(rows))
        zf.writestr("images/", "")
        for path, body in images.items():
            safe = _safe_zip_path(path)
            if safe:
                zf.writestr(safe, body)
    return buf.getvalue()


def read_upload(filename: str, data: bytes) -> tuple[list[dict], dict[str, bytes]]:
    """Return (sheet rows, image files keyed by lower-case zip path).

    Accepts an .xlsx file, a .csv file, or a zip that contains the sheet and an images folder.
    """
    if not data:
        raise ValueError("The file is empty.")
    name = (filename or "").lower()
    if data[:2] == b"PK":
        return _read_zip(data)
    if name.endswith(".csv") or _looks_like_csv(data):
        return _rows_with_numbers(_read_csv(data)), {}
    raise ValueError("Upload an .xlsx file, a .csv file, or a .zip that contains the sheet and images.")


def split_image_paths(value: str) -> list[str]:
    parts = re.split(r"[|\n]", value or "")
    return [p.strip().replace("\\", "/") for p in parts if p.strip()]


def sniff_image(body: bytes) -> str:
    """Return a file extension when the bytes are a supported image, else ''."""
    if not body or len(body) < 4 or len(body) > _MAX_IMAGE_BYTES:
        return ""
    if body[:2] == b"\xff\xd8":
        return ".jpg"
    if body[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png"
    if body[:3] == b"GIF":
        return ".gif"
    if body[:4] == b"RIFF" and len(body) >= 12 and body[8:12] == b"WEBP":
        return ".webp"
    return ""


def _read_zip(data: bytes) -> tuple[list[dict], dict[str, bytes]]:
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise ValueError("The file is not a valid Excel workbook or zip.") from exc
    with zf:
        names = [info.filename.replace("\\", "/") for info in zf.infolist()]
        if "xl/workbook.xml" in names:
            return _rows_with_numbers(_read_xlsx_zip(zf)), {}
        sheet_name = _find_sheet_member(names)
        if not sheet_name:
            raise ValueError("The zip needs a products.xlsx or products.csv file.")
        raw = zf.read(sheet_name)
        if sheet_name.lower().endswith(".csv"):
            rows = _read_csv(raw)
        else:
            rows = _read_xlsx_bytes(raw)
        images = _zip_images(zf)
        return _rows_with_numbers(rows), images


def _find_sheet_member(names: list[str]) -> str:
    candidates = []
    for name in names:
        lower = name.lower()
        if lower.startswith("__macosx/") or lower.endswith("/"):
            continue
        if lower.endswith(".xlsx") or lower.endswith(".csv"):
            candidates.append(name)
    for preferred in ("products.xlsx", "products.csv"):
        for name in candidates:
            if name.lower().endswith(preferred) or name.lower().split("/")[-1] == preferred:
                return name
    return candidates[0] if candidates else ""


def _zip_images(zf: zipfile.ZipFile) -> dict[str, bytes]:
    images: dict[str, bytes] = {}
    for info in zf.infolist():
        if info.is_dir():
            continue
        path = _safe_zip_path(info.filename)
        if not path:
            continue
        ext = _extension(path)
        if ext not in _IMAGE_EXTENSIONS:
            continue
        if info.file_size > _MAX_IMAGE_BYTES:
            continue
        images[path.lower()] = zf.read(info)
    return images


def _safe_zip_path(name: str) -> str:
    path = (name or "").replace("\\", "/").lstrip("/")
    parts = [p for p in path.split("/") if p not in ("", ".")]
    if not parts or any(p == ".." for p in parts):
        return ""
    if parts[0] == "__MACOSX":
        return ""
    return "/".join(parts)


def _rows_with_numbers(rows: list[dict[str, str]]) -> list[dict]:
    numbered = []
    for index, row in enumerate(rows, start=2):
        item = dict(row)
        item["_row"] = index
        numbered.append(item)
    return numbered


def _read_xlsx_bytes(data: bytes) -> list[dict[str, str]]:
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        return _read_xlsx_zip(zf)


def _read_xlsx_zip(zf: zipfile.ZipFile) -> list[dict[str, str]]:
    shared = _shared_strings(zf)
    sheet_name = "xl/worksheets/sheet1.xml"
    if sheet_name not in zf.namelist():
        sheets = [n for n in zf.namelist() if n.startswith("xl/worksheets/sheet") and n.endswith(".xml")]
        if not sheets:
            raise ValueError("The workbook has no worksheet.")
        sheet_name = sorted(sheets)[0]
    root = ET.fromstring(zf.read(sheet_name))
    table: list[list[str]] = []
    for row_el in root.iter():
        if _local(row_el.tag) != "row":
            continue
        cells: dict[int, str] = {}
        next_index = 0
        for cell in list(row_el):
            if _local(cell.tag) != "c":
                continue
            ref = cell.attrib.get("r") or ""
            index = _col_index(ref) if ref else next_index
            cells[index] = _cell_text(cell, shared)
            next_index = index + 1
        if not cells:
            table.append([])
            continue
        width = max(cells) + 1
        table.append([cells.get(i, "") for i in range(width)])
    return _table_to_rows(table)


def _shared_strings(zf: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    values: list[str] = []
    for si in root.iter():
        if _local(si.tag) != "si":
            continue
        texts = [node.text or "" for node in si.iter() if _local(node.tag) == "t"]
        values.append("".join(texts))
    return values


def _cell_text(cell: ET.Element, shared: list[str]) -> str:
    kind = cell.attrib.get("t") or ""
    if kind == "inlineStr":
        texts = [node.text or "" for node in cell.iter() if _local(node.tag) == "t"]
        return "".join(texts).strip()
    value_node = next((node for node in cell.iter() if _local(node.tag) == "v"), None)
    raw = (value_node.text or "") if value_node is not None else ""
    if kind == "s":
        try:
            return shared[int(raw)].strip()
        except (ValueError, IndexError):
            return ""
    return raw.strip()


def _read_csv(data: bytes) -> list[dict[str, str]]:
    text = data.decode("utf-8-sig", errors="replace")
    reader = csv.reader(io.StringIO(text))
    return _table_to_rows(list(reader))


def _table_to_rows(table: list[list[str]]) -> list[dict[str, str]]:
    if not table:
        raise ValueError("The sheet is empty.")
    header_map: dict[int, str] = {}
    for index, header in enumerate(table[0]):
        key = _HEADER_ALIASES.get(_norm_header(header))
        if key and key not in header_map.values():
            header_map[index] = key
    if "name" not in header_map.values():
        raise ValueError("The sheet needs a name column.")
    rows: list[dict[str, str]] = []
    for raw in table[1:]:
        item = {col: "" for col in SHEET_COLUMNS}
        for index, key in header_map.items():
            if index < len(raw):
                item[key] = str(raw[index] or "").strip()
        if not any(item.values()):
            continue
        rows.append(item)
    return rows


def _norm_header(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (value or "").strip().lower()).strip("_")


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _col_index(ref: str) -> int:
    letters = "".join(ch for ch in ref if ch.isalpha())
    number = 0
    for ch in letters:
        number = number * 26 + (ord(ch.upper()) - 64)
    return max(number - 1, 0)


def _extension(path: str) -> str:
    lower = path.lower()
    dot = lower.rfind(".")
    return lower[dot:] if dot >= 0 else ""


def _looks_like_csv(data: bytes) -> bool:
    sample = data[:200].decode("utf-8-sig", errors="ignore").lstrip().lower()
    return sample.startswith("name,") or sample.startswith("name\t")


def _xml_row(values: list[str]) -> str:
    cells = "".join(
        f'<c t="inlineStr"><is><t>{_xlsx_escape(value)}</t></is></c>' for value in values
    )
    return f"<row>{cells}</row>"


def _xlsx_escape(value: str) -> str:
    cleaned = "".join(ch for ch in (value or "") if ch == "\t" or ord(ch) >= 32)
    return cleaned.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
