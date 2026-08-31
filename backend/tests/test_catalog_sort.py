"""Catalog list sort clause helpers."""
from app.repositories.product_repo import _product_sort_clauses
from app.repositories.service_repo import _service_sort_clauses


def test_product_sort_clauses_cover_refine_options():
    for key in (None, "default", "price_low", "price_high", "newest", "rating", "name"):
        clauses = _product_sort_clauses(key)
        assert clauses
        assert all(c is not None for c in clauses)


def test_service_sort_clauses_cover_refine_options():
    for key in (None, "default", "price_low", "price_high", "newest", "rating"):
        clauses = _service_sort_clauses(key)
        assert clauses
        assert all(c is not None for c in clauses)
