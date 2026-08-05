#!/usr/bin/env bash
# Postgres + Redis через Docker Compose (без coturn — для WebRTC на потом)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT/infra/docker-compose.dev.yml"
ACTION="${1:-up}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker не найден. Установи Docker Desktop или настрой PostgreSQL вручную в .env" >&2
  exit 1
fi

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE" "$@"
  else
    docker-compose -f "$COMPOSE_FILE" "$@"
  fi
}

case "$ACTION" in
  up)
    echo "==> Запуск postgres + redis (docker)"
    compose up -d postgres redis
    echo "Готово. DATABASE_URL=postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"
    ;;
  down)
    echo "==> Остановка postgres + redis"
    compose stop postgres redis
    ;;
  logs)
    compose logs -f postgres redis
    ;;
  *)
    echo "Использование: $0 [up|down|logs]" >&2
    exit 1
    ;;
esac
