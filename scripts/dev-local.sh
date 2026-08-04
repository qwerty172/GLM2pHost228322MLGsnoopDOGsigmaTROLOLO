#!/usr/bin/env bash
# Обёртка: pnpm dev (см. scripts/dev.mjs)
set -euo pipefail
exec node "$(dirname "$0")/dev.mjs" "$@"
