#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SKIP_TYPECHECK=0
DOCKER_ENV=0

for arg in "$@"; do
  case "$arg" in
    --skip-typecheck) SKIP_TYPECHECK=1 ;;
    --docker-env) DOCKER_ENV=1 ;;
    --full) SKIP_TYPECHECK=0 ;;
    -h|--help)
      echo "Использование: ./scripts/setup-local.sh [--skip-typecheck] [--docker-env] [--full]"
      echo "  --skip-typecheck  без pnpm typecheck (быстрее, по умолчанию для quickstart)"
      echo "  --docker-env      DATABASE_URL из docker-compose (decentral_hub/decentral_hub)"
      echo "  --full            setup + typecheck"
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

if [[ "$DOCKER_ENV" -eq 1 ]]; then
  DB_URL="postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=$DB_URL|" .env
  else
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$DB_URL|" .env
  fi
  echo "DATABASE_URL → docker-compose credentials"
fi

gen_secret() {
  local var="$1"
  if grep -q "^${var}=$" .env 2>/dev/null; then
    local val
    val=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' "s/^${var}=$/${var}=${val}/" .env
    else
      sed -i "s/^${var}=$/${var}=${val}/" .env
    fi
    echo "Сгенерирован ${var}"
  fi
}

gen_secret WALLET_ENCRYPTION_KEY
gen_secret JWT_SECRET

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД (нужен запущенный PostgreSQL и DATABASE_URL в .env)"
pnpm --filter @workspace/db run push

if [[ "$SKIP_TYPECHECK" -eq 0 ]]; then
  echo "==> Проверка типов"
  pnpm run typecheck
fi

echo ""
echo "Готово. Запуск:"
echo "  pnpm dev                        — API + Web"
echo "  pnpm quickstart                 — всё с нуля (docker + setup + dev)"
echo "  ./scripts/smoke-api.sh          — smoke-тест API"
