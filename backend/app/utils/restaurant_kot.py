"""KOT numbering configuration stored in restaurant.settings.kot."""
from __future__ import annotations

from datetime import date
from typing import Any, Literal, TypedDict


KOTResetPolicy = Literal["daily", "continuous"]
KOTNumberMode = Literal["sequential", "per_order"]


class KOTSettings(TypedDict):
    mode: KOTNumberMode
    start_number: int
    end_number: int
    reset: KOTResetPolicy
    next_number: int
    last_reset_date: str | None


DEFAULT_KOT_SETTINGS: KOTSettings = {
    "mode": "sequential",
    "start_number": 1,
    "end_number": 999,
    "reset": "daily",
    "next_number": 1,
    "last_reset_date": None,
}


def _clamp_int(value: Any, default: int, *, minimum: int = 1, maximum: int = 999_999) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return default
    return max(minimum, min(maximum, n))


def parse_kot_settings(raw: dict | None) -> KOTSettings:
    """Normalize stored kot settings with defaults."""
    src = raw or {}
    start = _clamp_int(src.get("start_number"), DEFAULT_KOT_SETTINGS["start_number"])
    end = _clamp_int(src.get("end_number"), DEFAULT_KOT_SETTINGS["end_number"], minimum=start)
    mode = src.get("mode") if src.get("mode") in ("sequential", "per_order") else "sequential"
    reset = src.get("reset") if src.get("reset") in ("daily", "continuous") else "daily"
    next_num = _clamp_int(src.get("next_number"), start, minimum=start, maximum=end)
    last_reset = src.get("last_reset_date")
    if last_reset is not None:
        last_reset = str(last_reset)
    return {
        "mode": mode,
        "start_number": start,
        "end_number": end,
        "reset": reset,
        "next_number": next_num,
        "last_reset_date": last_reset,
    }


def kot_settings_out(cfg: KOTSettings) -> dict:
    """API payload including preview of next ticket number."""
    preview = preview_next_kot_number(cfg)
    return {**cfg, "next_preview": preview}


def preview_next_kot_number(cfg: KOTSettings, today: date | None = None) -> int:
    """What number the next KOT would get without mutating state."""
    if cfg["mode"] == "per_order":
        return 1
    working = dict(cfg)
    _apply_daily_reset(working, today or date.today())
    return working["next_number"]


def _apply_daily_reset(cfg: dict, today: date) -> None:
    if cfg.get("reset") != "daily":
        return
    today_str = today.isoformat()
    if cfg.get("last_reset_date") == today_str:
        return
    cfg["next_number"] = cfg["start_number"]
    cfg["last_reset_date"] = today_str


def allocate_kot_number(cfg: KOTSettings, today: date | None = None) -> tuple[int, KOTSettings]:
    """Assign the next sequential KOT number and return updated settings."""
    working: KOTSettings = parse_kot_settings(cfg)
    today = today or date.today()
    _apply_daily_reset(working, today)

    number = working["next_number"]
    nxt = number + 1
    if nxt > working["end_number"]:
        nxt = working["start_number"]
    working["next_number"] = nxt
    if working["reset"] == "daily":
        working["last_reset_date"] = today.isoformat()

    return number, working


def apply_kot_settings_update(
    current: KOTSettings,
    *,
    mode: KOTNumberMode | None = None,
    start_number: int | None = None,
    end_number: int | None = None,
    reset: KOTResetPolicy | None = None,
    next_number: int | None = None,
    reset_counter_now: bool = False,
) -> KOTSettings:
    """Merge user config changes; optionally reset counter to start."""
    out = parse_kot_settings(current)
    if mode is not None:
        out["mode"] = mode
    if start_number is not None:
        out["start_number"] = _clamp_int(start_number, out["start_number"])
    if end_number is not None:
        out["end_number"] = _clamp_int(end_number, out["end_number"], minimum=out["start_number"])
    else:
        out["end_number"] = max(out["end_number"], out["start_number"])
    if reset is not None:
        out["reset"] = reset
    if next_number is not None:
        out["next_number"] = _clamp_int(next_number, out["start_number"], minimum=out["start_number"], maximum=out["end_number"])
    elif reset_counter_now:
        out["next_number"] = out["start_number"]
        out["last_reset_date"] = None
    else:
        out["next_number"] = _clamp_int(out["next_number"], out["start_number"], minimum=out["start_number"], maximum=out["end_number"])
    return out
