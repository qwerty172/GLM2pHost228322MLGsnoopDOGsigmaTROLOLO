#!/usr/bin/env bash
# Одна команда: проверка API → тест-сессия → ссылка для игры в браузере.
# Требует: запущенный API (pnpm dev) и PostgreSQL.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WEB_BASE="${WEB_BASE:-http://localhost:5000}"
API_BASE="${API_BASE:-http://localhost:8080}"

if [[ ! -f .env ]]; then
  echo "Нет .env — сначала: pnpm setup" >&2
  exit 1
fi

echo "==> Проверка API"
health="$(curl -sf "${API_BASE}/api/healthz" || true)"
if [[ "$health" != *"ok"* ]]; then
  echo "API не отвечает на ${API_BASE}/api/healthz" >&2
  echo "Запусти: pnpm dev" >&2
  exit 1
fi
echo "OK  healthz"

echo "==> Регистрация гостя"
guest_json="$(curl -sf -X POST "${API_BASE}/api/players/register" \
  -H 'content-type: application/json' \
  -d '{"guest":true}')"
player_token="$(node -e "const j=JSON.parse(process.argv[1]); process.stdout.write(j.playerToken||'')" "$guest_json")"
balance="$(node -e "const j=JSON.parse(process.argv[1]); process.stdout.write(String(j.internalBalanceLzt??0))" "$guest_json")"
if [[ -z "$player_token" ]]; then
  echo "Не удалось зарегистрировать гостя" >&2
  exit 1
fi
echo "OK  гость ${player_token:0:8}… · баланс ${balance} LZT"

echo "==> Хост для тест-сессии"
host_json="$(curl -sf -X POST "${API_BASE}/api/hosts/register" \
  -H 'content-type: application/json' \
  -d "{\"displayName\":\"Demo $(date +%H%M%S)\"}" 2>/dev/null || true)"
host_token="$(node -e "try{const j=JSON.parse(process.argv[1]); process.stdout.write(j.hostToken||'')}catch{}" "$host_json")"

if [[ -z "$host_token" ]]; then
  if command -v psql >/dev/null 2>&1; then
    db_url="$(grep '^DATABASE_URL=' .env | head -1 | cut -d= -f2-)"
    host_token="$(psql "$db_url" -tAc "SELECT host_token FROM hosts ORDER BY created_at DESC LIMIT 1;" 2>/dev/null | tr -d '[:space:]')"
  fi
fi
if [[ -z "$host_token" ]]; then
  echo "Не удалось получить host token" >&2
  exit 1
fi
echo "OK  host ${host_token:0:8}…"

echo "==> Тест-сессия (браузерная демо, без WebRTC)"
sess_json="$(curl -sf -X POST "${API_BASE}/api/sessions/test" \
  -H "X-Host-Token: ${host_token}")"
invite="$(node -e "const j=JSON.parse(process.argv[1]); process.stdout.write(j.session?.inviteCode||'')" "$sess_json")"
if [[ -z "$invite" ]]; then
  echo "Не удалось создать тест-сессию" >&2
  echo "$sess_json" >&2
  exit 1
fi

play_url="${WEB_BASE}/play/i/${invite}"

echo ""
echo "Готово — открой в браузере:"
echo "  ${play_url}"
echo ""
echo "Гостевой кошелёк (localStorage streamline.playerWalletToken):"
echo "  ${player_token}"
echo ""
echo "Подсказка: задайте DEV_GUEST_STARTER_LZT в .env для стартового баланса гостей (development)."
echo "Демо-игра без хоста: ${WEB_BASE}/games/rogue-fable-3"
