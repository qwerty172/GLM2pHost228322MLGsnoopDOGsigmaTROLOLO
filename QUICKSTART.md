# Быстрый старт — 3 команды

Нужны: **Node 20+**, **pnpm 9+**, **Docker** (для PostgreSQL) или свой PostgreSQL 16.

```bash
pnpm dev:db    # PostgreSQL в Docker (один раз, пока контейнер жив)
pnpm setup     # .env, секреты, pnpm install, схема БД
pnpm dev       # API :8080 + Web :5000
```

Открой http://localhost:5000 → **«Демо без Windows»** или http://localhost:5000/games/rogue-fable-3

Проверка API: http://localhost:8080/api/healthz → `{"status":"ok"}`

---

## Windows

```bat
pnpm dev:db
pnpm setup
pnpm dev
```

Или `scripts\setup-local.bat` и `scripts\dev-local.bat`.

---

## Если PostgreSQL уже есть

Отредактируй `DATABASE_URL` в `.env` и пропусти `pnpm dev:db`.

---

## Потом, когда понадобится

| Задача | Команда |
|---|---|
| Полная проверка типов | `pnpm setup:full` или `pnpm run typecheck` |
| Redis + coturn | `docker compose -f infra/docker-compose.dev.yml up -d` |
| Smoke-тест API | `./scripts/smoke-api.sh` |
| План тестирования | [TESTPLAN.md](./TESTPLAN.md) |
| Подробная настройка | [LOCAL_SETUP.md](./LOCAL_SETUP.md) |
