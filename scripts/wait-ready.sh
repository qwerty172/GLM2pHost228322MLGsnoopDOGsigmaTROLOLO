#!/usr/bin/env bash
# Ждёт готовности API и БД (GET /api/readyz → 200)
set -euo pipefail

API_URL="${API_URL:-http://localhost:8080}"
MAX_WAIT="${MAX_WAIT:-120}"
INTERVAL="${INTERVAL:-2}"

echo "==> Ожидание готовности API ($API_URL/api/readyz), до ${MAX_WAIT}с…"

elapsed=0
while [ "$elapsed" -lt "$MAX_WAIT" ]; do
  if curl -sf "$API_URL/api/readyz" >/dev/null 2>&1; then
    echo "API и БД готовы."
    exit 0
  fi
  sleep "$INTERVAL"
  elapsed=$((elapsed + INTERVAL))
done

echo "Таймаут: API не ответил за ${MAX_WAIT}с. Проверь логи api-server и DATABASE_URL." >&2
exit 1
