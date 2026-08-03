#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WITH_TYPECHECK=0
for arg in "$@"; do
  case "$arg" in
    --with-typecheck) WITH_TYPECHECK=1 ;;
  esac
done

sed_replace() {
  local key="$1" value="$2"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "s|^${key}=.*|${key}=${value}|" .env
  else
    sed -i "s|^${key}=.*|${key}=${value}|" .env
  fi
}

ensure_secret() {
  local key="$1"
  if grep -q "^${key}=$" .env 2>/dev/null || grep -q "^${key}=[[:space:]]*$" .env 2>/dev/null; then
    local value
    value=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    sed_replace "$key" "$value"
    echo "Сгенерирован ${key}"
  fi
}

echo "==> DecentralHub — локальная настройка"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Создан .env из .env.example"
else
  echo ".env уже существует"
fi

# Docker: PostgreSQL + Redis одной командой (если есть docker и дефолтный DATABASE_URL)
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  if grep -qE '^DATABASE_URL=postgresql://(user:password|postgres:postgres)@' .env 2>/dev/null \
    || grep -q '^DATABASE_URL=$' .env 2>/dev/null; then
    echo "==> Docker: PostgreSQL + Redis"
    docker compose -f infra/docker-compose.dev.yml up -d postgres redis
    sed_replace "DATABASE_URL" "postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"
    if grep -q '^REDIS_URL=$' .env 2>/dev/null; then
      sed_replace "REDIS_URL" "redis://127.0.0.1:6379"
    fi
    echo "DATABASE_URL настроен под docker compose"
  fi
else
  echo "Docker не найден — нужен локальный PostgreSQL (см. README)"
fi

ensure_secret "WALLET_ENCRYPTION_KEY"
ensure_secret "JWT_SECRET"

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД"
if ! pnpm --filter @workspace/db run push; then
  echo ""
  echo "Ошибка db push — проверь PostgreSQL и DATABASE_URL в .env" >&2
  echo "Подсказка: pnpm db:up  (если есть Docker)" >&2
  exit 1
fi

if [[ "$WITH_TYPECHECK" -eq 1 ]]; then
  echo "==> Проверка типов"
  pnpm run typecheck
else
  echo "Проверка типов пропущена (pnpm run typecheck — когда нужно)"
fi

echo ""
echo "Готово. Запуск:"
echo "  pnpm dev              — API + Web"
echo "  ./scripts/smoke-api.sh — smoke-тест API"
