"""One stock balance shared by every selling unit (variant) of a product.

A purchase or sale of any variant changes that single balance. The balance is counted
in the product's stock UOM (kg, g, litre, piece, …). Inventory shows what is left, and
how many of each variant that balance can still fill.

When no stock UOM is chosen the balance is counted in kilograms if any variant is sold
by weight, otherwise in plain units.
"""
from __future__ import annotations

from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP
from typing import Any, Iterable

_Q = Decimal("0.0001")

# How many kilograms one of this unit is.
_WEIGHT_PER_KG = {
    "kg": Decimal("1"),
    "kilogram": Decimal("1"),
    "g": Decimal("0.001"),
    "gram": Decimal("0.001"),
    "grams": Decimal("0.001"),
    "mg": Decimal("0.000001"),
    "milligram": Decimal("0.000001"),
    "mcg": Decimal("0.000000001"),
    "tonne": Decimal("1000"),
    "quintal": Decimal("100"),
    "oz": Decimal("0.0283495"),
    "lb": Decimal("0.453592"),
}

# How many litres one of this unit is.
_VOLUME_PER_L = {
    "l": Decimal("1"),
    "litre": Decimal("1"),
    "liter": Decimal("1"),
    "kl": Decimal("1000"),
    "dl": Decimal("0.1"),
    "cl": Decimal("0.01"),
    "ml": Decimal("0.001"),
    "mcl": Decimal("0.000001"),
    "cubic_cm": Decimal("0.001"),
    "cubic_m": Decimal("1000"),
    "fl_oz": Decimal("0.0295735"),
    "pt": Decimal("0.473176"),
    "qt": Decimal("0.946353"),
    "gal": Decimal("3.78541"),
}


def normalize_uom(uom: str | None) -> str:
    return (uom or "").lower().strip().replace(" ", "_")


def uom_dimension(uom: str | None) -> str:
    """"weight", "volume" or "count" (anything that is not a convertible measure)."""
    key = normalize_uom(uom)
    if key in _WEIGHT_PER_KG:
        return "weight"
    if key in _VOLUME_PER_L:
        return "volume"
    return "count"


def pool_label(pool: str | None) -> str:
    """Name shown in messages: the UOM itself, or "units" for the plain-unit pool."""
    return "units" if not pool or pool == "unit" else pool


def _dec(value: Any, default: Decimal = Decimal("0")) -> Decimal:
    if value is None or value == "":
        return default
    try:
        return Decimal(str(value))
    except Exception:
        return default


def kg_per_selling_unit(uom: str | None, uom_quantity: Any, weight_kg: Any) -> Decimal:
    """Kilograms one sale or purchase of this variant adds or removes.

    Weight units use Qty + UOM (100 g = 0.1 kg, 1 kg = 1 kg).
    Piece, pack, and other counts use Weight (kg).
    """
    factor = _WEIGHT_PER_KG.get(normalize_uom(uom))
    if factor is not None:
        pack = _dec(uom_quantity, Decimal("1"))
        if pack <= 0:
            pack = Decimal("1")
        return (pack * factor).quantize(_Q, rounding=ROUND_HALF_UP)
    weight = _dec(weight_kg, Decimal("0"))
    if weight > 0:
        return weight.quantize(_Q, rounding=ROUND_HALF_UP)
    return Decimal("0")


def uses_shared_weight_stock(shared_stock_flag: bool | None, variants: Iterable[Any]) -> bool:
    """True when every variant draws from one stock balance.

    False forces a separate count per variant. True forces one balance
    (product-level stock), as long as the product has at least one active variant.
    None turns the balance on when the product has two or more selling units
    and at least two different units, one of them a weight (kg, g, …).
    """
    if shared_stock_flag is False:
        return False
    active = [v for v in variants if getattr(v, "is_active", True) is not False]
    if shared_stock_flag is True:
        return bool(active)
    if len(active) < 2:
        return False
    uoms = {normalize_uom(getattr(v, "uom", None)) for v in active}
    return bool(uoms & set(_WEIGHT_PER_KG)) and len(uoms) >= 2


