#!/usr/bin/env bash
# Всё с нуля: Docker Postgres → setup → dev-серверы
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

chmod +x scripts/*.sh 2>/dev/null || true

if command -v docker &>/dev/null; then
  ./scripts/infra-up.sh
else
  echo "Docker не найден — пропускаем infra-up. Нужен свой PostgreSQL."
fi

./scripts/setup-local.sh
./scripts/dev-local.sh
