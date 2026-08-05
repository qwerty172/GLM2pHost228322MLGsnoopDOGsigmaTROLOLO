# Быстрый старт — 3 команды

Цель: от нуля до демо в браузере **без Windows-агента**.

## 1. Postgres (если ещё нет)

```bash
pnpm dev:db
```

Поднимает PostgreSQL из `infra/docker-compose.dev.yml`. Если Postgres уже установлен локально — пропустите и настройте `DATABASE_URL` в `.env`.

## 2. Настройка

```bash
pnpm setup
```

Создаёт `.env`, генерирует секреты, `pnpm install`, `db push`.

С Docker Postgres:

```bash
pnpm setup --docker-db
```

Полная проверка типов:

```bash
pnpm setup:full
```

## 3. Запуск

```bash
pnpm dev
```

| Сервис | URL |
|---|---|
| Web | http://localhost:5000 |
| API | http://localhost:8080/api/healthz |
| **Демо (браузерная игра)** | http://localhost:5000/games/rogue-fable-3 |

`pnpm dev` ждёт готовности API, затем стартует Web — без конфликта портов (API :8080, Web :5000).

## Проверка

```bash
pnpm doctor
```

Показывает что готово и что опционально (Redis, TURN, Object Storage).

## На потом

| Задача | Команда |
|---|---|
| Redis + coturn | `pnpm dev:infra` |
| Smoke API | `./scripts/smoke-api.sh` |
| Windows-агент | `artifacts/host-agent` |
| Полный TESTPLAN | [TESTPLAN.md](./TESTPLAN.md) |
