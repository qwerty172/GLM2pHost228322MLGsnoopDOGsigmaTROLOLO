#!/usr/bin/env bash
# Один скрипт: Docker Postgres+Redis (если есть) → setup → dev
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> DecentralHub — быстрый старт"

if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  echo "==> Docker: Postgres + Redis"
  docker compose -f infra/docker-compose.dev.yml up -d postgres redis

  echo "==> Ждём Postgres…"
  for _ in $(seq 1 45); do
    if docker compose -f infra/docker-compose.dev.yml exec -T postgres pg_isready -U decentral_hub -d decentral_hub &>/dev/null; then
      echo "Postgres готов"
      break
    fi
    sleep 1
  done
else
  echo "Docker недоступен — пропускаем infra (нужен свой PostgreSQL в .env)"
fi

bash "$ROOT/scripts/setup-local.sh"
bash "$ROOT/scripts/dev-local.sh"
