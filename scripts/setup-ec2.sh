#!/usr/bin/env bash
# ============================================
# KITERP - EC2 Instance Setup Script
# ============================================
# Run this on a fresh Amazon Linux 2023 EC2 instance to install
# all required dependencies (Docker, Docker Compose, Git, Certbot).
#
# Usage:
#   chmod +x scripts/setup-ec2.sh
#   sudo ./scripts/setup-ec2.sh
# ============================================

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    echo "Please run as root (sudo)"
    exit 1
fi

echo "=== KITERP EC2 Setup ==="

# Update system
echo "[1/6] Updating system packages..."
dnf update -y

# Install Docker
echo "[2/6] Installing Docker..."
dnf install docker -y
systemctl start docker
systemctl enable docker
usermod -aG docker ec2-user

# Install Docker Compose v2 plugin
echo "[3/6] Installing Docker Compose v2..."
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Install Git and utilities
echo "[4/6] Installing Git and utilities..."
dnf install git htop -y

# Install PostgreSQL client (for connecting to RDS)
echo "[5/6] Installing PostgreSQL client..."
dnf install postgresql15 -y 2>/dev/null || dnf install postgresql -y

# Install Certbot (for SSL certificates)
echo "[6/6] Installing Certbot..."
dnf install certbot -y 2>/dev/null || pip3 install certbot

# Verify installations
echo ""
echo "=== Installation Summary ==="
echo "Docker:         $(docker --version)"
echo "Docker Compose: $(docker compose version)"
echo "Git:            $(git --version)"
echo "Certbot:        $(certbot --version 2>&1 || echo 'not found')"
echo ""
echo "=== Next Steps ==="
echo "1. Log out and back in (for docker group to take effect)"
echo "2. Clone your repo:  git clone <repo-url> /home/ec2-user/kiterp"
echo "3. Copy env file:    cp .env.example .env && nano .env"
echo "4. Deploy:           ./scripts/deploy.sh"
echo ""
echo "=== Setup Complete ==="
