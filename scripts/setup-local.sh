#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> DecentralHub — локальная настройка"

DOCKER_DB_URL="postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Создан .env из .env.example"
else
  echo ".env уже существует — пропускаем копирование"
fi

# Поднять инфраструктуру через Docker, если доступен
if command -v docker >/dev/null 2>&1; then
  echo "==> Инфраструктура (Docker)"
  ./scripts/infra-up.sh || true
  # Прописать DATABASE_URL под docker-compose, если ещё placeholder
  if grep -qE '^DATABASE_URL=postgresql://user:password@' .env 2>/dev/null; then
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=$DOCKER_DB_URL|" .env
    else
      sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$DOCKER_DB_URL|" .env
    fi
    echo "DATABASE_URL обновлён под Docker Compose"
  fi
else
  echo "Docker не найден — убедись, что PostgreSQL запущен и DATABASE_URL в .env верный"
fi

gen_secret() {
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

patch_env_key() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=$" .env 2>/dev/null; then
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' "s/^${key}=$/${key}=${val}/" .env
    else
      sed -i "s/^${key}=$/${key}=${val}/" .env
    fi
    echo "Сгенерирован ${key}"
  fi
}

patch_env_key "WALLET_ENCRYPTION_KEY" "$(gen_secret)"
patch_env_key "JWT_SECRET" "$(gen_secret)"

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД (нужен запущенный PostgreSQL и DATABASE_URL в .env)"
pnpm --filter @workspace/db run push

if [[ "${SKIP_TYPECHECK:-}" != "1" ]]; then
  echo "==> Проверка типов (SKIP_TYPECHECK=1 чтобы пропустить)"
  pnpm run typecheck
fi

echo ""
echo "Готово! Запуск:"
echo "  pnpm dev                        — API + Web"
echo "  http://localhost:5000/try       — мгновенная демо-игра без установки"
echo ""
