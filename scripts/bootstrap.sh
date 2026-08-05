#!/usr/bin/env bash
# Одна команда: Docker Postgres+Redis, .env, install, db push — и можно запускать dev.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="infra/docker-compose.dev.yml"
DOCKER_DB_URL="postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"

sed_inplace() {
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "$1" "$2"
  else
    sed -i "$1" "$2"
  fi
}

set_env_var() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=" .env 2>/dev/null; then
    sed_inplace "s|^${key}=.*|${key}=${val}|" .env
  else
    echo "${key}=${val}" >> .env
  fi
}

echo "==> DecentralHub — bootstrap (взял и юзаешь)"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker не найден." >&2
  echo "  Вариант A: установи Docker и запусти снова." >&2
  echo "  Вариант B: PostgreSQL вручную + ./scripts/setup-local.sh" >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose не доступен — проверь установку Docker." >&2
  exit 1
fi

echo "==> PostgreSQL + Redis (Docker)"
docker compose -f "$COMPOSE_FILE" up -d postgres redis

echo "==> Ожидание PostgreSQL..."
ready=0
for _ in $(seq 1 45); do
  if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U decentral_hub -d decentral_hub >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" -ne 1 ]]; then
  echo "PostgreSQL не ответил за 45 сек — проверь docker compose logs postgres" >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Создан .env из .env.example"
fi

set_env_var DATABASE_URL "$DOCKER_DB_URL"
set_env_var REDIS_URL "redis://localhost:6379"

if grep -qE '^WALLET_ENCRYPTION_KEY=$' .env 2>/dev/null; then
  KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  set_env_var WALLET_ENCRYPTION_KEY "$KEY"
  echo "Сгенерирован WALLET_ENCRYPTION_KEY"
fi

if ! grep -qE '^JWT_SECRET=.' .env 2>/dev/null; then
  JWT=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  set_env_var JWT_SECRET "$JWT"
  echo "Сгенерирован JWT_SECRET"
fi

echo "==> pnpm install"
pnpm install

echo "==> Схема БД"
pnpm --filter @workspace/db run push

echo ""
echo "Готово."
echo ""
echo "  Запуск:  ./scripts/dev-local.sh   (или: pnpm dev)"
echo "  Smoke:   ./scripts/smoke-api.sh"
echo ""
echo "  Web:  http://localhost:5000"
echo "  API:  http://localhost:8080/api/healthz"
echo ""
echo "  Демо без Windows-агента:"
echo "    → http://localhost:5000 → «Попробовать демо»"
echo "    → или Каталог → Rogue Fable III → «Хостить» → ссылку во второй вкладке"
echo ""
