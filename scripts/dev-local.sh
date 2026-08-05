#!/usr/bin/env bash
# Запуск API + Web — обёртка над pnpm dev
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec node scripts/dev.mjs
