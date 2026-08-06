#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
# Использование: pnpm setup  |  pnpm setup -- --full  (с typecheck)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FULL_CHECK=false
for arg in "$@"; do
  if [[ "$arg" == "--full" ]]; then FULL_CHECK=true; fi
done

DOCKER_DB_URL="postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"

echo "==> DecentralHub — локальная настройка"

# ── Docker: Postgres + Redis (если доступен) ─────────────────────────────────
USE_DOCKER=false
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  echo "==> Docker: поднимаем Postgres и Redis"
  docker compose -f infra/docker-compose.dev.yml up -d postgres redis
  USE_DOCKER=true
  # Ждём готовности Postgres (до 30 с)
  for i in $(seq 1 30); do
    if docker compose -f infra/docker-compose.dev.yml exec -T postgres pg_isready -U decentral_hub -d decentral_hub >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
else
  echo "Docker не найден — используй свой PostgreSQL (см. .env DATABASE_URL)"
fi

# ── .env ─────────────────────────────────────────────────────────────────────
if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Создан .env из .env.example"
else
  echo ".env уже существует — пропускаем копирование"
fi

# Подставляем Docker DATABASE_URL, если ещё стоит placeholder
if $USE_DOCKER && grep -qE '^DATABASE_URL=postgresql://user:password@' .env 2>/dev/null; then
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=$DOCKER_DB_URL|" .env
  else
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$DOCKER_DB_URL|" .env
  fi
  echo "DATABASE_URL → Docker Postgres"
fi

# Генерируем секреты, если пустые
gen_secret() {
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

for key in WALLET_ENCRYPTION_KEY JWT_SECRET; do
  if grep -qE "^${key}=$" .env 2>/dev/null; then
    VAL=$(gen_secret)
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' "s/^${key}=$/${key}=${VAL}/" .env
    else
      sed -i "s/^${key}=$/${key}=${VAL}/" .env
    fi
    echo "Сгенерирован ${key}"
  fi
done

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД"
pnpm --filter @workspace/db run push

if $FULL_CHECK; then
  echo "==> Проверка типов (--full)"
  pnpm run typecheck
fi

echo ""
echo "Готово! Запуск:"
echo "  pnpm dev              — API + Web (2 сервиса)"
echo "  Web:  http://localhost:5000"
echo "  API:  http://localhost:8080/api/healthz"
