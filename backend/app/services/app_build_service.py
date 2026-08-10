# app/services/app_build_service.py
"""
Service layer for vendor branded-app builds.
Generates config.json for the mobile build, creates build records,
materializes vendor assets under mobile/vendors/<slug>/, and tracks status.
"""
from __future__ import annotations

import json
import logging
import os
import shutil
from pathlib import Path
from typing import Optional, Tuple, List
from uuid import UUID
from urllib.parse import urlparse

from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vendor import Vendor
from app.models.vendor_app_build import VendorAppBuild
from app.models.vendor_plan import VendorPlan

logger = logging.getLogger(__name__)


def _backend_root() -> Path:
    # backend/app/services/app_build_service.py → backend/ (or /app in Docker)
    return Path(__file__).resolve().parents[2]


def _project_root() -> Path:
    """
    Repo root when running from the monorepo (…/KITERP).
    In Docker only ./backend is mounted at /app — then backend root is used
    and mobile/ is expected at /app/mobile (compose bind-mount).
    """
    backend = _backend_root()
    monorepo_mobile = backend.parent / "mobile"
    docker_mobile = backend / "mobile"
    if docker_mobile.is_dir():
        return backend
    if monorepo_mobile.is_dir():
        return backend.parent
    return backend.parent if (backend.parent / "scripts").is_dir() else backend


def _mobile_vendors_dir() -> Path:
    backend = _backend_root()
    docker_vendors = backend / "mobile" / "vendors"
    if (backend / "mobile").is_dir():
        return docker_vendors
    return _project_root() / "mobile" / "vendors"


def _uploads_dir() -> Path:
    return _backend_root() / "uploads"


