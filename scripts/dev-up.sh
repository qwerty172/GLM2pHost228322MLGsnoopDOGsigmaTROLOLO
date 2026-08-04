#!/usr/bin/env bash
# Одна команда: Postgres в Docker → .env → миграции → API + Web.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> DecentralHub — быстрый старт (всё в одном)"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker не найден. Установи Docker или подними PostgreSQL вручную (см. LOCAL_SETUP.md)." >&2
  exit 1
fi

echo "==> PostgreSQL + Redis (Docker)"
docker compose -f infra/docker-compose.dev.yml up -d postgres redis

echo "==> Ждём PostgreSQL…"
ready=0
for _ in $(seq 1 45); do
  if docker compose -f infra/docker-compose.dev.yml exec -T postgres \
    pg_isready -U decentral_hub -d decentral_hub >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" -ne 1 ]]; then
  echo "PostgreSQL не ответил за 45 с — проверь: docker compose -f infra/docker-compose.dev.yml logs postgres" >&2
  exit 1
fi

chmod +x scripts/ensure-env.sh scripts/dev-local.sh 2>/dev/null || true
./scripts/ensure-env.sh

echo "==> pnpm install"
pnpm install

echo "==> Схема БД"
pnpm --filter @workspace/db run push

echo ""
echo "Готово. Запускаем API + Web…"
echo "  Web:  http://localhost:5000"
echo "  API:  http://localhost:8080/api/healthz"
echo "  Демо: кнопка «Попробовать демо» на главной"
echo ""

exec ./scripts/dev-local.sh
