from app.services.invoice_numbering import (
    DEFAULT_PREFIX_BY_TYPE,
    format_invoice_number,
    resolve_number_prefix_suffix,
    resolve_number_prefix_suffix_with_overrides,
)


def test_default_prefix_when_settings_empty():
    prefix, suffix = resolve_number_prefix_suffix({}, "invoice")
    assert prefix == DEFAULT_PREFIX_BY_TYPE["invoice"]
    assert suffix == ""


def test_custom_prefix_and_suffix_from_invoice_settings():
    settings = {
        "invoice_settings": {"number_prefix": "car/ho", "number_suffix": "br01"},
    }
    prefix, suffix = resolve_number_prefix_suffix(settings, "invoice")
    assert prefix == "CAR/HO"
    assert suffix == "br01"


def test_quotation_uses_quotation_settings():
    settings = {"quotation_settings": {"number_prefix": "QT"}}
    prefix, suffix = resolve_number_prefix_suffix(settings, "estimate")
    assert prefix == "QT"
    assert suffix == ""


def test_pos_receipt_overrides_for_receipt_type():
    settings = {
        "invoice_settings": {"number_prefix": "INV"},
        "pos_receipt_settings": {"number_prefix": "POS", "number_suffix": "A"},
    }
    prefix, suffix = resolve_number_prefix_suffix(settings, "receipt")
    assert prefix == "POS"
    assert suffix == "A"


def test_format_invoice_number_with_suffix():
    assert format_invoice_number("INV", "2025-26", 5, "X") == "INV/202526/0005-X"


def test_per_create_overrides_ignore_saved_settings():
    settings = {"invoice_settings": {"number_prefix": "INV", "number_suffix": "A"}}
    prefix, suffix = resolve_number_prefix_suffix_with_overrides(
        settings,
        "invoice",
        prefix_override="BR/01",
        suffix_override="X",
    )
    assert prefix == "BR/01"
    assert suffix == "X"


def test_per_create_override_empty_prefix_uses_saved_settings():
    settings = {"invoice_settings": {"number_prefix": "CUSTOM"}}
    prefix, suffix = resolve_number_prefix_suffix_with_overrides(
        settings, "invoice", prefix_override="", suffix_override=None
    )
    assert prefix == "CUSTOM"
    assert suffix == ""


def test_per_create_override_empty_prefix_without_saved_uses_type_default():
    prefix, suffix = resolve_number_prefix_suffix_with_overrides(
        {}, "invoice", prefix_override="", suffix_override=None
    )
    assert prefix == DEFAULT_PREFIX_BY_TYPE["invoice"]
    assert suffix == ""
