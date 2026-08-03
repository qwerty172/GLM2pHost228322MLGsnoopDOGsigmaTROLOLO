#!/usr/bin/env bash
# Фаза 2: curl всех /api/* которые дергают страницы из TESTPLAN §2.2
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BASE="${API_BASE:-http://localhost:8080}"
WEB="${WEB_BASE:-http://localhost:5000}"

check() {
  local method="$1"
  local path="$2"
  local expected="${3:-200}"
  local body="${4:-}"
  local header="${5:-}"
  local url="$BASE$path"
  local code
  local args=(-s -o /dev/null -w "%{http_code}")
  if [[ -n "$header" ]]; then
    args+=(-H "$header")
  fi
  if [[ "$method" == "POST" ]]; then
    args+=(-X POST -H 'content-type: application/json')
    if [[ -n "$body" ]]; then
      args+=(-d "$body")
    fi
  fi
  code=$(curl "${args[@]}" "$url")
  if [[ "$code" == "$expected" ]] || [[ "$expected" == "2xx" && "$code" =~ ^2 ]]; then
    echo "OK  $method $path -> $code"
  else
    echo "FAIL $method $path -> $code (expected $expected)"
    return 1
  fi
}

check_web() {
  local path="$1"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$WEB$path")
  if [[ "$code" =~ ^2 ]]; then
    echo "OK  GET $path (web) -> $code"
  else
    echo "FAIL GET $path (web) -> $code"
    return 1
  fi
}

echo "Pages API smoke: API=$BASE WEB=$WEB"

source "$ROOT/scripts/smoke-helpers.sh"

PLAYER_TOKEN=$(smoke_player_token "$BASE")
HOST_TOKEN=$(smoke_host_token "$BASE")

# §2.2 page APIs
check GET /api/healthz
check GET /api/stats
check GET /api/games
check GET /api/games/rogue-fable-3
check GET /api/public/ping
check GET /api/public/ice-config
check GET /api/public/games
check GET "/api/public/games/rogue-fable-3/hosts"
check GET /api/hosts
check GET "/api/wallet/$PLAYER_TOKEN"
check GET /api/quotas
check GET /api/loans/requests
check GET "/api/hosts/$HOST_TOKEN"
check GET "/api/hosts/$HOST_TOKEN/stats"
check GET "/api/hosts/$HOST_TOKEN/activity"
check GET /api/hosts/@me/library 200 "" "X-User-Token: $HOST_TOKEN"
check GET /api/hosts/me/current-quota 200 "" "X-User-Token: $HOST_TOKEN"

# Web shell pages (SPA index)
for path in / /games /games/rogue-fable-3 /hosts /wallet /host/wallet /profile /exchange \
  /quotas /quotas/new /host/setup /host /host/library /embed; do
  check_web "$path"
done

echo "Done — pages API smoke passed."
