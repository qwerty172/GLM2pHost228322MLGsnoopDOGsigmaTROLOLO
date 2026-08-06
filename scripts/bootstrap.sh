#!/usr/bin/env bash
# Один вход: Docker (если есть) → .env → install → db push → API + Web
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> DecentralHub — быстрый старт (pnpm dev)"

USE_DOCKER=false
COMPOSE_FILE="infra/docker-compose.dev.yml"

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "==> Docker: PostgreSQL + Redis"
  docker compose -f "$COMPOSE_FILE" up -d postgres redis
  USE_DOCKER=true
  echo "Ждём PostgreSQL…"
  for _ in $(seq 1 45); do
    if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U decentral_hub -d decentral_hub >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
else
  echo "Docker недоступен — нужен локальный PostgreSQL (см. LOCAL_SETUP.md)"
fi

if [[ "$USE_DOCKER" == true ]]; then
  export SETUP_DOCKER_DB=1
fi

export SETUP_QUICK=1
./scripts/setup-local.sh

exec ./scripts/dev-local.sh
