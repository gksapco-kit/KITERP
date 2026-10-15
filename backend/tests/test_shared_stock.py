"""One kilogram balance: a variant sale leaves the remaining weight."""
from decimal import Decimal
from types import SimpleNamespace

from app.services.shared_stock import (
    apply_kg_delta,
    base_per_selling_unit,
    convert_pool_quantity,
    kg_per_selling_unit,
    opening_kg,
    reconcile_stock_mode,
    resolved_base_kg,
    sellable_units,
    shared_pool_unit,
    uses_shared_weight_stock,
)


def _variant(name, uom, uom_quantity, quantity, weight_kg=None):
    return SimpleNamespace(
        name=name, uom=uom, uom_quantity=uom_quantity,
        quantity=quantity, weight_kg=weight_kg, is_active=True,
    )


def test_selling_one_100g_shows_99_9_kg_and_units_left():
    variants = [
        _variant("Per piece", "piece", 1, 0, Decimal("0.05")),
        _variant("Per 100 g", "g", 100, 0),
        _variant("Per kg", "kg", 1, 100),
    ]
    product = SimpleNamespace(shared_stock=None, base_quantity=None)
    assert uses_shared_weight_stock(None, variants) is True
    before = resolved_base_kg(product, variants)
    assert before == Decimal("100.0000")
    gram = kg_per_selling_unit("g", 100, 0)
    after = apply_kg_delta(before, -gram)
    assert after == Decimal("99.9000")
    assert sellable_units(after, gram) == 999
    assert sellable_units(after, Decimal("1")) == 99
    assert sellable_units(after, Decimal("0.05")) == 1998


def test_piece_only_variants_keep_separate_stock():
    variants = [_variant("Small", "piece", 1, 4), _variant("Large", "piece", 1, 6)]
    assert uses_shared_weight_stock(None, variants) is False
    assert opening_kg(variants) == Decimal("0")


def test_product_level_flag_shares_stock_for_piece_variants():
    variants = [_variant("Small", "piece", 1, 4), _variant("Large", "piece", 1, 6)]
    assert uses_shared_weight_stock(True, variants) is True
    assert uses_shared_weight_stock(False, variants) is False
    assert shared_pool_unit(variants) == "unit"
    product = SimpleNamespace(shared_stock=True, base_quantity=None)
    assert resolved_base_kg(product, variants) == Decimal("10.0000")
    assert base_per_selling_unit("unit", "piece", 1, None) == Decimal("1")


def test_product_level_flag_needs_an_active_variant():
    assert uses_shared_weight_stock(True, []) is False


def test_weight_variants_use_a_kilogram_pool():
    variants = [_variant("Per kg", "kg", 1, 5), _variant("Per 100 g", "g", 100, 0)]
    assert shared_pool_unit(variants) == "kg"
    assert base_per_selling_unit("kg", "g", 100, None) == Decimal("0.1000")


def test_switching_to_product_level_seeds_from_variants_or_typed_quantity():
    variants = [_variant("Small", "piece", 1, 4), _variant("Large", "piece", 1, 6)]
    base, qty = reconcile_stock_mode(
        prev_shared=False, now_shared=True, prev_quantity=10, payload_quantity=10,
        stored_base=None, variants=variants,
    )
    assert (base, qty) == (Decimal("10.0000"), 10)
    base, qty = reconcile_stock_mode(
        prev_shared=False, now_shared=True, prev_quantity=10, payload_quantity=25,
        stored_base=None, variants=variants,
    )
    assert (base, qty) == (Decimal("25.0000"), 25)


def test_unchanged_quantity_keeps_stored_balance():
    variants = [_variant("Per kg", "kg", 1, 0)]
    base, qty = reconcile_stock_mode(
        prev_shared=True, now_shared=True, prev_quantity=98, payload_quantity=98,
        stored_base=Decimal("97.9"), variants=variants,
    )
    assert base == Decimal("97.9000")
    assert qty == 98


def test_stock_uom_sets_the_unit_the_pool_is_counted_in():
    variants = [_variant("Per kg", "kg", 1, 0), _variant("Per 100 g", "g", 100, 0)]
    # Balance counted in grams: a 1 kg sale moves 1000 g, a 100 g sale moves 100 g.
    assert shared_pool_unit(variants, "g") == "g"
    assert base_per_selling_unit("g", "kg", 1, None) == Decimal("1000.0000")
    assert base_per_selling_unit("g", "g", 100, None) == Decimal("100.0000")
    # Pieces with a weight convert into the chosen weight unit.
    assert base_per_selling_unit("g", "piece", 1, Decimal("0.05")) == Decimal("50.0000")
    # Without a stock UOM the pool falls back to kg for weight variants.
    assert shared_pool_unit(variants) == "kg"


def test_volume_pool_converts_litres_and_millilitres():
    assert base_per_selling_unit("ml", "l", 1, None) == Decimal("1000.0000")
    assert base_per_selling_unit("l", "ml", 500, None) == Decimal("0.5000")
    assert base_per_selling_unit("l", "piece", 1, Decimal("1")) == Decimal("0")


def test_count_pool_moves_one_per_sale():
    assert base_per_selling_unit("piece", "pack", 6, None) == Decimal("1")
    assert base_per_selling_unit("unit", "piece", 1, None) == Decimal("1")


def test_changing_stock_uom_converts_the_stored_balance():
    assert convert_pool_quantity(Decimal("2.5"), "kg", "g") == Decimal("2500.0000")
    assert convert_pool_quantity(Decimal("1500"), "ml", "l") == Decimal("1.5000")
    assert convert_pool_quantity(Decimal("7"), "kg", "piece") == Decimal("7")
    variants = [_variant("Per kg", "kg", 1, 0)]
    base, qty = reconcile_stock_mode(
        prev_shared=True, now_shared=True, prev_quantity=3, payload_quantity=3,
        stored_base=Decimal("2.5"), variants=variants, prev_pool="kg", pool="g",
    )
    assert base == Decimal("2500.0000")
    assert qty == 2500


def test_switching_to_variant_level_clears_balance_and_sums_variants():
    variants = [_variant("Small", "piece", 1, 4), _variant("Large", "piece", 1, 6)]
    base, qty = reconcile_stock_mode(
        prev_shared=True, now_shared=False, prev_quantity=40, payload_quantity=40,
        stored_base=Decimal("40"), variants=variants,
    )
    assert base is None
    assert qty == 10
