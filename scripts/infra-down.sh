#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v docker &>/dev/null; then
  echo "Docker не найден." >&2
  exit 1
fi

echo "==> Остановка postgres + redis"
docker compose -f infra/docker-compose.dev.yml stop postgres redis
