#!/usr/bin/env bash
# Общая подготовка .env: копирование шаблона, автогенерация секретов.
# Подключается из setup-local.sh и dev-up.sh (source, не exec).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

_generate_hex() {
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

_sed_inplace() {
  local expr="$1"
  local file="$2"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "$expr" "$file"
  else
    sed -i "$expr" "$file"
  fi
}

_set_env_if_empty() {
  local key="$1"
  local file="$2"
  if grep -q "^${key}=$" "$file" 2>/dev/null; then
    local value="$(_generate_hex)"
    _sed_inplace "s|^${key}=$|${key}=${value}|" "$file"
    echo "  ✓ Сгенерирован ${key}"
  fi
}

bootstrap_env() {
  cd "$ROOT"

  if [[ ! -f .env ]]; then
    cp .env.example .env
    echo "  ✓ Создан .env из .env.example"
  fi

  _set_env_if_empty WALLET_ENCRYPTION_KEY .env
  _set_env_if_empty JWT_SECRET .env
}
