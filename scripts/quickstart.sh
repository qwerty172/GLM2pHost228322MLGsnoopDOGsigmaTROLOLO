#!/usr/bin/env bash
# Одна команда: Docker (если есть) → настройка → dev-серверы
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if command -v docker &>/dev/null; then
  ./scripts/infra-up.sh
else
  echo "==> Docker не найден — пропускаем infra (нужен свой PostgreSQL в DATABASE_URL)"
fi

SKIP_TYPECHECK=1 ./scripts/setup-local.sh
./scripts/dev-local.sh
