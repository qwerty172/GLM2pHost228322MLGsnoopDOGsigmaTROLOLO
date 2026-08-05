#!/usr/bin/env bash
# Первичная настройка — обёртка над pnpm setup (быстро, без typecheck)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec node scripts/setup.mjs "$@"
