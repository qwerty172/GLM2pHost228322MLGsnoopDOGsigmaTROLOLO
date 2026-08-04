#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SKIP_TYPECHECK=false
for arg in "$@"; do
  case "$arg" in
    --skip-typecheck) SKIP_TYPECHECK=true ;;
  esac
done

DOCKER_DB_URL="postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"

gen_secret() {
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

set_env_key() {
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

echo "==> DecentralHub — локальная настройка"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Создан .env из .env.example"
else
  echo ".env уже существует — пропускаем копирование"
fi

# Docker DATABASE_URL по умолчанию (если ещё placeholder)
if grep -qE '^DATABASE_URL=postgresql://user:password@' .env 2>/dev/null; then
  set_env_key "DATABASE_URL" "$DOCKER_DB_URL"
  echo "DATABASE_URL → Docker PostgreSQL (decentral_hub/decentral_hub)"
fi

if grep -q '^WALLET_ENCRYPTION_KEY=$' .env 2>/dev/null; then
  set_env_key "WALLET_ENCRYPTION_KEY" "$(gen_secret)"
  echo "Сгенерирован WALLET_ENCRYPTION_KEY"
fi

if grep -q '^JWT_SECRET=$' .env 2>/dev/null; then
  set_env_key "JWT_SECRET" "$(gen_secret)"
  echo "Сгенерирован JWT_SECRET"
fi

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД (нужен запущенный PostgreSQL)"
pnpm --filter @workspace/db run push

if [[ "$SKIP_TYPECHECK" == "false" ]]; then
  echo "==> Проверка типов"
  pnpm run typecheck
else
  echo "==> Пропуск typecheck (--skip-typecheck)"
fi

echo ""
echo "Готово. Запуск:"
echo "  pnpm dev              — API + Web"
echo "  pnpm quickstart       — Docker + setup + dev (с нуля)"
echo "  ./scripts/smoke-api.sh — smoke-тест API"
