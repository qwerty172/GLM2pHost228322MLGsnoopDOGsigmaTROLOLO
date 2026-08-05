#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RUN_TYPECHECK=0
for arg in "$@"; do
  case "$arg" in
    --full) RUN_TYPECHECK=1 ;;
  esac
done

gen_hex() {
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

set_env_value() {
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
  if grep -q "^${key}=$" .env 2>/dev/null; then
    set_env_value "$key" "$(gen_hex)"
    echo "Сгенерирован ${key}"
  fi
}

start_docker_postgres() {
  if ! command -v docker >/dev/null 2>&1; then
    return 1
  fi
  echo "==> Запуск PostgreSQL через Docker (infra/docker-compose.dev.yml)"
  docker compose -f infra/docker-compose.dev.yml up -d postgres
  echo "Ждём PostgreSQL…"
  for _ in $(seq 1 30); do
    if docker compose -f infra/docker-compose.dev.yml exec -T postgres pg_isready -U decentral_hub >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

echo "==> DecentralHub — локальная настройка"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Создан .env из .env.example"
else
  echo ".env уже существует — пропускаем копирование"
fi

ensure_secret WALLET_ENCRYPTION_KEY
ensure_secret JWT_SECRET

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД"
if ! pnpm --filter @workspace/db run push; then
  if start_docker_postgres; then
    pnpm --filter @workspace/db run push
  else
    echo ""
    echo "Ошибка db push — запусти PostgreSQL:"
    echo "  pnpm dev:db"
    echo "или настрой DATABASE_URL в .env"
    exit 1
  fi
fi

if [[ "$RUN_TYPECHECK" -eq 1 ]]; then
  echo "==> Проверка типов (--full)"
  pnpm run typecheck
fi

echo ""
echo "Готово. Запуск:"
echo "  pnpm dev"
echo "  Web: http://localhost:5000"
echo ""
echo "Демо без Windows: http://localhost:5000/games/rogue-fable-3"
