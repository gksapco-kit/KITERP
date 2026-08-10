# Branded App Builds — White-Label Mobile App System

## Overview

When a vendor subscribes to a plan that includes the **branded_app** feature, the platform can generate a custom Android/iOS app bearing that vendor's name, icon, colors, and bundle ID. The app connects back to the same backend but is locked to that vendor's business front.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│  Admin UI   │────▶│  Backend API │────▶│  Build Runner │────▶│  EAS Build   │
│  (React)    │     │  (FastAPI)   │     │  (Python)     │     │  (Expo)      │
└─────────────┘     └──────────────┘     └───────────────┘     └──────────────┘
      │                    │                     │                      │
      │  1. Configure      │  2. Generate        │  3. Write config    │  4. eas build
      │     app settings   │     config.json     │     + run EAS      │     → APK/IPA
      │                    │     + build record   │                    │
      │  6. View status    │  5. Update status   │                    │
      └────────────────────┴─────────────────────┴──────────────────────┘
```

## Flow: Vendor Pays → App Published

1. **Vendor subscribes** to a plan with `features.branded_app = true`
2. **Admin configures** the app via Dashboard → Vendor Detail → **Branded App**
   - Sets app name, primary color, splash color, icon URL, bundle ID suffix
3. **Admin triggers build** (Android, iOS, or both)
4. **Backend generates** a `config.json` snapshot and writes it to `mobile/vendors/<slug>/config.json`
5. **Build Runner** (polling or webhook) picks up the pending build
6. **EAS Build** runs with `VENDOR_SLUG` env var → `app.config.js` reads the vendor config
7. **Build completes** → Runner updates the build record with EAS build IDs
8. **Admin submits** to Play Store / App Store (or automates via EAS Submit)

## Directory Structure

```
mobile/
├── app.config.js          # Dynamic config — reads VENDOR_SLUG env var
├── eas.json               # Build profiles (vendor-android, vendor-ios, vendor-all)
├── vendors/
│   ├── _default/
│   │   ├── config.json    # Fallback config for the platform app
│   │   └── README.md
│   └── <vendor-slug>/     # Auto-generated per vendor
│       ├── config.json    # Vendor-specific build config
│       ├── icon.png       # Optional custom icon (1024x1024)
│       └── adaptive-icon.png
├── utils/
│   └── vendorConfig.ts    # Runtime config reader using expo-constants
└── ...

backend/
├── app/models/vendor_app_build.py   # Build tracking model
├── app/schemas/app_build.py         # Pydantic schemas
├── app/services/app_build_service.py # Business logic
├── app/api/v1/app_builds.py         # API endpoints
└── migrations/add_vendor_app_builds.py

scripts/
├── build-vendor-app.sh    # Manual: build a single vendor's app
└── build-runner.py        # Automated: polls API, builds, reports back

frontend/
├── src/api/appBuild.api.ts
├── src/hooks/useAppBuilds.ts
└── src/pages/dashboard/VendorAppBuilds.tsx
```

## Backend API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/admin/vendors/{id}/app-config` | Super Admin | Get vendor's app config |
| PUT | `/admin/vendors/{id}/app-config` | Super Admin | Update vendor's app config |
| POST | `/admin/vendors/{id}/app-builds` | Super Admin | Trigger a new build |
| GET | `/admin/app-builds` | Super Admin | List all builds (filterable) |
| GET | `/admin/app-builds/{build_id}` | Super Admin | Get build details |
| PUT | `/admin/app-builds/{build_id}/status` | Super Admin | Update build status |
| GET | `/internal/pending-builds?api_key=...` | API Key | Build runner polling |

## Build Statuses

| Status | Meaning |
|--------|---------|
| `pending` | Build record created |
| `config_generated` | Config written, ready for build runner |
| `building` | EAS build in progress |
| `built` | EAS build completed |
| `submitted` | Submitted to app store |
| `published` | Live on app store |
| `failed` | Build or submission failed |

## Vendor Plan Feature Flag

The `vendor_plan.features` JSONB column includes:

```json
{
  "branded_app": true
}
```

Only vendors whose plan has `branded_app: true` can trigger builds. Others receive a 403 error.

## How `app.config.js` Works

The static `app.json` has been replaced by a dynamic `app.config.js`:

1. Checks for `VENDOR_SLUG` environment variable
2. If set, reads `mobile/vendors/<slug>/config.json`
3. Overrides app name, slug, scheme, bundle ID, colors, and icons
4. Falls back to default KITERP branding if no vendor config exists

## Running a Manual Build

```bash
# Build for a specific vendor
./scripts/build-vendor-app.sh acme-store android

# Build both platforms
./scripts/build-vendor-app.sh acme-store all
```

## Running the Automated Build Runner

```bash
export BUILD_RUNNER_API_KEY="your-secret-key"
export API_URL="http://localhost:8000/api/v1"

python scripts/build-runner.py
```

The runner polls every 30 seconds (configurable via `POLL_INTERVAL`).

## Database Migration

Run the migration to add the required tables and columns:

```bash
cd backend
python -m migrations.add_vendor_app_builds
```

## Prerequisites

1. **EAS CLI**: `npm install -g eas-cli`
2. **EAS Login**: `eas login`
3. **EAS Project**: Link with `eas init` in the `mobile/` directory
4. **Apple Developer Account** (for iOS builds)
5. **Google Play Console** service account (for Android submissions)

## Custom Assets

To use a vendor's custom icon:

1. Place `icon.png` (1024x1024) in `mobile/vendors/<slug>/`
2. Optionally add `adaptive-icon.png` for Android
3. The build system auto-detects and uses these files
