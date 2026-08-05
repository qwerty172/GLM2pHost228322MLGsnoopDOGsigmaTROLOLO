#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="infra/docker-compose.dev.yml"
DOCKER_DB_URL="postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"

echo "==> DecentralHub — локальная настройка"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Создан .env из .env.example"
else
  echo ".env уже существует — пропускаем копирование"
fi

set_env_value() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" .env 2>/dev/null; then
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' "s|^${key}=.*|${key}=${value}|" .env
    else
      sed -i "s|^${key}=.*|${key}=${value}|" .env
    fi
  else
    echo "${key}=${value}" >> .env
  fi
}

generate_secret_if_empty() {
  local key="$1"
  if grep -q "^${key}=$" .env 2>/dev/null || ! grep -q "^${key}=" .env 2>/dev/null; then
    local value
    value=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    set_env_value "$key" "$value"
    echo "Сгенерирован ${key}"
  fi
}

wait_for_postgres() {
  local i
  for i in $(seq 1 30); do
    if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U decentral_hub -d decentral_hub >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "PostgreSQL в Docker не ответил за 30 с" >&2
  return 1
}

uses_docker_db_url() {
  grep -q "^DATABASE_URL=${DOCKER_DB_URL}$" .env 2>/dev/null \
    || grep -q '^DATABASE_URL=postgresql://user:password@' .env 2>/dev/null \
    || grep -q '^DATABASE_URL=$' .env 2>/dev/null
}

ensure_postgres() {
  if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
    echo "Docker недоступен — нужен свой PostgreSQL и DATABASE_URL в .env"
    return 0
  fi

  echo "==> PostgreSQL в Docker"
  docker compose -f "$COMPOSE_FILE" up -d postgres
  wait_for_postgres

  if uses_docker_db_url; then
    set_env_value "DATABASE_URL" "$DOCKER_DB_URL"
    echo "DATABASE_URL настроен под Docker Compose"
  fi
}

if uses_docker_db_url; then
  ensure_postgres
fi

generate_secret_if_empty "WALLET_ENCRYPTION_KEY"
generate_secret_if_empty "JWT_SECRET"

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД"
if ! pnpm --filter @workspace/db run push; then
  echo ""
  echo "db push не удался. Если PostgreSQL не запущен:" >&2
  echo "  pnpm run docker:db   — Docker" >&2
  echo "  или настрой DATABASE_URL в .env" >&2
  exit 1
fi

echo ""
echo "Готово. Запуск:"
echo "  pnpm dev                        — API + Web"
echo "  ./scripts/smoke-api.sh          — smoke-тест API"
echo "  pnpm run setup:full             — + проверка типов (перед PR)"
echo ""
