#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-bridal-studio}"
APP_USER="${APP_USER:-ubuntu}"
APP_DIR="${APP_DIR:-/var/www/bridal-dress-content-studio}"
REPO_URL="${REPO_URL:-${REPO_SSH:-git@github.com:davidwang555205-prog/bridal-dress-content-studio.git}}"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/github_bridal_deploy}"
DOMAIN="${DOMAIN:-bridaldress.top}"
WWW_DOMAIN="${WWW_DOMAIN:-www.bridaldress.top}"
SERVER_IP="${SERVER_IP:-43.154.247.174}"
PORT="${PORT:-8787}"
WALA_API_BASE_URL="${WALA_API_BASE_URL:-https://walaapi.net/v1}"
WALA_IMAGE_MODEL="${WALA_IMAGE_MODEL:-gpt-image-2}"
WALA_IMAGE_QUALITY="${WALA_IMAGE_QUALITY:-medium}"
HISTORY_RETENTION_DAYS="${HISTORY_RETENTION_DAYS:-180}"
WALA_IMAGE_TIMEOUT_MS="${WALA_IMAGE_TIMEOUT_MS:-180000}"
WALA_IMAGE_RETRY_ATTEMPTS="${WALA_IMAGE_RETRY_ATTEMPTS:-3}"
WALA_KEY="${WALA_API_KEY_VALUE:-${WALA_API_KEY:-}}"
SESSION_SECRET="${APP_SESSION_SECRET_VALUE:-${APP_SESSION_SECRET:-}}"

if [ -z "$WALA_KEY" ] && [ -f "$APP_DIR/.env" ]; then
  WALA_KEY="$(grep -E '^WALA_API_KEY=' "$APP_DIR/.env" | tail -n 1 | cut -d= -f2-)"
fi

if [ -z "$SESSION_SECRET" ] && [ -f "$APP_DIR/.env" ]; then
  SESSION_SECRET="$(grep -E '^APP_SESSION_SECRET=' "$APP_DIR/.env" | tail -n 1 | cut -d= -f2-)"
fi

if [ -z "$SESSION_SECRET" ]; then
  SESSION_SECRET="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
fi

if [ -z "$WALA_KEY" ]; then
  echo "ERROR: Set WALA_API_KEY_VALUE before running this script." >&2
  exit 1
fi

USE_DEPLOY_KEY="false"
case "$REPO_URL" in
  git@*|ssh://*)
    USE_DEPLOY_KEY="true"
    if [ ! -f "$DEPLOY_KEY" ]; then
      echo "ERROR: Deploy key not found at $DEPLOY_KEY" >&2
      exit 1
    fi
    ;;
esac

echo "Installing system packages..."
sudo apt-get update
sudo apt-get install -y git curl nginx ca-certificates

node_major="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
if [ "$node_major" -lt 20 ]; then
  echo "Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "Preparing Git access..."
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
touch "$HOME/.ssh/known_hosts"
ssh-keygen -F github.com >/dev/null || ssh-keyscan github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null
if [ "$USE_DEPLOY_KEY" = "true" ]; then
  chmod 600 "$DEPLOY_KEY"
fi

echo "Fetching application source..."
sudo mkdir -p "$(dirname "$APP_DIR")"
sudo chown -R "$APP_USER:$APP_USER" "$(dirname "$APP_DIR")"

if [ ! -d "$APP_DIR/.git" ]; then
  if [ "$USE_DEPLOY_KEY" = "true" ]; then
    GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o StrictHostKeyChecking=accept-new" git clone "$REPO_URL" "$APP_DIR"
  else
    git clone "$REPO_URL" "$APP_DIR"
  fi
else
  cd "$APP_DIR"
  git remote set-url origin "$REPO_URL"
  if [ "$USE_DEPLOY_KEY" = "true" ]; then
    GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o StrictHostKeyChecking=accept-new" git fetch origin main
  else
    git fetch origin main
  fi
  git reset --hard origin/main
fi

cd "$APP_DIR"

echo "Writing production environment..."
cat > .env <<EOF
WALA_API_KEY=$WALA_KEY
WALA_API_BASE_URL=$WALA_API_BASE_URL
WALA_IMAGE_MODEL=$WALA_IMAGE_MODEL
WALA_IMAGE_QUALITY=$WALA_IMAGE_QUALITY
HISTORY_RETENTION_DAYS=$HISTORY_RETENTION_DAYS
WALA_IMAGE_TIMEOUT_MS=$WALA_IMAGE_TIMEOUT_MS
WALA_IMAGE_RETRY_ATTEMPTS=$WALA_IMAGE_RETRY_ATTEMPTS
APP_SESSION_SECRET=$SESSION_SECRET
PORT=$PORT
EOF
chmod 600 .env
mkdir -p server/data

echo "Installing app dependencies and building..."
npm install
npm run build

npm_bin="$(command -v npm)"

echo "Installing systemd service..."
sudo tee "/etc/systemd/system/$APP_NAME.service" >/dev/null <<EOF
[Unit]
Description=Bridal Dress Content Studio
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
ExecStart=$npm_bin run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now "$APP_NAME"
sudo systemctl restart "$APP_NAME"

echo "Installing nginx site..."
if sudo test -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" && sudo test -f "/etc/letsencrypt/live/$DOMAIN/privkey.pem"; then
  sudo tee "/etc/nginx/sites-available/$APP_NAME" >/dev/null <<EOF
server {
  listen 80;
  server_name $DOMAIN $WWW_DOMAIN $SERVER_IP;
  return 301 https://\$host\$request_uri;
}

server {
  listen 443 ssl;
  server_name $DOMAIN $WWW_DOMAIN;

  ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
  include /etc/letsencrypt/options-ssl-nginx.conf;
  ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

  client_max_body_size 80m;

  location / {
    proxy_pass http://127.0.0.1:$PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_read_timeout 240s;
    proxy_send_timeout 240s;
  }
}
EOF
else
  sudo tee "/etc/nginx/sites-available/$APP_NAME" >/dev/null <<EOF
server {
  listen 80;
  server_name $DOMAIN $WWW_DOMAIN $SERVER_IP;

  client_max_body_size 80m;

  location / {
    proxy_pass http://127.0.0.1:$PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 240s;
    proxy_send_timeout 240s;
  }
}
EOF
fi

sudo ln -sf "/etc/nginx/sites-available/$APP_NAME" "/etc/nginx/sites-enabled/$APP_NAME"
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx

echo "SERVICE_STATUS"
systemctl --no-pager --full status "$APP_NAME" | head -n 25
echo "LOCAL_APP"
curl -I "http://127.0.0.1:$PORT/"
echo "NGINX"
curl -I "http://127.0.0.1/"
echo "DEPLOY_DONE"
