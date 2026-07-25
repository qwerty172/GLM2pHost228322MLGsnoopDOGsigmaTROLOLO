#!/usr/bin/env bash
# Фаза 4: heartbeat, agent-challenge, ice-config, host-agent.zip, agent-auth
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BASE="${API_BASE:-http://localhost:8080}"
export API_BASE="$BASE"
export NODE_PATH="${ROOT}/artifacts/api-server/node_modules:${NODE_PATH:-}"
# Git Bash /tmp is not visible to Windows node.exe — keep body in workspace.
SMOKE_BODY="${ROOT}/.tmp-agent-smoke-body.json"
export SMOKE_BODY

check_json() {
  local method="$1"
  local path="$2"
  local expected="${3:-200}"
  local body="${4:-}"
  local extra_header="${5:-}"
  local code
  local curl_args=(-s -o "$SMOKE_BODY" -w "%{http_code}")
  if [[ -n "$extra_header" ]]; then
    curl_args+=(-H "$extra_header")
  fi
  if [[ "$method" == "POST" ]]; then
    curl_args+=(-X POST -H 'content-type: application/json')
    if [[ -n "$body" ]]; then
      curl_args+=(-d "$body")
    fi
  fi
  code=$(curl "${curl_args[@]}" "$BASE$path")
  if [[ "$code" == "$expected" ]] || [[ "$expected" == "2xx" && "$code" =~ ^2 ]]; then
    echo "OK  $method $path -> $code"
  else
    echo "FAIL $method $path -> $code (expected $expected)"
    cat "$SMOKE_BODY" >&2 || true
    return 1
  fi
}

json_field() {
  node -e "const d=JSON.parse(require('fs').readFileSync(process.env.SMOKE_BODY,'utf8')); const v=process.argv[1].split('.').reduce((o,x)=>o?.[x],d); if(v==null) process.exit(1); console.log(v);" "$1"
}

echo "Agent API smoke: $BASE"

source "$ROOT/scripts/smoke-helpers.sh"

HOST_TOKEN=$(smoke_host_token "$BASE")
echo "OK  host ready"

check_json POST /api/hosts/heartbeat 200 "{\"hostToken\":\"$HOST_TOKEN\",\"pingMs\":42}"
check_json GET /api/auth/agent-challenge 200
check_json GET /api/public/ice-config 200

node -e "const j=JSON.parse(require('fs').readFileSync(process.env.SMOKE_BODY,'utf8')); if(!j.iceServers) process.exit(1);"
echo "OK  ice-config JSON valid"

check_json GET /api/downloads/host-agent.zip 2xx

# curl wrote body to file — verify zip magic
if ! head -c 2 "$SMOKE_BODY" | grep -q PK; then
  echo "FAIL host-agent.zip is not a ZIP archive"
  exit 1
fi
echo "OK  host-agent.zip downloadable"

SMOKE_HOST_TOKEN="$HOST_TOKEN" node "$ROOT/scripts/agent-auth-smoke.mjs"

echo "==> ping-server :18080"
pnpm --filter @workspace/host-agent run build:main >/dev/null
node "$ROOT/scripts/ping-server-smoke.mjs"

echo "Done — agent API smoke passed."
