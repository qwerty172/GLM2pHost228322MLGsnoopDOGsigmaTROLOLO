#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> DecentralHub — локальная настройка"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Создан .env из .env.example — отредактируй DATABASE_URL и WALLET_ENCRYPTION_KEY"
else
  echo ".env уже существует — пропускаем копирование"
fi

gen_secret_into_env() {
  local var="$1"
  local key
  key=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "s/^${var}=.*/${var}=${key}/" .env
  else
    sed -i "s/^${var}=.*/${var}=${key}/" .env
  fi
  echo "Сгенерирован ${var}"
}

if grep -qE '^WALLET_ENCRYPTION_KEY=$' .env 2>/dev/null; then
  gen_secret_into_env WALLET_ENCRYPTION_KEY
fi

if grep -qE '^JWT_SECRET=$' .env 2>/dev/null; then
  gen_secret_into_env JWT_SECRET
fi

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД (нужен запущенный PostgreSQL и DATABASE_URL в .env)"
pnpm --filter @workspace/db run push

if [[ "${SKIP_TYPECHECK:-}" != "1" ]]; then
  echo "==> Проверка типов"
  pnpm run typecheck
else
  echo "==> Пропуск typecheck (SKIP_TYPECHECK=1)"
fi

echo ""
echo "Готово. Запуск:"
echo "  pnpm dev   или   make dev   — API + Web"
echo "  pnpm smoke — smoke-тест API (после dev)"
