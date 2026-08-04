#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DOCKER_DATABASE_URL="postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"

echo "==> DecentralHub — локальная настройка"
echo "    (опционально позже: TURN, Redis в проде, JWT-провайдеры, host-agent на Windows)"

# ── Docker Postgres/Redis (если есть Docker) ───────────────────────────────
bash "$ROOT/scripts/infra-up.sh" || true

# ── .env ───────────────────────────────────────────────────────────────────
if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Создан .env из .env.example"
else
  echo ".env уже существует"
fi

# Подставить URL из docker-compose, если в .env ещё шаблон
if grep -qE '^DATABASE_URL=postgresql://(user:password|postgres:postgres)@' .env 2>/dev/null; then
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=$DOCKER_DATABASE_URL|" .env
  else
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$DOCKER_DATABASE_URL|" .env
  fi
  echo "DATABASE_URL → docker-compose (decentral_hub/decentral_hub)"
fi

# WALLET_ENCRYPTION_KEY
if grep -qE '^WALLET_ENCRYPTION_KEY=$' .env 2>/dev/null; then
  KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "s/^WALLET_ENCRYPTION_KEY=$/WALLET_ENCRYPTION_KEY=$KEY/" .env
  else
    sed -i "s/^WALLET_ENCRYPTION_KEY=$/WALLET_ENCRYPTION_KEY=$KEY/" .env
  fi
  echo "Сгенерирован WALLET_ENCRYPTION_KEY"
fi

# JWT_SECRET (для логина/регистрации — можно настроить позже вручную)
if grep -qE '^JWT_SECRET=$' .env 2>/dev/null; then
  JWT=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "s/^JWT_SECRET=$/JWT_SECRET=$JWT/" .env
  else
    sed -i "s/^JWT_SECRET=$/JWT_SECRET=$JWT/" .env
  fi
  echo "Сгенерирован JWT_SECRET (локальная разработка)"
fi

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД"
pnpm --filter @workspace/db run push

echo "==> Проверка типов"
pnpm run typecheck

echo ""
echo "✓ Готово. Запуск:"
echo "  pnpm dev"
echo ""
echo "  Web:  http://localhost:5000"
echo "  API:  http://localhost:8080/api/healthz"
echo ""
echo "Позже (по необходимости):"
echo "  pnpm infra:up          — только Docker Postgres/Redis"
echo "  ./scripts/smoke-api.sh — smoke-тест API"
echo "  infra/docker-compose.dev.yml → coturn для WebRTC через NAT"
