#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

USE_DOCKER=false
RUN_TYPECHECK=false

for arg in "$@"; do
  case "$arg" in
    --docker) USE_DOCKER=true ;;
    --check) RUN_TYPECHECK=true ;;
    -h|--help)
      echo "Использование: $0 [--docker] [--check]"
      echo "  --docker  Поднять PostgreSQL+Redis через Docker, пропатчить DATABASE_URL"
      echo "  --check   Полная проверка типов после setup (медленнее)"
      exit 0
      ;;
  esac
done

patch_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" .env 2>/dev/null; then
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' "s|^${key}=.*|${key}=${value}|" .env
    else
      sed -i "s|^${key}=.*|${key}=${value}|" .env
    fi
  else
    echo "${key}=${value}" >> .env
  fi
}

gen_secret_if_empty() {
  local key="$1"
  if grep -q "^${key}=$" .env 2>/dev/null; then
    local val
    val=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    patch_env "$key" "$val"
    echo "Сгенерирован ${key}"
  fi
}

echo "==> DecentralHub — локальная настройка"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Создан .env из .env.example"
else
  echo ".env уже существует — пропускаем копирование"
fi

if $USE_DOCKER; then
  bash scripts/docker-up.sh
  DOCKER_URL="postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"
  patch_env "DATABASE_URL" "$DOCKER_URL"
  echo "DATABASE_URL → Docker (decentral_hub@localhost)"
fi

gen_secret_if_empty "WALLET_ENCRYPTION_KEY"
gen_secret_if_empty "JWT_SECRET"

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД (нужен PostgreSQL и DATABASE_URL в .env)"
if ! pnpm --filter @workspace/db run push; then
  echo ""
  echo "Ошибка db push. Варианты:"
  echo "  1) pnpm setup:docker   — PostgreSQL через Docker"
  echo "  2) Вручную: createdb decentral_hub и DATABASE_URL в .env"
  exit 1
fi

if $RUN_TYPECHECK; then
  echo "==> Проверка типов"
  pnpm run typecheck
else
  echo "==> Пропуск typecheck (быстрый старт). Полная проверка: pnpm setup:check"
fi

echo ""
echo "Готово. Запуск:"
echo "  pnpm dev              — API + Web"
echo "  http://localhost:5000 — открой в браузере"
echo ""
echo "Попробовать без агента: /host → «Попробовать в браузере»"
echo "Демо-игра для игрока:   /games/rogue-fable-3"
