#!/usr/bin/env bash
# Запуск API-сервера и Web для локальной разработки (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Нет .env — сначала: pnpm quickstart или ./scripts/setup-local.sh" >&2
  exit 1
fi

# Читаем порты из .env без source (секреты могут содержать спецсимволы)
read_env_port() {
  local key="$1" default="$2"
  local val
  val="$(grep -E "^${key}=" .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || true)"
  echo "${val:-$default}"
}
WEB_PORT="$(read_env_port WEB_PORT 5000)"
API_PORT="$(read_env_port PORT 8080)"

cleanup() {
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "==> API-сервер (порт $API_PORT)"
pnpm --filter @workspace/api-server run dev &
API_PID=$!

echo "==> Web (http://localhost:$WEB_PORT)"
pnpm --filter @workspace/web run dev &
WEB_PID=$!

echo ""
echo "API:  http://localhost:${API_PORT}/api/healthz"
echo "Web:  http://localhost:${WEB_PORT}"
echo "Хост: http://localhost:${WEB_PORT}/host"
echo "Ctrl+C — остановить оба процесса"
echo ""

wait
