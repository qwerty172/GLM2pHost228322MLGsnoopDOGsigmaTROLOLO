# Быстрый старт — 3 команды

Запустить платформу локально и попробовать **браузерное демо без Windows-агента**.

## Требования

- Node.js 20+
- [pnpm](https://pnpm.io/installation) 9+
- [Docker](https://docs.docker.com/get-docker/) (для PostgreSQL одной командой)

Если PostgreSQL уже установлен — шаг 1 можно пропустить и указать свой `DATABASE_URL` в `.env`.

---

## 1. База данных

```bash
pnpm dev:db
```

Поднимает PostgreSQL 16 в Docker (`decentral_hub` / `decentral_hub` на порту 5432).

## 2. Настройка

```bash
pnpm setup
```

- Создаёт `.env` из `.env.example`
- Генерирует `WALLET_ENCRYPTION_KEY` и `JWT_SECRET`
- Устанавливает зависимости
- Применяет схему БД (если Postgres доступен)

Полная проверка с typecheck: `pnpm setup:full`

## 3. Запуск

```bash
pnpm dev
```

- Стартует API (порт 8080)
- Ждёт `/api/healthz`
- Стартует Web (порт 5000)

---

## Что открыть в браузере

| URL | Зачем |
|-----|-------|
| http://localhost:5000 | Главная |
| http://localhost:5000/games/rogue-fable-3 | **Демо без Windows** — браузерная игра, кнопка «Хостить» |
| http://localhost:8080/api/healthz | Проверка API |

На главной есть кнопка **«Демо без Windows»** — ведёт на Rogue Fable III.

---

## Опционально (на потом)

| Команда | Зачем |
|---------|-------|
| `pnpm dev:infra` | Postgres + Redis + coturn (WebRTC через TURN) |
| `pnpm dev:db:down` | Остановить контейнер Postgres |
| `./scripts/dev-local.sh` | Альтернативный запуск (без ожидания healthz) |
| [LOCAL_SETUP.md](./LOCAL_SETUP.md) | Подробная инструкция для Windows |
| [TESTPLAN.md](./TESTPLAN.md) | Полный план тестирования |
