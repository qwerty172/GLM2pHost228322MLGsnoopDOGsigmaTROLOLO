#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SKIP_TYPECHECK=0
for arg in "$@"; do
  case "$arg" in
    --skip-typecheck) SKIP_TYPECHECK=1 ;;
  esac
done

echo "==> DecentralHub — локальная настройка"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Создан .env из .env.example"
else
  echo ".env уже существует — пропускаем копирование"
fi

generate_env_key() {
  local var_name="$1"
  if grep -q "^${var_name}=$" .env 2>/dev/null; then
    local key
    key=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' "s/^${var_name}=$/${var_name}=${key}/" .env
    else
      sed -i "s/^${var_name}=$/${var_name}=${key}/" .env
    fi
    echo "Сгенерирован ${var_name}"
  fi
}

generate_env_key WALLET_ENCRYPTION_KEY
generate_env_key JWT_SECRET

echo "==> pnpm install"
pnpm install

if ! command -v docker &>/dev/null || ! docker info &>/dev/null 2>&1; then
  echo ""
  echo "Подсказка: Postgres без ручной установки — pnpm infra:up (нужен Docker)"
fi

echo "==> Применение схемы БД (нужен PostgreSQL и DATABASE_URL в .env)"
if ! pnpm --filter @workspace/db run push; then
  echo ""
  echo "db push не прошёл. Запусти Postgres:"
  echo "  pnpm infra:up          — docker compose (postgres + redis)"
  echo "  или настрой DATABASE_URL в .env вручную"
  exit 1
fi

if [[ "$SKIP_TYPECHECK" -eq 0 ]]; then
  echo "==> Проверка типов"
  pnpm run typecheck
else
  echo "==> Пропуск typecheck (--skip-typecheck)"
fi

echo ""
echo "Готово. Запуск:"
echo "  pnpm dev               — API + Web"
echo "  ./scripts/dev-local.sh — то же"
