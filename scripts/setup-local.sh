#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> DecentralHub — локальная настройка"
echo ""

USE_DOCKER=false
if command -v docker >/dev/null 2>&1; then
  USE_DOCKER=true
  echo "Docker найден — поднимем postgres + redis автоматически"
  chmod +x scripts/docker-infra.sh
  ./scripts/docker-infra.sh up
  node scripts/wait-for-port.mjs 127.0.0.1 5432 90000
else
  echo "Docker не найден — нужен свой PostgreSQL и DATABASE_URL в .env"
fi

if [[ "$USE_DOCKER" == true ]]; then
  node scripts/ensure-env.mjs --docker
else
  node scripts/ensure-env.mjs
fi

echo ""
echo "==> pnpm install"
pnpm install

echo ""
echo "==> Применение схемы БД"
pnpm --filter @workspace/db run push

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Готово! Запуск одной командой:"
echo ""
echo "    pnpm dev"
echo ""
echo "  Web:  http://localhost:5000"
echo "  API:  http://localhost:8080/api/healthz"
echo ""
echo "  Проверка:  pnpm smoke"
echo "  Типы:      pnpm typecheck   (можно позже)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
