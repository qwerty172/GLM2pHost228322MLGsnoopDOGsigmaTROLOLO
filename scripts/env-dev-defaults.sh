#!/usr/bin/env bash
# Общие функции для локального .env (используются setup-local.sh и bootstrap.sh)
set -euo pipefail

generate_hex_secret() {
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

set_env_var() {
  local key="$1"
  local value="$2"
  local file="${3:-.env}"
  if [[ ! -f "$file" ]]; then
    return 1
  fi
  if grep -q "^${key}=" "$file"; then
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' "s|^${key}=.*|${key}=${value}|" "$file"
    else
      sed -i "s|^${key}=.*|${key}=${value}|" "$file"
    fi
  else
    echo "${key}=${value}" >>"$file"
  fi
}

ensure_empty_env_secret() {
  local key="$1"
  local file="${2:-.env}"
  if [[ ! -f "$file" ]]; then
    return 0
  fi
  local current
  current=$(grep -E "^${key}=" "$file" 2>/dev/null | head -1 | cut -d= -f2- || true)
  if [[ -z "${current// }" ]]; then
    set_env_var "$key" "$(generate_hex_secret)" "$file"
    echo "Сгенерирован ${key}"
  fi
}

apply_docker_database_url() {
  local file="${1:-.env}"
  local url="postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub"
  set_env_var "DATABASE_URL" "$url" "$file"
  echo "DATABASE_URL → Docker PostgreSQL (decentral_hub)"
}
