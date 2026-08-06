#!/usr/bin/env bash
# Обёртка для совместимости — предпочтительно: pnpm setup
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec node scripts/setup.mjs
