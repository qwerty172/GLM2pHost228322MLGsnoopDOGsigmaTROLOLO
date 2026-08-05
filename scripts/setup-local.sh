#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DOCKER_URL="postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"

echo "==> DecentralHub — локальная настройка"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Создан .env из .env.example"
else
  echo ".env уже существует — пропускаем копирование"
fi

# Docker-дефолты: SETUP_USE_DOCKER=1 или DATABASE_URL ещё не настроен
if [[ "${SETUP_USE_DOCKER:-}" == "1" ]] || grep -qE '^DATABASE_URL=postgresql://user:password@' .env 2>/dev/null; then
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=$DOCKER_URL|" .env
  else
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$DOCKER_URL|" .env
  fi
  echo "DATABASE_URL → docker-compose (decentral_hub/decentral_hub)"
fi

if grep -qE '^WALLET_ENCRYPTION_KEY=$' .env 2>/dev/null; then
  KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "s/^WALLET_ENCRYPTION_KEY=$/WALLET_ENCRYPTION_KEY=$KEY/" .env
  else
    sed -i "s/^WALLET_ENCRYPTION_KEY=$/WALLET_ENCRYPTION_KEY=$KEY/" .env
  fi
  echo "Сгенерирован WALLET_ENCRYPTION_KEY"
fi

if grep -qE '^JWT_SECRET=$' .env 2>/dev/null; then
  JWT=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "s/^JWT_SECRET=$/JWT_SECRET=$JWT/" .env
  else
    sed -i "s/^JWT_SECRET=$/JWT_SECRET=$JWT/" .env
  fi
  echo "Сгенерирован JWT_SECRET"
fi

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД (нужен PostgreSQL — pnpm infra:up или свой)"
if ! pnpm --filter @workspace/db run push; then
  echo ""
  echo "db push не прошёл. Запусти БД:"
  echo "  pnpm infra:up     — Docker (postgres + redis)"
  echo "  или настрой DATABASE_URL в .env"
  exit 1
fi

if [[ "${SETUP_SKIP_TYPECHECK:-1}" != "1" ]]; then
  echo "==> Проверка типов"
  pnpm run typecheck
else
  echo "Проверка типов пропущена (pnpm setup:full — с typecheck)"
fi

echo ""
echo "Готово. Запуск:"
echo "  pnpm go            — API + Web"
echo "  pnpm quickstart    — с нуля (docker + setup + go)"
echo "  pnpm smoke         — smoke-тест API"
