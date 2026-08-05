#!/usr/bin/env bash
# Ждёт доступности порта PostgreSQL из DATABASE_URL в .env.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

DATABASE_URL="${1:-${DATABASE_URL:-}}"
if [[ -z "$DATABASE_URL" ]]; then
  echo "wait-for-postgres: DATABASE_URL не задан" >&2
  exit 1
fi

read -r PG_HOST PG_PORT < <(
  node -e "
    const raw = process.argv[1];
    const u = new URL(raw.replace(/^postgresql:/, 'http:'));
    process.stdout.write((u.hostname || 'localhost') + ' ' + (u.port || '5432'));
  " "$DATABASE_URL"
)

MAX_ATTEMPTS="${WAIT_FOR_PG_ATTEMPTS:-30}"
SLEEP_SEC="${WAIT_FOR_PG_SLEEP:-1}"

echo "  Ожидание PostgreSQL на ${PG_HOST}:${PG_PORT} (до ${MAX_ATTEMPTS}с)..."

for ((i = 1; i <= MAX_ATTEMPTS; i++)); do
  if (echo >"/dev/tcp/${PG_HOST}/${PG_PORT}") 2>/dev/null; then
    echo "  ✓ PostgreSQL доступен"
    exit 0
  fi
  sleep "$SLEEP_SEC"
done

echo "  ✗ PostgreSQL не ответил за ${MAX_ATTEMPTS}с" >&2
echo "    Проверь DATABASE_URL в .env или запусти: pnpm db:up" >&2
exit 1