class AppBuildService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_vendor(self, vendor_id: UUID) -> Vendor:
        result = await self.db.execute(select(Vendor).where(Vendor.id == vendor_id))
        vendor = result.scalar_one_or_none()
        if not vendor:
            raise ValueError("Vendor not found")
        return vendor

    async def _check_branded_app_entitlement(self, vendor: Vendor) -> bool:
        """Return True if the vendor's plan includes branded_app."""
        if not vendor.plan_id:
            return False
        result = await self.db.execute(
            select(VendorPlan).where(VendorPlan.id == vendor.plan_id)
        )
        plan = result.scalar_one_or_none()
        if not plan:
            return False
        features = plan.features or {}
        return features.get("branded_app", False)

    def _generate_config(self, vendor: Vendor) -> dict:
        """Build the config.json that app.config.js reads at build time."""
        app_cfg = vendor.app_config or {}
        slug = vendor.slug

        suffix = app_cfg.get("bundle_id_suffix", slug.replace("-", ""))
        bundle_id = f"com.kiterp.vendor.{suffix}"
        storefront = (
            app_cfg.get("storefront_base_url")
            or os.environ.get("STOREFRONT_PUBLIC_URL")
            or os.environ.get("EXPO_PUBLIC_STOREFRONT_URL")
            or "https://kiterp.com"
        )

        return {
            "name": app_cfg.get("app_name") or vendor.display_name,
            "slug": f"kiterp-{slug}",
            "scheme": f"kiterp-{slug}",
            "bundleId": bundle_id,
            "package": bundle_id,
            "primaryColor": app_cfg.get("primary_color")
            or (vendor.theme_config or {}).get("primary_color", "#2563eb"),
            "splashColor": app_cfg.get("splash_color")
            or app_cfg.get("primary_color")
            or "#2563eb",
            "vendorSlug": slug,
            "vendorId": str(vendor.id),
            "logoUrl": app_cfg.get("icon_url") or vendor.logo_url,
            "storefrontBaseUrl": storefront,
        }

    def materialize_vendor_files(
        self, vendor: Vendor, config: Optional[dict] = None
    ) -> dict:
        """
        Write mobile/vendors/<slug>/config.json (+ icon assets when available)
        and vendors/_build_target.json so EAS/app.config.js pick the right brand.
        Returns a status dict for the admin UI.
        """
        cfg = config or self._generate_config(vendor)
        slug = cfg.get("vendorSlug") or vendor.slug
        vendor_dir = _mobile_vendors_dir() / slug
        vendor_dir.mkdir(parents=True, exist_ok=True)

        config_path = vendor_dir / "config.json"
        config_path.write_text(json.dumps(cfg, indent=2), encoding="utf-8")

        icon_written = self._materialize_icon(
            vendor_dir, cfg.get("logoUrl") or (vendor.app_config or {}).get("icon_url")
        )

        target_path = _mobile_vendors_dir() / "_build_target.json"
        target_path.write_text(
            json.dumps({"vendorSlug": slug, "vendorId": str(vendor.id)}, indent=2),
            encoding="utf-8",
        )

        return {
            "vendor_slug": slug,
            "config_path": str(config_path.relative_to(_project_root())).replace("\\", "/"),
            "icon_ready": icon_written,
            "target_path": str(target_path.relative_to(_project_root())).replace("\\", "/"),
            "files_ready": True,
        }

    def _materialize_icon(self, vendor_dir: Path, icon_url: Optional[str]) -> bool:
        if not icon_url:
            return False

        dest = vendor_dir / "icon.png"
        adaptive = vendor_dir / "adaptive-icon.png"

        try:
            raw = (icon_url or "").strip()
            local_src: Optional[Path] = None

            # data:image/...;base64,... (legacy admin saves / pasted icons)
            if raw.startswith("data:image/"):
                import base64

                _header, _, b64 = raw.partition(",")
                if b64:
                    data = base64.b64decode(b64)
                    dest.write_bytes(data)
                    adaptive.write_bytes(data)
                    return True

            if raw.startswith("/uploads/"):
                local_src = _uploads_dir() / raw[len("/uploads/") :]
            elif raw.startswith("uploads/"):
                local_src = _uploads_dir() / raw[len("uploads/") :]
            else:
                parsed = urlparse(raw)
                if parsed.path.startswith("/uploads/"):
                    local_src = _uploads_dir() / parsed.path[len("/uploads/") :]

            if local_src and local_src.is_file():
                shutil.copyfile(local_src, dest)
                shutil.copyfile(local_src, adaptive)
                return True

            # Remote HTTP(S) download
            if raw.startswith("http://") or raw.startswith("https://"):
                import urllib.request

                with urllib.request.urlopen(raw, timeout=30) as resp:
                    data = resp.read()
                if data:
                    dest.write_bytes(data)
                    adaptive.write_bytes(data)
                    return True
        except Exception as e:
            logger.warning("Could not materialize app icon for %s: %s", vendor_dir, e)

        return dest.is_file()

    async def update_app_config(self, vendor_id: UUID, updates: dict) -> dict:
        """Update the vendor.app_config JSONB field and materialize vendor files."""
        from sqlalchemy.orm.attributes import flag_modified

        vendor = await self._get_vendor(vendor_id)
        current = dict(vendor.app_config or {})
        for k, v in updates.items():
            if v is not None:
                current[k] = v
        vendor.app_config = current
        flag_modified(vendor, "app_config")
        await self.db.commit()
        await self.db.refresh(vendor)

        files = self.materialize_vendor_files(vendor)
        result = dict(vendor.app_config or {})
        result["_files"] = files
        return result

    async def get_app_config(self, vendor_id: UUID) -> dict:
        vendor = await self._get_vendor(vendor_id)
        cfg = dict(vendor.app_config or {})
        slug = vendor.slug
        vendor_dir = _mobile_vendors_dir() / slug
        cfg["_files"] = {
            "vendor_slug": slug,
            "config_path": f"mobile/vendors/{slug}/config.json",
            "icon_ready": (vendor_dir / "icon.png").is_file(),
            "files_ready": (vendor_dir / "config.json").is_file(),
        }
        return cfg

    async def trigger_build(
        self,
        vendor_id: UUID,
        platform: str,
        triggered_by: Optional[UUID] = None,
        *,
        require_entitlement: bool = True,
    ) -> VendorAppBuild:
        """
        Create a build record, write vendor files to disk, mark config_generated.
        The EAS build is picked up by scripts/build-runner.py.
        """
        vendor = await self._get_vendor(vendor_id)

        if require_entitlement:
            has_entitlement = await self._check_branded_app_entitlement(vendor)
            if not has_entitlement:
                raise PermissionError(
                    "Vendor plan does not include branded app. "
                    "Upgrade to a plan with branded_app feature."
                )

        config = self._generate_config(vendor)
        files = self.materialize_vendor_files(vendor, config)
        config["_files"] = files

        profile_map = {
            "android": "vendor-android",
            "ios": "vendor-ios",
            "all": "vendor-all",
        }

        build = VendorAppBuild(
            vendor_id=vendor_id,
            platform=platform,
            build_profile=profile_map.get(platform, "vendor-all"),
            status="config_generated",
            config_snapshot=config,
            triggered_by=triggered_by,
        )
        self.db.add(build)
        await self.db.commit()
        await self.db.refresh(build)
        return build

    async def list_builds(
        self, vendor_id: Optional[UUID] = None, status: Optional[str] = None
    ) -> Tuple[List[VendorAppBuild], int]:
        query = select(VendorAppBuild)
        count_query = select(func.count(VendorAppBuild.id))

        if vendor_id:
            query = query.where(VendorAppBuild.vendor_id == vendor_id)
            count_query = count_query.where(VendorAppBuild.vendor_id == vendor_id)
        if status:
            query = query.where(VendorAppBuild.status == status)
            count_query = count_query.where(VendorAppBuild.status == status)

        query = query.order_by(desc(VendorAppBuild.created_at))

        result = await self.db.execute(query)
        items = list(result.scalars().all())

        count_result = await self.db.execute(count_query)
        total = count_result.scalar() or 0

        return items, total

    async def get_build(self, build_id: UUID) -> Optional[VendorAppBuild]:
        result = await self.db.execute(
            select(VendorAppBuild).where(VendorAppBuild.id == build_id)
        )
        return result.scalar_one_or_none()

    async def delete_build(self, build_id: UUID) -> bool:
        """Delete a build record. Returns True if deleted, False if not found."""
        build = await self.get_build(build_id)
        if not build:
            return False
        await self.db.delete(build)
        await self.db.commit()
        return True

    async def pause_build(self, build_id: UUID) -> VendorAppBuild:
        """Pause a queued or in-progress build so the runner will not continue it."""
        build = await self.get_build(build_id)
        if not build:
            raise ValueError("Build not found")
        if build.status not in ("pending", "config_generated", "building"):
            raise PermissionError(
                f"Cannot pause a build in '{build.status}' status"
            )
        build.status = "paused"
        build.error_message = None
        await self.db.commit()
        await self.db.refresh(build)
        return build

    async def resume_build(self, build_id: UUID) -> VendorAppBuild:
        """Resume a paused (or failed) build back into the runner queue."""
        build = await self.get_build(build_id)
        if not build:
            raise ValueError("Build not found")
        if build.status not in ("paused", "failed"):
            raise PermissionError(
                f"Cannot resume a build in '{build.status}' status"
            )
        # Re-materialize vendor files from snapshot / current vendor config
        vendor = await self._get_vendor(build.vendor_id)
        config = build.config_snapshot or self._generate_config(vendor)
        if isinstance(config, dict):
            clean = {k: v for k, v in config.items() if not str(k).startswith("_")}
            files = self.materialize_vendor_files(vendor, clean)
            clean["_files"] = files
            build.config_snapshot = clean
        build.status = "config_generated"
        build.error_message = None
        await self.db.commit()
        await self.db.refresh(build)
        return build

    async def update_build_status(
        self,
        build_id: UUID,
        status: str,
        eas_build_id_android: Optional[str] = None,
        eas_build_id_ios: Optional[str] = None,
        artifact_url_android: Optional[str] = None,
        artifact_url_ios: Optional[str] = None,
        error_message: Optional[str] = None,
    ) -> VendorAppBuild:
        """Called by the build script or webhook to update build progress."""
        build = await self.get_build(build_id)
        if not build:
            raise ValueError("Build not found")

        # Respect admin pause — don't let the runner overwrite a paused row
        if build.status == "paused" and status in ("building", "built", "config_generated"):
            return build

        build.status = status
        if eas_build_id_android:
            build.eas_build_id_android = eas_build_id_android
        if eas_build_id_ios:
            build.eas_build_id_ios = eas_build_id_ios
        if artifact_url_android:
            build.artifact_url_android = artifact_url_android
        if artifact_url_ios:
            build.artifact_url_ios = artifact_url_ios
        if error_message is not None:
            build.error_message = error_message

        if status == "built":
            from datetime import datetime, timezone

            build.built_at = datetime.now(timezone.utc)
        elif status == "published":
            from datetime import datetime, timezone

            build.published_at = datetime.now(timezone.utc)

        await self.db.commit()
        await self.db.refresh(build)
        return build

    async def get_pending_builds(self) -> List[VendorAppBuild]:
        """Get builds that are ready to be picked up by the build script."""
        result = await self.db.execute(
            select(VendorAppBuild)
            .where(VendorAppBuild.status == "config_generated")
            .order_by(VendorAppBuild.created_at)
        )
        return list(result.scalars().all())

    def write_vendor_config_to_disk(self, config: dict, vendor_slug: str) -> str:
        """Backward-compatible wrapper used by the API trigger endpoint."""
        vendor_dir = _mobile_vendors_dir() / vendor_slug
        vendor_dir.mkdir(parents=True, exist_ok=True)
        config_path = vendor_dir / "config.json"
        config_path.write_text(json.dumps(config, indent=2), encoding="utf-8")
        target_path = _mobile_vendors_dir() / "_build_target.json"
        target_path.write_text(
            json.dumps({"vendorSlug": vendor_slug}, indent=2), encoding="utf-8"
        )
        self._materialize_icon(vendor_dir, config.get("logoUrl") or config.get("icon_url"))
        return str(config_path)
