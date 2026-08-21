"""Google Forms-style rental registration templates and submissions."""

from __future__ import annotations

import re
from typing import Optional
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.models.rental import (
    RentalBooking,
    RentalRegistrationForm,
    RentalRegistrationSubmission,
)

ALLOWED_FIELD_TYPES = {
    "text", "textarea", "email", "phone", "number", "date", "select", "checkbox", "heading", "terms", "image",
}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _field_key(field: dict) -> str:
    return str(field.get("key") or field.get("id") or "").strip()


def _clean_fields(raw) -> list[dict]:
    if not isinstance(raw, list):
        return []
    out: list[dict] = []
    seen: set[str] = set()
    for i, item in enumerate(raw):
        if not isinstance(item, dict):
            continue
        ftype = str(item.get("type") or "text").strip().lower()
        if ftype not in ALLOWED_FIELD_TYPES:
            ftype = "text"
        key = re.sub(r"[^a-z0-9_]+", "_", str(item.get("key") or item.get("id") or f"field_{i+1}").lower()).strip("_")
        if not key:
            key = f"field_{i+1}"
        base = key
        n = 2
        while key in seen:
            key = f"{base}_{n}"
            n += 1
        seen.add(key)
        options = item.get("options") if isinstance(item.get("options"), list) else []
        content = ""
        if ftype == "terms":
            content = str(item.get("content") or item.get("help") or "")[:8000]
        out.append({
            "id": str(item.get("id") or key),
            "key": key,
            "label": str(item.get("label") or key.replace("_", " ").title())[:160],
            "type": ftype,
            "required": bool(item.get("required")) if ftype != "terms" else bool(item.get("required", True)),
            "placeholder": str(item.get("placeholder") or "")[:200],
            "help": str(item.get("help") or "")[:400],
            "content": content,
            "options": [str(o)[:80] for o in options if str(o).strip()][:30],
        })
    return out[:80]


