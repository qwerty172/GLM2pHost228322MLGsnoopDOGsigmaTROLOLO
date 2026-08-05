#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DOCKER_DATABASE_URL="postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"
DOCKER_REDIS_URL="redis://localhost:6379"

sed_inplace() {
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

ensure_env_var() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=$" .env 2>/dev/null; then
    sed_inplace "s|^${key}=$|${key}=${value}|" .env
    echo "Сгенерирован ${key}"
  fi
}

echo "==> DecentralHub — локальная настройка"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Создан .env из .env.example"
else
  echo ".env уже существует — пропускаем копирование"
fi

ensure_env_var "WALLET_ENCRYPTION_KEY" "$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
ensure_env_var "JWT_SECRET" "$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"

# Docker: самый быстрый путь — Postgres + Redis без ручной установки
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  echo "==> Docker найден — поднимаем PostgreSQL + Redis"
  docker compose -f infra/docker-compose.dev.yml up -d postgres redis

  if grep -qE '^DATABASE_URL=postgresql://user:password@' .env 2>/dev/null \
    || grep -qE '^DATABASE_URL=postgresql://decentral_hub:decentral_hub@' .env 2>/dev/null; then
    sed_inplace "s|^DATABASE_URL=.*|DATABASE_URL=${DOCKER_DATABASE_URL}|" .env
    echo "DATABASE_URL настроен под docker-compose"
  fi

  if grep -q '^# REDIS_URL=' .env 2>/dev/null; then
    sed_inplace "s|^# REDIS_URL=.*|REDIS_URL=${DOCKER_REDIS_URL}|" .env
    echo "REDIS_URL включён (Redis из docker-compose)"
  elif grep -q '^REDIS_URL=$' .env 2>/dev/null; then
    sed_inplace "s|^REDIS_URL=$|REDIS_URL=${DOCKER_REDIS_URL}|" .env
    echo "REDIS_URL настроен под docker-compose"
  fi

  echo "Ожидание готовности PostgreSQL..."
  for _ in $(seq 1 30); do
    if docker compose -f infra/docker-compose.dev.yml exec -T postgres pg_isready -U decentral_hub &>/dev/null; then
      break
    fi
    sleep 1
  done
else
  echo ""
  echo "Docker не найден — нужен локальный PostgreSQL 16."
  echo "  Вариант A: установи Docker и перезапусти setup"
  echo "  Вариант B: createdb decentral_hub && отредактируй DATABASE_URL в .env"
  echo ""
fi

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД"
pnpm --filter @workspace/db run push

echo "==> Проверка типов"
pnpm run typecheck

echo ""
echo "Готово! Запуск одной командой:"
echo "  pnpm dev"
echo ""
echo "Проверка:"
echo "  http://localhost:8080/api/healthz"
echo "  http://localhost:5000"
