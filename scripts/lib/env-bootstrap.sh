#!/usr/bin/env bash
# Общая логика автонастройки .env для локальной разработки.
# Используется в setup-local.sh и quickstart.sh.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT/infra/docker-compose.dev.yml"

sed_inplace() {
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

random_hex() {
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

set_env_var() {
  local key="$1"
  local value="$2"
  local file="$ROOT/.env"

  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed_inplace "s|^${key}=.*|${key}=${value}|" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

ensure_env_file() {
  if [[ ! -f "$ROOT/.env" ]]; then
    cp "$ROOT/.env.example" "$ROOT/.env"
    echo "Создан .env из .env.example"
  fi
}

ensure_dev_secrets() {
  ensure_env_file

  if grep -q '^WALLET_ENCRYPTION_KEY=$' "$ROOT/.env" 2>/dev/null; then
    set_env_var WALLET_ENCRYPTION_KEY "$(random_hex)"
    echo "Сгенерирован WALLET_ENCRYPTION_KEY"
  fi

  if grep -q '^JWT_SECRET=$' "$ROOT/.env" 2>/dev/null; then
    set_env_var JWT_SECRET "$(random_hex)"
    echo "Сгенерирован JWT_SECRET"
  fi

  if grep -q '^ADMIN_SECRET=change-me-local-dev' "$ROOT/.env" 2>/dev/null; then
    set_env_var ADMIN_SECRET "local-dev-$(random_hex | cut -c1-16)"
  fi
}

ensure_docker_defaults() {
  ensure_env_file

  # Значения совпадают с infra/docker-compose.dev.yml
  if grep -qE '^DATABASE_URL=postgresql://user:password@' "$ROOT/.env" 2>/dev/null; then
    set_env_var DATABASE_URL "postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"
    echo "DATABASE_URL → Docker Postgres (decentral_hub/decentral_hub)"
  fi

  if grep -q '^REDIS_URL=$' "$ROOT/.env" 2>/dev/null || ! grep -q '^REDIS_URL=' "$ROOT/.env" 2>/dev/null; then
    set_env_var REDIS_URL "redis://127.0.0.1:6379"
  fi
}

docker_compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
  else
    return 1
  fi
}

start_docker_services() {
  local compose
  compose="$(docker_compose_cmd)" || return 1

  if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo "Нет $COMPOSE_FILE" >&2
    return 1
  fi

  echo "==> Docker: Postgres + Redis"
  $compose -f "$COMPOSE_FILE" up -d postgres redis

  echo "==> Ожидание Postgres..."
  local i
  for i in $(seq 1 30); do
    if $compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U decentral_hub -d decentral_hub >/dev/null 2>&1; then
      echo "Postgres готов"
      return 0
    fi
    sleep 1
  done

  echo "Postgres не ответил за 30с — проверь docker logs" >&2
  return 1
}

has_docker() {
  command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1
}
