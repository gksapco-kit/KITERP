"""Central registry: every real-estate resource and the 24-module navigation tree."""
from typing import Any

from .crud import Action, Resource

RESOURCES: list[Resource] = []


def add(*resources: Resource) -> None:
    RESOURCES.extend(resources)


def by_key() -> dict[str, Resource]:
    return {r.key: r for r in RESOURCES}


def key_by_table() -> dict[str, str]:
    return {r.model.__tablename__: r.key for r in RESOURCES}


def P(name: str, label: str, type_: str = "text", *, required: bool = False, choices: list[str] | None = None,
      ref: str | None = None, default: Any = None) -> dict:
    """Action-parameter descriptor used by the UI prompt dialog."""
    out: dict[str, Any] = {"name": name, "label": label, "type": type_, "required": required}
    if choices:
        out["choices"] = choices
    if ref:
        out["ref"] = ref
    if default is not None:
        out["default"] = default
    return out


__all__ = ["RESOURCES", "add", "by_key", "key_by_table", "P", "Action", "Resource"]
