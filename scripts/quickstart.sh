#!/usr/bin/env bash
# Один скрипт: инфра → настройка → dev-серверы
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> DecentralHub — быстрый старт"
echo ""

if command -v docker >/dev/null 2>&1; then
  echo "==> Поднимаем PostgreSQL + Redis (Docker)…"
  docker compose -f infra/docker-compose.dev.yml up -d postgres redis
  echo "Ждём PostgreSQL…"
  for i in $(seq 1 30); do
    if docker compose -f infra/docker-compose.dev.yml exec -T postgres pg_isready -U decentral_hub >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
else
  echo "Docker не найден — убедись, что PostgreSQL запущен и DATABASE_URL в .env верный"
fi

echo ""
./scripts/setup-local.sh --skip-typecheck

echo ""
echo "==> Запуск API + Web…"
exec ./scripts/dev-local.sh
