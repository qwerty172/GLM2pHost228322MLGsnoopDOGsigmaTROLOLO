#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=env-dev-defaults.sh
source "$ROOT/scripts/env-dev-defaults.sh"

QUICK="${SETUP_QUICK:-0}"

echo "==> DecentralHub — локальная настройка"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Создан .env из .env.example"
else
  echo ".env уже существует — пропускаем копирование"
fi

if [[ "${SETUP_DOCKER_DB:-0}" == "1" ]]; then
  apply_docker_database_url .env
fi

ensure_empty_env_secret WALLET_ENCRYPTION_KEY .env
ensure_empty_env_secret JWT_SECRET .env

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД (нужен запущенный PostgreSQL и DATABASE_URL в .env)"
pnpm --filter @workspace/db run push

if [[ "$QUICK" != "1" ]]; then
  echo "==> Проверка типов"
  pnpm run typecheck
fi

echo ""
echo "Готово. Запуск:"
echo "  pnpm dev                        — быстрый старт (Docker + API + Web)"
echo "  ./scripts/dev-local.sh          — только API + Web"
echo "  curl localhost:8080/api/healthz/ready — проверка готовности"
