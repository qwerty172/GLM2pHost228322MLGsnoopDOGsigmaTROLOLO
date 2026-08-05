#!/usr/bin/env bash
# Запуск API-сервера и Web для локальной разработки (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Нет .env — сначала запусти: pnpm setup" >&2
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

wait_for_api() {
  local url="http://localhost:${API_PORT}/api/healthz"
  local max=90
  local i=0
  echo "==> Ждём API (${url})..."
  while [[ $i -lt $max ]]; do
    if curl -sf "$url" > /dev/null 2>&1; then
      echo "    API готов"
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  echo "    API не ответил за ${max}с — смотри логи выше" >&2
  return 1
}

echo "==> API-сервер (порт ${API_PORT})"
pnpm --filter @workspace/api-server run dev &
API_PID=$!

wait_for_api

echo "==> Web (http://localhost:${WEB_PORT}, прокси /api -> API)"
pnpm --filter @workspace/web run dev &
WEB_PID=$!

echo ""
echo "Готово:"
echo "  API:  http://localhost:${API_PORT}/api/healthz"
echo "  Web:  http://localhost:${WEB_PORT}"
echo "  Демо: http://localhost:${WEB_PORT}/games → Rogue Fable III → «Хостить в браузере»"
echo ""
echo "Ctrl+C — остановить оба процесса"
echo ""

wait
