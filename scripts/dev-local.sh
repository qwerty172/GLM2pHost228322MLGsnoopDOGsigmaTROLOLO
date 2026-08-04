#!/usr/bin/env bash
# Обёртка для совместимости — логика в scripts/dev.mjs (pnpm dev)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec node scripts/dev.mjs "$@"
