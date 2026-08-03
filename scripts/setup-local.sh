#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="$ROOT/infra/docker-compose.dev.yml"
DOCKER_DB_URL="postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"

gen_hex() {
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

sed_env() {
  local key="$1"
  local value="$2"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "s|^${key}=.*|${key}=${value}|" .env
  else
    sed -i "s|^${key}=.*|${key}=${value}|" .env
  fi
}

echo "==> DecentralHub — локальная настройка"

# Docker Postgres + Redis (если docker доступен и не отключён)
if [[ "${SKIP_DOCKER:-}" != "1" ]] && command -v docker >/dev/null 2>&1; then
  if docker compose version >/dev/null 2>&1; then
    echo "==> Docker: postgres + redis (infra/docker-compose.dev.yml)"
    docker compose -f "$COMPOSE_FILE" up -d postgres redis
    echo "    Ожидание PostgreSQL..."
    for _ in $(seq 1 30); do
      if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U decentral_hub -d decentral_hub >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done
  fi
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Создан .env из .env.example"
else
  echo ".env уже существует — пропускаем копирование"
fi

# DATABASE_URL — docker credentials, если ещё placeholder
if grep -qE '^DATABASE_URL=postgresql://user:password@' .env 2>/dev/null; then
  sed_env DATABASE_URL "$DOCKER_DB_URL"
  echo "DATABASE_URL → docker-compose credentials"
fi

if grep -q '^WALLET_ENCRYPTION_KEY=$' .env 2>/dev/null; then
  sed_env WALLET_ENCRYPTION_KEY "$(gen_hex)"
  echo "Сгенерирован WALLET_ENCRYPTION_KEY"
fi

if grep -q '^JWT_SECRET=$' .env 2>/dev/null; then
  sed_env JWT_SECRET "$(gen_hex)"
  echo "Сгенерирован JWT_SECRET"
fi

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД"
pnpm --filter @workspace/db run push

if [[ "${SKIP_TYPECHECK:-}" != "1" ]]; then
  echo "==> Проверка типов (SKIP_TYPECHECK=1 чтобы пропустить)"
  pnpm run typecheck
fi

echo ""
echo "Готово. Запуск:"
echo "  pnpm dev              — API + Web"
echo "  ./scripts/dev-local.sh — то же"
echo ""
echo "Web:  http://localhost:5000"
echo "API:  http://localhost:8080/api/healthz"
echo "Демо: http://localhost:5000/games/rogue-fable-3 (без Windows-агента)"
