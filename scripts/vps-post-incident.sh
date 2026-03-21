#!/usr/bin/env bash
# Run ON YOUR VPS after SSH (not from your laptop IDE).
# Edit APP_DIR and APP_PORT before running.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/connectflow}"
APP_PORT="${APP_PORT:-3005}"

echo "==> Killing common miner processes (best effort)"
sudo pkill -9 xmrig 2>/dev/null || true
sudo pkill -9 -f kdevtmpfsi 2>/dev/null || true
sudo pkill -9 -f kinsing 2>/dev/null || true

echo "==> Quick process check"
ps aux | grep -E 'xmrig|kdevtmpfsi|kinsing' | grep -v grep || echo "(none found)"

echo "==> Reinstall app from clean lockfile (pnpm)"
cd "$APP_DIR"
rm -rf node_modules .next
command -v pnpm >/dev/null 2>&1 || { echo "Install pnpm first: npm i -g pnpm"; exit 1; }
pnpm install --ignore-scripts
pnpm exec prisma generate
pnpm run build

echo "==> Done. Start your process manager (pm2/systemd) manually."
echo "    App should listen on port ${APP_PORT} — open only that + SSH in UFW."
