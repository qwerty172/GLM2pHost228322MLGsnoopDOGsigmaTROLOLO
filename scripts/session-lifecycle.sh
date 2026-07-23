#!/usr/bin/env bash
# Фаза 3: create → active → end → SQL ghost check (+ optional billing tick)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export ROOT

BASE="${API_BASE:-http://localhost:8080}"
DATABASE_URL="${DATABASE_URL:-$(grep '^DATABASE_URL=' .env | cut -d= -f2-)}"

json_field() {
  node -e "const d=JSON.parse(process.argv[1]); const k=process.argv[2]; const v=k.split('.').reduce((o,x)=>o?.[x],d); if(v==null) process.exit(1); console.log(v);" "$1" "$2"
}

source "$ROOT/scripts/smoke-helpers.sh"

echo "Session lifecycle smoke: $BASE"

PLAYER_WALLET=$(smoke_player_token "$BASE")
echo "OK  player registered"

HOST_TOKEN=$(smoke_host_token "$BASE")
echo "OK  host ready"

SESSION_JSON=$(curl -sf -X POST "$BASE/api/sessions/test" \
  -H "X-Host-Token: $HOST_TOKEN")
SESSION_ID=$(json_field "$SESSION_JSON" session.id)
PLAYER_TOKEN=$(json_field "$SESSION_JSON" session.playerToken)
echo "OK  test session $SESSION_ID"

curl -sf -X POST "$BASE/api/sessions/by-player-token/$PLAYER_TOKEN/claim" \
  -H 'content-type: application/json' \
  -d "{\"playerWalletToken\":\"$PLAYER_WALLET\"}" >/dev/null
echo "OK  session claimed"

# Player WS marks session active
WS_URL="${BASE/http/ws}/api/signal?role=player&playerToken=${PLAYER_TOKEN}&playerWalletToken=${PLAYER_WALLET}"
node --input-type=module -e "
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { WebSocket } = require(process.env.ROOT + '/artifacts/api-server/node_modules/ws/index.js');
const url = process.argv[1];
await new Promise((resolve, reject) => {
  const ws = new WebSocket(url);
  const t = setTimeout(() => reject(new Error('WS timeout')), 10000);
  ws.on('open', () => {
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === 'welcome') {
        clearTimeout(t);
        ws.close();
        resolve();
      }
    });
  });
  ws.on('error', reject);
});
" "$WS_URL"
echo "OK  player WS connected (session → active)"

ACTIVE_COUNT=$(psql "$DATABASE_URL" -tAc \
  "SELECT count(*) FROM sessions WHERE id='$SESSION_ID' AND status='active';")
if [[ "$ACTIVE_COUNT" != "1" ]]; then
  echo "FAIL session not active in DB (count=$ACTIVE_COUNT)"
  exit 1
fi
echo "OK  SQL status=active"

curl -sf -X PATCH "$BASE/api/sessions/$SESSION_ID/end" \
  -H 'content-type: application/json' \
  -d "{\"hostToken\":\"$HOST_TOKEN\",\"reason\":\"lifecycle_smoke\"}" >/dev/null
echo "OK  session ended via API"

GHOST_COUNT=$(psql "$DATABASE_URL" -tAc \
  "SELECT count(*) FROM sessions WHERE id='$SESSION_ID' AND status='active';")
if [[ "$GHOST_COUNT" != "0" ]]; then
  echo "FAIL ghost active session after end (count=$GHOST_COUNT)"
  exit 1
fi
echo "OK  no ghost session after end"

if [[ "${BILLING_SMOKE:-0}" == "1" ]]; then
  echo "==> Billing tick smoke (≈70s)..."
  psql "$DATABASE_URL" -c \
    "UPDATE players SET internal_balance_lzt = 1000 WHERE player_token = '$PLAYER_WALLET';" >/dev/null
  echo "OK  player balance topped up via SQL"
  BILL_JSON=$(curl -sf -X POST "$BASE/api/sessions/browser-host" \
    -H 'content-type: application/json' \
    -d "{\"playerWalletToken\":\"$PLAYER_WALLET\",\"gameSlug\":\"rogue-fable-3\"}")
  BILL_SESSION_ID=$(node -e "console.log(JSON.parse(process.argv[1]).session.id)" "$BILL_JSON")
  BILL_PLAYER_TOKEN=$(node -e "console.log(JSON.parse(process.argv[1]).session.playerToken)" "$BILL_JSON")
  BILL_HOST_TOKEN=$(node -e "console.log(JSON.parse(process.argv[1]).hostToken)" "$BILL_JSON")
  echo "OK  billing session $BILL_SESSION_ID"

  curl -sf -X POST "$BASE/api/sessions/by-player-token/$BILL_PLAYER_TOKEN/claim" \
    -H 'content-type: application/json' \
    -d "{\"playerWalletToken\":\"$PLAYER_WALLET\"}" >/dev/null

  BILL_WS="${BASE/http/ws}/api/signal?role=player&playerToken=${BILL_PLAYER_TOKEN}&playerWalletToken=${PLAYER_WALLET}"
  node --input-type=module -e "
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { WebSocket } = require(process.env.ROOT + '/artifacts/api-server/node_modules/ws/index.js');
await new Promise((resolve, reject) => {
  const ws = new WebSocket(process.argv[1]);
  const t = setTimeout(() => reject(new Error('billing WS timeout')), 10000);
  ws.on('open', () => {
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === 'welcome') { clearTimeout(t); ws.close(); resolve(); }
    });
  });
  ws.on('error', reject);
});
" "$BILL_WS"
  echo "OK  billing session active, waiting 70s for tick..."
  sleep 70

  EVENTS=$(psql "$DATABASE_URL" -tAc \
    "SELECT count(*) FROM billing_events WHERE session_id='$BILL_SESSION_ID';")
  if [[ "$EVENTS" -lt 1 ]]; then
    echo "FAIL no billing_events after 70s (count=$EVENTS)"
    exit 1
  fi
  echo "OK  billing_events count=$EVENTS"

  curl -sf -X PATCH "$BASE/api/sessions/$BILL_SESSION_ID/end" \
    -H 'content-type: application/json' \
    -d "{\"hostToken\":\"$BILL_HOST_TOKEN\",\"reason\":\"billing_smoke\"}" >/dev/null
  echo "OK  billing session ended"
fi

echo "Done — session lifecycle passed."
