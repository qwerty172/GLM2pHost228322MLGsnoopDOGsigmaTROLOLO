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

generate_secret() {
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

set_env_if_empty() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=$" .env 2>/dev/null; then
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' "s/^${key}=$/${key}=${value}/" .env
    else
      sed -i "s/^${key}=$/${key}=${value}/" .env
    fi
    echo "Сгенерирован ${key}"
  fi
}

set_env_if_empty "WALLET_ENCRYPTION_KEY" "$(generate_secret)"
set_env_if_empty "JWT_SECRET" "$(generate_secret)"

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  if ! docker compose -f infra/docker-compose.dev.yml ps --status running postgres 2>/dev/null | grep -q postgres; then
    echo "==> Запуск PostgreSQL (docker compose)..."
    docker compose -f infra/docker-compose.dev.yml up -d postgres
    echo "Ожидание готовности PostgreSQL..."
    for _ in $(seq 1 30); do
      if docker compose -f infra/docker-compose.dev.yml exec -T postgres pg_isready -U decentral_hub >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done
  else
    echo "PostgreSQL уже запущен (docker compose)"
  fi
else
  echo "Docker не найден — убедись, что PostgreSQL запущен и DATABASE_URL в .env верный"
fi

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД"
pnpm --filter @workspace/db run push

echo ""
echo "Готово. Запуск:"
echo "  pnpm dev                        — API + Web"
echo "  ./scripts/dev-local.sh          — то же"
echo "  ./scripts/smoke-api.sh          — проверка API"
echo ""
echo "Web:  http://localhost:5000/games"
echo "API:  http://localhost:8080/api/healthz"
