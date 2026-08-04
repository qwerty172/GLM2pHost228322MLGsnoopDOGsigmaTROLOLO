#!/usr/bin/env bash
# Поднять PostgreSQL (и опционально весь dev-стек) через Docker Compose
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="infra/docker-compose.dev.yml"
MODE="${1:-postgres}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker не найден. Установи Docker или подними PostgreSQL вручную." >&2
  echo "См. LOCAL_SETUP.md" >&2
  exit 1
fi

if [[ "$MODE" == "all" ]]; then
  echo "==> Docker Compose: postgres + redis + coturn"
  docker compose -f "$COMPOSE_FILE" up -d
else
  echo "==> Docker Compose: postgres"
  docker compose -f "$COMPOSE_FILE" up -d postgres
fi

echo ""
echo "PostgreSQL: postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"
echo "Дальше: pnpm setup  →  pnpm dev"
