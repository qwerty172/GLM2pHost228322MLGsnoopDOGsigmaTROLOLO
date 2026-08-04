#!/usr/bin/env bash
# Один скрипт: инфра → настройка → dev-серверы. «Взял и запустил».
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "╔══════════════════════════════════════════╗"
echo "║  DecentralHub — быстрый старт (локально) ║"
echo "╚══════════════════════════════════════════╝"
echo ""

USE_DOCKER=0
if command -v docker &>/dev/null && docker info >/dev/null 2>&1; then
  USE_DOCKER=1
  echo "==> Docker найден — поднимаем PostgreSQL + Redis"
  ./scripts/infra-up.sh
else
  echo "==> Docker недоступен — нужен локальный PostgreSQL (см. docs/QUICKSTART.md)"
fi

SETUP_ARGS=(--skip-typecheck)
if [ "$USE_DOCKER" -eq 1 ]; then
  SETUP_ARGS+=(--docker)
fi

echo ""
echo "==> Настройка окружения"
./scripts/setup-local.sh "${SETUP_ARGS[@]}"

echo ""
echo "==> Запуск API + Web"
echo "    Web:  http://localhost:5000"
echo "    API:  http://localhost:8080/api/healthz"
echo ""

# dev-local запускает оба процесса; wait-ready вызывается из dev-local после старта API
export QUICKSTART_WAIT_READY=1
exec ./scripts/dev-local.sh
