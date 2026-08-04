#!/usr/bin/env bash
# PostgreSQL + Redis для локальной разработки (Docker Compose)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
COMPOSE_FILE="infra/docker-compose.dev.yml"

if ! command -v docker &>/dev/null; then
  echo "Docker не найден. Установи Docker или запусти PostgreSQL 16 вручную." >&2
  exit 1
fi

echo "==> Запуск PostgreSQL и Redis (docker compose)"
docker compose -f "$COMPOSE_FILE" up -d postgres redis

echo ""
echo "Готово:"
echo "  PostgreSQL  localhost:5432  decentral_hub / decentral_hub"
echo "  Redis       localhost:6379  (опционально, для rate-limit)"
echo ""
echo "DATABASE_URL=postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"
