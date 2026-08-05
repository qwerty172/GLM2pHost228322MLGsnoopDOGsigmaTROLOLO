#!/usr/bin/env bash
# PostgreSQL + Redis для локальной разработки (без установки в систему)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v docker &>/dev/null; then
  echo "Docker не найден. Установи Docker Desktop или запусти PostgreSQL вручную." >&2
  exit 1
fi

echo "==> Запуск PostgreSQL 16 + Redis 7 (docker compose)"
docker compose -f infra/docker-compose.dev.yml up -d postgres redis

echo ""
echo "Готово:"
echo "  PostgreSQL: postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"
echo "  Redis:      redis://localhost:6379"
echo ""
echo "Остановить: ./scripts/infra-down.sh  или  pnpm infra:down"
