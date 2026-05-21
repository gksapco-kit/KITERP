# =============================================================================
# KITERP -- Export Database + Uploads
# =============================================================================
# Produces a single zip your team restores with import-db.ps1
#
# Usage:
#   .\export-db.ps1                     # exports to .\exports\
#   .\export-db.ps1 -OutDir C:\Shares   # custom output directory
# =============================================================================

param(
  [string]$OutDir = ".\exports"
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

# -- Timestamp & output folder ------------------------------------------------
$ts     = Get-Date -Format "yyyyMMdd_HHmmss"
$Bundle = "$OutDir\kiterp-export-$ts"
$null   = New-Item -ItemType Directory -Force -Path $Bundle

Write-Host ""
Write-Host "=============================================" -ForegroundColor Magenta
Write-Host "  KITERP Database Export" -ForegroundColor Magenta
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Magenta
Write-Host "=============================================" -ForegroundColor Magenta

# -- 1. Docker running? -------------------------------------------------------
Step "Checking Docker..."
try { docker info 2>&1 | Out-Null } catch { Fail "Docker is not running -- start Docker Desktop first." }
Ok "Docker is running."

# -- 2. Postgres container up? ------------------------------------------------
Step "Checking postgres container ($CONTAINER)..."
$running = docker ps --filter "name=$CONTAINER" --format "{{.Names}}"
if ($running -ne $CONTAINER) {
    Warn "Container not running -- starting stack..."
    docker compose up -d postgres
    Start-Sleep -Seconds 10
}
Ok "Container is up."

# -- 3. Dump database (plain SQL, UTF-8) -------------------------------------
Step "Dumping database '$DB'..."
$DumpFile = "$Bundle\database.sql"
$env:PGPASSWORD = $DB_PASS
docker exec -e "PGPASSWORD=$DB_PASS" $CONTAINER `
    pg_dump -U $DB_USER -d $DB --clean --if-exists --no-owner --no-acl `
    | Out-File -FilePath $DumpFile -Encoding UTF8
if (-not (Test-Path $DumpFile) -or (Get-Item $DumpFile).Length -lt 100) {
    Fail "Dump is empty -- check: docker logs $CONTAINER"
}
$sizeKB = [Math]::Round((Get-Item $DumpFile).Length / 1KB, 1)
Ok "Dumped ${sizeKB} KB -> database.sql"

# -- 4. Copy uploaded files ---------------------------------------------------
Step "Exporting uploaded files..."
$UploadsOut   = "$Bundle\uploads"
$null         = New-Item -ItemType Directory -Force -Path $UploadsOut
$localUploads = ".\backend\uploads"

if (Test-Path $localUploads) {
    $files = Get-ChildItem $localUploads -Recurse -File
    if ($files.Count -gt 0) {
        Copy-Item -Path "$localUploads\*" -Destination $UploadsOut -Recurse -Force
        Ok "Copied $($files.Count) file(s) from backend\uploads"
    } else {
        Warn "backend\uploads exists but is empty -- no files to copy."
    }
} else {
    Warn "backend\uploads not found locally -- trying Docker volume..."
    try {
        $absBundle = (Resolve-Path $Bundle).Path
        docker run --rm `
            -v kiterp-uploads:/data `
            -v "${absBundle}:/out" `
            alpine sh -c "cp -r /data/. /out/uploads/ 2>/dev/null || true"
        $cnt = (Get-ChildItem $UploadsOut -Recurse -File -ErrorAction SilentlyContinue).Count
        Ok "Copied $cnt file(s) from Docker volume."
    } catch {
        Warn "Could not copy uploads -- skipping (DB dump is complete)."
    }
}

# -- 5. Table row counts for README ------------------------------------------
Step "Collecting table statistics..."
$tableStats = docker exec -e "PGPASSWORD=$DB_PASS" $CONTAINER psql `
    -U $DB_USER -d $DB -t -c `
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"
$tableCount = ($tableStats -split "`n" | Where-Object { $_.Trim() -ne '' }).Count

# -- 6. Write README ----------------------------------------------------------
Step "Writing README.txt..."
$pgVer = docker exec $CONTAINER psql --version
$readme = @"
KITERP Database Export
=======================
Exported at : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Database    : $DB
Tables      : $tableCount (public schema)
Postgres    : $pgVer
Dump format : Plain SQL (UTF-8, --clean --if-exists)

Files in this bundle
--------------------
  database.sql    Full schema + all data (run psql to restore)
  uploads/        Vendor-uploaded files (logos, attachments, etc.)
  import-db.ps1   One-command restore script for Windows + Docker
  README.txt      This file

Quick restore (Windows + Docker Desktop)
-----------------------------------------
  1. Install Docker Desktop and start it.
  2. Clone/copy the KITERP project to your machine.
  3. Extract this zip anywhere, then run:

       .\import-db.ps1 -ExportDir "C:\path\to\this-folder"

  4. When prompted type 'yes' to confirm the restore.
  5. After import:   docker compose up -d
     - Vendor app  : http://localhost:3001
     - Business Front  : http://localhost:3002
     - API docs    : http://localhost:8000/docs

Manual restore (if import-db.ps1 is unavailable)
-------------------------------------------------
  docker compose up -d postgres
  docker cp database.sql kiterp-postgres:/tmp/restore.sql
  docker exec kiterp-postgres psql -U postgres -d postgres -c 'DROP DATABASE IF EXISTS kiterp; CREATE DATABASE kiterp OWNER postgres;"
  docker exec kiterp-postgres psql -U postgres -d kiterp -f /tmp/restore.sql
  docker compose up -d
"@
$readme | Out-File -FilePath "$Bundle\README.txt" -Encoding UTF8
Ok "README.txt written."

# -- 7. Copy import script into bundle ----------------------------------------
Step "Bundling import-db.ps1..."
if (Test-Path ".\import-db.ps1") {
    Copy-Item ".\import-db.ps1" "$Bundle\import-db.ps1"
    Ok "import-db.ps1 included."
} else {
    Warn "import-db.ps1 not found next to export-db.ps1 -- bundle won't include it."
}

# -- 8. Zip everything --------------------------------------------------------
Step "Creating zip archive..."
$ZipPath = "$OutDir\kiterp-export-$ts.zip"
Compress-Archive -Path "$Bundle\*" -DestinationPath $ZipPath -Force
$sizeMB = [Math]::Round((Get-Item $ZipPath).Length / 1MB, 2)
Ok "Zip created: ${sizeMB} MB"

# -- 9. Cleanup temp folder ---------------------------------------------------
Remove-Item -Recurse -Force $Bundle

# -- Done ---------------------------------------------------------------------
Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  Export complete!" -ForegroundColor Green
Write-Host "  File : $ZipPath" -ForegroundColor White
Write-Host "  Size : ${sizeMB} MB" -ForegroundColor White
Write-Host "  Share this zip with your team." -ForegroundColor White
Write-Host "  They run: .\import-db.ps1 to restore." -ForegroundColor White
Write-Host "=============================================" -ForegroundColor Green
