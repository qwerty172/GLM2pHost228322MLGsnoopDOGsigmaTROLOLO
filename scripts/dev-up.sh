#!/usr/bin/env bash
# Всё в одном: .env → Docker (postgres+redis) → схема БД → API + Web.
# Использование: pnpm dev   или   ./scripts/dev-up.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="infra/docker-compose.dev.yml"

echo "╔══════════════════════════════════════════╗"
echo "║  DecentralHub — быстрый старт            ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. .env + секреты ──────────────────────────────────────────────────────
echo "==> Подготовка .env"
# shellcheck disable=SC1091
source "$ROOT/scripts/lib/bootstrap-env.sh"
bootstrap_env

# ── 2. Docker (postgres + redis) ───────────────────────────────────────────
if command -v docker >/dev/null 2>&1; then
  echo ""
  echo "==> Запуск PostgreSQL и Redis (Docker)"
  docker compose -f "$COMPOSE_FILE" up -d postgres redis
  # shellcheck disable=SC1091
  source "$ROOT/scripts/lib/wait-for-postgres.sh"
else
  echo ""
  echo "==> Docker не найден — используй свой PostgreSQL (см. DATABASE_URL в .env)"
fi

# ── 3. Зависимости + схема ─────────────────────────────────────────────────
echo ""
echo "==> Установка зависимостей"
pnpm install

echo ""
echo "==> Применение схемы БД"
if ! command -v docker >/dev/null 2>&1; then
  # shellcheck disable=SC1091
  source "$ROOT/scripts/lib/wait-for-postgres.sh" || true
fi
pnpm --filter @workspace/db run push

# ── 4. Запуск dev-серверов ─────────────────────────────────────────────────
echo ""
echo "==> Запуск API + Web"
exec "$ROOT/scripts/dev-local.sh"
