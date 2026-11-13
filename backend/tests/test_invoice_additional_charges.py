from app.services.invoice_service import (
    _normalize_invoice_additional_charges,
    _additional_charges_as_items,
)


def test_normalize_invoice_additional_charges_skips_invalid():
    assert _normalize_invoice_additional_charges(None) == []
    assert _normalize_invoice_additional_charges([{"name": "", "amount": 10}]) == []
    assert _normalize_invoice_additional_charges([{"name": "Freight", "amount": 0}]) == []


def test_normalize_invoice_additional_charges_keeps_valid():
    rows = _normalize_invoice_additional_charges([
        {"name": "Freight", "amount": 500, "tax_rate": 18},
    ])
    assert len(rows) == 1
    assert rows[0]["name"] == "Freight"
    assert rows[0]["amount"] == 500
    assert rows[0]["tax_rate"] == 18


def test_additional_charges_as_items():
    items = _additional_charges_as_items([{"name": "Packing", "amount": 100, "tax_rate": 12}])
    assert items == [{
        "name": "Packing",
        "qty": 1,
        "rate": 100,
        "discount": 0,
        "tax_rate": 12,
    }]
