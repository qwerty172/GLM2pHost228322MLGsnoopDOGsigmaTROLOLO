#!/usr/bin/env bash
# Остановка локальной Docker-инфраструктуры
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

docker compose -f infra/docker-compose.dev.yml down

echo "PostgreSQL и Redis остановлены."