def _clean_theme(raw) -> dict:
    if not isinstance(raw, dict):
        raw = {}
    accent = str(raw.get("accent") or "#0f766e")
    if not re.match(r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$", accent):
        accent = "#0f766e"
    layout = str(raw.get("layout") or "card")
    if layout not in ("card", "split", "minimal"):
        layout = "card"
    logo = str(raw.get("logo_url") or "").strip()[:500]
    if logo and not (
        logo.startswith("/uploads/")
        or logo.startswith("http://")
        or logo.startswith("https://")
        or logo.startswith("data:image/")
    ):
        logo = ""
    return {
        "accent": accent,
        "layout": layout,
        "cover_title": str(raw.get("cover_title") or "")[:120],
        "cover_subtitle": str(raw.get("cover_subtitle") or "")[:240],
        "logo_url": logo,
        "company_name": str(raw.get("company_name") or "")[:120],
        "company_phone": str(raw.get("company_phone") or "")[:40],
        "company_address": str(raw.get("company_address") or "")[:240],
    }


def _validate_answers(fields: list[dict], answers: dict) -> dict:
    if not isinstance(answers, dict):
        answers = {}
    cleaned: dict = {}
    errors: list[str] = []
    for field in fields:
        key = _field_key(field)
        if not key:
            continue
        raw = answers.get(key, answers.get(field.get("id")))
        ftype = field.get("type") or "text"
        required = bool(field.get("required"))
        label = field.get("label") or key

        if ftype == "heading":
            continue

        if ftype in ("checkbox", "terms"):
            val = raw in (True, "true", "1", 1, "on", "yes")
            if required and not val:
                errors.append(f"{label} is required")
            cleaned[key] = val
            continue

        if raw is None:
            text = ""
        else:
            text = str(raw).strip()

        if required and not text:
            errors.append(f"{label} is required")
            continue
        if not text:
            cleaned[key] = ""
            continue

        if ftype == "image":
            ok = (
                text.startswith("/uploads/")
                or text.startswith("http://")
                or text.startswith("https://")
                or text.startswith("data:image/")
            )
            if not ok:
                errors.append(f"{label} must be an uploaded image")
            else:
                cleaned[key] = text[:2000]
            continue
        if ftype == "email" and not EMAIL_RE.match(text):
            errors.append(f"{label} must be a valid email")
        elif ftype == "number":
            try:
                float(text)
            except ValueError:
                errors.append(f"{label} must be a number")
        elif ftype == "select":
            options = [str(o) for o in (field.get("options") or [])]
            if options and text not in options:
                errors.append(f"{label} has an invalid option")
        cleaned[key] = text

    if errors:
        raise HTTPException(400, errors[0])
    return cleaned


class RentalRegistrationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _form_dict(self, form: RentalRegistrationForm, *, public: bool = False) -> dict:
        data = {
            "id": str(form.id),
            "name": form.name,
            "description": form.description or "",
            "template_key": form.template_key or "blank",
            "status": form.status or "draft",
            "version": int(form.version or 1),
            "fields": form.fields or [],
            "theme": form.theme or {},
            "use_on_storefront": bool(form.use_on_storefront),
            "use_on_staff_booking": bool(form.use_on_staff_booking),
            "created_at": form.created_at.isoformat() if form.created_at else None,
            "updated_at": form.updated_at.isoformat() if form.updated_at else None,
        }
        if public:
            return {
                "id": data["id"],
                "name": data["name"],
                "description": data["description"],
                "version": data["version"],
                "fields": data["fields"],
                "theme": data["theme"],
            }
        return data

    def _submission_dict(self, row: RentalRegistrationSubmission, form: Optional[RentalRegistrationForm] = None, booking: Optional[RentalBooking] = None) -> dict:
        return {
            "id": str(row.id),
            "form_id": str(row.form_id),
            "form_name": form.name if form else None,
            "form_version": int(row.form_version or 1),
            "booking_id": str(row.booking_id) if row.booking_id else None,
            "booking_number": booking.booking_number if booking else None,
            "customer_id": str(row.customer_id) if row.customer_id else None,
            "customer_name": row.customer_name,
            "channel": row.channel,
            "answers": row.answers or {},
            "fields": (form.fields or []) if form else [],
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "deleted_at": row.deleted_at.isoformat() if getattr(row, "deleted_at", None) else None,
        }

    async def _get_form(self, vendor_id: UUID, form_id: UUID) -> RentalRegistrationForm:
        result = await self.db.execute(
            select(RentalRegistrationForm).where(
                RentalRegistrationForm.id == form_id,
                RentalRegistrationForm.vendor_id == vendor_id,
            )
        )
        form = result.scalar_one_or_none()
        if not form:
            raise HTTPException(404, "Registration form not found")
        return form

    async def _clear_channel_flags(self, vendor_id: UUID, *, storefront: bool = False, staff: bool = False, except_id: Optional[UUID] = None):
        result = await self.db.execute(
            select(RentalRegistrationForm).where(RentalRegistrationForm.vendor_id == vendor_id)
        )
        for form in result.scalars().all():
            if except_id and form.id == except_id:
                continue
            if storefront:
                form.use_on_storefront = False
            if staff:
                form.use_on_staff_booking = False

    async def list_forms(self, vendor_id: UUID) -> list[dict]:
        result = await self.db.execute(
            select(RentalRegistrationForm)
            .where(RentalRegistrationForm.vendor_id == vendor_id)
            .order_by(RentalRegistrationForm.updated_at.desc())
        )
        forms = result.scalars().all()
        counts: dict[UUID, int] = {}
        if forms:
            cr = await self.db.execute(
                select(
                    RentalRegistrationSubmission.form_id,
                    func.count(RentalRegistrationSubmission.id),
                )
                .where(
                    RentalRegistrationSubmission.vendor_id == vendor_id,
                    RentalRegistrationSubmission.form_id.in_([f.id for f in forms]),
                    RentalRegistrationSubmission.deleted_at.is_(None),
                )
                .group_by(RentalRegistrationSubmission.form_id)
            )
            counts = {fid: int(n) for fid, n in cr.all()}
        out = []
        for form in forms:
            d = self._form_dict(form)
            d["submission_count"] = counts.get(form.id, 0)
            out.append(d)
        return out

    async def get_form(self, vendor_id: UUID, form_id: UUID) -> dict:
        form = await self._get_form(vendor_id, form_id)
        d = self._form_dict(form)
        cr = await self.db.execute(
            select(func.count(RentalRegistrationSubmission.id)).where(
                RentalRegistrationSubmission.vendor_id == vendor_id,
                RentalRegistrationSubmission.form_id == form.id,
                RentalRegistrationSubmission.deleted_at.is_(None),
            )
        )
        d["submission_count"] = int(cr.scalar() or 0)
        return d

    async def create_form(self, vendor_id: UUID, data: dict) -> dict:
        fields = _clean_fields(data.get("fields"))
        if not fields:
            raise HTTPException(400, "Add at least one field to the form")
        name = str(data.get("name") or "").strip()
        if not name:
            raise HTTPException(400, "Form name is required")
        form = RentalRegistrationForm(
            id=uuid4(),
            vendor_id=vendor_id,
            name=name[:160],
            description=str(data.get("description") or "")[:2000] or None,
            template_key=str(data.get("template_key") or "blank")[:40],
            status="published" if data.get("status") == "published" else "draft",
            version=1,
            fields=fields,
            theme=_clean_theme(data.get("theme")),
            use_on_storefront=bool(data.get("use_on_storefront")),
            use_on_staff_booking=bool(data.get("use_on_staff_booking")),
        )
        if form.use_on_storefront:
            form.status = "published"
            await self._clear_channel_flags(vendor_id, storefront=True)
        if form.use_on_staff_booking:
            await self._clear_channel_flags(vendor_id, staff=True)
        self.db.add(form)
        await self.db.commit()
        await self.db.refresh(form)
        return self._form_dict(form)

    async def update_form(self, vendor_id: UUID, form_id: UUID, data: dict) -> dict:
        form = await self._get_form(vendor_id, form_id)
        if "name" in data:
            name = str(data.get("name") or "").strip()
            if not name:
                raise HTTPException(400, "Form name is required")
            form.name = name[:160]
        if "description" in data:
            form.description = str(data.get("description") or "")[:2000] or None
        if "template_key" in data:
            form.template_key = str(data.get("template_key") or "blank")[:40]
        if "theme" in data:
            form.theme = _clean_theme(data.get("theme"))
        if "fields" in data:
            fields = _clean_fields(data.get("fields"))
            if not fields:
                raise HTTPException(400, "Add at least one field to the form")
            if fields != (form.fields or []) and form.status == "published":
                form.version = int(form.version or 1) + 1
            form.fields = fields
        if "status" in data:
            status = str(data.get("status") or "draft")
            if status not in ("draft", "published"):
                raise HTTPException(400, "Status must be draft or published")
            form.status = status
        if "use_on_storefront" in data:
            form.use_on_storefront = bool(data.get("use_on_storefront"))
            if form.use_on_storefront:
                form.status = "published"
                await self._clear_channel_flags(vendor_id, storefront=True, except_id=form.id)
        if "use_on_staff_booking" in data:
            form.use_on_staff_booking = bool(data.get("use_on_staff_booking"))
            if form.use_on_staff_booking:
                await self._clear_channel_flags(vendor_id, staff=True, except_id=form.id)
        await self.db.commit()
        await self.db.refresh(form)
        return self._form_dict(form)

    async def delete_form(self, vendor_id: UUID, form_id: UUID) -> None:
        form = await self._get_form(vendor_id, form_id)
        await self.db.execute(
            delete(RentalRegistrationSubmission).where(
                RentalRegistrationSubmission.form_id == form.id,
                RentalRegistrationSubmission.vendor_id == vendor_id,
            )
        )
        await self.db.delete(form)
        await self.db.commit()

    async def get_active_form(self, vendor_id: UUID, channel: str) -> Optional[dict]:
        q = select(RentalRegistrationForm).where(
            RentalRegistrationForm.vendor_id == vendor_id,
            RentalRegistrationForm.status == "published",
        )
        if channel == "staff":
            q = q.where(RentalRegistrationForm.use_on_staff_booking.is_(True))
        else:
            q = q.where(RentalRegistrationForm.use_on_storefront.is_(True))
        q = q.order_by(RentalRegistrationForm.updated_at.desc())
        result = await self.db.execute(q)
        form = result.scalars().first()
        if not form:
            return None
        return self._form_dict(form, public=channel != "staff")

    async def list_submissions(
        self,
        vendor_id: UUID,
        form_id: Optional[UUID] = None,
        *,
        deleted_only: bool = False,
    ) -> list[dict]:
        q = select(RentalRegistrationSubmission).where(RentalRegistrationSubmission.vendor_id == vendor_id)
        if form_id:
            q = q.where(RentalRegistrationSubmission.form_id == form_id)
        if deleted_only:
            q = q.where(RentalRegistrationSubmission.deleted_at.is_not(None))
            q = q.order_by(RentalRegistrationSubmission.deleted_at.desc()).limit(300)
        else:
            q = q.where(RentalRegistrationSubmission.deleted_at.is_(None))
            q = q.order_by(RentalRegistrationSubmission.created_at.desc()).limit(300)
        result = await self.db.execute(q)
        rows = result.scalars().all()
        form_ids = {r.form_id for r in rows}
        booking_ids = {r.booking_id for r in rows if r.booking_id}
        forms_map: dict = {}
        bookings_map: dict = {}
        if form_ids:
            fr = await self.db.execute(select(RentalRegistrationForm).where(RentalRegistrationForm.id.in_(form_ids)))
            forms_map = {f.id: f for f in fr.scalars().all()}
        if booking_ids:
            br = await self.db.execute(select(RentalBooking).where(RentalBooking.id.in_(booking_ids)))
            bookings_map = {b.id: b for b in br.scalars().all()}
        return [self._submission_dict(r, forms_map.get(r.form_id), bookings_map.get(r.booking_id) if r.booking_id else None) for r in rows]

    async def submissions_for_bookings(self, vendor_id: UUID, booking_ids: list[UUID]) -> dict[UUID, dict]:
        if not booking_ids:
            return {}
        result = await self.db.execute(
            select(RentalRegistrationSubmission)
            .where(
                RentalRegistrationSubmission.vendor_id == vendor_id,
                RentalRegistrationSubmission.booking_id.in_(booking_ids),
                RentalRegistrationSubmission.deleted_at.is_(None),
            )
            .order_by(RentalRegistrationSubmission.created_at.desc())
        )
        rows = result.scalars().all()
        form_ids = {r.form_id for r in rows}
        forms_map: dict = {}
        if form_ids:
            fr = await self.db.execute(select(RentalRegistrationForm).where(RentalRegistrationForm.id.in_(form_ids)))
            forms_map = {f.id: f for f in fr.scalars().all()}
        out: dict[UUID, dict] = {}
        for r in rows:
            if not r.booking_id or r.booking_id in out:
                continue
            out[r.booking_id] = self._submission_dict(r, forms_map.get(r.form_id))
        return out

    async def discarded_submissions_for_booking(self, vendor_id: UUID, booking_id: UUID) -> list[dict]:
        result = await self.db.execute(
            select(RentalRegistrationSubmission)
            .where(
                RentalRegistrationSubmission.vendor_id == vendor_id,
                RentalRegistrationSubmission.booking_id == booking_id,
                RentalRegistrationSubmission.deleted_at.is_not(None),
            )
            .order_by(RentalRegistrationSubmission.deleted_at.desc())
            .limit(50)
        )
        rows = result.scalars().all()
        form_ids = {r.form_id for r in rows}
        forms_map: dict = {}
        if form_ids:
            fr = await self.db.execute(select(RentalRegistrationForm).where(RentalRegistrationForm.id.in_(form_ids)))
            forms_map = {f.id: f for f in fr.scalars().all()}
        return [self._submission_dict(r, forms_map.get(r.form_id)) for r in rows]

    async def capture_for_booking(
        self,
        vendor_id: UUID,
        booking: RentalBooking,
        data: dict,
        *,
        created_by_vendor: bool,
    ) -> None:
        channel = "staff" if created_by_vendor else "storefront"
        form_data = await self.get_active_form(vendor_id, channel)
        if not form_data:
            return
        answers = data.get("registration_answers") or data.get("registration") or {}
        incoming_id = data.get("registration_form_id")
        if incoming_id and str(incoming_id) != str(form_data["id"]):
            raise HTTPException(400, "Registration form is out of date. Refresh and try again.")
        cleaned = _validate_answers(form_data.get("fields") or [], answers if isinstance(answers, dict) else {})
        await self._soft_delete_booking_submissions(vendor_id, booking.id)
        row = RentalRegistrationSubmission(
            id=uuid4(),
            vendor_id=vendor_id,
            form_id=UUID(form_data["id"]),
            form_version=int(form_data.get("version") or 1),
            booking_id=booking.id,
            customer_id=booking.customer_id,
            customer_name=booking.customer_name,
            channel=channel,
            answers=cleaned,
        )
        self.db.add(row)

    async def create_submission(self, vendor_id: UUID, data: dict) -> dict:
        """Staff / admin registers a customer against the storefront-enabled form."""
        form_data = await self.get_active_form(vendor_id, "storefront")
        if not form_data:
            raise HTTPException(400, "Enable a registration form for the storefront first.")
        incoming_id = data.get("form_id") or data.get("registration_form_id")
        if incoming_id and str(incoming_id) != str(form_data["id"]):
            raise HTTPException(400, "Only the storefront-enabled form can collect registrations here.")
        answers = data.get("answers") or data.get("registration_answers") or {}
        cleaned = _validate_answers(form_data.get("fields") or [], answers if isinstance(answers, dict) else {})
        name = str(data.get("customer_name") or "").strip()
        if not name:
            for key in ("full_name", "primary_guest", "organizer_name", "company_or_name"):
                val = cleaned.get(key)
                if isinstance(val, str) and val.strip():
                    name = val.strip()
                    break
        if not name:
            raise HTTPException(400, "Customer name is required")
        row = RentalRegistrationSubmission(
            id=uuid4(),
            vendor_id=vendor_id,
            form_id=UUID(form_data["id"]),
            form_version=int(form_data.get("version") or 1),
            customer_name=name[:255],
            channel="staff",
            answers=cleaned,
        )
        self.db.add(row)
        await self.db.commit()
        await self.db.refresh(row)
        form = await self._get_form(vendor_id, row.form_id)
        return self._submission_dict(row, form)

    async def _booking_owned(self, vendor_id: UUID, booking_id: UUID) -> RentalBooking:
        result = await self.db.execute(
            select(RentalBooking).where(
                RentalBooking.id == booking_id,
                RentalBooking.vendor_id == vendor_id,
            )
        )
        booking = result.scalar_one_or_none()
        if not booking:
            raise HTTPException(404, "Rental booking not found")
        return booking

    async def _soft_delete_booking_submissions(self, vendor_id: UUID, booking_id: UUID) -> int:
        result = await self.db.execute(
            select(RentalRegistrationSubmission).where(
                RentalRegistrationSubmission.vendor_id == vendor_id,
                RentalRegistrationSubmission.booking_id == booking_id,
                RentalRegistrationSubmission.deleted_at.is_(None),
            )
        )
        rows = result.scalars().all()
        now = datetime.now(timezone.utc)
        for row in rows:
            row.deleted_at = now
        return len(rows)

    async def discard_booking_registration(self, vendor_id: UUID, booking_id: UUID) -> dict:
        await self._booking_owned(vendor_id, booking_id)
        removed = await self._soft_delete_booking_submissions(vendor_id, booking_id)
        await self.db.commit()
        return {"ok": True, "removed": removed}

    async def restore_submission(self, vendor_id: UUID, submission_id: UUID) -> dict:
        result = await self.db.execute(
            select(RentalRegistrationSubmission).where(
                RentalRegistrationSubmission.id == submission_id,
                RentalRegistrationSubmission.vendor_id == vendor_id,
            )
        )
        row = result.scalar_one_or_none()
        if not row:
            raise HTTPException(404, "Registration submission not found")
        if row.deleted_at is None:
            raise HTTPException(400, "This registration is not discarded")

        # If restoring onto a booking that already has an active form, move that one to the bin.
        if row.booking_id:
            await self._soft_delete_booking_submissions(vendor_id, row.booking_id)

        row.deleted_at = None
        await self.db.commit()
        await self.db.refresh(row)
        form = await self._get_form(vendor_id, row.form_id)
        booking = None
        if row.booking_id:
            booking = await self._booking_owned(vendor_id, row.booking_id)
        return self._submission_dict(row, form, booking)

    async def replace_booking_registration(self, vendor_id: UUID, booking_id: UUID, data: dict) -> dict:
        """Discard any existing booking registration and save a new filled form."""
        booking = await self._booking_owned(vendor_id, booking_id)
        form_data = None
        incoming_id = data.get("form_id") or data.get("registration_form_id")
        if incoming_id:
            form = await self._get_form(vendor_id, UUID(str(incoming_id)))
            form_data = self._form_dict(form)
        else:
            existing = await self.submissions_for_bookings(vendor_id, [booking_id])
            prev = existing.get(booking_id)
            if prev and prev.get("form_id"):
                try:
                    form = await self._get_form(vendor_id, UUID(str(prev["form_id"])))
                    form_data = self._form_dict(form)
                except HTTPException:
                    form_data = None
            if not form_data:
                form_data = await self.get_active_form(vendor_id, "staff")
            if not form_data:
                form_data = await self.get_active_form(vendor_id, "storefront")
        if not form_data:
            raise HTTPException(400, "No registration form available. Enable a staff or storefront form first.")

        answers = data.get("answers") or data.get("registration_answers") or {}
        cleaned = _validate_answers(form_data.get("fields") or [], answers if isinstance(answers, dict) else {})
        name = str(data.get("customer_name") or booking.customer_name or "").strip()
        if not name:
            for key in ("full_name", "primary_guest", "organizer_name", "company_or_name"):
                val = cleaned.get(key)
                if isinstance(val, str) and val.strip():
                    name = val.strip()
                    break

        await self._soft_delete_booking_submissions(vendor_id, booking_id)
        row = RentalRegistrationSubmission(
            id=uuid4(),
            vendor_id=vendor_id,
            form_id=UUID(str(form_data["id"])),
            form_version=int(form_data.get("version") or 1),
            booking_id=booking.id,
            customer_id=booking.customer_id,
            customer_name=(name or booking.customer_name or "")[:255] or None,
            channel="staff",
            answers=cleaned,
        )
        self.db.add(row)
        await self.db.commit()
        await self.db.refresh(row)
        form = await self._get_form(vendor_id, row.form_id)
        return self._submission_dict(row, form, booking)
