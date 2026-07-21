# app/services/variant_generator.py
"""
Turns Product Configuration metadata (attributes + options + rules) into concrete
Variant Instances. This is the only place that generates SKUs/variants — the
configuration module (app/services/rule_engine.py, vendor_product_config.py)
only ever defines metadata.

Combination expansion is rule-aware: it walks the attribute dependency tree
depth-first and, at each node, asks the rule engine (using the partial selection
built so far) whether that attribute is hidden or has disabled options *before*
branching into it. This means:
  - A child attribute that only appears once its parent has a certain value
    (Voltage -> Phase -> Cooling -> ...) is never combined with parent values
    that hide it — no wasted/invalid combinations.
  - Options disabled by a rule for a given partial selection are skipped.
  - A branch where a *required* attribute has zero valid options left is
    dropped entirely (it can never become a valid, saveable configuration).
Never emits the same selection twice (variant_hash is a canonical, order-independent
hash of the full selection).
"""
from __future__ import annotations
import hashlib
import json
import re
import secrets
from typing import Any, Optional

from app.services.rule_engine import evaluate_rules

DEFAULT_MAX_COMBINATIONS = 9999


def compute_variant_hash(product_id: str, selection: dict[str, Any]) -> str:
    """Order-independent dedup key — same selection always hashes the same,
    regardless of the order attributes were picked in."""
    canonical = json.dumps({k: selection[k] for k in sorted(selection)}, sort_keys=True, default=str)
    return hashlib.sha256(f"{product_id}:{canonical}".encode()).hexdigest()


def build_attribute_order(attributes: list, options_by_attr: dict) -> list[dict]:
    """Depth-first pre-order over the attribute dependency tree (parent always
    before its children); independent root attributes are simply concatenated,
    which is exactly what a nested-loop cartesian expansion needs.

    ``options_by_attr`` must be a dict of attribute id -> list of already-fetched
    ProductConfigOption rows (fetched separately, never via the lazy ``.options``
    relationship, to keep this function safe to call outside an ORM session).
    """
    by_parent: dict[Optional[str], list] = {}
    for a in attributes:
        parent_key = str(a.parent_attribute_id) if a.parent_attribute_id else None
        by_parent.setdefault(parent_key, []).append(a)
    for lst in by_parent.values():
        lst.sort(key=lambda a: (a.display_order, a.display_name))

    order: list[dict] = []

    def walk(parent_key: Optional[str]):
        for a in by_parent.get(parent_key, []):
            order.append({
                "id": str(a.id),
                "name": a.name,
                "display_name": a.display_name,
                "parent_attribute_id": str(a.parent_attribute_id) if a.parent_attribute_id else None,
                "display_order": a.display_order,
                "is_active": a.is_active,
                "is_required": a.is_required,
                "options": [
                    {"name": o.name, "display_name": o.display_name, "price_delta": float(o.price_delta or 0), "is_active": o.is_active}
                    for o in options_by_attr.get(a.id, []) if o.is_active
                ],
            })
            walk(str(a.id))

    walk(None)
    return order


class GenerationLimitReached(Exception):
    def __init__(self, generated_so_far: int):
        self.generated_so_far = generated_so_far


def _is_attribute_applicable(attr: dict, evaluation) -> bool:
    """Whether this attribute is actually part of the configuration for a given
    (partial) selection. A rule's show_field/hide_field wins outright. Absent any
    rule: root attributes are visible by default, but a *dependent* attribute
    (one with a parent_attribute_id) only becomes relevant once some rule says
    so — e.g. Oil Grade should never appear unless a rule shows it after
    Cooling = Oil, even if nothing explicitly hides it."""
    name = attr["name"]
    if name in evaluation.shown:
        return True
    if name in evaluation.hidden:
        return False
    return attr["parent_attribute_id"] is None


def _gated_options_by_attr(rules: list[dict]) -> dict[str, set[str]]:
    """Options targeted by any enable_option rule — hidden until enabled."""
    gated: dict[str, set[str]] = {}
    for rule in rules:
        for action in rule.get("actions") or []:
            if action.get("type") != "enable_option":
                continue
            target = action.get("target") or ""
            attr, _, option = target.partition(":")
            if not attr:
                continue
            gated.setdefault(attr, set()).add(option or target)
    return gated


def _option_allowed(
    attr_name: str,
    option_name: str,
    evaluation,
    gated: dict[str, set[str]],
) -> bool:
    if option_name in evaluation.disabled_options.get(attr_name, set()):
        return False
    if option_name in gated.get(attr_name, set()) and option_name not in evaluation.enabled_options.get(attr_name, set()):
        return False
    return True


