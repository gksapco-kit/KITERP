#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# build-vendor-app.sh
#
# Builds a branded app for a specific vendor using EAS Build.
#
# Usage:
#   ./scripts/build-vendor-app.sh <vendor-slug> [platform]
#
# Arguments:
#   vendor-slug   The vendor's slug (must match a directory in mobile/vendors/)
#   platform      "android", "ios", or "all" (default: "all")
#
# Prerequisites:
#   - EAS CLI installed globally: npm install -g eas-cli
#   - Authenticated with EAS: eas login
#   - Vendor config exists at mobile/vendors/<slug>/config.json
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

VENDOR_SLUG="${1:?Usage: build-vendor-app.sh <vendor-slug> [platform]}"
PLATFORM="${2:-all}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MOBILE_DIR="$PROJECT_ROOT/mobile"
VENDOR_DIR="$MOBILE_DIR/vendors/$VENDOR_SLUG"
CONFIG_FILE="$VENDOR_DIR/config.json"

# ── Validate ─────────────────────────────────────────────────────────────────
if [ ! -f "$CONFIG_FILE" ]; then
  echo "ERROR: Config not found at $CONFIG_FILE"
  echo "Run the admin API to generate the config first."
  exit 1
fi

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  KITERP Branded App Builder                                ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Vendor:   $VENDOR_SLUG"
echo "║  Platform: $PLATFORM"
echo "║  Config:   $CONFIG_FILE"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

cd "$MOBILE_DIR"

export VENDOR_SLUG

# ── Select EAS profile ───────────────────────────────────────────────────────
case "$PLATFORM" in
  android) EAS_PROFILE="vendor-android" ;;
  ios)     EAS_PROFILE="vendor-ios" ;;
  all)     EAS_PROFILE="vendor-all" ;;
  *)
    echo "ERROR: Invalid platform '$PLATFORM'. Use android, ios, or all."
    exit 1
    ;;
esac

echo "[1/3] Installing dependencies..."
npm ci --silent 2>/dev/null || npm install --silent

echo "[2/3] Running EAS build (profile: $EAS_PROFILE)..."
if [ "$PLATFORM" = "all" ]; then
  eas build --profile "$EAS_PROFILE" --platform all --non-interactive
elif [ "$PLATFORM" = "android" ]; then
  eas build --profile "$EAS_PROFILE" --platform android --non-interactive
elif [ "$PLATFORM" = "ios" ]; then
  eas build --profile "$EAS_PROFILE" --platform ios --non-interactive
fi

echo "[3/3] Build submitted to EAS."
echo ""
echo "Track build status at: https://expo.dev"
echo "Or run: eas build:list --platform $PLATFORM"
echo ""
echo "Done! Vendor app for '$VENDOR_SLUG' is being built."
