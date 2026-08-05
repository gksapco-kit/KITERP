# Build a vendor debug APK on Windows (no EAS).
# Usage:
#   .\scripts\build-apk-local.ps1 dmart
#
# Requires: Node, JDK 17, Android SDK (ANDROID_HOME)

param(
  [Parameter(Mandatory = $true)]
  [string]$VendorSlug,
  [ValidateSet("debug", "release")]
  [string]$Variant = "debug"
)

$ErrorActionPreference = "Stop"

$MobileDir = Join-Path (Split-Path $PSScriptRoot -Parent) "mobile"
$ConfigFile = Join-Path $MobileDir "vendors\$VendorSlug\config.json"

if (-not (Test-Path $ConfigFile)) {
  throw "Missing vendor config: $ConfigFile"
}

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  throw "Java not found. Install JDK 17, then reopen PowerShell."
}

if (-not ($env:ANDROID_HOME -or $env:ANDROID_SDK_ROOT)) {
  $defaultSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
  if (Test-Path $defaultSdk) {
    $env:ANDROID_HOME = $defaultSdk
  } else {
    throw "ANDROID_HOME not set. Install Android Studio SDK first."
  }
}

$env:VENDOR_SLUG = $VendorSlug
if (-not $env:EXPO_PUBLIC_STOREFRONT_URL) {
  $env:EXPO_PUBLIC_STOREFRONT_URL = "https://kiterp.com"
}
Set-Location $MobileDir

Write-Host "==> Vendor: $VendorSlug ($Variant)"
Write-Host "==> Storefront: $($env:EXPO_PUBLIC_STOREFRONT_URL)"
Write-Host "==> npm install"
npm install

Write-Host "==> expo prebuild (android)"
npx expo prebuild --platform android --clean --non-interactive

Set-Location (Join-Path $MobileDir "android")
$task = if ($Variant -eq "debug") { "assembleDebug" } else { "assembleRelease" }

Write-Host "==> gradlew $task"
.\gradlew.bat $task

$apk = if ($Variant -eq "debug") {
  Join-Path $MobileDir "android\app\build\outputs\apk\debug\app-debug.apk"
} else {
  Join-Path $MobileDir "android\app\build\outputs\apk\release\app-release.apk"
}

Write-Host ""
Write-Host "Done. APK:"
Write-Host "  $apk"
Get-Item $apk | Format-List FullName, Length, LastWriteTime
