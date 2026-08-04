#!/usr/bin/env bash
# Запуск API-сервера и Web для локальной разработки (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Нет .env — сначала: pnpm setup  или  ./scripts/setup-local.sh" >&2
  exit 1
fi

API_PORT=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' || echo "8080")
WEB_PORT=$(grep -E '^WEB_PORT=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' || echo "5000")

cleanup() {
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "==> API-сервер (порт ${API_PORT})"
pnpm --filter @workspace/api-server run dev &
API_PID=$!

echo "==> Ждём API healthz…"
for _ in {1..90}; do
  if curl -sf "http://localhost:${API_PORT}/api/healthz" >/dev/null 2>&1; then
    echo "API готов"
    break
  fi
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "API-процесс завершился — проверь логи выше" >&2
    exit 1
  fi
  sleep 1
done

echo "==> Web (http://localhost:${WEB_PORT}, прокси /api -> :${API_PORT})"
pnpm --filter @workspace/web run dev &
WEB_PID=$!

echo ""
echo "API:  http://localhost:${API_PORT}/api/healthz"
echo "Web:  http://localhost:${WEB_PORT}"
echo "Демо: http://localhost:${WEB_PORT}/demo  (без регистрации)"
echo "Ctrl+C — остановить оба процесса"
echo ""

wait
