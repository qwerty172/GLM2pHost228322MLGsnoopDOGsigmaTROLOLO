#!/usr/bin/env bash
# Smoke-тест API-роутов (фаза 1 TESTPLAN) — API должен быть запущен на localhost:8080
set -euo pipefail

BASE="${1:-http://localhost:8080}"

check() {
  local method="$1"
  local path="$2"
  local expected="${3:-200}"
  local body="${4:-}"
  local code
  if [[ "$method" == "POST" ]]; then
    code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE$path" -H 'content-type: application/json' -d "$body")
  else
    code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$path")
  fi
  if [[ "$code" == "$expected" ]] || [[ "$expected" == "2xx" && "$code" =~ ^2 ]]; then
    echo "OK  $method $path -> $code"
  else
    echo "FAIL $method $path -> $code (expected $expected)"
    return 1
  fi
}

echo "Smoke-test: $BASE"
check GET  /api/healthz
check GET  /api/readyz
check GET  /api/games
check GET  /api/games/rogue-fable-3
check GET  /api/hosts
check GET  /api/quotas
check GET  /api/loans/requests
check POST /api/players/register 201 '{"guest":true}'
echo "Done."
