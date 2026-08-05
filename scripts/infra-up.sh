#!/usr/bin/env bash
# PostgreSQL + Redis через Docker — без coturn (TURN на потом)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker не найден. Установи Docker или PostgreSQL вручную — см. README.md" >&2
  exit 1
fi

COMPOSE_FILE="$ROOT/infra/docker-compose.dev.yml"
if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Не найден $COMPOSE_FILE" >&2
  exit 1
fi

echo "==> Запуск PostgreSQL 16 + Redis (docker compose)"
docker compose -f "$COMPOSE_FILE" up -d postgres redis

echo ""
echo "Готово:"
echo "  PostgreSQL  postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"
echo "  Redis       redis://localhost:6379"
echo ""
echo "Остановить: pnpm infra:down  или  ./scripts/infra-down.sh"
