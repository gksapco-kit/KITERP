#!/usr/bin/env bash
# ============================================
# KITERP - Production Deploy Script
# ============================================
# Run on the EC2 instance to pull latest code,
# rebuild containers, run migrations, and restart.
#
# Usage:
#   ./scripts/deploy.sh              # Full deploy (pull + build + migrate + restart)
#   ./scripts/deploy.sh --no-migrate # Skip database migrations
#   ./scripts/deploy.sh --restart    # Just restart without rebuilding
# ============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="docker-compose.prod.yml"
COMPOSE="docker compose -f $COMPOSE_FILE"
LOG_FILE="$PROJECT_DIR/deploy.log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"; }
fail() { echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"; exit 1; }

cd "$PROJECT_DIR"
echo "" >> "$LOG_FILE"
log "=== Deploy started at $(date -u '+%Y-%m-%d %H:%M:%S UTC') ==="

if [ ! -f .env ]; then
    fail ".env file not found. Copy .env.example to .env and fill in values."
fi

SKIP_MIGRATE=false
RESTART_ONLY=false
for arg in "$@"; do
    case $arg in
        --no-migrate) SKIP_MIGRATE=true ;;
        --restart)    RESTART_ONLY=true ;;
        *) warn "Unknown argument: $arg" ;;
    esac
done

if [ "$RESTART_ONLY" = true ]; then
    log "Restarting containers..."
    $COMPOSE restart
    log "Restart complete."
    $COMPOSE ps
    exit 0
fi

# Pull latest code
log "Pulling latest code from git..."
git pull origin main 2>&1 | tee -a "$LOG_FILE"

# Build images
log "Building Docker images..."
$COMPOSE build 2>&1 | tee -a "$LOG_FILE"

# Run database migrations
if [ "$SKIP_MIGRATE" = false ]; then
    log "Running Alembic migrations..."
    $COMPOSE run --rm backend alembic upgrade head 2>&1 | tee -a "$LOG_FILE"
else
    warn "Skipping database migrations (--no-migrate)"
fi

# Restart services with zero-downtime approach
log "Bringing up services..."
$COMPOSE up -d 2>&1 | tee -a "$LOG_FILE"

# Wait and verify health
log "Waiting for services to become healthy..."
sleep 10

HEALTHY=true
for service in backend nginx; do
    STATUS=$($COMPOSE ps --format '{{.Status}}' "$service" 2>/dev/null || echo "unknown")
    if echo "$STATUS" | grep -qi "up"; then
        log "$service: $STATUS"
    else
        warn "$service may not be healthy: $STATUS"
        HEALTHY=false
    fi
done

# Clean up old images
log "Cleaning up unused Docker images..."
docker image prune -f 2>&1 | tee -a "$LOG_FILE"

echo ""
$COMPOSE ps
echo ""

if [ "$HEALTHY" = true ]; then
    log "=== Deploy completed successfully at $(date -u '+%Y-%m-%d %H:%M:%S UTC') ==="
else
    warn "=== Deploy finished with warnings. Check service health. ==="
fi
