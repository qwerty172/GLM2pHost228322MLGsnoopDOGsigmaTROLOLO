#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
# Рекомендуется: pnpm setup (кроссплатформенный скрипт scripts/setup.mjs)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

exec node scripts/setup.mjs
