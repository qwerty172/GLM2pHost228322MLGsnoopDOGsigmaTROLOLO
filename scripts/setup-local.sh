#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SKIP_TYPECHECK=0
USE_DOCKER=0
for arg in "$@"; do
  case "$arg" in
    --skip-typecheck) SKIP_TYPECHECK=1 ;;
    --docker) USE_DOCKER=1 ;;
  esac
done

echo "==> DecentralHub — локальная настройка"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Создан .env из .env.example"
else
  echo ".env уже существует — пропускаем копирование"
fi

# Docker-пресет для DATABASE_URL / REDIS_URL
if [[ "$USE_DOCKER" -eq 1 ]]; then
  DOCKER_DB="postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"
  if grep -q '^DATABASE_URL=' .env; then
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=$DOCKER_DB|" .env
    else
      sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$DOCKER_DB|" .env
    fi
  fi
  if grep -q '^REDIS_URL=' .env; then
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' 's|^REDIS_URL=.*|REDIS_URL=redis://localhost:6379|' .env
    else
      sed -i 's|^REDIS_URL=.*|REDIS_URL=redis://localhost:6379|' .env
    fi
  fi
  echo "DATABASE_URL и REDIS_URL настроены под docker compose"
fi

set_secret_if_empty() {
  local key="$1"
  if grep -q "^${key}=$" .env 2>/dev/null; then
    local val
    val=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' "s/^${key}=$/${key}=${val}/" .env
    else
      sed -i "s/^${key}=$/${key}=${val}/" .env
    fi
    echo "Сгенерирован ${key}"
  fi
}

set_secret_if_empty WALLET_ENCRYPTION_KEY
set_secret_if_empty JWT_SECRET

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД (нужен запущенный PostgreSQL и DATABASE_URL в .env)"
pnpm --filter @workspace/db run push

if [[ "$SKIP_TYPECHECK" -eq 0 ]]; then
  echo "==> Проверка типов"
  pnpm run typecheck
else
  echo "==> Пропуск typecheck (--skip-typecheck)"
fi

echo ""
echo "Готово. Запуск:"
echo "  pnpm dev          — API + Web"
echo "  pnpm quickstart   — всё с нуля (docker + setup + dev)"
echo "  см. docs/QUICKSTART.md"
