#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT/infra/docker-compose.dev.yml"

docker compose -f "$COMPOSE_FILE" stop postgres redis 2>/dev/null || true
echo "PostgreSQL и Redis остановлены (coturn не трогали)."
