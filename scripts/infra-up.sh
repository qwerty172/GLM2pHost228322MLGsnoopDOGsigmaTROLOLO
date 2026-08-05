#!/usr/bin/env bash
# Поднимает PostgreSQL и Redis для локальной разработки (Docker Compose).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
COMPOSE_FILE="infra/docker-compose.dev.yml"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker не найден — пропускаем. Установи PostgreSQL вручную или поставь Docker Desktop."
  exit 0
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker не запущен — пропускаем. Запусти Docker Desktop или установи PostgreSQL вручную."
  exit 0
fi

echo "==> Запуск PostgreSQL и Redis (docker compose)..."
docker compose -f "$COMPOSE_FILE" up -d postgres redis

echo "==> Ожидание готовности PostgreSQL..."
for _ in $(seq 1 30); do
  if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U decentral_hub >/dev/null 2>&1; then
    echo "PostgreSQL готов (postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub)"
    exit 0
  fi
  sleep 1
done

echo "PostgreSQL не ответил за 30 с — проверь: docker compose -f $COMPOSE_FILE logs postgres" >&2
exit 1
