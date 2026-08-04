#!/usr/bin/env bash
# Один скрипт: Docker Postgres + быстрая настройка + dev
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
chmod +x scripts/*.sh 2>/dev/null || true
./scripts/setup-local.sh --quick --docker
./scripts/dev-local.sh
