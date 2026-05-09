#!/usr/bin/env python3
"""
build-runner.py — Automated build runner for vendor branded apps.

Polls the backend API for builds in 'config_generated' status,
writes their config to disk, runs `eas build`, and reports back.

Usage:
    python scripts/build-runner.py

Environment variables:
    API_URL              Backend API base URL (default: http://localhost:8000/api/v1)
    BUILD_RUNNER_API_KEY Secret key matching the backend's BUILD_RUNNER_API_KEY
    POLL_INTERVAL        Seconds between polls (default: 30)
    MOBILE_DIR           Path to the mobile/ directory (auto-detected)
"""
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import requests

API_URL = os.environ.get("API_URL", "http://localhost:8000/api/v1")
API_KEY = os.environ.get("BUILD_RUNNER_API_KEY", "")
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "30"))

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
MOBILE_DIR = Path(os.environ.get("MOBILE_DIR", str(PROJECT_ROOT / "mobile")))


def fetch_pending_builds():
    resp = requests.get(
        f"{API_URL}/internal/pending-builds",
        params={"api_key": API_KEY},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    return data.get("items", [])


def update_build_status(build_id: str, **kwargs):
    params = {"status": kwargs.pop("status")}
    params.update({k: v for k, v in kwargs.items() if v is not None})
    resp = requests.put(
        f"{API_URL}/admin/app-builds/{build_id}/status",
        params=params,
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def write_vendor_config(vendor_slug: str, config: dict):
    vendor_dir = MOBILE_DIR / "vendors" / vendor_slug
    vendor_dir.mkdir(parents=True, exist_ok=True)
    config_path = vendor_dir / "config.json"
    config_path.write_text(json.dumps(config, indent=2))
    return str(config_path)


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
        "eas", "build",
        "--profile", build_profile,
        "--platform", platform_flag,
        "--non-interactive",
        "--json",
    ]

    print(f"  Running: {' '.join(cmd)}")
    result = subprocess.run(
        cmd,
        cwd=str(MOBILE_DIR),
        env=env,
        capture_output=True,
        text=True,
        timeout=1800,  # 30 min timeout
    )
    return result.returncode == 0, result.stdout, result.stderr


def parse_eas_output(stdout: str):
    """Try to extract build IDs from EAS JSON output."""
    android_id = None
    ios_id = None
    try:
        builds = json.loads(stdout)
        if isinstance(builds, list):
            for b in builds:
                if b.get("platform") == "ANDROID":
                    android_id = b.get("id")
                elif b.get("platform") == "IOS":
                    ios_id = b.get("id")
        elif isinstance(builds, dict):
            android_id = builds.get("id") if builds.get("platform") == "ANDROID" else None
            ios_id = builds.get("id") if builds.get("platform") == "IOS" else None
    except (json.JSONDecodeError, TypeError):
        pass
    return android_id, ios_id


def process_build(build: dict):
    build_id = build["id"]
    vendor_slug = build.get("config_snapshot", {}).get("vendorSlug", "")
    platform = build.get("platform", "all")
    profile = build.get("build_profile", "vendor-all")
    config = build.get("config_snapshot", {})

    if not vendor_slug:
        print(f"  [SKIP] Build {build_id} has no vendorSlug in config_snapshot")
        update_build_status(build_id, status="failed", error_message="Missing vendorSlug")
        return

    print(f"\n{'='*60}")
    print(f"  Processing build {build_id}")
    print(f"  Vendor: {vendor_slug} | Platform: {platform} | Profile: {profile}")
    print(f"{'='*60}")

    config_path = write_vendor_config(vendor_slug, config)
    print(f"  Config written to: {config_path}")

    update_build_status(build_id, status="building")

    success, stdout, stderr = run_eas_build(vendor_slug, platform, profile)

    if success:
        android_id, ios_id = parse_eas_output(stdout)
        print(f"  Build submitted! Android: {android_id}, iOS: {ios_id}")
        update_build_status(
            build_id,
            status="built",
            eas_build_id_android=android_id,
            eas_build_id_ios=ios_id,
        )
    else:
        error = stderr[:500] if stderr else "Unknown build error"
        print(f"  Build FAILED: {error}")
        update_build_status(build_id, status="failed", error_message=error)


def main():
    if not API_KEY:
        print("ERROR: BUILD_RUNNER_API_KEY environment variable is required.")
        sys.exit(1)

    print(f"KITERP Build Runner")
    print(f"  API:           {API_URL}")
    print(f"  Mobile dir:    {MOBILE_DIR}")
    print(f"  Poll interval: {POLL_INTERVAL}s")
    print()

    while True:
        try:
            builds = fetch_pending_builds()
            if builds:
                print(f"Found {len(builds)} pending build(s)")
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
