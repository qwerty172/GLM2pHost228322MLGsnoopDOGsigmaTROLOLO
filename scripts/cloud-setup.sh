#!/usr/bin/env bash
# Полная автоматическая установка в Cloud Agent / Linux (фазы 0–1)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> PostgreSQL"
if ! command -v psql >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib
fi
sudo pg_ctlcluster 16 main start 2>/dev/null || sudo service postgresql start
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='decentral_hub'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE decentral_hub;"
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';" 2>/dev/null || true

echo "==> .env"
node scripts/setup-env.mjs --docker

echo "==> pnpm install"
pnpm install

echo "==> db push"
pnpm --filter @workspace/db run push

echo "==> Smoke-test (API должен быть запущен отдельно или после dev-local.sh)"
echo "Готово. Запуск: ./scripts/dev-local.sh"
