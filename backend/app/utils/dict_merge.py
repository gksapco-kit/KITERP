from __future__ import annotations

from typing import Any, Mapping, MutableMapping


def deep_merge_dicts(base: MutableMapping[str, Any], patch: Mapping[str, Any]) -> None:
    """Merge patch into base in place. None values remove keys; dicts merge recursively."""
    for key, value in patch.items():
        if value is None:
            base.pop(key, None)
            continue
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            deep_merge_dicts(base[key], value)
        else:
            base[key] = value
