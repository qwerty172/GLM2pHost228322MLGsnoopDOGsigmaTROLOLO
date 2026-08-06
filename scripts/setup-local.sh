#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
# Предпочтительно: pnpm setup (кроссплатформенно)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec node scripts/run-setup.mjs
