#!/usr/bin/env bash
# PostgreSQL + Redis для локальной разработки (без coturn — опционально позже)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v docker &>/dev/null; then
  echo "Docker не найден. Установи Docker Desktop или PostgreSQL вручную." >&2
  exit 1
fi

echo "==> Поднимаем PostgreSQL 16 + Redis 7..."
docker compose -f infra/docker-compose.dev.yml up -d postgres redis

echo "==> Ожидаем PostgreSQL..."
for i in $(seq 1 45); do
  if docker compose -f infra/docker-compose.dev.yml exec -T postgres pg_isready -U decentral_hub -d decentral_hub &>/dev/null; then
    echo "PostgreSQL готов."
    exit 0
  fi
  sleep 1
done

echo "PostgreSQL не ответил за 45с — проверь: docker compose -f infra/docker-compose.dev.yml logs postgres" >&2
exit 1
