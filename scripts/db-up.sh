#!/usr/bin/env bash
# Поднять PostgreSQL + Redis через Docker Compose (без coturn — опционально позже)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker не найден. Установи Docker или PostgreSQL вручную — см. README.md" >&2
  exit 1
fi

echo "==> PostgreSQL + Redis (docker compose)"
docker compose -f infra/docker-compose.dev.yml up -d postgres redis

echo ""
echo "DATABASE_URL=postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"
echo "REDIS_URL=redis://127.0.0.1:6379"
echo ""
echo "Готово. Дальше: pnpm setup && pnpm dev"
