#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FAST=false
for arg in "$@"; do
  case "$arg" in
    --fast) FAST=true ;;
    -h|--help)
      echo "Использование: ./scripts/setup-local.sh [--fast]"
      echo "  --fast  без pnpm typecheck (быстрее для повторного запуска)"
      exit 0
      ;;
  esac
done

gen_hex_secret() {
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

set_env_key() {
  local key="$1"
  local value="$2"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "s|^${key}=.*|${key}=${value}|" .env
  else
    sed -i "s|^${key}=.*|${key}=${value}|" .env
  fi
}

ensure_secret() {
  local key="$1"
  if grep -qE "^${key}=$" .env 2>/dev/null || grep -qE "^${key}=\s*$" .env 2>/dev/null; then
    set_env_key "$key" "$(gen_hex_secret)"
    echo "Сгенерирован ${key}"
  fi
}

wait_for_postgres() {
  # shellcheck disable=SC1091
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a

  local host="localhost"
  local port="5432"
  if [[ "${DATABASE_URL:-}" =~ @([^:/]+):([0-9]+)/ ]]; then
    host="${BASH_REMATCH[1]}"
    port="${BASH_REMATCH[2]}"
  fi

  echo "==> Ожидание PostgreSQL (${host}:${port})..."
  for _ in $(seq 1 45); do
    if command -v pg_isready >/dev/null 2>&1; then
      pg_isready -h "$host" -p "$port" -q 2>/dev/null && return 0
    elif command -v nc >/dev/null 2>&1; then
      nc -z "$host" "$port" 2>/dev/null && return 0
    else
      node -e "
        const net = require('net');
        const s = net.createConnection({ host: process.argv[1], port: Number(process.argv[2]) });
        s.once('connect', () => { s.end(); process.exit(0); });
        s.once('error', () => process.exit(1));
      " "$host" "$port" 2>/dev/null && return 0
    fi
    sleep 1
  done

  echo "PostgreSQL не отвечает. Запусти: pnpm db:up" >&2
  return 1
}

echo "==> DecentralHub — локальная настройка"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Создан .env из .env.example"
else
  echo ".env уже существует — пропускаем копирование"
fi

# Docker Compose defaults — если остался шаблон из .env.example
if grep -qE '^DATABASE_URL=postgresql://user:password@' .env 2>/dev/null; then
  set_env_key "DATABASE_URL" "postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"
  echo "DATABASE_URL → docker-compose defaults"
fi

ensure_secret "WALLET_ENCRYPTION_KEY"
ensure_secret "JWT_SECRET"

echo "==> pnpm install"
pnpm install

wait_for_postgres

echo "==> Применение схемы БД"
pnpm --filter @workspace/db run push

if [[ "$FAST" == "false" ]]; then
  echo "==> Проверка типов"
  pnpm run typecheck
else
  echo "==> Пропуск typecheck (--fast)"
fi

echo ""
echo "Готово. Запуск:"
echo "  pnpm dev"
echo "  pnpm smoke   — smoke-тест API (когда dev запущен)"
