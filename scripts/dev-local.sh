#!/usr/bin/env bash
# Запуск API-сервера и Web для локальной разработки (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Нет .env — сначала запусти: pnpm setup" >&2
  exit 1
fi

cleanup() {
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "==> API-сервер (http://localhost:8080)"
pnpm --filter @workspace/api-server run dev &
API_PID=$!

echo "==> Web (http://localhost:5000, прокси /api -> API)"
pnpm --filter @workspace/web run dev &
WEB_PID=$!

echo ""
echo "API:  http://localhost:8080/api/healthz"
echo "Web:  http://localhost:5000"
echo "Ctrl+C — остановить оба процесса"
echo ""

wait
