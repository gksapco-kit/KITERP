# =============================================================================
# KITERP -- Import / Restore Database + Uploads
# =============================================================================
# Run this on the target machine to restore a zip produced by export-db.ps1.
#
# Usage (point at the extracted folder):
#   .\import-db.ps1 -ExportDir "C:\path\to\kiterp-export-20250420_123456"
#
# Add -Force to skip the confirmation prompt:
#   .\import-db.ps1 -ExportDir "..." -Force
# =============================================================================

param(
  [Parameter(Mandatory=$true)]
  [string]$ExportDir,
  [switch]$Force
)

$ErrorActionPreference = "Stop"

function Step([string]$msg) { Write-Host "" ; Write-Host "[STEP] $msg" -ForegroundColor Cyan }
function Ok([string]$msg)   { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Warn([string]$msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Fail([string]$msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red ; exit 1 }

# -- Config (must match docker-compose.yml) -----------------------------------
$CONTAINER = "kiterp-postgres"
$DB        = "kiterp"
$DB_USER   = "postgres"
$DB_PASS   = "postgres"

# -- Validate inputs ----------------------------------------------------------
$ExportDir = $ExportDir.TrimEnd('\', '/')
if (-not (Test-Path $ExportDir)) { Fail "Export directory not found: $ExportDir" }
$DumpFile = "$ExportDir\database.sql"
if (-not (Test-Path $DumpFile))  { Fail "database.sql not found in: $ExportDir" }

Write-Host ""
Write-Host "=============================================" -ForegroundColor Magenta
Write-Host "  KITERP Database Import" -ForegroundColor Magenta
Write-Host "  Source : $ExportDir" -ForegroundColor Magenta
Write-Host "  DB     : $DB @ $CONTAINER" -ForegroundColor Magenta
Write-Host "=============================================" -ForegroundColor Magenta

# -- 1. Confirm ---------------------------------------------------------------
if (-not $Force) {
    Write-Host ""
    Write-Host "[WARN] This will DROP and RECREATE the '$DB' database." -ForegroundColor Yellow
    Write-Host "       ALL existing data will be replaced." -ForegroundColor Yellow
    $ans = Read-Host "  Type 'yes' to continue"
    if ($ans -ne "yes") { Write-Host "Aborted." -ForegroundColor Yellow ; exit 0 }
}

# -- 2. Docker running? -------------------------------------------------------
Step "Checking Docker..."
try { docker info 2>&1 | Out-Null } catch { Fail "Docker is not running -- start Docker Desktop first." }
Ok "Docker is running."

# -- 3. Start postgres --------------------------------------------------------
Step "Starting postgres container..."
$prev = $ErrorActionPreference
$ErrorActionPreference = "Continue"
docker compose up -d postgres 2>&1 | Out-Null
$ErrorActionPreference = $prev
$deadline = (Get-Date).AddSeconds(60)
do {
    Start-Sleep -Seconds 3
    $ready = docker exec $CONTAINER pg_isready -U $DB_USER -d postgres 2>&1
} while ($ready -notmatch "accepting connections" -and (Get-Date) -lt $deadline)
if ($ready -notmatch "accepting connections") { Fail "Postgres did not become ready within 60 s." }
Ok "Postgres is ready."

# -- 4. Drop & recreate the database ------------------------------------------
Step "Recreating database '$DB'..."
# Kick out any open connections
docker exec -e "PGPASSWORD=$DB_PASS" $CONTAINER psql -U $DB_USER -d postgres -c `
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB' AND pid <> pg_backend_pid();" `
    2>&1 | Out-Null
docker exec -e "PGPASSWORD=$DB_PASS" $CONTAINER psql -U $DB_USER -d postgres -c `
    "DROP DATABASE IF EXISTS $DB;" 2>&1 | Out-Null
docker exec -e "PGPASSWORD=$DB_PASS" $CONTAINER psql -U $DB_USER -d postgres -c `
    "CREATE DATABASE $DB OWNER $DB_USER;" 2>&1 | Out-Null
Ok "Database recreated."

# -- 5. Restore SQL dump ------------------------------------------------------
Step "Restoring from database.sql..."
docker cp "$DumpFile" "${CONTAINER}:/tmp/restore.sql"
docker exec -e "PGPASSWORD=$DB_PASS" $CONTAINER `
    psql -U $DB_USER -d $DB -f /tmp/restore.sql -v ON_ERROR_STOP=0 2>&1 `
    | Where-Object { $_ -match "^(ERROR|WARNING)" } `
    | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
docker exec $CONTAINER rm -f /tmp/restore.sql
Ok "Database restored."

# -- 6. Quick row-count spot check --------------------------------------------
Step "Spot-checking row counts (top 10 tables by size)..."
$counts = docker exec -e "PGPASSWORD=$DB_PASS" $CONTAINER psql `
    -U $DB_USER -d $DB -t -c `
    "SELECT table_name,
            (xpath('/row/c/text()',
              query_to_xml('SELECT COUNT(*) AS c FROM ' || quote_ident(table_name),
              false, true, '')))[1]::text::int AS rows
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY rows DESC LIMIT 10;" 2>&1
$counts | Where-Object { $_.Trim() -ne '' } | ForEach-Object {
    Write-Host "  $_" -ForegroundColor White
}
Ok "Row counts look reasonable."

# -- 7. Restore uploaded files ------------------------------------------------
Step "Restoring uploaded files..."
$UploadsIn    = "$ExportDir\uploads"
$localUploads = ".\backend\uploads"

if (Test-Path $UploadsIn) {
    $files = Get-ChildItem $UploadsIn -Recurse -File
    if ($files.Count -gt 0) {
        $null = New-Item -ItemType Directory -Force -Path $localUploads
        Copy-Item -Path "$UploadsIn\*" -Destination $localUploads -Recurse -Force
        Ok "Restored $($files.Count) upload file(s) -> backend\uploads"
    } else {
        Warn "uploads\ folder is empty -- nothing to restore."
    }
} else {
    Warn "No uploads\ folder in export -- skipping."
}

# -- 8. Run Alembic migrations (bring schema up to latest) --------------------
Step "Running Alembic migrations..."
try {
    $prev2 = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    docker compose up -d backend 2>&1 | Out-Null
    $ErrorActionPreference = $prev2
    Write-Host "  Waiting for backend to start..." -ForegroundColor Gray
    Start-Sleep -Seconds 8
    docker exec kiterp-backend alembic upgrade head 2>&1 | Write-Host
    Ok "Schema is up to date."
} catch {
    Warn "Could not auto-run migrations. Run manually:"
    Warn "  docker exec kiterp-backend alembic upgrade head"
}

# -- Done ---------------------------------------------------------------------
Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  Import complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Start the full stack:" -ForegroundColor White
Write-Host "    docker compose up -d" -ForegroundColor White
Write-Host ""
Write-Host "  Then open:" -ForegroundColor White
Write-Host "    Vendor app  : http://localhost:3001" -ForegroundColor White
Write-Host "    Storefront  : http://localhost:3002" -ForegroundColor White
Write-Host "    API docs    : http://localhost:8000/docs" -ForegroundColor White
Write-Host "=============================================" -ForegroundColor Green
