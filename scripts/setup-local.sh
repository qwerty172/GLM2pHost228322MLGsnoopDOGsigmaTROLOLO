#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> DecentralHub — локальная настройка"

if command -v docker >/dev/null 2>&1; then
  node scripts/setup-env.mjs --docker
  echo "==> Docker Postgres"
  pnpm db:up
  node scripts/wait-for-postgres.mjs
else
  node scripts/setup-env.mjs
  echo "Docker не найден — убедитесь что PostgreSQL запущен и DATABASE_URL в .env верный"
fi

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД"
pnpm --filter @workspace/db run push

echo ""
echo "Готово. Запуск:"
echo "  pnpm dev                 — API :8080 + Web :5000"
echo "  ./scripts/dev-local.sh   — то же (bash)"
echo "  pnpm verify              — typecheck + тесты (опционально)"
