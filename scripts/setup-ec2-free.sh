#!/usr/bin/env bash
# ============================================
# KITERP - AWS Free Tier EC2 Setup
# ============================================
# Sets up a t3.micro (1 GB RAM) instance for development:
#   - Adds 2 GB swap to prevent OOM kills
#   - Installs Docker + Docker Compose v2
#   - Installs Git
#   - Configures Docker for low-memory usage
#
# Run as root on a fresh Amazon Linux 2023 instance:
#   chmod +x scripts/setup-ec2-free.sh
#   sudo ./scripts/setup-ec2-free.sh
# ============================================

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: Run as root (sudo)"
    exit 1
fi

echo "=== KITERP - Free Tier EC2 Setup ==="
echo ""

# -----------------------------------------------
# 1. Create 2 GB swap file
# -----------------------------------------------
echo "[1/5] Creating 2 GB swap file..."
if [ -f /swapfile ]; then
    echo "  Swap file already exists, skipping."
else
    dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "  Swap enabled: 2 GB"
fi

# Tune swappiness for a low-RAM server
sysctl vm.swappiness=60
echo 'vm.swappiness=60' >> /etc/sysctl.conf

echo "  Current memory:"
free -h
echo ""

# -----------------------------------------------
# 2. Install Docker
# -----------------------------------------------
echo "[2/5] Installing Docker..."
dnf update -y
dnf install docker -y
systemctl start docker
systemctl enable docker
usermod -aG docker ec2-user

# Configure Docker daemon for low memory
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'DAEMON'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}
DAEMON
systemctl restart docker

# -----------------------------------------------
# 3. Install Docker Compose v2
# -----------------------------------------------
echo "[3/5] Installing Docker Compose v2..."
ARCH=$(uname -m)
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${ARCH}" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# -----------------------------------------------
# 4. Install Git and utilities
# -----------------------------------------------
echo "[4/5] Installing Git and utilities..."
dnf install git htop -y

# -----------------------------------------------
# 5. Print summary
# -----------------------------------------------
echo ""
echo "[5/5] Verifying installations..."
echo "==============================="
echo "Docker:          $(docker --version)"
echo "Docker Compose:  $(docker compose version)"
echo "Git:             $(git --version)"
echo "Swap:            $(swapon --show | tail -1)"
echo "Memory:          $(free -h | grep Mem | awk '{print $2}') RAM + $(free -h | grep Swap | awk '{print $2}') swap"
echo "==============================="
echo ""
echo "=== Next Steps ==="
echo "1. Log out and back in (for docker group):  exit"
echo "2. Clone your repo:"
echo "     git clone <repo-url> /home/ec2-user/kiterp"
echo "3. Set up environment:"
echo "     cd /home/ec2-user/kiterp"
echo "     cp .env.dev.example .env"
echo "4. Deploy:"
echo "     ./scripts/deploy-dev.sh"
echo ""
echo "=== AWS Free Tier Reminder ==="
echo "  EC2 t3.micro:  750 hours/month (12 months)"
echo "  S3:            5 GB storage (12 months)"
echo "  Data transfer: 100 GB/month outbound"
echo "  Stop the instance when not in use to save hours!"
echo ""
echo "=== Setup Complete ==="
