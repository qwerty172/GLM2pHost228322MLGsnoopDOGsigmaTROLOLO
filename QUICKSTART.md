# Быстрый старт — 3 команды

Запустить платформу локально и поиграть в **Rogue Fable III** прямо в браузере — без Windows-агента.

## Требования

- Node.js 20+
- pnpm 9+
- Docker (для PostgreSQL) **или** свой PostgreSQL 16

## Запуск

```bash
pnpm dev:db        # 1. PostgreSQL в Docker (один раз, пока контейнер жив)
pnpm bootstrap     # 2. .env, секреты, зависимости, схема БД
pnpm dev           # 3. API + Web
```

Открой http://localhost:5000 и нажми **«Демо без Windows»** — игра запустится в браузере.

## Проверка

| Что | URL |
|---|---|
| Web | http://localhost:5000 |
| API health | http://localhost:8080/api/healthz |
| Демо-игра | http://localhost:5000/games/rogue-fable-3 |

## Свой PostgreSQL вместо Docker

Отредактируй `DATABASE_URL` в `.env`, затем снова `pnpm bootstrap`.

## Позже, когда понадобится

| Команда | Зачем |
|---|---|
| `pnpm bootstrap:full` | bootstrap + проверка типов |
| `pnpm dev:infra` | Postgres + Redis + coturn (WebRTC) |
| `pnpm run typecheck` | TypeScript по всему monorepo |
| `./scripts/dev-local.sh` | альтернативный запуск (bash) |
| [LOCAL_SETUP.md](./LOCAL_SETUP.md) | полная инструкция + Windows |
| [TESTPLAN.md](./TESTPLAN.md) | план ручного тестирования |
