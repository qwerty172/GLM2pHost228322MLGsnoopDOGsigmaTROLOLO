#!/usr/bin/env bash
# Shared helpers for autonomous smoke scripts (avoid host-register rate limits).
set -euo pipefail

smoke_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd
}

smoke_database_url() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    # Strip CR from Windows .env / env inheritance
    echo "$DATABASE_URL" | tr -d '\r'
    return
  fi
  grep '^DATABASE_URL=' "$(smoke_root)/.env" | cut -d= -f2- | tr -d '\r'
}

# SQL via node-pg (reliable on Windows where psql URI parsing breaks)
smoke_sql() {
  local sql="$1"
  node "$(smoke_root)/scripts/sql-query.mjs" "$sql" | tr -d '\r\n[:space:]'
}

smoke_json_field() {
  node -e "const d=JSON.parse(process.argv[1]); const v=process.argv[2].split('.').reduce((o,x)=>o?.[x],d); if(v==null) process.exit(1); console.log(v);" "$1" "$2"
}

# Returns hostToken — registers or reuses a host without an active session.
smoke_host_token() {
  local base="${1:-http://localhost:8080}"
  local db
  db="$(smoke_database_url)"
  local resp code token
  resp=$(curl -s -w "\n%{http_code}" -X POST "$base/api/hosts/register" \
    -H 'content-type: application/json' \
    -d "{\"displayName\":\"Smoke $(date +%s)\"}") || true
  code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')
  if [[ "$code" == "201" ]]; then
    smoke_json_field "$body" hostToken
    return
  fi
  token=$(psql "$db" -tAc \
    "SELECT h.host_token FROM hosts h
     WHERE NOT EXISTS (
       SELECT 1 FROM sessions s
       WHERE s.host_id = h.id AND s.status <> 'ended'
     )
     ORDER BY h.created_at DESC LIMIT 1;" | tr -d '[:space:]')
  if [[ -z "$token" ]]; then
    echo "FAIL: cannot register host ($code) and no idle host in DB" >&2
    exit 1
  fi
  echo "$token"
}

smoke_player_token() {
  local base="${1:-http://localhost:8080}"
  local resp
  resp=$(curl -sf -X POST "$base/api/players/register" \
    -H 'content-type: application/json' \
    -d '{"guest":true}')
  smoke_json_field "$resp" playerToken
}
