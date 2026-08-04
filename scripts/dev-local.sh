#!/usr/bin/env bash
# Обёртка — логика в scripts/dev.mjs (кроссплатформенно: pnpm dev)
set -euo pipefail
cd "$(dirname "$0")/.."
exec node scripts/dev.mjs
