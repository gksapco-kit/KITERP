from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Dict
from uuid import UUID

from app.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.services.vendor_service import VendorService
from app.services.notification_service import NotificationService

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_vendor(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    svc = VendorService(db)
    vendor = await svc.get_by_user_id(current_user.id)
    if not vendor:
        raise HTTPException(404, "No vendor found")
    return vendor


async def _vendor_id(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> UUID:
    vendor = await _get_vendor(current_user, db)
    return vendor.id


# ── Schemas ───────────────────────────────────────────────────────────────────

class ActiveSlot(BaseModel):
    id: str
    days: List[str] = Field(default_factory=list)  # mon,tue,wed,thu,fri,sat,sun
    start: str = "09:00"
    end: str = "17:00"


class CustomerNotificationSend(BaseModel):
    customer_id: UUID
    title: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1)
    include_reach_back: bool = False
    reference_id: Optional[str] = None


class NotificationPreferences(BaseModel):
    # Master switch
    notifications_enabled: bool = True
    # Channel toggles
    in_app: bool = True
    email: bool = True
    sms: bool = False
    push: bool = False
    whatsapp: bool = False
    # Event toggles
    new_orders: bool = True
    order_updates: bool = True
    low_stock: bool = True
    payments: bool = True
    new_reviews: bool = True
    system_updates: bool = True
    # Sound
    sound_enabled: bool = True
    sound_tone: str = "chime"   # built-in tone name | "local" | "silent"
    volume: int = 70             # 0–100
    tone_duration_sec: int = 3  # 1 | 3 | 5 | 10 | 30
    # Per-event tone overrides  {"new_orders": "ding", "low_stock": "alert"}
    per_event_tones: Dict[str, str] = Field(default_factory=dict)
    # Unified notification schedule (replaces separate quiet-hours + active-slots)
    schedule_enabled: bool = False
    schedule_mode: str = "quiet"       # "quiet" (silence during) | "active" (only during)
    schedule_slots: List[ActiveSlot] = Field(default_factory=list)
    sync_with_store_hours: bool = False
    # Repeat alert (re-ring if still unread)
    repeat_enabled: bool = False
    repeat_interval_min: int = 5           # 1–120 min
    repeat_max_count: int = 0              # 0 = unlimited
    repeat_stop_on_read: bool = True
    repeat_stop_on_focus: bool = False
    repeat_stop_on_order_accept: bool = True
    repeat_show_stop_button: bool = True
    repeat_apply_events: List[str] = Field(default_factory=list)  # empty = all
    # Digest mode
    notify_mode: str = "instant"       # instant | digest_hourly | digest_daily
    digest_time: str = "09:00"         # HH:MM for daily digest
    # WhatsApp report sharing
    report_wa_enabled: bool = False
    report_wa_numbers: List[str] = Field(default_factory=list)   # phone numbers
    report_wa_reports: List[str] = Field(default_factory=list)   # report IDs
    report_wa_frequency: str = "daily"  # daily | weekly | monthly
    report_wa_time: str = "09:00"


def _serialize(n) -> dict:
    return {
        "id": str(n.id),
        "title": n.title,
        "message": n.message,
        "type": n.type,
        "is_read": n.is_read,
        "reference_id": n.reference_id,
        "reference_type": n.reference_type,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
async def list_notifications(
    limit: int = Query(50, ge=1, le=200),
    unread_only: bool = Query(False),
    type: Optional[str] = Query(None, description="Filter by type: order, inventory, payment, review, system, info"),
    vendor_id: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = NotificationService(db)
    items = await svc.get_vendor_notifications(
        vendor_id, limit=limit, unread_only=unread_only, notif_type=type
    )
    return {"items": [_serialize(n) for n in items]}


@router.get("/stats")
async def get_notification_stats(
    vendor_id: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = NotificationService(db)
    return await svc.get_vendor_notification_stats(vendor_id)


@router.patch("/read-all")
async def mark_all_notifications_read(
    vendor_id: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = NotificationService(db)
    count = await svc.mark_all_as_read(vendor_id)
    await db.commit()
    return {"status": "ok", "marked_read": count}


@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    vendor_id: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    svc = NotificationService(db)
    notif = await svc.mark_as_read(UUID(notification_id))
    if not notif:
        raise HTTPException(404, "Notification not found")
    await db.commit()
    return {"status": "ok"}


@router.get("/preferences")
async def get_notification_preferences(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    vendor = await _get_vendor(current_user, db)
    settings: dict = vendor.settings or {}
    notif_settings: dict = settings.get("notifications", {})
    event_settings: dict = settings.get("notification_events", {})
    sound_settings: dict = settings.get("notification_sound", {})
    schedule_settings: dict = settings.get("notification_schedule", {})
    repeat_settings: dict = settings.get("notification_repeat", {})
    digest_settings: dict = settings.get("notification_digest", {})
    report_wa_settings: dict = settings.get("report_whatsapp", {})

    raw_slots = schedule_settings.get("slots", [])
    schedule_slots = [ActiveSlot(**s) for s in raw_slots if isinstance(s, dict)]

    return NotificationPreferences(
        notifications_enabled=notif_settings.get("notifications_enabled", True),
        in_app=notif_settings.get("in_app", True),
        email=notif_settings.get("email", True),
        sms=notif_settings.get("sms", False),
        push=notif_settings.get("push", False),
        whatsapp=notif_settings.get("whatsapp", False),
        new_orders=event_settings.get("new_orders", True),
        order_updates=event_settings.get("order_updates", True),
        low_stock=event_settings.get("low_stock", True),
        payments=event_settings.get("payments", True),
        new_reviews=event_settings.get("new_reviews", True),
        system_updates=event_settings.get("system_updates", True),
        sound_enabled=sound_settings.get("enabled", True),
        sound_tone=sound_settings.get("tone", "chime"),
        volume=sound_settings.get("volume", 70),
        tone_duration_sec=sound_settings.get("tone_duration_sec", 3),
        per_event_tones=sound_settings.get("per_event_tones", {}),
        schedule_enabled=schedule_settings.get("enabled", False),
        schedule_mode=schedule_settings.get("mode", "quiet"),
        schedule_slots=schedule_slots,
        sync_with_store_hours=schedule_settings.get("sync_with_store_hours", False),
        repeat_enabled=repeat_settings.get("enabled", False),
        repeat_interval_min=repeat_settings.get("interval_min", 5),
        repeat_max_count=repeat_settings.get("max_count", 0),
        repeat_stop_on_read=repeat_settings.get("stop_on_read", True),
        repeat_stop_on_focus=repeat_settings.get("stop_on_focus", False),
        repeat_stop_on_order_accept=repeat_settings.get("stop_on_order_accept", True),
        repeat_show_stop_button=repeat_settings.get("show_stop_button", True),
        repeat_apply_events=repeat_settings.get("apply_events", []),
        notify_mode=digest_settings.get("mode", "instant"),
        digest_time=digest_settings.get("time", "09:00"),
        report_wa_enabled=report_wa_settings.get("enabled", False),
        report_wa_numbers=report_wa_settings.get("numbers", []),
        report_wa_reports=report_wa_settings.get("reports", []),
        report_wa_frequency=report_wa_settings.get("frequency", "daily"),
        report_wa_time=report_wa_settings.get("time", "09:00"),
    )


@router.put("/preferences")
async def update_notification_preferences(
    prefs: NotificationPreferences,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    vendor = await _get_vendor(current_user, db)
    settings: dict = dict(vendor.settings or {})

    settings["notifications"] = {
        "notifications_enabled": prefs.notifications_enabled,
        "in_app": prefs.in_app,
        "email": prefs.email,
        "sms": prefs.sms,
        "push": prefs.push,
        "whatsapp": prefs.whatsapp,
    }
    settings["notification_events"] = {
        "new_orders": prefs.new_orders,
        "order_updates": prefs.order_updates,
        "low_stock": prefs.low_stock,
        "payments": prefs.payments,
        "new_reviews": prefs.new_reviews,
        "system_updates": prefs.system_updates,
    }
    settings["notification_sound"] = {
        "enabled": prefs.sound_enabled,
        "tone": prefs.sound_tone,
        "volume": max(0, min(100, prefs.volume)),
        "tone_duration_sec": max(1, min(30, prefs.tone_duration_sec)),
        "per_event_tones": prefs.per_event_tones,
    }
    settings["notification_schedule"] = {
        "enabled": prefs.schedule_enabled,
        "mode": prefs.schedule_mode,
        "slots": [s.model_dump() for s in prefs.schedule_slots],
        "sync_with_store_hours": prefs.sync_with_store_hours,
    }
    settings["notification_repeat"] = {
        "enabled": prefs.repeat_enabled,
        "interval_min": max(1, min(120, prefs.repeat_interval_min)),
        "max_count": max(0, prefs.repeat_max_count),
        "stop_on_read": prefs.repeat_stop_on_read,
        "stop_on_focus": prefs.repeat_stop_on_focus,
        "stop_on_order_accept": prefs.repeat_stop_on_order_accept,
        "show_stop_button": prefs.repeat_show_stop_button,
        "apply_events": prefs.repeat_apply_events,
    }
    settings["notification_digest"] = {
        "mode": prefs.notify_mode,
        "time": prefs.digest_time,
    }
    settings["report_whatsapp"] = {
        "enabled": prefs.report_wa_enabled,
        "numbers": prefs.report_wa_numbers,
        "reports": prefs.report_wa_reports,
        "frequency": prefs.report_wa_frequency,
        "time": prefs.report_wa_time,
    }

    vendor.settings = settings
    db.add(vendor)
    await db.commit()
    return prefs


@router.post("/test")
async def send_test_notification(
    vendor_id: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a sample in-app notification so the vendor can verify their setup."""
    svc = NotificationService(db)
    await svc._save_notification(
        vendor_id=vendor_id,
        title="Test Notification",
        message="This is a test notification. Your notification setup is working correctly!",
        notif_type="system",
        reference_type="test",
    )
    await db.commit()
    return {"status": "ok", "message": "Test notification sent"}


@router.post("/customer")
async def send_customer_notification(
    data: CustomerNotificationSend,
    vendor_id: UUID = Depends(_vendor_id),
    db: AsyncSession = Depends(get_db),
):
    """Deliver an in-app notification to a customer's storefront / mobile app."""
    from app.repositories.customer_repo import CustomerRepository

    customer = await CustomerRepository(db).get_by_vendor_and_id(vendor_id, data.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    svc = NotificationService(db)
    notif = await svc.notify_care_reminder(
        vendor_id=vendor_id,
        customer_id=data.customer_id,
        title=data.title,
        message=data.message,
        include_reach_back=data.include_reach_back,
        reference_id=data.reference_id,
    )
    await db.commit()
    return {"ok": True, "notification_id": str(notif.id)}
