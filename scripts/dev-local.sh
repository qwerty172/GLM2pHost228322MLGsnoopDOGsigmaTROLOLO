#!/usr/bin/env bash
# Обёртка для pnpm dev (обратная совместимость)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec node scripts/dev.mjs "$@"
