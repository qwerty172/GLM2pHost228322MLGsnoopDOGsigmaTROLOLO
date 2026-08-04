#!/usr/bin/env bash
# Ждёт готовности API (GET /api/readyz) — макс. 60 секунд
set -euo pipefail

BASE="${1:-http://localhost:8080}"
MAX="${2:-60}"

echo "Ожидание API ($BASE/api/readyz)..."
for i in $(seq 1 "$MAX"); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/readyz" 2>/dev/null || echo "000")
  if [[ "$code" == "200" ]]; then
    echo "API готов."
    exit 0
  fi
  sleep 1
done

echo "API не ответил за ${MAX}с (последний код: $code)" >&2
exit 1
