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
LOG_FILE="$PROJECT_DIR/deploy.log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"; }
fail() { echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"; exit 1; }

# Load production env vars into the shell (works with all compose versions; avoids --env-file).
load_env_file() {
    local env_file="$1"
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
}

# Prefer Docker Compose v2 plugin; fall back to standalone docker-compose (common on older EC2).
detect_compose_cmd() {
    local compose_file="$1"
    if docker compose version >/dev/null 2>&1; then
        echo "docker compose -f ${compose_file}"
        return 0
    fi
    if command -v docker-compose >/dev/null 2>&1; then
        echo "docker-compose -f ${compose_file}"
        return 0
    fi
    fail "Neither 'docker compose' (v2 plugin) nor 'docker-compose' found. Install with: sudo ./scripts/setup-ec2.sh"
}

cd "$PROJECT_DIR"
echo "" >> "$LOG_FILE"
log "=== Deploy started at $(date -u '+%Y-%m-%d %H:%M:%S UTC') ==="

# Prefer .env.config (production); fall back to .env for older setups.
ENV_FILE=""
if [ -f .env.config ]; then
    ENV_FILE=".env.config"
elif [ -f .env ]; then
    ENV_FILE=".env"
else
    fail "No env file found. Copy .env.config.example to .env.config on this server and fill in values (including SENDGRID_API_KEY)."
fi
load_env_file "$ENV_FILE"
COMPOSE="$(detect_compose_cmd "$COMPOSE_FILE")"
log "Using env file: $ENV_FILE"
log "Using compose: $COMPOSE"

# Warn if email OTP cannot send (common cause of "no OTP on prod").
SG_KEY="${SENDGRID_API_KEY:-}"
SMTP_PWD="${SMTP_PASSWORD:-}"
FROM_ADDR="${SENDGRID_FROM_EMAIL:-${FROM_EMAIL:-noreply@kiterp.com}}"
if [[ ! "$SG_KEY" =~ ^SG\. ]] && [[ ! "$SMTP_PWD" =~ ^SG\. ]]; then
    warn "SENDGRID_API_KEY (or SMTP_PASSWORD=SG...) missing in $ENV_FILE — email OTP will NOT send."
    warn "Set SENDGRID_API_KEY=SG.... in $ENV_FILE, ensure FROM_EMAIL is verified in SendGrid, then redeploy."
elif [[ "$SG_KEY" =~ ^SG\. ]] && [[ "$SMTP_PWD" =~ ^SG\. ]] && [[ "$SG_KEY" != "$SMTP_PWD" ]]; then
    warn "SENDGRID_API_KEY and SMTP_PASSWORD are different SG. keys. Prefer SENDGRID_API_KEY; sync SMTP_PASSWORD to the same value to avoid confusion."
fi
if [[ "$SG_KEY" =~ ^SG\. ]] || [[ "$SMTP_PWD" =~ ^SG\. ]]; then
    CHECK_KEY="$SG_KEY"
    [[ "$CHECK_KEY" =~ ^SG\. ]] || CHECK_KEY="$SMTP_PWD"
    HTTP_CODE=$(curl -s -o /tmp/kiterp_sg_check.json -w "%{http_code}" \
        -H "Authorization: Bearer ${CHECK_KEY}" \
        "https://api.sendgrid.com/v3/scopes" || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        log "SendGrid API key OK (HTTP 200). Checking sender identity for: $FROM_ADDR"
        SENDERS_JSON=$(curl -s -H "Authorization: Bearer ${CHECK_KEY}" \
            "https://api.sendgrid.com/v3/verified_senders?limit=100" || echo "")
        DOMAINS_JSON=$(curl -s -H "Authorization: Bearer ${CHECK_KEY}" \
            "https://api.sendgrid.com/v3/whitelabel/domains" || echo "")
        FROM_DOMAIN="${FROM_ADDR#*@}"
        if echo "$SENDERS_JSON" | grep -Fqi "\"from_email\":\"${FROM_ADDR}\"" \
            || echo "$SENDERS_JSON" | grep -Fqi "\"from_email\": \"${FROM_ADDR}\""; then
            log "Verified Single Sender found for $FROM_ADDR"
        elif echo "$DOMAINS_JSON" | grep -Fqi "\"domain\":\"${FROM_DOMAIN}\"" \
            || echo "$DOMAINS_JSON" | grep -Fqi "\"domain\": \"${FROM_DOMAIN}\""; then
            log "Authenticated domain found for $FROM_DOMAIN"
        else
            warn "No verified Sender Identity for $FROM_ADDR (and no domain auth for $FROM_DOMAIN)."
            warn "Email OTP will fail with 403 until you fix this in SendGrid:"
            warn "  Settings → Sender Authentication → Verify a Single Sender OR Authenticate Domain"
            warn "  Then set FROM_EMAIL and SENDGRID_FROM_EMAIL to that verified address in $ENV_FILE"
        fi
    elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
        warn "SendGrid rejected the API key (HTTP $HTTP_CODE). Create a new key with Mail Send permission and update SENDGRID_API_KEY in $ENV_FILE."
        warn "Also verify sender identity for: $FROM_ADDR (SendGrid → Settings → Sender Authentication)."
    else
        warn "Could not validate SendGrid key from this host (HTTP $HTTP_CODE). Check outbound HTTPS and the key in $ENV_FILE."
    fi
    rm -f /tmp/kiterp_sg_check.json 2>/dev/null || true
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
    # `restart` keeps old env vars — recreate so .env.config SendGrid changes apply.
    log "Recreating containers so env from $ENV_FILE is applied..."
    $COMPOSE up -d --force-recreate backend
    log "Recreate complete."
    $COMPOSE ps
    exit 0
fi

# Pull latest code
log "Pulling latest code from git..."
git pull origin main 2>&1 | tee -a "$LOG_FILE"

# Small EC2 instances often run out of space during multi-image builds.
AVAIL_KB=$(df -Pk /var/lib/docker 2>/dev/null | awk 'NR==2 {print $4}' || df -Pk / | awk 'NR==2 {print $4}')
if [ -n "$AVAIL_KB" ] && [ "$AVAIL_KB" -lt 3145728 ]; then
    warn "Low disk (<3GB free: ${AVAIL_KB}KB). Pruning Docker builder cache and unused images..."
    docker builder prune -af 2>&1 | tee -a "$LOG_FILE" || true
    docker image prune -af 2>&1 | tee -a "$LOG_FILE" || true
fi

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
