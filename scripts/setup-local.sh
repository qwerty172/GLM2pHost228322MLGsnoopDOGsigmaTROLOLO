#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FAST=false
for arg in "$@"; do
  case "$arg" in
    --fast) FAST=true ;;
  esac
done

generate_secret() {
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

set_env_var() {
  local key="$1"
  local value="$2"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "s|^${key}=.*|${key}=${value}|" .env
  else
    sed -i "s|^${key}=.*|${key}=${value}|" .env
  fi
}

fill_empty_secret() {
  local key="$1"
  if grep -qE "^${key}=\s*$" .env 2>/dev/null; then
    local val
    val="$(generate_secret)"
    set_env_var "$key" "$val"
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

fill_empty_secret WALLET_ENCRYPTION_KEY
fill_empty_secret JWT_SECRET

if ! command -v docker >/dev/null 2>&1; then
  echo ""
  echo "Подсказка: без Docker нужен свой PostgreSQL и DATABASE_URL в .env"
else
  if ! docker compose -f infra/docker-compose.dev.yml ps postgres 2>/dev/null | grep -q "running"; then
    echo ""
    echo "PostgreSQL не запущен. Поднять одной командой:"
    echo "  pnpm db:up"
    echo "  # или: docker compose -f infra/docker-compose.dev.yml up -d postgres"
  fi
fi

echo ""
echo "==> pnpm install"
pnpm install

echo ""
echo "==> Применение схемы БД (нужен PostgreSQL и DATABASE_URL в .env)"
pnpm --filter @workspace/db run push

if [[ "$FAST" == "false" ]]; then
  echo ""
  echo "==> Проверка типов"
  pnpm run typecheck
else
  echo ""
  echo "Пропущена проверка типов (--fast). Запусти позже: pnpm typecheck"
fi

echo ""
echo "Готово. Запуск:"
echo "  pnpm dev                        — API + Web"
echo "  ./scripts/dev-local.sh          — то же самое"
echo ""
echo "Проверка:"
echo "  http://localhost:8080/api/healthz"
echo "  http://localhost:5000"
