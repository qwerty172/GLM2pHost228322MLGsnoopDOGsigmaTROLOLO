#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> DecentralHub — локальная настройка"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Создан .env из .env.example"
else
  echo ".env уже существует — пропускаем копирование"
fi

gen_secret() {
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

patch_env_key() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=$" .env 2>/dev/null; then
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' "s|^${key}=$|${key}=${value}|" .env
    else
      sed -i "s|^${key}=$|${key}=${value}|" .env
    fi
    echo "Сгенерирован ${key}"
  fi
}

patch_env_key "WALLET_ENCRYPTION_KEY" "$(gen_secret)"
patch_env_key "JWT_SECRET" "$(gen_secret)"

# Подставляем docker-compose credentials, если остался шаблон user:password
if grep -q '^DATABASE_URL=postgresql://user:password@' .env 2>/dev/null; then
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' 's|^DATABASE_URL=postgresql://user:password@|DATABASE_URL=postgresql://decentral_hub:decentral_hub@|' .env
  else
    sed -i 's|^DATABASE_URL=postgresql://user:password@|DATABASE_URL=postgresql://decentral_hub:decentral_hub@|' .env
  fi
  echo "DATABASE_URL → docker-compose (decentral_hub/decentral_hub)"
fi

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД (нужен запущенный PostgreSQL и DATABASE_URL в .env)"
pnpm --filter @workspace/db run push

echo "==> Проверка типов"
pnpm run typecheck

echo ""
echo "Готово. Запуск:"
echo "  pnpm dev                        — API + Web"
echo "  curl http://localhost:8080/api/readyz  — проверка БД"
echo "  http://localhost:5000           — веб-интерфейс"
echo "  docs/QUICKSTART.md              — краткая шпаргалка"
