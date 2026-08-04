#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> DecentralHub — локальная настройка"

chmod +x scripts/ensure-env.sh 2>/dev/null || true
./scripts/ensure-env.sh

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД (нужен запущенный PostgreSQL и DATABASE_URL в .env)"
pnpm --filter @workspace/db run push

echo "==> Проверка типов"
pnpm run typecheck

echo ""
echo "Готово. Запуск:"
echo "  pnpm dev                        — Docker + API + Web (рекомендуется)"
echo "  ./scripts/dev-local.sh          — только API + Web"
echo "  или см. README.md"
