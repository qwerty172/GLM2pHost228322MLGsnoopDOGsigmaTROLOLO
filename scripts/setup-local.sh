#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

USE_DOCKER=false
for arg in "$@"; do
  case "$arg" in
    --docker) USE_DOCKER=true ;;
  esac
done

generate_secret() {
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

set_env_if_empty() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=$" .env 2>/dev/null; then
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' "s/^${key}=$/${key}=${value}/" .env
    else
      sed -i "s/^${key}=$/${key}=${value}/" .env
    fi
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
  echo "==> Docker: PostgreSQL + Redis"
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker не найден — установи Docker или убери флаг --docker" >&2
    exit 1
  fi
  docker compose -f infra/docker-compose.dev.yml up -d postgres redis
  if grep -q '^DATABASE_URL=postgresql://user:password@' .env 2>/dev/null; then
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' 's|^DATABASE_URL=.*|DATABASE_URL=postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub|' .env
    else
      sed -i 's|^DATABASE_URL=.*|DATABASE_URL=postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub|' .env
    fi
    echo "DATABASE_URL → docker-compose (decentral_hub:decentral_hub)"
  fi
  echo "Ждём PostgreSQL..."
  for _ in $(seq 1 30); do
    if docker compose -f infra/docker-compose.dev.yml exec -T postgres pg_isready -U decentral_hub >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

set_env_if_empty "WALLET_ENCRYPTION_KEY" "$(generate_secret)"
set_env_if_empty "JWT_SECRET" "$(generate_secret)"

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД (нужен запущенный PostgreSQL и DATABASE_URL в .env)"
pnpm --filter @workspace/db run push

echo "==> Проверка типов"
pnpm run typecheck

echo ""
echo "Готово! Запуск:"
echo "  pnpm dev                        — API (:8080) + Web (:5000)"
echo "  pnpm smoke                      — smoke-тест API"
echo ""
echo "Без PostgreSQL локально: pnpm setup:docker"
