# app/services/app_build_service.py
"""
Service layer for vendor branded-app builds.
Generates config.json for the mobile build, creates build records,
and provides the interface for the build script to update status.
"""
import json
import os
from typing import Optional, Tuple, List
from uuid import UUID

from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vendor import Vendor
from app.models.vendor_app_build import VendorAppBuild
from app.models.vendor_plan import VendorPlan


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
        }

    async def update_app_config(
        self, vendor_id: UUID, updates: dict
    ) -> dict:
        """Update the vendor.app_config JSONB field."""
        vendor = await self._get_vendor(vendor_id)
        current = dict(vendor.app_config or {})
        for k, v in updates.items():
            if v is not None:
                current[k] = v
        vendor.app_config = current
        await self.db.commit()
        await self.db.refresh(vendor)
        return vendor.app_config

    async def get_app_config(self, vendor_id: UUID) -> dict:
        vendor = await self._get_vendor(vendor_id)
        return vendor.app_config or {}

    async def trigger_build(
        self,
        vendor_id: UUID,
        platform: str,
        triggered_by: Optional[UUID] = None,
    ) -> VendorAppBuild:
        """
        Create a build record and generate the config snapshot.
        The actual EAS build is triggered by the build script polling for
        pending builds or by a webhook.
        """
        vendor = await self._get_vendor(vendor_id)

        has_entitlement = await self._check_branded_app_entitlement(vendor)
        if not has_entitlement:
            raise PermissionError(
                "Vendor plan does not include branded app. "
                "Upgrade to a plan with branded_app feature."
            )

        config = self._generate_config(vendor)

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

        build.status = status
        if eas_build_id_android:
            build.eas_build_id_android = eas_build_id_android
        if eas_build_id_ios:
            build.eas_build_id_ios = eas_build_id_ios
        if artifact_url_android:
            build.artifact_url_android = artifact_url_android
        if artifact_url_ios:
            build.artifact_url_ios = artifact_url_ios
        if error_message:
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
        """
        Write the config.json to mobile/vendors/<slug>/config.json
        so the build script can use it. Returns the path written.
        """
        base_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "..", "mobile", "vendors", vendor_slug,
        )
        os.makedirs(base_dir, exist_ok=True)
        config_path = os.path.join(base_dir, "config.json")
        with open(config_path, "w") as f:
            json.dump(config, f, indent=2)
        return config_path
