#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RUN_TYPECHECK=0
START_DEV=0

for arg in "$@"; do
  case "$arg" in
    --full) RUN_TYPECHECK=1 ;;
    --dev) START_DEV=1 ;;
    --help|-h)
      echo "Использование: $0 [--full] [--dev]"
      echo "  --full  полная проверка типов (медленнее)"
      echo "  --dev   после настройки запустить dev-local.sh"
      exit 0
      ;;
  esac
done

echo "==> DecentralHub — локальная настройка"

if [[ ! -f .env ]]; then
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    cp .env.docker .env
    echo "Создан .env из .env.docker (Docker-режим)"
  else
    cp .env.example .env
    echo "Создан .env из .env.example — отредактируй DATABASE_URL"
  fi
else
  echo ".env уже существует — пропускаем копирование"
fi

set_env_key() {
  local key="$1"
  local value="$2"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "s|^${key}=.*|${key}=${value}|" .env
  else
    sed -i "s|^${key}=.*|${key}=${value}|" .env
  fi
}

generate_hex_secret() {
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

for key in WALLET_ENCRYPTION_KEY JWT_SECRET; do
  if grep -qE "^${key}=$" .env 2>/dev/null; then
    set_env_key "$key" "$(generate_hex_secret)"
    echo "Сгенерирован ${key}"
  fi
done

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД"
if ! pnpm --filter @workspace/db run push; then
  echo ""
  echo "Ошибка db push — PostgreSQL запущен? DATABASE_URL в .env верный?" >&2
  echo "С Docker: pnpm docker:up" >&2
  exit 1
fi

if [[ "$RUN_TYPECHECK" -eq 1 ]]; then
  echo "==> Проверка типов"
  pnpm run typecheck
else
  echo "==> Проверка типов пропущена (быстрый старт). Полная: pnpm typecheck"
fi

echo ""
echo "Готово."
echo "  pnpm dev              — API + Web"
echo "  pnpm typecheck        — проверка типов"
echo "  ./scripts/smoke-api.sh — smoke-тест API"
echo ""

if [[ "$START_DEV" -eq 1 ]]; then
  exec ./scripts/dev-local.sh
fi
