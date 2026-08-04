#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

QUICK=0
USE_DOCKER=0
for arg in "$@"; do
  case "$arg" in
    --quick) QUICK=1 ;;
    --docker) USE_DOCKER=1 ;;
  esac
done

echo "==> DecentralHub — локальная настройка"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Создан .env из .env.example"
else
  echo ".env уже существует — пропускаем копирование"
fi

if [[ "$USE_DOCKER" -eq 1 ]]; then
  if command -v docker &>/dev/null; then
    echo "==> PostgreSQL в Docker (infra/docker-compose.dev.yml)"
    docker compose -f infra/docker-compose.dev.yml up -d postgres
    DOCKER_URL="postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"
    if grep -qE '^DATABASE_URL=postgresql://user:password@' .env 2>/dev/null; then
      if [[ "$(uname -s)" == "Darwin" ]]; then
        sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=$DOCKER_URL|" .env
      else
        sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$DOCKER_URL|" .env
      fi
      echo "DATABASE_URL настроен для Docker Postgres"
    fi
    echo "Ждём Postgres…"
    for _ in {1..30}; do
      if docker compose -f infra/docker-compose.dev.yml exec -T postgres pg_isready -U decentral_hub &>/dev/null; then
        break
      fi
      sleep 1
    done
  else
    echo "Docker не найден — пропускаем --docker" >&2
  fi
fi

gen_and_set_key() {
  local var_name="$1"
  if grep -q "^${var_name}=$" .env 2>/dev/null; then
    local key
    key=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' "s/^${var_name}=$/${var_name}=${key}/" .env
    else
      sed -i "s/^${var_name}=$/${var_name}=${key}/" .env
    fi
    echo "Сгенерирован ${var_name}"
  fi
}

gen_and_set_key WALLET_ENCRYPTION_KEY
gen_and_set_key JWT_SECRET

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД (нужен PostgreSQL и DATABASE_URL в .env)"
pnpm --filter @workspace/db run push

if [[ "$QUICK" -eq 0 ]]; then
  echo "==> Проверка типов"
  pnpm run typecheck
else
  echo "==> --quick: пропуск typecheck (запусти pnpm run typecheck позже)"
fi

echo ""
echo "Готово. Запуск:"
echo "  pnpm dev   или   ./scripts/dev-local.sh"
echo "  Демо без API: http://localhost:5000/demo"
echo ""
