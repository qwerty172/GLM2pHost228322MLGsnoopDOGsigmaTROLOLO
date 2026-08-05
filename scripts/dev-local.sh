#!/usr/bin/env bash
# Запуск API-сервера и Web для локальной разработки (Linux/macOS/Git Bash)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec node "$ROOT/scripts/dev.mjs"
