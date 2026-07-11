# app/services/rule_engine.py
"""
Pure, dependency-free evaluator for the visual Product Configuration rule engine.
No SQL — rules are JSON condition trees + action lists (see app.models.product_config.ProductConfigRule).

This logic is intentionally mirrored in vendor-web/src/lib/ruleEngine.ts so the
frontend can evaluate rules instantly while the user configures a product (no
network round trip per keystroke), while this module re-validates on the server
before a configuration/variant is actually saved.
"""
from __future__ import annotations
from typing import Any, Optional
from datetime import date, datetime


def _to_comparable(value: Any) -> Any:
    """Best-effort coercion so "10" vs 10, or ISO date strings, compare sanely."""
    if isinstance(value, (int, float, bool)) or value is None:
        return value
    if isinstance(value, str):
        s = value.strip()
        try:
            return float(s) if any(c in s for c in ".eE") else int(s)
        except ValueError:
            return s
    return value


def _compare(actual: Any, operator: str, expected: Any, expected2: Any = None) -> bool:
    a = _to_comparable(actual)

    if operator == "equals":
        if isinstance(a, list):
            return expected in a
        return a == _to_comparable(expected)
    if operator == "not_equals":
        if isinstance(a, list):
            return expected not in a
        return a != _to_comparable(expected)
    if operator == "contains":
        if isinstance(a, list):
            return expected in a
        return str(expected).lower() in str(a or "").lower()
    if operator == "starts_with":
        return str(a or "").lower().startswith(str(expected).lower())
    if operator == "ends_with":
        return str(a or "").lower().endswith(str(expected).lower())
    if operator in ("gt", "lt", "between"):
        try:
            av = float(a)
        except (TypeError, ValueError):
            return False
        if operator == "gt":
            return av > float(expected)
        if operator == "lt":
            return av < float(expected)
        if operator == "between":
            lo, hi = float(expected), float(expected2)
            return min(lo, hi) <= av <= max(lo, hi)
    return False


def evaluate_condition(node: Optional[dict], selection: dict) -> bool:
    """Recursively evaluate a condition tree. Empty/None node = always true."""
    if not node:
        return True

    op = node.get("op")
    if op:
        children = node.get("children") or []
        results = [evaluate_condition(c, selection) for c in children]
        if op == "AND":
            return all(results) if results else True
        if op == "OR":
            return any(results) if results else False
        if op == "NOT":
            return not (results[0] if results else False)
        return True

    attribute = node.get("attribute")
    operator = node.get("operator")
    if not attribute or not operator:
        return True
    return _compare(selection.get(attribute), operator, node.get("value"), node.get("value2"))


class RuleEvaluationResult:
    __slots__ = (
        "shown", "hidden", "required", "disabled_options", "enabled_options",
        "auto_select", "defaults", "warnings", "errors", "prevent_save", "matched_rule_ids",
    )

    def __init__(self):
        self.shown: set[str] = set()
        self.hidden: set[str] = set()
        self.required: set[str] = set()
        self.disabled_options: dict[str, set[str]] = {}
        self.enabled_options: dict[str, set[str]] = {}
        self.auto_select: dict[str, Any] = {}
        self.defaults: dict[str, Any] = {}
        self.warnings: list[str] = []
        self.errors: list[str] = []
        self.prevent_save = False
        self.matched_rule_ids: list[str] = []

    def to_dict(self) -> dict:
        return {
            "shown": sorted(self.shown),
            "hidden": sorted(self.hidden),
            "required": sorted(self.required),
            "disabled_options": {k: sorted(v) for k, v in self.disabled_options.items()},
            "enabled_options": {k: sorted(v) for k, v in self.enabled_options.items()},
            "auto_select": self.auto_select,
            "defaults": self.defaults,
            "warnings": self.warnings,
            "errors": self.errors,
            "prevent_save": self.prevent_save,
            "matched_rule_ids": self.matched_rule_ids,
        }


def evaluate_rules(rules: list[dict], selection: dict) -> RuleEvaluationResult:
    """Evaluate every active rule (already filtered by caller) against a selection.

    Rules are applied in priority order (ascending); a later/higher-priority rule's
    action overrides an earlier one for the same target. This mirrors evaluateRules()
    in vendor-web/src/lib/ruleEngine.ts exactly — keep both in sync.
    """
    result = RuleEvaluationResult()
    ordered = sorted(rules, key=lambda r: (r.get("priority") or 0, r.get("name") or ""))

    for rule in ordered:
        if not rule.get("is_active", True):
            continue
        if not evaluate_condition(rule.get("conditions"), selection):
            continue

        result.matched_rule_ids.append(str(rule.get("id")))
        for action in rule.get("actions") or []:
            _apply_action(result, action)

    return result


def _apply_action(result: RuleEvaluationResult, action: dict) -> None:
    a_type = action.get("type")
    target = action.get("target")
    value = action.get("value")
    message = action.get("message") or (value if isinstance(value, str) else None)

    if a_type == "show_field" and target:
        result.shown.add(target)
        result.hidden.discard(target)
    elif a_type == "hide_field" and target:
        result.hidden.add(target)
        result.shown.discard(target)
    elif a_type == "require_field" and target:
        if value in (True, None, "true", "TRUE", 1):
            result.required.add(target)
        else:
            result.required.discard(target)
    elif a_type == "disable_option" and target:
        attr, _, option = target.partition(":")
        result.disabled_options.setdefault(attr, set()).add(option or target)
    elif a_type == "enable_option" and target:
        attr, _, option = target.partition(":")
        result.enabled_options.setdefault(attr, set()).add(option or target)
    elif a_type == "auto_select" and target:
        result.auto_select[target] = value
    elif a_type == "change_default" and target:
        result.defaults[target] = value
    elif a_type == "warning":
        result.warnings.append(message or "Rule warning")
    elif a_type == "error":
        result.errors.append(message or "Rule error")
    elif a_type == "prevent_save":
        result.prevent_save = True
        if message:
            result.errors.append(message)
