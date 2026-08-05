#!/usr/bin/env bash
# Один вход: Docker (БД) → setup → dev. Coturn/TURN/Sentry — на потом.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "╔══════════════════════════════════════════════════╗"
echo "║  DecentralHub — быстрый старт (локальный dev)    ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

if command -v docker >/dev/null 2>&1; then
  echo "==> [1/3] Docker: PostgreSQL + Redis"
  "$ROOT/scripts/infra-up.sh"
else
  echo "==> [1/3] Docker не найден — нужен свой PostgreSQL (см. .env DATABASE_URL)"
fi

echo ""
echo "==> [2/3] Настройка проекта"
export SETUP_USE_DOCKER=1
"$ROOT/scripts/setup-local.sh"

echo ""
echo "==> [3/3] Запуск API + Web"
"$ROOT/scripts/dev-local.sh"
