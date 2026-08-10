# app/schemas/app_build.py
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from enum import Enum


class BuildPlatform(str, Enum):
    ANDROID = "android"
    IOS = "ios"
    ALL = "all"


class BuildStatus(str, Enum):
    PENDING = "pending"
    CONFIG_GENERATED = "config_generated"
    BUILDING = "building"
    PAUSED = "paused"
    BUILT = "built"
    SUBMITTED = "submitted"
    PUBLISHED = "published"
    FAILED = "failed"


class AppConfigUpdate(BaseModel):
    """Vendor-editable branded app settings stored in vendor.app_config."""
    app_name: Optional[str] = Field(None, min_length=2, max_length=50)
    primary_color: Optional[str] = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")
    icon_url: Optional[str] = None
    splash_color: Optional[str] = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")
    bundle_id_suffix: Optional[str] = Field(
        None, pattern=r"^[a-z][a-z0-9]*$", max_length=30,
        description="Appended to com.kiterp.vendor.<suffix>"
    )


class AppFilesStatus(BaseModel):
    vendor_slug: Optional[str] = None
    config_path: Optional[str] = None
    icon_ready: bool = False
    files_ready: bool = False
    target_path: Optional[str] = None


class AppConfigResponse(BaseModel):
    app_name: Optional[str] = None
    primary_color: Optional[str] = None
    icon_url: Optional[str] = None
    splash_color: Optional[str] = None
    bundle_id_suffix: Optional[str] = None
    files: Optional[AppFilesStatus] = None

    @classmethod
    def from_service_dict(cls, data: dict) -> "AppConfigResponse":
        payload = {k: v for k, v in data.items() if not str(k).startswith("_")}
        files = data.get("_files") or data.get("files")
        if files and isinstance(files, dict):
            payload["files"] = AppFilesStatus(**files)
        return cls(**payload)


class TriggerBuildRequest(BaseModel):
    platform: BuildPlatform = BuildPlatform.ALL


class BuildResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    vendor_id: str
    platform: str
    build_profile: str
    status: str
    eas_build_id_android: Optional[str] = None
    eas_build_id_ios: Optional[str] = None
    artifact_url_android: Optional[str] = None
    artifact_url_ios: Optional[str] = None
    play_store_status: Optional[str] = None
    app_store_status: Optional[str] = None
    config_snapshot: dict = {}
    error_message: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    built_at: Optional[str] = None
    published_at: Optional[str] = None

    @classmethod
    def from_orm_coerce(cls, obj):
        return cls(
            id=str(obj.id),
            vendor_id=str(obj.vendor_id),
            platform=obj.platform,
            build_profile=obj.build_profile,
            status=obj.status,
            eas_build_id_android=obj.eas_build_id_android,
            eas_build_id_ios=obj.eas_build_id_ios,
            artifact_url_android=obj.artifact_url_android,
            artifact_url_ios=obj.artifact_url_ios,
            play_store_status=obj.play_store_status,
            app_store_status=obj.app_store_status,
            config_snapshot=obj.config_snapshot or {},
            error_message=obj.error_message,
            created_at=obj.created_at.isoformat() if obj.created_at else None,
            updated_at=obj.updated_at.isoformat() if obj.updated_at else None,
            built_at=obj.built_at.isoformat() if obj.built_at else None,
            published_at=obj.published_at.isoformat() if obj.published_at else None,
        )


class BuildListResponse(BaseModel):
    items: List[BuildResponse]
    total: int


class BuildStatusUpdateBody(BaseModel):
    status: str
    eas_build_id_android: Optional[str] = None
    eas_build_id_ios: Optional[str] = None
    artifact_url_android: Optional[str] = None
    artifact_url_ios: Optional[str] = None
    error_message: Optional[str] = None
