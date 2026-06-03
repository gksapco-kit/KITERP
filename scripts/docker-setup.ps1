# ============================================
# KITERP - Docker Setup Script (Windows/PowerShell)
# ============================================
# Usage: .\scripts\docker-setup.ps1 [command]
# Commands: dev, prod, stop, reset, logs, build, status, migrate
# ============================================

param(
    [Parameter(Position=0)]
    [string]$Command = "help"
)

$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Show-Help {
    Write-Host ""
    Write-Host "  KITERP Docker Commands" -ForegroundColor Cyan
    Write-Host "  =======================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  dev       Start all services in development mode (hot reload)" -ForegroundColor Green
    Write-Host "  prod      Start all services in production mode" -ForegroundColor Green
    Write-Host "  stop      Stop all running services" -ForegroundColor Yellow
    Write-Host "  reset     Stop services and remove all data volumes" -ForegroundColor Red
    Write-Host "  logs      Follow logs of all services" -ForegroundColor Green
    Write-Host "  build     Rebuild all Docker images" -ForegroundColor Green
    Write-Host "  status    Show status of all containers" -ForegroundColor Green
    Write-Host "  migrate   Run database migrations" -ForegroundColor Green
    Write-Host "  shell     Open a shell in the backend container" -ForegroundColor Green
    Write-Host "  db        Open PostgreSQL CLI" -ForegroundColor Green
    Write-Host ""
}

Set-Location $PROJECT_ROOT

switch ($Command) {
    "dev" {
        Write-Host "Starting KITERP in DEVELOPMENT mode..." -ForegroundColor Cyan
        docker compose up --build -d
        Write-Host "Starting localhost bridge (3001/3002)..." -ForegroundColor Cyan
        npm install --no-audit --no-fund 2>$null | Out-Null
        Start-Process -WindowStyle Hidden -FilePath "node" -ArgumentList "scripts/localhost-bridge.mjs" -WorkingDirectory $PROJECT_ROOT
        Start-Sleep -Seconds 2
        Write-Host ""
        Write-Host "Services are starting up!" -ForegroundColor Green
        Write-Host "  Backend API:    http://localhost:8000" -ForegroundColor White
        Write-Host "  API Docs:       http://localhost:8000/docs" -ForegroundColor White
        Write-Host "  Admin Panel:    http://localhost:3000" -ForegroundColor White
        Write-Host "  Vendor Panel:   http://localhost:3001" -ForegroundColor White
        Write-Host "  Business Front: http://localhost:3002" -ForegroundColor White
        Write-Host ""
        Write-Host "If localhost still fails, run the bridge manually:" -ForegroundColor Yellow
        Write-Host "  npm run dev:docker-bridge" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Or as Administrator (one-time Windows fix):" -ForegroundColor DarkGray
        Write-Host "  .\scripts\fix-localhost-docker.ps1" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host "Run '.\scripts\docker-setup.ps1 logs' to follow logs" -ForegroundColor Yellow
    }
    "prod" {
        if (-not (Test-Path ".env")) {
            Write-Host "ERROR: .env file not found!" -ForegroundColor Red
            Write-Host "Copy .env.example to .env and update values first." -ForegroundColor Yellow
            exit 1
        }
        Write-Host "Starting KITERP in PRODUCTION mode..." -ForegroundColor Cyan
        docker compose -f docker-compose.prod.yml up --build -d
        Write-Host "Production services started!" -ForegroundColor Green
    }
    "stop" {
        Write-Host "Stopping all services..." -ForegroundColor Yellow
        docker compose down
        docker compose -f docker-compose.prod.yml down 2>$null
        Write-Host "All services stopped." -ForegroundColor Green
    }
    "reset" {
        Write-Host "WARNING: This will delete ALL data (databases, uploads)!" -ForegroundColor Red
        $confirm = Read-Host "Are you sure? (y/N)"
        if ($confirm -eq "y") {
            docker compose down -v --remove-orphans
            docker compose -f docker-compose.prod.yml down -v --remove-orphans 2>$null
            Write-Host "All services stopped and volumes removed." -ForegroundColor Green
        } else {
            Write-Host "Cancelled." -ForegroundColor Yellow
        }
    }
    "logs" {
        docker compose logs -f
    }
    "build" {
        Write-Host "Rebuilding all Docker images..." -ForegroundColor Cyan
        docker compose build --no-cache
        Write-Host "All images rebuilt." -ForegroundColor Green
    }
    "status" {
        docker compose ps
    }
    "migrate" {
        Write-Host "Running database migrations..." -ForegroundColor Cyan
        docker compose exec backend python -c "
import asyncio
from app.database import engine, Base
from app.models import *

async def migrate():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print('Database tables created/updated successfully!')

asyncio.run(migrate())
"
    }
    "shell" {
        docker compose exec backend bash
    }
    "db" {
        docker compose exec postgres psql -U postgres -d kiterp
    }
    default {
        Show-Help
    }
}
