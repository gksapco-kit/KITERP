# ============================================================
# KITERP Dev Startup Script
# Usage: Right-click -> "Run with PowerShell"  OR  .\start-dev.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$ROOT = $PSScriptRoot
$DEV_HOST = "127.0.0.1"

function Test-DockerEngine {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
  try {
        docker info *> $null
        return $LASTEXITCODE -eq 0
    } finally {
        $ErrorActionPreference = $prev
    }
}

function Start-DockerDesktopIfNeeded {
    if (Test-DockerEngine) { return $true }

    $candidates = @(
        "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe",
        "${env:LocalAppData}\Programs\Docker\Docker\Docker Desktop.exe"
    )
    $dockerDesktop = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $dockerDesktop) {
        Write-Host "      Docker is not running and Docker Desktop was not found." -ForegroundColor Red
        Write-Host "      Install Docker Desktop, start it manually, then run this script again." -ForegroundColor Yellow
        return $false
    }

    Write-Host "      Starting Docker Desktop..." -ForegroundColor Gray
    Start-Process -FilePath $dockerDesktop | Out-Null

    $deadline = (Get-Date).AddSeconds(120)
    while ((Get-Date) -lt $deadline) {
        if (Test-DockerEngine) { return $true }
        Start-Sleep -Seconds 2
        Write-Host "      Waiting for Docker engine..." -ForegroundColor DarkGray
    }

    Write-Host "      Timed out waiting for Docker (120s). Open Docker Desktop and retry." -ForegroundColor Red
    return $false
}

function Stop-DockerWebContainers {
    $webContainers = @("kiterp-admin", "kiterp-vendor", "kiterp-storefront")
    foreach ($name in $webContainers) {
        docker stop $name 2>$null | Out-Null
    }
}

function Wait-BackendHealthy {
    param([int]$TimeoutSeconds = 90)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-WebRequest -Uri "http://${DEV_HOST}:8000/health" -UseBasicParsing -TimeoutSec 3
            if ($resp.StatusCode -eq 200) { return $true }
        } catch {
            # backend still starting
        }
        Start-Sleep -Seconds 2
        Write-Host "      Waiting for API on :8000..." -ForegroundColor DarkGray
    }
    return $false
}

function Wait-ViteReady {
    param(
        [string[]]$Urls,
        [int]$TimeoutSeconds = 120
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $ready = @{}
    while ((Get-Date) -lt $deadline -and $ready.Count -lt $Urls.Count) {
        foreach ($url in $Urls) {
            if ($ready.ContainsKey($url)) { continue }
            try {
                $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 8
                if ($resp.StatusCode -eq 200) {
                    $ready[$url] = $true
                    Write-Host "      Ready: $url" -ForegroundColor DarkGray
                }
            } catch {
                # still starting
            }
        }
        if ($ready.Count -lt $Urls.Count) { Start-Sleep -Seconds 2 }
    }
    return ($ready.Count -eq $Urls.Count)
}

Write-Host ""
Write-Host "=== KITERP Dev Environment ===" -ForegroundColor Cyan
Write-Host ""

if ($ROOT -match "OneDrive") {
    Write-Host "NOTE: Project is on OneDrive - first browser load can take 1-2 minutes." -ForegroundColor Yellow
    Write-Host "      Use http://${DEV_HOST}:PORT (not localhost). Do not start web containers in Docker Desktop." -ForegroundColor Yellow
    Write-Host ""
}

# ── 1. Ensure Docker Desktop / engine is running ─────────────────
Write-Host "[1/5] Checking Docker..." -ForegroundColor Yellow
if (-not (Start-DockerDesktopIfNeeded)) { exit 1 }
Write-Host "      Docker engine is ready." -ForegroundColor Green

# ── 2. Stop Docker web containers (native Vite owns :3000-3002) ─
Write-Host "[2/5] Stopping Docker web containers (avoid port conflicts)..." -ForegroundColor Yellow
Stop-DockerWebContainers
Write-Host "      Docker web containers stopped." -ForegroundColor Green

# ── 3. Kill any leftover node processes on 3000/3001/3002 ───────
Write-Host "[3/5] Cleaning up old Node processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object { $_.Kill() }
Start-Sleep -Seconds 1

# ── 4. Start Docker backend services ────────────────────────────
Write-Host "[4/5] Starting backend (Docker)..." -ForegroundColor Yellow
Push-Location $ROOT
try {
    docker compose up -d --no-deps backend postgres redis crm-worker crm-beat
    if ($LASTEXITCODE -ne 0) {
        Write-Host "      docker compose failed (exit $LASTEXITCODE)." -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}

if (-not (Wait-BackendHealthy)) {
    Write-Host "      Backend did not become healthy in time. Check: docker compose logs -f backend" -ForegroundColor Red
    exit 1
}
Write-Host "      Backend API docs: http://${DEV_HOST}:8000/docs" -ForegroundColor Green

# ── 5. Start web dev servers natively (see docker-compose.yml) ──
Write-Host "[5/5] Starting web apps (native Vite)..." -ForegroundColor Yellow

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$ROOT\frontend'; Write-Host 'SUPER-ADMIN (frontend) :3000' -ForegroundColor Magenta; npm run dev"
) -WindowStyle Normal

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$ROOT\vendor-web'; Write-Host 'VENDOR-WEB :3001' -ForegroundColor Green; npm run dev"
) -WindowStyle Normal

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$ROOT\storefront-web'; Write-Host 'BUSINESS FRONT :3002' -ForegroundColor Cyan; npm run dev"
) -WindowStyle Normal

Write-Host "      Waiting for Vite (pre-warming - may take up to 2 min on OneDrive)..." -ForegroundColor Gray
$viteUrls = @(
    "http://${DEV_HOST}:3000/login",
    "http://${DEV_HOST}:3001/login",
    "http://${DEV_HOST}:3002"
)
if (-not (Wait-ViteReady -Urls $viteUrls -TimeoutSeconds 120)) {
    Write-Host "      Some Vite servers are still starting - check the 3 PowerShell windows for errors." -ForegroundColor Yellow
} else {
    # Pre-warm heavy entry modules so the browser does not hang on first open.
    foreach ($warm in @(
        "http://${DEV_HOST}:3000/src/main.tsx",
        "http://${DEV_HOST}:3001/src/main.tsx",
        "http://${DEV_HOST}:3002/src/main.tsx"
    )) {
        try { Invoke-WebRequest -Uri $warm -UseBasicParsing -TimeoutSec 120 | Out-Null } catch { }
    }
}

Write-Host ""
Write-Host "=== Ready! ===" -ForegroundColor Green
Write-Host "  Super Admin      : http://${DEV_HOST}:3000/login" -ForegroundColor White
Write-Host "  Vendor dashboard : http://${DEV_HOST}:3001/login" -ForegroundColor White
Write-Host "  Business Front   : http://${DEV_HOST}:3002" -ForegroundColor White
Write-Host "  ESS test links   : http://${DEV_HOST}:3002/local/employee-hr" -ForegroundColor Cyan
Write-Host "  Backend API docs : http://${DEV_HOST}:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "Opening vendor login in your browser..." -ForegroundColor Gray
Start-Process "http://${DEV_HOST}:3001/login"
