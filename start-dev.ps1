# ============================================================
# KITERP Dev Startup Script
# Usage: Right-click -> "Run with PowerShell"  OR  .\start-dev.ps1
# ============================================================

$ROOT = $PSScriptRoot

Write-Host ""
Write-Host "=== KITERP Dev Environment ===" -ForegroundColor Cyan
Write-Host ""

# ── 1. Kill any leftover node processes on 3001/3002 ────────────
Write-Host "[1/3] Cleaning up old Node processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object { $_.Kill() }
Start-Sleep -Seconds 1

# ── 2. Start Docker backend services ────────────────────────────
Write-Host "[2/3] Starting backend (Docker)..." -ForegroundColor Yellow
Push-Location $ROOT
docker compose up -d --no-deps backend postgres redis crm-worker crm-beat 2>&1 | Out-Null
Pop-Location
Write-Host "      Backend: http://localhost:8000/api/v1/docs" -ForegroundColor Green

# ── 3. Start frontend dev servers natively ──────────────────────
Write-Host "[3/3] Starting frontend dev servers (native)..." -ForegroundColor Yellow

# vendor-web on :3001
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "cd '$ROOT\vendor-web'; Write-Host 'VENDOR-WEB :3001' -ForegroundColor Green; npm run dev"
) -WindowStyle Normal

# storefront-web on :3002
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "cd '$ROOT\storefront-web'; Write-Host 'STOREFRONT :3002' -ForegroundColor Cyan; npm run dev"
) -WindowStyle Normal

Write-Host ""
Write-Host "=== Ready! ===" -ForegroundColor Green
Write-Host "  Vendor dashboard : http://localhost:3001" -ForegroundColor White
Write-Host "  Storefront       : http://localhost:3002" -ForegroundColor White
Write-Host "  ESS test links   : http://localhost:3002/local/employee-hr" -ForegroundColor Cyan
Write-Host "  Backend API docs : http://localhost:8000/api/v1/docs" -ForegroundColor White
Write-Host ""
Write-Host "Wait ~5 seconds for Vite to compile, then open the links above." -ForegroundColor Gray
