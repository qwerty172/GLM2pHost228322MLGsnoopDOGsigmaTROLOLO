#!/usr/bin/env bash
# Один скрипт: Docker → .env → зависимости → БД → API + Web
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/lib/env-bootstrap.sh
source "$ROOT/scripts/lib/env-bootstrap.sh"

echo "╔══════════════════════════════════════════╗"
echo "║  DecentralHub — быстрый старт (1 команда) ║"
echo "╚══════════════════════════════════════════╝"
echo ""

if has_docker; then
  start_docker_services
  ensure_docker_defaults
else
  echo "⚠ Docker не найден — пропускаем контейнеры."
  echo "  Нужен PostgreSQL 16 и DATABASE_URL в .env (см. LOCAL_SETUP.md)"
  echo ""
fi

ensure_dev_secrets

echo "==> pnpm install"
pnpm install

echo "==> Схема БД"
pnpm --filter @workspace/db run push

echo ""
echo "✓ Готово. Запускаем API + Web..."
echo "  Web:  http://localhost:5000"
echo "  API:  http://localhost:8080/api/healthz"
echo "  Хост: http://localhost:5000/host"
echo "  Игра: http://localhost:5000/hosts"
echo ""

exec "$ROOT/scripts/dev-local.sh"
