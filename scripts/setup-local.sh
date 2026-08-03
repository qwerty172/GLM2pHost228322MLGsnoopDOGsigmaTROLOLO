#!/usr/bin/env bash
# Обёртка: pnpm bootstrap (см. scripts/setup.mjs)
set -euo pipefail
exec node "$(dirname "$0")/setup.mjs" "$@"