def shared_pool_unit(variants: Iterable[Any], stock_uom: str | None = None) -> str:
    """UOM the shared balance is counted in.

    The product's stock UOM when one is chosen. Otherwise "kg" when any active variant
    is sold by weight, else "unit" (pieces, packs, sizes … each sale removes its quantity).
    """
    explicit = normalize_uom(stock_uom)
    if explicit:
        return explicit
    for variant in variants:
        if getattr(variant, "is_active", True) is False:
            continue
        if normalize_uom(getattr(variant, "uom", None)) in _WEIGHT_PER_KG:
            return "kg"
    return "unit"


def base_per_selling_unit(pool: str, uom: str | None, uom_quantity: Any, weight_kg: Any) -> Decimal:
    """How much of the shared balance one sale or purchase of this selling unit moves.

    Weight pool  : the variant's weight, converted into the pool's unit.
    Volume pool  : the variant's volume (Qty + UOM), converted into the pool's unit.
    Anything else: one per sale (pieces, packs, sizes …).
    A result of 0 means the variant cannot be converted (e.g. a piece variant with no weight).
    """
    key = normalize_uom(pool)
    dim = uom_dimension(key)
    if dim == "weight":
        kg = kg_per_selling_unit(uom, uom_quantity, weight_kg)
        return (kg / _WEIGHT_PER_KG[key]).quantize(_Q, rounding=ROUND_HALF_UP)
    if dim == "volume":
        variant_uom = normalize_uom(uom)
        if variant_uom not in _VOLUME_PER_L:
            return Decimal("0")
        pack = _dec(uom_quantity, Decimal("1"))
        if pack <= 0:
            pack = Decimal("1")
        litres = pack * _VOLUME_PER_L[variant_uom]
        return (litres / _VOLUME_PER_L[key]).quantize(_Q, rounding=ROUND_HALF_UP)
    return Decimal("1")


def convert_pool_quantity(value: Any, from_pool: str | None, to_pool: str | None) -> Decimal:
    """Re-express a stored balance when the stock UOM changes (kg -> g, l -> ml …).

    Units that cannot be converted into each other keep the same number.
    """
    qty = _dec(value)
    src, dst = normalize_uom(from_pool), normalize_uom(to_pool)
    if not src or not dst or src == dst:
        return qty
    dim = uom_dimension(src)
    if dim != uom_dimension(dst) or dim == "count":
        return qty
    table = _WEIGHT_PER_KG if dim == "weight" else _VOLUME_PER_L
    return (qty * table[src] / table[dst]).quantize(_Q, rounding=ROUND_HALF_UP)


def opening_kg(variants: Iterable[Any]) -> Decimal:
    """Largest variant on-hand, converted to kilograms.

    Per kg × 100 and Per 100 g × 0 is 100 kg, not the sum of the rows.
    """
    best = Decimal("0")
    for variant in variants:
        if getattr(variant, "is_active", True) is False:
            continue
        per = kg_per_selling_unit(
            getattr(variant, "uom", None),
            getattr(variant, "uom_quantity", None),
            getattr(variant, "weight_kg", None),
        )
        held = per * _dec(getattr(variant, "quantity", 0))
        if held > best:
            best = held
    return best.quantize(_Q, rounding=ROUND_HALF_UP)


def opening_units(variants: Iterable[Any]) -> Decimal:
    """Count pool opening balance: the on-hand of every active variant added together."""
    total = Decimal("0")
    for variant in variants:
        if getattr(variant, "is_active", True) is False:
            continue
        total += _dec(getattr(variant, "quantity", 0))
    return total.quantize(_Q, rounding=ROUND_HALF_UP)


