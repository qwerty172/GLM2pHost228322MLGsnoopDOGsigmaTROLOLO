#!/usr/bin/env bash
# Поднимает Postgres + Redis + coturn через Docker Compose (локальная разработка)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker не найден — пропускаем infra:up (нужен установленный PostgreSQL вручную)" >&2
  exit 0
fi

COMPOSE_FILE="infra/docker-compose.dev.yml"
if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Не найден $COMPOSE_FILE" >&2
  exit 1
fi

echo "==> Docker Compose: Postgres + Redis + coturn"
docker compose -f "$COMPOSE_FILE" up -d

echo "Ожидание Postgres..."
for i in $(seq 1 30); do
  if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U decentral_hub -d decentral_hub >/dev/null 2>&1; then
    echo "Postgres готов."
    exit 0
  fi
  sleep 1
done

echo "Postgres не ответил за 30с — проверь: docker compose -f $COMPOSE_FILE logs postgres" >&2
exit 1
