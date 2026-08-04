#!/usr/bin/env bash
# Обёртка для pnpm setup (Linux/macOS/Git Bash)
set -euo pipefail
exec node "$(dirname "$0")/setup.mjs" "$@"
