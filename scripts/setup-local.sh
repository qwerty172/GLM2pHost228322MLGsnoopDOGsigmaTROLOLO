#!/usr/bin/env bash
# Первичная настройка локального окружения (Linux/macOS/Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

gen_hex() {
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

set_env_if_empty() {
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

echo "==> DecentralHub — локальная настройка"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Создан .env из .env.example"
else
  echo ".env уже существует — пропускаем копирование"
fi

# DATABASE_URL по умолчанию совпадает с infra/docker-compose.dev.yml
if grep -qE '^DATABASE_URL=postgresql://user:password@' .env 2>/dev/null; then
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' 's|^DATABASE_URL=.*|DATABASE_URL=postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub|' .env
  else
    sed -i 's|^DATABASE_URL=.*|DATABASE_URL=postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub|' .env
  fi
  echo "DATABASE_URL → docker-compose (decentral_hub@localhost:5432)"
fi

set_env_if_empty "WALLET_ENCRYPTION_KEY" "$(gen_hex)"
set_env_if_empty "JWT_SECRET" "$(gen_hex)"

echo "==> pnpm install"
pnpm install

echo "==> Применение схемы БД (нужен запущенный PostgreSQL)"
if ! pnpm --filter @workspace/db run push; then
  echo ""
  echo "Ошибка db push. Подними БД: pnpm infra:up  (или свой PostgreSQL в DATABASE_URL)"
  exit 1
fi

if [[ "${SKIP_TYPECHECK:-}" != "1" ]]; then
  echo "==> Проверка типов"
  pnpm run typecheck
fi

echo ""
echo "Готово. Запуск:"
echo "  pnpm dev              — API + Web"
echo "  pnpm quickstart       — infra + setup + dev (с нуля)"
echo "  http://localhost:5000 — веб-интерфейс"
