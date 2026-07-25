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

if [[ -z "${WALLET_ENCRYPTION_KEY:-}" ]] && grep -q '^WALLET_ENCRYPTION_KEY=$' .env 2>/dev/null; then
  KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "s/^WALLET_ENCRYPTION_KEY=$/WALLET_ENCRYPTION_KEY=$KEY/" .env
  else
    sed -i "s/^WALLET_ENCRYPTION_KEY=$/WALLET_ENCRYPTION_KEY=$KEY/" .env
  fi
  echo "Сгенерирован WALLET_ENCRYPTION_KEY"
fi

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД (нужен запущенный PostgreSQL и DATABASE_URL в .env)"
pnpm --filter @workspace/db run push

echo "==> Проверка типов"
pnpm run typecheck

echo ""
echo "Готово. Запуск:"
echo "  ./scripts/dev-local.sh          — API + Web"
echo "  или см. README.md"
