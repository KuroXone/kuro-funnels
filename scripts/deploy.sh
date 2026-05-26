#!/usr/bin/env bash
# deploy.sh — Pull latest code and restart containers on the VPS
# Run this on the VPS (or via SSH) after pushing new code to GitHub.
#
# Usage:
#   bash /opt/kuro-funnels/scripts/deploy.sh
#
set -euo pipefail

DEPLOY_DIR="/opt/kuro-funnels"
cd "$DEPLOY_DIR"

echo "→ Pulling latest from GitHub..."
git pull

echo "→ Rebuilding changed images..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

echo "→ Restarting services (zero-downtime rolling)..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

echo "→ Removing old/unused images..."
docker image prune -f

echo "✓ Deploy done. Running containers:"
docker compose ps
