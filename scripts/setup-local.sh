#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="$ROOT/infra/docker-compose.dev.yml"
DOCKER_DATABASE_URL="postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"

generate_hex_secret() {
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

set_env_value() {
  local key="$1"
  local value="$2"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "s|^${key}=.*|${key}=${value}|" .env
  else
    sed -i "s|^${key}=.*|${key}=${value}|" .env
  fi
}

echo "==> DecentralHub — локальная настройка"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Создан .env из .env.example"
else
  echo ".env уже существует — пропускаем копирование"
fi

# Docker Postgres — zero-config путь (если docker доступен)
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  echo "==> Запуск PostgreSQL через Docker (infra/docker-compose.dev.yml)"
  docker compose -f "$COMPOSE_FILE" up -d postgres

  echo "Ждём готовности PostgreSQL..."
  for _ in $(seq 1 30); do
    if docker compose -f "$COMPOSE_FILE" exec -T postgres \
      pg_isready -U decentral_hub -d decentral_hub >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  if grep -qE '^DATABASE_URL=postgresql://(user:password|postgres:postgres)@' .env 2>/dev/null \
    || grep -q '^DATABASE_URL=$' .env 2>/dev/null; then
    set_env_value "DATABASE_URL" "$DOCKER_DATABASE_URL"
    echo "DATABASE_URL настроен под Docker Postgres"
  fi
else
  echo "Docker не найден — убедись, что PostgreSQL запущен и DATABASE_URL в .env верный"
fi

if grep -q '^WALLET_ENCRYPTION_KEY=$' .env 2>/dev/null; then
  set_env_value "WALLET_ENCRYPTION_KEY" "$(generate_hex_secret)"
  echo "Сгенерирован WALLET_ENCRYPTION_KEY"
fi

if grep -q '^JWT_SECRET=$' .env 2>/dev/null; then
  set_env_value "JWT_SECRET" "$(generate_hex_secret)"
  echo "Сгенерирован JWT_SECRET"
fi

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД"
pnpm --filter @workspace/db run push

echo "==> Проверка типов"
pnpm run typecheck

echo ""
echo "Готово. Запуск:"
echo "  ./scripts/dev-local.sh   — API (:8080) + Web (:5000)"
echo "  ./scripts/smoke-api.sh   — проверка API"
echo ""
echo "Первый стрим без Windows-агента: http://localhost:5000/host"
