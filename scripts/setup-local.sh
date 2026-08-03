#!/usr/bin/env bash
# Первичная настройка: Docker (postgres+redis) → секреты → install → db push
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE="docker compose -f infra/docker-compose.dev.yml"
DOCKER_DB_URL="postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"

env_set() {
  local key="$1" value="$2"
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

env_get() {
  grep "^${1}=" .env 2>/dev/null | head -1 | cut -d= -f2- || true
}

env_set_if_empty() {
  local key="$1" value="$2"
  [[ -z "$(env_get "$key")" ]] || return 0
  env_set "$key" "$value"
  echo "  → $key"
}

gen_hex() {
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

wait_postgres() {
  for _ in $(seq 1 30); do
    if $COMPOSE exec -T postgres pg_isready -U decentral_hub -d decentral_hub >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

echo "==> DecentralHub — локальная настройка"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Создан .env из .env.example"
else
  echo ".env уже существует"
fi

USE_DOCKER=false
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "==> Инфраструктура (Docker: PostgreSQL + Redis)"
  $COMPOSE up -d postgres redis
  if wait_postgres; then
    echo "PostgreSQL готов"
    USE_DOCKER=true
  else
    echo "⚠ PostgreSQL в Docker не ответил — проверь: docker compose -f infra/docker-compose.dev.yml logs postgres"
  fi
else
  echo "Docker недоступен — нужен свой PostgreSQL 16 (см. DATABASE_URL в .env)"
fi

echo "==> Секреты и подключения (пустые поля заполняются автоматически)"
current_db="$(env_get DATABASE_URL)"
if [[ -z "$current_db" || "$current_db" == "postgresql://user:password@localhost:5432/decentral_hub" ]]; then
  if $USE_DOCKER; then
    env_set DATABASE_URL "$DOCKER_DB_URL"
    echo "  → DATABASE_URL (Docker)"
  fi
fi
env_set_if_empty WALLET_ENCRYPTION_KEY "$(gen_hex)"
env_set_if_empty JWT_SECRET "$(gen_hex)"
env_set_if_empty ADMIN_SECRET "local-dev-secret"

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД"
pnpm --filter @workspace/db run push

echo ""
echo "✓ Готово — можно сразу запускать:"
echo "  pnpm dev      — API :8080 + Web :5000"
echo "  pnpm smoke    — проверка API"
echo ""
echo "Позже (по необходимости):"
echo "  pnpm typecheck          — проверка типов"
echo "  pnpm db:up              — только Docker (postgres + redis)"
echo "  docker compose -f infra/docker-compose.dev.yml up -d coturn  — TURN для WebRTC"
