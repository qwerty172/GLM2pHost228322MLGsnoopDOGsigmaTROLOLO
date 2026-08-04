#!/usr/bin/env bash
# Обёртка для совместимости — логика в scripts/setup.mjs (pnpm bootstrap)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec node scripts/setup.mjs "$@"
