#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> DecentralHub — локальная настройка"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Создан .env из .env.example"
else
  echo ".env уже существует — пропускаем копирование"
fi

gen_and_set() {
  local var="$1"
  if grep -q "^${var}=$" .env 2>/dev/null; then
    local val
    val=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' "s/^${var}=$/${var}=${val}/" .env
    else
      sed -i "s/^${var}=$/${var}=${val}/" .env
    fi
    echo "Сгенерирован ${var}"
  fi
}

gen_and_set WALLET_ENCRYPTION_KEY
gen_and_set JWT_SECRET

if command -v docker &>/dev/null; then
  echo "==> Docker найден — поднимаем PostgreSQL (если ещё не запущен)"
  docker compose -f infra/docker-compose.dev.yml up -d postgres 2>/dev/null || true
  sleep 2
else
  echo "Docker не найден — убедись что PostgreSQL запущен и DATABASE_URL в .env верный"
fi

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД"
if ! pnpm --filter @workspace/db run push; then
  echo ""
  echo "db push не прошёл. Попробуй: pnpm up  (Docker Postgres) или проверь DATABASE_URL"
  exit 1
fi

echo ""
echo "Готово. Запуск:"
echo "  pnpm dev                        — API + Web"
echo "  ./scripts/dev-local.sh          — то же"
echo "  Web: http://localhost:5000  API: http://localhost:8080/api/healthz"
