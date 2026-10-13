"""Sheet round-trip and import status rules. No database."""
import io
import zipfile

from app.services.product_import_export import resolve_import_status, resolve_visibility
from app.services.product_sheet import (
    build_export_zip,
    build_xlsx,
    is_example_name,
    read_upload,
    template_rows,
)


def test_xlsx_round_trip_keeps_columns():
    payload = build_xlsx([{
        "name": "Chekkalu - Andu Korrulu",
        "sku": "CK-ANDU",
        "material_code": "MAT-00001",
        "barcode": "",
        "brand": "Dharma",
        "category": "Special order",
        "product_type": "physical",
        "price": "480",
        "quantity": "100",
        "status": "draft",
        "visibility": "hidden",
        "image_path": "images/chekkalu-andu.jpg",
    }])
    rows, images = read_upload("products.xlsx", payload)
    assert images == {}
    assert rows[0]["name"] == "Chekkalu - Andu Korrulu"
    assert rows[0]["sku"] == "CK-ANDU"
    assert rows[0]["image_path"] == "images/chekkalu-andu.jpg"
    assert rows[0]["price"] == "480"
    assert rows[0]["_row"] == 2


def test_zip_template_includes_example_and_images_folder():
    payload = build_export_zip(template_rows(), {})
    rows, images = read_upload("product-import-template.zip", payload)
    assert images == {}
    assert is_example_name(rows[0]["name"])
    assert rows[0]["image_path"] == "images/chekkalu-andu.jpg"
    with zipfile.ZipFile(io.BytesIO(payload)) as zf:
        assert "products.xlsx" in zf.namelist()
        assert "images/" in zf.namelist()


def test_zip_image_is_matched_by_path():
    png = b"\x89PNG\r\n\x1a\n" + b"x" * 16
    payload = build_export_zip(
        [{
            "name": "Arikelu",
            "sku": "CK-ARIK",
            "material_code": "",
            "barcode": "",
            "brand": "",
            "category": "",
            "product_type": "physical",
            "price": "10",
            "quantity": "1",
            "status": "",
            "visibility": "hidden",
            "image_path": "images/arikelu.png",
        }],
        {"images/arikelu.png": png},
    )
    rows, images = read_upload("products.zip", payload)
    assert rows[0]["name"] == "Arikelu"
    assert images["images/arikelu.png"] == png


def test_shared_string_workbook():
    sheet = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<sheetData>'
        '<row r="1">'
        '<c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c>'
        '</row>'
        '<row r="2">'
        '<c r="A2" t="s"><v>3</v></c><c r="B2"><v>480</v></c><c r="C2" t="s"><v>4</v></c>'
        '</row>'
        '</sheetData></worksheet>'
    )
    shared = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<si><t>name</t></si><si><t>price</t></si><si><t>status</t></si>'
        '<si><t>Korrulu</t></si><si><t></t></si>'
        '</sst>'
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("xl/workbook.xml", "<workbook/>")
        zf.writestr("xl/sharedStrings.xml", shared)
        zf.writestr("xl/worksheets/sheet1.xml", sheet)
    rows, _images = read_upload("edited.xlsx", buf.getvalue())
    assert rows[0]["name"] == "Korrulu"
    assert rows[0]["price"] == "480"
    assert rows[0]["status"] == ""


def test_variant_rows_round_trip_and_group_by_product_name():
    from app.services.product_import_export import ImportSummary, _group_product_rows

    payload = build_xlsx([
        {
            "name": "Garlic Mixture",
            "variant": "250 g",
            "sku": "GM-250",
            "material_code": "",
            "barcode": "",
            "brand": "Sri Sai",
            "category": "Snacks",
            "product_type": "physical",
            "price": "300",
            "quantity": "100",
            "status": "active",
            "visibility": "visible",
            "image_path": "images/garlic.jpg",
        },
        {
            "name": "Garlic Mixture",
            "variant": "500 g",
            "sku": "GM-500",
            "material_code": "",
            "barcode": "",
            "brand": "",
            "category": "",
            "product_type": "",
            "price": "500",
            "quantity": "199",
            "status": "",
            "visibility": "",
            "image_path": "",
        },
    ])
    rows, _images = read_upload("products.xlsx", payload)
    assert rows[0]["variant"] == "250 g"
    assert rows[1]["variant"] == "500 g"
    assert rows[1]["price"] == "500"
    summary = ImportSummary()
    groups = _group_product_rows(rows, summary)
    assert len(groups) == 1
    assert [row["sku"] for row in groups[0]] == ["GM-250", "GM-500"]


def test_blank_status_follows_the_image():
    assert resolve_import_status("", image_saved=True, image_failed=False) == ("active", None)
    assert resolve_import_status("", image_saved=False, image_failed=False) == ("draft", None)
    assert resolve_import_status("", image_saved=False, image_failed=True) == ("draft", None)


def test_typed_active_without_a_loaded_image_becomes_draft():
    status, note = resolve_import_status("active", image_saved=False, image_failed=True)
    assert status == "draft"
    assert note
    assert resolve_import_status("Active", image_saved=True, image_failed=False) == ("active", None)
    assert resolve_import_status("draft", image_saved=True, image_failed=False) == ("draft", None)


def test_visibility_defaults_to_hidden():
    assert resolve_visibility("") is False
    assert resolve_visibility("hidden") is False
    assert resolve_visibility("Visible") is True
