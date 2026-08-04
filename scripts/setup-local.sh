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

gen_hex() {
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

set_env_key() {
  local key="$1"
  local value="$2"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "s/^${key}=.*/${key}=${value}/" .env
  else
    sed -i "s/^${key}=.*/${key}=${value}/" .env
  fi
}

fill_empty_secret() {
  local key="$1"
  if grep -q "^${key}=$" .env 2>/dev/null; then
    set_env_key "$key" "$(gen_hex)"
    echo "Сгенерирован ${key}"
  fi
}

wait_for_postgres() {
  local host="${1:-localhost}"
  local port="${2:-5432}"
  echo "==> Ждём PostgreSQL на ${host}:${port}…"
  for _ in $(seq 1 45); do
    if (echo > "/dev/tcp/${host}/${port}") >/dev/null 2>&1; then
      echo "PostgreSQL доступен"
      return 0
    fi
    sleep 1
  done
  echo "PostgreSQL не ответил за 45с — пробуем db push всё равно"
  return 0
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

echo "==> pnpm install"
pnpm install

# Подождать Docker Postgres, если поднят
wait_for_postgres localhost 5432

echo "==> Применение схемы БД"
pnpm --filter @workspace/db run push

if [[ "$FAST" != true ]]; then
  echo "==> Проверка типов"
  pnpm run typecheck
fi

echo ""
echo "Готово. Запуск:"
echo "  pnpm dev          — API + Web"
echo "  pnpm smoke        — проверка API"
echo ""
echo "Web:  http://localhost:5000"
echo "API:  http://localhost:8080/api/healthz"
