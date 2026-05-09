#!/usr/bin/env bash
# ============================================
# KITERP - Dev Deploy Script (AWS Free Tier)
# ============================================
# One-command deploy for EC2 t3.micro instances.
# Builds frontends inside Docker, runs migrations,
# and starts all services.
#
# Usage:
#   ./scripts/deploy-dev.sh                # Full deploy
#   ./scripts/deploy-dev.sh --no-migrate   # Skip migrations
#   ./scripts/deploy-dev.sh --restart      # Restart only
#   ./scripts/deploy-dev.sh --down         # Stop everything
# ============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="docker-compose.dev-aws.yml"
COMPOSE="docker compose -f $COMPOSE_FILE"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[DEV]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
info() { echo -e "${CYAN}[INFO]${NC} $1"; }

cd "$PROJECT_DIR"

# Pre-flight checks
if [ ! -f .env ]; then
    warn ".env not found. Copying from .env.dev.example..."
    cp .env.dev.example .env
    log "Created .env from .env.dev.example. Edit if needed: nano .env"
fi

if ! command -v docker &>/dev/null; then
    fail "Docker not installed. Run: sudo ./scripts/setup-ec2-free.sh"
fi

# Check swap (critical for t3.micro)
SWAP_TOTAL=$(free -m | grep Swap | awk '{print $2}')
if [ "$SWAP_TOTAL" -lt 1000 ]; then
    warn "Swap is ${SWAP_TOTAL}MB. Recommend 2048MB+ for t3.micro."
    warn "Run: sudo ./scripts/setup-ec2-free.sh to set up swap."
fi

# Parse arguments
SKIP_MIGRATE=false
RESTART_ONLY=false
STOP_ALL=false
for arg in "$@"; do
    case $arg in
        --no-migrate) SKIP_MIGRATE=true ;;
        --restart)    RESTART_ONLY=true ;;
        --down)       STOP_ALL=true ;;
        *) warn "Unknown argument: $arg" ;;
    esac
done

if [ "$STOP_ALL" = true ]; then
    log "Stopping all services..."
    $COMPOSE down
    log "All services stopped."
    exit 0
fi

if [ "$RESTART_ONLY" = true ]; then
    log "Restarting services..."
    $COMPOSE restart
    $COMPOSE ps
    exit 0
fi

echo ""
info "============================================"
info " KITERP Dev Deploy (Free Tier)"
info "============================================"
echo ""

# Pull latest code if git repo
if [ -d .git ]; then
    log "Pulling latest code..."
    git pull origin main 2>/dev/null || git pull 2>/dev/null || warn "Git pull failed, using local code."
fi

# Build images one at a time to avoid OOM on t3.micro
log "Building backend image..."
$COMPOSE build backend

log "Building frontend images (this may take a few minutes)..."
$COMPOSE build frontend-build vendor-build storefront-build

log "Building nginx..."
$COMPOSE build nginx 2>/dev/null || true

# Start databases first (they need time to initialize)
log "Starting databases..."
$COMPOSE up -d postgres mongo redis
log "Waiting 15s for databases to initialize..."
sleep 15

# Run migrations
if [ "$SKIP_MIGRATE" = false ]; then
    log "Running database migrations..."
    $COMPOSE run --rm backend alembic upgrade head || warn "Migrations failed -- DB may already be up to date."
else
    warn "Skipping migrations (--no-migrate)"
fi

# Build and copy frontend static files
log "Building frontend static files..."
$COMPOSE up frontend-build vendor-build storefront-build

# Start remaining services
log "Starting backend and nginx..."
$COMPOSE up -d backend nginx

# Wait for startup
log "Waiting for services to start..."
sleep 10

# Show status
echo ""
$COMPOSE ps
echo ""

# Get the public IP for convenience
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "<your-ec2-ip>")

log "============================================"
log " Deploy complete!"
log "============================================"
echo ""
info "Access your dev environment:"
info "  Storefront:  http://${PUBLIC_IP}/"
info "  Admin Panel: http://${PUBLIC_IP}/admin/"
info "  Vendor:      http://${PUBLIC_IP}/vendor/"
info "  API Docs:    http://${PUBLIC_IP}/docs"
info "  Health:      http://${PUBLIC_IP}/health"
echo ""
info "Useful commands:"
info "  Logs:     docker compose -f $COMPOSE_FILE logs -f backend"
info "  Stop:     ./scripts/deploy-dev.sh --down"
info "  Restart:  ./scripts/deploy-dev.sh --restart"
echo ""

# Memory report
info "Memory usage:"
free -h
echo ""
