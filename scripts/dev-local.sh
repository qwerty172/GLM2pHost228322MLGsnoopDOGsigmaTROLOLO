#!/usr/bin/env bash
# Обёртка для pnpm dev (Linux/macOS/Git Bash)
set -euo pipefail
exec node "$(dirname "$0")/dev.mjs" "$@"
