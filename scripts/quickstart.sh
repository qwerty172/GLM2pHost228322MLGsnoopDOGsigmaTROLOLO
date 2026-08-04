#!/usr/bin/env bash
# Взял и юзаешь: Docker (если есть) → setup → dev
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> DecentralHub quickstart"
echo ""

if command -v docker >/dev/null 2>&1; then
  ./scripts/infra-up.sh
  DOCKER_ENV=1
else
  echo "Docker не найден — пропускаем infra-up (нужен свой PostgreSQL)."
  DOCKER_ENV=0
fi

if [[ "$DOCKER_ENV" -eq 1 ]]; then
  ./scripts/setup-local.sh --skip-typecheck --docker-env
else
  ./scripts/setup-local.sh --skip-typecheck
fi

echo ""
./scripts/dev-local.sh
