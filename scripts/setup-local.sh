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

set_env_secret_if_empty() {
  local key="$1"
  if grep -q "^${key}=$" .env 2>/dev/null; then
    local val
    val=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' "s/^${key}=$/${key}=${val}/" .env
    else
      sed -i "s/^${key}=$/${key}=${val}/" .env
    fi
    echo "Сгенерирован ${key}"
  fi
}

set_env_secret_if_empty WALLET_ENCRYPTION_KEY
set_env_secret_if_empty JWT_SECRET

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД (нужен PostgreSQL и DATABASE_URL в .env)"
echo "    Нет Postgres? → docker compose -f infra/docker-compose.dev.yml up -d postgres"
pnpm --filter @workspace/db run push

echo ""
echo "Готово. Запуск:"
echo "  pnpm dev                        — API + Web (одна команда)"
echo "  ./scripts/dev-local.sh          — то же"
echo ""
echo "Демо без Windows:"
echo "  http://localhost:5000/games → Rogue Fable III → «Хостить в браузере»"
echo ""
echo "Проверка API: pnpm smoke"
