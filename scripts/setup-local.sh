#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/lib/env-bootstrap.sh
source "$ROOT/scripts/lib/env-bootstrap.sh"

echo "==> DecentralHub — локальная настройка"

if has_docker; then
  start_docker_services || echo "⚠ Docker-сервисы не поднялись — проверь вручную"
  ensure_docker_defaults
else
  echo "Docker не найден — настрой DATABASE_URL в .env вручную"
fi

ensure_dev_secrets

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД"
pnpm --filter @workspace/db run push

echo "==> Проверка типов"
pnpm run typecheck

echo ""
echo "Готово. Запуск:"
echo "  pnpm dev              — API + Web"
echo "  ./scripts/quickstart.sh — всё с нуля одной командой"
