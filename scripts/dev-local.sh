#!/usr/bin/env bash
# Запуск API-сервера и Web для локальной разработки (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Нет .env — сначала: pnpm setup" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

API_PORT="${PORT:-8080}"
WEB_PORT="${WEB_PORT:-5000}"

cleanup() {
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "==> API-сервер (порт ${API_PORT})"
pnpm --filter @workspace/api-server run dev &
API_PID=$!

echo "==> Web (http://localhost:${WEB_PORT})"
WEB_PORT="${WEB_PORT}" PORT="${WEB_PORT}" pnpm --filter @workspace/web run dev &
WEB_PID=$!

echo ""
echo "Ждём API..."
for _ in $(seq 1 60); do
  if curl -sf "http://localhost:${API_PORT}/api/healthz" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if curl -sf "http://localhost:${API_PORT}/api/readyz" >/dev/null 2>&1; then
  echo "✓ API и БД готовы"
elif curl -sf "http://localhost:${API_PORT}/api/healthz" >/dev/null 2>&1; then
  echo "✓ API запущен (БД: проверь /api/readyz)"
else
  echo "⚠ API ещё стартует — подожди несколько секунд"
fi

echo ""
echo "API:  http://localhost:${API_PORT}/api/healthz"
echo "Web:  http://localhost:${WEB_PORT}"
echo "Ctrl+C — остановить оба процесса"
echo ""

wait
