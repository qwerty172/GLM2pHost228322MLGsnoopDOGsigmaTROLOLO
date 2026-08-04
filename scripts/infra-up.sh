#!/usr/bin/env bash
# Postgres + Redis для локальной разработки (без coturn — он нужен только для WebRTC в проде)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v docker &>/dev/null; then
  echo "Docker не найден — установи Docker или подними PostgreSQL вручную." >&2
  exit 1
fi

echo "==> Запуск postgres + redis (docker compose)"
docker compose -f infra/docker-compose.dev.yml up -d postgres redis

echo ""
echo "Готово:"
echo "  DATABASE_URL=postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"
echo "  REDIS_URL=redis://localhost:6379"
