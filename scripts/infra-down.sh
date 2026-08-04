#!/usr/bin/env bash
# Остановить Docker Compose инфраструктуру
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

docker compose -f infra/docker-compose.dev.yml down
