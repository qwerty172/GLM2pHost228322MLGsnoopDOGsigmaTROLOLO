#!/usr/bin/env bash
# Запуск API-сервера и Web для локальной разработки (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Нет .env — сначала запусти: ./scripts/setup-local.sh" >&2
  exit 1
fi

cleanup() {
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "==> API-сервер (порт из .env, обычно 8080)"
pnpm --filter @workspace/api-server run dev &
API_PID=$!

WEB_PORT=$(grep -E '^WEB_PORT=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
WEB_PORT=${WEB_PORT:-5000}

echo "==> Web (http://localhost:${WEB_PORT}, прокси /api -> API)"
pnpm --filter @workspace/web run dev &
WEB_PID=$!

echo ""
echo "API:  http://localhost:8080/api/healthz"
echo "Web:  http://localhost:${WEB_PORT}"
echo "Ctrl+C — остановить оба процесса"
echo ""

wait
