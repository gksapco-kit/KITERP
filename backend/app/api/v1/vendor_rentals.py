from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_current_vendor_id, require_permission
from app.database import get_db
from app.models.user import User
from app.services.rental_service import RentalService

router = APIRouter(dependencies=[Depends(require_permission("rentals.view"))])


@router.get("/dashboard")
async def rental_dashboard(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).get_dashboard(vendor_id)


@router.get("/assets")
async def list_rental_assets(
    status: str | None = Query(None),
    category: str | None = Query(None, description="Filter by asset kind (milk_dairy, furniture, …)"),
    category_id: str | None = Query(None, description="Filter by vendor category UUID"),
    q: str | None = Query(None, description="Full-text search on name, code, location"),
    is_active: bool | None = Query(None),
    deleted_only: bool = Query(False, description="When true, list soft-deleted assets in the bin"),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).list_assets(
        vendor_id, status=status, category=category, category_id=category_id,
        q=q, is_active=is_active, deleted_only=deleted_only,
    )


@router.get("/assets/{asset_id}")
async def get_rental_asset(
    asset_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).get_asset(vendor_id, asset_id)


def _actor_payload(user: User) -> dict:
    return {
        "id": str(user.id),
        "name": (user.full_name or user.email or "Vendor user").strip(),
    }


