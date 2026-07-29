"""Part 11-style electronic signature helpers for the Pharma module (Stage A / phase 7)."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_password
from app.models.pharma import PharmaAuditEvent
from app.models.user import User
from app.models.vendor import Vendor
from app.models.vendor_user import VendorUser
from app.services.pharma_batch import append_pharma_audit
from app.services.totp_service import verify_totp

PHARMA_SETTINGS_KEY = "pharma"

VALID_MEANINGS = frozenset({"author", "reviewer", "approver"})

DEFAULT_PHARMA_SETTINGS: dict[str, Any] = {
    "esign_required": True,
    "dual_sign_release": True,
    "dual_sign_bpr_complete": True,
    "dual_sign_capa_close": False,
    "dual_sign_cc_approve": False,
    # N-approver matrices (min total signatures required per action)
    # 0 = N/A (no multi-sign policy); 1 = single; 2+ = multi-sign with distinct reviewers
    "min_approvers_release": 2,
    "min_approvers_bpr_complete": 2,
    "min_approvers_capa_close": 1,
    "min_approvers_cc_approve": 1,
    "bpr_required_before_release": False,
    # Stage B — lightweight training / competency gate for release
    "release_training_required": False,
    "release_qualified_ids": [],
    # Stage C — GDP / track & trace
    "wholesale_license_check": False,
    "track_trace_region": "none",  # none | us | eu
    "auto_epcis_on_serial": True,
    # DSCSA VRS (Verification Router Service) credentials — leave empty to use local stub
    "vrs_endpoint": "",   # e.g. https://vrs.example.com/api/verify
    "vrs_api_key": "",    # Bearer token for VRS
    # GS1 company prefix for proper SGTIN encoding in EPCIS
    "gs1_company_prefix": "",  # e.g. "0614141"
    # EU FMD / NMVS credentials — leave empty when not an NMVO member
    "nmvs_endpoint": "",   # e.g. https://nmvs.example.com/decommission
    "nmvs_api_key": "",    # NMVS API key
}


def get_pharma_settings(vendor_settings: dict | None) -> dict[str, Any]:
    raw = (vendor_settings or {}).get(PHARMA_SETTINGS_KEY) or {}
    out = dict(DEFAULT_PHARMA_SETTINGS)
    if isinstance(raw, dict):
        for k, v in raw.items():
            if k not in out:
                continue
            if isinstance(out[k], bool):
                out[k] = bool(v)
            elif isinstance(out[k], int):
                try:
                    n = int(v)
                    # Approver counts: 0 = N/A, 1–10 = required signatures
                    if k.startswith("min_approvers_"):
                        out[k] = max(0, min(10, n))
                    else:
                        out[k] = max(1, n)
                except (TypeError, ValueError):
                    pass
            elif isinstance(out[k], list):
                if isinstance(v, list):
                    out[k] = [str(x) for x in v if x]
                elif v:
                    out[k] = [str(v)]
                else:
                    out[k] = []
            else:
                out[k] = v
    return out


def resolve_approver_requirement(
    cfg: dict[str, Any],
    key: str,
    default: int = 1,
) -> tuple[int, bool]:
    """Return ``(required_approvers, dual_sign_required)`` for an action.

    ``0`` (N/A) means no multi-sign policy — treat as single sign when e-sign
    is globally enabled. ``1`` = single; ``2–10`` = multi-sign with distinct reviewers.
    """
    try:
        n = int(cfg.get(key, default))
    except (TypeError, ValueError):
        n = default
    n = max(0, min(10, n))
    if n <= 0:
        return 1, False
    return n, n >= 2


async def load_pharma_settings(db: AsyncSession, vendor_id: UUID) -> dict[str, Any]:
    vendor = (
        await db.execute(select(Vendor).where(Vendor.id == vendor_id))
    ).scalar_one_or_none()
    return get_pharma_settings(vendor.settings if vendor else None)


async def resolve_track_trace_region(
    db: AsyncSession,
    vendor_id: UUID,
    *,
    plant_id: Optional[UUID] = None,
    store_id: Optional[UUID] = None,
    settings: Optional[dict[str, Any]] = None,
) -> str:
    """Return the effective Track & Trace region for a given plant/store context.

    Resolution: plant override  >  store override  >  vendor default (settings JSON).
    Returns a string in ``{"none", "us", "eu"}``.
    """
    from app.models.pharma import PharmaOrgRegion

    if plant_id is not None:
        row = (
            await db.execute(
                select(PharmaOrgRegion).where(
                    PharmaOrgRegion.vendor_id == vendor_id,
                    PharmaOrgRegion.plant_id == plant_id,
                )
            )
        ).scalar_one_or_none()
        if row:
            return str(row.track_trace_region or "none")

    if store_id is not None:
        # Also try the parent BU if the store is a branch
        from app.models.store import Store
        store_chain: list[UUID] = [store_id]
        parent = (
            await db.execute(select(Store.parent_id).where(Store.id == store_id))
        ).scalar_one_or_none()
        if parent:
            store_chain.append(parent)
        for sid in store_chain:
            row = (
                await db.execute(
                    select(PharmaOrgRegion).where(
                        PharmaOrgRegion.vendor_id == vendor_id,
                        PharmaOrgRegion.store_id == sid,
                    )
                )
            ).scalar_one_or_none()
            if row:
                return str(row.track_trace_region or "none")

    cfg = settings or await load_pharma_settings(db, vendor_id)
    return str(cfg.get("track_trace_region") or "none")


def assert_release_qualified(cfg: dict[str, Any], vu: VendorUser) -> None:
    """Stage B: optional competency gate for pharma.release actions."""
    if not cfg.get("release_training_required"):
        return
    qualified = {str(x) for x in (cfg.get("release_qualified_ids") or [])}
    # Owners/admins always pass — they manage the qualified list
    if (vu.role or "").lower() in ("owner", "admin"):
        return
    if str(vu.id) not in qualified:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Release training / competency required — ask an admin to qualify this user",
        )


@dataclass
class ESignContext:
    """Result of a verified e-sign attempt."""

    meaning: str
    actor_id: UUID
    actor_name: Optional[str]
    complete: bool
    signatures: list[dict[str, Any]]
    message: Optional[str] = None


async def _load_user(db: AsyncSession, vu: VendorUser) -> User:
    user = (
        await db.execute(select(User).where(User.id == vu.user_id))
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Signer user account not found")
    return user


async def _log_failed(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    entity_type: str,
    entity_id: UUID,
    vu: VendorUser,
    actor_name: Optional[str],
    reason: str,
    meaning: Optional[str],
    ip_address: Optional[str],
) -> None:
    await append_pharma_audit(
        db,
        vendor_id=vendor_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action="esign_failed",
        actor_id=vu.id,
        actor_name=actor_name,
        meaning=meaning,
        new_value={"reason": reason},
        ip_address=ip_address,
        esign_verified=False,
    )


async def verify_and_record_esign(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    vu: VendorUser,
    entity_type: str,
    entity_id: UUID,
    action: str,
    password: Optional[str],
    meaning: Optional[str],
    totp_code: Optional[str] = None,
    dual_sign_required: bool = False,
    required_approvers: int = 1,
    existing_signatures: Optional[list] = None,
    ip_address: Optional[str] = None,
    extra_new_value: Optional[dict] = None,
    settings: Optional[dict[str, Any]] = None,
) -> ESignContext:
    """
    Verify credentials and append a signed audit event.

    When dual_sign_required (or required_approvers > 1):
      - First sign must be author/reviewer; complete=False
      - Subsequent approver signatures from different actors accumulate
      - complete=True once required_approvers unique approvers have signed
    When not dual and required_approvers == 1: any valid meaning completes in one step.
    """
    # Normalise: dual_sign_required is shorthand for required_approvers >= 2
    if dual_sign_required and required_approvers < 2:
        required_approvers = 2
    cfg = settings or await load_pharma_settings(db, vendor_id)
    if not cfg.get("esign_required", True):
        return ESignContext(
            meaning=meaning or "approver",
            actor_id=vu.id,
            actor_name=None,
            complete=True,
            signatures=list(existing_signatures or []),
            message="e-sign disabled in vendor pharma settings",
        )

    user = await _load_user(db, vu)
    actor_name = (user.full_name or user.email or str(vu.id))[:255]
    meaning_norm = (meaning or "").strip().lower()

    if meaning_norm not in VALID_MEANINGS:
        await _log_failed(
            db, vendor_id=vendor_id, entity_type=entity_type, entity_id=entity_id,
            vu=vu, actor_name=actor_name, reason="invalid_meaning", meaning=meaning,
            ip_address=ip_address,
        )
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"meaning must be one of: {', '.join(sorted(VALID_MEANINGS))}",
        )

    if not password:
        await _log_failed(
            db, vendor_id=vendor_id, entity_type=entity_type, entity_id=entity_id,
            vu=vu, actor_name=actor_name, reason="password_required", meaning=meaning_norm,
            ip_address=ip_address,
        )
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Password re-authentication required to sign",
        )

    if not verify_password(password, user.password_hash or ""):
        await _log_failed(
            db, vendor_id=vendor_id, entity_type=entity_type, entity_id=entity_id,
            vu=vu, actor_name=actor_name, reason="invalid_password", meaning=meaning_norm,
            ip_address=ip_address,
        )
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid password for electronic signature")

    if getattr(user, "is_2fa_enabled", False):
        secret = getattr(user, "totp_secret", None)
        if not totp_code or not secret or not verify_totp(secret, totp_code):
            await _log_failed(
                db, vendor_id=vendor_id, entity_type=entity_type, entity_id=entity_id,
                vu=vu, actor_name=actor_name, reason="invalid_totp", meaning=meaning_norm,
                ip_address=ip_address,
            )
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED,
                "Valid TOTP code required for electronic signature",
            )

    sigs = [s for s in (existing_signatures or []) if isinstance(s, dict)]
    now = datetime.now(timezone.utc).isoformat()
    entry = {
        "at": now,
        "by": str(vu.id),
        "by_name": actor_name,
        "meaning": meaning_norm,
        "action": action,
    }

    complete = True
    message = None

    if required_approvers > 1:
        reviewers = [s for s in sigs if s.get("meaning") in ("author", "reviewer")]
        approvers = [s for s in sigs if s.get("meaning") == "approver"]
        unique_approver_ids = {s.get("by") for s in approvers}
        needed = required_approvers - 1  # reviewer fills slot 0; remaining are approvers

        if len(approvers) >= needed and reviewers:
            # Already fully signed
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Action already fully signed")

        if not reviewers:
            # First signature must be reviewer/author
            if meaning_norm == "approver":
                await _log_failed(
                    db, vendor_id=vendor_id, entity_type=entity_type, entity_id=entity_id,
                    vu=vu, actor_name=actor_name, reason="reviewer_required_first",
                    meaning=meaning_norm, ip_address=ip_address,
                )
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "Multi-sign required: first signature must be author or reviewer",
                )
            sigs.append(entry)
            complete = False
            message = (
                f"Reviewer signature recorded — awaiting {needed} approver(s) from different user(s)"
            )
        else:
            # Collecting approvers
            if meaning_norm != "approver":
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "Multi-sign: subsequent signatures must be meaning=approver",
                )
            prior_ids = {s.get("by") for s in reviewers} | unique_approver_ids
            if str(vu.id) in prior_ids:
                await _log_failed(
                    db, vendor_id=vendor_id, entity_type=entity_type, entity_id=entity_id,
                    vu=vu, actor_name=actor_name, reason="same_signer",
                    meaning=meaning_norm, ip_address=ip_address,
                )
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "Multi-sign requires a different user for each approver signature",
                )
            sigs.append(entry)
            new_approver_count = len(approvers) + 1
            if new_approver_count >= needed:
                complete = True
                message = "All required approvers signed — action complete"
            else:
                complete = False
                remaining = needed - new_approver_count
                message = f"Approver {new_approver_count}/{needed} recorded — {remaining} more needed"
    else:
        sigs.append(entry)
        complete = True

    new_value = {
        "esign": True,
        "meaning": meaning_norm,
        "complete": complete,
        "signatures": sigs,
        **(extra_new_value or {}),
    }
    await append_pharma_audit(
        db,
        vendor_id=vendor_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action="esign" if not complete else action,
        actor_id=vu.id,
        actor_name=actor_name,
        meaning=meaning_norm,
        new_value=new_value,
        ip_address=ip_address,
        esign_verified=True,
    )

    return ESignContext(
        meaning=meaning_norm,
        actor_id=vu.id,
        actor_name=actor_name,
        complete=complete,
        signatures=sigs,
        message=message,
    )


async def list_recent_esign_failures(
    db: AsyncSession,
    vendor_id: UUID,
    *,
    limit: int = 50,
) -> list[PharmaAuditEvent]:
    rows = (
        await db.execute(
            select(PharmaAuditEvent)
            .where(
                PharmaAuditEvent.vendor_id == vendor_id,
                PharmaAuditEvent.action == "esign_failed",
            )
            .order_by(PharmaAuditEvent.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    return list(rows)


async def load_pending_signatures(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    entity_type: str,
    entity_id: UUID,
) -> list[dict[str, Any]]:
    """Return signature bucket from the latest incomplete e-sign event, if any."""
    evt = (
        await db.execute(
            select(PharmaAuditEvent)
            .where(
                PharmaAuditEvent.vendor_id == vendor_id,
                PharmaAuditEvent.entity_type == entity_type,
                PharmaAuditEvent.entity_id == entity_id,
                PharmaAuditEvent.esign_verified.is_(True),
                PharmaAuditEvent.action == "esign",
            )
            .order_by(PharmaAuditEvent.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if not evt or not isinstance(evt.new_value, dict):
        return []
    if evt.new_value.get("complete"):
        return []
    sigs = evt.new_value.get("signatures") or []
    return [s for s in sigs if isinstance(s, dict)]
