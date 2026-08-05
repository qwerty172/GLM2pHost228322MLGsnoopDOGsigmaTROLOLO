#!/usr/bin/env bash
# Общие хелперы для setup-скриптов (Linux/macOS/Git Bash)

# Заполнить пустое значение KEY в .env случайным hex (length байт * 2 символов).
ensure_env_secret() {
  local key="$1"
  local bytes="${2:-32}"
  if grep -q "^${key}=$" .env 2>/dev/null; then
    local val
    val=$(node -e "console.log(require('crypto').randomBytes(${bytes}).toString('hex'))")
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' "s/^${key}=$/${key}=${val}/" .env
    else
      sed -i "s/^${key}=$/${key}=${val}/" .env
    fi
    echo "Сгенерирован ${key}"
  fi
}

# Подставить DATABASE_URL, если в .env ещё плейсхолдер из .env.example.
ensure_docker_database_url() {
  local docker_url="postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"
  if grep -qE '^DATABASE_URL=postgresql://user:password@' .env 2>/dev/null; then
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=${docker_url}|" .env
    else
      sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${docker_url}|" .env
    fi
    echo "DATABASE_URL → Docker Compose (postgres)"
  fi
}

wait_for_postgres() {
  local compose_file="$1"
  local i
  for i in $(seq 1 30); do
    if docker compose -f "$compose_file" exec -T postgres pg_isready -U decentral_hub -d decentral_hub >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "PostgreSQL в Docker не ответил за 30 с — проверь docker compose logs" >&2
  return 1
}

start_dev_infra() {
  local compose_file="$1"
  if ! command -v docker >/dev/null 2>&1; then
    return 1
  fi
  if ! docker compose version >/dev/null 2>&1; then
    return 1
  fi
  echo "==> Docker: postgres + redis"
  docker compose -f "$compose_file" up -d postgres redis
  wait_for_postgres "$compose_file"
}
