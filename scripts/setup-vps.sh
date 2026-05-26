#!/usr/bin/env bash
# setup-vps.sh — One-time VPS setup for KuroFunnels
# Run as root or with sudo on Ubuntu 22.04 / 24.04
#
# Usage:
#   bash setup-vps.sh your-domain.com your@email.com
#
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "Usage: bash setup-vps.sh <domain> <email>"
  echo "  domain — e.g. app.yourdomain.com"
  echo "  email  — for Let's Encrypt SSL notifications"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   KuroFunnels VPS Setup                  ║"
echo "║   Domain : $DOMAIN"
echo "║   Email  : $EMAIL"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. System packages ────────────────────────────────────────────────────────
echo "→ Updating packages..."
apt-get update -qq
apt-get install -y -qq curl git ufw certbot

# ── 2. Install Docker ─────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "→ Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
else
  echo "→ Docker already installed."
fi

# Docker Compose (plugin)
if ! docker compose version &>/dev/null; then
  echo "→ Installing Docker Compose plugin..."
  apt-get install -y -qq docker-compose-plugin
else
  echo "→ Docker Compose already installed."
fi

# ── 3. Firewall ───────────────────────────────────────────────────────────────
echo "→ Configuring firewall..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# ── 4. Clone / update repo ────────────────────────────────────────────────────
DEPLOY_DIR="/opt/kuro-funnels"

if [[ -d "$DEPLOY_DIR/.git" ]]; then
  echo "→ Repo already cloned — pulling latest..."
  git -C "$DEPLOY_DIR" pull
else
  echo "→ Cloning repo..."
  git clone https://github.com/KuroXone/kuro-funnels.git "$DEPLOY_DIR"
fi

cd "$DEPLOY_DIR"

# ── 5. Create backend .env if missing ────────────────────────────────────────
if [[ ! -f backend/.env ]]; then
  echo "→ Creating backend/.env from template..."
  cp backend/.env.example backend/.env

  # Generate a strong secret key
  SECRET=$(openssl rand -hex 32)
  DB_PASS=$(openssl rand -hex 16)

  sed -i "s|CHANGE_ME_USE_openssl_rand_hex_32|$SECRET|g" backend/.env
  sed -i "s|CHANGE_DB_PASSWORD|$DB_PASS|g" backend/.env
  sed -i "s|YOUR_DOMAIN|$DOMAIN|g"         backend/.env

  # Sync db service password
  export DB_PASSWORD="$DB_PASS"
  echo "DB_PASSWORD=$DB_PASS" >> /opt/kuro-funnels/.env.docker

  echo ""
  echo "  ⚠  backend/.env created with generated secrets."
  echo "     Edit it to add CLOUDFLARE_API_TOKEN if needed."
  echo ""
fi

# ── 6. Get SSL certificate (HTTP-01 challenge, nginx must be off) ────────────
echo "→ Obtaining SSL certificate for $DOMAIN..."
certbot certonly --standalone \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  -d "$DOMAIN" \
  -d "www.$DOMAIN" 2>/dev/null || \
certbot certonly --standalone \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  -d "$DOMAIN" || true

# ── 7. Patch nginx SSL config with actual domain ──────────────────────────────
echo "→ Patching nginx SSL config..."
sed -i "s|YOUR_DOMAIN|$DOMAIN|g" nginx/nginx.ssl.conf

# ── 8. Build & start containers ───────────────────────────────────────────────
echo "→ Building Docker images (this takes a few minutes)..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache

echo "→ Starting services..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# ── 9. Auto-renew SSL cert ────────────────────────────────────────────────────
if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
  (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && docker exec kuro-funnels-nginx-1 nginx -s reload") | crontab -
  echo "→ SSL auto-renewal cron job added."
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Setup complete!                        ║"
echo "║                                          ║"
echo "║   App  → https://$DOMAIN"
echo "║   API  → https://$DOMAIN/api/docs"
echo "║                                          ║"
echo "║   To view logs:                          ║"
echo "║     docker compose logs -f               ║"
echo "╚══════════════════════════════════════════╝"