def opening_base(variants: Iterable[Any], pool: str | None = None) -> Decimal:
    """Opening balance in the pool's unit.

    Weight / volume pools: variants are the same stock in different packs, so the largest
    one wins. Count pools: the variants are separate stock, so they are added together.
    """
    variant_list = list(variants)
    pool = normalize_uom(pool) or shared_pool_unit(variant_list)
    if uom_dimension(pool) == "count":
        return opening_units(variant_list)
    best = Decimal("0")
    for variant in variant_list:
        if getattr(variant, "is_active", True) is False:
            continue
        per = base_per_selling_unit(
            pool,
            getattr(variant, "uom", None),
            getattr(variant, "uom_quantity", None),
            getattr(variant, "weight_kg", None),
        )
        held = per * _dec(getattr(variant, "quantity", 0))
        if held > best:
            best = held
    return best.quantize(_Q, rounding=ROUND_HALF_UP)


def resolved_base_kg(product: Any, variants: Iterable[Any]) -> Decimal | None:
    """Remaining shared balance in the pool's unit (kg, g, litres, units …)."""
    variant_list = list(variants)
    if not uses_shared_weight_stock(getattr(product, "shared_stock", None), variant_list):
        return None
    stored = getattr(product, "base_quantity", None)
    if stored is not None:
        return _dec(stored).quantize(_Q, rounding=ROUND_HALF_UP)
    pool = shared_pool_unit(variant_list, getattr(product, "stock_uom", None))
    return opening_base(variant_list, pool)


def apply_kg_delta(before: Decimal, delta: Decimal) -> Decimal:
    return (before + delta).quantize(_Q, rounding=ROUND_HALF_UP)


def sellable_units(base_kg: Decimal, kg_each: Decimal) -> int:
    if kg_each <= 0 or base_kg <= 0:
        return 0
    return int((base_kg / kg_each).to_integral_value(rounding=ROUND_DOWN))


def reconcile_stock_mode(
    *,
    prev_shared: bool,
    now_shared: bool,
    prev_quantity: int | None,
    payload_quantity: int | None,
    stored_base: Any,
    variants: Iterable[Any],
    prev_pool: str | None = None,
    pool: str | None = None,
) -> tuple[Decimal | None, int | None]:
    """Work out the product's stock after the "stock at product level" setting is saved.

    Returns (base_quantity, product_quantity). product_quantity is None when the
    stored product quantity should be left alone.

    Product level  : one balance (product.base_quantity) drives every variant. Typing a new
                     product quantity sets that balance; switching on from variant level
                     starts it from the typed quantity, or from the variants' on-hand.
                     Changing the stock UOM converts the stored balance (kg -> g …).
    Variant level  : every variant keeps its own count; the balance is cleared and the product
                     quantity becomes the sum of the variants.
    """
    variant_list = [v for v in variants if getattr(v, "is_active", True) is not False]
    edited = payload_quantity is not None and int(payload_quantity) != int(prev_quantity or 0)

    if now_shared:
        if not prev_shared:
            base = _dec(payload_quantity) if edited else opening_base(variant_list, pool)
        elif edited:
            base = _dec(payload_quantity)
        elif stored_base is not None:
            base = convert_pool_quantity(stored_base, prev_pool, pool)
        else:
            return None, None
        base = base.quantize(_Q, rounding=ROUND_HALF_UP)
        return base, int(base.to_integral_value(rounding=ROUND_HALF_UP))

    if prev_shared:
        total = sum(int(getattr(v, "quantity", 0) or 0) for v in variant_list)
        return None, total
    return None, None


def format_kg(value: Decimal) -> str:
    return f"{value.quantize(Decimal('0.001'), rounding=ROUND_HALF_UP)}"


def format_base(value: Decimal, pool: str) -> str:
    """Kilograms keep 3 decimals; other pools show whole numbers when possible."""
    if pool == "kg":
        return format_kg(value)
    whole = value.to_integral_value(rounding=ROUND_HALF_UP)
    if whole == value:
        return str(int(whole))
    return f"{value.quantize(Decimal('0.001'), rounding=ROUND_HALF_UP)}"
