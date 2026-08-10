#!/usr/bin/env python3
"""
build-runner.py — Automated build runner for vendor branded apps.

Polls the backend API for builds in 'config_generated' status,
writes their config + icon to disk, runs `eas build`, and reports back.

Usage:
    python scripts/build-runner.py

Environment variables:
    API_URL              Backend API base URL (default: http://localhost:8000/api/v1)
    BUILD_RUNNER_API_KEY Secret key matching the backend's BUILD_RUNNER_API_KEY
    POLL_INTERVAL        Seconds between polls (default: 15)
    MOBILE_DIR           Path to the mobile/ directory (auto-detected)
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

import requests

API_URL = os.environ.get("API_URL", "http://localhost:8000/api/v1")
API_KEY = os.environ.get("BUILD_RUNNER_API_KEY", "")
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "15"))

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
MOBILE_DIR = Path(os.environ.get("MOBILE_DIR", str(PROJECT_ROOT / "mobile")))
UPLOADS_DIR = PROJECT_ROOT / "backend" / "uploads"


def fetch_pending_builds():
    resp = requests.get(
        f"{API_URL}/internal/pending-builds",
        params={"api_key": API_KEY},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    return data.get("items", [])


def update_build_status(build_id: str, **kwargs):
    status = kwargs.pop("status")
    body = {"status": status, **{k: v for k, v in kwargs.items() if v is not None}}
    resp = requests.put(
        f"{API_URL}/internal/app-builds/{build_id}/status",
        params={"api_key": API_KEY},
        json=body,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def _resolve_local_upload(icon_url: str) -> Path | None:
    raw = (icon_url or "").strip()
    if not raw:
        return None
    if raw.startswith("/uploads/"):
        return UPLOADS_DIR / raw[len("/uploads/") :]
    if raw.startswith("uploads/"):
        return UPLOADS_DIR / raw[len("uploads/") :]
    parsed = urlparse(raw)
    if parsed.path.startswith("/uploads/"):
        return UPLOADS_DIR / parsed.path[len("/uploads/") :]
    return None


def materialize_icon(vendor_dir: Path, icon_url: str | None) -> bool:
    if not icon_url:
        return (vendor_dir / "icon.png").is_file()

    dest = vendor_dir / "icon.png"
    adaptive = vendor_dir / "adaptive-icon.png"
    try:
        raw = icon_url.strip()

        if raw.startswith("data:image/"):
            import base64

            _header, _, b64 = raw.partition(",")
            if b64:
                data = base64.b64decode(b64)
                dest.write_bytes(data)
                adaptive.write_bytes(data)
                return True

        local = _resolve_local_upload(raw)
        if local and local.is_file():
            shutil.copyfile(local, dest)
            shutil.copyfile(local, adaptive)
            return True

        if raw.startswith("http://") or raw.startswith("https://"):
            with urllib.request.urlopen(raw, timeout=30) as resp:
                data = resp.read()
            if data:
                dest.write_bytes(data)
                adaptive.write_bytes(data)
                return True
    except Exception as e:
        print(f"  Warning: could not materialize icon: {e}")
    return dest.is_file()


def write_vendor_config(vendor_slug: str, config: dict):
    vendors_root = MOBILE_DIR / "vendors"
    vendor_dir = vendors_root / vendor_slug
    vendor_dir.mkdir(parents=True, exist_ok=True)

    # Strip internal bookkeeping keys before writing mobile config
    clean = {k: v for k, v in config.items() if not str(k).startswith("_")}
    config_path = vendor_dir / "config.json"
    config_path.write_text(json.dumps(clean, indent=2), encoding="utf-8")

    icon_url = clean.get("logoUrl") or clean.get("icon_url")
    icon_ok = materialize_icon(vendor_dir, icon_url)

    target_path = vendors_root / "_build_target.json"
    target_path.write_text(
        json.dumps({"vendorSlug": vendor_slug}, indent=2),
        encoding="utf-8",
    )
    return str(config_path), icon_ok


def run_eas_build(vendor_slug: str, platform: str, build_profile: str):
    """Run eas build and return (success, stdout, stderr)."""
    env = os.environ.copy()
    env["VENDOR_SLUG"] = vendor_slug

    platform_flag = {
        "android": "android",
        "ios": "ios",
        "all": "all",
    }.get(platform, "all")

    cmd = [
        "eas",
        "build",
        "--profile",
        build_profile,
        "--platform",
        platform_flag,
        "--non-interactive",
        "--json",
    ]

    print(f"  Running: VENDOR_SLUG={vendor_slug} {' '.join(cmd)}")
    result = subprocess.run(
        cmd,
        cwd=str(MOBILE_DIR),
        env=env,
        capture_output=True,
        text=True,
        timeout=3600,
    )
    return result.returncode == 0, result.stdout, result.stderr


def parse_eas_output(stdout: str):
    """Try to extract build IDs and artifact URLs from EAS JSON output."""
    android_id = None
    ios_id = None
    artifact_android = None
    artifact_ios = None
    try:
        builds = json.loads(stdout)
        items = builds if isinstance(builds, list) else [builds]
        for b in items:
            if not isinstance(b, dict):
                continue
            plat = (b.get("platform") or "").upper()
            bid = b.get("id")
            art = b.get("artifacts", {}) if isinstance(b.get("artifacts"), dict) else {}
            url = art.get("buildUrl") or art.get("applicationArchiveUrl") or b.get("buildDetailsPageUrl")
            if plat == "ANDROID":
                android_id = bid
                artifact_android = url
            elif plat == "IOS":
                ios_id = bid
                artifact_ios = url
            elif not android_id and not ios_id:
                # Single-platform dict without clear platform
                android_id = bid
                artifact_android = url
    except (json.JSONDecodeError, TypeError):
        pass
    return android_id, ios_id, artifact_android, artifact_ios


def process_build(build: dict):
    build_id = build["id"]
    config = build.get("config_snapshot", {}) or {}
    vendor_slug = config.get("vendorSlug", "")
    platform = build.get("platform", "all")
    profile = build.get("build_profile", "vendor-all")

    if not vendor_slug:
        print(f"  [SKIP] Build {build_id} has no vendorSlug in config_snapshot")
        update_build_status(build_id, status="failed", error_message="Missing vendorSlug")
        return

    print(f"\n{'=' * 60}")
    print(f"  Processing build {build_id}")
    print(f"  Vendor: {vendor_slug} | Platform: {platform} | Profile: {profile}")
    print(f"{'=' * 60}")

    config_path, icon_ok = write_vendor_config(vendor_slug, config)
    print(f"  Config written to: {config_path}")
    print(f"  Icon ready: {icon_ok}")

    building = update_build_status(build_id, status="building")
    if building.get("status") == "paused":
        print("  [SKIP] Build was paused by admin — not starting EAS")
        return

    success, stdout, stderr = run_eas_build(vendor_slug, platform, profile)

    if success:
        android_id, ios_id, art_a, art_i = parse_eas_output(stdout)
        print(f"  Build submitted! Android: {android_id}, iOS: {ios_id}")
        final = update_build_status(
            build_id,
            status="built",
            eas_build_id_android=android_id,
            eas_build_id_ios=ios_id,
            artifact_url_android=art_a,
            artifact_url_ios=art_i,
        )
        if final.get("status") == "paused":
            print("  Note: build completed on EAS but admin paused the row — left as paused")
    else:
        error = (stderr or stdout or "Unknown build error")[:800]
        print(f"  Build FAILED: {error}")
        final = update_build_status(build_id, status="failed", error_message=error)
        if final.get("status") == "paused":
            print("  Note: failure ignored because build is paused")


def main():
    if not API_KEY:
        print("ERROR: BUILD_RUNNER_API_KEY environment variable is required.")
        sys.exit(1)

    print("KITERP Build Runner")
    print(f"  API:           {API_URL}")
    print(f"  Mobile dir:    {MOBILE_DIR}")
    print(f"  Poll interval: {POLL_INTERVAL}s")
    print()

    while True:
        try:
            builds = fetch_pending_builds()
            if builds:
                print(f"\nFound {len(builds)} pending build(s)")
                for build in builds:
                    process_build(build)
            else:
                print(".", end="", flush=True)
        except requests.RequestException as e:
            print(f"\n  API error: {e}")
        except Exception as e:
            print(f"\n  Unexpected error: {e}")

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
