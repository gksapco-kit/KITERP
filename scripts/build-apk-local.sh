#!/usr/bin/env bash
# Build a vendor APK locally with Gradle (no EAS).
#
# Usage (on Linux / macOS / WSL — not Windows):
#   ./scripts/build-apk-local.sh dmart
#   ./scripts/build-apk-local.sh dmart release
#
# Output:
#   debug   → mobile/android/app/build/outputs/apk/debug/app-debug.apk
#   release → mobile/android/app/build/outputs/apk/release/app-release.apk
#
# Needs: Node 20+, JDK 17, Android SDK (ANDROID_HOME set)
set -euo pipefail

VENDOR_SLUG="${1:?Usage: build-apk-local.sh <vendor-slug> [debug|release]}"
VARIANT="${2:-debug}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOBILE_DIR="$(dirname "$SCRIPT_DIR")/mobile"
CONFIG_FILE="$MOBILE_DIR/vendors/$VENDOR_SLUG/config.json"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "ERROR: Missing $CONFIG_FILE"
  exit 1
fi

if ! command -v java >/dev/null 2>&1; then
  echo "ERROR: Java not found. Install JDK 17 first."
  exit 1
fi

if [ -z "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ]; then
  echo "ERROR: Set ANDROID_HOME to your Android SDK path."
  exit 1
fi

case "$VARIANT" in
  debug)   GRADLE_TASK="assembleDebug" ;;
  release) GRADLE_TASK="assembleRelease" ;;
  *)
    echo "ERROR: variant must be debug or release"
    exit 1
    ;;
esac

export VENDOR_SLUG
cd "$MOBILE_DIR"

echo "==> Vendor: $VENDOR_SLUG  ($VARIANT)"
echo "==> npm install"
npm install

echo "==> expo prebuild (android)"
npx expo prebuild --platform android --clean --non-interactive

echo "==> gradle $GRADLE_TASK"
cd android
chmod +x gradlew
./gradlew "$GRADLE_TASK"

if [ "$VARIANT" = "debug" ]; then
  APK="$MOBILE_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
else
  APK="$MOBILE_DIR/android/app/build/outputs/apk/release/app-release.apk"
fi

echo ""
echo "Done. APK:"
echo "  $APK"
ls -lh "$APK"
