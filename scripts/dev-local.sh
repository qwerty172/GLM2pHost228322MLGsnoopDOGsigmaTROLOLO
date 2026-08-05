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
HEALTH_URL="http://127.0.0.1:${API_PORT}/api/healthz"

cleanup() {
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "==> API-сервер (порт ${API_PORT})"
pnpm --filter @workspace/api-server run dev &
API_PID=$!

echo "==> Ждём готовности API (${HEALTH_URL})"
for _ in $(seq 1 90); do
  if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
    echo "API готов"
    break
  fi
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "API-сервер завершился с ошибкой — см. лог выше" >&2
    exit 1
  fi
  sleep 1
done

if ! curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
  echo "API не ответил за 90 с — проверь DATABASE_URL и лог API" >&2
  exit 1
fi

echo "==> Web (http://localhost:${WEB_PORT}, прокси /api -> :${API_PORT})"
pnpm --filter @workspace/web run dev &
WEB_PID=$!

echo ""
echo "API:  http://localhost:${API_PORT}/api/healthz"
echo "Web:  http://localhost:${WEB_PORT}"
echo "Демо: http://localhost:${WEB_PORT}/games/rogue-fable-3"
echo "Ctrl+C — остановить оба процесса"
echo ""

wait
