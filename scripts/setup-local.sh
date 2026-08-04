#!/usr/bin/env bash
# Обёртка — логика в scripts/setup.mjs (кроссплатформенно: pnpm setup)
set -euo pipefail
cd "$(dirname "$0")/.."
exec node scripts/setup.mjs "$@"
