#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
# Использование: ./scripts/setup-local.sh [--full]
#   --full  — дополнительно прогнать typecheck (по умолчанию пропускается)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/lib/env-helpers.sh
source "$ROOT/scripts/lib/env-helpers.sh"

RUN_TYPECHECK=false
for arg in "$@"; do
  case "$arg" in
    --full) RUN_TYPECHECK=true ;;
    -h|--help)
      echo "Использование: $0 [--full]"
      echo "  --full  — проверка типов после установки (медленнее)"
      exit 0
      ;;
  esac
done

echo "==> DecentralHub — локальная настройка"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Создан .env из .env.example"
else
  echo ".env уже существует — пропускаем копирование"
fi

COMPOSE_FILE="infra/docker-compose.dev.yml"
if start_dev_infra "$COMPOSE_FILE"; then
  ensure_docker_database_url
else
  echo "Docker не найден — используй свой PostgreSQL и DATABASE_URL в .env"
fi

ensure_env_secret WALLET_ENCRYPTION_KEY 32
ensure_env_secret JWT_SECRET 32

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД (нужен PostgreSQL и DATABASE_URL в .env)"
pnpm --filter @workspace/db run push

if [[ "$RUN_TYPECHECK" == true ]]; then
  echo "==> Проверка типов (--full)"
  pnpm run typecheck
fi

echo ""
echo "Готово. Запуск:"
echo "  pnpm dev                        — API :8080 + Web :5000"
echo "  ./scripts/smoke-api.sh          — smoke-тест API"
echo "  pnpm setup -- --full            — повторная настройка с typecheck"
echo ""
