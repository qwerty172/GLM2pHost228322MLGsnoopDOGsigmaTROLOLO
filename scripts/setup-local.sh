#!/usr/bin/env bash
# Обёртка — логика в scripts/setup.mjs (кроссплатформенно)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec node "$ROOT/scripts/setup.mjs" "$@"
