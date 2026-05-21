#!/bin/bash
# ============================================
# KITERP - Docker Setup Script (Linux/Mac)
# ============================================
# Usage: ./scripts/docker-setup.sh [command]
# Commands: dev, prod, stop, reset, logs, build, status, migrate
# ============================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

show_help() {
    echo ""
    echo -e "  ${CYAN}KITERP Docker Commands${NC}"
    echo -e "  ${CYAN}=======================${NC}"
    echo ""
    echo -e "  ${GREEN}dev${NC}       Start all services in development mode (hot reload)"
    echo -e "  ${GREEN}prod${NC}      Start all services in production mode"
    echo -e "  ${YELLOW}stop${NC}      Stop all running services"
    echo -e "  ${RED}reset${NC}     Stop services and remove all data volumes"
    echo -e "  ${GREEN}logs${NC}      Follow logs of all services"
    echo -e "  ${GREEN}build${NC}     Rebuild all Docker images"
    echo -e "  ${GREEN}status${NC}    Show status of all containers"
    echo -e "  ${GREEN}migrate${NC}   Run database migrations"
    echo -e "  ${GREEN}shell${NC}     Open a shell in the backend container"
    echo -e "  ${GREEN}db${NC}        Open PostgreSQL CLI"
    echo ""
}

case "${1:-help}" in
    dev)
        echo -e "${CYAN}Starting KITERP in DEVELOPMENT mode...${NC}"
        docker compose up --build -d
        echo ""
        echo -e "${GREEN}Services are starting up!${NC}"
        echo "  Backend API:    http://localhost:8000"
        echo "  API Docs:       http://localhost:8000/docs"
        echo "  Admin Panel:    http://localhost:3000"
        echo "  Vendor Panel:   http://localhost:3001"
        echo "  Business Front:     http://localhost:3002"
        echo ""
        echo -e "${YELLOW}Run './scripts/docker-setup.sh logs' to follow logs${NC}"
        ;;
    prod)
        if [ ! -f ".env" ]; then
            echo -e "${RED}ERROR: .env file not found!${NC}"
            echo -e "${YELLOW}Copy .env.example to .env and update values first.${NC}"
            exit 1
        fi
        echo -e "${CYAN}Starting KITERP in PRODUCTION mode...${NC}"
        docker compose -f docker-compose.prod.yml up --build -d
        echo -e "${GREEN}Production services started!${NC}"
        ;;
    stop)
        echo -e "${YELLOW}Stopping all services...${NC}"
        docker compose down 2>/dev/null || true
        docker compose -f docker-compose.prod.yml down 2>/dev/null || true
        echo -e "${GREEN}All services stopped.${NC}"
        ;;
    reset)
        echo -e "${RED}WARNING: This will delete ALL data (databases, uploads)!${NC}"
        read -p "Are you sure? (y/N) " confirm
        if [ "$confirm" = "y" ]; then
            docker compose down -v --remove-orphans 2>/dev/null || true
            docker compose -f docker-compose.prod.yml down -v --remove-orphans 2>/dev/null || true
            echo -e "${GREEN}All services stopped and volumes removed.${NC}"
        else
            echo -e "${YELLOW}Cancelled.${NC}"
        fi
        ;;
    logs)
        docker compose logs -f
        ;;
    build)
        echo -e "${CYAN}Rebuilding all Docker images...${NC}"
        docker compose build --no-cache
        echo -e "${GREEN}All images rebuilt.${NC}"
        ;;
    status)
        docker compose ps
        ;;
    migrate)
        echo -e "${CYAN}Running database migrations...${NC}"
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
        ;;
    shell)
        docker compose exec backend bash
        ;;
    db)
        docker compose exec postgres psql -U postgres -d kiterp
        ;;
    *)
        show_help
        ;;
esac