def generate_candidate_combinations(
    attribute_order: list[dict],
    rules: list[dict],
    max_combinations: int = DEFAULT_MAX_COMBINATIONS,
) -> tuple[list[dict[str, Any]], bool]:
    """Returns (combinations, truncated). Each combination is a flat
    {attribute_name: option_name} dict — only combinations that survive every
    active rule (visibility + disabled/enabled options + required-attribute pruning)
    are returned."""
    out: list[dict[str, Any]] = []
    truncated = False
    gated = _gated_options_by_attr(rules)

    def expand(idx: int, selection: dict[str, Any]) -> None:
        nonlocal truncated
        if truncated:
            return
        if idx >= len(attribute_order):
            out.append(dict(selection))
            if len(out) >= max_combinations:
                truncated = True
            return

        attr = attribute_order[idx]
        if not attr["is_active"]:
            expand(idx + 1, selection)
            return

        evaluation = evaluate_rules(rules, selection)
        if not _is_attribute_applicable(attr, evaluation):
            # Not applicable given the selection so far — leave it out entirely.
            expand(idx + 1, selection)
            return

        options = [
            o for o in attr["options"]
            if _option_allowed(attr["name"], o["name"], evaluation, gated)
        ]

        if not options:
            is_required = attr["is_required"] or attr["name"] in evaluation.required
            if is_required:
                return  # dead branch: a required attribute has no valid choice left
            expand(idx + 1, selection)
            return

        for opt in options:
            if truncated:
                return
            expand(idx + 1, {**selection, attr["name"]: opt["name"]})

    expand(0, {})
    return out, truncated


_ALNUM_RE = re.compile(r"[^A-Za-z0-9]+")


def _short_code(value: str, length: int = 4) -> str:
    cleaned = _ALNUM_RE.sub("", str(value)).upper()
    return cleaned[:length] if cleaned else "X"


def build_variant_sku(base_code: str, attribute_order: list[dict], selection: dict[str, Any]) -> str:
    parts = [base_code]
    for attr in attribute_order:
        val = selection.get(attr["name"])
        if val is not None:
            parts.append(_short_code(val))
    return "-".join(parts)


def build_variant_barcode(variant_hash: str) -> str:
    """Deterministic 12-digit numeric code derived from the variant hash — a
    scannable placeholder for internal warehouse use, not a registered GS1/EAN
    barcode (that requires a real GS1 prefix issued to the vendor)."""
    return "".join(str(int(c, 16) % 10) for c in variant_hash[:12])


def build_variant_label(attribute_order: list[dict], selection: dict[str, Any]) -> str:
    parts = []
    for attr in attribute_order:
        val = selection.get(attr["name"])
        if val is None:
            continue
        opt = next((o for o in attr["options"] if o["name"] == val), None)
        parts.append(opt["display_name"] if opt else str(val))
    return " / ".join(parts)


def build_search_keywords(product_name: str, attribute_order: list[dict], selection: dict[str, Any], sku: str) -> str:
    tokens: set[str] = {product_name.lower(), sku.lower()}
    for attr in attribute_order:
        val = selection.get(attr["name"])
        if val is None:
            continue
        tokens.add(attr["display_name"].lower())
        opt = next((o for o in attr["options"] if o["name"] == val), None)
        if opt:
            tokens.add(opt["display_name"].lower())
    return " ".join(sorted(t for t in tokens if t))


def price_delta_sum(attribute_order: list[dict], selection: dict[str, Any]) -> float:
    total = 0.0
    for attr in attribute_order:
        val = selection.get(attr["name"])
        if val is None:
            continue
        opt = next((o for o in attr["options"] if o["name"] == val), None)
        if opt:
            total += opt["price_delta"]
    return total


def disambiguate_sku(sku: str, used_skus: set[str], variant_hash: str) -> str:
    """Append a short suffix if truncated option codes collide within the same batch."""
    if sku not in used_skus:
        return sku
    suffix = variant_hash[:4].upper()
    candidate = f"{sku}-{suffix}"
    while candidate in used_skus:
        candidate = f"{sku}-{secrets.token_hex(2).upper()}"
    return candidate


def is_selection_still_valid(selection: dict[str, Any], attribute_order: list[dict], rules: list[dict]) -> bool:
    """Re-check a previously generated selection against the *current* attributes
    and rules (used by the "delete invalid variants" cleanup after metadata edits)."""
    by_name = {a["name"]: a for a in attribute_order}
    evaluation = evaluate_rules(rules, selection)
    gated = _gated_options_by_attr(rules)

    if evaluation.errors or evaluation.prevent_save:
        return False

    for attr_name, option_name in selection.items():
        attr = by_name.get(attr_name)
        if attr is None or not attr["is_active"]:
            return False
        if not _is_attribute_applicable(attr, evaluation):
            return False
        if not _option_allowed(attr_name, option_name, evaluation, gated):
            return False
        if not any(o["name"] == option_name for o in attr["options"]):
            return False

    for attr in attribute_order:
        needs_value = attr["is_required"] or attr["name"] in evaluation.required
        if needs_value and _is_attribute_applicable(attr, evaluation) and attr["name"] not in selection:
            return False

    return True
