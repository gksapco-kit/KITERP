"""Sync HR employee LWD to linked vendor_user access window."""
from datetime import date, datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hr import EmployeeProfile
from app.models.vendor_user import VendorUser


def _format_date(d: date) -> str:
    return d.isoformat()


async def sync_lwd_to_vendor_user_access(
    db: AsyncSession,
    emp: EmployeeProfile,
    *,
    lwd: Optional[date],
    previous_lwd: Optional[date] = None,
) -> None:
    """
    When HR LWD is set or changed, mirror it to the linked team member's access end date
    and record a note for Staff Access Control UI.
    """
    if not emp.vendor_user_id:
        return

    vu = await db.get(VendorUser, emp.vendor_user_id)
    if not vu:
        return

    if lwd is None:
        if previous_lwd is not None and vu.access_end_source == "hr_lwd":
            vu.access_ends_at = None
            vu.access_end_source = None
            vu.access_sync_note = (
                f"Employee LWD cleared in HR (was {_format_date(previous_lwd)}). "
                "Access end date cleared."
            )
        await db.flush()
        return

    changed = previous_lwd != lwd
    if not changed and vu.access_ends_at == lwd and vu.access_end_source == "hr_lwd":
        return

    prev_end = vu.access_ends_at
    vu.access_ends_at = lwd
    vu.access_end_source = "hr_lwd"
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    if previous_lwd and previous_lwd != lwd:
        vu.access_sync_note = (
            f"Employee LWD updated in HR from {_format_date(previous_lwd)} to "
            f"{_format_date(lwd)} ({ts}). Access end date updated here."
        )
    elif prev_end and prev_end != lwd and vu.access_end_source == "manual":
        vu.access_sync_note = (
            f"Employee LWD set to {_format_date(lwd)} in HR ({ts}). "
            f"Access end date replaced (was {_format_date(prev_end)}, manual)."
        )
    else:
        vu.access_sync_note = (
            f"Employee LWD set to {_format_date(lwd)} in HR ({ts}). "
            "Access end date updated here."
        )
    await db.flush()
