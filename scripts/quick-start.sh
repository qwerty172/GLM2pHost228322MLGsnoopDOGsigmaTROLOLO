#!/usr/bin/env bash
# Один сценарий: Docker (если есть) → setup → dev. «Взял и юзаешь».
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> DecentralHub — быстрый старт"

if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  echo "==> Docker: postgres + redis"
  docker compose -f infra/docker-compose.dev.yml up -d postgres redis
  echo "Ждём Postgres..."
  for i in {1..30}; do
    if docker compose -f infra/docker-compose.dev.yml exec -T postgres pg_isready -U decentral_hub &>/dev/null; then
      break
    fi
    sleep 1
  done
else
  echo "Docker не найден — убедись что PostgreSQL запущен и DATABASE_URL в .env верный"
fi

"$ROOT/scripts/setup-local.sh" --skip-typecheck

echo ""
echo "==> Запуск API + Web"
"$ROOT/scripts/dev-local.sh"
