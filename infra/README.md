# Инфраструктура для локальной разработки

## Быстрый старт

Из корня репозитория:

```bash
pnpm infra:up    # PostgreSQL + Redis
pnpm infra:down  # остановить контейнеры
```

`pnpm setup` вызывает `infra:up` автоматически, если Docker доступен.

## Сервисы

| Сервис | Порт | Назначение |
|---|---|---|
| `postgres` | 5432 | БД `decentral_hub` / user `decentral_hub` / pass `decentral_hub` |
| `redis` | 6379 | Опционально — rate limit, кэш (API работает и без Redis) |
| `coturn` | 3478 | **На потом** — TURN для WebRTC через NAT |

## coturn (WebRTC)

Нужен только если тестируете стриминг через сложные NAT. Для обхода UI и API не требуется.

```bash
docker compose -f infra/docker-compose.dev.yml up -d coturn
```

Настрой `TURN_SECRET` и `TURN_URLS` в `.env` — см. `infra/coturn/turnserver.conf`.
