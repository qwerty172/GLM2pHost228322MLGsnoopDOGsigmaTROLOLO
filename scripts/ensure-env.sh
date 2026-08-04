#!/usr/bin/env bash
# Создаёт и дополняет .env для локальной разработки (Docker Postgres по умолчанию).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

sed_inplace() {
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Создан .env из .env.example"
fi

# Docker Compose из infra/docker-compose.dev.yml
if grep -qE '^DATABASE_URL=(postgresql://user:password@|)$' .env 2>/dev/null \
  || grep -q '^DATABASE_URL=$' .env 2>/dev/null; then
  sed_inplace 's|^DATABASE_URL=.*|DATABASE_URL=postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub|' .env
  echo "DATABASE_URL → Docker Postgres (decentral_hub@localhost:5432)"
fi

if grep -q '^WALLET_ENCRYPTION_KEY=$' .env 2>/dev/null; then
  KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  sed_inplace "s/^WALLET_ENCRYPTION_KEY=$/WALLET_ENCRYPTION_KEY=$KEY/" .env
  echo "Сгенерирован WALLET_ENCRYPTION_KEY"
fi

if grep -q '^JWT_SECRET=$' .env 2>/dev/null; then
  JWT=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  sed_inplace "s/^JWT_SECRET=$/JWT_SECRET=$JWT/" .env
  echo "Сгенерирован JWT_SECRET"
fi
