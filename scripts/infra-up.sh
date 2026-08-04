#!/usr/bin/env bash
# Поднять Postgres + Redis через Docker Compose (без coturn — для WebRTC позже)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker не найден. Установи Docker Desktop или PostgreSQL вручную." >&2
  exit 1
fi

echo "==> Postgres + Redis (infra/docker-compose.dev.yml)"
docker compose -f infra/docker-compose.dev.yml up -d postgres redis

echo ""
echo "Ожидание готовности Postgres..."
for i in $(seq 1 30); do
  if docker compose -f infra/docker-compose.dev.yml exec -T postgres pg_isready -U decentral_hub -d decentral_hub >/dev/null 2>&1; then
    echo "Postgres готов."
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "Postgres не ответил за 30 секунд." >&2
    exit 1
  fi
  sleep 1
done

echo ""
echo "DATABASE_URL=postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"
echo "Redis: localhost:6379 (опционально — раскомментируй REDIS_URL в .env)"
