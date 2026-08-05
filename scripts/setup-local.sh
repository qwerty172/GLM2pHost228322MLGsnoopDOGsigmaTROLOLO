#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> DecentralHub — локальная настройка"

# shellcheck disable=SC1091
source "$ROOT/scripts/lib/bootstrap-env.sh"
bootstrap_env

COMPOSE_FILE="infra/docker-compose.dev.yml"
if command -v docker >/dev/null 2>&1; then
  echo "==> Запуск PostgreSQL и Redis (Docker)"
  docker compose -f "$COMPOSE_FILE" up -d postgres redis
  # shellcheck disable=SC1091
  source "$ROOT/scripts/lib/wait-for-postgres.sh"
else
  echo "Docker не найден — убедись что PostgreSQL запущен и DATABASE_URL в .env верный"
fi

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД"
pnpm --filter @workspace/db run push

echo ""
echo "Готово. Запуск:"
echo "  pnpm dev                        — всё в одном (рекомендуется)"
echo "  ./scripts/dev-local.sh          — только API + Web"
echo ""
echo "Проверка типов (опционально): pnpm run typecheck"
