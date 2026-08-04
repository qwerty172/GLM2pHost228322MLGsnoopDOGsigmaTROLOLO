#!/usr/bin/env bash
# Один скрипт: Docker (если есть) → настройка → API + Web
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="infra/docker-compose.dev.yml"
USE_DOCKER=1
SETUP_ONLY=0
SETUP_ARGS=()

for arg in "$@"; do
  case "$arg" in
    --no-docker) USE_DOCKER=0 ;;
    --setup-only) SETUP_ONLY=1 ;;
    *) SETUP_ARGS+=("$arg") ;;
  esac
done

echo "==> DecentralHub — быстрый старт"

if [[ "$USE_DOCKER" -eq 1 ]] && command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "==> PostgreSQL + Redis (Docker)"
  docker compose -f "$COMPOSE_FILE" up -d postgres redis

  echo -n "Ждём PostgreSQL"
  for _ in $(seq 1 45); do
    if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U decentral_hub -d decentral_hub >/dev/null 2>&1; then
      echo " — готово"
      break
    fi
    echo -n "."
    sleep 1
  done

  if ! docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U decentral_hub -d decentral_hub >/dev/null 2>&1; then
    echo ""
    echo "PostgreSQL не поднялся за 45с — проверь: docker compose -f $COMPOSE_FILE logs postgres" >&2
    exit 1
  fi

  if [[ ! -f .env ]]; then
    cp .env.docker .env
    echo "Создан .env из .env.docker"
  fi
elif [[ "$USE_DOCKER" -eq 1 ]]; then
  echo "Docker недоступен — нужен свой PostgreSQL и DATABASE_URL в .env"
  if [[ ! -f .env ]]; then
    cp .env.example .env
    echo "Создан .env из .env.example — проверь DATABASE_URL"
  fi
fi

./scripts/setup-local.sh "${SETUP_ARGS[@]}"

if [[ "$SETUP_ONLY" -eq 0 ]]; then
  exec ./scripts/dev-local.sh
fi