@router.post("/assets", status_code=201)
async def create_rental_asset(
    body: dict,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    body = dict(body or {})
    body["_actor"] = _actor_payload(user)
    return await RentalService(db).create_asset(vendor_id, body)


@router.patch("/assets/{asset_id}")
async def update_rental_asset(
    asset_id: UUID,
    body: dict,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    body = dict(body or {})
    body["_actor"] = _actor_payload(user)
    return await RentalService(db).update_asset(vendor_id, asset_id, body)


@router.delete("/assets/{asset_id}", dependencies=[Depends(require_permission("rentals.manage"))])
async def delete_rental_asset(
    asset_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """Move a rental asset to the bin (soft delete). History is retained."""
    return await RentalService(db).delete_asset(vendor_id, asset_id, {"_actor": _actor_payload(user)})


@router.post("/assets/{asset_id}/restore", dependencies=[Depends(require_permission("rentals.manage"))])
async def restore_rental_asset(
    asset_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """Restore a soft-deleted rental asset from the bin."""
    return await RentalService(db).restore_asset(vendor_id, asset_id, {"_actor": _actor_payload(user)})


@router.get("/availability")
async def day_availability(
    on: date = Query(..., alias="date", description="List asset/unit availability for this day"),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    """Flat list of bookable assets / units for a single date (date-browse mode)."""
    return await RentalService(db).get_day_availability(vendor_id, on)


@router.get("/assets/{asset_id}/calendar")
async def asset_availability_calendar(
    asset_id: UUID,
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).get_availability_calendar(vendor_id, asset_id, from_date, to_date)


@router.get("/assets/{asset_id}/free-capacity")
async def asset_free_capacity_for_range(
    asset_id: UUID,
    start: date = Query(..., description="Inclusive start date"),
    end: date = Query(..., description="Inclusive end date"),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    """Capacity free for a continuous booking window (same rules as create booking)."""
    return await RentalService(db).get_free_capacity_for_range(vendor_id, asset_id, start, end)


@router.get("/bookings")
async def list_rental_bookings(
    status: str | None = Query(None),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).list_bookings(vendor_id, status=status)


@router.get("/bookings/{booking_id}")
async def get_rental_booking(
    booking_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).get_booking(vendor_id, booking_id)


@router.post("/bookings", status_code=201)
async def create_rental_booking(
    body: dict,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).create_booking(vendor_id, body)


@router.patch("/bookings/{booking_id}")
async def update_rental_booking(
    booking_id: UUID,
    body: dict,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    svc = RentalService(db)
    if body.get("status"):
        return await svc.update_booking_status(vendor_id, booking_id, body["status"])
    if body.get("new_end_date"):
        new_end = body["new_end_date"]
        if isinstance(new_end, str):
            new_end = date.fromisoformat(new_end)
        return await svc.extend_booking(vendor_id, booking_id, new_end)
    return await svc.get_booking(vendor_id, booking_id)


@router.post("/bookings/{booking_id}/payment")
async def record_rental_payment(
    booking_id: UUID,
    body: dict,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).record_payment(vendor_id, booking_id, body)


@router.post("/bookings/{booking_id}/return")
async def return_rental_booking(
    booking_id: UUID,
    body: dict,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    """Record asset return (full or partial).

    Body: quantity_returned, return_condition (good|damaged|missing),
          damage_charge, return_notes
    Late fee is computed automatically from daily_rate × days overdue.
    """
    return await RentalService(db).process_return(vendor_id, booking_id, body)


@router.patch("/bookings/{booking_id}/delivery")
async def update_rental_delivery(
    booking_id: UUID,
    body: dict,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).update_delivery(vendor_id, booking_id, body)


@router.put("/bookings/{booking_id}/registration", dependencies=[Depends(require_permission("rentals.manage"))])
async def replace_booking_registration(
    booking_id: UUID,
    body: dict,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    """Replace (or create) the guest registration linked to this booking."""
    from app.services.rental_registration import RentalRegistrationService
    return await RentalRegistrationService(db).replace_booking_registration(vendor_id, booking_id, body)


@router.delete("/bookings/{booking_id}/registration", status_code=200, dependencies=[Depends(require_permission("rentals.manage"))])
async def discard_booking_registration(
    booking_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    """Discard the guest registration linked to this booking."""
    from app.services.rental_registration import RentalRegistrationService
    return await RentalRegistrationService(db).discard_booking_registration(vendor_id, booking_id)


# ── Sub-assets: child assets (hierarchy mode) ─────────────────────────

@router.get("/assets/{asset_id}/children")
async def list_asset_children(
    asset_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).list_asset_children(vendor_id, asset_id)


# ── Sub-assets: serialized units ─────────────────────────────────────

@router.get("/assets/{asset_id}/units")
async def list_asset_units(
    asset_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).list_asset_units(vendor_id, asset_id)


@router.post("/assets/{asset_id}/units", status_code=201, dependencies=[Depends(require_permission("rentals.manage"))])
async def create_asset_unit(
    asset_id: UUID,
    body: dict,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).create_asset_unit(vendor_id, asset_id, body)


@router.post("/assets/{asset_id}/units/bulk", status_code=201, dependencies=[Depends(require_permission("rentals.manage"))])
async def bulk_create_asset_units(
    asset_id: UUID,
    body: dict,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    """Bulk-create sequentially numbered serialized units.

    Body: prefix, start, end, padding, suffix, condition
    """
    return await RentalService(db).bulk_create_asset_units(vendor_id, asset_id, body)


@router.patch("/assets/{asset_id}/units/{unit_id}", dependencies=[Depends(require_permission("rentals.manage"))])
async def update_asset_unit(
    asset_id: UUID,
    unit_id: UUID,
    body: dict,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).update_asset_unit(vendor_id, asset_id, unit_id, body)


@router.delete("/assets/{asset_id}/units/{unit_id}", dependencies=[Depends(require_permission("rentals.manage"))])
async def delete_asset_unit(
    asset_id: UUID,
    unit_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).delete_asset_unit(vendor_id, asset_id, unit_id)


# ── Return history ─────────────────────────────────────────────────────

@router.get("/bookings/{booking_id}/returns")
async def list_return_history(
    booking_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    return await RentalService(db).list_return_history(vendor_id, booking_id)


# ── Unit assignment ─────────────────────────────────────────────────────

@router.get("/bookings/{booking_id}/units")
async def get_booking_units(
    booking_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    """List the serialized units currently assigned to this booking."""
    return await RentalService(db).get_booking_units(vendor_id, booking_id)


@router.post(
    "/bookings/{booking_id}/assign-units",
    status_code=201,
    dependencies=[Depends(require_permission("rentals.manage"))],
)
async def assign_units_to_booking(
    booking_id: UUID,
    body: dict,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    """Manually assign specific units (by unit_ids list) or auto-pick from the available pool.

    Body:
      unit_ids    – optional list of specific unit UUIDs
      assigned_by – optional label shown in the timeline (defaults to 'vendor')
    """
    return await RentalService(db).assign_units_to_booking(vendor_id, booking_id, body)


@router.post(
    "/bookings/{booking_id}/units/{from_unit_id}/reassign",
    dependencies=[Depends(require_permission("rentals.manage"))],
)
async def reassign_booking_unit(
    booking_id: UUID,
    from_unit_id: UUID,
    body: dict,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    """Swap a currently-assigned unit for a replacement.

    Body:
      to_unit_id  – UUID of the replacement unit (must be 'available')
      notes       – optional reason / remarks
      assigned_by – optional actor label
    """
    return await RentalService(db).reassign_unit(vendor_id, booking_id, from_unit_id, body)


# ── Registration forms ──────────────────────────────────────────────────

@router.get("/registration-forms")
async def list_registration_forms(
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    from app.services.rental_registration import RentalRegistrationService
    return await RentalRegistrationService(db).list_forms(vendor_id)


@router.get("/registration-forms/active")
async def get_active_registration_form(
    channel: str = Query("staff"),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    from app.services.rental_registration import RentalRegistrationService
    form = await RentalRegistrationService(db).get_active_form(vendor_id, channel)
    return {"enabled": bool(form), "form": form}


@router.get("/registration-forms/submissions")
async def list_registration_submissions(
    form_id: UUID | None = Query(None),
    deleted_only: bool = Query(False),
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    from app.services.rental_registration import RentalRegistrationService
    return await RentalRegistrationService(db).list_submissions(
        vendor_id, form_id, deleted_only=deleted_only
    )


@router.post(
    "/registration-forms/submissions/{submission_id}/restore",
    dependencies=[Depends(require_permission("rentals.manage"))],
)
async def restore_registration_submission(
    submission_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    """Restore a discarded registration submission from the bin."""
    from app.services.rental_registration import RentalRegistrationService
    return await RentalRegistrationService(db).restore_submission(vendor_id, submission_id)


@router.post("/registration-forms/upload-image", dependencies=[Depends(require_permission("rentals.manage"))])
async def upload_registration_form_image(
    file: UploadFile = File(...),
    vendor_id: UUID = Depends(get_current_vendor_id),
    _user: User = Depends(get_current_active_user),
):
    from app.services.media_upload import save_image_file
    url = await save_image_file(file, f"rental-registration/{vendor_id}")
    return {"url": url}


@router.post("/registration-forms/submissions", status_code=201, dependencies=[Depends(require_permission("rentals.manage"))])
async def create_registration_submission(
    body: dict,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    from app.services.rental_registration import RentalRegistrationService
    return await RentalRegistrationService(db).create_submission(vendor_id, body)


@router.get("/registration-forms/{form_id}")
async def get_registration_form(
    form_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    from app.services.rental_registration import RentalRegistrationService
    return await RentalRegistrationService(db).get_form(vendor_id, form_id)


@router.post("/registration-forms", status_code=201, dependencies=[Depends(require_permission("rentals.manage"))])
async def create_registration_form(
    body: dict,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    from app.services.rental_registration import RentalRegistrationService
    return await RentalRegistrationService(db).create_form(vendor_id, body)


@router.patch("/registration-forms/{form_id}", dependencies=[Depends(require_permission("rentals.manage"))])
async def update_registration_form(
    form_id: UUID,
    body: dict,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    from app.services.rental_registration import RentalRegistrationService
    return await RentalRegistrationService(db).update_form(vendor_id, form_id, body)


@router.delete("/registration-forms/{form_id}", status_code=204, dependencies=[Depends(require_permission("rentals.manage"))])
async def delete_registration_form(
    form_id: UUID,
    vendor_id: UUID = Depends(get_current_vendor_id),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    from app.services.rental_registration import RentalRegistrationService
    await RentalRegistrationService(db).delete_form(vendor_id, form_id)
